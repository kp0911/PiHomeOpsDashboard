package com.homeops.nas.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AuditEventType eventType;

    private String ipAddress;
    private String userAgent;
    private String target;

    @Column(length = 2000)
    private String detail;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected AuditLog() {
    }

    public AuditLog(UUID userId, AuditEventType eventType, String ipAddress, String userAgent, String target, String detail) {
        this.userId = userId;
        this.eventType = eventType;
        this.ipAddress = ipAddress;
        this.userAgent = userAgent;
        this.target = target;
        this.detail = detail;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public AuditEventType getEventType() { return eventType; }
    public String getIpAddress() { return ipAddress; }
    public String getUserAgent() { return userAgent; }
    public String getTarget() { return target; }
    public String getDetail() { return detail; }
    public Instant getCreatedAt() { return createdAt; }
}
