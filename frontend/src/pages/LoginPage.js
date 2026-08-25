import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CalendarClock, Mic, Bell, Users } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login" ? { email: form.email, password: form.password } : form;
      const { data } = await api.post(path, payload);
      setUser(data);
      navigate("/");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen flex bg-[#F6F5F2]">
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-[#1A1A18] text-white p-12">
        <div className="flex items-center gap-2">
          <CalendarClock className="text-[#C25E4B]" size={26} strokeWidth={1.5} />
          <span className="font-heading font-bold text-xl">Chronos</span>
        </div>
        <div>
          <h1 className="font-heading text-5xl font-light leading-tight tracking-tight mb-6">
            Schedule smarter.<br />Speak it into<br /><span className="text-[#C25E4B]">existence.</span>
          </h1>
          <div className="space-y-4 text-sm text-white/70">
            <p className="flex items-center gap-3"><Mic size={16} strokeWidth={1.5} className="text-[#4A6E53]" /> Voice-activated scheduling with NLP parsing</p>
            <p className="flex items-center gap-3"><Bell size={16} strokeWidth={1.5} className="text-[#D89A5E]" /> Email, SMS & voice call reminders</p>
            <p className="flex items-center gap-3"><Users size={16} strokeWidth={1.5} className="text-[#4A5A6E]" /> Role-based dashboards for Admins, Managers & Users</p>
          </div>
        </div>
        <p className="text-xs text-white/40 font-mono uppercase tracking-widest">Scheduler & Calendar Management</p>
      </div>
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#C25E4B]/15 blur-3xl blob-drift" />
          <div className="absolute bottom-0 -left-28 w-80 h-80 rounded-full bg-[#4A6E53]/15 blur-3xl blob-drift-slow" />
          <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-[#D89A5E]/15 blur-3xl blob-drift-slower" />
          <div className="absolute inset-0 opacity-[0.5]"
            style={{ backgroundImage: "linear-gradient(rgba(26,26,24,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(26,26,24,0.045) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />

          <div className="hidden md:flex absolute top-14 right-10 items-center gap-3 bg-white/85 backdrop-blur-md border border-[rgba(26,26,24,0.09)] shadow-lg rounded-xl px-4 py-3 float-y">
            <span className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center"><Bell size={14} strokeWidth={1.5} className="text-[#C25E4B]" /></span>
            <span>
              <span className="block text-xs font-semibold text-[#1A1A18]">Email reminder sent</span>
              <span className="block text-[10px] text-[#63635E]">Design review · in 30 min</span>
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#4A6E53] notif-blink" />
          </div>

          <div className="hidden md:flex absolute bottom-24 right-16 items-center gap-3 bg-white/85 backdrop-blur-md border border-[rgba(26,26,24,0.09)] shadow-lg rounded-xl px-4 py-3 float-y-delay">
            <span className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center"><Mic size={14} strokeWidth={1.5} className="text-[#4A6E53]" /></span>
            <span>
              <span className="block text-xs font-semibold text-[#1A1A18]">Voice scheduled</span>
              <span className="block text-[10px] text-[#63635E]">"Meeting with John, 3pm"</span>
            </span>
          </div>

          <div className="hidden md:block absolute top-24 left-10 bg-white/85 backdrop-blur-md border border-[rgba(26,26,24,0.09)] shadow-lg rounded-xl px-4 py-3 float-y-slow">
            <span className="flex items-center gap-2 mb-2">
              <CalendarClock size={13} strokeWidth={1.5} className="text-[#C25E4B]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#63635E]">This week</span>
            </span>
            <span className="grid grid-cols-7 gap-1">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} className={`w-5 h-5 rounded text-[9px] flex items-center justify-center font-mono ${i === 2 ? "bg-[#C25E4B] text-white" : i === 4 ? "bg-[#4A6E53]/20 text-[#4A6E53]" : "bg-[#F0EFEA] text-[#63635E]"}`}>{d}</span>
              ))}
            </span>
          </div>

          <div className="hidden md:flex absolute bottom-14 left-16 items-center gap-3 bg-white/85 backdrop-blur-md border border-[rgba(26,26,24,0.09)] shadow-lg rounded-xl px-4 py-3 float-y">
            <span className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center"><Users size={14} strokeWidth={1.5} className="text-[#D89A5E]" /></span>
            <span>
              <span className="block text-xs font-semibold text-[#1A1A18]">SMS alert queued</span>
              <span className="block text-[10px] text-[#63635E]">Team standup · tomorrow 9:00</span>
            </span>
          </div>
        </div>
        <div className="relative z-10 w-full max-w-md fade-in-up bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-2xl p-8">
          <h2 className="font-heading text-3xl tracking-tight mb-1">{mode === "login" ? "Welcome back" : "Create account"}</h2>
          <p className="text-sm text-[#63635E] mb-8">{mode === "login" ? "Sign in to manage your schedule" : "New accounts start with the USER role"}</p>
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <input data-testid="register-name-input" required value={form.name} onChange={set("name")} placeholder="Full name"
                className="w-full rounded-md border border-slate-300 bg-transparent px-4 py-3 text-sm focus:border-[#C25E4B] focus:ring-1 focus:ring-[#C25E4B] outline-none" />
            )}
            <input data-testid="login-email-input" required type="email" value={form.email} onChange={set("email")} placeholder="Email address"
              className="w-full rounded-md border border-slate-300 bg-transparent px-4 py-3 text-sm focus:border-[#C25E4B] focus:ring-1 focus:ring-[#C25E4B] outline-none" />
            <input data-testid="login-password-input" required type="password" value={form.password} onChange={set("password")} placeholder="Password"
              className="w-full rounded-md border border-slate-300 bg-transparent px-4 py-3 text-sm focus:border-[#C25E4B] focus:ring-1 focus:ring-[#C25E4B] outline-none" />
            {error && <p data-testid="auth-error" className="text-sm text-red-600">{error}</p>}
            <button data-testid="login-submit-button" disabled={busy}
              className="w-full rounded-full bg-[#C25E4B] hover:bg-[#A64D3B] text-white py-3 text-sm font-semibold transition-colors disabled:opacity-60">
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <button data-testid="toggle-auth-mode" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="mt-6 text-sm text-[#63635E] hover:text-[#C25E4B] transition-colors">
            {mode === "login" ? "No account? Register →" : "Have an account? Sign in →"}
          </button>
          <div className="mt-8 p-4 rounded-xl bg-white border border-[rgba(26,26,24,0.09)] text-xs text-[#63635E] space-y-1">
            <p className="font-bold uppercase tracking-[0.2em] text-[10px]">Demo accounts</p>
            <p className="font-mono">admin@scheduler.com / Admin@123</p>
            <p className="font-mono">manager@scheduler.com / Manager@123</p>
            <p className="font-mono">user@scheduler.com / User@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
