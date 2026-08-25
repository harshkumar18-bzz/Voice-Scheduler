import { useEffect, useRef, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import dayjs from "dayjs";
import { Mic, MicOff, PhoneCall, Sparkles, CalendarCheck2 } from "lucide-react";

export default function VoicePage() {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [callResult, setCallResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef(null);
  const supportsSpeech = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => () => recognitionRef.current?.stop?.(), []);

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    if (!supportsSpeech) {
      toast.info("Speech recognition not supported in this browser — type your request below instead.");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let text = "";
      for (const res of e.results) text += res[0].transcript;
      setTranscript(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const parse = async () => {
    if (!transcript.trim()) return toast.error("Say or type something first");
    setBusy(true);
    setCallResult(null);
    try {
      const { data } = await api.post("/voice/parse", { transcript });
      setParsed(data);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const confirmSchedule = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/voice/schedule", { transcript });
      toast.success(`Scheduled: ${data.event.title}`);
      setParsed(null);
      setTranscript("");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const simulateCall = async () => {
    if (!transcript.trim()) return toast.error("Say or type something first");
    setBusy(true);
    setParsed(null);
    try {
      const { data } = await api.post("/voice/simulate-call", { transcript });
      setCallResult(data);
      if (data.event) toast.success("Twilio call simulated — event created");
      else toast.warning("Call simulated but no date/time detected");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto fade-in-up">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#63635E]">Voice-activated scheduling</p>
      <h1 className="font-heading text-4xl font-light tracking-tight mt-1 mb-2">Speak your schedule</h1>
      <p className="text-sm text-[#63635E] mb-8">Try: “Schedule a meeting with John tomorrow at 3pm for 45 minutes about the quarterly review”</p>

      <div className="backdrop-blur-2xl bg-white/70 border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-3xl p-8 mb-6">
        <div className="flex flex-col items-center gap-5">
          <button onClick={toggleMic} data-testid="voice-mic-toggle"
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors ${listening ? "bg-[#4A6E53] text-white voice-pulse" : "bg-[#1A1A18] text-white hover:bg-[#4A6E53]"}`}>
            {listening ? <Mic size={30} strokeWidth={1.5} /> : <MicOff size={30} strokeWidth={1.5} />}
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#63635E]" data-testid="voice-status">
            {listening ? "Listening… tap to stop" : "Tap to speak"}
          </p>
          <textarea
            data-testid="voice-transcript-input"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Live transcription appears here — or type your request…"
            rows={2}
            className="w-full rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-sm focus:border-[#4A6E53] focus:ring-1 focus:ring-[#4A6E53] outline-none"
          />
          <div className="flex flex-wrap gap-3">
            <button onClick={parse} disabled={busy} data-testid="voice-parse-button"
              className="flex items-center gap-2 rounded-full bg-[#C25E4B] hover:bg-[#A64D3B] text-white px-6 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60">
              <Sparkles size={15} /> Parse transcript
            </button>
            <button onClick={simulateCall} disabled={busy} data-testid="voice-simulate-call-button"
              className="flex items-center gap-2 rounded-full border border-[#4A6E53] text-[#4A6E53] hover:bg-[#4A6E53] hover:text-white px-6 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60">
              <PhoneCall size={15} /> Simulate Twilio call
            </button>
          </div>
        </div>
      </div>

      {parsed && (
        <div className="bg-white border border-[rgba(26,26,24,0.09)] rounded-xl p-6 shadow-sm mb-6" data-testid="voice-parsed-result">
          <h3 className="font-heading text-lg font-medium mb-4 flex items-center gap-2"><Sparkles size={16} className="text-[#C25E4B]" /> Parsed meeting details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#63635E]">Title</p><p className="mt-1 font-medium" data-testid="parsed-title">{parsed.title}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#63635E]">Confidence</p><p className="mt-1 font-mono">{Math.round(parsed.confidence * 100)}%</p></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#63635E]">Starts</p><p className="mt-1" data-testid="parsed-start">{parsed.start_time ? dayjs(parsed.start_time).format("ddd, MMM D · h:mm A") : "Not detected"}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#63635E]">Duration</p><p className="mt-1">{parsed.duration_minutes} minutes</p></div>
            {parsed.attendee && <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#63635E]">With</p><p className="mt-1">{parsed.attendee}</p></div>}
            {parsed.topic && <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#63635E]">Topic</p><p className="mt-1">{parsed.topic}</p></div>}
          </div>
          {parsed.start_time ? (
            <button onClick={confirmSchedule} disabled={busy} data-testid="voice-confirm-schedule-button"
              className="mt-5 flex items-center gap-2 rounded-full bg-[#4A6E53] hover:bg-[#3B5A43] text-white px-6 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60">
              <CalendarCheck2 size={15} /> Confirm & add to calendar
            </button>
          ) : (
            <p className="mt-4 text-sm text-red-600">No date/time detected — try including “tomorrow at 3pm” or similar.</p>
          )}
        </div>
      )}

      {callResult && (
        <div className="bg-[#1A1A18] text-white rounded-xl p-6 shadow-sm" data-testid="voice-call-log">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-medium flex items-center gap-2"><PhoneCall size={16} className="text-[#4A6E53]" /> Twilio Voice call flow (SIMULATED)</h3>
            <span className="font-mono text-[10px] text-white/50">{callResult.call_sid.slice(0, 14)}…</span>
          </div>
          <div className="space-y-3">
            {callResult.steps.map((s) => (
              <div key={s.step} className="flex gap-3 text-sm">
                <span className="font-mono text-xs text-[#4A6E53] shrink-0 w-5">{s.step}.</span>
                <div>
                  <p className="text-white/60 text-xs font-bold uppercase tracking-[0.15em]">{s.actor}</p>
                  <p className="text-white/90">{s.action}</p>
                </div>
              </div>
            ))}
          </div>
          {callResult.event && (
            <p className="mt-4 text-sm text-[#8FBF9B]" data-testid="call-event-created">✓ Calendar entry created: {callResult.event.title} — {dayjs(callResult.event.start_time).format("MMM D, h:mm A")}</p>
          )}
        </div>
      )}
    </div>
  );
}
