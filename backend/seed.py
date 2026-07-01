"""Seed the database with realistic demo data on first run."""
import random
from datetime import datetime, timedelta

from sqlalchemy import select, func

from database import AsyncSessionLocal
from models.agent import Agent
from models.call import Call
from models.contact import Contact


VOICES = {
    "Rachel": "21m00Tcm4TlvDq8ikWAM",
    "Adam": "pNInz6obpgDQGcFmaJgB",
    "Elli": "MF3mGyEYCl7XYWbV9V6O",
    "Josh": "TxGEqnHWrfWFTfGW9XjX",
    "Bella": "EXAVITQu4vr4xnSDxMaL",
}

AGENTS = [
    {
        "name": "Sarah — Sales Qualifier",
        "description": "Qualifies inbound SaaS leads and books demos.",
        "voice_name": "Rachel",
        "first_message": "Hi, this is Sarah from VoiceDesk! Do you have a quick minute to chat about your outreach?",
        "system_prompt": (
            "You are Sarah, a friendly and concise SaaS sales qualifier. Your goal is to "
            "understand the prospect's current outbound calling process, identify pain points, "
            "and book a product demo. Ask one question at a time. If they agree, call "
            "book_appointment. Keep it natural and warm."
        ),
    },
    {
        "name": "Mike — Appointment Setter",
        "description": "Outbound demo booking specialist.",
        "voice_name": "Adam",
        "first_message": "Hey, it's Mike from VoiceDesk. I'm reaching out about automating your sales calls — got a sec?",
        "system_prompt": (
            "You are Mike, an energetic outbound appointment setter. Be direct but polite. "
            "Quickly establish relevance, handle objections about time and budget, and book a "
            "20-minute demo. Use book_appointment when they agree."
        ),
    },
    {
        "name": "Emma — Support Triage",
        "description": "Routes and triages inbound support calls.",
        "voice_name": "Elli",
        "first_message": "Thanks for calling VoiceDesk support, this is Emma. How can I help you today?",
        "system_prompt": (
            "You are Emma, a calm and helpful support triage agent. Identify the caller's issue, "
            "categorize urgency, and either resolve simple questions or route to the right team. "
            "Be empathetic and efficient."
        ),
    },
]

FIRST_NAMES = ["James", "Olivia", "Liam", "Emma", "Noah", "Ava", "William", "Sophia",
               "Benjamin", "Isabella", "Lucas", "Mia", "Henry", "Charlotte", "Alex",
               "Amelia", "Daniel", "Harper", "Michael", "Ella"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
              "Davis", "Wilson", "Taylor", "Clark", "Walker", "Hall", "Allen",
              "Young", "King", "Wright", "Scott", "Green", "Baker"]
COMPANIES = ["Northwind Labs", "Acme SaaS", "Brightpath", "Cloudbase", "Datapoint",
             "Evergreen Tech", "Finchley Co", "Greylock", "Helio", "Ionix",
             "Juniper", "Kestrel", "Lumen", "Meridian", "Novato",
             "Orbit", "Pinnacle", "Quantia", "Riverstone", "Summit"]

SAMPLE_TRANSCRIPT = [
    {"role": "assistant", "content": "Hi, this is Sarah from VoiceDesk! Do you have a quick minute?", "timestamp": 0},
    {"role": "user", "content": "Sure, go ahead.", "timestamp": 2800},
    {"role": "assistant", "content": "Great — are you currently making outbound sales calls manually?", "timestamp": 5200},
    {"role": "user", "content": "Yeah, my team does about fifty a day. It's exhausting.", "timestamp": 9100},
    {"role": "assistant", "content": "I hear that a lot. We automate that with AI voice agents. Could I show you a 20-minute demo this week?", "timestamp": 13400},
    {"role": "user", "content": "That sounds interesting, yeah let's do it.", "timestamp": 18700},
    {"role": "assistant", "content": "Perfect! I'll send a calendar invite. Thanks for your time, take care!", "timestamp": 22000},
]

COLD_TRANSCRIPT = [
    {"role": "assistant", "content": "Hi, this is Mike from VoiceDesk, got a sec?", "timestamp": 0},
    {"role": "user", "content": "Not really, I'm in the middle of something.", "timestamp": 2500},
    {"role": "assistant", "content": "No problem — is there a better time to reach you?", "timestamp": 5000},
    {"role": "user", "content": "Honestly we're not looking for anything right now.", "timestamp": 8200},
    {"role": "assistant", "content": "Understood, I'll leave you to it. Have a good day!", "timestamp": 11000},
]


async def seed_if_empty():
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(func.count(Agent.id)))).scalar()
        if existing and existing > 0:
            return

        # --- Agents ---
        agent_objs = []
        for a in AGENTS:
            agent = Agent(
                name=a["name"],
                description=a["description"],
                first_message=a["first_message"],
                system_prompt=a["system_prompt"],
                voice_name=a["voice_name"],
                voice_id=VOICES[a["voice_name"]],
                status="active",
            )
            db.add(agent)
            agent_objs.append(agent)
        await db.flush()

        # --- Contacts ---
        contacts = []
        for i in range(20):
            fn = FIRST_NAMES[i % len(FIRST_NAMES)]
            ln = LAST_NAMES[i % len(LAST_NAMES)]
            uk = i % 2 == 0
            phone = (
                f"+44 7{random.randint(100, 999)} {random.randint(100000, 999999)}"
                if uk
                else f"+1 ({random.randint(200, 999)}) {random.randint(200, 999)}-{random.randint(1000, 9999)}"
            )
            contact = Contact(
                name=f"{fn} {ln}",
                phone=phone,
                email=f"{fn.lower()}.{ln.lower()}@{COMPANIES[i].split()[0].lower()}.com",
                company=COMPANIES[i],
                status=random.choice(["new", "new", "contacted", "qualified", "booked"]),
                tags=random.choice([["enterprise"], ["smb"], ["inbound"], ["warm-lead"], []]),
            )
            db.add(contact)
            contacts.append(contact)
        await db.flush()

        # --- Historical calls ---
        now = datetime.utcnow()
        statuses_done = ["completed", "completed", "completed", "completed", "no-answer", "failed"]
        for i in range(15):
            agent = random.choice(agent_objs)
            contact = random.choice(contacts)
            created = now - timedelta(days=random.randint(0, 6), hours=random.randint(0, 22))

            if i < 3:
                # In-progress live calls for the dashboard feed.
                call = Call(
                    agent_id=agent.id,
                    contact_id=contact.id,
                    direction="outbound",
                    status="in-progress",
                    phone_number=contact.phone,
                    started_at=now - timedelta(seconds=random.randint(20, 180)),
                    created_at=now - timedelta(seconds=random.randint(20, 180)),
                    transcript=SAMPLE_TRANSCRIPT[: random.randint(2, 5)],
                )
                db.add(call)
                continue

            status = random.choice(statuses_done)
            answered = status == "completed"
            interest = random.choice(["hot", "warm", "warm", "cold"]) if answered else None
            duration = random.randint(45, 280) if answered else 0
            transcript = (SAMPLE_TRANSCRIPT if interest in ("hot", "warm") else COLD_TRANSCRIPT) if answered else []
            analysis = (
                {
                    "prospect_name": contact.name,
                    "interest_level": interest,
                    "objections": [] if interest == "hot" else ["timing", "budget"],
                    "next_steps": "Send demo invite" if interest == "hot" else "Follow up next quarter",
                    "sentiment": "positive" if interest == "hot" else "neutral" if interest == "warm" else "negative",
                    "intent": "book_demo" if interest == "hot" else "needs_followup" if interest == "warm" else "not_interested",
                    "lead_score": 85 if interest == "hot" else 55 if interest == "warm" else 22,
                    "next_action": "Send calendar invite and prep a tailored demo." if interest == "hot" else "Schedule a follow-up call within 3 business days.",
                }
                if answered
                else None
            )
            call = Call(
                agent_id=agent.id,
                contact_id=contact.id,
                direction=random.choice(["outbound", "outbound", "inbound"]),
                status=status,
                phone_number=contact.phone,
                duration_seconds=duration,
                cost_usd=round(duration / 60 * 0.09, 3) if answered else 0.0,
                transcript=transcript,
                summary="Prospect agreed to a demo and was engaged throughout." if interest == "hot"
                else "Prospect was mildly interested; needs follow-up." if interest == "warm"
                else "Prospect declined; not a fit right now." if answered else None,
                analysis=analysis,
                interest_level=interest,
                success=bool(interest == "hot"),
                started_at=created,
                ended_at=created + timedelta(seconds=duration) if answered else None,
                created_at=created,
            )
            db.add(call)

        # Update agent rollup stats.
        await db.flush()
        for agent in agent_objs:
            agent_calls = (
                await db.execute(select(Call).where(Call.agent_id == agent.id))
            ).scalars().all()
            completed = [c for c in agent_calls if c.status == "completed"]
            successes = [c for c in completed if c.success]
            agent.calls_count = len(agent_calls)
            agent.success_rate = round(len(successes) / len(completed) * 100, 1) if completed else 0.0

        await db.commit()
        print("[seed] Seeded 3 agents, 20 contacts, 15 calls (3 live).")
