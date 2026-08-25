from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
import asyncio
import dateparser
from dateparser.search import search_dates

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']

app = FastAPI(title="Scheduler & Calendar Management API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------- Helpers ----------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True, secure=True,
                        samesite="none", max_age=43200, path="/")

def public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"],
            "created_at": u.get("created_at")}

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_roles(*roles):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Requires one of roles: {', '.join(roles)}")
        return user
    return checker

# ---------- Models ----------

class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class EventInput(BaseModel):
    title: str
    description: str = ""
    start_time: str
    end_time: str
    location: str = ""
    attendees: List[str] = []
    created_via: str = "manual"

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    attendees: Optional[List[str]] = None

class PreferencesInput(BaseModel):
    email_enabled: bool = True
    sms_enabled: bool = False
    voice_call_enabled: bool = False
    phone_number: str = ""
    reminder_minutes_before: int = 30
    google_calendar_connected: bool = False

class RoleUpdate(BaseModel):
    role: str

class VoiceParseInput(BaseModel):
    transcript: str

class SimulatedCallInput(BaseModel):
    transcript: str
    caller_phone: str = "+1-555-0100"

# ---------- Notification engine ----------

async def get_prefs(user_id: str) -> dict:
    prefs = await db.preferences.find_one({"user_id": user_id}, {"_id": 0})
    if not prefs:
        prefs = {"user_id": user_id, "email_enabled": True, "sms_enabled": False,
                 "voice_call_enabled": False, "phone_number": "",
                 "reminder_minutes_before": 30, "google_calendar_connected": False}
        await db.preferences.insert_one({**prefs})
    return prefs

async def dispatch_notifications(user: dict, event: dict, trigger: str):
    prefs = await get_prefs(user["id"])
    channels = []
    if prefs.get("email_enabled"):
        channels.append(("EMAIL", f"Email sent to {user['email']} (SIMULATED - JavaMailSender equivalent)"))
    if prefs.get("sms_enabled"):
        phone = prefs.get("phone_number") or "no phone set"
        channels.append(("SMS", f"SMS sent via Twilio to {phone} (SIMULATED)"))
    if prefs.get("voice_call_enabled"):
        phone = prefs.get("phone_number") or "no phone set"
        channels.append(("VOICE_CALL", f"Voice call reminder via Twilio Voice to {phone} (SIMULATED)"))
    for channel, detail in channels:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "user_id": user["id"], "event_id": event["id"],
            "event_title": event["title"], "channel": channel, "trigger": trigger,
            "detail": detail, "status": "SENT_SIMULATED",
            "created_at": datetime.now(timezone.utc).isoformat()
        })

# ---------- Voice NLP parsing ----------

DURATION_RE = re.compile(r"for\s+(?:(\d+)\s*(?:hours?|hrs?)|(\d+)\s*(?:minutes?|mins?))", re.I)
WITH_RE = re.compile(r"with\s+([A-Za-z][A-Za-z .']{1,40}?)(?=\s+(?:on|at|tomorrow|today|next|this|about|for)\b|[,.]|$)", re.I)
ABOUT_RE = re.compile(r"(?:about|regarding|to discuss)\s+(.+?)(?=\s+(?:on|at|tomorrow|today|next|this|for)\b|[,.]|$)", re.I)
TYPE_RE = re.compile(r"\b(meeting|call|appointment|interview|standup|review|sync|demo|lunch)\b", re.I)

def parse_voice_transcript(transcript: str) -> dict:
    text = transcript.strip()
    settings = {"PREFER_DATES_FROM": "future", "RETURN_AS_TIMEZONE_AWARE": False}
    found = search_dates(text, languages=["en"], settings=settings)
    start_dt = None
    matched_phrase = None
    if found:
        for phrase, dt in found:
            if any(c.isdigit() for c in phrase) or re.search(r"tomorrow|today|next|monday|tuesday|wednesday|thursday|friday|saturday|sunday|noon|morning|afternoon|evening", phrase, re.I):
                start_dt, matched_phrase = dt, phrase
                break
        if start_dt is None:
            matched_phrase, start_dt = found[0]
    duration_minutes = 30
    dm = DURATION_RE.search(text)
    if dm:
        duration_minutes = int(dm.group(1)) * 60 if dm.group(1) else int(dm.group(2))
    meeting_type = "Meeting"
    tm = TYPE_RE.search(text)
    if tm:
        meeting_type = tm.group(1).capitalize()
    wm = WITH_RE.search(text)
    am = ABOUT_RE.search(text)
    title = meeting_type
    if wm:
        title += f" with {wm.group(1).strip().title()}"
    if am:
        title += f" — {am.group(1).strip()}"
    confidence = 0.0
    if start_dt:
        confidence += 0.5
    if wm or am:
        confidence += 0.3
    if tm:
        confidence += 0.2
    result = {
        "title": title,
        "start_time": start_dt.isoformat() if start_dt else None,
        "end_time": (start_dt + timedelta(minutes=duration_minutes)).isoformat() if start_dt else None,
        "duration_minutes": duration_minutes,
        "matched_date_phrase": matched_phrase,
        "attendee": wm.group(1).strip().title() if wm else None,
        "topic": am.group(1).strip() if am else None,
        "confidence": round(confidence, 2),
        "transcript": transcript,
    }
    return result

# ---------- Auth routes ----------

@api_router.post("/auth/register")
async def register(body: RegisterInput, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {"id": str(uuid.uuid4()), "email": email, "name": body.name, "role": "USER",
            "password_hash": hash_password(body.password),
            "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one({**user})
    token = create_access_token(user["id"], email, user["role"])
    set_auth_cookie(response, token)
    return {**public_user(user), "access_token": token}

@api_router.post("/auth/login")
async def login(body: LoginInput, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email, user["role"])
    set_auth_cookie(response, token)
    return {**public_user(user), "access_token": token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)

# ---------- Events routes ----------

@api_router.post("/events")
async def create_event(body: EventInput, user: dict = Depends(get_current_user)):
    event = {"id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user["name"],
             **body.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.events.insert_one({**event})
    await dispatch_notifications(user, event, "EVENT_CREATED")
    return event

@api_router.get("/events")
async def list_events(user: dict = Depends(get_current_user)):
    events = await db.events.find({"user_id": user["id"]}, {"_id": 0}).sort("start_time", 1).to_list(1000)
    return events

@api_router.put("/events/{event_id}")
async def update_event(event_id: str, body: EventUpdate, user: dict = Depends(get_current_user)):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["user_id"] != user["id"] and user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Not allowed")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "start_time" in updates:
        updates["reminder_sent"] = False
    await db.events.update_one({"id": event_id}, {"$set": updates})
    updated = await db.events.find_one({"id": event_id}, {"_id": 0})
    return updated

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(get_current_user)):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["user_id"] != user["id"] and user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Not allowed")
    await db.events.delete_one({"id": event_id})
    return {"message": "Event deleted"}

@api_router.get("/events/conflicts")
async def event_conflicts(start: str, end: str, exclude_id: str = "", user: dict = Depends(get_current_user)):
    events = await db.events.find({"user_id": user["id"], "start_time": {"$lt": end},
                                   "end_time": {"$gt": start}}, {"_id": 0}).to_list(100)
    return {"conflicts": [e for e in events if e["id"] != exclude_id]}

@api_router.get("/events/availability")
async def availability(date: str, user: dict = Depends(get_current_user)):
    events = await db.events.find({"user_id": user["id"],
                                   "start_time": {"$gte": f"{date}T00:00:00", "$lte": f"{date}T23:59:59"}},
                                  {"_id": 0}).sort("start_time", 1).to_list(200)
    busy = [{"start": e["start_time"], "end": e["end_time"], "title": e["title"]} for e in events]
    return {"date": date, "busy_slots": busy, "is_free": len(busy) == 0}

# ---------- Team routes (MANAGER + ADMIN) ----------

@api_router.get("/team/events")
async def team_events(user: dict = Depends(require_roles("MANAGER", "ADMIN"))):
    events = await db.events.find({}, {"_id": 0}).sort("start_time", 1).to_list(2000)
    return events

@api_router.get("/team/members")
async def team_members(user: dict = Depends(require_roles("MANAGER", "ADMIN"))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    result = []
    for u in users:
        count = await db.events.count_documents({"user_id": u["id"]})
        result.append({**u, "event_count": count})
    return result

# ---------- Admin routes ----------

@api_router.get("/admin/users")
async def admin_users(user: dict = Depends(require_roles("ADMIN"))):
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)

@api_router.patch("/admin/users/{user_id}/role")
async def change_role(user_id: str, body: RoleUpdate, user: dict = Depends(require_roles("ADMIN"))):
    if body.role not in ("ADMIN", "MANAGER", "USER"):
        raise HTTPException(status_code=400, detail="Invalid role")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"id": user_id}, {"$set": {"role": body.role}})
    return {"message": "Role updated", "role": body.role}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_roles("ADMIN"))):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await db.events.delete_many({"user_id": user_id})
    return {"message": "User deleted"}

@api_router.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_roles("ADMIN"))):
    return {
        "total_users": await db.users.count_documents({}),
        "total_events": await db.events.count_documents({}),
        "total_notifications": await db.notifications.count_documents({}),
        "voice_scheduled_events": await db.events.count_documents({"created_via": "voice"}),
        "roles": {
            "ADMIN": await db.users.count_documents({"role": "ADMIN"}),
            "MANAGER": await db.users.count_documents({"role": "MANAGER"}),
            "USER": await db.users.count_documents({"role": "USER"}),
        }
    }

# ---------- Preferences ----------

@api_router.get("/preferences")
async def get_preferences(user: dict = Depends(get_current_user)):
    return await get_prefs(user["id"])

@api_router.put("/preferences")
async def update_preferences(body: PreferencesInput, user: dict = Depends(get_current_user)):
    await get_prefs(user["id"])
    await db.preferences.update_one({"user_id": user["id"]}, {"$set": body.model_dump()})
    return await db.preferences.find_one({"user_id": user["id"]}, {"_id": 0})

# ---------- Notifications ----------

@api_router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    return await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)

# ---------- Google Calendar (stub — awaiting credentials) ----------

@api_router.get("/calendar/google/status")
async def google_status(user: dict = Depends(get_current_user)):
    prefs = await get_prefs(user["id"])
    return {"connected": prefs.get("google_calendar_connected", False),
            "message": "Google Calendar sync requires Google Cloud OAuth credentials (Client ID/Secret with Calendar scope). Internal calendar is fully functional."}

# ---------- Voice scheduling ----------

@api_router.post("/voice/parse")
async def voice_parse(body: VoiceParseInput, user: dict = Depends(get_current_user)):
    if not body.transcript.strip():
        raise HTTPException(status_code=400, detail="Empty transcript")
    return parse_voice_transcript(body.transcript)

@api_router.post("/voice/schedule")
async def voice_schedule(body: VoiceParseInput, user: dict = Depends(get_current_user)):
    parsed = parse_voice_transcript(body.transcript)
    if not parsed["start_time"]:
        raise HTTPException(status_code=422, detail="Could not detect a date/time in the transcript. Try: 'Schedule a meeting with John tomorrow at 3pm'")
    event = {"id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user["name"],
             "title": parsed["title"], "description": f"Scheduled by voice: \"{body.transcript}\"",
             "start_time": parsed["start_time"], "end_time": parsed["end_time"],
             "location": "", "attendees": [parsed["attendee"]] if parsed["attendee"] else [],
             "created_via": "voice", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.events.insert_one({**event})
    await dispatch_notifications(user, event, "VOICE_SCHEDULED")
    return {"parsed": parsed, "event": event}

@api_router.post("/voice/simulate-call")
async def simulate_twilio_call(body: SimulatedCallInput, user: dict = Depends(get_current_user)):
    """SIMULATED Twilio Voice inbound call flow: speech-to-text -> NLP -> calendar entry."""
    call_sid = f"CA{uuid.uuid4().hex}"
    parsed = parse_voice_transcript(body.transcript)
    steps = [
        {"step": 1, "actor": "Twilio Voice (SIMULATED)", "action": f"Inbound call received from {body.caller_phone}", "call_sid": call_sid},
        {"step": 2, "actor": "Twilio <Gather input='speech'>", "action": "Caller speech captured and transcribed", "transcript": body.transcript},
        {"step": 3, "actor": "NLP Parser", "action": "Parsed spoken date, time and context", "parsed": parsed},
    ]
    event = None
    if parsed["start_time"]:
        event = {"id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user["name"],
                 "title": parsed["title"], "description": f"Scheduled via simulated Twilio voice call {call_sid}",
                 "start_time": parsed["start_time"], "end_time": parsed["end_time"],
                 "location": "", "attendees": [parsed["attendee"]] if parsed["attendee"] else [],
                 "created_via": "voice", "created_at": datetime.now(timezone.utc).isoformat()}
        await db.events.insert_one({**event})
        await dispatch_notifications(user, event, "VOICE_CALL_SCHEDULED")
        steps.append({"step": 4, "actor": "Calendar Service", "action": "Calendar entry created in database", "event_id": event["id"]})
        steps.append({"step": 5, "actor": "Twilio <Say>", "action": f"'Your {parsed['title']} has been scheduled.' — call ended"})
    else:
        steps.append({"step": 4, "actor": "Twilio <Say>", "action": "'Sorry, I could not understand the date and time. Please try again.' — call ended"})
    await db.call_logs.insert_one({"id": str(uuid.uuid4()), "call_sid": call_sid, "user_id": user["id"],
                                   "caller_phone": body.caller_phone, "transcript": body.transcript,
                                   "success": event is not None,
                                   "created_at": datetime.now(timezone.utc).isoformat()})
    return {"call_sid": call_sid, "simulated": True, "steps": steps, "event": event, "parsed": parsed}

@api_router.get("/")
async def root():
    return {"message": "Scheduler & Calendar Management API", "status": "running"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',')],
    allow_methods=["*"],
    allow_headers=["*"],
)

SEED_USERS = [
    {"email": "admin@scheduler.com", "password": "Admin@123", "name": "Ava Admin", "role": "ADMIN"},
    {"email": "manager@scheduler.com", "password": "Manager@123", "name": "Max Manager", "role": "MANAGER"},
    {"email": "user@scheduler.com", "password": "User@123", "name": "Uma User", "role": "USER"},
]

async def reminder_loop():
    while True:
        try:
            now = datetime.now()
            events = await db.events.find({"reminder_sent": {"$ne": True}}, {"_id": 0}).to_list(2000)
            for e in events:
                try:
                    start = datetime.fromisoformat(e["start_time"])
                except (ValueError, KeyError):
                    continue
                if start.tzinfo:
                    start = start.replace(tzinfo=None)
                if start <= now:
                    await db.events.update_one({"id": e["id"]}, {"$set": {"reminder_sent": True}})
                    continue
                owner = await db.users.find_one({"id": e["user_id"]}, {"_id": 0})
                if not owner:
                    continue
                prefs = await get_prefs(owner["id"])
                mins = prefs.get("reminder_minutes_before", 30)
                if start - timedelta(minutes=mins) <= now:
                    await dispatch_notifications(owner, e, "REMINDER")
                    await db.events.update_one({"id": e["id"]}, {"$set": {"reminder_sent": True}})
        except Exception as ex:
            logger.error(f"reminder loop error: {ex}")
        await asyncio.sleep(60)

@app.on_event("startup")
async def startup():
    asyncio.create_task(reminder_loop())
    await db.users.create_index("email", unique=True)
    await db.events.create_index([("user_id", 1), ("start_time", 1)])
    for s in SEED_USERS:
        existing = await db.users.find_one({"email": s["email"]})
        if existing is None:
            await db.users.insert_one({"id": str(uuid.uuid4()), "email": s["email"], "name": s["name"],
                                       "role": s["role"], "password_hash": hash_password(s["password"]),
                                       "created_at": datetime.now(timezone.utc).isoformat()})
        elif not verify_password(s["password"], existing["password_hash"]):
            await db.users.update_one({"email": s["email"]}, {"$set": {"password_hash": hash_password(s["password"])}})
    logger.info("Seed users ready")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
