# Voice-Scheduler

Voice-Scheduler is a full-stack scheduling app with role-based access, calendar/event management, notifications, and voice-driven meeting creation.

> This repository contains two backend implementations:
> - **`backend/`**: FastAPI + MongoDB backend used by the current React frontend.
> - **`springboot-backend/`**: Spring Boot + MySQL reference backend.

## Main features

- Email/password auth with JWT + role-based access (**ADMIN / MANAGER / USER**)
- Calendar event CRUD, availability, and conflict checks
- Team/admin views and user management endpoints
- Notification preferences and notification logs (email/SMS/voice channels)
- Voice scheduling:
  - Parse natural-language transcript
  - Create events from transcript
  - Simulate Twilio voice call flow

## Architecture

| Component | Tech | Role |
|---|---|---|
| Frontend | JavaScript (React 19, CRACO, Tailwind) | UI for login, dashboard, calendar, voice scheduling, preferences, notifications |
| Primary backend | Python (FastAPI, Motor/MongoDB) | Active API used by frontend (`/api/*`) |
| Reference backend | Java (Spring Boot 3.3, JPA, Security) | Alternate/reference implementation with similar domain features |
| HTML | `frontend/public/index.html` | SPA entry template |
| CSS | `frontend/src/index.css`, `frontend/src/App.css` | Styling, Tailwind layers, animations |
| Shell | `.emergent/cron/*.sh` | Cron/webhook dispatch and reconciliation scripts for Emergent runtime |

## Project structure

```text
Voice-Scheduler/
├── README.md
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   ├── pytest.ini
│   └── tests/backend_test.py
├── frontend/
│   ├── package.json
│   ├── craco.config.js
│   ├── public/index.html
│   └── src/
└── springboot-backend/
    ├── pom.xml
    └── src/main/
```

## Prerequisites

Based on repository configuration/files:

- **Node.js + package manager** for `frontend/` (`package.json` is present; package manager field specifies `yarn@1.22.22`)
- **Python** for `backend/` (version is not pinned in repository)
- **MongoDB** (required by `MONGO_URL` / `DB_NAME` in `backend/server.py`)
- **Java 17** + **Maven** for `springboot-backend/` (`pom.xml` sets `<java.version>17</java.version>`)
- **MySQL 8** for Spring backend (documented in `springboot-backend/README.md`)

## Setup

### 1) FastAPI backend (primary)

```bash
cd /home/runner/work/Voice-Scheduler/Voice-Scheduler/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=voice_scheduler
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGINS=http://localhost:3000
```

Run backend:

```bash
cd /home/runner/work/Voice-Scheduler/Voice-Scheduler/backend
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### 2) React frontend

```bash
cd /home/runner/work/Voice-Scheduler/Voice-Scheduler/frontend
yarn install
```

Create `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

Run frontend:

```bash
cd /home/runner/work/Voice-Scheduler/Voice-Scheduler/frontend
yarn start
```

Open: `http://localhost:3000`

## Development and production commands

### Frontend (`frontend/package.json`)

```bash
yarn start      # dev server
yarn build      # production build
yarn test       # tests via craco
```

### Python backend (`backend/`)

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload   # dev
uvicorn server:app --host 0.0.0.0 --port 8000            # production-style
```

### Spring backend (`springboot-backend/`)

```bash
mvn spring-boot:run
mvn test
mvn package
```

## Voice scheduling workflow

Example transcript:

```text
Schedule a meeting with John tomorrow at 3pm for 45 minutes about the quarterly review
```

Typical flow in the current app:
1. Go to **Voice** page in frontend.
2. Speak/type transcript.
3. `POST /api/voice/parse` to preview parsed details.
4. `POST /api/voice/schedule` to create the event.
5. Optional: `POST /api/voice/simulate-call` to view simulated Twilio voice flow.

## Key API surfaces

### FastAPI backend (`backend/server.py`)

- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- Events: `/api/events`, `/api/events/{event_id}`, `/api/events/conflicts`, `/api/events/availability`
- Team/Admin: `/api/team/events`, `/api/team/members`, `/api/admin/*`
- Preferences/Notifications: `/api/preferences`, `/api/notifications`
- Voice: `/api/voice/parse`, `/api/voice/schedule`, `/api/voice/simulate-call`
- Google status stub: `/api/calendar/google/status`

### Spring reference backend (`springboot-backend/src/main/java/com/scheduler/controller`)

Contains corresponding auth/event/admin/preferences/voice controllers, including Twilio webhook endpoint:
- `/api/voice/twilio/webhook`

## Testing, linting, and build

- **Backend tests:**
  ```bash
  cd /home/runner/work/Voice-Scheduler/Voice-Scheduler/backend
  pytest tests/backend_test.py
  ```
- **Frontend tests/build:** use `yarn test` / `yarn build`
- **Spring tests/build:** use `mvn test` / `mvn package`
- No dedicated top-level lint script is defined in repository root.

## Integrations

- **MongoDB** (active backend datastore)
- **Google Calendar** (status endpoint/stub in FastAPI; service wiring in Spring backend)
- **Twilio / SMTP**:
  - FastAPI backend currently logs simulated notifications/call behavior.
  - Spring backend includes credential-driven properties for Twilio and mail.

## Deployment guidance

No Dockerfile, compose file, or deployment workflow is currently tracked in this repository.
Deploy by running frontend + selected backend with your environment variables and infrastructure.

## Troubleshooting

- **Frontend cannot reach API**: verify `frontend/.env` has `REACT_APP_BACKEND_URL` pointing to backend host/port.
- **401/Not authenticated**: login first; API expects JWT cookie or bearer token.
- **Voice parse fails to create event**: include explicit date/time words (e.g., “tomorrow at 3pm”).
- **Spring backend startup issues**: confirm MySQL exists and required env vars in `application.properties` are set.

## Contributing

Contribution guidelines are **not currently specified** in repository files.

## License

A project license file is **not currently specified** in repository files.
