package com.scheduler.controller;

import com.scheduler.entity.CalendarEvent;
import com.scheduler.entity.User;
import com.scheduler.repository.UserRepository;
import com.scheduler.service.GoogleCalendarService;
import com.scheduler.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final UserRepository userRepository;
    private final JpaRepository<CalendarEvent, Long> eventRepository;
    private final NotificationService notificationService;
    private final GoogleCalendarService googleCalendarService;

    public record EventRequest(String title, String description, LocalDateTime startTime,
                               LocalDateTime endTime, String location, String attendees) {}

    private User currentUser(Authentication auth) {
        return userRepository.findById(Long.valueOf(auth.getName())).orElseThrow();
    }

    @PostMapping
    public CalendarEvent create(@RequestBody EventRequest req, Authentication auth) {
        User user = currentUser(auth);
        CalendarEvent event = CalendarEvent.builder()
                .user(user).title(req.title()).description(req.description())
                .startTime(req.startTime()).endTime(req.endTime())
                .location(req.location()).attendees(req.attendees())
                .createdVia(CalendarEvent.CreatedVia.MANUAL).build();
        eventRepository.save(event);
        googleCalendarService.pushEventIfConnected(user, event);
        notificationService.dispatch(user, event, "EVENT_CREATED");
        return event;
    }

    @GetMapping
    public List<CalendarEvent> myEvents(Authentication auth) {
        User user = currentUser(auth);
        return eventRepository.findAll().stream()
                .filter(e -> e.getUser().getId().equals(user.getId())).toList();
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, Authentication auth) {
        User user = currentUser(auth);
        CalendarEvent event = eventRepository.findById(id).orElseThrow();
        boolean isAdmin = user.getRole() == User.Role.ADMIN;
        if (!event.getUser().getId().equals(user.getId()) && !isAdmin)
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN, "Not allowed");
        eventRepository.delete(event);
    }

    @GetMapping("/team")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public List<CalendarEvent> teamEvents() {
        return eventRepository.findAll();
    }
}
