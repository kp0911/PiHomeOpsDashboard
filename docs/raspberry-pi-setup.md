# Raspberry Pi Setup

## Current Deployment Snapshot

The Raspberry Pi is now reachable through Tailscale.

- Tailscale device name: `raspberrypi`
- Tailscale IPv4: `100.104.223.84`
- SSH key login from the Windows PC is working.
- NAS mount point: `/mnt/nas`
- Current external drive: `/dev/sda1`, about `1.8T`, label `One Touch`, filesystem `exfat`, UUID `008D-10AA`
- Samba share is reachable from Windows at `\\100.104.223.84\nas`.
- Dashboard is reachable through Tailscale at `http://100.104.223.84:8088`.

The originally planned 10TB disk is not the disk currently attached. Confirm the final storage device before formatting or migrating data.

## Access Recovery Checklist

1. Find the Raspberry Pi on the home network:

   ```bash
   arp -a
   ping raspberrypi.local
   ```

2. Check the router admin page for a connected device named `raspberrypi`, `pi`, or a custom hostname.

3. If Tailscale was already installed, sign in to the Tailscale admin console and check the device list for the Pi tailnet IP.

4. If the password is not recoverable, use physical access:

   - Connect keyboard/monitor, or mount the SD card from another machine.
   - Reset credentials or re-image Raspberry Pi OS 64-bit Lite if needed.
   - Prefer SSH key login after recovery.

## Base OS

Install Raspberry Pi OS 64-bit Lite. Enable SSH during imaging if possible.

```bash
sudo apt update
sudo apt full-upgrade -y
sudo reboot
```

## SSH Key Setup

From the client PC:

```powershell
ssh-keygen -t ed25519 -C "homeops-admin"
```

On Windows, print the public key:

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub
```

On the Pi, add the public key to:

```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

Test key login:

```powershell
ssh pi@100.104.223.84
```

After confirming key login works, disable password SSH login:

```bash
sudo nano /etc/ssh/sshd_config
```

Set:

```text
PasswordAuthentication no
PermitRootLogin no
```

Then:

```bash
sudo systemctl restart ssh
```

## Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh
tailscale ip -4
```

Use the Tailscale IP for SSH and dashboard access. Avoid internet port forwarding at the beginning.

Current verified Tailscale IP:

```text
100.104.223.84
```

## NAS Drive Mount

Identify the disk:

```bash
lsblk
sudo blkid
```

Format only after confirming the correct device. Do not format an existing data drive unless you intend to erase it.

For a future Linux-native NAS disk, ext4 is preferred:

```bash
sudo mkfs.ext4 /dev/sdX1
sudo mkdir -p /mnt/nas
sudo mount /dev/sdX1 /mnt/nas
sudo chown -R 1000:1000 /mnt/nas
```

For an ext4 disk, add `/etc/fstab` by UUID:

```text
UUID=replace-with-real-uuid /mnt/nas ext4 defaults,nofail 0 2
```

Current verified drive is exFAT, so the active `/etc/fstab` style is:

```text
UUID=008D-10AA /mnt/nas exfat defaults,nofail,uid=1000,gid=1000,umask=002 0 0
```

After editing `/etc/fstab`, reload systemd and mount:

```bash
sudo systemctl daemon-reload
sudo mount -a
```

Create the expected directories:

```bash
sudo mkdir -p /mnt/nas/uploads /mnt/nas/shared/public /mnt/nas/shared/private /mnt/nas/backups /mnt/nas/trash /mnt/nas/system/upload-temp
```

Verify:

```bash
sudo mount -a
df -h /mnt/nas
findmnt /mnt/nas
```

## Samba

```bash
sudo apt install -y samba samba-common-bin
sudo smbpasswd -a pi
```

Example `/etc/samba/smb.conf` share:

```text
[nas]
   path = /mnt/nas/shared
   browseable = yes
   read only = no
   valid users = pi
   create mask = 0660
   directory mask = 0770
```

Restart:

```bash
sudo systemctl restart smbd
sudo systemctl enable smbd
```

Windows access path:

```text
\\100.104.223.84\nas
```

## Firewall

Start with Tailscale-only access where practical:

```bash
sudo apt install -y ufw
sudo ufw allow in on tailscale0
sudo ufw allow from 192.168.0.0/16 to any port 445 proto tcp
sudo ufw enable
```

Adjust the LAN CIDR to match the actual home network.

## Docker Compose Startup

Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

After logging out and back in:

```bash
docker compose up -d --build
```

Use a real `.env` file with strong values before running on the Pi.

Generate a strong JWT secret:

```bash
openssl rand -hex 32
```

Verify:

```bash
docker compose ps
curl http://localhost:8088/api/health
```

Open from a Tailscale-connected browser:

```text
http://100.104.223.84:8088
```

## Backup Recommendations

- Back up PostgreSQL dumps into `/mnt/nas/backups/db`.
- Back up application config and `.env` into `/mnt/nas/backups/app-config`.
- Keep a second copy of important files outside the NAS drive.
