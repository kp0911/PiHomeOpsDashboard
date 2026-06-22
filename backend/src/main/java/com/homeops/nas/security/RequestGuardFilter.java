package com.homeops.nas.security;

import com.homeops.nas.repo.BlockedIpRepository;
import com.homeops.nas.web.RequestUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.TimeUnit;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RequestGuardFilter extends OncePerRequestFilter {
    private static final int REQUESTS_PER_MINUTE = 120;

    private final BlockedIpRepository blockedIpRepository;
    private final StringRedisTemplate redisTemplate;

    public RequestGuardFilter(BlockedIpRepository blockedIpRepository, StringRedisTemplate redisTemplate) {
        this.blockedIpRepository = blockedIpRepository;
        this.redisTemplate = redisTemplate;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String ip = RequestUtil.clientIp(request);
        boolean blocked = blockedIpRepository.findByIpAddress(ip)
                .map(entry -> entry.getBlockedUntil() == null || entry.getBlockedUntil().isAfter(Instant.now()))
                .orElse(false);
        if (blocked) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "IP address is blocked.");
            return;
        }

        String key = "rate:" + ip + ":" + Instant.now().getEpochSecond() / 60;
        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1L) {
            redisTemplate.expire(key, 70, TimeUnit.SECONDS);
        }
        if (count != null && count > REQUESTS_PER_MINUTE) {
            response.sendError(429, "Too many requests.");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
