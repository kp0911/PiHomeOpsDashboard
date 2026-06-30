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
        ensureUploadsScope(parent);
        return storedFileRepository.findByParentPathAndDeletedFalseOrderByDirectoryDescOriginalNameAsc(parent);
    }

    @Transactional(readOnly = true)
    public List<StoredFile> search(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        return storedFileRepository.findTop100ByDeletedFalseAndOriginalNameContainingIgnoreCaseOrderByDirectoryDescOriginalNameAsc(query.trim())
                .stream()
                .filter(file -> file.getRelativePath().equals("/uploads") || file.getRelativePath().startsWith("/uploads/"))
                .toList();
    }

    @Transactional
    public StoredFile createFolder(UUID userId, String parentPath, String name) throws IOException {
        String safeName = safeName(name);
        String parentApiPath = normalizeApiPath(parentPath);
        ensureUploadsScope(parentApiPath);
        Path parent = nasPathService.resolveRequiredInsideRoot(parentPath);
        Files.createDirectories(parent);
        Path folder = nasPathService.resolveRequiredInsideRoot(parentApiPath + "/" + safeName);
        Files.createDirectory(folder);
        StoredFile saved = storedFileRepository.save(new StoredFile(
                userId,
                parentApiPath,
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
    public StoredFile upload(UUID userId, String parentPath, MultipartFile file) throws Exception {
        String parentApiPath = normalizeApiPath(parentPath == null || parentPath.isBlank() ? "/uploads" : parentPath);
        ensureUploadsScope(parentApiPath);
        Files.createDirectories(nasPathService.resolveRequiredInsideRoot(parentApiPath));
        String original = safeName(file.getOriginalFilename() == null ? "upload.bin" : file.getOriginalFilename());
        String stored = UUID.randomUUID() + "-" + original;
        Path destination = nasPathService.resolveRequiredInsideRoot(parentApiPath + "/" + stored);

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long size;
        try (InputStream raw = file.getInputStream();
             DigestInputStream in = new DigestInputStream(raw, digest)) {
            size = Files.copy(in, destination, StandardCopyOption.REPLACE_EXISTING);
        }
        String sha256 = HexFormat.of().formatHex(digest.digest());
        StoredFile saved = storedFileRepository.save(new StoredFile(
                userId,
                parentApiPath,
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
        String safeName = safeRename(stored, newName);
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
    public StoredFile move(UUID userId, UUID fileId, String targetParentPath) throws IOException {
        StoredFile stored = storedFileRepository.findById(fileId).orElseThrow();
        if (stored.isDeleted()) {
            throw new IllegalArgumentException("Deleted files cannot be moved.");
        }

        String targetParentApiPath = normalizeApiPath(targetParentPath);
        ensureUploadsScope(targetParentApiPath);
        if (stored.isDirectory() && (targetParentApiPath.equals(stored.getRelativePath()) || targetParentApiPath.startsWith(stored.getRelativePath() + "/"))) {
            throw new IllegalArgumentException("A folder cannot be moved into itself.");
        }
        if (targetParentApiPath.equals(stored.getParentPath())) {
            return stored;
        }

        Path current = nasPathService.resolveExistingRequiredInsideRoot(stored.getRelativePath());
        Path targetParent = nasPathService.resolveRequiredInsideRoot(targetParentApiPath);
        Files.createDirectories(targetParent);
        Path target = targetParent.resolve(current.getFileName()).normalize();
        if (!target.startsWith(nasPathService.nasRoot())) {
            throw new IllegalArgumentException("Move target is outside NAS root.");
        }
        if (Files.exists(target)) {
            throw new IllegalArgumentException("A file or folder with the same stored name already exists in the target folder.");
        }

        String oldRelativePath = stored.getRelativePath();
        String oldAbsolutePath = stored.getAbsolutePath();
        Files.move(current, target, StandardCopyOption.ATOMIC_MOVE);

        Instant now = Instant.now();
        String newRelativePath = nasPathService.toRelative(target);
        stored.move(targetParentApiPath, target.toString(), newRelativePath, now);

        if (stored.isDirectory()) {
            List<StoredFile> children = storedFileRepository.findByDeletedFalseAndRelativePathStartingWith(oldRelativePath + "/");
            for (StoredFile child : children) {
                String childRelativePath = newRelativePath + child.getRelativePath().substring(oldRelativePath.length());
                String childAbsolutePath = target.toString() + child.getAbsolutePath().substring(oldAbsolutePath.length());
                String childParentPath = parentPathOf(childRelativePath);
                child.move(childParentPath, childAbsolutePath, childRelativePath, now);
            }
        }

        auditService.record(userId, AuditEventType.FILE_RENAME, null, null, stored.getRelativePath(), "Moved file");
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

    private static void ensureUploadsScope(String apiPath) {
        if (!apiPath.equals("/uploads") && !apiPath.startsWith("/uploads/")) {
            throw new IllegalArgumentException("File manager access is limited to /uploads.");
        }
    }

    public static String safeRename(StoredFile stored, String requestedName) {
        String safe = safeName(requestedName);
        if (stored.isDirectory() || hasExtension(safe)) {
            return safe;
        }

        String currentName = stored.getOriginalName();
        int dot = currentName.lastIndexOf('.');
        if (dot <= 0 || dot == currentName.length() - 1) {
            return safe + extensionFromMimeType(stored.getMimeType());
        }
        return safe + currentName.substring(dot);
    }

    private static boolean hasExtension(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 && dot < name.length() - 1;
    }

    private static String parentPathOf(String relativePath) {
        int slash = relativePath.lastIndexOf('/');
        if (slash <= 0) {
            return "/";
        }
        return relativePath.substring(0, slash);
    }

    private static String extensionFromMimeType(String mimeType) {
        if (mimeType == null) {
            return "";
        }
        return switch (mimeType) {
            case "image/png" -> ".png";
            case "image/jpeg" -> ".jpg";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            case "image/svg+xml" -> ".svg";
            case "video/mp4" -> ".mp4";
            case "text/plain" -> ".txt";
            case "application/pdf" -> ".pdf";
            case "application/json" -> ".json";
            default -> "";
        };
    }

    public record DownloadFile(StoredFile storedFile, Resource resource) {
    }
}
