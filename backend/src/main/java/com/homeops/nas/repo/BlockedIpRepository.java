package com.homeops.nas.repo;

import com.homeops.nas.domain.BlockedIp;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BlockedIpRepository extends JpaRepository<BlockedIp, UUID> {
    Optional<BlockedIp> findByIpAddress(String ipAddress);
}
