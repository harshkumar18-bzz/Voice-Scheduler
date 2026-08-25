package com.scheduler.service;

import com.scheduler.entity.CalendarEvent;
import com.scheduler.entity.NotificationLog;
import com.scheduler.entity.NotificationPreference;
import com.scheduler.entity.User;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Call;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import com.twilio.type.Twiml;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;

/**
 * Multi-channel notification engine: Email (JavaMailSender), SMS (Twilio), Voice (Twilio Voice).
 * Channels are selected per-user from NotificationPreference.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final JavaMailSender mailSender;
    private final JpaRepository<NotificationLog, Long> logRepository;
    private final JpaRepository<NotificationPreference, Long> prefRepository;

    @Value("${twilio.account-sid}") private String twilioSid;
    @Value("${twilio.auth-token}") private String twilioToken;
    @Value("${twilio.phone-number}") private String twilioNumber;
    @Value("${spring.mail.username}") private String fromEmail;

    @PostConstruct
    void initTwilio() {
        Twilio.init(twilioSid, twilioToken);
    }

    public void dispatch(User user, CalendarEvent event, String trigger) {
        NotificationPreference prefs = prefRepository.findAll().stream()
                .filter(p -> p.getUser().getId().equals(user.getId())).findFirst().orElse(null);
        if (prefs == null) return;
        String when = event.getStartTime().format(DateTimeFormatter.ofPattern("MMM d 'at' h:mm a"));
        String message = "Reminder: '" + event.getTitle() + "' on " + when;

        if (prefs.isEmailEnabled()) sendEmail(user, event, message);
        if (prefs.isSmsEnabled() && prefs.getPhoneNumber() != null) sendSms(user, event, prefs.getPhoneNumber(), message);
        if (prefs.isVoiceCallEnabled() && prefs.getPhoneNumber() != null) makeVoiceCall(user, event, prefs.getPhoneNumber(), message);
    }

    private void sendEmail(User user, CalendarEvent event, String body) {
        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setFrom(fromEmail);
        mail.setTo(user.getEmail());
        mail.setSubject("Meeting reminder: " + event.getTitle());
        mail.setText(body);
        try {
            mailSender.send(mail);
            log(user, event, NotificationLog.Channel.EMAIL, NotificationLog.Status.SENT, "Email sent to " + user.getEmail());
        } catch (Exception e) {
            log(user, event, NotificationLog.Channel.EMAIL, NotificationLog.Status.FAILED, e.getMessage());
        }
    }

    private void sendSms(User user, CalendarEvent event, String phone, String body) {
        try {
            Message.creator(new PhoneNumber(phone), new PhoneNumber(twilioNumber), body).create();
            log(user, event, NotificationLog.Channel.SMS, NotificationLog.Status.SENT, "SMS sent to " + phone);
        } catch (Exception e) {
            log(user, event, NotificationLog.Channel.SMS, NotificationLog.Status.FAILED, e.getMessage());
        }
    }

    private void makeVoiceCall(User user, CalendarEvent event, String phone, String body) {
        try {
            Call.creator(new PhoneNumber(phone), new PhoneNumber(twilioNumber),
                    new Twiml("<Response><Say voice=\"alice\">" + body + "</Say></Response>")).create();
            log(user, event, NotificationLog.Channel.VOICE_CALL, NotificationLog.Status.SENT, "Voice call placed to " + phone);
        } catch (Exception e) {
            log(user, event, NotificationLog.Channel.VOICE_CALL, NotificationLog.Status.FAILED, e.getMessage());
        }
    }

    private void log(User user, CalendarEvent event, NotificationLog.Channel channel,
                     NotificationLog.Status status, String detail) {
        logRepository.save(NotificationLog.builder()
                .user(user).event(event).channel(channel).status(status).detail(detail).build());
    }
}
