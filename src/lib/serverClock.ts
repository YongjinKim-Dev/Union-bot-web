"use client";

import { useEffect, useState } from "react";

const SAMPLES = 3;

/**
 * 서버 시계와 이 브라우저 시계의 차이(ms). 반환값을 Date.now() 에 더하면 서버
 * 시각이 된다.
 *
 * /api/time 을 몇 번 호출해 왕복 시간이 가장 짧았던 표본을 쓴다. 응답에 담긴
 * 서버 시각은 요청을 보낸 시점과 받은 시점의 중간쯤에 찍힌 것으로 보고
 * 보정하는, NTP 가 쓰는 방식과 같다. 표본을 여러 번 받는 이유는 한 번은 하필
 * 느린 왕복에 걸릴 수 있어서다.
 *
 * 초기값 0 은 "내 시계가 곧 서버 시계" 라는 뜻이다. 보정치를 받기 전 잠깐은
 * 기존과 다를 바 없이 동작하고, 받은 뒤부터 모두가 같은 순간에 맞춰진다.
 */
export function useServerClockOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let best: { offset: number; rtt: number } | null = null;
      for (let i = 0; i < SAMPLES; i += 1) {
        const sentAt = Date.now();
        try {
          const res = await fetch("/api/time", { cache: "no-store" });
          const { now } = (await res.json()) as { now: number };
          const receivedAt = Date.now();
          const rtt = receivedAt - sentAt;
          // 응답이 오는 데 걸린 시간의 절반만큼 서버 시각이 흘렀다고 본다.
          const sample = { offset: now + rtt / 2 - receivedAt, rtt };
          if (!best || sample.rtt < best.rtt) best = sample;
        } catch {
          // 네트워크가 흔들리면 그 표본만 버린다.
        }
      }
      if (!cancelled && best) setOffset(best.offset);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return offset;
}
