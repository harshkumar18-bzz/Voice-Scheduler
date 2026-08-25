# Scheduler & Calendar Management — Spring Boot Reference Backend

Complete Spring Boot 3 + MySQL reference implementation matching the running FastAPI app.

## Stack
- Spring Boot 3.3 (Web, Security, Data JPA, Validation, Mail, OAuth2 Client)
- MySQL 8 via Spring Data JPA / Hibernate
- JWT (jjwt) + OAuth2 (Google) login
- RBAC: ADMIN / MANAGER / USER
- Google Calendar API client
- Twilio SDK (SMS + Voice)

## Project structure
```
springboot-backend/
├── pom.xml
├── src/main/resources/application.properties
└── src/main/java/com/scheduler/
    ├── SchedulerApplication.java
    ├── config/SecurityConfig.java
    ├── security/JwtService.java
    ├── security/JwtAuthFilter.java
    ├── entity/User.java
    ├── entity/CalendarEvent.java
    ├── entity/NotificationPreference.java
    ├── entity/NotificationLog.java
    ├── repository/ (Spring Data JPA repositories)
    ├── controller/AuthController.java
    ├── controller/EventController.java
    ├── controller/AdminController.java
    ├── controller/PreferenceController.java
    ├── controller/VoiceController.java
    ├── service/GoogleCalendarService.java
    ├── service/NotificationService.java
    └── service/VoiceSchedulingService.java
```

## Setup
1. Create MySQL DB: `CREATE DATABASE scheduler_db;`
2. Fill `application.properties` with your MySQL, Google OAuth, Twilio and SMTP credentials.
3. `mvn spring-boot:run`

## Notes
- OAuth2 Google login is configured under `spring.security.oauth2.client.registration.google.*`.
- Google Calendar sync uses the OAuth access token from the logged-in session (Calendar scope required).
- Twilio SMS/Voice require `twilio.account-sid`, `twilio.auth-token`, `twilio.phone-number`.
- Voice scheduling: Twilio Voice webhook `/api/voice/twilio/webhook` uses `<Gather input="speech">`; the transcribed speech is parsed by `VoiceSchedulingService` (Natty/regex NLP) into a `CalendarEvent`.
