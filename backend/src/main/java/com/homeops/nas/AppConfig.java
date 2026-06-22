package com.homeops.nas;

import jakarta.validation.constraints.NotBlank;
import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "homeops")
public record AppConfig(
        @NotBlank String nasRoot,
        @NotBlank String jwtSecret,
        @NotBlank String adminUsername,
        @NotBlank String adminPassword
) {
    public Path nasRootPath() {
        return Path.of(nasRoot).toAbsolutePath().normalize();
    }
}
