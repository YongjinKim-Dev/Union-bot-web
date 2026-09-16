import { NextResponse } from "next/server";
import { buildId } from "@/lib/buildId";

export const dynamic = "force-dynamic";

/**
 * 서버의 현재 시각(ms)과 지금 돌고 있는 배포의 번호.
 *
 * 각자 PC 시계가 몇 초씩 어긋나 있으면 카운트다운이 0 이 되는 순간도 사람마다
 * 달라진다. 클라이언트는 이 응답의 왕복 시간을 재서 보정치를 구하고, 그 뒤로는
 * 서버 시각 기준으로 남은 시간을 계산한다.
 *
 * 배포 번호는 화면이 들고 있는 것과 달라졌는지 보라고 같이 준다. 달라졌다면 그
 * 화면의 투표 버튼은 이미 서버가 알아보지 못하는 상태다.
 */
export function GET() {
  return NextResponse.json(
    { now: Date.now(), build: buildId() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
