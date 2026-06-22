package com.homeops.nas.service;

import com.homeops.nas.AppConfig;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import org.springframework.stereotype.Service;

@Service
public class NasPathService {
    private final Path nasRoot;

    public NasPathService(AppConfig appConfig) {
        this.nasRoot = appConfig.nasRootPath();
    }

    public Path nasRoot() {
        return nasRoot;
    }

    public Path resolveRequiredInsideRoot(String userPath) {
        String cleaned = userPath == null || userPath.isBlank() ? "/" : userPath.replace("\\", "/");
        if (cleaned.contains("\0")) {
            throw new IllegalArgumentException("Path contains an invalid character.");
        }
        if (cleaned.startsWith("/")) {
            cleaned = cleaned.substring(1);
        }
        Path resolved = nasRoot.resolve(cleaned).normalize();
        if (!resolved.startsWith(nasRoot)) {
            throw new IllegalArgumentException("Path traversal outside NAS root is not allowed.");
        }
        return resolved;
    }

    public Path resolveExistingRequiredInsideRoot(String userPath) throws IOException {
        Path resolved = resolveRequiredInsideRoot(userPath);
        Path realRoot = Files.exists(nasRoot) ? nasRoot.toRealPath(LinkOption.NOFOLLOW_LINKS) : nasRoot;
        Path realResolved = Files.exists(resolved) ? resolved.toRealPath(LinkOption.NOFOLLOW_LINKS) : resolved;
        if (!realResolved.startsWith(realRoot)) {
            throw new IllegalArgumentException("Symlink escape outside NAS root is not allowed.");
        }
        return realResolved;
    }

    public String toRelative(Path path) {
        return "/" + nasRoot.relativize(path.toAbsolutePath().normalize()).toString().replace("\\", "/");
    }
}
