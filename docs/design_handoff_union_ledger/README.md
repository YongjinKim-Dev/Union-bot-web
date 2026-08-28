# Handoff: 아시바당 길드연맹 사이트 (Union Ledger)

## Overview

검은사막 길드연맹 "아시바당"의 거점전 투표/정보 사이트 UI 리디자인. 기존 저장소(`yarn47/Union-bot-web`, Next.js + NextAuth + MySQL)의 다크 퍼플 테마를 **Classical**(밝은 편집·세리프) 디자인 시스템으로 교체하고, 메인화면을 요일 단위 거점전 구조로 재구성했다.

확정 범위:

- **홈** — 오늘 거점전 히어로 밴드 + 이번 주 6요일 칸 + 내 등록 직업 + 참고 자료 팝업 2종
- **직업 등록** — 계열(전승/각성/기타) → 직업 2단계 선택
- **연맹 소개** — 레이아웃만 확정, 내용은 전부 TBD
- **문서** — "투표 사용법" 한 편만

## About the Design Files

이 번들의 `아시바당 Site Mockups.dc.html`은 **디자인 레퍼런스(HTML 프로토타입)**다. 프로덕션 코드가 아니며 그대로 복사해 쓰지 않는다. 목표는 이 디자인을 **대상 코드베이스(Next.js App Router + CSS Modules)의 기존 패턴으로 재구현**하는 것이다.

기존 코드베이스 구조 참고:

- `src/app/theme.css` — 전역 색 토큰. **여기 값만 교체하면 전체 리테마가 된다.** 아래 Design Tokens를 이 파일에 옮기는 것이 첫 작업.
- `src/app/page.tsx`, `src/app/page.module.css` — 홈
- `src/lib/types.ts` — `VotingType = "attend" | "non_attend" | "boarding" | "late_attend"` (참여/미참/부속/늦참)
- `public/classes/*.png` — 직업 아이콘 29종(이미 저장소에 존재)

프로토타입 파일은 단일 HTML 문서 안에 여러 "턴"이 쌓여 있다. **최신 턴이 위**이며, 구현 대상은 아래 "Screens / Views"에 적힌 id만이다. 그 아래 턴(1~5)은 폐기된 탐색안이니 참고만.

## Fidelity

**High-fidelity.** 색·타이포·간격·상호작용이 모두 확정값이다. 픽셀 단위로 재현하되, 마크업/컴포넌트 구조는 코드베이스 관례를 따른다.

단 하나 예외: **연맹 소개(7a/7c)의 콘텐츠는 TBD**다. 레이아웃과 자리표시(placeholder)만 확정이며, 문구·사진·인물 정보는 추후 제공된다. TBD 배지와 점선 박스를 그대로 구현해 두고 내용만 나중에 채우는 것을 권장.

---

## Screens / Views

### 1. 홈 (id `6a` 데스크톱 / `6b` 모바일)

**Purpose** — 오늘 거점전을 확인하고 투표하러 이동. 이번 주 6일 일정과 내 등록 직업 확인. 참고 자료 열람.

**Layout (데스크톱, 1120px)**

```
┌ 헤더 (padding 27.6 46 18.4, border-bottom 1px)
│  좌: "아시바당" 22px + "UNION LEDGER" 10px mono
│  우: 홈 / 직업 등록 / 연맹 소개 / 문서 + 로그아웃 버튼 (gap 18.4)
├ 히어로 밴드 (height 320, position relative)
│  배경: 월페이퍼 이미지 (object-fit cover)
│  스크림: 하단 72% 높이, linear-gradient(180deg, transparent, rgba(26,25,24,.82))
│  콘텐츠: left/right 46, bottom 27.6, flex 양끝 정렬
│    좌: 키커 / h1 46px / 버튼 + 내 표 표기
│    우: 요일 글자 70px mono, color rgba(225,173,102,.55)
├ 본문 (padding 27.6 46 46)
│  ├ grid 1fr / 280px, gap 36.8, align-items start
│  │  좌: "이번 주 거점전" 섹션 헤더 → grid repeat(3,1fr) gap 9.2 (6칸 = 3×2)
│  │  우: "내 등록 직업" 섹션 헤더 → 카드 2개 세로 스택
│  └ "참고 자료" 섹션 헤더 → grid 1fr/1fr gap 18.4, 카드 2개
└ (팝업 오버레이 — 아래 Interactions 참조)
```

**요일 카드** (6개: 월 08.24 / 화 08.25 / 수 08.26 / 목 08.27 / 금 08.28 / 일 08.30 — **토요일 없음**)

| 속성 | 기본 | 진행 중(오늘) |
| --- | --- | --- |
| border | 1px solid rgba(32,31,29,.16) | 1px solid #b68235 |
| background | transparent | #fff3e4 |
| 요일 글자색 | #201f1d | #5a3b0a |

공통: `border-radius:4px; padding:13.8px 11px; display:flex; flex-direction:column; gap:9.2px; min-height:132px`

카드 내부 (위→아래):
1. 요일(Cormorant Garamond 24px/600) + 날짜(mono 10.5px #605d5d) — `justify-content:space-between; align-items:baseline`
2. 상태 — mono 10px, `letter-spacing:.14em`. 마감/예정 `#605d5d`, 진행 `#7d5411`
3. 거점명 — Nanum Myeongjo 12.5px, line-height 1.5
4. "내 표 · {값}" — 12.5px. 값 있으면 `#7d5411`, 미등록이면 `#7d7979`

샘플 데이터: 월 마감/참여, 화 마감/미참, 수 마감/참여, 목 진행/참여, 금 예정/미등록, 일 예정/미등록. 금·일 거점명은 "세렌디아 1거점" / "미정".

**내 등록 직업 카드** (2개)

- 주력: `border:1px solid #b68235; background:#fff3e4`, 아이콘 필터 = 선택 상태(아래 아이콘 규칙), 마크 매트 배경 `#fff3e4`, 직업명 `#5a3b0a` 13.5px, 부제 `#7d5411` 11px "전승 · 주력"
- 부캐: `border:1px solid rgba(32,31,29,.16)`, 아이콘 기본 필터, 직업명 `#201f1d`, 부제 `#605d5d` "각성 · 부캐"
- 공통: `display:flex; align-items:center; gap:13.8px; padding:9.2px 11px; border-radius:4px`, 아이콘 30×30
- 섹션 헤더 우측에 "변경" 링크 → 직업 등록 화면

**참고 자료 카드** (`.refcard`)

```css
display:flex; flex-direction:column; gap:9.2px;
padding:22px; border:1px solid rgba(32,31,29,.16); border-radius:4px;
background:transparent; text-align:left; cursor:pointer;
transition:border-color .2s ease, background .2s ease, transform .2s ease;
```
hover: `border-color:#b68235; background:#fff3e4; transform:translateY(-2px)`

내부: 키커(mono 10px `.16em` `#7d5411`) / 제목(Cormorant 24px/600) / 설명(12.5px `rgba(32,31,29,.72)` line-height 1.7) / "표 열기 →"(mono 11px `#7d5411`)

두 카드: **공방합 구간 정보**(REFERENCE 01), **에크레타 악세사리**(REFERENCE 02).

**Layout (모바일, 390px)** — 세로 스택: 헤더 → 히어로 190px → 투표 버튼 2×2 그리드(min-height 48px) → 이번 주 거점전(6칸 1행, 요일/날짜/상태만) → 내 등록 직업 → 참고 자료 카드 2개(padding 15px, 키커·"표 열기" 생략).

---

### 2. 참고 자료 팝업 (홈 안의 모달 2종)

**공통 셸**

```
오버레이: position:absolute; inset:0; background:rgba(26,25,24,.55);
          display:flex; align-items:center; justify-content:center; padding:36.8px; z-index:5
패널:     background:#f3f2f2; border:1px solid rgba(32,31,29,.22); border-radius:4px;
          box-shadow:0 8px 28px rgba(45,43,43,.22);
          max-height:100%; display:flex; flex-direction:column; overflow:hidden
헤더:     padding:18.4px 27.6px; border-bottom:1px solid rgba(32,31,29,.16); 양끝 정렬
본문:     padding:22px 27.6px 27.6px; overflow:auto
```

스크롤바: `width:8px`, thumb `rgba(32,31,29,.22)` radius 4, track transparent.

표 스타일:
- `th` — `text-align:right; padding:7px 9.2px; font:400 11px Nanum Myeongjo; color:#605d5d; border-bottom:1px solid #201f1d` (첫 열만 left)
- `td` — `text-align:right; padding:5px 9.2px; font:11.5px JetBrains Mono; font-variant-numeric:tabular-nums; border-bottom:1px solid rgba(32,31,29,.1)` (첫 열만 left)
- 행 hover — `background:#fff3e4`

**팝업 A — 공방합 구간 정보** (max-width 860px)

본문 grid `1.35fr / 1fr`, gap 27.6.

좌: "보너스 공격력 및 몬스터 추가 공격력" — 열: 표기 공격력 / 보너스 공격력 / 몬스터 추가 공격력. 표기 공격력 **395–450 (56행)**.
- 보너스 공격력: index 0,1 → 242, 이후 `245 + (floor(i/2) - 1) * 2` (즉 245,245,247,247,249,249… 297,297)
- 몬스터 추가 공격력: 688, 696, 704, 712, 720, 728, 그다음부터 744에서 **+16씩** 1528까지. 천 단위 콤마 표기.

우: "보너스 피해 감소" — 열: 표기 방어력 / 보너스 피해 감소. 방어력 **481–531 (51행)**, 값 = `91 + min(10, floor((dp - 481) / 5))` (481–485→91 … 526–530→100, 531→101).

**팝업 B — 에크레타 악세사리** (max-width 900px)

헤더 우측에 탭 2개 + 닫기. 탭 스타일:
- 활성 `padding:7px 15px; border:1px solid #b68235; background:#fff3e4; color:#5a3b0a; border-radius:4px; font:400 12.5px Lora; min-height:34px`
- 비활성 `border:1px solid rgba(32,31,29,.16); background:transparent; color:#605d5d` (나머지 동일)

**탭 1 "단계별 수치"** — grid `1fr/1fr` gap 27.6, 표 4개(반지 / 귀걸이 / 목걸이 / 허리띠). 열: 강화 단계 / 공격력 / 적중력 / 피해감소 / 회피력. 하단 주석 "괄호 안은 히튼 적용 수치입니다."

강화 단계(11): 노강, 장(I), 광(II), 고(III), 유(IV), 동(V), 운(VI), 우(VII), 풍(VIII), 단(IX), 환(X)

| 부위 | 공격력 | 적중력 |
| --- | --- | --- |
| 반지 | 25,26,26,27,27,28,28,29,30,31,32 | 15,16,17,18,19,20,21,22,23,24,26 |
| 귀걸이 | 21,22,22,23,23,24,24,25,26,27,28 | 15,16,17,18,19,20,21,22,23,24,26 |
| 목걸이 | 43,44,44,45,45,46,46,47,48,49,50 | 29,30,31,32,33,34,35,36,37,39,41 |
| 허리띠 | 25,26,26,27,27,28,28,29,30,31,32 | 15,16,17,18,19,20,21,22,23,24,26 |

피해감소 / 회피력은 4부위 공통(단계 순):
`0(1)/1(0)`, `0(2)/1(0)`, `1(2)/1(1)`, `1(3)/1(2)`, `1(4)/2(2)`, `1(5)/2(2)`, `2(5)/2(3)`, `2(6)/2(4)`, `2(7)/2(5)`, `2(8)/3(5)`, `3(8)/3(6)`

**탭 2 "강화 확률"** — 열: 강화 시도 단계 / 기본 확률 / 기준 스택 / 적용 확률 / 아그리스의 정수 / 필요 크론석. 하단 주석 "적용 확률은 기준 스택을 채웠을 때의 값입니다."

| 단계 | 기본 확률 | 기준 스택 | 적용 확률 | 아그리스의 정수 | 필요 크론석 |
| --- | --- | --- | --- | --- | --- |
| 장 | 1.8300% | 140 | 27.4500% | 7 | 0 |
| 광 | 1.5700% | 155 | 25.9050% | 7 | 290 |
| 고 | 1.3300% | 175 | 24.6050% | 8 | 590 |
| 유 | 1.1100% | 195 | 22.7550% | 9 | 960 |
| 동 | 0.9100% | 205 | 19.5650% | 10 | 1150 |
| 운 | 0.7300% | 220 | 16.7900% | 12 | 1420 |
| 우 | 0.5800% | 230 | 13.9200% | 14 | 1590 |
| 풍 | 0.4400% | 265 | 12.1000% | 16 | 1780 |
| 단 | 0.3100% | 305 | 9.7650% | 20 | 2790 |
| 환 | 0.2000% | 310 | 6.4000% | 30 | 3130 |

> 수치는 사용자가 제공한 게임 정보 이미지에서 전사한 것이다. 실제 서비스 반영 전 최신값 확인 권장.

---

### 3. 직업 등록 (id `4a` 데스크톱 / `4b` 모바일)

**Purpose** — 계열을 먼저 고르고 직업을 선택해 등록.

**흐름**

1. STEP 01 계열 — 3개 카드: 전승("주 무기 계열"), 각성("각성 무기 계열"), 기타("개방 · 재능 계열")
2. STEP 02 직업 — 선택한 계열에 해당하는 직업 격자. 계열 미선택 시 `opacity:.38`, 선택 시 `opacity:1` (`transition:opacity .22s ease`)
3. 하단 바 — 선택 요약 + 초기화 + 등록하기

**규칙** — 계열을 바꾸면 직업 선택은 초기화된다.

**계열별 직업 목록** (프로토타입 기준. 실제 분류는 운영진 확인 필요)

- 전승 / 각성 (각 21): 워리어, 레인저, 소서러, 버서커, 타머, 무사, 매화, 발키리, 쿠노이치, 닌자, 위자드, 위치, 다크나이트, 스트라이커, 미스틱, 란, 가디언, 하사신, 노바, 세이지, 커세어
- 기타 = **개방 · 재능** (11): 아처, 샤이, 우사, 매구, 드라카니아, 도사, 데드아이, 스칼라, 오공, 세라핀, 에이전트



**계열 카드**

| | 기본 | 선택 |
| --- | --- | --- |
| border | 1px solid rgba(32,31,29,.16) | 1px solid #b68235 |
| background | transparent | #fff3e4 |
| 라벨색 | #201f1d | #5a3b0a |

공통 `border-radius:4px; padding:13.8px 18.4px; text-align:left; transition:border-color .18s, background .18s`
내부: 번호(mono 10px `.14em` `#7d5411`, 데스크톱만) / 라벨(Nanum Myeongjo 17px) / 설명(11.5px `#605d5d` line-height 1.5)

**직업 타일**

```css
display:flex; flex-direction:column; align-items:center; gap:6px;
padding:9.2px 4.6px; border-radius:4px; min-height:76px;
transition:border-color .18s, background .18s, transform .18s;
```
기본 `border:1px solid rgba(32,31,29,.16); background:transparent` / 선택 `border:1px solid #b68235; background:#fff3e4`
hover `border-color:#b68235; transform:translateY(-2px)`

아이콘 34×34 (배경 이미지), 이름 Nanum Myeongjo 11.5px — 선택 시 `#5a3b0a`.

격자: 데스크톱 `repeat(8,1fr)`, 모바일 `repeat(4,1fr)`, gap 9.2.

**등록하기 버튼**

- 활성 `min-height:44px; padding:9.2px 22px; border:1px solid #b68235; background:#fff3e4; color:#5a3b0a; border-radius:4px; font:400 13.5px Lora`
- 비활성 `border:1px solid rgba(32,31,29,.16); background:transparent; color:#7d7979; cursor:not-allowed; opacity:.45`

요약 텍스트: 둘 다 선택 시 `"{계열} · {직업}"` (`#5a3b0a`), 계열만 선택 시 `"{계열} · 직업 미선택"` (`#605d5d`), 아무것도 없으면 `"선택 없음"`.

---

### 4. 연맹 소개 (id `7a` 데스크톱 / `7c` 좌측 모바일) — **콘텐츠 TBD**

레이아웃만 확정. 헤더 → 히어로 밴드 280px(키커 "ABOUT", h1 "연맹 소개", 서브 "헤드라인 TBD") → 본문 grid `1fr / 280px` gap 36.8.

좌 컬럼 섹션 3개 — 소개 본문 / 사진 / 운영진. 각 섹션 헤더 우측에 TBD 배지:
`padding:2px 9.2px; border:1px solid rgba(32,31,29,.22); border-radius:4px; font-size:10.5px; color:#605d5d`

- 소개 본문 — 점선 박스 `border:1px dashed rgba(32,31,29,.26); border-radius:4px; padding:27.6px; min-height:150px`
- 사진 — `.plate` 2개 (grid 1fr/1fr), 각 150px 높이 placeholder
- 운영진 — 점선 카드 3개, 인물 이미지 60px + 닉네임/역할 TBD

우 컬럼 "연맹 정보" — 정의 목록 5행(창단 / 서버 / 소속 길드 / 거점전 요일 / 지원 문의), 값 모두 "TBD", 각 행 `padding:9.2px 0; border-bottom:1px solid rgba(32,31,29,.12)`. 아래에 비활성 버튼 "디스코드 참여 — TBD" (`opacity:.5; cursor:not-allowed`).

---

### 5. 문서 (id `7b` 데스크톱 / `7c` 우측 모바일)

**사이드바에 문서는 "투표 사용법" 하나뿐이다.** (기존 목업의 직업 등록 규칙 / 거점전 규정 / 봇 연동 / 로컬 실행 / Docker / DB 스키마 항목은 전부 삭제됨)

레이아웃: 헤더 → grid `200px / 1px / 1fr`. 사이드바 배경 `#eae9e9`, 하단에 "다른 문서는 필요할 때 추가합니다." 주석.

사이드바 링크 스타일(`.toc a`):
```css
display:block; padding:5px 0 5px 13.8px; font-size:12.5px;
border-left:1px solid rgba(32,31,29,.16); color:rgba(32,31,29,.6);
transition:color .16s, border-color .16s;
```
hover `color:#7d5411; border-left-color:#b68235`
활성 `color:#201f1d; border-left:2px solid #b68235; font-weight:600`

본문 (padding 36.8 46 46):

- 키커 "문서 01" / h1 "투표 사용법" 36px
- 리드 문단
- **1. 표 종류** — 4행 정의 목록 (grid `76px / 1fr`, gap 13.8): 참여 / 부속 / 늦참 / 미참
- **2. 직업 등록** — 문단 + 전승·각성 마크 예시 칩 2개 + "직업 등록 화면 →" 링크
- **3. 중복 투표와 마감** — 문단 + 참고 박스
- 하단 "최종 수정 2026-08-28" (mono 10.5px `#7d7979`)

**확정 문구** (그대로 사용):

> 거점전 설문은 해당 요일 시작 15분 전에 디스코드로 링크가 전송됩니다. 링크를 열면 디스코드 계정으로 로그인되고, 연맹에 등록된 계정만 투표 화면에 들어갈 수 있습니다.

표 종류:
- 참여 — 본대 참가. 직업 등록 필수.
- 부속 — 대기 인원. 참여로 전환해도 순번이 유지됩니다.
- 늦참 — 시작 이후 합류. 별도 명단으로 집계됩니다.
- 미참 — 불참. 사유 입력은 필요하지 않습니다.

> 참여·부속을 선택하려면 직업이 등록되어 있어야 합니다. 계열(전승·각성·기타)을 먼저 고르고 직업을 선택하며, 같은 직업이라도 전승과 각성은 다른 항목으로 취급됩니다.

> 같은 설문에 다시 투표하면 이전 표가 갱신됩니다. 다만 직업만 바뀌는 경우에는 순번이 바뀌지 않습니다. 기본 마감은 거점전 시작 1시간 전이며, 마감 이후에는 버튼이 비활성화됩니다. 변경이 필요한 경우 운영진에 직접 요청하세요.

참고 박스 (`border-left:2px solid #b68235; background:#eae9e9; padding:13.8px 18.4px`):

> 거점전은 월·화·수·목·금·일 여섯 요일에 열립니다. 요일마다 설문이 따로 열리며, 홈 화면의 요일 칸에서 각 설문의 상태를 확인할 수 있습니다.

---

## Interactions & Behavior

**참고 자료 팝업** — 카드 클릭 → 모달 오픈. 헤더 "닫기" 버튼으로 닫기. 에크레타 모달은 탭 상태(`acc` | `rate`)를 별도로 가진다. 오버레이 클릭 닫기와 Esc 닫기는 프로토타입에 없으나 **구현 시 추가할 것**(접근성).

**직업 선택** — 계열 클릭 → 해당 계열 직업 목록 렌더 + 직업 선택 초기화. 직업 클릭 → 선택. 초기화 버튼 → 둘 다 해제. 등록하기는 둘 다 선택되어야 활성.

**전이(transition)**
- 카드/타일 border·background: `.18s`~`.2s ease`
- lift hover: `transform:translateY(-2px)`
- 2단계 노출: `opacity .22s ease`
- 사이드바 링크: `color .16s, border-color .16s`

**포커스** — 모든 인터랙티브 요소에 `:focus-visible { outline:2px solid #b68235; outline-offset:2px }`. 브라우저 기본 파란 링 금지.

**터치 타깃** — 모바일 44px 이상. 투표 버튼 48px, 등록/변경 버튼 44px.

**반응형** — 데스크톱 1120px 기준, 모바일 390px 기준. 중간 구간은 미정의. 데스크톱 `1fr/280px` 2단은 모바일에서 세로 스택, 요일 격자는 3×2 → 6×1, 직업 격자는 8열 → 4열.

## State Management

홈:
- `openModal: 'gb' | 'ec' | null`
- `ecTab: 'acc' | 'rate'`

직업 등록:
- `branch: 'succession' | 'awakening' | 'other' | null`
- `selectedClass: string | null` (branch 변경 시 null로 리셋)
- 파생: `canSubmit = branch !== null && selectedClass !== null`

데이터 페칭 (기존 코드베이스 연동):
- 요일별 설문 목록 — 6요일치, 각각 `{ day, date, node, state: '마감'|'진행'|'예정', myVote: VotingType | null }`
- 내 등록 직업 — `{ class, branch, isPrimary }[]`
- 참고 자료 표 — 정적 데이터. 클라이언트 상수로 두어도 무방하나 운영진이 갱신할 수 있게 JSON 분리 권장.

## Design Tokens

Classical 디자인 시스템 값. `src/app/theme.css`에 그대로 옮긴다.

**Color**

| 역할 | 값 |
| --- | --- |
| 배경(지면) | `#f3f2f2` |
| 표면(사이드바·매트) | `#eae9e9` |
| 본문 텍스트 | `#201f1d` |
| 보조 텍스트 | `#605d5d` |
| 흐린 텍스트 | `#7d7979` |
| 헤어라인 | `rgba(32,31,29,.16)` |
| 표 행 구분선 | `rgba(32,31,29,.12)` |
| 강조(금색) | `#b68235` |
| 강조 딥(텍스트용) | `#7d5411` |
| 강조 딥2(선택 텍스트) | `#5a3b0a` |
| 강조 틴트(선택 배경·hover) | `#fff3e4` |
| 다크 지면 | `#1a1918` |
| 다크 위 텍스트 | `#f3f2f2` / 보조 `#bab6b6` / `#e2e0dd` |
| 다크 위 금색 | `#e1ad66` / `#facb8d` |
| 전승 마크 테두리 | `#5b7fb5` |
| 각성 마크 테두리 | `#b0555f` |

**Typography**

| 용도 | 값 |
| --- | --- |
| 헤딩 | Cormorant Garamond, weight 600 (디스플레이 크기는 400) |
| 한글 헤딩·본문 | Nanum Myeongjo |
| 라틴 본문 | Lora |
| 숫자·키커·메타 | JetBrains Mono, `font-variant-numeric: tabular-nums` |

크기: 74 / 62 / 52 / 46 / 44 / 36 / 34 / 30 / 28 / 26 / 24 / 22 / 19 / 18 / 17 / 15 / 14 / 13.5 / 13 / 12.5 / 12 / 11.5 / 11 / 10.5 / 10
키커: mono 10~10.5px, `letter-spacing:.14em`~`.16em`
본문 line-height: 1.75~1.85, 정렬은 `text-align:justify` + `text-wrap:pretty`

**Spacing** — 4.6 / 6 / 7 / 9.2 / 11 / 13.8 / 15 / 18.4 / 22 / 27.6 / 36.8 / 46 (Classical density 1.15× 스케일)

**Radius** — 4px (마크 매트만 50%)

**Shadow** — `0 3px 10px rgba(45,43,43,.12)` (카드) / `0 8px 28px rgba(45,43,43,.22)` (모달)

**스크림 그라디언트**
- 밝은 지면 밴드: 하단 72% `linear-gradient(180deg, transparent, rgba(26,25,24,.82))`
- 다크 히어로: `linear-gradient(180deg, rgba(26,25,24,.86), rgba(26,25,24,.5) 42%, rgba(26,25,24,.94))`

## Assets

**직업 아이콘** — `classes/*.png` **32종**. 이 중 29종은 저장소 `public/classes/`에 이미 있고, **오공·세라핀·에이전트 3종은 신규**이므로 이 번들의 `classes/`에서 가져가야 한다.

원본은 **흰 선화**라 밝은 지면에서 그대로 쓸 수 없다. CSS 필터로 처리:

| 상태 | filter |
| --- | --- |
| 기본(밝은 지면) | `invert(1) sepia(.4) brightness(.78) contrast(1.05)` |
| 선택/호버(밝은 지면) | `invert(1) sepia(.75) saturate(1.6) brightness(.52) contrast(1.1)` |
| 다크 지면 | `brightness(1.06) saturate(.9)` (원색 유지) |

**아이콘 정규화 규칙** — 오공·세라핀 원본은 검은 선화로 들어와 기존 세트와 반대였다. 필터를 직업마다 분기하면 관리가 무너지므로 **원본 파일을 흰 선화로 정규화**해 저장했다(알파 유지, RGB만 255로). 이 번들의 파일이 정규화된 버전이다. **앞으로 추가되는 아이콘도 저장 시점에 흰 선화로 맞춘다** — 필터를 늘리지 않는다.

**계열 마크** — `marks/succession.png`(파랑, 전승) / `marks/awakening.png`(붉은색, 각성) + 개방·재능 직업별 마크 5종. 모두 사용자 제공 픽셀 아트이며 이 번들의 `marks/`에 있다. `public/marks/`로 옮기면 된다.

마크 배지 규칙:
```css
position:absolute; right:-5px; bottom:-4px;
width:17px; height:17px; border-radius:50%;
background:#f3f2f2;                      /* 다크 지면에서는 #1a1918 */
border:1px solid #5b7fb5;                /* 각성은 #b0555f */
display:flex; align-items:center; justify-content:center; overflow:hidden;
```
내부 이미지 `image-rendering:pixelated; max-width:11px; max-height:13px`

크기 단계 (아이콘 / 마크): 26/14 표 행, 34/17 모바일 격자, 40/17 데스크톱 격자, 56/22 프로필. **22px 초과 금지**(픽셀 원본).

**기타(개방·재능) 계열은 공용 마크를 쓰지 않는다.** 직업마다 고유한 무기 마크를 같은 자리·같은 크기·같은 매트로 달되, 테두리만 중립 헤어라인 `rgba(32,31,29,.22)`을 쓴다.

| 직업 | 마크 파일 | 모티프 |
| --- | --- | --- |
| 데드아이 | `marks/deadeye.png` | 총 |
| 스칼라 | `marks/scholar.png` | 망치 |
| 아처 | `marks/archer.png` | 활 |
| 샤이 | `marks/shai.png` | 음표 |
| 오공 | `marks/wukong.png` | 봉 |

세라핀 · 에이전트 · 드라카니아 · 우사 · 매구 · 도사의 마크는 **아직 없다.** 받는 대로 같은 규칙으로 추가한다. 그때까지는 마크 없이 아이콘만 표시하고, 빈 자리를 다른 표시로 채우지 않는다.

**월페이퍼** — 프로토타입에서는 드래그앤드롭 placeholder(`image-slot`)로 처리했다. 실제 이미지는 미정. 히어로 밴드 배경으로 `object-fit:cover` + 스크림. **한 화면에 한 곳만** 사용한다.

**폰트** — Google Fonts: Cormorant Garamond, Lora, Nanum Myeongjo, JetBrains Mono.

## 폐기된 방향 (구현하지 말 것)

프로토타입 파일 아래쪽 턴에 남아 있는 안들:

- 전체 배경 월페이퍼(3a) — 베일 88%가 필요해 월페이퍼가 흐려짐. **상단 밴드만(3b) 채택**
- 다크 테마 전면 적용(2a) — 참고용으로만 남김
- 참여 명단 / 직업별 참여 집계 / 순번 / 응답 수치 공개 — **모두 제거 결정**. 지휘부 전용 화면에서만 확인
- 주 단위 설문 구조 — 요일 단위로 대체
- 턴 5(`#5a` `#5b`)의 홈 안 — 마크 규칙 참고용으로만 남긴 것. **확정 홈은 `#6a` / `#6b`**

## Files

- `아시바당 Site Mockups.dc.html` — 전체 프로토타입. 브라우저에서 바로 열린다. 최신 턴이 위, 구현 대상은 `#6a` `#6b` `#4a` `#4b` `#7a` `#7b` `#7c`
- `image-slot.js` — 프로토타입의 월페이퍼 placeholder 컴포넌트. **구현에는 불필요**
- `support.js` — 프로토타입 런타임. **구현에는 불필요**
- `marks/*.png` — 계열 마크 원본 7종(전승·각성 공용 2종 + 개방·재능 직업별 5종)
- `classes/*.png` — 직업 아이콘 32종(흰 선화로 정규화된 버전)
- `github.md` — 저장소 연결 기록
