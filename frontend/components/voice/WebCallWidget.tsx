"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { Waveform } from "@/components/shared/Waveform";
import { formatDuration } from "@/lib/utils";
import { useToast } from "@/components/shared/Toast";
import type { Agent, TranscriptEntry } from "@/types";

type CallState = "idle" | "connecting" | "active" | "ending";

// Scripted demo exchange used when no VAPI key is configured.
const DEMO_SCRIPT: { role: string; content: string }[] = [
  { role: "assistant", content: "Hi! This is your AI agent. Thanks for taking my call — do you have a quick minute?" },
  { role: "user", content: "Sure, what's this about?" },
  { role: "assistant", content: "We help teams automate outbound calls with AI. Are you handling outreach manually right now?" },
  { role: "user", content: "Yeah, it's pretty time-consuming." },
  { role: "assistant", content: "I completely understand. I'd love to show you a quick demo — could I book 20 minutes this week?" },
  { role: "user", content: "That sounds good, let's do it." },
  { role: "assistant", content: "Perfect, I'll send over a calendar invite. Thanks so much — take care!" },
];

export function WebCallWidget({
  agent,
  demoMode,
  publicKey,
}: {
  agent: Agent;
  demoMode: boolean;
  publicKey: string;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<CallState>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [volume, setVolume] = useState(0.5);
  const [elapsed, setElapsed] = useState(0);

  const vapiRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const cleanup = () => {
    stopTimer();
    demoTimers.current.forEach(clearTimeout);
    demoTimers.current = [];
    setVolume(0.5);
  };

  // ----- Demo mode (Web Speech API + scripted transcript) -----
  const runDemoCall = () => {
    setState("connecting");
    setTranscript([]);
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

    const connectT = setTimeout(() => {
      setState("active");
      startTimer();
      let delay = 0;
      DEMO_SCRIPT.forEach((line) => {
        const t = setTimeout(() => {
          setTranscript((prev) => [
            ...prev,
            { role: line.role, content: line.content },
          ]);
          // Animate volume + speak assistant lines.
          if (line.role === "assistant" && synth) {
            try {
              const u = new SpeechSynthesisUtterance(line.content);
              u.rate = 1.05;
              u.pitch = 1;
              u.onboundary = () => setVolume(0.4 + Math.random() * 0.6);
              u.onend = () => setVolume(0.3);
              synth.speak(u);
            } catch {
              /* ignore */
            }
          }
          setVolume(0.4 + Math.random() * 0.5);
        }, delay);
        demoTimers.current.push(t);
        delay += line.content.length * 55 + 900;
      });
      // End call after the script.
      const endT = setTimeout(() => endCall(), delay + 600);
      demoTimers.current.push(endT);
    }, 1200);
    demoTimers.current.push(connectT);
  };

  // ----- Real VAPI web call -----
  const runVapiCall = async () => {
    if (!publicKey) {
      toast("No VAPI public key configured.", "error");
      return;
    }
    try {
      setState("connecting");
      setTranscript([]);
      const VapiModule = await import("@vapi-ai/web");
      const Vapi = VapiModule.default;
      const vapi = new Vapi(publicKey);
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        setState("active");
        startTimer();
      });
      vapi.on("call-end", () => {
        setState("idle");
        cleanup();
      });
      vapi.on("volume-level", (v: number) => setVolume(Math.min(1, v * 2)));
      vapi.on("message", (msg: any) => {
        if (msg.type === "transcript" && msg.transcriptType === "final") {
          setTranscript((prev) => [
            ...prev,
            { role: msg.role, content: msg.transcript },
          ]);
        }
      });
      vapi.on("error", (e: any) => {
        toast("Call error: " + (e?.message || "unknown"), "error");
        setState("idle");
        cleanup();
      });

      await vapi.start(agent.vapi_assistant_id || undefined);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to start call", "error");
      setState("idle");
      cleanup();
    }
  };

  const startCall = () => {
    if (demoMode) runDemoCall();
    else runVapiCall();
  };

  const endCall = () => {
    setState("ending");
    if (vapiRef.current) {
      try {
        vapiRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    cleanup();
    setTimeout(() => setState("idle"), 400);
  };

  useEffect(() => {
    return () => {
      cleanup();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      if (vapiRef.current) {
        try {
          vapiRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = state === "active";

  return (
    <div className="card p-6">
      <div className="flex flex-col items-center text-center">
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-full transition-colors ${
            active ? "bg-accent/20" : "bg-surface-elevated"
          }`}
        >
          {state === "connecting" ? (
            <Loader2 className="h-8 w-8 text-accent animate-spin" />
          ) : active ? (
            <Waveform active level={volume} bars={7} className="h-12" />
          ) : (
            <Phone className="h-8 w-8 text-text-secondary" />
          )}
        </div>

        <p className="mt-4 text-sm text-text-secondary">
          {state === "idle" && "Ready to call"}
          {state === "connecting" && "Connecting…"}
          {active && "Call in progress"}
          {state === "ending" && "Ending call…"}
        </p>
        {active && (
          <p className="font-mono text-2xl font-semibold tabular-nums mt-1">
            {formatDuration(elapsed)}
          </p>
        )}

        <div className="mt-5">
          {state === "idle" || state === "ending" ? (
            <button
              onClick={startCall}
              disabled={state === "ending"}
              className="btn-primary flex items-center gap-2 px-6 py-3"
            >
              <Phone className="h-4 w-4" /> Start Test Call
            </button>
          ) : (
            <button
              onClick={endCall}
              className="bg-danger hover:bg-danger/90 text-white font-medium px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
            >
              <PhoneOff className="h-4 w-4" /> End Call
            </button>
          )}
        </div>

        {demoMode && (
          <p className="mt-3 text-xs text-warning">
            Demo mode: simulated call using your browser&apos;s speech engine.
          </p>
        )}
      </div>

      {transcript.length > 0 && (
        <div
          ref={scrollRef}
          className="mt-6 max-h-64 overflow-y-auto space-y-3 border-t border-border pt-4"
        >
          {transcript.map((t, i) => (
            <div
              key={i}
              className={`flex ${
                t.role === "assistant" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm font-mono ${
                  t.role === "assistant"
                    ? "bg-accent/15 text-text-primary rounded-br-sm"
                    : "bg-surface-elevated text-text-secondary rounded-bl-sm"
                }`}
              >
                {t.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
