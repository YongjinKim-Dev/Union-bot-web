"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { type DrawEntry, type DrawOutcome, buildLadder, runDraw } from "@/lib/draw";
import type { MemberSuggestion } from "@/lib/memberQueries";
import type { DrawRow } from "@/lib/drawQueries";
import { formatKstDateTime } from "@/lib/format";
import styles from "./admin.module.css";
import { LadderBoard } from "./LadderBoard";
import { fetchDrawEntriesAction, fetchDrawsAction, newSeedAction, saveDrawAction, searchMembersAction } from "./drawActions";

interface Picked extends DrawEntry {
  avatarUrl: string;
  guildName: string | null;
}

/*
 * 정원이 넘쳐 남은 자리를 나눌 때 쓴다. 투표 명단과는 따로 선다 — 뽑을 일은
 * 그것 말고도 생기고, 투표 순번 규칙을 건드리지 않는 편이 안전하다.
 *
 * 씨앗을 먼저 내보이고 뽑는다. 뽑은 뒤에 씨앗을 공개하면 그 씨앗이 원래 것인지
 * 알 수 없다. 추첨 전에 디스코드에 올려 두면 나중에 누구든 검증할 수 있다.
 */
export function DrawTab() {
  const [title, setTitle] = useState("");
  const [pickCount, setPickCount] = useState(1);
  const [seed, setSeed] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MemberSuggestion[]>([]);
  const [outcome, setOutcome] = useState<DrawOutcome | null>(null);
  const [running, setRunning] = useState(false);
  /* 새로 뽑을 때마다 사다리를 통째로 다시 세우려고 센다. */
  const [runId, setRunId] = useState(0);
  /*
   * 사다리에 넘기는 함수는 렌더마다 새로 만들면 안 된다. 새 함수가 갈 때마다
   * 저쪽 효과가 다시 돌아 애니메이션이 처음으로 되돌아가고, 끝나지 않는다.
   */
  const finish = useCallback(() => setRunning(false), []);
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null);
  const [history, setHistory] = useState<DrawRow[]>([]);
  const [openDraw, setOpenDraw] = useState<{ id: string; entries: { nickname: string; isWinner: boolean }[] } | null>(null);
  const [isBusy, startBusy] = useTransition();

  const loadHistory = useCallback(() => {
    startBusy(async () => {
      try { setHistory(await fetchDrawsAction()); } catch { /* 다시 열면 회복된다 */ }
    });
  }, []);
  useEffect(() => {
    loadHistory();
    newSeedAction().then(setSeed).catch(() => {});
  }, [loadHistory]);

  // 검색은 타자를 멈춘 뒤에 한 번만 보낸다.
  useEffect(() => {
    const timer = setTimeout(async () => {
      try { setSuggestions(await searchMembersAction(query)); } catch { setSuggestions([]); }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const pickedNames = useMemo(() => new Set(picked.map((p) => p.nickname)), [picked]);
  const entries: DrawEntry[] = useMemo(
    () => picked.map((p) => ({ userId: p.userId, nickname: p.nickname })),
    [picked],
  );
  // 사다리는 이름순으로 선다. 넣은 순서가 결과를 바꾸지 않게 하려는 것이다.
  const startOrder = useMemo(
    () => [...picked].sort((a, b) => a.nickname.localeCompare(b.nickname, "ko")),
    [picked],
  );
  const ladder = useMemo(() => {
    if (!outcome) return null;
    const names = startOrder.map((p) => p.nickname);
    return buildLadder(outcome.order.map((e) => names.indexOf(e.nickname)));
  }, [outcome, startOrder]);

  function add(member: MemberSuggestion) {
    if (pickedNames.has(member.nickname)) return;
    setPicked((prev) => [...prev, { userId: member.id, nickname: member.nickname, avatarUrl: member.avatarUrl, guildName: member.guildName }]);
    setQuery("");
    setOutcome(null);
    setNotice(null);
  }
  function remove(nickname: string) {
    setPicked((prev) => prev.filter((p) => p.nickname !== nickname));
    setOutcome(null);
  }

  function start() {
    if (picked.length < 2) return setNotice({ error: true, text: "참여자가 두 명 이상이어야 해요." });
    if (pickCount < 1 || pickCount >= picked.length) {
      return setNotice({ error: true, text: "뽑을 인원은 1명 이상, 참여자 수보다 적어야 해요." });
    }
    setNotice(null);
    setOutcome(runDraw(entries, pickCount, seed));
    setRunId((n) => n + 1);
    setRunning(true);
  }

  function save() {
    if (!outcome) return;
    startBusy(async () => {
      const result = await saveDrawAction({ title, surveyId: null, seed, pickCount, entries });
      if (!result.ok) return setNotice({ error: true, text: result.message });
      setNotice({ text: "추첨 결과를 남겼어요." });
      loadHistory();
    });
  }

  async function reset() {
    setOutcome(null);
    setRunning(false);
    setNotice(null);
    try { setSeed(await newSeedAction()); } catch { /* 쓰던 씨앗을 그대로 둔다 */ }
  }

  async function copyResult() {
    if (!outcome) return;
    const text = [
      `[${title.trim() || "추첨"}] 참여 ${picked.length}명 중 ${pickCount}명`,
      `씨앗 ${seed}`,
      "",
      ...outcome.winners.map((w, i) => `${i + 1}. ${w.nickname}`),
    ].join("\n");
    try { await navigator.clipboard.writeText(text); setNotice({ text: "당첨자 명단을 복사했어요." }); }
    catch { setNotice({ error: true, text: "복사 권한을 확인해 주세요." }); }
  }

  async function openHistory(id: string) {
    if (openDraw?.id === id) return setOpenDraw(null);
    const rows = await fetchDrawEntriesAction(id);
    setOpenDraw({ id, entries: rows.map((r) => ({ nickname: r.nickname, isWinner: r.isWinner })) });
  }

  return (
    <section className={styles.opStack}>
      <h2 className={styles.rosterTitle}>추첨</h2>
      <p className={styles.hint}>
        정원이 넘쳐 남은 자리를 나눌 때 씁니다. 씨앗을 먼저 디스코드에 올린 뒤 뽑으면,
        나중에 누구든 같은 씨앗으로 같은 결과가 나오는지 확인할 수 있습니다.
        사다리는 실제 결과로 이어지므로 손으로 따라가도 같은 자리에 닿습니다.
      </p>

      <div className={styles.card}>
        <div className={styles.drawSetup}>
          <label className={styles.drawField}>
            <span className={styles.label}>추첨 이름</span>
            <input className={styles.input} value={title} maxLength={60}
              placeholder="예) 09-10 거점전 남은 자리" onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className={styles.drawField}>
            <span className={styles.label}>뽑을 인원</span>
            <input className={`${styles.input} ${styles.mono}`} type="number" min={1} value={pickCount}
              onChange={(e) => { setPickCount(Math.max(1, Math.trunc(Number(e.target.value) || 1))); setOutcome(null); }} />
          </label>
          <label className={styles.drawField}>
            <span className={styles.label}>씨앗 (미리 공개)</span>
            <span className={styles.seedRow}>
              <code className={`${styles.seed} ${styles.mono}`}>{seed || "…"}</code>
              <button type="button" className={styles.btnXs} onClick={reset} disabled={isBusy}>새로</button>
            </span>
          </label>
        </div>

        <div className={styles.drawSearch}>
          <label className={styles.label} htmlFor="draw-search">참여자 추가</label>
          <input id="draw-search" className={styles.input} value={query} placeholder="닉네임으로 찾기"
            onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          {suggestions.length > 0 && (
            <ul className={styles.suggestList}>
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button type="button" className={styles.suggestItem} disabled={pickedNames.has(s.nickname)}
                    onClick={() => add(s)}>
                    <Image src={s.avatarUrl} alt="" width={24} height={24} className={styles.suggestAvatar} unoptimized />
                    <span className={styles.suggestName}>{s.nickname}</span>
                    <span className={styles.suggestGuild}>{s.guildName ?? "소속 없음"}</span>
                    <span className={styles.suggestAdd}>{pickedNames.has(s.nickname) ? "추가됨" : "+"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.rosterBar}>
          <span className={styles.label}>참여자 {picked.length}명 · 뽑을 인원 {pickCount}명</span>
          <span className={styles.spacer} />
          <button type="button" className={styles.btnSm} onClick={() => { setPicked([]); setOutcome(null); }}
            disabled={!picked.length}>모두 지우기</button>
          <button type="button" className={`${styles.btnSm} ${styles.btnPrimary}`} onClick={start}
            disabled={picked.length < 2 || running}>{running ? "뽑는 중…" : "추첨 시작"}</button>
        </div>

        {notice && <p role={notice.error ? "alert" : "status"} className={styles.hint}>{notice.text}</p>}

        {picked.length > 0 && (
          <ul className={styles.pickedList}>
            {picked.map((p) => (
              <li key={p.nickname} className={styles.pickedChip}>
                <Image src={p.avatarUrl} alt="" width={22} height={22} className={styles.suggestAvatar} unoptimized />
                <span>{p.nickname}</span>
                <button type="button" className={styles.pickedRemove} aria-label={`${p.nickname} 빼기`}
                  onClick={() => remove(p.nickname)}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {outcome && ladder && (
        <div className={styles.card}>
          <div className={styles.rosterBar}>
            <span className={styles.label}>씨앗 {seed} · {picked.length}명 중 {pickCount}명</span>
            <span className={styles.spacer} />
            <button type="button" className={styles.btnSm} onClick={copyResult} disabled={running}>당첨자 복사</button>
            <button type="button" className={styles.btnSm} onClick={save} disabled={running || isBusy}>결과 남기기</button>
          </div>
          <LadderBoard key={runId} ladder={ladder} entries={startOrder} pickCount={pickCount} running={running}
            onFinish={finish} />
          {!running && (
            <ol className={styles.winnerList}>
              {outcome.winners.map((w) => (
                <li key={w.nickname}>{w.nickname}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.rosterBar}>
          <span className={styles.label}>지난 추첨 {history.length}건</span>
          <span className={styles.spacer} />
          <button type="button" className={styles.btnSm} onClick={loadHistory} disabled={isBusy}>새로 고침</button>
        </div>
        {!history.length && <p className={styles.hint}>아직 남긴 추첨이 없습니다.</p>}
        <ol className={styles.specList}>
          {history.map((row) => (
            <li key={row.id} className={openDraw?.id === row.id ? styles.specOpen : undefined}>
              <button type="button" className={styles.drawRow} onClick={() => openHistory(row.id)}
                aria-expanded={openDraw?.id === row.id}>
                <span className={styles.specName}><span className={styles.specNick}>{row.title}</span></span>
                <span className={`${styles.specParts} ${styles.mono}`}>{row.entryCount}명 중 {row.pickCount}명</span>
                <span className={`${styles.specParts} ${styles.mono}`}>씨앗 {row.seed}</span>
                <span className={`${styles.specTime} ${styles.mono}`}>{formatKstDateTime(new Date(row.createdAt))}</span>
                <span className={styles.specChevron} aria-hidden="true">{openDraw?.id === row.id ? "▴" : "▾"}</span>
              </button>
              {openDraw?.id === row.id && (
                <div className={styles.specPanel}>
                  <ul className={styles.pickedList}>
                    {openDraw.entries.map((e) => (
                      <li key={e.nickname} className={`${styles.pickedChip} ${e.isWinner ? styles.pickedWon : ""}`}>
                        <span>{e.nickname}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
