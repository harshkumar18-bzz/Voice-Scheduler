import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, CalendarDays, Mic, Settings, Bell, LogOut, CalendarClock } from "lucide-react";

const ROLE_COLORS = {
  ADMIN: "bg-[#4A5A6E] text-white",
  MANAGER: "bg-[#D89A5E] text-white",
  USER: "bg-[#4A6E53] text-white",
};

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, testid: "nav-calendar" },
  { to: "/voice", label: "Voice Scheduling", icon: Mic, testid: "nav-voice" },
  { to: "/notifications", label: "Notifications", icon: Bell, testid: "nav-notifications" },
  { to: "/preferences", label: "Preferences", icon: Settings, testid: "nav-preferences" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-[#F6F5F2]">
      <aside className="w-60 shrink-0 border-r border-[rgba(26,26,24,0.09)] bg-white flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-6 flex items-center gap-2 border-b border-[rgba(26,26,24,0.09)]">
          <CalendarClock className="text-[#C25E4B]" size={22} strokeWidth={1.5} />
          <span className="font-heading font-bold text-lg tracking-tight">Chronos</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-[#C25E4B] text-white" : "text-[#63635E] hover:bg-[#F0EFEA] hover:text-[#1A1A18]"
                }`
              }
            >
              <Icon size={17} strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-[rgba(26,26,24,0.09)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#F0EFEA] flex items-center justify-center font-heading font-bold text-sm text-[#C25E4B]">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" data-testid="sidebar-user-name">{user?.name}</p>
              <span className={`text-[10px] font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 rounded ${ROLE_COLORS[user?.role]}`} data-testid="sidebar-user-role">
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-button"
            className="flex items-center gap-2 text-sm text-[#63635E] hover:text-[#C25E4B] transition-colors w-full"
          >
            <LogOut size={15} strokeWidth={1.5} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 px-6 lg:px-10 py-8">{children}</main>
    </div>
  );
}
