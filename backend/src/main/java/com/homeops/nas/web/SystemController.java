package com.homeops.nas.web;

import com.homeops.nas.service.NasPathService;
import java.io.IOException;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/system")
public class SystemController {
    private final NasPathService nasPathService;

    public SystemController(NasPathService nasPathService) {
        this.nasPathService = nasPathService;
    }

    @GetMapping("/storage")
    public StorageStats storage() throws IOException {
        Path root = nasPathService.nasRoot();
        Files.createDirectories(root);
        FileStore store = Files.getFileStore(root);
        long total = store.getTotalSpace();
        long available = store.getUsableSpace();
        long used = total - available;
        double usedPercent = total == 0 ? 0 : (used * 100.0) / total;
        return new StorageStats(root.toString(), total, used, available, usedPercent);
    }

    public record StorageStats(String path, long totalBytes, long usedBytes, long availableBytes, double usedPercent) {
    }
}
