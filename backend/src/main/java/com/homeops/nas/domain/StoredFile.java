package com.homeops.nas.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "files")
public class StoredFile {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID ownerId;

    @Column(nullable = false)
    private String parentPath;

    @Column(nullable = false)
    private String originalName;

    @Column(nullable = false)
    private String storedName;

    @Column(nullable = false, length = 1200)
    private String absolutePath;

    @Column(nullable = false, length = 1200)
    private String relativePath;

    private String mimeType;
    private long sizeBytes;
    private String sha256;

    @Column(nullable = false)
    private boolean directory;

    @Column(nullable = false)
    private boolean deleted;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    private Instant deletedAt;

    protected StoredFile() {
    }

    public StoredFile(UUID ownerId, String parentPath, String originalName, String storedName, String absolutePath,
                      String relativePath, String mimeType, long sizeBytes, String sha256, boolean directory) {
        this.ownerId = ownerId;
        this.parentPath = parentPath;
        this.originalName = originalName;
        this.storedName = storedName;
        this.absolutePath = absolutePath;
        this.relativePath = relativePath;
        this.mimeType = mimeType;
        this.sizeBytes = sizeBytes;
        this.sha256 = sha256;
        this.directory = directory;
    }

    public UUID getId() { return id; }
    public UUID getOwnerId() { return ownerId; }
    public String getParentPath() { return parentPath; }
    public String getOriginalName() { return originalName; }
    public String getStoredName() { return storedName; }
    public String getAbsolutePath() { return absolutePath; }
    public String getRelativePath() { return relativePath; }
    public String getMimeType() { return mimeType; }
    public long getSizeBytes() { return sizeBytes; }
    public String getSha256() { return sha256; }
    public boolean isDirectory() { return directory; }
    public boolean isDeleted() { return deleted; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getDeletedAt() { return deletedAt; }

    public void rename(String newName, String newAbsolutePath, String newRelativePath, Instant now) {
        originalName = newName;
        storedName = newName;
        absolutePath = newAbsolutePath;
        relativePath = newRelativePath;
        updatedAt = now;
    }

    public void move(String newParentPath, String newAbsolutePath, String newRelativePath, Instant now) {
        parentPath = newParentPath;
        absolutePath = newAbsolutePath;
        relativePath = newRelativePath;
        updatedAt = now;
    }

    public void markDeleted(String trashAbsolutePath, String trashRelativePath, Instant now) {
        absolutePath = trashAbsolutePath;
        relativePath = trashRelativePath;
        deleted = true;
        deletedAt = now;
        updatedAt = now;
    }
}
