# IntelliJ IDEA 설정 방법

이 프로젝트는 monorepo 구조입니다.

```text
Pi HomeOps NAS Dashboard
├── backend      Spring Boot / Gradle
├── frontend     React / Vite
├── agent
├── infra
├── docs
└── docker-compose.yml
```

백엔드는 `backend` 폴더 안에 별도 Gradle 프로젝트로 들어 있습니다.

## 권장 방식

IntelliJ에서 **루트 폴더**를 엽니다.

```text
Pi HomeOps NAS Dashboard
```

루트 폴더를 열어야 `backend`, `frontend`, `infra`, `docs`, `docker-compose.yml`을 한 번에 볼 수 있습니다.

이 저장소에는 루트 `settings.gradle`이 있고, 그 안에서 `backend`를 Gradle included build로 연결합니다.

```gradle
includeBuild("backend")
```

그래서 IntelliJ가 정상 인식하면 프로젝트 트리에 아래처럼 보입니다.

```text
backend [pi-homeops-backend]
```

## 집에서 설정 순서

1. IntelliJ 실행
2. `File > Open`
3. repository 루트 폴더 선택

   ```text
   Pi HomeOps NAS Dashboard
   ```

4. 오른쪽 아래 또는 상단에 Gradle import 알림이 나오면 `Load Gradle Project` 또는 `Import Gradle Project` 선택
5. Gradle JVM은 Java 21로 설정
6. Gradle sync 완료 대기

## Java 21 설정

`File > Project Structure > Project`에서:

```text
SDK: Java 21
Language level: 21
```

`Settings > Build, Execution, Deployment > Build Tools > Gradle`에서:

```text
Gradle JVM: Java 21
```

## 실행 방법

Gradle sync가 끝나면 상단 실행 구성에서 `HomeOpsApplication`을 선택할 수 있습니다.

직접 실행하려면:

1. `backend/src/main/java/com/homeops/nas/HomeOpsApplication.java` 열기
2. `main` 메서드 옆 실행 버튼 클릭

또는 Gradle task로 실행:

```text
backend > Tasks > application > bootRun
```

## 루트에서 실행이 안 되고 backend만 열어야 하는 경우

대부분 IntelliJ가 `backend`를 Gradle 프로젝트로 import하지 못한 상태입니다.

### 방법 A: Gradle 재연결

1. IntelliJ 오른쪽 Gradle 탭 열기
2. `+` 버튼 또는 `Link Gradle Project` 선택
3. 아래 파일 선택

   ```text
   backend/build.gradle
   ```

4. Gradle JVM을 Java 21로 선택
5. Sync 실행

### 방법 B: 캐시/설정 초기화

아직도 인식이 안 되면:

1. IntelliJ 종료
2. 프로젝트 루트의 `.idea` 폴더 삭제
3. IntelliJ 다시 실행
4. `File > Open`으로 루트 폴더 다시 열기
5. Gradle import 다시 수행

`.idea`는 개인 IDE 설정이라 repository에 올리지 않습니다.

## 명령어로 확인

루트 폴더에서:

```powershell
docker compose config
```

백엔드 폴더에서:

```powershell
.\gradlew.bat test
```

Linux/macOS 또는 Pi에서는:

```bash
cd backend
./gradlew test
```

## 자주 헷갈리는 점

### 왜 루트에 `settings.gradle`이 또 있나?

`backend`는 독립 실행 가능한 Gradle 프로젝트입니다.

하지만 IntelliJ에서 루트 폴더를 열었을 때도 백엔드 Gradle 프로젝트를 자동으로 보이게 하려고 루트에 `settings.gradle`을 둡니다.

루트 `settings.gradle`은 백엔드를 이렇게 연결합니다.

```gradle
includeBuild("backend")
```

이 방식이면:

- 루트 폴더를 열어도 backend가 Gradle 프로젝트로 인식됨
- backend 폴더만 따로 열어도 기존처럼 실행 가능
- frontend, infra, docs를 함께 보면서 작업 가능

### frontend는 왜 Gradle 모듈로 안 보이나?

frontend는 Gradle이 아니라 Node/Vite 프로젝트입니다.

실행은 frontend 폴더에서 합니다.

```powershell
npm.cmd install
npm.cmd run dev
```

또는 Docker Compose로 전체 실행합니다.

```powershell
docker compose up -d --build
```
