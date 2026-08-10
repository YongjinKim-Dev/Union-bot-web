# Union Bot Web

`ashi_bot.py` 디스코드 버튼 투표를 대체하는 Next.js 웹앱입니다. 150명 동시
투표 시 디스코드 API rate limit 문제를 피하기 위해, 투표 UI만 웹으로
옮기고 기존 MySQL 스키마와 봇의 운영 명령어는 그대로 유지합니다.

## 기능

- Discord OAuth2 로그인 (`user.status = 1`로 등록된 계정만 허용)
- 거점전 설문 투표 페이지 (`/vote`): 참여 / 미참 / 부속 / 늦참
- 참여·부속 선택 시 참가 직업 등록/변경
- 기존 MySQL DB(`user`, `guild`, `survey`, `survey_history`,
  `character_class`, `user_character_class_map`)를 그대로 사용

투표 로직(중복 투표 처리, 참여↔부속 전환 시 순번 유지, 직업 등록 안내 등)은
`ashi_bot.py`의 `SurveyButton`/`ClassTypeSelectBox` 콜백을 그대로 이식했습니다
([src/lib/queries.ts](src/lib/queries.ts) 참고).

## 로컬 실행

```bash
npm install
cp .env.example .env   # 값 채우기
npm run dev
```

`.env`에 필요한 값은 [.env.example](.env.example) 참고. Discord Developer
Portal에서 OAuth2 리다이렉트로 `{NEXTAUTH_URL}/api/auth/callback/discord`를
등록해야 합니다.

## Docker 배포 (Vultr)

```bash
cp .env.example .env   # 값 채우기
docker compose build
docker compose up -d
```

`docker-compose.yml`은 웹앱 컨테이너만 실행합니다. 기존 MySQL이 같은
서버 또는 별도 서버에서 이미 돌고 있다면 `.env`의 `DB_HOST`만 그 주소로
맞추면 됩니다. MySQL을 함께 띄워야 한다면 compose 파일의 주석 처리된
`mysql` 서비스를 참고하세요.

## 봇 연동

설문 15분 전 링크 전송, 버튼 UI 제거 등 `ashi_bot.py`에 필요한 변경사항은
[docs/discord-bot-integration.md](docs/discord-bot-integration.md)에
정리했습니다.

## 프로젝트 구조

```
src/
  auth.ts                 NextAuth v5 설정 (Discord provider)
  middleware.ts            /vote 인증 가드
  lib/
    db.ts                  mysql2 커넥션 풀
    queries.ts              투표/직업 관련 쿼리
    types.ts                투표 타입, 라벨
    format.ts               날짜 포맷, 마감 시각 계산
  app/
    login/                 로그인 페이지
    vote/                  투표 페이지, 서버 액션, 클라이언트 컴포넌트
    api/auth/[...nextauth]/ NextAuth 라우트 핸들러
```
