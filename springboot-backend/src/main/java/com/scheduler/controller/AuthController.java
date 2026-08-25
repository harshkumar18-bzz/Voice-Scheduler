package com.scheduler.controller;

import com.scheduler.entity.User;
import com.scheduler.repository.UserRepository;
import com.scheduler.security.JwtService;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public record RegisterRequest(@NotBlank String name, @Email String email, @NotBlank String password) {}
    public record LoginRequest(@Email String email, @NotBlank String password) {}

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody RegisterRequest req) {
        if (userRepository.findByEmail(req.email().toLowerCase()).isPresent())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already registered");
        User user = User.builder()
                .name(req.name()).email(req.email().toLowerCase())
                .passwordHash(passwordEncoder.encode(req.password()))
                .role(User.Role.USER).build();
        userRepository.save(user);
        return authResponse(user);
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginRequest req) {
        User user = userRepository.findByEmail(req.email().toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        if (user.getPasswordHash() == null || !passwordEncoder.matches(req.password(), user.getPasswordHash()))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        return authResponse(user);
    }

    /** OAuth2 (Google) success handler target: upserts the user and issues our JWT. */
    @GetMapping("/oauth2/success")
    public Map<String, Object> oauth2Success(@AuthenticationPrincipal OAuth2User principal) {
        String email = principal.getAttribute("email");
        User user = userRepository.findByEmail(email).orElseGet(() -> userRepository.save(
                User.builder().name(principal.getAttribute("name")).email(email)
                        .oauthProvider("google").oauthSubject(principal.getName())
                        .role(User.Role.USER).build()));
        return authResponse(user);
    }

    private Map<String, Object> authResponse(User user) {
        return Map.of(
                "id", user.getId(), "name", user.getName(), "email", user.getEmail(),
                "role", user.getRole().name(), "accessToken", jwtService.generateToken(user));
    }
}
