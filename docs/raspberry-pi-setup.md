# Raspberry Pi Setup

## Current Constraint

The Raspberry Pi is not available in this environment. Its current IP address and password are unknown, so do not attempt Pi-side setup here. Complete the local Docker workflow first, then handle the steps below when physically at home.

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

```bash
ssh-keygen -t ed25519 -C "homeops-admin"
ssh-copy-id pi@raspberrypi.local
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

## 10TB HDD Mount

Identify the disk:

```bash
lsblk
sudo blkid
```

Format only after confirming the correct device:

```bash
sudo mkfs.ext4 /dev/sdX1
sudo mkdir -p /mnt/nas
sudo mount /dev/sdX1 /mnt/nas
sudo chown -R 1000:1000 /mnt/nas
```

Create the expected directories:

```bash
sudo mkdir -p /mnt/nas/uploads /mnt/nas/shared/public /mnt/nas/shared/private /mnt/nas/backups /mnt/nas/trash /mnt/nas/system/upload-temp
```

Add `/etc/fstab` by UUID:

```text
UUID=replace-with-real-uuid /mnt/nas ext4 defaults,nofail 0 2
```

Verify:

```bash
sudo mount -a
df -h /mnt/nas
```

## Samba

```bash
sudo apt install -y samba
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

## Backup Recommendations

- Back up PostgreSQL dumps into `/mnt/nas/backups/db`.
- Back up application config and `.env` into `/mnt/nas/backups/app-config`.
- Keep a second copy of important files outside the 10TB drive.
