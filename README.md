# Pi HomeOps NAS Dashboard

Personal Raspberry Pi NAS and security dashboard for a 10TB external drive.

This repository is scoped as a secure NAS/file-manager foundation first:

- Spring Boot backend with login, role checks, audit logs, and safe file APIs.
- React + Vite frontend with login, dashboard, file manager, and audit pages.
- Docker Compose local stack with PostgreSQL, Redis, backend, frontend, Nginx, Prometheus, Grafana, and node_exporter.
- Raspberry Pi setup documentation for SSH, Tailscale, HDD mount, Samba, and hardening.

## Current Hardware Constraint

The Raspberry Pi is not available in the current environment. Its current IP address and password are also not known, so Raspberry Pi OS, SSH, Tailscale, HDD mount, and Samba setup cannot be performed here.

Use this repository locally with Docker Compose first. When physically at home with the Pi, follow [docs/raspberry-pi-setup.md](docs/raspberry-pi-setup.md) to recover access and apply the Pi-specific steps.

## Local Development

```powershell
docker compose up --build
```

The compose stack bind-mounts `./storage-sim` as the simulated NAS root.

Default local settings are documented in `.env.example`.

## Scope Exclusions

Do not add weather, memo, todo, exercise, or lifestyle tracking features. This project is focused on NAS, security, file management, monitoring, and remote administration.
