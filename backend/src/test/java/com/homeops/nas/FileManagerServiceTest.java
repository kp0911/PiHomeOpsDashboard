package com.homeops.nas;

import com.homeops.nas.domain.StoredFile;
import com.homeops.nas.service.FileManagerService;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FileManagerServiceTest {
    @Test
    void renameKeepsExistingExtensionWhenRequestedNameHasNoExtension() {
        StoredFile stored = new StoredFile(
                UUID.randomUUID(),
                "/uploads",
                "abc.png",
                "abc.png",
                "/mnt/nas/uploads/abc.png",
                "/uploads/abc.png",
                "image/png",
                10,
                null,
                false
        );

        assertThat(FileManagerService.safeRename(stored, "test")).isEqualTo("test.png");
    }

    @Test
    void renameAllowsExplicitExtensionChange() {
        StoredFile stored = new StoredFile(
                UUID.randomUUID(),
                "/uploads",
                "abc.png",
                "abc.png",
                "/mnt/nas/uploads/abc.png",
                "/uploads/abc.png",
                "image/png",
                10,
                null,
                false
        );

        assertThat(FileManagerService.safeRename(stored, "test.jpg")).isEqualTo("test.jpg");
    }

    @Test
    void renameRestoresExtensionFromMimeTypeWhenCurrentNameAlreadyLostExtension() {
        StoredFile stored = new StoredFile(
                UUID.randomUUID(),
                "/uploads",
                "test",
                "test",
                "/mnt/nas/uploads/test",
                "/uploads/test",
                "image/png",
                10,
                null,
                false
        );

        assertThat(FileManagerService.safeRename(stored, "renamed")).isEqualTo("renamed.png");
    }
}
