package com.homeops.nas.service;

import com.homeops.nas.AppConfig;
import com.homeops.nas.domain.Role;
import com.homeops.nas.domain.UserAccount;
import com.homeops.nas.repo.UserAccountRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class BootstrapAdmin implements ApplicationRunner {
    private final AppConfig appConfig;
    private final PasswordEncoder passwordEncoder;
    private final UserAccountRepository userAccountRepository;

    public BootstrapAdmin(AppConfig appConfig, PasswordEncoder passwordEncoder, UserAccountRepository userAccountRepository) {
        this.appConfig = appConfig;
        this.passwordEncoder = passwordEncoder;
        this.userAccountRepository = userAccountRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!userAccountRepository.existsByUsername(appConfig.adminUsername())) {
            userAccountRepository.save(new UserAccount(
                    appConfig.adminUsername(),
                    passwordEncoder.encode(appConfig.adminPassword()),
                    Role.ADMIN
            ));
        }
    }
}
