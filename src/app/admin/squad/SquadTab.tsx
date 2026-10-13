"use client";

import { useState, type CSSProperties } from "react";
import { autoAssign, emptyFormation, parseMembers, SHEET } from "./formation";
import styles from "./squad.module.css";

export function SquadTab() {
  const [input, setInput] = useState("");
  const [formation, setFormation] = useState(emptyFormation);
  const [message, setMessage] = useState("");
  const assignedCount = formation.parties.reduce((sum, party) => sum + party.filter(Boolean).length, 0);

  function assign() {
    const members = parseMembers(input);
    if (!members.length) { setMessage("닉네임 / 직업 형식으로 명단을 입력해 주세요."); return; }
    setFormation(autoAssign(members));
    setMessage("");
  }

  return <div className={styles.root}>
    <div className={styles.inputHeader}>
      <label htmlFor="squad-members">명단 입력</label>
      <button type="button" className={styles.primary} onClick={assign}>부대 자동 배치</button>
    </div>
    <textarea id="squad-members" className={styles.rosterInput} value={input}
      onChange={(event) => setInput(event.target.value)} spellCheck={false}
      placeholder={"투표 명단을 붙여 넣으세요.\n1. 예니체리 / 노바 (각성)\n2. 홍줭 / 위자드 (각성)"} />

    <div className={styles.toolbar}>
      <h2>부대 편성 <span>{assignedCount}명</span></h2>
    </div>
    <div className={styles.sheetScroll}>
      <table className={styles.sheet} aria-label="부대 편성표" style={{
        "--sheet-column": `${SHEET.columnWidth}px`, "--sheet-row": `${SHEET.rowHeight}px`,
        "--sheet-header": `${SHEET.headerHeight}px`, fontFamily: SHEET.font,
      } as CSSProperties}>
        <colgroup>{Array.from({ length: 8 }, (_, i) => <col key={i} />)}</colgroup>
        <thead><tr>{SHEET.names.map((name, party) =>
          <th key={name} scope="colgroup" colSpan={2} style={{ background: SHEET.colors[party] }}>
            {name}<br />({formation.parties[party].filter(Boolean).length}명)
          </th>)}</tr></thead>
        <tbody>{Array.from({ length: formation.rows }, (_, row) => <tr key={row}>
          {formation.parties.flatMap((party, partyIndex) => [0, 1].map((column) =>
            <td key={`${partyIndex}:${column}`}><span className={styles.cell}>{party[row * 2 + column]?.name ?? ""}</span></td>))}
        </tr>)}</tbody>
      </table>
    </div>
    <section className={styles.waiting} aria-label="미배치 인원">
      <h3>미배치 <span>{formation.waiting.length}명</span></h3>
      <div className={styles.waitingMembers}>
        {formation.waiting.map((member) => <span key={member.id} className={styles.waitingMember}>{member.name}</span>)}
        {!formation.waiting.length && <p>미배치 인원이 없습니다.</p>}
      </div>
    </section>
    <p className={styles.message} role="status">{message}</p>
  </div>;
}
