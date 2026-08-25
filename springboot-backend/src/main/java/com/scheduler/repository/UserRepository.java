package com.scheduler.repository;

import com.scheduler.entity.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    long countByRole(User.Role role);
}

interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {
    List<CalendarEvent> findByUserIdOrderByStartTimeAsc(Long userId);
    List<CalendarEvent> findByUserIdAndStartTimeBetween(Long userId, LocalDateTime from, LocalDateTime to);
    long countByCreatedVia(CalendarEvent.CreatedVia via);
}

interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Long> {
    Optional<NotificationPreference> findByUserId(Long userId);
}

interface NotificationLogRepository extends JpaRepository<NotificationLog, Long> {
    List<NotificationLog> findByUserIdOrderByCreatedAtDesc(Long userId);
}
