package com.homeops.nas.web;

import com.homeops.nas.domain.AuditEventType;
import com.homeops.nas.domain.UserAccount;
import com.homeops.nas.repo.UserAccountRepository;
import com.homeops.nas.security.JwtService;
import com.homeops.nas.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditService auditService;

    public AuthController(UserAccountRepository userAccountRepository, PasswordEncoder passwordEncoder,
                          JwtService jwtService, AuditService auditService) {
        this.userAccountRepository = userAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditService = auditService;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
        String ip = RequestUtil.clientIp(request);
        String userAgent = request.getHeader("User-Agent");
        UserAccount user = userAccountRepository.findByUsername(body.username())
                .orElseThrow(() -> {
                    auditService.record(null, AuditEventType.LOGIN_FAILED, ip, userAgent, body.username(), "Unknown username");
                    return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
                });

        Instant now = Instant.now();
        if (user.isLocked(now)) {
            auditService.record(user.getId(), AuditEventType.ACCOUNT_LOCKED, ip, userAgent, user.getUsername(), "Account is locked");
            throw new ResponseStatusException(HttpStatus.LOCKED, "Account is temporarily locked");
        }
        if (!user.isEnabled() || !passwordEncoder.matches(body.password(), user.getPasswordHash())) {
            user.recordFailure(now);
            userAccountRepository.save(user);
            auditService.record(user.getId(), AuditEventType.LOGIN_FAILED, ip, userAgent, user.getUsername(), "Invalid password");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        user.recordSuccess(now);
        userAccountRepository.save(user);
        auditService.record(user.getId(), AuditEventType.LOGIN_SUCCESS, ip, userAgent, user.getUsername(), "Login accepted");
        return new LoginResponse(jwtService.issue(user), user.getUsername(), user.getRole().name());
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {
    }

    public record LoginResponse(String token, String username, String role) {
    }
}
