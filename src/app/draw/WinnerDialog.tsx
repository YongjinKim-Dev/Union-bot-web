"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useRef } from "react";
import styles from "./draw.module.css";

/*
 * 당첨자를 사다리 위에 반투명하게 띄운다.
 *
 * 화면을 바꿔 버리면 누가 어느 길로 내려와 어디에 닿았는지를 함께 볼 수 없다.
 * 뒤로 사다리가 비쳐 보이게 두고, 닫으면 그대로 사다리를 다시 볼 수 있다.
 * 브라우저의 dialog 를 쓰므로 Esc 로도 닫히고, 열려 있는 동안 뒤는 눌리지 않는다.
 */
export function WinnerDialog({
  open,
  onClose,
  title,
  winners,
  notice,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  winners: { nickname: string; avatarUrl?: string }[];
  notice?: string;
  /** 복사·남기기 같은 버튼. 닫기 버튼은 이 창이 붙인다. */
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    /*
     * Esc 로 닫힐 때는 브라우저가 닫으므로 그때만 이벤트로 받는다. 닫힘 이벤트는
     * 늦게 올 수 있어서, 그 사이 다시 열었다면 지금 실제로 닫혀 있을 때만 따른다.
     */
    <dialog ref={dialog} className={styles.winnerDialog}
      onClose={(event) => { if (open && !event.currentTarget.open) onClose(); }}
      aria-labelledby="draw-winner-title">
      <p className={styles.winnerKicker}>{title}</p>
      <h2 id="draw-winner-title" className={styles.winnerHead}>당첨 {winners.length}명</h2>
      <ol className={styles.finalList}>
        {winners.map((winner) => (
          <li key={winner.nickname}>
            {winner.avatarUrl && (
              <Image src={winner.avatarUrl} alt="" width={30} height={30} className={styles.avatar} unoptimized />
            )}
            {winner.nickname}
          </li>
        ))}
      </ol>
      <div className={styles.winnerActions}>
        {children}
        {/* 닫힘 이벤트를 기다리지 않고 바로 알린다. 브라우저가 이벤트를 늦게 보내면 부르는
            쪽은 아직 열려 있다고 믿어 "당첨자 보기"를 눌러도 다시 열리지 않는다. */}
        <button type="button" className={styles.btn} onClick={onClose}>닫기</button>
      </div>
      {notice && <p role="status" className={styles.winnerNotice}>{notice}</p>}
    </dialog>
  );
}
