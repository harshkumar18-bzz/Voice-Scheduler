import { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import dayjs from "dayjs";
import { Users, CalendarDays, Bell, Mic, Trash2, Clock } from "lucide-react";

function StatCard({ icon: Icon, label, value, color, testid }) {
  return (
    <div data-testid={testid} className="bg-white border border-[rgba(26,26,24,0.09)] rounded-xl p-6 shadow-sm hover:-translate-y-0.5 transition-transform">
      <Icon size={18} strokeWidth={1.5} style={{ color }} />
      <p className="font-heading text-3xl mt-3">{value}</p>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#63635E] mt-1">{label}</p>
    </div>
  );
}

function UpcomingList({ events, testid }) {
  const upcoming = events.filter((e) => dayjs(e.start_time).isAfter(dayjs())).slice(0, 6);
  return (
    <div data-testid={testid} className="bg-white border border-[rgba(26,26,24,0.09)] rounded-xl p-6 shadow-sm">
      <h3 className="font-heading text-lg font-medium mb-4">Upcoming meetings</h3>
      {upcoming.length === 0 && <p className="text-sm text-[#63635E]">Nothing scheduled ahead. Enjoy the calm.</p>}
      <div className="space-y-3">
        {upcoming.map((e) => (
          <div key={e.id} className="flex items-start gap-3 pb-3 border-b border-[rgba(26,26,24,0.06)] last:border-0">
            <div className="w-10 text-center shrink-0">
              <p className="font-mono text-[11px] text-[#63635E] uppercase">{dayjs(e.start_time).format("MMM")}</p>
              <p className="font-heading text-xl leading-none">{dayjs(e.start_time).format("D")}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{e.title}</p>
              <p className="text-xs text-[#63635E] flex items-center gap-1">
                <Clock size={11} strokeWidth={1.5} /> {dayjs(e.start_time).format("h:mm A")} – {dayjs(e.end_time).format("h:mm A")}
                {e.created_via === "voice" && <span className="ml-1 text-[#4A6E53] flex items-center gap-0.5"><Mic size={10} /> voice</span>}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const { user: me } = useAuth();

  const load = useCallback(() => {
    api.get("/admin/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/admin/users").then((r) => setUsers(r.data)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const changeRole = async (id, role) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role });
      toast.success("Role updated");
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const removeUser = async (id) => {
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success("User deleted");
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Users} label="Total users" value={stats?.total_users ?? "—"} color="#4A5A6E" testid="stat-total-users" />
        <StatCard icon={CalendarDays} label="Total events" value={stats?.total_events ?? "—"} color="#C25E4B" testid="stat-total-events" />
        <StatCard icon={Bell} label="Notifications" value={stats?.total_notifications ?? "—"} color="#D89A5E" testid="stat-total-notifications" />
        <StatCard icon={Mic} label="Voice scheduled" value={stats?.voice_scheduled_events ?? "—"} color="#4A6E53" testid="stat-voice-events" />
      </div>
      <div className="lg:col-span-4 bg-white border border-[rgba(26,26,24,0.09)] rounded-xl p-6 shadow-sm" data-testid="admin-user-table">
        <h3 className="font-heading text-lg font-medium mb-4">User management</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-[0.15em] text-[#63635E] border-b border-[rgba(26,26,24,0.09)]">
              <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Email</th><th className="py-2 pr-4">Role</th><th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[rgba(26,26,24,0.05)] last:border-0" data-testid={`admin-user-row-${u.email}`}>
                <td className="py-3 pr-4 font-medium">{u.name}</td>
                <td className="py-3 pr-4 text-[#63635E]">{u.email}</td>
                <td className="py-3 pr-4">
                  <select value={u.role} disabled={u.id === me.id} onChange={(e) => changeRole(u.id, e.target.value)}
                    data-testid={`role-select-${u.email}`}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-[#C25E4B] outline-none disabled:opacity-50">
                    <option>ADMIN</option><option>MANAGER</option><option>USER</option>
                  </select>
                </td>
                <td className="py-3">
                  <button disabled={u.id === me.id} onClick={() => removeUser(u.id)} data-testid={`delete-user-${u.email}`}
                    className="text-[#63635E] hover:text-red-600 transition-colors disabled:opacity-30">
                    <Trash2 size={15} strokeWidth={1.5} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ManagerPanel() {
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  useEffect(() => {
    api.get("/team/members").then((r) => setMembers(r.data)).catch(() => {});
    api.get("/team/events").then((r) => setEvents(r.data)).catch(() => {});
  }, []);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <UpcomingList events={events} testid="manager-team-events" />
      </div>
      <div className="bg-white border border-[rgba(26,26,24,0.09)] rounded-xl p-6 shadow-sm" data-testid="manager-team-members">
        <h3 className="font-heading text-lg font-medium mb-4">Team members</h3>
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between pb-3 border-b border-[rgba(26,26,24,0.06)] last:border-0">
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-[#63635E]">{m.role}</p>
              </div>
              <span className="font-mono text-xs text-[#63635E]">{m.event_count} events</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UserPanel() {
  const [events, setEvents] = useState([]);
  const [notifs, setNotifs] = useState([]);
  useEffect(() => {
    api.get("/events").then((r) => setEvents(r.data)).catch(() => {});
    api.get("/notifications").then((r) => setNotifs(r.data)).catch(() => {});
  }, []);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <UpcomingList events={events} testid="user-upcoming-events" />
      </div>
      <div className="space-y-6">
        <StatCard icon={CalendarDays} label="My events" value={events.length} color="#C25E4B" testid="stat-my-events" />
        <StatCard icon={Bell} label="Alerts sent" value={notifs.length} color="#D89A5E" testid="stat-my-notifications" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  };
  return (
    <div className="max-w-7xl mx-auto fade-in-up" data-testid={`dashboard-${user.role.toLowerCase()}`}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#63635E]">{user.role} dashboard</p>
      <h1 className="font-heading text-4xl font-light tracking-tight mt-1 mb-8">{greeting()}, {user.name.split(" ")[0]}</h1>
      {user.role === "ADMIN" && <AdminPanel />}
      {user.role === "MANAGER" && <ManagerPanel />}
      {user.role === "USER" && <UserPanel />}
    </div>
  );
}
