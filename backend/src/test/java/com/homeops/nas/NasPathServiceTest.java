package com.homeops.nas;

import com.homeops.nas.service.NasPathService;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NasPathServiceTest {
    @Test
    void rejectsPathTraversalOutsideNasRoot() {
        NasPathService service = new NasPathService(new AppConfig("/mnt/nas", "secretsecretsecretsecretsecretsecret", "admin", "pw"));

        assertThatThrownBy(() -> service.resolveRequiredInsideRoot("../../etc/passwd"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
