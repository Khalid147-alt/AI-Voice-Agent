"""Post-call analysis pipeline built with LangGraph.

A 4-node graph runs after each call:
  extract_sentiment -> classify_intent -> score_lead -> recommend_action

Each node uses Google Gemini (gemini-2.5-flash) via langchain-google-genai. If a
Gemini call fails transiently (network, rate limit), the node falls back to a
deterministic heuristic so a single call still produces a complete analysis
rather than erroring out.

(Migrated from a previous OpenAI-based implementation to Gemini 2.5 Flash.)
"""
import asyncio
import concurrent.futures
from typing import TypedDict, Optional, List

from config import settings

# Gemini chat model. Guarded so the backend still boots even if the package is
# unavailable; nodes catch failures and fall back to heuristics.
try:
    from langchain_google_genai import ChatGoogleGenerativeAI

    _GEMINI_AVAILABLE = True
except Exception:  # pragma: no cover - optional at import time
    ChatGoogleGenerativeAI = None
    _GEMINI_AVAILABLE = False

try:
    from langgraph.graph import StateGraph, END

    _LANGGRAPH_AVAILABLE = True
except Exception:  # pragma: no cover - langgraph optional at import time
    _LANGGRAPH_AVAILABLE = False
    StateGraph = None
    END = "__end__"


class AnalysisState(TypedDict, total=False):
    call_id: str
    transcript: List[dict]
    summary: Optional[str]
    sentiment: Optional[str]      # positive | neutral | negative
    intent: Optional[str]         # book_demo | needs_followup | not_interested | already_customer
    lead_score: Optional[int]     # 0-100
    next_action: Optional[str]
    error: Optional[str]


def get_llm():
    """Return a Gemini 2.5 Flash chat model. Raises if Gemini is unavailable."""
    if not _GEMINI_AVAILABLE:
        raise RuntimeError("langchain-google-genai not available")
    try:
        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=0.3,
            convert_system_message_to_human=True,
        )
    except TypeError:
        # Older/newer signatures may not accept convert_system_message_to_human.
        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=0.3,
        )


def _gemini_enabled() -> bool:
    return _GEMINI_AVAILABLE and bool(settings.GOOGLE_API_KEY.strip())


def _transcript_text(transcript: List[dict]) -> str:
    parts = []
    for m in transcript or []:
        role = m.get("role", "")
        content = m.get("content") or m.get("message") or m.get("transcript") or ""
        if content:
            parts.append(f"{role}: {content}")
    return "\n".join(parts)


# ----- Heuristic fallbacks (used on any transient Gemini error) -----
def _heuristic_sentiment(text: str) -> str:
    lower = text.lower()
    pos = sum(w in lower for w in ("great", "interested", "yes", "love", "perfect", "sounds good", "absolutely"))
    neg = sum(w in lower for w in ("not interested", "no thanks", "busy", "expensive", "remove"))
    return "positive" if pos > neg else "negative" if neg > pos else "neutral"


def _heuristic_intent(text: str, sentiment: Optional[str]) -> str:
    lower = text.lower()
    if any(w in lower for w in ("book", "demo", "schedule", "calendar")):
        return "book_demo"
    if "already" in lower or "customer" in lower:
        return "already_customer"
    if sentiment == "negative":
        return "not_interested"
    return "needs_followup"


def _heuristic_score(sentiment: Optional[str], intent: Optional[str]) -> int:
    base = {"positive": 70, "neutral": 45, "negative": 20}.get(sentiment or "neutral", 45)
    intent_bonus = {
        "book_demo": 25,
        "needs_followup": 10,
        "already_customer": 5,
        "not_interested": -15,
    }.get(intent or "needs_followup", 0)
    return max(0, min(100, base + intent_bonus))


def _heuristic_action(intent: Optional[str]) -> str:
    mapping = {
        "book_demo": "Send calendar invite and prep a tailored demo.",
        "needs_followup": "Schedule a follow-up call within 3 business days.",
        "not_interested": "Mark as cold; add to long-term nurture sequence.",
        "already_customer": "Route to account management — no sales follow-up needed.",
    }
    return mapping.get(intent or "needs_followup", "Follow up with the prospect.")


# ----- Nodes (async, Gemini-first with heuristic fallback) -----
async def extract_sentiment_node(state: AnalysisState) -> AnalysisState:
    transcript_text = _transcript_text(state.get("transcript", []))
    if _gemini_enabled():
        try:
            llm = get_llm()
            response = await llm.ainvoke(
                f"Analyze the sentiment of this call transcript. "
                f"Reply with exactly one word: positive, neutral, or negative.\n\n"
                f"Transcript:\n{transcript_text}"
            )
            word = response.content.strip().lower().split()[0].strip(".,!")
            if word in {"positive", "neutral", "negative"}:
                return {**state, "sentiment": word}
        except Exception:
            pass
    return {**state, "sentiment": _heuristic_sentiment(transcript_text)}


async def classify_intent_node(state: AnalysisState) -> AnalysisState:
    transcript_text = _transcript_text(state.get("transcript", []))
    valid = {"book_demo", "needs_followup", "not_interested", "already_customer"}
    if _gemini_enabled():
        try:
            llm = get_llm()
            response = await llm.ainvoke(
                f"Classify the prospect's intent from this call transcript. "
                f"Reply with exactly one of these: book_demo, needs_followup, "
                f"not_interested, already_customer.\n\n"
                f"Transcript:\n{transcript_text}"
            )
            word = response.content.strip().lower().split()[0].strip(".,!")
            if word in valid:
                return {**state, "intent": word}
        except Exception:
            pass
    return {**state, "intent": _heuristic_intent(transcript_text, state.get("sentiment"))}


async def score_lead_node(state: AnalysisState) -> AnalysisState:
    transcript_text = _transcript_text(state.get("transcript", []))
    if _gemini_enabled():
        try:
            llm = get_llm()
            response = await llm.ainvoke(
                f"Score this sales lead from 0 to 100 based on the call transcript. "
                f"100 means extremely likely to convert. "
                f"Reply with only a number between 0 and 100, nothing else.\n\n"
                f"Transcript:\n{transcript_text}\n"
                f"Sentiment: {state.get('sentiment')}\n"
                f"Intent: {state.get('intent')}"
            )
            score = int("".join(ch for ch in response.content.strip() if ch.isdigit()) or "50")
            score = max(0, min(100, score))
            return {**state, "lead_score": score}
        except Exception:
            pass
    return {
        **state,
        "lead_score": _heuristic_score(state.get("sentiment"), state.get("intent")),
    }


async def recommend_action_node(state: AnalysisState) -> AnalysisState:
    if _gemini_enabled():
        try:
            llm = get_llm()
            response = await llm.ainvoke(
                f"Based on this call analysis, recommend the single best next action "
                f"for the sales team. Be specific and concise (one sentence).\n\n"
                f"Sentiment: {state.get('sentiment')}\n"
                f"Intent: {state.get('intent')}\n"
                f"Lead Score: {state.get('lead_score')}/100"
            )
            action = response.content.strip()
            if action:
                return {**state, "next_action": action}
        except Exception:
            pass
    return {**state, "next_action": _heuristic_action(state.get("intent"))}


def build_analysis_graph():
    """Compile and return the async LangGraph pipeline.

    Falls back to a minimal async chain mimicking the graph interface if
    LangGraph is unavailable. The 4-node structure and edges are unchanged.
    """
    if _LANGGRAPH_AVAILABLE:
        graph = StateGraph(AnalysisState)
        graph.add_node("extract_sentiment", extract_sentiment_node)
        graph.add_node("classify_intent", classify_intent_node)
        graph.add_node("score_lead", score_lead_node)
        graph.add_node("recommend_action", recommend_action_node)
        graph.set_entry_point("extract_sentiment")
        graph.add_edge("extract_sentiment", "classify_intent")
        graph.add_edge("classify_intent", "score_lead")
        graph.add_edge("score_lead", "recommend_action")
        graph.add_edge("recommend_action", END)
        return graph.compile()

    # Fallback: an async callable chain mimicking the compiled graph interface.
    class _Chain:
        async def ainvoke(self, state: AnalysisState) -> AnalysisState:
            for node in (
                extract_sentiment_node,
                classify_intent_node,
                score_lead_node,
                recommend_action_node,
            ):
                state = await node(state)
            return state

    return _Chain()


_graph = build_analysis_graph()


def _run_graph_sync(state: AnalysisState) -> AnalysisState:
    """Run the async graph to completion from a sync context.

    Safe to call from inside a running event loop (e.g. the FastAPI webhook
    handler): in that case the graph is executed on a dedicated worker thread
    with its own loop so we never collide with the caller's loop.
    """
    async def _runner():
        return await _graph.ainvoke(state)

    try:
        running = asyncio.get_running_loop()
    except RuntimeError:
        running = None

    if running and running.is_running():
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            return ex.submit(lambda: asyncio.run(_runner())).result()
    return asyncio.run(_runner())


def analyze_transcript(call_id: str, transcript: List[dict]) -> dict:
    """Run the pipeline and return the analysis dict (sync wrapper)."""
    state: AnalysisState = {
        "call_id": call_id,
        "transcript": transcript or [],
        "summary": None,
        "sentiment": None,
        "intent": None,
        "lead_score": None,
        "next_action": None,
        "error": None,
    }
    try:
        result = _run_graph_sync(state)
    except Exception as exc:  # pragma: no cover
        return {"error": str(exc)}
    return {
        "sentiment": result.get("sentiment"),
        "intent": result.get("intent"),
        "lead_score": result.get("lead_score"),
        "next_action": result.get("next_action"),
    }


async def save_analysis_to_db(call_id: str, analysis: dict) -> None:
    """Merge an analysis dict into the Call row's analysis JSON column."""
    from sqlalchemy import select

    from database import AsyncSessionLocal
    from models.call import Call

    async with AsyncSessionLocal() as db:
        call = (await db.execute(select(Call).where(Call.id == call_id))).scalar_one_or_none()
        if not call:
            return
        merged = dict(call.analysis or {})
        merged.update({k: v for k, v in analysis.items() if v is not None})
        call.analysis = merged
        score = analysis.get("lead_score")
        if score is not None and not call.interest_level:
            call.interest_level = "hot" if score >= 75 else "warm" if score >= 45 else "cold"
        await db.commit()


async def run_post_call_analysis(call_id: str) -> dict:
    """Run the Gemini-backed LangGraph analysis for a stored call and persist it.

    Individual nodes fall back to heuristics if a Gemini call fails transiently,
    so this always returns a complete analysis.
    """
    from sqlalchemy import select

    from database import AsyncSessionLocal
    from models.call import Call

    async with AsyncSessionLocal() as db:
        call = (await db.execute(select(Call).where(Call.id == call_id))).scalar_one_or_none()
        transcript = call.transcript if call else []

    state: AnalysisState = {
        "call_id": call_id,
        "transcript": transcript or [],
        "summary": None,
        "sentiment": None,
        "intent": None,
        "lead_score": None,
        "next_action": None,
        "error": None,
    }
    result = await _graph.ainvoke(state)
    analysis = {
        "sentiment": result.get("sentiment"),
        "intent": result.get("intent"),
        "lead_score": result.get("lead_score"),
        "next_action": result.get("next_action"),
    }
    await save_analysis_to_db(call_id, analysis)
    return analysis
