"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type DrawEntry, type DrawPlan, MAX_PER_LADDER, ladderForGroup, planDraw,
} from "@/lib/draw";
import type { MemberSuggestion } from "@/lib/memberQueries";
import { LadderBoard, scaleFor } from "./LadderBoard";
import styles from "./draw.module.css";
import { newSeedAction, saveDrawAction, searchMembersAction } from "@/app/admin/drawActions";

interface Picked extends DrawEntry {
  avatarUrl: string;
  guildName: string | null;
}

/** 버튼을 안 눌러도 이만큼 지나면 다음 라운드로 간다. */
const AUTO_NEXT_SECONDS = 10;

/*
 * 다 같이 보는 추첨 화면. 참여자를 여기서 넣고 시작 단추로 진행한다.
 *
 * 뽑기는 씨앗 하나가 정하고(planDraw), 사다리는 그 결과를 정직하게 옮겨 적는다.
 * 열두 명이 넘으면 조로 나눠 라운드를 치른다 — 조는 화면을 위한 것이고 확률은
 * 전체 섞기가 책임진다.
 */
export function DrawStage() {
  const [title, setTitle] = useState("");
  const [pickCount, setPickCount] = useState(1);
  const [seed, setSeed] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<MemberSuggestion[]>([]);

  const [plan, setPlan] = useState<DrawPlan | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [running, setRunning] = useState(false);
  /* 자동 진행이 일어날 시각. 남은 초는 그릴 때 계산한다. */
  const [autoAt, setAutoAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  /* 한 라운드에 사다리가 여럿이라 몇 개가 끝났는지 센다. 그리는 데 쓰지 않으므로 ref 다. */
  const finishedRef = useRef(0);
  const expectedRef = useRef(0);
  const lastRoundRef = useRef(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { newSeedAction().then(setSeed).catch(() => {}); }, []);
  useEffect(() => {
    const timer = setTimeout(async () => {
      try { setSuggestions(await searchMembersAction(query)); } catch { setSuggestions([]); }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const pickedNames = useMemo(() => new Set(picked.map((p) => p.nickname)), [picked]);
  const entries: DrawEntry[] = useMemo(
    () => picked.map((p) => ({ userId: p.userId, nickname: p.nickname })), [picked],
  );
  const round = plan?.rounds[roundIndex] ?? null;
  const isLastRound = plan !== null && roundIndex === plan.rounds.length - 1;

  const ladders = useMemo(() => {
    if (!round || !plan) return [];
    return round.groups.map((group, i) => ({ group, ...ladderForGroup(group, plan.seed, `r${roundIndex}g${i}`) }));
  }, [round, plan, roundIndex]);
  /* 한 라운드 안에서는 조마다 크기가 같아야 나란히 놓았을 때 어색하지 않다. */
  const scale = useMemo(
    () => scaleFor(Math.max(1, ...ladders.map((l) => l.ladder.columns))), [ladders]);

  /* 한 라운드의 사다리가 모두 끝나야 다음으로 넘어간다. */
  const onOneFinished = useCallback(() => {
    finishedRef.current += 1;
    if (finishedRef.current < expectedRef.current) return;
    setRunning(false);
    if (lastRoundRef.current) return;
    setAutoAt(Date.now() + AUTO_NEXT_SECONDS * 1000);
    setRemaining(AUTO_NEXT_SECONDS);
  }, []);

  const enterRound = useCallback((source: DrawPlan, index: number) => {
    finishedRef.current = 0;
    expectedRef.current = source.rounds[index].groups.length;
    lastRoundRef.current = index === source.rounds.length - 1;
    setRoundIndex(index);
    setAutoAt(null);
    setRemaining(null);
    setRunning(true);
  }, []);

  const goNext = useCallback(() => {
    if (plan && roundIndex + 1 < plan.rounds.length) enterRound(plan, roundIndex + 1);
  }, [plan, roundIndex, enterRound]);

  /* 10 초 동안 아무도 누르지 않으면 알아서 넘어간다. */
  useEffect(() => {
    if (autoAt === null) return;
    const ticking = setInterval(
      () => setRemaining(Math.max(0, Math.ceil((autoAt - Date.now()) / 1000))), 250);
    const advance = setTimeout(goNext, Math.max(0, autoAt - Date.now()));
    return () => { clearInterval(ticking); clearTimeout(advance); };
  }, [autoAt, goNext]);

  function add(member: MemberSuggestion) {
    if (pickedNames.has(member.nickname)) return;
    setPicked((prev) => [...prev, { userId: member.id, nickname: member.nickname, avatarUrl: member.avatarUrl, guildName: member.guildName }]);
    setQuery("");
  }

  function start() {
    if (picked.length < 2) return setNotice("참여자가 두 명 이상이어야 해요.");
    if (pickCount < 1 || pickCount >= picked.length) return setNotice("뽑을 인원은 1명 이상, 참여자 수보다 적어야 해요.");
    setNotice("");
    const next = planDraw(entries, pickCount, seed);
    setPlan(next);
    enterRound(next, 0);
  }

  async function reset() {
    setPlan(null); setRoundIndex(0); setRunning(false);
    finishedRef.current = 0; expectedRef.current = 0; lastRoundRef.current = false;
    setAutoAt(null); setRemaining(null); setNotice(""); setSaved(false);
    try { setSeed(await newSeedAction()); } catch { /* 쓰던 씨앗을 둔다 */ }
  }

  async function save() {
    if (!plan) return;
    const result = await saveDrawAction({ title, surveyId: null, seed, pickCount, entries });
    setNotice(result.ok ? "결과를 남겼어요." : result.message);
    if (result.ok) setSaved(true);
  }

  async function copyWinners() {
    if (!plan) return;
    const text = [
      `[${title.trim() || "추첨"}] 참여 ${picked.length}명 중 ${pickCount}명`,
      `씨앗 ${seed}`, "",
      ...plan.winners.map((w, i) => `${i + 1}. ${w.nickname}`),
    ].join("\n");
    try { await navigator.clipboard.writeText(text); setNotice("당첨자 명단을 복사했어요."); }
    catch { setNotice("복사 권한을 확인해 주세요."); }
  }

  return (
    <div className={styles.stage}>
      <header className={styles.stageHead}>
        <h1 className={styles.stageTitle}>{title.trim() || "추첨"}</h1>
        <span className={styles.stageMeta}>
          씨앗 {seed || "…"}
          {plan && ` · ${picked.length}명 중 ${pickCount}명 · ${roundIndex + 1}/${plan.rounds.length} 라운드`}
        </span>
        <span className={styles.spacer} />
        {plan && <button type="button" className={styles.btn} onClick={reset}>처음부터</button>}
      </header>

      <div className={styles.stageBody}>
        {!plan ? (
          <div className={styles.setup}>
            <div className={styles.setupRow}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>추첨 이름</span>
                <input className={styles.input} value={title} maxLength={60}
                  placeholder="예) 09-10 거점전 남은 자리" onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>뽑을 인원</span>
                <input className={styles.input} type="number" min={1} value={pickCount}
                  onChange={(e) => setPickCount(Math.max(1, Math.trunc(Number(e.target.value) || 1)))} />
              </label>
            </div>

            <div className={`${styles.field} ${styles.searchWrap}`}>
              <span className={styles.fieldLabel}>참여자 추가 · 현재 {picked.length}명</span>
              <input className={styles.input} value={query} placeholder="닉네임으로 찾기" autoComplete="off"
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearching(true)} onBlur={() => setSearching(false)}
                onKeyDown={(e) => { if (e.key === "Escape") { setSearching(false); e.currentTarget.blur(); } }} />
              {searching && suggestions.length > 0 && (
                <ul className={styles.suggest} onMouseDown={(e) => e.preventDefault()}>
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button type="button" className={styles.suggestItem} disabled={pickedNames.has(s.nickname)}
                        onClick={() => add(s)}>
                        <Image src={s.avatarUrl} alt="" width={26} height={26} className={styles.avatar} unoptimized />
                        <span>{s.nickname}</span>
                        <span className={styles.spacer} />
                        <span className={styles.fieldLabel}>{s.guildName ?? "소속 없음"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {picked.length > 0 && (
              <ul className={styles.roster}>
                {picked.map((p) => (
                  <li key={p.nickname} className={styles.rosterChip}>
                    <Image src={p.avatarUrl} alt="" width={22} height={22} className={styles.avatar} unoptimized />
                    <span>{p.nickname}</span>
                    <button type="button" className={styles.rosterRemove} aria-label={`${p.nickname} 빼기`}
                      onClick={() => setPicked((prev) => prev.filter((x) => x.nickname !== p.nickname))}>×</button>
                  </li>
                ))}
              </ul>
            )}

            {notice && <p role="status" className={styles.fieldLabel}>{notice}</p>}
            {picked.length > MAX_PER_LADDER && (
              <p className={styles.fieldLabel}>
                {MAX_PER_LADDER}명이 넘어 조로 나눠 치릅니다. 확률은 전체를 한 번에 섞어 정하므로 조 배정으로 유불리가 생기지 않습니다.
              </p>
            )}
            <button type="button" className={styles.startBtn} onClick={start} disabled={picked.length < 2 || !seed}>
              추첨 시작
            </button>
          </div>
        ) : (
          <>
            <div className={styles.roundHead}>
              <span className={styles.roundName}>
                {isLastRound ? "결승" : `${roundIndex + 1}라운드`}
              </span>
              <span className={styles.roundNote}>
                {round && `${round.groups.length}개 조 · ${round.groups.reduce((n, g) => n + g.entries.length, 0)}명 중 ${round.groups.reduce((n, g) => n + g.pick, 0)}명이 ${isLastRound ? "당첨" : "다음 라운드로"}`}
              </span>
            </div>

            <div className={styles.groups}>
              {ladders.map(({ group, start: startOrder, ladder }, i) => (
                <div key={i} className={styles.group}>
                  <div className={styles.groupHead}>
                    <span className={styles.groupName}>{round!.groups.length > 1 ? `${i + 1}조` : "전체"}</span>
                    <span className={styles.groupPick}>{group.entries.length}명 중 {group.pick}명</span>
                  </div>
                  <LadderBoard ladder={ladder} entries={startOrder} pickCount={group.pick}
                    running={running} onFinish={onOneFinished} scale={scale} durationMs={2600} />
                </div>
              ))}
            </div>

            {!running && !isLastRound && (
              <div className={styles.nextBar}>
                <button type="button" className={styles.startBtn} onClick={goNext}>다음 라운드</button>
                <span className={styles.countdown}>{remaining !== null ? `${remaining}초` : ""}</span>
              </div>
            )}

            {!running && isLastRound && (
              <>
                <p className={styles.finalHead}>당첨 {plan.winners.length}명</p>
                <ol className={styles.finalList}>
                  {plan.winners.map((w) => <li key={w.nickname}>{w.nickname}</li>)}
                </ol>
                <div className={styles.nextBar}>
                  <button type="button" className={styles.btn} onClick={copyWinners}>당첨자 복사</button>
                  <button type="button" className={styles.btn} onClick={save} disabled={saved}>
                    {saved ? "남김" : "결과 남기기"}
                  </button>
                </div>
                {notice && <p role="status" className={styles.roundNote} style={{ textAlign: "center" }}>{notice}</p>}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
