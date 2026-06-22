package com.homeops.nas.repo;

import com.homeops.nas.domain.StoredFile;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StoredFileRepository extends JpaRepository<StoredFile, UUID> {
    List<StoredFile> findByParentPathAndDeletedFalseOrderByDirectoryDescOriginalNameAsc(String parentPath);
}
