import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 배포를 구분하는 값.
 *
 * 투표 버튼은 빌드할 때 정해지는 번호로 서버 함수를 부른다. 새로 배포하면 그 번호가
 * 바뀌므로, 배포 전에 열어 둔 탭에서 버튼을 누르면 서버가 알아보지 못하고 거절한다.
 * 공지에서 링크를 미리 열어두라고 안내하니 그런 탭이 늘 있다. 화면이 이 값을 보고
 * 스스로 새로 고침하게 하려는 것이다.
 *
 * .next/BUILD_ID 는 빌드마다 새로 생기고 같은 빌드를 다시 띄우면 그대로다. 못 읽으면
 * 프로세스가 뜬 시각으로 갈음한다 — 다시 띄울 때마다 한 번씩 새로 고침을 시키지만,
 * 서버가 모르는 버튼을 쥔 채로 두는 것보다는 낫다.
 */
const fallback = globalThis as { __unionBootId?: string };
fallback.__unionBootId ??= String(Date.now());

let cached: string | null = null;

export function buildId(): string {
  if (cached) return cached;
  try {
    cached = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || fallback.__unionBootId!;
  } catch {
    cached = fallback.__unionBootId!;
  }
  return cached;
}
