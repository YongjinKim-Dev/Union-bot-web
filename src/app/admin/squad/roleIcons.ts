/*
 * 역할 그림.
 *
 * 이모지에는 대포도, 화차도, 돛단배도 없다. 그래서 직접 그린다. 그림 파일을
 * 두지 않고 코드 안에 두는 이유가 셋이다 — 받아 올 것이 없고, 색을 판에 맞춰
 * 바꿀 수 있고(이모지는 색이 제멋대로라 어두운 바탕에서 어떤 것은 묻힌다),
 * 키워도 뭉개지지 않는다.
 *
 * 24×24 안에 단순한 실루엣으로 그린다. 표에서는 20px 로 줄어들므로 가는 선과
 * 작은 구멍은 쓰지 않는다. 구멍을 뚫어야 하는 곳(바퀴 축, 코끼리 눈)은 판 색을
 * 그대로 칠해 파낸 것처럼 보이게 한다.
 */

/** 구멍을 파낼 때 칠하는 색. 표의 바탕과 같아야 뚫린 것처럼 보인다. */
const PUNCH = "#17130e";

/** 대포컷의 칼. 날·코등이·자루·머리를 한 획으로 그린다. */
const SWORD =
  "M18.6 0.8L20.5 4.1V12.4H22.9V14.8H19.8V19.8H20.6V21.9H16.6V19.8H17.4V14.8H14.3V12.4H16.7V4.1z";

export const ROLE_ICON_PATH: Record<string, string> = {
  오더:
    `<path d="M3 9h4l9-5v16l-9-5H3z"/><path d="M18 8a5 5 0 010 8" fill="none" stroke="currentColor" stroke-width="2"/>`,
  불퇴: `<path d="M5 2h2.4v20H5z"/><path d="M8.6 3H21l-3.2 4.3L21 11.6H8.6z"/>`,
  수비: `<path d="M12 2l8.5 3.2v5.9c0 5.3-3.7 9-8.5 11.4C7.2 20.1 3.5 16.4 3.5 11.1V5.2z"/>`,
  // 멀리서도 대포인 줄 알아야 해서 포구 쪽을 크게 잡고 구멍을 파 둔다.
  대포:
    `<circle cx="9" cy="18.4" r="4.8"/><circle cx="9" cy="18.4" r="1.6" fill="${PUNCH}"/>` +
    `<circle cx="4.6" cy="11.4" r="3.4"/><path d="M4.2 8.2L18.6 9v4.8L4.2 14.6z"/>` +
    `<path d="M18 6.4h4.8v10H18z"/><path d="M21.2 9.4h1.6v4h-1.6z" fill="${PUNCH}"/>`,
  // 같은 대포를 작게 두고 칼을 앞에 세운다. 칼 둘레를 판 색으로 둘러 겹친 줄 알게 한다.
  대포컷:
    `<circle cx="5.4" cy="19" r="3.6"/><circle cx="5.4" cy="19" r="1.2" fill="${PUNCH}"/>` +
    `<circle cx="2.8" cy="12.6" r="2.5"/><path d="M2.4 10.2L12.6 10.8v3.6L2.4 15z"/>` +
    `<path d="M12.2 8.6h3.3v7.2h-3.3z"/>` +
    `<g stroke="${PUNCH}" stroke-width="2.6" stroke-linejoin="round"><path d="${SWORD}"/></g>` +
    `<path d="${SWORD}"/>`,
  코끼리:
    `<path d="M4.5 9.5a6.5 6.5 0 0113 0V14c0 1.8-1 2.8-2.4 3.2V21h-3.3v-3.6H9.6c-.2 2-1.3 3.6-2.6 3.6-1.5 0-2.6-1.9-2.6-4.2z"/>` +
    `<circle cx="14.6" cy="9" r="1.4" fill="${PUNCH}"/>` +
    `<path d="M17.5 10.5h2.2c1.6 0 2.8 1.2 2.8 2.8V18h-2.4v-4.2h-2.6z"/>`,
  신기전:
    `<rect x="3" y="10" width="13.5" height="6.4" rx="1"/>` +
    `<circle cx="6.5" cy="19.5" r="2.4"/><circle cx="14" cy="19.5" r="2.4"/>` +
    `<path d="M17.6 3.4l4.6 2.2-4.6 2.2.9-2.2z"/><path d="M12.5 5.6h6v1.8h-6z"/>`,
  // 촛불처럼 보이지 않도록 탑을 넓게 두고 꼭대기에 성가퀴를 낸다.
  화염탑:
    `<path d="M6 22v-9h12v9z"/><path d="M5.4 13V10h2.3v1.4h1.6V10h2.3v1.4h1.6V10h2.3v1.4h1.6V10h2.3v3z"/>` +
    `<path d="M12 1.2c1.7 2.8 3.8 3.6 3.8 6.2a3.8 3.8 0 11-7.6 0c0-2.6 2.1-3.4 3.8-6.2z"/>`,
  빌더: `<rect x="4.4" y="2.4" width="15.2" height="6.2" rx="1"/><path d="M10.6 8.6h2.8v12.8h-2.8z"/>`,
  중범선:
    `<path d="M1.5 17.5h21l-3.4 4.5H4.9z"/><path d="M11.1 2h1.8v14h-1.8z"/>` +
    `<path d="M13.6 3.6l6.6 9.4h-6.6z"/><path d="M10.4 6.2L4.2 13h6.2z"/>`,
};

/** 그림으로 보여 줄 수 있는 역할인지. 모르는 꼬리표는 역할로 치지 않는다. */
export function hasRoleIcon(role: string | null | undefined): boolean {
  return Boolean(role && role in ROLE_ICON_PATH);
}

/**
 * 캔버스에는 SVG 를 직접 그릴 수 없어 그림 한 장으로 만들어 넘긴다.
 * 색을 미리 칠해 두므로 판 색이 바뀌면 이 주소도 같이 바뀐다.
 */
export function roleIconDataUrl(role: string, color: string): string {
  const body = ROLE_ICON_PATH[role] ?? "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
