"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 *
 * 한 번만 맞추면 하루이틀 열어둔 탭에서는 그 값이 낡는다. 브라우저 시계가
 * 조금씩 흐르고, 절전에서 깨어나면 튀고, 백그라운드 탭은 타이머가 늦춰진다.
 * 그래서 두 시점에 다시 맞춘다.
 *
 *   - 탭이 다시 보일 때. 절전 복귀와 탭 전환을 한꺼번에 잡는다.
 *   - resyncAt 이 주어지면 그 시각 직전에 한 번 더. 투표가 열리는 순간이
 *     가장 정확해야 하는 지점이라, 거기에 맞춰 새로 잰다.
 *
 * @param resyncAt 이 시각(epoch ms) 직전에 한 번 더 맞춘다. 없으면 생략한다.
 */
export function useServerClockOffset(resyncAt?: number | null): number {
  const [offset, setOffset] = useState(0);
  // 측정이 겹치면 왕복 시간이 서로를 밀어 값이 나빠진다. 한 번에 하나만 돈다.
  const measuring = useRef(false);

  const measure = useCallback(async () => {
    if (measuring.current) return;
    measuring.current = true;
    try {
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
      if (best) setOffset(best.offset);
    } finally {
      measuring.current = false;
    }
  }, []);

  // 처음 한 번, 그리고 탭이 다시 보일 때마다.
  useEffect(() => {
    void measure();
    const onVisible = () => {
      if (document.visibilityState === "visible") void measure();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [measure]);

  // 지정한 시각 60초 전에 한 번 더. 이미 지났으면 걸지 않는다.
  useEffect(() => {
    if (!resyncAt) return;
    const delay = resyncAt - 60_000 - (Date.now() + offset);
    if (delay <= 0) return;
    const timer = setTimeout(() => void measure(), delay);
    return () => clearTimeout(timer);
    // offset 이 갱신될 때마다 다시 걸면 타이머가 계속 새로 잡히므로 제외한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resyncAt, measure]);

  return offset;
}
