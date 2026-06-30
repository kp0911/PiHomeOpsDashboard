# 집에서 따라하는 Raspberry Pi 설정 가이드

이 문서는 집에서 Raspberry Pi에 접속할 수 있을 때, `Pi HomeOps NAS Dashboard`를 실제 NAS 서버처럼 쓰기 위한 쉬운 절차입니다.

목표는 다음 4가지입니다.

1. Raspberry Pi에 접속한다.
2. Tailscale로 외부에서도 안전하게 접속한다.
3. 외장 HDD를 `/mnt/nas`로 연결한다.
4. Docker Compose로 대시보드를 실행한다.

포트포워딩은 하지 않습니다. 외부 접속은 Tailscale로 처리합니다.

## 현재 완료 상태

2026-06-29 기준으로 실제 Raspberry Pi에서 아래 작업이 완료되었습니다.

- Tailscale 장치 이름: `raspberrypi`
- Tailscale IP: `100.104.223.84`
- PC에서 SSH key 기반 비밀번호 없는 접속 완료
- 현재 외장 드라이브 `/dev/sda1`을 `/mnt/nas`에 마운트 완료
- 현재 드라이브는 10TB가 아니라 약 `1.8T` exFAT 드라이브입니다.
- 드라이브 라벨: `One Touch`
- UUID: `008D-10AA`
- Samba 공유 접속 완료: `\\100.104.223.84\nas`
- 웹 대시보드 접속 완료: `http://100.104.223.84:8088`

현재는 10TB 디스크가 아니라 1.8T exFAT 디스크로 검증 중입니다. 나중에 실제 10TB 디스크를 붙이면 `lsblk`, `blkid`, `df -h`로 대상 디스크를 다시 확인한 뒤 ext4 포맷 여부와 `/etc/fstab` 설정을 다시 결정해야 합니다.

## 전체 흐름

```text
1. Pi 찾기
2. SSH 접속 확인
3. Pi 업데이트
4. Tailscale 설치
5. SSH key 설정
6. 외장 HDD 확인 및 /mnt/nas 마운트
7. Samba 공유 설정
8. Docker 설치
9. 프로젝트 실행
10. 외부에서 Tailscale IP로 접속 확인
```

## 준비물

- 집에서 동작 중인 Raspberry Pi
- Raspberry Pi 전원
- 같은 공유기에 연결된 PC 또는 노트북
- 외장 HDD
- Tailscale 계정
- 이 프로젝트 repository

가능하면 처음 설정할 때는 Pi와 같은 Wi-Fi/LAN에 있는 PC에서 진행하세요.

## 1. Raspberry Pi IP 찾기

먼저 Pi가 집 네트워크에서 어떤 IP를 쓰는지 찾아야 합니다.

### 방법 A: hostname으로 접속 시도

PC 터미널에서:

```bash
ping raspberrypi.local
```

응답이 오면 SSH 접속도 시도합니다.

```bash
ssh pi@raspberrypi.local
```

### 방법 B: 공유기 관리자 페이지 확인

공유기 관리자 페이지에 들어가서 연결된 장치 목록을 봅니다.

찾아볼 이름:

```text
raspberrypi
pi
homeops
linux
알 수 없는 장치
```

Pi로 보이는 IP를 찾았다면:

```bash
ssh pi@<Pi-IP>
```

예:

```bash
ssh pi@192.168.0.25
```

### 방법 C: PC에서 arp 확인

Windows PowerShell:

```powershell
arp -a
```

Linux/macOS:

```bash
arp -a
```

이 방법은 후보를 찾는 용도입니다. 확실하지 않으면 공유기 페이지가 더 좋습니다.

## 2. Pi에 SSH 접속하기

Pi IP를 알았다면 접속합니다.

```bash
ssh pi@<Pi-IP>
```

예:

```bash
ssh pi@192.168.0.25
```

비밀번호를 모르면 다음 중 하나가 필요합니다.

- 예전에 설정한 비밀번호를 찾아본다.
- Pi에 모니터/키보드를 연결해 직접 로그인한다.
- SD 카드를 다른 PC에 연결해서 계정 복구 또는 OS 재설치를 한다.

접속에 성공하면 다음 단계로 갑니다.

## 3. Pi 업데이트

Pi에 접속한 상태에서 실행합니다.

```bash
sudo apt update
sudo apt full-upgrade -y
sudo reboot
```

재부팅 후 다시 접속합니다.

```bash
ssh pi@<Pi-IP>
```

성공 기준:

```text
SSH로 다시 접속 가능
```

## 4. Tailscale 설치

Tailscale은 포트포워딩 없이 외부에서 Pi에 접속하게 해줍니다.

Pi에서 실행:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

설치 확인:

```bash
tailscale version
```

Tailscale 시작:

```bash
sudo tailscale up
```

명령 실행 후 로그인 URL이 나옵니다. 그 URL을 PC 브라우저에서 열고 Tailscale 계정으로 로그인합니다.

로그인이 끝나면 Pi에서 Tailscale IP를 확인합니다.

```bash
tailscale ip -4
```

예:

```text
100.101.102.103
```

이 IP는 외부에서 Pi에 접속할 때 사용할 주소입니다.

성공 기준:

```bash
tailscale status
tailscale ip -4
```

결과에 Pi가 보이고 `100.x.x.x` 형태의 IP가 나오면 됩니다.

## 5. 외부 PC도 Tailscale에 로그인

집 밖에서 접속할 노트북이나 PC에도 Tailscale을 설치합니다.

Windows라면 Tailscale 앱을 설치하고 같은 계정으로 로그인합니다.

그 다음 외부 PC에서:

```bash
ssh pi@<Pi-Tailscale-IP>
```

예:

```bash
ssh pi@100.101.102.103
```

성공하면 포트포워딩 없이 외부 SSH 접속이 되는 상태입니다.

## 6. SSH key 설정

비밀번호 SSH보다 SSH key가 더 안전합니다.

외부에서 접속할 PC에서 실행:

```bash
ssh-keygen -t ed25519 -C "pi-homeops"
```

이미 SSH key가 있다면 새로 만들지 않아도 됩니다.

공개키를 Pi에 등록:

```bash
ssh-copy-id pi@<Pi-Tailscale-IP>
```

Windows에서 `ssh-copy-id`가 없다면 공개키 내용을 직접 복사합니다.

PC에서 공개키 확인:

```bash
cat ~/.ssh/id_ed25519.pub
```

출력된 한 줄을 복사해서 Pi의 아래 파일에 붙여넣습니다.

```bash
nano ~/.ssh/authorized_keys
```

권한 정리:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

SSH key 접속 확인:

```bash
ssh pi@<Pi-Tailscale-IP>
```

비밀번호 없이 접속되면 성공입니다.

## 7. SSH 비밀번호 로그인 끄기

중요: 이 단계는 SSH key 접속이 확실히 된 뒤에만 하세요.

Pi에서 설정 파일을 엽니다.

```bash
sudo nano /etc/ssh/sshd_config
```

아래 값을 찾거나 추가합니다.

```text
PasswordAuthentication no
PermitRootLogin no
```

SSH 재시작:

```bash
sudo systemctl restart ssh
```

새 터미널을 열어서 접속 테스트:

```bash
ssh pi@<Pi-Tailscale-IP>
```

성공 기준:

```text
SSH key로 접속 가능
비밀번호 로그인은 사용하지 않음
```

## 8. 외장 HDD 확인

외장 HDD를 Pi에 연결합니다.

디스크 목록 확인:

```bash
lsblk
```

예시:

```text
NAME        SIZE MOUNTPOINT
mmcblk0      32G
sda        9.1T
└─sda1     9.1T
```

여기서 `sda1`이 외장 HDD 파티션일 수 있습니다. 현재 검증된 Pi에서는 `/dev/sda1`이 약 `1.8T` exFAT 드라이브였습니다.

UUID 확인:

```bash
sudo blkid
```

주의:

```text
디스크 포맷 명령은 데이터를 삭제합니다.
대상 디스크가 의도한 외장 HDD인지 반드시 확인하세요.
```

## 9. HDD를 ext4로 포맷해야 하는 경우

이미 중요한 데이터가 있으면 포맷하지 마세요.

새 디스크이거나 지워도 되는 디스크라면 ext4를 권장합니다.

예시에서 대상이 `/dev/sda1`일 때:

```bash
sudo mkfs.ext4 /dev/sda1
```

다시 UUID 확인:

```bash
sudo blkid /dev/sda1
```

출력 예:

```text
/dev/sda1: UUID="abcd-1234-..." TYPE="ext4"
```

UUID 값을 복사해 둡니다.

## 10. `/mnt/nas`로 마운트

마운트 폴더 생성:

```bash
sudo mkdir -p /mnt/nas
```

임시 마운트:

```bash
sudo mount /dev/sda1 /mnt/nas
```

확인:

```bash
df -h /mnt/nas
findmnt /mnt/nas
```

성공하면 `/mnt/nas`가 의도한 외장 디스크로 보여야 합니다.

## 11. 재부팅 후에도 자동 마운트되게 설정

`fstab` 파일을 엽니다.

```bash
sudo nano /etc/fstab
```

아래 줄을 추가합니다. UUID는 실제 값으로 바꾸세요.

```text
UUID=<실제-UUID> /mnt/nas ext4 defaults,nofail 0 2
```

예:

```text
UUID=abcd-1234-5678 /mnt/nas ext4 defaults,nofail 0 2
```

설정 검증:

```bash
sudo mount -a
df -h /mnt/nas
```

현재 검증된 exFAT 드라이브의 예시는 아래와 같습니다.

```text
UUID=008D-10AA /mnt/nas exfat defaults,nofail,uid=1000,gid=1000,umask=002 0 0
```

`fstab` 수정 후 systemd가 이전 설정을 보고 있다는 안내가 나오면 아래를 실행합니다.

```bash
sudo systemctl daemon-reload
sudo mount -a
```

오류가 없으면 재부팅 테스트:

```bash
sudo reboot
```

재접속 후:

```bash
df -h /mnt/nas
```

성공 기준:

```text
재부팅 후에도 /mnt/nas가 자동으로 연결됨
```

## 12. NAS 폴더 구조 만들기

프로젝트에서 사용할 기본 폴더를 만듭니다.

```bash
sudo mkdir -p /mnt/nas/uploads
sudo mkdir -p /mnt/nas/trash
sudo mkdir -p /mnt/nas/shared/public
sudo mkdir -p /mnt/nas/shared/private
sudo mkdir -p /mnt/nas/backups/db
sudo mkdir -p /mnt/nas/backups/app-config
sudo mkdir -p /mnt/nas/system/upload-temp
```

소유자를 현재 사용자로 변경합니다.

```bash
sudo chown -R $USER:$USER /mnt/nas
```

확인:

```bash
ls -la /mnt/nas
```

## 13. Samba 설치

Samba는 Windows 탐색기에서 NAS를 네트워크 드라이브처럼 쓰기 위한 설정입니다.

설치:

```bash
sudo apt install -y samba samba-common-bin
```

Samba 비밀번호 설정:

```bash
sudo smbpasswd -a pi
```

`pi` 대신 실제 사용자명이 다르면 그 사용자명을 사용하세요.

## 14. Samba 공유 설정

설정 파일을 엽니다.

```bash
sudo nano /etc/samba/smb.conf
```

파일 맨 아래에 추가합니다.

```text
[nas]
   path = /mnt/nas/shared
   browseable = yes
   read only = no
   valid users = pi
   create mask = 0660
   directory mask = 0770
```

사용자명이 `pi`가 아니라면 `valid users`를 바꿉니다.

설정 검사:

```bash
testparm
```

Samba 재시작:

```bash
sudo systemctl restart smbd
```

Windows 탐색기에서 접속:

```text
\\<Pi-IP>\nas
```

예:

```text
\\192.168.0.25\nas
```

Tailscale IP로도 시도할 수 있습니다.

```text
\\<Pi-Tailscale-IP>\nas
```

현재 검증된 주소:

```text
\\100.104.223.84\nas
```

## 15. 방화벽 설정

초기 원칙:

```text
외부 인터넷 포트포워딩 없음
Tailscale로 SSH와 대시보드 접근
Samba는 가능하면 집 내부망에서만 사용
```

UFW 설치:

```bash
sudo apt install -y ufw
```

Tailscale 인터페이스 허용:

```bash
sudo ufw allow in on tailscale0
```

집 내부망에서 Samba 허용. 아래 대역은 예시입니다.

```bash
sudo ufw allow from 192.168.0.0/16 to any port 445 proto tcp
```

SSH를 LAN에서도 허용하려면:

```bash
sudo ufw allow from 192.168.0.0/16 to any port 22 proto tcp
```

방화벽 켜기:

```bash
sudo ufw enable
```

상태 확인:

```bash
sudo ufw status verbose
```

주의:

```text
집 공유기 내부망이 192.168.x.x가 아닐 수 있습니다.
공유기 IP 대역을 확인하고 맞게 바꾸세요.
```

## 16. Docker 설치

Pi에서 실행:

```bash
curl -fsSL https://get.docker.com | sh
```

현재 사용자를 docker 그룹에 추가:

```bash
sudo usermod -aG docker $USER
```

로그아웃 후 다시 로그인하거나 재부팅합니다.

```bash
sudo reboot
```

재접속 후 확인:

```bash
docker version
docker compose version
```

## 17. 프로젝트 받기

GitHub에 올려둔 경우:

```bash
git clone <repository-url>
cd "Pi HomeOps NAS Dashboard"
```

이미 파일을 복사해 둔 경우 해당 폴더로 이동합니다.

```bash
cd "Pi HomeOps NAS Dashboard"
```

## 18. `.env` 설정

예시 파일을 복사합니다.

```bash
cp .env.example .env
```

수정:

```bash
nano .env
```

반드시 바꿀 값:

```text
POSTGRES_PASSWORD
JWT_SECRET
ADMIN_PASSWORD
GRAFANA_ADMIN_PASSWORD
```

예시:

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=긴-비밀번호로-변경
JWT_SECRET=충분히-긴-랜덤-문자열로-변경
NAS_ROOT=/mnt/nas
```

운영에서는 기본 비밀번호를 그대로 쓰지 마세요.

## 19. 앱 실행

프로젝트 폴더에서:

```bash
docker compose up -d --build
```

상태 확인:

```bash
docker compose ps
```

헬스 체크:

```bash
curl http://localhost:8088/api/health
```

정상 응답:

```json
{"status":"ok"}
```

## 20. 브라우저에서 접속

집 내부망에서:

```text
http://<Pi-IP>:8088
```

외부에서 Tailscale로:

```text
http://<Pi-Tailscale-IP>:8088
```

현재 검증된 주소:

```text
http://100.104.223.84:8088
```

로그인:

```text
ID: .env의 ADMIN_USERNAME
비밀번호: .env의 ADMIN_PASSWORD
```

## 21. 실제 파일 기능 확인

대시보드에서 파일을 업로드한 뒤 Pi에서 확인합니다.

```bash
ls -lah /mnt/nas/uploads
```

파일 삭제를 테스트한 뒤:

```bash
find /mnt/nas/trash -maxdepth 3 -type f
```

성공 기준:

```text
업로드한 파일이 /mnt/nas/uploads에 있음
삭제한 파일이 /mnt/nas/trash/yyyy-mm-dd 아래로 이동함
```

## 22. 외부 접속 최종 확인

집 밖 네트워크 또는 휴대폰 핫스팟에서 테스트합니다.

외부 PC가 Tailscale에 로그인되어 있어야 합니다.

```bash
ssh pi@<Pi-Tailscale-IP>
```

브라우저:

```text
http://<Pi-Tailscale-IP>:8088
```

성공 기준:

```text
포트포워딩 없이 SSH 접속 가능
포트포워딩 없이 대시보드 접속 가능
```

## 문제 해결

### `raspberrypi.local`이 안 됨

공유기 관리자 페이지에서 Pi IP를 직접 확인하세요.

```bash
ssh pi@<Pi-IP>
```

### Tailscale IP가 안 나옴

```bash
sudo tailscale up
tailscale status
tailscale ip -4
```

로그인 URL 인증이 끝났는지 확인하세요.

### SSH key 접속이 안 됨

Pi에서 확인:

```bash
ls -la ~/.ssh
cat ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### `/mnt/nas`가 재부팅 후 사라짐

```bash
sudo mount -a
df -h /mnt/nas
cat /etc/fstab
sudo blkid
```

UUID가 맞는지 확인하세요.

### Docker 앱이 안 뜸

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 nginx
```

헬스 체크:

```bash
curl http://localhost:8088/api/health
```

### 포트가 이미 사용 중이라고 나옴

어떤 프로세스가 포트를 쓰는지 확인합니다.

```bash
sudo ss -tulpn
```

현재 프로젝트는 외부 접속용으로 `8088`을 사용합니다.

## 최종 체크리스트

- [ ] Pi IP를 알고 있다.
- [ ] Pi에 SSH 접속할 수 있다.
- [ ] Tailscale IP가 있다.
- [ ] 외부 PC에서 Tailscale IP로 SSH 접속 가능하다.
- [ ] SSH key 접속이 된다.
- [ ] 비밀번호 SSH 로그인을 껐다.
- [x] 현재 외장 HDD가 `/mnt/nas`에 마운트된다.
- [ ] 재부팅 후에도 `/mnt/nas`가 유지된다.
- [x] Samba로 Windows에서 공유 폴더에 접근 가능하다.
- [ ] Docker가 설치되어 있다.
- [ ] `.env`의 기본 비밀번호를 바꿨다.
- [ ] `docker compose up -d --build`가 성공했다.
- [x] `http://100.104.223.84:8088`로 대시보드에 접속된다.
- [ ] 파일 업로드가 `/mnt/nas/uploads`에 저장된다.
- [ ] 파일 삭제가 `/mnt/nas/trash`로 이동한다.

## 다음 단계

이 설정이 끝난 뒤 개발할 기능:

1. 파일 매니저 UI 완성
2. 차단 IP 관리 화면
3. Pi CPU/RAM/Disk/Temperature 모니터링
4. PC agent 모니터링
5. 백업 자동화
6. Grafana dashboard 완성
