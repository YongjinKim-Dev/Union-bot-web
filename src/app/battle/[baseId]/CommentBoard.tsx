"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { ClassIcon } from "@/components/ClassIcon";
import type { BattleComment } from "@/lib/battleQueries";
import { formatKstDateTime } from "@/lib/format";
import {
  addCommentAction,
  commentHistoryAction,
  editCommentAction,
  purgeCommentAction,
  removeCommentAction,
  type CommentHistory,
} from "../actions";
import styles from "../battle.module.css";

const COMMENT_MAX = 1000;

const ACTION_LABEL: Record<string, string> = {
  edit: "고침",
  remove: "지움",
  restore: "되살림",
};

/** 지운 댓글의 원문과 고친 이력. 관리자만 열 수 있다. */
function History({ commentId }: { commentId: string }) {
  const [history, setHistory] = useState<CommentHistory | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (history) return;
    setError("");
    startTransition(async () => {
      try {
        setHistory(await commentHistoryAction(commentId));
      } catch {
        setError("이력을 불러오지 못했습니다.");
      }
    });
  }

  return (
    <>
      <button type="button" className={styles.linkButton} onClick={toggle} disabled={isPending}>
        {open ? "이력 닫기" : "이력"}
      </button>
      {open && (
        <div className={styles.history}>
          {error && <p className={styles.error}>{error}</p>}
          {!history && !error && <p className={styles.historyNote}>불러오는 중…</p>}
          {history && (
            <>
              {history.removedBody !== null && (
                <p className={styles.historyRow}>
                  <span className={styles.historyTag}>원문</span>
                  {history.removedBody}
                </p>
              )}
              {history.rows.length === 0 ? (
                <p className={styles.historyNote}>고치거나 지운 적이 없습니다.</p>
              ) : (
                history.rows.map((row) => (
                  <p key={row.id} className={styles.historyRow}>
                    <span className={styles.historyTag}>
                      {ACTION_LABEL[row.action] ?? row.action}
                    </span>
                    <span className={styles.historyMeta}>
                      {formatKstDateTime(row.loggedAt)} · {row.actorNickname}
                    </span>
                    {row.bodyBefore}
                  </p>
                ))
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

function CommentRow({
  baseId,
  comment,
  viewerId,
  isAdmin,
  onError,
}: {
  baseId: string;
  comment: BattleComment;
  viewerId: string;
  isAdmin: boolean;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.body);
  const [isPending, startTransition] = useTransition();

  const mine = comment.userId === viewerId;
  const removed = comment.removedAt !== null;

  function submitEdit() {
    const body = text.trim();
    if (!body) return;
    onError("");
    startTransition(async () => {
      const result = await editCommentAction(baseId, comment.id, body);
      if (result.ok) setEditing(false);
      else onError(result.message);
    });
  }

  /* 관리자의 "완전 삭제"는 이력까지 없앤다. 지우기와 달리 아무것도 남지 않는다. */
  function purge() {
    if (
      !window.confirm(
        `${comment.nickname} 님의 댓글을 이력까지 없앱니다. 되돌릴 수 없습니다.\n\n남겨야 한다면 "지우기"를 쓰세요.`,
      )
    ) {
      return;
    }
    onError("");
    startTransition(async () => {
      try {
        await purgeCommentAction(baseId, comment.id);
      } catch {
        onError("삭제하지 못했습니다. 새로 고침 후 다시 시도해 주세요.");
      }
    });
  }

  function remove() {
    onError("");
    startTransition(async () => {
      const result = await removeCommentAction(baseId, comment.id);
      if (!result.ok) onError(result.message);
    });
  }

  return (
    <li className={removed ? styles.commentRemoved : styles.comment}>
      {/* 얼굴과 직업은 지금 값을 읽어 온다. 아직 로그인한 적 없는 사람은
          디스코드 기본 그림이 나오고, 연맹을 나간 사람은 빈 자리로 남는다. */}
      {comment.avatarUrl ? (
        <Image
          src={comment.avatarUrl}
          alt=""
          width={30}
          height={30}
          className={styles.avatar}
          unoptimized
        />
      ) : (
        <span className={styles.avatarBlank} aria-hidden="true" />
      )}

      <div className={styles.commentMain}>
      <div className={styles.commentHead}>
        {comment.className && (
          /* 계열 마크가 타일 오른쪽 아래로 삐져나오므로 이름과 겹치지 않게 감싼다. */
          <span className={styles.classTile}>
            <ClassIcon name={comment.className} type={comment.classType} size={26} markSize={13} />
          </span>
        )}
        <span className={styles.commentName}>{comment.nickname}</span>
        <span className={styles.commentTime}>
          {formatKstDateTime(comment.createdAt)}
          {comment.updatedAt && !removed && " · 수정됨"}
        </span>
        <span className={styles.commentTools}>
          {!removed && mine && !editing && (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                setText(comment.body);
                setEditing(true);
              }}
            >
              고치기
            </button>
          )}
          {!removed && (mine || isAdmin) && (
            <button type="button" className={styles.linkButton} disabled={isPending} onClick={remove}>
              지우기
            </button>
          )}
          {isAdmin && <History commentId={comment.id} />}
          {isAdmin && (
            <button type="button" className={styles.dangerLink} disabled={isPending} onClick={purge}>
              완전 삭제
            </button>
          )}
        </span>
      </div>

      {removed ? (
        <p className={styles.commentGone}>
          {comment.removedByAdmin ? "관리자가 내린 댓글입니다." : "작성자가 지운 댓글입니다."}
        </p>
      ) : editing ? (
        <div className={styles.commentEdit}>
          <textarea
            className={styles.textarea}
            value={text}
            aria-label="댓글 고치기"
            rows={3}
            maxLength={COMMENT_MAX}
            onChange={(event) => setText(event.target.value)}
          />
          <div className={styles.commentEditActions}>
            <button
              type="button"
              className={styles.miniButton}
              disabled={isPending || !text.trim() || text.trim() === comment.body}
              onClick={submitEdit}
            >
              저장
            </button>
            <button type="button" className={styles.linkButton} onClick={() => setEditing(false)}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <p className={styles.commentBody}>{comment.body}</p>
      )}
      </div>
    </li>
  );
}

export function CommentBoard({
  baseId,
  comments,
  viewerId,
  isAdmin,
}: {
  baseId: string;
  comments: BattleComment[];
  viewerId: string;
  isAdmin: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // 지운 댓글도 자리는 남으므로, 세는 것은 남아 있는 것만 센다.
  const visible = comments.filter((comment) => comment.removedAt === null).length;

  function submit() {
    const body = text.trim();
    if (!body) return;
    setError("");
    startTransition(async () => {
      const result = await addCommentAction(baseId, body);
      if (result.ok) setText("");
      else setError(result.message);
    });
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>댓글 {visible > 0 && <span className={styles.count}>{visible}</span>}</h2>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {comments.length === 0 ? (
        <p className={styles.empty}>아직 댓글이 없습니다.</p>
      ) : (
        <ul className={styles.commentList}>
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              baseId={baseId}
              comment={comment}
              viewerId={viewerId}
              isAdmin={isAdmin}
              onError={setError}
            />
          ))}
        </ul>
      )}

      <div className={styles.commentForm}>
        <textarea
          className={styles.textarea}
          value={text}
          aria-label="댓글 쓰기"
          rows={3}
          maxLength={COMMENT_MAX}
          placeholder="이 거점에 대해 남길 말"
          onChange={(event) => setText(event.target.value)}
        />
        <div className={styles.commentEditActions}>
          <span className={styles.counter}>
            {text.length}/{COMMENT_MAX}
          </span>
          <button
            type="button"
            className={styles.button}
            disabled={isPending || !text.trim()}
            onClick={submit}
          >
            등록
          </button>
        </div>
      </div>
    </section>
  );
}
