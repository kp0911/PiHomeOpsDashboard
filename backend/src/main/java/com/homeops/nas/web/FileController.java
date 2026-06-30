package com.homeops.nas.web;

import com.homeops.nas.domain.StoredFile;
import com.homeops.nas.service.FileManagerService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/files")
public class FileController {
    private final FileManagerService fileManagerService;

    public FileController(FileManagerService fileManagerService) {
        this.fileManagerService = fileManagerService;
    }

    @GetMapping
    public List<StoredFile> list(@RequestParam(defaultValue = "/") String path) {
        return fileManagerService.list(path);
    }

    @GetMapping("/search")
    public List<StoredFile> search(@RequestParam String query) {
        return fileManagerService.search(query);
    }

    @PostMapping("/folder")
    public StoredFile folder(@Valid @RequestBody CreateFolderRequest body, Authentication authentication) throws Exception {
        return fileManagerService.createFolder(userId(authentication), body.parentPath(), body.name());
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public StoredFile upload(@RequestParam(defaultValue = "/uploads") String path,
                             @RequestPart("file") MultipartFile file,
                             Authentication authentication) throws Exception {
        return fileManagerService.upload(userId(authentication), path, file);
    }

    @GetMapping("/download/{fileId}")
    public ResponseEntity<?> download(@PathVariable UUID fileId) throws Exception {
        var file = fileManagerService.download(fileId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.storedFile().getOriginalName() + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(file.resource());
    }

    @PatchMapping("/rename/{fileId}")
    public StoredFile rename(@PathVariable UUID fileId, @Valid @RequestBody RenameRequest body, Authentication authentication) throws Exception {
        return fileManagerService.rename(userId(authentication), fileId, body.name());
    }

    @DeleteMapping("/{fileId}")
    public StoredFile delete(@PathVariable UUID fileId, Authentication authentication) throws Exception {
        return fileManagerService.moveToTrash(userId(authentication), fileId);
    }

    @GetMapping("/preview/{fileId}")
    public ResponseEntity<?> preview(@PathVariable UUID fileId) throws Exception {
        var file = fileManagerService.download(fileId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.storedFile().getMimeType() == null ? "application/octet-stream" : file.storedFile().getMimeType()))
                .body(file.resource());
    }

    private UUID userId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }

    public record CreateFolderRequest(@NotBlank String parentPath, @NotBlank String name) {
    }

    public record RenameRequest(@NotBlank String name) {
    }
}
