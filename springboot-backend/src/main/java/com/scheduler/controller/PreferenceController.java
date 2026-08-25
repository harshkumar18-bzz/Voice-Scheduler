package com.scheduler.controller;

import com.scheduler.entity.NotificationPreference;
import com.scheduler.entity.User;
import com.scheduler.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/preferences")
@RequiredArgsConstructor
public class PreferenceController {

    private final UserRepository userRepository;
    private final JpaRepository<NotificationPreference, Long> prefRepository;

    public record PrefRequest(boolean emailEnabled, boolean smsEnabled, boolean voiceCallEnabled,
                              String phoneNumber, int reminderMinutesBefore) {}

    private NotificationPreference find(User user) {
        return prefRepository.findAll().stream()
                .filter(p -> p.getUser().getId().equals(user.getId()))
                .findFirst()
                .orElseGet(() -> prefRepository.save(NotificationPreference.builder().user(user).emailEnabled(true).build()));
    }

    @GetMapping
    public NotificationPreference get(Authentication auth) {
        User user = userRepository.findById(Long.valueOf(auth.getName())).orElseThrow();
        return find(user);
    }

    @PutMapping
    public NotificationPreference update(@RequestBody PrefRequest req, Authentication auth) {
        User user = userRepository.findById(Long.valueOf(auth.getName())).orElseThrow();
        NotificationPreference prefs = find(user);
        prefs.setEmailEnabled(req.emailEnabled());
        prefs.setSmsEnabled(req.smsEnabled());
        prefs.setVoiceCallEnabled(req.voiceCallEnabled());
        prefs.setPhoneNumber(req.phoneNumber());
        prefs.setReminderMinutesBefore(req.reminderMinutesBefore());
        return prefRepository.save(prefs);
    }
}
