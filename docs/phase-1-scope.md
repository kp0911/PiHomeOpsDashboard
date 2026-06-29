# Phase 1 Scope

Phase 1 creates the secure NAS file-manager foundation:

- Monorepo directories: `backend`, `frontend`, `agent`, `infra`, `docs`.
- Spring Boot backend with authentication, audit logs, and file manager APIs.
- React frontend with login, file manager, and audit log pages.
- Docker Compose local stack with a simulated NAS bind mount.
- Raspberry Pi setup documentation.

Out of scope for the original local-only phase:

- PC agent monitoring.
- Finished Grafana dashboards.
- TOTP 2FA.
- Finished production hardening of the Raspberry Pi deployment.

## Raspberry Pi Follow-up Status

Raspberry Pi access has since been recovered from the home environment.

- Tailscale IP: `100.104.223.84`
- SSH key login is working.
- `/mnt/nas` is mounted from the currently attached 1.8T exFAT external drive.
- Samba is reachable from Windows at `\\100.104.223.84\nas`.
- The dashboard is reachable through Tailscale at `http://100.104.223.84:8088`.

The originally planned 10TB disk is not the currently attached disk. Treat the current 1.8T exFAT drive as the active validation drive until the final storage device is confirmed.
