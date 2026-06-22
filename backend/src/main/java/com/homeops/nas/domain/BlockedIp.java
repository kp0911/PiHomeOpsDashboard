package com.homeops.nas.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "blocked_ips")
public class BlockedIp {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String ipAddress;

    @Column(nullable = false)
    private String reason;

    private Instant blockedUntil;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private UUID createdBy;

    protected BlockedIp() {
    }

    public BlockedIp(String ipAddress, String reason, Instant blockedUntil, UUID createdBy) {
        this.ipAddress = ipAddress;
        this.reason = reason;
        this.blockedUntil = blockedUntil;
        this.createdBy = createdBy;
    }

    public UUID getId() { return id; }
    public String getIpAddress() { return ipAddress; }
    public String getReason() { return reason; }
    public Instant getBlockedUntil() { return blockedUntil; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getCreatedBy() { return createdBy; }
}
