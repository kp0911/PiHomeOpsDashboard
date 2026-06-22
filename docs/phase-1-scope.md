# Phase 1 Scope

Phase 1 creates the secure NAS file-manager foundation:

- Monorepo directories: `backend`, `frontend`, `agent`, `infra`, `docs`.
- Spring Boot backend with authentication, audit logs, and file manager APIs.
- React frontend with login, file manager, and audit log pages.
- Docker Compose local stack with a simulated NAS bind mount.
- Raspberry Pi setup documentation.

Out of scope for this phase:

- PC agent monitoring.
- Finished Grafana dashboards.
- TOTP 2FA.
- Direct Raspberry Pi configuration from this environment.

The Raspberry Pi setup cannot be executed until the hardware is available and its network access is recovered.
