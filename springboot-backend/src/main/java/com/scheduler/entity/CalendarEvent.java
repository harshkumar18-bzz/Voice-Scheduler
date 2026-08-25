package com.scheduler.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.time.LocalDateTime;

@Entity
@Table(name = "calendar_events", indexes = @Index(columnList = "user_id, startTime"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CalendarEvent {

    public enum CreatedVia { MANUAL, VOICE, GOOGLE_SYNC }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String title;

    @Column(length = 2000)
    private String description;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    private String location;

    @Column(length = 1000)
    private String attendees; // comma separated

    @Enumerated(EnumType.STRING)
    private CreatedVia createdVia = CreatedVia.MANUAL;

    private String googleEventId; // set after Google Calendar sync

    private Instant createdAt = Instant.now();
}
