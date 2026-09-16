/*
 * 서버가 지금 화면을 그리는 시각.
 *
 * 화면 안에서 Date.now() 를 바로 부르면 "렌더 중에는 순수한 함수만" 규칙에 걸린다.
 * 서버 컴포넌트는 요청마다 한 번 도는 것이라 값이 흔들릴 일이 없으므로, 규칙을 끄는
 * 대신 이 함수를 통해 읽는다.
 */
export function serverRenderTime(): number {
  return Date.now();
}
