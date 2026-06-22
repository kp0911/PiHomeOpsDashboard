package com.homeops.nas.service;

import com.homeops.nas.domain.AuditEventType;
import com.homeops.nas.domain.StoredFile;
import com.homeops.nas.repo.StoredFileRepository;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class FileManagerService {
    private static final DateTimeFormatter TRASH_DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneOffset.UTC);

    private final NasPathService nasPathService;
    private final StoredFileRepository storedFileRepository;
    private final AuditService auditService;

    public FileManagerService(NasPathService nasPathService, StoredFileRepository storedFileRepository, AuditService auditService) {
        this.nasPathService = nasPathService;
        this.storedFileRepository = storedFileRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<StoredFile> list(String path) {
        String parent = normalizeApiPath(path);
        return storedFileRepository.findByParentPathAndDeletedFalseOrderByDirectoryDescOriginalNameAsc(parent);
    }

    @Transactional
    public StoredFile createFolder(UUID userId, String parentPath, String name) throws IOException {
        String safeName = safeName(name);
        Path parent = nasPathService.resolveRequiredInsideRoot(parentPath);
        Files.createDirectories(parent);
        Path folder = nasPathService.resolveRequiredInsideRoot(normalizeApiPath(parentPath) + "/" + safeName);
        Files.createDirectory(folder);
        StoredFile saved = storedFileRepository.save(new StoredFile(
                userId,
                normalizeApiPath(parentPath),
                safeName,
                safeName,
                folder.toString(),
                nasPathService.toRelative(folder),
                "inode/directory",
                0,
                null,
                true
        ));
        auditService.record(userId, AuditEventType.FILE_UPLOAD, null, null, saved.getRelativePath(), "Folder created");
        return saved;
    }

    @Transactional
    public StoredFile upload(UUID userId, MultipartFile file) throws Exception {
        Files.createDirectories(nasPathService.resolveRequiredInsideRoot("/uploads"));
        String original = safeName(file.getOriginalFilename() == null ? "upload.bin" : file.getOriginalFilename());
        String stored = UUID.randomUUID() + "-" + original;
        Path destination = nasPathService.resolveRequiredInsideRoot("/uploads/" + stored);

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long size;
        try (InputStream raw = file.getInputStream();
             DigestInputStream in = new DigestInputStream(raw, digest)) {
            size = Files.copy(in, destination, StandardCopyOption.REPLACE_EXISTING);
        }
        String sha256 = HexFormat.of().formatHex(digest.digest());
        StoredFile saved = storedFileRepository.save(new StoredFile(
                userId,
                "/uploads",
                original,
                stored,
                destination.toString(),
                nasPathService.toRelative(destination),
                file.getContentType(),
                size,
                sha256,
                false
        ));
        auditService.record(userId, AuditEventType.FILE_UPLOAD, null, null, saved.getRelativePath(), "Uploaded " + size + " bytes");
        return saved;
    }

    @Transactional(readOnly = true)
    public DownloadFile download(UUID fileId) throws IOException {
        StoredFile stored = storedFileRepository.findById(fileId).orElseThrow();
        if (stored.isDeleted() || stored.isDirectory()) {
            throw new IllegalArgumentException("File is not downloadable.");
        }
        Path path = nasPathService.resolveExistingRequiredInsideRoot(stored.getRelativePath());
        Resource resource = new UrlResource(path.toUri());
        return new DownloadFile(stored, resource);
    }

    @Transactional
    public StoredFile rename(UUID userId, UUID fileId, String newName) throws IOException {
        StoredFile stored = storedFileRepository.findById(fileId).orElseThrow();
        String safeName = safeName(newName);
        Path current = nasPathService.resolveExistingRequiredInsideRoot(stored.getRelativePath());
        Path target = current.resolveSibling(safeName).normalize();
        if (!target.startsWith(nasPathService.nasRoot())) {
            throw new IllegalArgumentException("Rename target is outside NAS root.");
        }
        Files.move(current, target, StandardCopyOption.ATOMIC_MOVE);
        stored.rename(safeName, target.toString(), nasPathService.toRelative(target), Instant.now());
        auditService.record(userId, AuditEventType.FILE_RENAME, null, null, stored.getRelativePath(), "Renamed file");
        return stored;
    }

    @Transactional
    public StoredFile moveToTrash(UUID userId, UUID fileId) throws IOException {
        StoredFile stored = storedFileRepository.findById(fileId).orElseThrow();
        Path current = nasPathService.resolveExistingRequiredInsideRoot(stored.getRelativePath());
        Path trashDir = nasPathService.resolveRequiredInsideRoot("/trash/" + TRASH_DAY.format(Instant.now()));
        Files.createDirectories(trashDir);
        Path target = trashDir.resolve(UUID.randomUUID() + "-" + current.getFileName()).normalize();
        if (!target.startsWith(nasPathService.nasRoot())) {
            throw new IllegalArgumentException("Trash target is outside NAS root.");
        }
        Files.move(current, target, StandardCopyOption.REPLACE_EXISTING);
        stored.markDeleted(target.toString(), nasPathService.toRelative(target), Instant.now());
        auditService.record(userId, AuditEventType.FILE_DELETE, null, null, stored.getRelativePath(), "Moved to trash");
        return stored;
    }

    public static String normalizeApiPath(String path) {
        if (path == null || path.isBlank()) {
            return "/";
        }
        String normalized = path.replace("\\", "/");
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }
        while (normalized.contains("//")) {
            normalized = normalized.replace("//", "/");
        }
        if (normalized.length() > 1 && normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private static String safeName(String name) {
        if (name.contains("..") || name.contains("/") || name.contains("\\") || name.contains("\0")) {
            throw new IllegalArgumentException("Invalid file name.");
        }
        String safe = Path.of(name).getFileName().toString();
        if (safe.isBlank()) {
            throw new IllegalArgumentException("Invalid file name.");
        }
        return safe;
    }

    public record DownloadFile(StoredFile storedFile, Resource resource) {
    }
}
