import { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Mic } from "lucide-react";

function EventModal({ date, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: "", description: "", location: "",
    date: date.format("YYYY-MM-DD"), start: "09:00", end: "09:30", attendees: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/events", {
        title: form.title, description: form.description, location: form.location,
        start_time: `${form.date}T${form.start}:00`, end_time: `${form.date}T${form.end}:00`,
        attendees: form.attendees ? form.attendees.split(",").map((s) => s.trim()) : [],
      });
      toast.success("Event created — notifications dispatched");
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const inputCls = "w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:border-[#C25E4B] focus:ring-1 focus:ring-[#C25E4B] outline-none";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-slate-200 shadow-xl rounded-lg w-full max-w-md p-6 fade-in-up" onClick={(e) => e.stopPropagation()} data-testid="event-modal">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-heading text-xl font-medium">New event</h3>
          <button onClick={onClose} data-testid="event-modal-close" className="text-[#63635E] hover:text-[#1A1A18]"><X size={18} /></button>
        </div>
        <form onSubmit={save} className="space-y-3">
          <input data-testid="event-title-input" required placeholder="Title" value={form.title} onChange={set("title")} className={inputCls} />
          <input data-testid="event-date-input" required type="date" value={form.date} onChange={set("date")} className={inputCls} />
          <div className="flex gap-3">
            <input data-testid="event-start-input" required type="time" value={form.start} onChange={set("start")} className={inputCls} />
            <input data-testid="event-end-input" required type="time" value={form.end} onChange={set("end")} className={inputCls} />
          </div>
          <input data-testid="event-location-input" placeholder="Location (optional)" value={form.location} onChange={set("location")} className={inputCls} />
          <input data-testid="event-attendees-input" placeholder="Attendees, comma separated (optional)" value={form.attendees} onChange={set("attendees")} className={inputCls} />
          <textarea data-testid="event-description-input" placeholder="Description (optional)" rows={2} value={form.description} onChange={set("description")} className={inputCls} />
          <button data-testid="event-save-button" disabled={busy}
            className="w-full rounded-full bg-[#C25E4B] hover:bg-[#A64D3B] text-white py-2.5 text-sm font-semibold transition-colors disabled:opacity-60">
            {busy ? "Saving…" : "Create event"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(dayjs().startOf("month"));
  const [events, setEvents] = useState([]);
  const [modalDate, setModalDate] = useState(null);
  const [scope, setScope] = useState("mine");
  const canSeeTeam = user.role === "MANAGER" || user.role === "ADMIN";

  const load = useCallback(() => {
    const path = scope === "team" && canSeeTeam ? "/team/events" : "/events";
    api.get(path).then((r) => setEvents(r.data)).catch(() => {});
  }, [scope, canSeeTeam]);
  useEffect(load, [load]);

  const removeEvent = async (id) => {
    try {
      await api.delete(`/events/${id}`);
      toast.success("Event deleted");
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const firstDay = month.startOf("month").day();
  const daysInMonth = month.daysInMonth();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(month.date(d));

  const eventsOn = (day) => events.filter((e) => dayjs(e.start_time).isSame(day, "day"));

  return (
    <div className="max-w-7xl mx-auto fade-in-up">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#63635E]">Interactive calendar</p>
          <h1 className="font-heading text-4xl font-light tracking-tight mt-1" data-testid="calendar-month-label">{month.format("MMMM YYYY")}</h1>
        </div>
        <div className="flex items-center gap-3">
          {canSeeTeam && (
            <div className="flex rounded-full border border-slate-300 overflow-hidden text-xs font-semibold">
              <button data-testid="calendar-scope-mine" onClick={() => setScope("mine")} className={`px-4 py-2 ${scope === "mine" ? "bg-[#1A1A18] text-white" : "bg-white text-[#63635E]"}`}>My events</button>
              <button data-testid="calendar-scope-team" onClick={() => setScope("team")} className={`px-4 py-2 ${scope === "team" ? "bg-[#1A1A18] text-white" : "bg-white text-[#63635E]"}`}>All / Team</button>
            </div>
          )}
          <button data-testid="calendar-prev-month" onClick={() => setMonth(month.subtract(1, "month"))} className="p-2 rounded-full border border-slate-300 bg-white hover:bg-[#F0EFEA]"><ChevronLeft size={16} /></button>
          <button data-testid="calendar-next-month" onClick={() => setMonth(month.add(1, "month"))} className="p-2 rounded-full border border-slate-300 bg-white hover:bg-[#F0EFEA]"><ChevronRight size={16} /></button>
          <button data-testid="calendar-new-event-button" onClick={() => setModalDate(dayjs())}
            className="flex items-center gap-2 rounded-full bg-[#C25E4B] hover:bg-[#A64D3B] text-white px-5 py-2 text-sm font-semibold transition-colors">
            <Plus size={15} /> New event
          </button>
        </div>
      </div>

      <div className="bg-white border border-[rgba(26,26,24,0.09)] rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[rgba(26,26,24,0.09)]">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
            <div key={d} className="px-3 py-3 font-mono text-[11px] text-[#63635E] uppercase tracking-widest">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => (
            <div key={i}
              data-testid={day ? `calendar-day-${day.format("YYYY-MM-DD")}` : undefined}
              onClick={() => day && setModalDate(day)}
              className={`min-h-[110px] border-b border-r border-[rgba(26,26,24,0.06)] p-1.5 ${day ? "cursor-pointer hover:bg-[#F6F5F2] transition-colors" : "bg-[#FAFAF8]"}`}>
              {day && (
                <>
                  <span className={`inline-flex w-6 h-6 items-center justify-center text-xs rounded-full ${day.isSame(dayjs(), "day") ? "bg-[#C25E4B] text-white font-bold" : "text-[#63635E]"}`}>
                    {day.date()}
                  </span>
                  <div className="mt-1 space-y-0.5 mx-0.5">
                    {eventsOn(day).slice(0, 3).map((e) => (
                      <div key={e.id} data-testid={`event-pill-${e.id}`}
                        onClick={(ev) => ev.stopPropagation()}
                        className="group flex items-center justify-between rounded-sm px-2 py-1 text-xs font-medium truncate bg-orange-100 text-orange-800 border-l-2 border-orange-500">
                        <span className="truncate flex items-center gap-1">
                          {e.created_via === "voice" && <Mic size={9} className="shrink-0 text-[#4A6E53]" />}
                          {dayjs(e.start_time).format("h:mma")} {e.title}
                        </span>
                        {(e.user_id === user.id || user.role === "ADMIN") && (
                          <button onClick={() => removeEvent(e.id)} data-testid={`delete-event-${e.id}`}
                            className="opacity-0 group-hover:opacity-100 text-orange-700 hover:text-red-600 shrink-0 ml-1">
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                    {eventsOn(day).length > 3 && <p className="text-[10px] text-[#63635E] px-2">+{eventsOn(day).length - 3} more</p>}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {modalDate && <EventModal date={modalDate} onClose={() => setModalDate(null)} onSaved={() => { setModalDate(null); load(); }} />}
    </div>
  );
}
