import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Mail, MessageSquare, PhoneCall, CalendarRange } from "lucide-react";

function Toggle({ checked, onChange, testid }) {
  return (
    <button data-testid={testid} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-[#C25E4B]" : "bg-slate-300"}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

const CHANNELS = [
  { key: "email_enabled", icon: Mail, title: "Email reminders", desc: "Sent to your account email (simulated JavaMailSender)", testid: "pref-email-toggle" },
  { key: "sms_enabled", icon: MessageSquare, title: "SMS reminders", desc: "Text message via Twilio (simulated until keys added)", testid: "pref-sms-toggle" },
  { key: "voice_call_enabled", icon: PhoneCall, title: "Voice call reminders", desc: "Automated call via Twilio Voice (simulated until keys added)", testid: "pref-voice-toggle" },
];

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState(null);
  const [google, setGoogle] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/preferences").then((r) => setPrefs(r.data)).catch(() => {});
    api.get("/calendar/google/status").then((r) => setGoogle(r.data)).catch(() => {});
  }, []);

  const save = async (next) => {
    setPrefs(next);
    setBusy(true);
    try {
      const { user_id, ...body } = next;
      await api.put("/preferences", body);
      toast.success("Preferences saved");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  if (!prefs) return <p className="text-[#63635E]">Loading…</p>;

  return (
    <div className="max-w-2xl mx-auto fade-in-up">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#63635E]">Preferences</p>
      <h1 className="font-heading text-4xl font-light tracking-tight mt-1 mb-8">Notification settings</h1>

      <div className="bg-white border border-[rgba(26,26,24,0.09)] rounded-xl shadow-sm px-6" data-testid="preferences-panel">
        {CHANNELS.map(({ key, icon: Icon, title, desc, testid }) => (
          <div key={key} className="flex items-center justify-between py-4 border-b border-[rgba(26,26,24,0.07)] last:border-0">
            <div className="flex items-start gap-3">
              <Icon size={18} strokeWidth={1.5} className="text-[#C25E4B] mt-0.5" />
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-[#63635E]">{desc}</p>
              </div>
            </div>
            <Toggle checked={prefs[key]} onChange={(v) => save({ ...prefs, [key]: v })} testid={testid} />
          </div>
        ))}
      </div>

      <div className="bg-white border border-[rgba(26,26,24,0.09)] rounded-xl shadow-sm p-6 mt-6 space-y-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-[0.15em] text-[#63635E]">Phone number (for SMS & voice)</label>
          <input data-testid="pref-phone-input" value={prefs.phone_number}
            onChange={(e) => setPrefs({ ...prefs, phone_number: e.target.value })}
            onBlur={() => save(prefs)}
            placeholder="+1 555 000 0000"
            className="mt-2 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:border-[#C25E4B] focus:ring-1 focus:ring-[#C25E4B] outline-none" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-[0.15em] text-[#63635E]">Remind me before (minutes)</label>
          <select data-testid="pref-reminder-select" value={prefs.reminder_minutes_before}
            onChange={(e) => save({ ...prefs, reminder_minutes_before: parseInt(e.target.value) })}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#C25E4B] outline-none">
            {[5, 10, 15, 30, 60, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-[rgba(26,26,24,0.09)] rounded-xl shadow-sm p-6 mt-6" data-testid="google-calendar-card">
        <div className="flex items-start gap-3">
          <CalendarRange size={18} strokeWidth={1.5} className="text-[#4A5A6E] mt-0.5" />
          <div>
            <p className="text-sm font-medium">Google Calendar sync</p>
            <p className="text-xs text-[#63635E] mt-1">{google?.message || "Checking status…"}</p>
            <span className={`inline-block mt-2 text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded ${google?.connected ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
              {google?.connected ? "Connected" : "Not connected — awaiting credentials"}
            </span>
          </div>
        </div>
      </div>
      {busy && <p className="text-xs text-[#63635E] mt-3">Saving…</p>}
    </div>
  );
}
