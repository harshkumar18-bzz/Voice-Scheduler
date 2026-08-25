package com.scheduler.service;

import com.joestelmach.natty.DateGroup;
import com.joestelmach.natty.Parser;
import com.scheduler.entity.CalendarEvent;
import com.scheduler.entity.User;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Voice-activated scheduling NLP service.
 * Twilio Voice webhook flow:
 *   1. Inbound call hits /api/voice/twilio/webhook
 *   2. TwiML <Gather input="speech"> transcribes the caller's request
 *   3. This service parses spoken dates/times/context (Natty + regex)
 *   4. A CalendarEvent is persisted to MySQL and confirmed back via <Say>
 */
@Service
public class VoiceSchedulingService {

    private static final Pattern WITH = Pattern.compile("with\\s+([A-Za-z][A-Za-z .']{1,40}?)(?=\\s+(?:on|at|tomorrow|today|next|about|for)\\b|[,.]|$)", Pattern.CASE_INSENSITIVE);
    private static final Pattern DURATION = Pattern.compile("for\\s+(?:(\\d+)\\s*hours?|(\\d+)\\s*minutes?)", Pattern.CASE_INSENSITIVE);
    private static final Pattern TYPE = Pattern.compile("\\b(meeting|call|appointment|interview|standup|review|sync|demo)\\b", Pattern.CASE_INSENSITIVE);

    public record ParsedMeeting(String title, LocalDateTime start, LocalDateTime end, String attendee) {}

    public ParsedMeeting parse(String transcript) {
        Parser parser = new Parser();
        List<DateGroup> groups = parser.parse(transcript);
        LocalDateTime start = null;
        if (!groups.isEmpty() && !groups.get(0).getDates().isEmpty()) {
            start = groups.get(0).getDates().get(0).toInstant()
                    .atZone(ZoneId.systemDefault()).toLocalDateTime();
        }
        int minutes = 30;
        Matcher dm = DURATION.matcher(transcript);
        if (dm.find()) minutes = dm.group(1) != null ? Integer.parseInt(dm.group(1)) * 60 : Integer.parseInt(dm.group(2));

        String title = "Meeting";
        Matcher tm = TYPE.matcher(transcript);
        if (tm.find()) title = Character.toUpperCase(tm.group(1).charAt(0)) + tm.group(1).substring(1).toLowerCase();
        String attendee = null;
        Matcher wm = WITH.matcher(transcript);
        if (wm.find()) {
            attendee = wm.group(1).trim();
            title += " with " + attendee;
        }
        LocalDateTime end = start != null ? start.plusMinutes(minutes) : null;
        return new ParsedMeeting(title, start, end, attendee);
    }

    public CalendarEvent toEvent(User user, String transcript, ParsedMeeting parsed) {
        return CalendarEvent.builder()
                .user(user)
                .title(parsed.title())
                .description("Scheduled by voice: \"" + transcript + "\"")
                .startTime(parsed.start())
                .endTime(parsed.end())
                .attendees(parsed.attendee())
                .createdVia(CalendarEvent.CreatedVia.VOICE)
                .build();
    }
}
