import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import CalendarPage from "@/pages/CalendarPage";
import VoicePage from "@/pages/VoicePage";
import PreferencesPage from "@/pages/PreferencesPage";
import NotificationsPage from "@/pages/NotificationsPage";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#63635E]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Protected><DashboardPage /></Protected>} />
            <Route path="/calendar" element={<Protected><CalendarPage /></Protected>} />
            <Route path="/voice" element={<Protected><VoicePage /></Protected>} />
            <Route path="/preferences" element={<Protected><PreferencesPage /></Protected>} />
            <Route path="/notifications" element={<Protected><NotificationsPage /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
