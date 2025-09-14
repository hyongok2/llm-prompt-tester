# 🐳 Docker 배포 가이드

## 📋 사전 요구사항

- Docker 및 Docker Compose 설치
- 포트 5300 사용 가능

## 🚀 빠른 배포

### 1. Docker Compose로 실행

```bash
# 빌드 및 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 중지
docker-compose down
```

### 2. Docker 명령어로 실행

```bash
# 이미지 빌드
docker build -t promptlab .

# 컨테이너 실행
docker run -d \
  --name promptlab-app \
  -p 5300:80 \
  --restart unless-stopped \
  promptlab

# 로그 확인
docker logs -f promptlab-app

# 중지
docker stop promptlab-app
docker rm promptlab-app
```

## 🌐 접속 정보

- **웹 애플리케이션**: http://localhost:5300
- **Health Check**: http://localhost:5300/health

## ⚙️ 환경 설정

### Ollama 서버 연결

1. 웹 애플리케이션 접속 후 설정(⚙️) 클릭
2. "Ollama 서버 URL" 설정:
   - **로컬 Ollama**: `http://localhost:11434`
   - **원격 Ollama**: `http://your-server-ip:11434`
   - **Docker 내 Ollama**: `http://host.docker.internal:11434`

### Docker 내에서 로컬 Ollama 접근

Windows/Mac에서 Docker 컨테이너가 호스트의 Ollama에 접근하려면:

```bash
# docker-compose.yml에 추가
services:
  promptlab:
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

그리고 앱에서 서버 URL을 `http://host.docker.internal:11434`로 설정

## 📊 모니터링

### 컨테이너 상태 확인

```bash
# 실행 중인 컨테이너 확인
docker ps

# 컨테이너 상태 확인
docker stats promptlab-app

# Health Check 상태
docker inspect promptlab-app --format='{{.State.Health.Status}}'
```

### 로그 관리

```bash
# 실시간 로그
docker logs -f promptlab-app

# 최근 100줄
docker logs --tail 100 promptlab-app

# 특정 시간 이후 로그
docker logs --since "2024-01-01T00:00:00" promptlab-app
```

## 🔧 문제 해결

### 포트 충돌

```bash
# 5300 포트 사용 중인 프로세스 확인 (Windows)
netstat -ano | findstr :5300

# 5300 포트 사용 중인 프로세스 확인 (Linux/Mac)
lsof -i :5300
```

### 컨테이너 재시작

```bash
# 컨테이너 재시작
docker restart promptlab-app

# 강제 재시작
docker kill promptlab-app
docker start promptlab-app
```

### 이미지 업데이트

```bash
# 새 이미지로 재빌드
docker-compose up --build -d

# 또는
docker build -t promptlab . --no-cache
docker stop promptlab-app
docker rm promptlab-app
docker run -d --name promptlab-app -p 5300:80 promptlab
```

## 🛡️ 보안 고려사항

### 방화벽 설정

```bash
# Ubuntu/Debian
sudo ufw allow 5300

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=5300/tcp
sudo firewall-cmd --reload
```

### HTTPS 설정 (선택사항)

리버스 프록시 (nginx, traefik) 사용하여 SSL 인증서 적용 권장

## 📈 성능 최적화

### 리소스 제한

```yaml
# docker-compose.yml
services:
  promptlab:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

## 🔄 백업 및 복원

앱 데이터는 브라우저 localStorage에 저장되므로:
- **서버 백업 불필요**: 각 사용자의 브라우저에 개별 저장
- **사용자 데이터 백업**: 앱 내 "내보내기" 기능 사용

## 📞 지원

문제 발생 시:
1. Health Check 엔드포인트 확인: http://localhost:5300/health
2. 컨테이너 로그 확인: `docker logs promptlab-app`
3. 브라우저 콘솔 로그 확인 (F12 → Console)

---

**🎉 배포 완료!** 이제 http://localhost:5300에서 PromptLab을 사용할 수 있습니다!