package com.scheduler.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "notification_preferences")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NotificationPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    private boolean emailEnabled = true;
    private boolean smsEnabled = false;
    private boolean voiceCallEnabled = false;

    private String phoneNumber;
    private int reminderMinutesBefore = 30;
    private boolean googleCalendarConnected = false;
}
