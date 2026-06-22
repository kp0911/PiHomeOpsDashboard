package com.homeops.nas.service;

import com.homeops.nas.domain.AuditEventType;
import com.homeops.nas.domain.AuditLog;
import com.homeops.nas.repo.AuditLogRepository;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void record(UUID userId, AuditEventType eventType, String ipAddress, String userAgent, String target, String detail) {
        auditLogRepository.save(new AuditLog(userId, eventType, ipAddress, userAgent, target, detail));
    }

    public Page<AuditLog> latest(int page, int size) {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, Math.min(size, 100)));
    }
}
