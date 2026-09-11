"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type DrawEntry, type DrawRound, MAX_PER_LADDER, buildRound, nextAdvanceCount, winnersOf,
} from "@/lib/draw";
import type { MemberSuggestion } from "@/lib/memberQueries";
import { LadderBoard } from "./LadderBoard";
import styles from "./draw.module.css";
import { newSeedAction, saveDrawAction, searchMembersAction } from "@/app/admin/drawActions";

interface Picked extends DrawEntry {
  avatarUrl: string;
  guildName: string | null;
}

/** 결과를 보여 준 뒤 아무도 누르지 않으면 이만큼 지나 다음 라운드로 간다. */
const AUTO_NEXT_SECONDS = 10;

/*
 * 다 같이 보는 추첨 화면.
 *
 * 씨앗이 두 가지를 미리 정한다 — 가로줄 배치와, 당첨이 걸린 도착 자리. 둘 다
 * 길이 다 내려올 때까지 화면에 나오지 않으므로 돌리는 사람도 결과를 모른다.
 *
 * 사람들이 어느 열에 설지는 자유롭게 바꿀 수 있다. 당첨 자리를 균등하게 뽑으므로
 * 어느 열이든 확률이 같다(실측 편차 1.6%). 다만 어느 조에 들어가는지는 씨앗이
 * 정한다 — 조 크기가 하나만 달라도 작은 조가 유리해지기 때문이다(실측 19.3%).
 */
export function DrawStage() {
  const [title, setTitle] = useState("");
  const [pickCount, setPickCount] = useState(1);
  const [seed, setSeed] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<MemberSuggestion[]>([]);
  const [capped, setCapped] = useState(false);

  const [phase, setPhase] = useState<"setup" | "arrange" | "running" | "reveal" | "done">("setup");
  const [round, setRound] = useState<DrawRound | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [survivors, setSurvivors] = useState<DrawEntry[]>([]);
  const [winners, setWinners] = useState<DrawEntry[]>([]);
  /* 라운드마다 실제로 세운 자리 순서. 남길 때 서버가 이대로 다시 돌린다. */
  const [arrangements, setArrangements] = useState<string[][][]>([]);
  const [revealed, setRevealed] = useState(false);
  /* 그리는 데 쓰지 않으므로 상태가 아니라 ref 로 센다. */
  const doneRef = useRef(0);
  const expectedRef = useRef(0);
  const roundRef = useRef<DrawRound | null>(null);
  const pickRef = useRef(1);
  const [autoAt, setAutoAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { newSeedAction().then(setSeed).catch(() => {}); }, []);
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const found = await searchMembersAction(query);
        setSuggestions(found.members);
        setCapped(found.capped);
      } catch { setSuggestions([]); setCapped(false); }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const pickedNames = useMemo(() => new Set(picked.map((p) => p.nickname)), [picked]);
  const entries: DrawEntry[] = useMemo(
    () => picked.map((p) => ({ userId: p.userId, nickname: p.nickname })), [picked]);
  const roundSize = round?.groups.reduce((n, g) => n + g.columns.length, 0) ?? 0;
  const roundPick = round?.groups.reduce((n, g) => n + g.pick, 0) ?? 0;
  /* 이번 라운드에서 올릴 인원이 뽑을 인원과 같으면 여기서 끝난다. */
  const isFinalRound = round !== null && roundPick <= pickCount;

  const openRound = useCallback((people: DrawEntry[], index: number) => {
    setRound(buildRound(people, nextAdvanceCount(people.length, pickCount), seed, `r${index}`));
    setRoundIndex(index);
    setSurvivors(people);
    setRevealed(false);
    setAutoAt(null);
    setRemaining(null);
    setPhase("arrange");
  }, [pickCount, seed]);

  /* 한 라운드의 사다리가 모두 내려오면 뽑힌 사람을 추린다. */
  const onOneFinished = useCallback(() => {
    doneRef.current += 1;
    if (doneRef.current < expectedRef.current) return;
    const advanced = (roundRef.current?.groups ?? []).flatMap((g) => winnersOf(g));
    setRevealed(true);
    if (advanced.length <= pickRef.current) {
      setWinners(advanced);
      setPhase("done");
      return;
    }
    setSurvivors(advanced);
    setPhase("reveal");
    setAutoAt(Date.now() + AUTO_NEXT_SECONDS * 1000);
    setRemaining(AUTO_NEXT_SECONDS);
  }, []);

  const goNext = useCallback(() => openRound(survivors, roundIndex + 1), [openRound, survivors, roundIndex]);
  useEffect(() => {
    if (autoAt === null) return;
    const ticking = setInterval(
      () => setRemaining(Math.max(0, Math.ceil((autoAt - Date.now()) / 1000))), 250);
    const advance = setTimeout(goNext, Math.max(0, autoAt - Date.now()));
    return () => { clearInterval(ticking); clearTimeout(advance); };
  }, [autoAt, goNext]);

  /** 조 안에서 한 칸 옆으로 옮긴다. 어느 열이든 확률이 같으므로 마음대로 바꿔도 된다. */
  function move(groupIndex: number, column: number, step: -1 | 1) {
    setRound((prev) => {
      if (!prev) return prev;
      const target = column + step;
      const group = prev.groups[groupIndex];
      if (target < 0 || target >= group.columns.length) return prev;
      const columns = [...group.columns];
      [columns[column], columns[target]] = [columns[target], columns[column]];
      const groups = [...prev.groups];
      groups[groupIndex] = { ...group, columns };
      return { groups };
    });
  }

  function add(member: MemberSuggestion) {
    if (pickedNames.has(member.nickname)) return;
    setPicked((prev) => [...prev, { userId: member.id, nickname: member.nickname, avatarUrl: member.avatarUrl, guildName: member.guildName }]);
    setQuery("");
  }

  function start() {
    if (picked.length < 2) return setNotice("참여자가 두 명 이상이어야 해요.");
    if (pickCount < 1 || pickCount >= picked.length) return setNotice("뽑을 인원은 1명 이상, 참여자 수보다 적어야 해요.");
    setNotice("");
    openRound(entries, 0);
  }

  async function reset() {
    setPhase("setup"); setRound(null); setRoundIndex(0);
    setSurvivors([]); setWinners([]); setRevealed(false); setArrangements([]);
    doneRef.current = 0; expectedRef.current = 0; roundRef.current = null;
    setAutoAt(null); setRemaining(null); setNotice(""); setSaved(false);
    try { setSeed(await newSeedAction()); } catch { /* 쓰던 씨앗을 둔다 */ }
  }

  async function save() {
    const result = await saveDrawAction({
      title, surveyId: null, seed, pickCount, entries,
      arrangements,
    });
    setNotice(result.ok ? "결과를 남겼어요." : result.message);
    if (result.ok) setSaved(true);
  }

  async function copyWinners() {
    const text = [
      `[${title.trim() || "추첨"}] 참여 ${picked.length}명 중 ${pickCount}명`,
      `씨앗 ${seed}`, "",
      ...winners.map((w, i) => `${i + 1}. ${w.nickname}`),
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
          {phase !== "setup" && ` · ${picked.length}명 중 ${pickCount}명 · ${roundIndex + 1}라운드`}
        </span>
        <span className={styles.spacer} />
        {phase !== "setup" && <button type="button" className={styles.btn} onClick={reset}>처음부터</button>}
      </header>

      <div className={styles.stageBody}>
        {phase === "setup" ? (
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
                  {capped && <li className={styles.suggestMore}>너무 많아 일부만 보여 줍니다. 이름을 더 적어 주세요.</li>}
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
                {MAX_PER_LADDER}명이 넘어 조로 나눠 치릅니다. 어느 조에 들어가는지는 씨앗이 정하고 바꿀 수 없습니다.
                조 안에서 몇 번째에 설지는 마음대로 바꿔도 확률이 같습니다.
              </p>
            )}
            <button type="button" className={styles.startBtn} onClick={start} disabled={picked.length < 2 || !seed}>
              추첨 시작
            </button>
          </div>
        ) : phase === "done" ? (
          <>
            <p className={styles.finalHead}>당첨 {winners.length}명</p>
            <ol className={styles.finalList}>
              {winners.map((w) => <li key={w.nickname}>{w.nickname}</li>)}
            </ol>
            <div className={styles.nextBar}>
              <button type="button" className={styles.btn} onClick={copyWinners}>당첨자 복사</button>
              <button type="button" className={styles.btn} onClick={save} disabled={saved}>
                {saved ? "남김" : "결과 남기기"}
              </button>
            </div>
            {notice && <p role="status" className={styles.roundNote} style={{ textAlign: "center" }}>{notice}</p>}
          </>
        ) : (
          <>
            <div className={styles.roundHead}>
              <span className={styles.roundName}>{roundIndex + 1}라운드</span>
              <span className={styles.roundNote}>
                {round && `${round.groups.length}개 조 · ${roundSize}명 중 ${roundPick}명이 ${isFinalRound ? "당첨" : "다음 라운드로"}`}
                {phase === "arrange" && " · 자리를 바꾼 뒤 시작하세요"}
                {phase === "reveal" && " · 다음 라운드로 갈 사람이 정해졌어요"}
              </span>
            </div>

            {/* 사다리가 몇 개든 화면을 가로로 나눠 다 채운다. */}
            <div className={styles.groups}
              style={{ "--group-count": round?.groups.length ?? 1 } as React.CSSProperties}>
              {round?.groups.map((group, i) => (
                <div key={`${roundIndex}-${i}`} className={styles.group}>
                  <div className={styles.groupHead}>
                    <span className={styles.groupName}>{round.groups.length > 1 ? `${i + 1}조` : "전체"}</span>
                    <span className={styles.groupPick}>{group.columns.length}명 중 {group.pick}명</span>
                  </div>
                  <LadderBoard key={`${roundIndex}-${i}`} ladder={group.ladder} entries={group.columns}
                    winningSlots={group.winningSlots} revealed={revealed}
                    running={phase === "running"} onFinish={onOneFinished} />
                  {phase === "arrange" && (
                    <ol className={styles.arrangeRow}>
                      {group.columns.map((entry, column) => (
                        <li key={entry.nickname} className={styles.arrangeChip}>
                          <button type="button" aria-label={`${entry.nickname} 왼쪽으로`}
                            disabled={column === 0} onClick={() => move(i, column, -1)}>◀</button>
                          <span>{entry.nickname}</span>
                          <button type="button" aria-label={`${entry.nickname} 오른쪽으로`}
                            disabled={column === group.columns.length - 1} onClick={() => move(i, column, 1)}>▶</button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.nextBar}>
              {phase === "reveal" && (
                <>
                  <button type="button" className={styles.startBtn} onClick={goNext}>다음 라운드</button>
                  <span className={styles.countdown}>{remaining !== null ? `${remaining}초 뒤 자동으로 넘어갑니다` : ""}</span>
                </>
              )}
              {phase === "arrange" && (
                <>
                  <button type="button" className={styles.startBtn} onClick={() => {
                    // 이 라운드에 실제로 세운 자리를 남겨 둔다.
                    setArrangements((prev) => [...prev.slice(0, roundIndex), (round?.groups ?? []).map((g) => g.columns.map((e) => e.nickname))]);
                    doneRef.current = 0;
                    expectedRef.current = round?.groups.length ?? 0;
                    roundRef.current = round;
                    pickRef.current = pickCount;
                    setRevealed(false); setAutoAt(null); setRemaining(null); setPhase("running");
                  }}>
                    {roundIndex === 0 ? "시작" : "이 라운드 시작"}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
