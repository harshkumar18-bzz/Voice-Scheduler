# PRD — Chronos: Scheduler & Calendar Management App

## Original Problem Statement
Comprehensive Scheduler & Calendar Management Application. Originally requested as Spring Boot + MySQL + React; user agreed to: (1) working FastAPI + React + MongoDB app, (2) complete Spring Boot + MySQL reference codebase as deliverable files. Features: OAuth2/JWT auth with RBAC (ADMIN/MANAGER/USER), calendar API integration, multi-channel notification engine (Email/SMS/Twilio Voice), voice-activated scheduling with NLP parsing, role-specific dashboards, interactive calendar UI, preferences panel, voice scheduling interface.

## User Choices
- JWT email/password auth with RBAC (Google OAuth creds were not actually provided)
- Google Calendar: user said they'd provide creds but didn't — internal calendar built, Google sync stub awaiting keys
- Twilio: no keys — SMS/Voice notifications SIMULATED; Twilio Voice call flow SIMULATED
- Modern UI ("Grounded Command Center" design: earthy terracotta/moss theme, Manrope + IBM Plex Sans)

## Architecture
- Backend: FastAPI (/app/backend/server.py), MongoDB (motor), JWT via httpOnly cookie + Bearer fallback, bcrypt
- Frontend: React 19, react-router 7, axios (withCredentials), dayjs, lucide-react, sonner, custom Tailwind calendar grid
- Voice NLP: dateparser (search_dates) + regex for attendee/topic/duration extraction
- Spring Boot reference code: /app/springboot-backend (pom.xml, application.properties, entities, security config w/ OAuth2+JWT, controllers, GoogleCalendarService, NotificationService w/ JavaMailSender+Twilio, VoiceSchedulingService w/ Natty, Twilio webhook TwiML) — NOT RUNNING, deliverable only

## Implemented (June 2026)
- Auth: register/login/logout/me, seeded ADMIN/MANAGER/USER accounts (see memory/test_credentials.md)
- RBAC: /api/admin/* ADMIN only; /api/team/* MANAGER+ADMIN; enforced backend + frontend routes
- Events CRUD + availability endpoint; calendar month grid UI with event modal, pills, delete, my/team scope toggle
- Notification engine: Email/SMS/Voice channels per user preference, SIMULATED, logged to notifications collection + Notifications page
- Preferences panel: channel toggles, phone, reminder minutes, Google Calendar status card (not connected)
- Voice scheduling: browser Web Speech API mic + textarea, /api/voice/parse, /api/voice/schedule, /api/voice/simulate-call (5-step simulated Twilio flow), call_logs collection
- Role dashboards: Admin (stats + user management: role change, delete), Manager (team members + team events), User (upcoming + stats)
- Login page: dynamic animated background w/ floating notification cards (visual edit, June 2026)

## Testing
- iteration_1.json: backend 21/21 pass, frontend 100% — no issues

## Backlog
- P0: Real Google Calendar sync (needs user's Google Client ID/Secret with Calendar scope)
- P1: Real Twilio SMS/Voice (needs Account SID/Auth Token/number); real SMTP email
- P1: Scheduled reminder job (send notification X min before event, currently only on-create triggers)
- P2: Event editing UI (backend PUT exists), week view, recurring events, conflict warnings on create
