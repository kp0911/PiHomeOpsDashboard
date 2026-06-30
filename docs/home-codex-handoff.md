# Home Codex Handoff

This document records the current Raspberry Pi deployment state for the Pi HomeOps NAS Dashboard.

## Current Status

The Raspberry Pi is now reachable from the home environment and through Tailscale.

Completed on the Pi:

- Tailscale device discovered as `raspberrypi`.
- Tailscale IPv4 address confirmed: `100.104.223.84`.
- SSH access over Tailscale is working.
- SSH key login from the Windows PC is working without a password.
- External drive mounted at `/mnt/nas`.
- Samba share is working from Windows at `\\100.104.223.84\nas`.
- Repository was cloned on the Pi.
- Web dashboard is reachable in a browser through Tailscale.

Important storage note:

- The currently attached external drive is not a 10TB disk.
- The detected drive is `/dev/sda1`, size about `1.8T`, label `One Touch`, filesystem `exfat`.
- It is mounted at `/mnt/nas` using UUID `008D-10AA`.

Current verified mount:

```text
/dev/sda1  1.9T  58G  1.8T  4%  /mnt/nas
```

Current verified mount detail:

```text
TARGET   SOURCE    FSTYPE OPTIONS
/mnt/nas /dev/sda1 exfat  rw,relatime,uid=1000,gid=1000,fmask=0002,dmask=0002,allow_utime=0020,iocharset=utf8,errors=remount-ro
```

## Access Model

The intended access model is Tailscale-first.

Primary dashboard URL:

```text
http://100.104.223.84:8088
```

Mobile and tablet access:

1. Install the Tailscale app.
2. Sign in with the same tailnet account.
3. Enable the Tailscale VPN.
4. Open `http://100.104.223.84:8088` in the browser.

The dashboard should not be exposed with router port forwarding.

## Raspberry Pi SSH

SSH key login from the Windows PC has been configured.

The client key was generated with:

```powershell
ssh-keygen -t ed25519 -C "pi-homeops"
```

The public key was installed in:

```bash
~/.ssh/authorized_keys
```

Expected SSH command:

```powershell
ssh pi@100.104.223.84
```

Passwordless SSH is confirmed working.

Recommended SSH hardening after confirming key access from a second terminal:

```text
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
```

Then restart SSH:

```bash
sudo systemctl restart ssh
```

## NAS Mount

Detected storage:

```text
NAME   SIZE TYPE MOUNTPOINTS
sda    1.8T disk
sda1   1.8T part /mnt/nas
```

Detected filesystem:

```text
/dev/sda1: LABEL="One Touch" UUID="008D-10AA" TYPE="exfat"
```

Expected `/etc/fstab` entry:

```text
UUID=008D-10AA /mnt/nas exfat defaults,nofail,uid=1000,gid=1000,umask=002 0 0
```

After editing `/etc/fstab`, reload systemd and mount:

```bash
sudo systemctl daemon-reload
sudo mount -a
```

Verify:

```bash
df -h /mnt/nas
findmnt /mnt/nas
```

Expected NAS directories:

```bash
mkdir -p /mnt/nas/uploads /mnt/nas/trash /mnt/nas/shared/public /mnt/nas/shared/private /mnt/nas/backups /mnt/nas/system/upload-temp
```

## Samba

Samba share is working from Windows.

If rebuilding from scratch, install the required packages:

```bash
sudo apt update
sudo apt install -y samba samba-common-bin
```

Create or update the Samba password:

```bash
sudo smbpasswd -a pi
```

Expected share in `/etc/samba/smb.conf`:

```ini
[nas]
   path = /mnt/nas/shared
   browseable = yes
   read only = no
   valid users = pi
   create mask = 0660
   directory mask = 0770
```

Restart Samba:

```bash
sudo systemctl restart smbd
sudo systemctl enable smbd
```

Windows access path:

```text
\\100.104.223.84\nas
```

PowerShell helper:

```powershell
explorer "\\100.104.223.84\nas"
```

## Application Deployment

The repository has been cloned on the Pi.

From the project directory:

```bash
cp .env.example .env
nano .env
```

Required production values:

```text
POSTGRES_PASSWORD
JWT_SECRET
ADMIN_USERNAME
ADMIN_PASSWORD
GRAFANA_ADMIN_PASSWORD
```

Generate a JWT secret:

```bash
openssl rand -hex 32
```

Start the stack:

```bash
docker compose up -d --build
```

Verify:

```bash
docker compose ps
curl http://localhost:8088/api/health
```

Expected health response:

```json
{"status":"ok"}
```

Open from a Tailscale-connected device:

```text
http://100.104.223.84:8088
```

## Current Security Notes

- Tailscale is the primary remote access layer.
- The current Docker Compose port mapping likely binds Nginx to all Pi interfaces unless changed.
- If the dashboard should be Tailscale-only at the host binding level, bind Nginx to the Tailscale IP:

```yaml
ports:
  - "100.104.223.84:8088:80"
```

Then recreate the stack:

```bash
docker compose down
docker compose up -d
```

Check listener binding:

```bash
sudo ss -tlnp | grep 8088
```

`0.0.0.0:8088` means the dashboard is reachable on all Pi network interfaces, including LAN.

## Remaining Work

Application features:

- Complete file manager frontend actions:
  - download
  - rename
  - delete
  - folder creation
  - folder navigation
  - preview
  - upload progress
- Add blocked IP admin APIs and frontend.
- Improve audit logging for downloads, previews, blocked IPs, and rate-limit events.
- Add Grafana dashboards for Pi and NAS metrics.
- Add PC agent monitoring in a later phase.

Operations:

- Confirm whether the intended final disk is the current 1.8T exFAT drive or a separate 10TB drive.
- If moving to a true 10TB Linux NAS disk, prefer ext4 and update `/etc/fstab`.
- Add backup automation for PostgreSQL, `.env`, and app config.
- Consider fail2ban for SSH.
- Consider binding dashboard only to Tailscale IP.

