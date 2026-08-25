package com.scheduler.controller;

import com.scheduler.entity.User;
import com.scheduler.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;

    @GetMapping("/users")
    public List<User> users() {
        return userRepository.findAll();
    }

    @PatchMapping("/users/{id}/role")
    public Map<String, String> changeRole(@PathVariable Long id, @RequestBody Map<String, String> body) {
        User user = userRepository.findById(id).orElseThrow();
        user.setRole(User.Role.valueOf(body.get("role")));
        userRepository.save(user);
        return Map.of("message", "Role updated", "role", user.getRole().name());
    }

    @DeleteMapping("/users/{id}")
    public Map<String, String> delete(@PathVariable Long id) {
        userRepository.deleteById(id);
        return Map.of("message", "User deleted");
    }

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return Map.of(
                "totalUsers", userRepository.count(),
                "admins", userRepository.countByRole(User.Role.ADMIN),
                "managers", userRepository.countByRole(User.Role.MANAGER),
                "users", userRepository.countByRole(User.Role.USER));
    }
}
