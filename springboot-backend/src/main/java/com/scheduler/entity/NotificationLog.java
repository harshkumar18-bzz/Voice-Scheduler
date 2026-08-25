package com.scheduler.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "notification_logs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NotificationLog {

    public enum Channel { EMAIL, SMS, VOICE_CALL }
    public enum Status { SENT, FAILED, PENDING }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id")
    private CalendarEvent event;

    @Enumerated(EnumType.STRING)
    private Channel channel;

    @Enumerated(EnumType.STRING)
    private Status status;

    private String detail;
    private Instant createdAt = Instant.now();
}
