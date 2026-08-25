import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import dayjs from "dayjs";
import { Mail, MessageSquare, PhoneCall, Bell } from "lucide-react";

const CHANNEL_META = {
  EMAIL: { icon: Mail, color: "#C25E4B", bg: "bg-orange-50" },
  SMS: { icon: MessageSquare, color: "#D89A5E", bg: "bg-amber-50" },
  VOICE_CALL: { icon: PhoneCall, color: "#4A6E53", bg: "bg-green-50" },
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/notifications").then((r) => setNotifs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto fade-in-up">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#63635E]">Multi-channel engine</p>
      <h1 className="font-heading text-4xl font-light tracking-tight mt-1 mb-8">Notification log</h1>
      {loading && <p className="text-[#63635E] text-sm">Loading…</p>}
      {!loading && notifs.length === 0 && (
        <div className="bg-white border border-[rgba(26,26,24,0.09)] rounded-xl p-10 text-center shadow-sm">
          <Bell size={24} strokeWidth={1.5} className="mx-auto text-[#63635E] mb-3" />
          <p className="text-sm text-[#63635E]">No notifications yet. Create an event and alerts will appear here based on your preferences.</p>
        </div>
      )}
      <div className="space-y-3" data-testid="notifications-list">
        {notifs.map((n) => {
          const meta = CHANNEL_META[n.channel] || CHANNEL_META.EMAIL;
          const Icon = meta.icon;
          return (
            <div key={n.id} className="bg-white border border-[rgba(26,26,24,0.09)] rounded-xl p-4 shadow-sm flex items-start gap-4" data-testid={`notification-${n.id}`}>
              <div className={`w-9 h-9 rounded-full ${meta.bg} flex items-center justify-center shrink-0`}>
                <Icon size={16} strokeWidth={1.5} style={{ color: meta.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{n.event_title}</p>
                  <span className="font-mono text-[10px] text-[#63635E] shrink-0">{dayjs(n.created_at).format("MMM D, h:mm A")}</span>
                </div>
                <p className="text-xs text-[#63635E] mt-0.5">{n.detail}</p>
                <div className="flex gap-2 mt-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{n.channel}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{n.trigger}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
