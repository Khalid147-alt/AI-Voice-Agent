"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { Waveform } from "@/components/shared/Waveform";
import { formatDuration } from "@/lib/utils";
import { useToast } from "@/components/shared/Toast";
import type { Agent, TranscriptEntry } from "@/types";

type CallState = "idle" | "connecting" | "active" | "ending";

export function WebCallWidget({
  agent,
  publicKey,
}: {
  agent: Agent;
  publicKey: string;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<CallState>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [volume, setVolume] = useState(0.5);
  const [elapsed, setElapsed] = useState(0);

  const vapiRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    setVolume(0.5);
  };

  // ----- Real VAPI web call -----
  const runVapiCall = async () => {
    if (!publicKey) {
      toast("No VAPI public key configured.", "error");
      return;
    }
    if (!agent.vapi_assistant_id) {
      toast("This agent isn't synced to VAPI yet. Save the agent and retry.", "error");
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

      await vapi.start(agent.vapi_assistant_id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to start call", "error");
      setState("idle");
      cleanup();
    }
  };

  const startCall = () => {
    runVapiCall();
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
    cleanup();
    setTimeout(() => setState("idle"), 400);
  };

  useEffect(() => {
    return () => {
      cleanup();
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

        <p className="mt-3 text-xs text-text-secondary">
          Live call via VAPI using your microphone.
        </p>
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
