package com.scheduler.service;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import com.scheduler.entity.CalendarEvent;
import com.scheduler.entity.User;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.util.Date;
import java.util.List;

/**
 * Google Calendar API integration.
 * Uses the OAuth2 access token (Calendar scope) stored on the User after Google login.
 */
@Service
public class GoogleCalendarService {

    private Calendar client(User user) throws Exception {
        GoogleCredentials credentials = GoogleCredentials.create(new AccessToken(user.getGoogleAccessToken(), null));
        HttpRequestInitializer init = new HttpCredentialsAdapter(credentials);
        return new Calendar.Builder(GoogleNetHttpTransport.newTrustedTransport(), GsonFactory.getDefaultInstance(), init)
                .setApplicationName("Scheduler App").build();
    }

    /** Fetch upcoming events from the user's primary Google calendar. */
    public List<Event> fetchEvents(User user) throws Exception {
        return client(user).events().list("primary")
                .setMaxResults(50)
                .setTimeMin(new com.google.api.client.util.DateTime(new Date()))
                .setOrderBy("startTime").setSingleEvents(true)
                .execute().getItems();
    }

    /** Push a locally-created event to the user's Google calendar (if connected). */
    public void pushEventIfConnected(User user, CalendarEvent event) {
        if (user.getGoogleAccessToken() == null) return;
        try {
            Event gEvent = new Event()
                    .setSummary(event.getTitle())
                    .setDescription(event.getDescription())
                    .setLocation(event.getLocation())
                    .setStart(toEdt(event, true))
                    .setEnd(toEdt(event, false));
            Event created = client(user).events().insert("primary", gEvent).execute();
            event.setGoogleEventId(created.getId());
        } catch (Exception ignored) {
            // sync failure must not block local event creation
        }
    }

    private EventDateTime toEdt(CalendarEvent event, boolean start) {
        var ldt = start ? event.getStartTime() : event.getEndTime();
        var millis = ldt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        return new EventDateTime().setDateTime(new com.google.api.client.util.DateTime(millis));
    }
}
