"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import { autoAssign, baseName, editCell, emptyFormation, memberArt, memberLabel, memberRole, FORMATS, moveMembers, parseMembers, renameParty, ROLES, setRole, SHEET, sheetRows, type CellAddress, type Formation, type FormatKey, type SquadMember } from "./formation";
import { formationImage, roleLegendImage } from "./image";
import { ROLE_ICON_PATH } from "./roleIcons";
import { boardVersionAction, loadBoardAction, saveBoardAction } from "./boardActions";
import { TabGuide } from "../TabGuide";
import styles from "./squad.module.css";

/** 역할 그림. 직접 그린 것이라 글자색을 그대로 따라간다. */
function RoleIcon({ role, size }: { role: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      dangerouslySetInnerHTML={{ __html: ROLE_ICON_PATH[role] ?? "" }} />
  );
}

function NameInput({ value, onCommit, onCancel }: {
  value: string; onCommit: (value: string) => void; onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  const finished = useRef(false);
  const focusInput = useCallback((element: HTMLInputElement | null) => {
    if (element) { element.focus(); element.select(); }
  }, []);
  function finish(cancel = false) {
    if (finished.current) return;
    finished.current = true;
    if (cancel) onCancel();
    else onCommit(text);
  }
  return <input className={styles.nameInput} aria-label="이름 수정" value={text}
    ref={focusInput}
    onChange={(event) => setText(event.target.value)} onBlur={() => finish()}
    onKeyDown={(event) => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault();
        finish(event.key === "Escape");
      }
    }} />;
}

type Editing = { key: string; value: string; cell?: CellAddress; waitingId?: string; headerParty?: number };

/** 몇 초마다 남이 고쳤는지 물어본다. 더 짧게 하면 얻는 것 없이 DB 만 두드린다. */
const POLL_MS = 3000;
/* 한 번 옮길 때마다 저장하면 끄는 동안에도 계속 날아간다. 손을 멈춘 뒤에 보낸다. */
const SAVE_DELAY_MS = 900;

export function SquadTab({ surveyId }: { surveyId: string | null }) {
  const [input, setInput] = useState("");
  const [formation, setFormation] = useState(emptyFormation);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [message, setMessage] = useState("");
  const [copying, setCopying] = useState(false);
  /* 판 크기. 자동은 온 인원으로 고르고, 직접 고르면 인원이 모자라도 그 판으로
     짠다 — 100 인 거점전인데 여든 명만 와도 여섯 부대로 세워 두는 일이 있다. */
  const [format, setFormat] = useState<FormatKey>("auto");
  /* 고른 사람들. 눌러서 고르고 눌러서 보내는 길과 끌어다 놓는 길이 함께 산다.
     가로로 멀리 끌고 가는 것이 폰에서도 트랙패드에서도 어려워 누르는 길을
     남겼고, 마우스로는 끄는 편이 빠르다. */
  const [selected, setSelected] = useState<string[]>([]);
  /* 폰에는 Ctrl 이 없다. 켜 두면 누르는 것이 곧 고르기가 된다. */
  const [multi, setMulti] = useState(false);
  /* 사용법. 탭 위쪽 ? 와 같은 글을 띄운다 — 손이 가 있는 자리에서 바로 열린다. */
  const [helpOpen, setHelpOpen] = useState(false);
  /* 저장된 판의 번호. 0 은 아직 이 회차에 저장된 것이 없다는 뜻이다. */
  const [version, setVersion] = useState(0);
  const [saveState, setSaveState] = useState("");
  /* 서버가 들고 있는 것으로 아는 판. 이것과 다를 때에만 저장한다 — 남이 고친
     것을 받아 그린 뒤에 그대로 되돌려 보내는 일이 없어야 한다. */
  const stored = useRef<string | null>(null);
  /* 끄는 동안 따라오는 사람들. 끌기가 아닌 평소에는 비어 있어야, 바깥에서
     끌어온 파일 따위를 놓았을 때 엉뚱하게 사람이 움직이지 않는다. */
  const [dragging, setDragging] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const sheetScroll = useRef<HTMLDivElement>(null);
  const rows = sheetRows(formation);
  const columns = formation.parties.length * 2;
  const assignedCount = formation.parties.reduce((sum, party) => sum + party.filter(Boolean).length, 0);

  useLayoutEffect(() => {
    const sheet = sheetScroll.current;
    if (!sheet) return;
    function fitNames() {
      sheet?.querySelectorAll<HTMLElement>("[data-member-label]").forEach((label) => {
        label.style.fontSize = "";
        const available = (label.parentElement?.clientWidth ?? 0) - 6;
        if (available > 0 && label.scrollWidth > available) {
          label.style.fontSize = `${(10 * 4 / 3) * available / label.scrollWidth}px`;
        }
      });
    }
    fitNames();
    const observer = new ResizeObserver(fitNames);
    observer.observe(sheet);
    let active = true;
    void document.fonts.ready.then(() => { if (active) fitNames(); });
    return () => { active = false; observer.disconnect(); };
  }, [formation, editing]);

  /* 저장된 판을 받아 그린다. 골라 둔 사람은 그 판에도 있으면 그대로 둔다. */
  const applyBoard = useCallback((data: string, nextVersion: number) => {
    let next: Formation;
    try { next = JSON.parse(data) as Formation; } catch { return; }
    if (!Array.isArray(next?.parties)) return;
    stored.current = data;
    setVersion(nextVersion);
    setFormation(next);
    const alive = new Set([...next.parties.flat(), ...next.waiting]
      .filter((m): m is SquadMember => Boolean(m)).map((m) => m.id));
    setSelected((previous) => previous.filter((id) => alive.has(id)));
  }, []);

  /* 탭을 열 때 한 번. 회차가 바뀌면 AdminConsole 이 key 로 새로 마운트하므로
     여기서 되돌릴 것이 없다. */
  useEffect(() => {
    if (!surveyId) return;
    let alive = true;
    void loadBoardAction(surveyId).then((board) => {
      if (!alive || !board) return;
      applyBoard(board.data, board.version);
      setMessage(`저장해 둔 편성을 불러왔습니다. 마지막 수정: ${board.updatedBy ?? "알 수 없음"}.`);
    }).catch(() => {});
    return () => { alive = false; };
  }, [surveyId, applyBoard]);

  /* 손을 멈추면 저장한다. 끄는 중이거나 이름을 고치는 중에는 기다린다 — 반쯤
     옮긴 판을 남에게 보내 봐야 소용이 없다. */
  useEffect(() => {
    if (!surveyId || editing || dragging.length) return;
    const data = JSON.stringify(formation);
    if (data === stored.current) return;
    /* 받아 오기 전의 빈 판은 보내지 않는다. 느린 날 저장된 판보다 먼저 닿으면
       남이 짜 둔 것과 쓸데없이 부딪친다. */
    if (stored.current === null && !assignedCount && !formation.waiting.length) return;
    const timer = setTimeout(() => {
      setSaveState("저장 중…");
      void saveBoardAction(surveyId, data, version).then((result) => {
        if (result.ok) {
          stored.current = data;
          setVersion(result.version);
          setSaveState("저장됨");
          return;
        }
        if (!result.board) { setSaveState("저장 실패"); return; }
        // 사이에 남이 저장했다. 덮어쓰지 않고 그쪽으로 맞춘다.
        applyBoard(result.board.data, result.board.version);
        setSaveState("");
        setMessage(`${result.board.updatedBy ?? "다른 사람"}님이 먼저 저장해 그 편성으로 맞췄습니다. 방금 한 것을 다시 해 주세요.`);
      }).catch(() => setSaveState("저장 실패"));
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [surveyId, formation, assignedCount, version, editing, dragging.length, applyBoard]);

  /* 남이 고쳤는지 번호만 물어본다. 내가 손대는 중이거나 아직 못 보낸 변경이
     있으면 건드리지 않는다. */
  useEffect(() => {
    if (!surveyId) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (editing || dragging.length) return;
      if (stored.current === null || JSON.stringify(formation) !== stored.current) return;
      void boardVersionAction(surveyId).then(async (serverVersion) => {
        if (serverVersion <= version) return;
        const board = await loadBoardAction(surveyId);
        if (board) applyBoard(board.data, board.version);
      }).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [surveyId, formation, version, editing, dragging.length, applyBoard]);

  function assign(useFormat: FormatKey = format) {
    const members = parseMembers(input);
    if (!members.length) { setMessage("닉네임 / 직업 형식으로 명단을 입력해 주세요."); return; }
    const next = autoAssign(members, useFormat);
    // 고쳐 둔 부대 이름은 다시 돌려도 남긴다. 부대 수가 달라지면 되돌린다.
    setFormation((previous) => next.names.length === previous.names.length
      ? { ...next, names: previous.names } : next);
    setEditing(null);
    // 다시 짜면 자리가 통째로 바뀐다. 고른 채로 두면 엉뚱한 사람이 고른 것이 된다.
    setSelected([]);
    endDrag();
    /* 자리가 모자라 빠진 사람은 말해 준다. 미배치 칸에 조용히 쌓여 있으면
       그대로 넘어가 부대 없이 들어가는 사람이 생긴다. */
    setMessage(next.waiting.length
      ? `${members.length}명 중 ${next.waiting.length}명이 자리가 없어 미배치로 갔습니다. 아래에서 옮겨 주세요.`
      : `${members.length}명을 ${next.parties.length}개 부대에 모두 배치했습니다.`);
  }

  /* 판을 고르면 그 자리에서 다시 짠다. 고르기만 하고 가만히 있으면 왜 안 바뀌나
     하게 된다. 명단이 비어 있으면 고르기만 해 둔다. */
  function pickFormat(next: FormatKey) {
    setFormat(next);
    if (parseMembers(input).length) assign(next);
  }

  function commit(value: string) {
    if (!editing) return;
    const { cell, waitingId, headerParty } = editing;
    const id = `manual-${crypto.randomUUID()}`;
    setFormation((previous) => {
      if (headerParty !== undefined) return renameParty(previous, headerParty, value);
      if (cell) return editCell(previous, cell, value, id);
      return {
        ...previous,
        waiting: previous.waiting.map((member) => member.id === waitingId && value.trim()
          ? { ...member, name: value.trim() } : member),
      };
    });
    setEditing(null);
  }

  const picked = new Set(selected);

  function toggle(id: string) {
    setSelected((previous) => previous.includes(id)
      ? previous.filter((other) => other !== id) : [...previous, id]);
  }

  /** 고른 사람들을 그 자리로 보낸다. 한 명이면 자리 맞바꿈, 여럿이면 빈칸 채우기. */
  function place(target: CellAddress | null) {
    if (!selected.length) return;
    setFormation((previous) => moveMembers(previous, selected, target));
    setSelected([]);
  }

  /** 칸을 눌렀을 때. 고른 것이 없으면 고르고, 있으면 그 자리로 보낸다. */
  function tapCell(member: { id: string } | null | undefined, cell: CellAddress,
    event?: MouseEvent) {
    if (editing) return;
    const adding = multi || event?.ctrlKey || event?.metaKey || event?.shiftKey;
    if (member && adding) { toggle(member.id); return; }
    if (selected.length) {
      if (selected.length === 1 && selected[0] === member?.id) { setSelected([]); return; }
      place(cell);
      return;
    }
    if (member) setSelected([member.id]);
  }

  /* 끌기. 고른 무리 안의 사람을 끌면 무리째 따라오고, 밖의 사람을 끌면 그
     사람만 따라온다. 손에 뭘 들었는지 보이도록 고르기도 같이 맞춘다. */
  function startDrag(event: DragEvent, id: string) {
    const ids = picked.has(id) && selected.length > 1 ? selected : [id];
    setDragging(ids);
    setSelected(ids);
    event.dataTransfer.effectAllowed = "move";
    // 파이어폭스는 담은 것이 없으면 끌기를 시작조차 하지 않는다.
    event.dataTransfer.setData("text/plain", ids.join(","));
  }

  function overDrop(event: DragEvent, key: string | null) {
    if (!dragging.length) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOver((previous) => (previous === key ? previous : key));
  }

  function drop(event: DragEvent, target: CellAddress | null) {
    if (!dragging.length) return;
    event.preventDefault();
    const ids = dragging;
    endDrag();
    setFormation((previous) => moveMembers(previous, ids, target));
    setSelected([]);
  }

  function endDrag() {
    setDragging([]);
    setDragOver(null);
  }

  const everyone = [...formation.parties.flat(), ...formation.waiting];
  const selectedMembers = selected
    .map((id) => everyone.find((m) => m?.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  /** 고른 사람들에게 모두 붙어 있는 역할. 섞여 있으면 빈 값이다. */
  const selectedRole = selectedMembers.length && selectedMembers.every((m) =>
    memberRole(m) === memberRole(selectedMembers[0])) ? memberRole(selectedMembers[0]) ?? "" : "";

  /* 이미 모두 달고 있는 역할을 다시 누르면 뗀다. 섞여 있으면 모두에게 붙인다. */
  function applyRole(role: string) {
    if (!selected.length) return;
    const next = selectedRole === role ? null : role;
    setFormation((previous) => selected.reduce((f, id) => setRole(f, id, next), previous));
  }

  /* png 는 이미 시작된 약속이어야 한다. Safari 는 누름이 끝난 뒤에 시작한
     쓰기를 막으므로, 부르는 쪽에서 미리 만들어 넘긴다. */
  async function copyPng(png: Promise<Blob>, filename: string, done: string) {
    setCopying(true);
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("clipboard");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setMessage(done);
    } catch {
      try {
        const url = URL.createObjectURL(await png);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage("이미지 복사를 사용할 수 없어 PNG 파일로 내려받았습니다.");
      } catch { setMessage("이미지를 만들지 못했습니다. 다시 시도해 주세요."); }
    } finally { setCopying(false); }
  }

  return <div ref={root} className={styles.root}>
    <div className={styles.inputHeader}>
      <label htmlFor="squad-members">명단 입력</label>
      <div className={styles.actions}>
        <span className={styles.formatLabel}>판 크기</span>
        {FORMATS.map((option) => (
          <button key={option.key} type="button" className={styles.button}
            aria-pressed={format === option.key} onClick={() => pickFormat(option.key)}>
            {option.label}
          </button>
        ))}
        <button type="button" className={styles.primary} onClick={() => assign()}>부대 자동 배치</button>
      </div>
    </div>
    <textarea id="squad-members" className={styles.rosterInput} value={input}
      onChange={(event) => setInput(event.target.value)} spellCheck={false}
      placeholder={"투표 명단을 붙여 넣으세요.\n1. 예니체리 / 노바 (각성)\n2. 홍줭 / 위자드 (각성)"} />

    <div className={styles.toolbar}>
      <h2>부대 편성 <span>{assignedCount}명</span></h2>
      <button type="button" className={styles.helpBtn} onClick={() => setHelpOpen(true)}
        title="부대편성 사용법 보기" aria-label="부대편성 사용법 보기">?</button>
      <span className={styles.saveState} role="status">
        {!surveyId ? "이번 회차가 없어 저장되지 않습니다" : saveState}
      </span>
      {helpOpen && <TabGuide tab="부대편성" onClose={() => setHelpOpen(false)} />}
      <div className={styles.actions}>
        <button type="button" className={styles.button} aria-pressed={multi}
          onClick={() => setMulti((previous) => !previous)}>여러 명 고르기</button>
        <button type="button" className={styles.button} onClick={() => {
          setFormation(emptyFormation());
          setSelected([]); setEditing(null); endDrag();
          setMessage("편성을 비웠습니다.");
        }}>새로 짜기</button>
        <button type="button" className={styles.button} disabled={copying}
          onClick={() => copyPng(roleLegendImage(), "역할그림.png", "역할 그림을 복사했습니다.")}>
          역할 그림 복사
        </button>
        <button type="button" className={styles.button} disabled={copying}
          onClick={() => copyPng(formationImage(formation), "부대편성.png", "부대표 이미지를 복사했습니다.")}>
          {copying ? "복사 중…" : "이미지로 복사"}
        </button>
      </div>
    </div>
    <div ref={sheetScroll} className={styles.sheetScroll}>
      <table className={styles.sheet} aria-label="부대 편성표" style={{
        "--sheet-column": `${SHEET.columnWidth}px`, "--sheet-row": `${SHEET.rowHeight}px`,
        "--sheet-header": `${SHEET.headerHeight}px`, "--sheet-min": `${columns * 138}px`,
        fontFamily: SHEET.font,
      } as CSSProperties}>
        <colgroup>{Array.from({ length: columns }, (_, i) =>
          <col key={i} style={{ width: `${100 / columns}%` }} />)}</colgroup>
        <thead><tr>{formation.names.map((name, party) =>
          <th key={party} scope="colgroup" colSpan={2}>
            {editing?.key === `head:${party}`
              ? <NameInput key={`head:${party}`} value={editing.value} onCommit={commit}
                onCancel={() => setEditing(null)} />
              : <button type="button" className={styles.headerName} title="눌러서 이름 고치기"
                onClick={() => setEditing({ key: `head:${party}`, value: name, headerParty: party })}>
                {name}<br /><span>({formation.parties[party].filter(Boolean).length}명)</span>
              </button>}
          </th>)}</tr></thead>
        <tbody>{Array.from({ length: rows + 1 }, (_, row) => <tr key={row} className={row === rows ? styles.extraRow : undefined}>
          {formation.parties.flatMap((party, partyIndex) => [0, 1].map((column) => {
            const index = row * 2 + column;
            const member = party[index];
            const label = memberLabel(member);
            const key = `${partyIndex}:${index}`;
            const startEdit = (value = member?.name ?? "") => setEditing({ key, value, cell: { party: partyIndex, index } });
            return <td key={key}>
              {editing?.key === key ? <NameInput key={key} value={editing.value} onCommit={commit} onCancel={() => setEditing(null)} />
                : <button type="button" className={styles.cell}
                  draggable={Boolean(member)}
                  onDragStart={(event) => member && startDrag(event, member.id)}
                  onDragEnd={endDrag}
                  onDragOver={(event) => overDrop(event, key)}
                  onDragLeave={() => setDragOver((previous) => previous === key ? null : previous)}
                  onDrop={(event) => drop(event, { party: partyIndex, index })}
                  data-picked={member && picked.has(member.id) ? "" : undefined}
                  data-target={selected.length && !(member && picked.has(member.id)) ? "" : undefined}
                  data-over={dragOver === key ? "" : undefined}
                  aria-label={`${partyIndex + 1}부대 ${row + 1}행 ${column + 1}열: ${label || "빈칸"}`}
                  aria-pressed={member ? picked.has(member.id) : undefined}
                  title={selected.length ? "눌러서 이 자리로" : label ? "눌러서 고르기 · 끌어서 옮기기" : ""}
                  onClick={(event) => tapCell(member, { party: partyIndex, index }, event)}
                  onKeyDown={(event) => {
                    if (event.key === "F2") { event.preventDefault(); startEdit(); }
                    else if ((event.key === "Delete" || event.key === "Backspace") && member) {
                      // 고른 무리 안의 사람을 지우면 무리째 미배치로 내려간다.
                      event.preventDefault();
                      const ids = picked.has(member.id) && selected.length > 1 ? selected : [member.id];
                      setFormation((previous) => moveMembers(previous, ids, null));
                      setSelected([]);
                    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                      event.preventDefault(); startEdit(event.key);
                    }
                  }}>
                  {(() => {
                    const art = memberArt(member);
                    return art ? (
                      <span className={styles.art}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- 칸마다 들어가는 작은 정적 그림이라 최적화가 필요 없다. */}
                        <img src={art.icon} alt="" className={styles.icon} />
                        {art.mark && (
                          <span className={styles.badge} style={{ borderColor: art.mark.color }}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- 픽셀 그림이라 늘리면 뭉개진다. */}
                            <img src={art.mark.src} alt="" />
                          </span>
                        )}
                      </span>
                    ) : null;
                  })()}
                  <span className={styles.memberLabel} data-member-label>{label}</span>
                  {memberRole(member) && (
                    <span className={styles.role} title={memberRole(member) ?? ""}>
                      <RoleIcon role={memberRole(member) as string} size={SHEET.roleSize} />
                    </span>
                  )}</button>}
            </td>;
          }))}
        </tr>)}</tbody>
      </table>
    </div>
    {selectedMembers.length ? (
      <div className={styles.roleBar}>
        <strong>{selectedMembers.length === 1
          ? baseName(selectedMembers[0].name) : `${selectedMembers.length}명`}</strong>
        <span className={styles.roleHint}>역할</span>
        {ROLES.map((role) => (
          <button key={role} type="button"
            className={selectedRole === role ? styles.roleOn : styles.roleButton}
            onClick={() => applyRole(role)}><RoleIcon role={role} size={17} /> {role}</button>
        ))}
        <button type="button" className={styles.button} onClick={() => setSelected([])}>고르기 취소</button>
      </div>
    ) : (
      <p className={styles.hint}>
        사람을 누르고 갈 자리를 누르면 옮겨집니다. 끌어다 놓아도 됩니다.
        여러 명은 Ctrl(⌘)이나 Shift 를 누른 채, 폰에서는 「여러 명 고르기」로 고릅니다.
        {" "}자세한 사용법은 <button type="button" className={styles.hintLink}
          onClick={() => setHelpOpen(true)}>?</button> 를 누르세요.
      </p>
    )}
    <section className={styles.waiting} aria-label="미배치 인원"
      data-target={selected.length ? "" : undefined} data-over={dragOver === "waiting" ? "" : undefined}
      onDragOver={(event) => overDrop(event, "waiting")}
      onDragLeave={() => setDragOver((previous) => previous === "waiting" ? null : previous)}
      onDrop={(event) => drop(event, null)}
      onClick={(event) => { if (selected.length && event.target === event.currentTarget) place(null); }}>
      <h3>미배치 <span>{formation.waiting.length}명</span>
        {selected.length > 0 && <button type="button" className={styles.button} onClick={() => place(null)}>여기로 보내기</button>}
      </h3>
      <div className={styles.waitingMembers}>
        {formation.waiting.map((member) => editing?.waitingId === member.id
          ? <NameInput key={member.id} value={editing.value} onCommit={commit} onCancel={() => setEditing(null)} />
          : <button key={member.id} type="button" className={styles.waitingMember}
            draggable onDragStart={(event) => startDrag(event, member.id)} onDragEnd={endDrag}
            data-picked={picked.has(member.id) ? "" : undefined}
            aria-pressed={picked.has(member.id)}
            onClick={(event) => (multi || event.ctrlKey || event.metaKey || event.shiftKey)
              ? toggle(member.id)
              : setSelected((previous) =>
                previous.length === 1 && previous[0] === member.id ? [] : [member.id])}
            onKeyDown={(event) => { if (event.key === "F2") {
              event.preventDefault(); setEditing({ key: `waiting-${member.id}`, waitingId: member.id, value: member.name });
            } }}>{member.name}</button>)}
        {!formation.waiting.length && <p>배치에서 뺄 인원을 여기로 옮기세요.</p>}
      </div>
    </section>
    <p className={styles.message} role="status">{message}</p>
  </div>;
}
