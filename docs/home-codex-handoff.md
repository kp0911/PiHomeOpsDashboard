# Home Codex Handoff

이 문서는 집에서 라즈베리파이와 10TB 외장 HDD에 접근할 수 있을 때, 집의 Codex에게 그대로 전달하기 위한 인계 문서입니다.

## 현재 결론

현재 환경에서는 라즈베리파이가 없고, 집에서 동작 중인 Pi의 IP와 비밀번호도 모르는 상태입니다. 따라서 이 환경에서 가능한 작업은 로컬 Docker 기반의 애플리케이션 골격, 인증, 파일 매니저 기초, 보안 기반, 문서화까지입니다.

아직 완료되지 않은 핵심은 실제 Raspberry Pi 접근 복구, `/mnt/nas` 실제 마운트, Samba/Tailscale/SSH 실기 설정, Pi 지표 수집, PC agent 모니터링, 운영 보안 강화입니다.

## 현재 구현 완료

### 저장소 구조

- `backend`: Spring Boot 3 + Java 21 백엔드
- `frontend`: React + Vite + TypeScript 프론트엔드
- `agent`: PC agent를 넣기 위한 자리만 생성
- `infra`: Nginx, Prometheus, Grafana 설정
- `docs`: Pi 설정, 보안, Phase 1, 이 인계 문서
- `storage-sim`: 로컬에서 `/mnt/nas`를 흉내 내는 bind mount 대상

### 백엔드

- Spring Boot 3 실행 구조
- PostgreSQL JPA 연결
- Redis 연결
- Actuator health/prometheus endpoint 노출 설정
- 기본 관리자 계정 bootstrap
- BCrypt password hashing
- JWT 로그인
- `ADMIN`, `USER` 역할 정의
- `/api/auth/login`, `/api/health` 외 API 보호
- 로그인 성공/실패 감사 로그 저장
- 로그인 실패 5회 이후 계정 10분 잠금
- Redis 기반 단순 request rate limit
- `blocked_ips` 테이블과 차단 IP 요청 거부 필터

### 파일 매니저

- NAS root를 `NAS_ROOT`, 기본 `/mnt/nas`로 고정
- 안전한 경로 정규화
- `../../etc/passwd` 같은 path traversal 차단
- symlink를 통한 NAS root 이탈 검사 기반
- 파일 목록 조회 API
- 폴더 생성 API
- 파일 업로드 API
- 파일 다운로드 API
- 파일 미리보기 API
- 파일 이름 변경 API
- 파일 삭제 시 실제 삭제가 아니라 `/mnt/nas/trash/yyyy-mm-dd`로 이동
- 파일 메타데이터 PostgreSQL 저장

### 프론트엔드

- 로그인 화면
- 대시보드 레이아웃
- 파일 매니저 화면
- 드래그 앤 드롭 업로드
- 감사 로그 화면
- Nginx 경유 `/api` 호출 구조

### Docker/인프라

- `docker-compose.yml`
- backend Dockerfile
- frontend Dockerfile
- PostgreSQL service
- Redis service
- Nginx reverse proxy
- Prometheus service
- Grafana service
- `node_exporter`는 Pi 전용 profile로 분리
- Windows 로컬 포트 충돌 방지를 위해 PostgreSQL/Redis/backend 직접 공개 포트는 제거
- 외부 접근은 기본적으로 Nginx `8088` 사용

### 문서

- `docs/raspberry-pi-setup.md`
  - Pi 접근 복구 체크리스트
  - Raspberry Pi OS 64-bit Lite
  - SSH key
  - Tailscale
  - 10TB HDD mount/fstab
  - Samba
  - firewall
  - Docker Compose
  - backup 권장 사항

- `docs/security.md`
  - 보안 가정
  - 현재 구현된 보안 기반
  - 운영 전 hardening checklist
  - 알려진 보안 gap

## 검증 완료

현재 환경에서 확인된 명령과 결과:

```powershell
docker compose config
```

성공.

```powershell
docker compose build backend frontend
```

성공. backend와 frontend 이미지 모두 빌드됨.

```powershell
docker run --rm -v "${PWD}\backend:/app" -w /app gradle:8.10-jdk21 gradle test --no-daemon
```

성공. `NasPathServiceTest` 포함 Gradle test 통과.

```powershell
docker compose up -d postgres redis backend frontend nginx
```

성공.

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8088/api/health
```

응답:

```json
{"status":"ok"}
```

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8088/
```

HTTP 200.

기본 관리자 로그인 API도 동작 확인:

```text
username: admin
password: change-this-before-real-use
```

운영 환경에서는 반드시 변경해야 합니다.

## 부분 구현

### Rate limit / abnormal access blocking

현재 상태:

- Redis 기반 IP별 분당 request 제한은 있음
- `blocked_ips` 테이블은 있음
- blocked IP 요청 차단 필터는 있음

부족한 점:

- 로그인 실패 횟수를 IP 단위로 누적해 자동 차단하는 로직 미완성
- 관리자 차단 IP 목록 조회 API 미구현
- 관리자 차단 IP 해제 API 미구현
- 프론트 보안 관리 화면 미완성

### 감사 로그

현재 상태:

- 로그인 성공/실패 기록
- 일부 파일 이벤트 기록
- 관리자 감사 로그 조회 API
- 프론트 감사 로그 테이블

부족한 점:

- `ACCESS_DENIED`, `IP_BLOCKED`, rate limit 초과, blocked IP 접근 같은 보안 이벤트의 세밀한 로깅 미완성
- 파일 다운로드/미리보기 요청의 감사 로그 기록 보강 필요

### Prometheus / Grafana

현재 상태:

- Prometheus service 구성
- Grafana service 구성
- Prometheus datasource provisioning
- Spring Actuator prometheus endpoint 노출

부족한 점:

- Grafana dashboard JSON 없음
- Pi host metrics dashboard 없음
- NAS disk usage dashboard 없음
- node_exporter는 Pi에서만 실제 검증 필요

### 파일 매니저 프론트

현재 상태:

- `/uploads` 목록 조회
- 파일 업로드
- drag and drop

부족한 점:

- 폴더 이동 UI
- 폴더 생성 UI
- 다운로드 버튼
- rename UI
- delete UI
- preview UI
- 업로드 진행률
- 파일 크기/날짜 표시 개선

## 미구현

### Raspberry Pi 실기 설정

현재 환경에서는 불가.

남은 작업:

- Pi IP 확인
- Pi 로그인 정보 복구
- SSH key 접속 구성
- SSH password login 비활성화
- Tailscale 설치와 tailnet 등록
- Tailscale SSH 검증
- firewall 적용

### 10TB HDD NAS 구성

남은 작업:

- 실제 디스크 식별
- ext4 포맷 여부 결정
- `/mnt/nas` 마운트
- `/etc/fstab` UUID 등록
- `/mnt/nas/uploads`, `/mnt/nas/trash`, `/mnt/nas/shared`, `/mnt/nas/backups`, `/mnt/nas/system` 생성
- 권한과 소유자 정리
- 재부팅 후 자동 마운트 검증

### Samba

남은 작업:

- Samba 설치
- `/mnt/nas/shared` 공유 설정
- Samba 사용자 설정
- Windows 탐색기에서 `\\raspberrypi\nas` 또는 Pi IP 기반 접근 검증
- private/public 권한 분리

### Pi server monitoring

남은 작업:

- node_exporter Pi 실행 검증
- Prometheus scrape 검증
- Grafana dashboard 작성
- 또는 백엔드 자체 `/api/system/metrics` 구현
- CPU/RAM/disk/NAS disk/network/uptime/temperature 프론트 표시

### PC Agent monitoring

Phase 1에서는 의도적으로 미구현.

남은 작업:

- `pc_agents`, `pc_metrics` 엔티티 추가
- agent token 발급/검증 설계
- API 구현:
  - `POST /api/agents/register`
  - `POST /api/agents/{agentId}/metrics`
  - `GET /api/agents`
  - `GET /api/agents/{agentId}/metrics/latest`
- Python agent 구현
- Windows/Linux에서 CPU/RAM/disk/network/temperature 수집
- 주기적 POST
- dashboard에서 online/offline 표시

### 고급 보안

남은 작업:

- TOTP 2FA
- refresh token 또는 server-side session
- CSRF 정책 정리
- IP allowlist
- admin security settings page
- fail2ban 실제 적용
- HTTPS/TLS
- 백업 자동화

## 집에서 먼저 해야 할 순서

### 1. Pi 접근 복구

집의 Codex에게 먼저 아래 목표를 줍니다.

```text
Raspberry Pi 접근을 복구해라. 현재 IP와 비밀번호를 모른다.
라우터 접속 장치 목록, raspberrypi.local, arp -a, Tailscale admin console을 순서대로 확인하고,
접근이 안 되면 물리적으로 모니터/키보드 또는 SD 카드 접근으로 계정을 복구한다.
성공 기준은 SSH key 기반으로 Pi에 접속 가능한 상태다.
```

확인 명령:

```bash
ping raspberrypi.local
arp -a
ssh pi@raspberrypi.local
tailscale status
```

성공 기준:

- Pi IP 확인
- SSH 접속 가능
- 비밀번호가 아니라 SSH key로 접속 가능

### 2. Pi 기본 보안 설정

```text
Pi에 SSH key login을 설정하고 password SSH login을 끈다.
Tailscale을 설치하고 tailnet IP로 SSH 접속을 검증한다.
초기에는 인터넷 port forwarding을 하지 않는다.
```

성공 기준:

- Tailscale IP로 SSH 가능
- `/etc/ssh/sshd_config`에서 `PasswordAuthentication no`
- dashboard는 Tailscale 또는 LAN에서만 접근

### 3. 10TB HDD 마운트

```text
10TB 외장 HDD를 /mnt/nas로 마운트한다.
디스크 식별을 실수하지 말고, 필요 시 ext4로 포맷한다.
fstab에는 UUID를 사용한다.
재부팅 후에도 /mnt/nas가 자동 마운트되는지 확인한다.
```

성공 기준:

```bash
df -h /mnt/nas
findmnt /mnt/nas
sudo mount -a
```

필수 디렉터리:

```bash
sudo mkdir -p /mnt/nas/uploads /mnt/nas/trash /mnt/nas/shared/public /mnt/nas/shared/private /mnt/nas/backups /mnt/nas/system/upload-temp
```

### 4. Samba 설정

```text
Samba를 설치하고 /mnt/nas/shared를 Windows에서 접근 가능한 NAS 공유로 설정한다.
처음에는 pi 사용자만 접근 가능하게 제한한다.
```

성공 기준:

- Windows 탐색기에서 Pi 공유 접근 가능
- 파일 생성/읽기/삭제 권한 확인

### 5. 애플리케이션 배포

집의 Pi에서 repository를 받은 뒤:

```bash
cp .env.example .env
nano .env
docker compose up -d --build
```

`.env`에서 반드시 변경:

```text
POSTGRES_PASSWORD
JWT_SECRET
ADMIN_PASSWORD
GRAFANA_ADMIN_PASSWORD
```

성공 기준:

```bash
docker compose ps
curl http://localhost:8088/api/health
```

외부에서는 Tailscale IP로:

```text
http://<tailscale-pi-ip>:8088
```

### 6. 실제 `/mnt/nas` 파일 기능 검증

검증 항목:

- 로그인
- 파일 업로드
- `/mnt/nas/uploads`에 실제 파일 생성 확인
- 파일 목록 조회
- 다운로드
- rename
- delete 후 `/mnt/nas/trash/yyyy-mm-dd`로 이동 확인
- `../../etc/passwd` 같은 path traversal 요청이 400으로 거부되는지 확인

### 7. 다음 개발 우선순위

집에서 하드웨어 검증 후 다음 순서로 개발합니다.

1. 파일 매니저 프론트 기능 완성
   - 다운로드
   - rename
   - delete
   - 폴더 생성
   - 폴더 이동
   - preview
   - 업로드 진행률

2. 보안 관리 API 완성
   - blocked IP list
   - unblock
   - manual block
   - IP 실패 누적 자동 차단
   - 보안 이벤트 감사 로그 보강

3. Pi monitoring
   - node_exporter 실제 실행
   - Prometheus scrape 확인
   - Grafana dashboard 작성
   - 프론트 대시보드에 핵심 지표 표시

4. PC agent
   - agent API
   - Python agent
   - Windows/Linux 수집
   - dashboard online/offline 표시

5. 운영 보안
   - HTTPS/TLS
   - fail2ban
   - backup cron
   - restore 절차 문서화

## 집의 Codex에게 줄 첫 프롬프트

아래 내용을 그대로 전달하세요.

```text
이 repository는 Pi HomeOps NAS Dashboard다.
현재 Phase 1 로컬 구현은 끝났고, docs/home-codex-handoff.md를 기준으로 집의 Raspberry Pi 실기 설정과 남은 기능을 이어서 개발해야 한다.

우선 docs/home-codex-handoff.md, docs/raspberry-pi-setup.md, docs/security.md를 읽어라.
현재 집에서 동작 중인 Raspberry Pi의 IP와 비밀번호를 모르는 상태이므로, 먼저 Pi 접근 복구부터 진행해라.

목표:
1. Raspberry Pi IP 확인
2. SSH 접근 복구
3. SSH key login 설정
4. Tailscale 설치/확인
5. 10TB HDD를 /mnt/nas로 마운트
6. Samba 공유 설정
7. docker compose up -d --build로 앱 실행
8. http://<pi-tailscale-ip>:8088/api/health 확인
9. 실제 /mnt/nas/uploads와 /mnt/nas/trash에 파일 매니저 기능이 반영되는지 검증

주의:
- 디스크 포맷 전 lsblk, blkid로 대상 디스크를 반드시 확인해라.
- 인터넷 port forwarding은 하지 말고 Tailscale 우선으로 접근해라.
- .env의 기본 비밀번호와 JWT_SECRET은 운영 전 반드시 변경해라.
- 기존 구현을 무리하게 갈아엎지 말고, 하드웨어 검증과 미구현 기능을 단계별로 추가해라.
```

## 현재 환경에서 더 할 수 있는 작업

Pi 없이도 추가 개발은 가능합니다. 다만 실제 완료 판정은 Pi에서 다시 검증해야 합니다.

현재 환경에서 계속 진행 가능한 작업:

- 파일 매니저 프론트 버튼과 UI 완성
- blocked IP admin API
- 보안 로그 보강
- PC agent API skeleton
- Python agent 초안
- Grafana dashboard JSON 초안

현재 환경에서 완료 판정이 불가능한 작업:

- Pi SSH/Tailscale 설정
- 실제 10TB HDD 마운트
- Samba 실사용 검증
- Pi temperature/network/disk 지표 정확성 검증
- Windows 탐색기 NAS 접근 검증
- 실제 홈 네트워크 방화벽 검증
