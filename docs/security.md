# Security Notes

## Assumptions

- The dashboard is intended for personal use.
- Initial access should be through Tailscale, not direct internet exposure.
- SSH should use keys only after access recovery is complete.
- `/mnt/nas` is the only allowed file root.

## Implemented Foundations

- Passwords are hashed with BCrypt.
- APIs are protected by JWT except login and health check.
- Login success and failure are written to audit logs.
- Accounts lock temporarily after repeated failed logins.
- File APIs normalize paths and reject traversal outside the NAS root.
- Delete moves files to `/mnt/nas/trash` instead of permanently deleting them.

## Hardening Steps Before Real Deployment

1. Replace all default passwords and secrets in `.env`.
2. Keep the dashboard reachable only through Tailscale or a trusted LAN.
3. Disable SSH password login after key login is confirmed.
4. Keep Raspberry Pi OS and containers updated.
5. Review Samba permissions before sharing private folders.
6. Add fail2ban for SSH.
7. Enable regular database and config backups.

## Known Gaps In This Phase

- TOTP 2FA is not implemented yet.
- Redis-backed IP rate limiting and blocked IP enforcement are scaffold targets for the next phase.
- Prometheus/Grafana are configured as services, but polished dashboards are not included yet.
- PC agent monitoring is intentionally excluded from Phase 1.
