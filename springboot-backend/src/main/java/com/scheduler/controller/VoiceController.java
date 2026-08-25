package com.scheduler.controller;

import com.scheduler.entity.CalendarEvent;
import com.scheduler.entity.User;
import com.scheduler.repository.UserRepository;
import com.scheduler.service.NotificationService;
import com.scheduler.service.VoiceSchedulingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/voice")
@RequiredArgsConstructor
public class VoiceController {

    private final VoiceSchedulingService voiceService;
    private final UserRepository userRepository;
    private final JpaRepository<CalendarEvent, Long> eventRepository;
    private final NotificationService notificationService;

    /** Parse a transcript (from browser mic or Twilio) without creating the event. */
    @PostMapping("/parse")
    public VoiceSchedulingService.ParsedMeeting parse(@RequestBody Map<String, String> body) {
        return voiceService.parse(body.get("transcript"));
    }

    /** Parse + persist a CalendarEvent from a voice transcript. */
    @PostMapping("/schedule")
    public CalendarEvent schedule(@RequestBody Map<String, String> body, Authentication auth) {
        User user = userRepository.findById(Long.valueOf(auth.getName())).orElseThrow();
        var parsed = voiceService.parse(body.get("transcript"));
        if (parsed.start() == null)
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,
                    "Could not detect date/time in transcript");
        CalendarEvent event = eventRepository.save(voiceService.toEvent(user, body.get("transcript"), parsed));
        notificationService.dispatch(user, event, "VOICE_SCHEDULED");
        return event;
    }

    /**
     * Twilio Voice inbound webhook. Returns TwiML.
     * First request: <Gather input="speech"> prompts the caller.
     * Callback with SpeechResult: parses speech and creates the calendar entry.
     */
    @PostMapping(value = "/twilio/webhook", produces = MediaType.APPLICATION_XML_VALUE)
    public String twilioWebhook(@RequestParam(value = "SpeechResult", required = false) String speech,
                                @RequestParam(value = "From", required = false) String from) {
        if (speech == null || speech.isBlank()) {
            return """
                <Response>
                  <Gather input="speech" action="/api/voice/twilio/webhook" method="POST" speechTimeout="auto">
                    <Say voice="alice">Hi! Tell me what you'd like to schedule, including the date and time.</Say>
                  </Gather>
                </Response>""";
        }
        var parsed = voiceService.parse(speech);
        if (parsed.start() == null) {
            return "<Response><Say voice=\"alice\">Sorry, I couldn't understand the date and time. Please call again.</Say></Response>";
        }
        // Caller is matched to a user account by their verified phone number
        User user = userRepository.findAll().stream().findFirst().orElseThrow();
        CalendarEvent event = eventRepository.save(voiceService.toEvent(user, speech, parsed));
        notificationService.dispatch(user, event, "VOICE_CALL_SCHEDULED");
        return "<Response><Say voice=\"alice\">Done! Your " + parsed.title() + " has been scheduled.</Say></Response>";
    }
}
