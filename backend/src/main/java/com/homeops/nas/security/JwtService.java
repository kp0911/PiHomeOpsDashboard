package com.homeops.nas.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.homeops.nas.AppConfig;
import com.homeops.nas.domain.UserAccount;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    private final Algorithm algorithm;

    public JwtService(AppConfig appConfig) {
        this.algorithm = Algorithm.HMAC256(appConfig.jwtSecret());
    }

    public String issue(UserAccount user) {
        Instant now = Instant.now();
        return JWT.create()
                .withSubject(user.getId().toString())
                .withClaim("username", user.getUsername())
                .withClaim("role", user.getRole().name())
                .withIssuedAt(now)
                .withExpiresAt(now.plusSeconds(12 * 60 * 60))
                .sign(algorithm);
    }

    public DecodedJWT verify(String token) {
        return JWT.require(algorithm).build().verify(token);
    }

    public UUID userId(DecodedJWT jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
