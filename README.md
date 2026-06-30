# Pi HomeOps NAS Dashboard

Personal Raspberry Pi NAS and security dashboard for an external drive.

This repository is scoped as a secure NAS/file-manager foundation first:

- Spring Boot backend with login, role checks, audit logs, and safe file APIs.
- React + Vite frontend with login, dashboard, file manager, and audit pages.
- Docker Compose local stack with PostgreSQL, Redis, backend, frontend, Nginx, Prometheus, Grafana, and node_exporter.
- Raspberry Pi setup documentation for SSH, Tailscale, HDD mount, Samba, and hardening.

## Current Raspberry Pi Status

The Raspberry Pi has been reached from the home environment and the initial real-device setup is in progress.

- Tailscale IP: `100.104.223.84`
- SSH key login is working.
- `/mnt/nas` is mounted from the currently attached external drive.
- Samba is reachable from Windows at `\\100.104.223.84\nas`.
- The dashboard is reachable through Tailscale at `http://100.104.223.84:8088`.

Storage note: the currently attached drive is about `1.8T`, exFAT, label `One Touch`, not the originally planned 10TB disk.

See [docs/raspberry-pi-setup.md](docs/raspberry-pi-setup.md) and [docs/home-codex-handoff.md](docs/home-codex-handoff.md) for the live setup notes.

## Local Development

```powershell
docker compose up --build
```

The compose stack bind-mounts `./storage-sim` as the simulated NAS root.

Default local settings are documented in `.env.example`.

## Raspberry Pi Access

Use Tailscale-connected devices to access the deployed dashboard:

```text
http://100.104.223.84:8088
```

For mobile and tablet access, install Tailscale, sign in to the same tailnet, enable the VPN, then open the same URL in the browser.

## Scope Exclusions

Do not add weather, memo, todo, exercise, or lifestyle tracking features. This project is focused on NAS, security, file management, monitoring, and remote administration.
