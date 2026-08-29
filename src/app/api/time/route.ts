import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 서버의 현재 시각(ms). 카운트다운을 클라이언트 시계가 아니라 서버 시계에
 * 맞추기 위한 것이다.
 *
 * 각자 PC 시계가 몇 초씩 어긋나 있으면 카운트다운이 0 이 되는 순간도 사람마다
 * 달라진다. 클라이언트는 이 응답의 왕복 시간을 재서 보정치를 구하고, 그 뒤로는
 * 서버 시각 기준으로 남은 시간을 계산한다.
 */
export function GET() {
  return NextResponse.json(
    { now: Date.now() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
