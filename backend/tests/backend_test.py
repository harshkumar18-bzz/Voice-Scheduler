"""Backend regression tests for Scheduler & Calendar Management API."""
import os
import uuid
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@scheduler.com", "password": "Admin@123"}
MANAGER = {"email": "manager@scheduler.com", "password": "Manager@123"}
USER = {"email": "user@scheduler.com", "password": "User@123"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    return s, data


@pytest.fixture(scope="module")
def admin_session():
    s, d = _login(ADMIN)
    return s, d


@pytest.fixture(scope="module")
def manager_session():
    s, d = _login(MANAGER)
    return s, d


@pytest.fixture(scope="module")
def user_session():
    s, d = _login(USER)
    return s, d


# ---------- Auth ----------
class TestAuth:
    def test_login_admin(self):
        s, d = _login(ADMIN)
        assert d["role"] == "ADMIN"
        assert "access_token" in d and len(d["access_token"]) > 10

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@scheduler.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, user_session):
        s, _ = user_session
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == USER["email"]

    def test_register_and_login(self):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={"name": "T U", "email": email, "password": "Passw0rd!"})
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "USER"
        uid = r.json()["id"]
        # login
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "Passw0rd!"})
        assert r2.status_code == 200
        # cleanup: admin delete
        s, _ = _login(ADMIN)
        s.delete(f"{API}/admin/users/{uid}")


# ---------- RBAC ----------
class TestRBAC:
    def test_user_forbidden_admin(self, user_session):
        s, _ = user_session
        assert s.get(f"{API}/admin/users").status_code == 403
        assert s.get(f"{API}/admin/stats").status_code == 403
        assert s.get(f"{API}/team/events").status_code == 403

    def test_manager_forbidden_admin(self, manager_session):
        s, _ = manager_session
        assert s.get(f"{API}/admin/users").status_code == 403

    def test_manager_team_ok(self, manager_session):
        s, _ = manager_session
        r = s.get(f"{API}/team/events")
        assert r.status_code == 200
        r2 = s.get(f"{API}/team/members")
        assert r2.status_code == 200 and isinstance(r2.json(), list)

    def test_admin_stats(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{API}/admin/stats")
        assert r.status_code == 200
        d = r.json()
        assert "total_users" in d and "roles" in d

    def test_no_auth(self):
        assert requests.get(f"{API}/auth/me").status_code == 401


# ---------- Events ----------
class TestEvents:
    def test_create_get_delete(self, user_session):
        s, me = user_session
        start = (datetime.utcnow() + timedelta(days=1)).replace(microsecond=0).isoformat()
        end = (datetime.utcnow() + timedelta(days=1, hours=1)).replace(microsecond=0).isoformat()
        r = s.post(f"{API}/events", json={"title": "TEST_event", "description": "d",
                                          "start_time": start, "end_time": end})
        assert r.status_code == 200, r.text
        ev = r.json()
        assert ev["title"] == "TEST_event"
        eid = ev["id"]
        # GET
        lst = s.get(f"{API}/events").json()
        assert any(e["id"] == eid for e in lst)
        # availability
        date = start.split("T")[0]
        av = s.get(f"{API}/events/availability", params={"date": date})
        assert av.status_code == 200
        aj = av.json()
        assert aj["date"] == date
        assert len(aj["busy_slots"]) >= 1
        # delete
        d = s.delete(f"{API}/events/{eid}")
        assert d.status_code == 200
        assert not any(e["id"] == eid for e in s.get(f"{API}/events").json())


# ---------- Preferences & Notifications ----------
class TestPrefs:
    def test_get_update(self, user_session):
        s, _ = user_session
        r = s.get(f"{API}/preferences")
        assert r.status_code == 200
        payload = {"email_enabled": True, "sms_enabled": True, "voice_call_enabled": False,
                   "phone_number": "+15551234567", "reminder_minutes_before": 15,
                   "google_calendar_connected": False}
        u = s.put(f"{API}/preferences", json=payload)
        assert u.status_code == 200
        got = s.get(f"{API}/preferences").json()
        assert got["sms_enabled"] is True
        assert got["phone_number"] == "+15551234567"
        assert got["reminder_minutes_before"] == 15
        # reset
        s.put(f"{API}/preferences", json={"email_enabled": True, "sms_enabled": False,
                                          "voice_call_enabled": False, "phone_number": "",
                                          "reminder_minutes_before": 30, "google_calendar_connected": False})

    def test_notifications_on_event_create(self, user_session):
        s, _ = user_session
        # ensure email on
        s.put(f"{API}/preferences", json={"email_enabled": True, "sms_enabled": False,
                                          "voice_call_enabled": False, "phone_number": "",
                                          "reminder_minutes_before": 30, "google_calendar_connected": False})
        start = (datetime.utcnow() + timedelta(days=2)).replace(microsecond=0).isoformat()
        end = (datetime.utcnow() + timedelta(days=2, hours=1)).replace(microsecond=0).isoformat()
        ev = s.post(f"{API}/events", json={"title": "TEST_notif", "start_time": start, "end_time": end}).json()
        notifs = s.get(f"{API}/notifications").json()
        assert any(n["event_id"] == ev["id"] and n["channel"] == "EMAIL" for n in notifs)
        s.delete(f"{API}/events/{ev['id']}")

    def test_google_status(self, user_session):
        s, _ = user_session
        r = s.get(f"{API}/calendar/google/status")
        assert r.status_code == 200
        assert "connected" in r.json()


# ---------- Voice ----------
class TestVoice:
    TRANSCRIPT = "Schedule a meeting with John tomorrow at 3pm for 45 minutes about the quarterly review"

    def test_parse(self, user_session):
        s, _ = user_session
        r = s.post(f"{API}/voice/parse", json={"transcript": self.TRANSCRIPT})
        assert r.status_code == 200
        d = r.json()
        assert d["start_time"] is not None
        assert d["duration_minutes"] == 45
        assert "John" in (d["attendee"] or "")

    def test_parse_empty(self, user_session):
        s, _ = user_session
        r = s.post(f"{API}/voice/parse", json={"transcript": "   "})
        assert r.status_code == 400

    def test_schedule(self, user_session):
        s, _ = user_session
        r = s.post(f"{API}/voice/schedule", json={"transcript": self.TRANSCRIPT})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["event"]["created_via"] == "voice"
        s.delete(f"{API}/events/{d['event']['id']}")

    def test_schedule_no_date(self, user_session):
        s, _ = user_session
        r = s.post(f"{API}/voice/schedule", json={"transcript": "hello world"})
        assert r.status_code == 422

    def test_simulate_call(self, user_session):
        s, _ = user_session
        r = s.post(f"{API}/voice/simulate-call",
                   json={"transcript": self.TRANSCRIPT, "caller_phone": "+15550100"})
        assert r.status_code == 200
        d = r.json()
        assert d["simulated"] is True
        assert d["call_sid"].startswith("CA")
        assert len(d["steps"]) >= 4
        assert d["event"] is not None
        s.delete(f"{API}/events/{d['event']['id']}")

    def test_simulate_call_no_date(self, user_session):
        s, _ = user_session
        r = s.post(f"{API}/voice/simulate-call",
                   json={"transcript": "just some words"})
        assert r.status_code == 200
        d = r.json()
        assert d["event"] is None


# ---------- Admin ops ----------
class TestAdminOps:
    def test_role_update_and_delete(self, admin_session):
        s, _ = admin_session
        email = f"TEST_role_{uuid.uuid4().hex[:6]}@example.com"
        reg = requests.post(f"{API}/auth/register", json={"name": "R", "email": email, "password": "Passw0rd!"}).json()
        uid = reg["id"]
        # promote to MANAGER
        r = s.patch(f"{API}/admin/users/{uid}/role", json={"role": "MANAGER"})
        assert r.status_code == 200
        users = s.get(f"{API}/admin/users").json()
        assert next(u for u in users if u["id"] == uid)["role"] == "MANAGER"
        # invalid role
        assert s.patch(f"{API}/admin/users/{uid}/role", json={"role": "BOGUS"}).status_code == 400
        # delete
        assert s.delete(f"{API}/admin/users/{uid}").status_code == 200

    def test_cannot_delete_self(self, admin_session):
        s, me = admin_session
        r = s.delete(f"{API}/admin/users/{me['id']}")
        assert r.status_code == 400
