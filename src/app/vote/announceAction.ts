"use server";

import {
  claimAnnouncement,
  getPendingAnnouncement,
  markAnnounced,
  releaseAnnouncement,
} from "@/lib/queries";
import { sendSurveyAnnouncement } from "@/lib/discord";
import { auth } from "@/auth";

/**
 * 공지를 보낼 때가 됐으면 보낸다.
 *
 * 투표 페이지의 보이지 않는 카운트다운이 공지 시각에 닿으면 이걸 부른다. 열려
 * 있는 브라우저가 150개면 150번 불리지만, 실제로 보내는 것은 하나뿐이다 —
 * claimAnnouncement 의 UPDATE 가 조건을 만족시키는 요청 하나만 통과시킨다.
 *
 * 아무도 페이지를 안 열고 있었다면 공지 시각이 지난 뒤 처음 여는 사람이 보낸다.
 * 늦게라도 나가고, 중복은 나지 않는다.
 */
export async function maybeAnnounce(): Promise<{ sent: boolean }> {
  // 로그인한 연맹원의 페이지에서만 불린다. 외부에서 임의로 두드려 공지를
  // 흘리지 못하게 최소한의 문은 걸어둔다.
  const session = await auth();
  if (!session?.user?.dbUserId) return { sent: false };

  const survey = await getPendingAnnouncement();
  if (!survey || !survey.announce_at || !survey.announce_content) return { sent: false };
  if (Date.now() < survey.announce_at.getTime()) return { sent: false };

  const claimed = await claimAnnouncement(survey.id);
  if (!claimed) return { sent: false };

  const messageId = await sendSurveyAnnouncement(survey.announce_content);
  if (messageId === null) {
    // 전송 실패. 선점을 풀어 다음 사람이 다시 시도하게 한다.
    await releaseAnnouncement(survey.id);
    return { sent: false };
  }

  await markAnnounced(survey.id, messageId);
  return { sent: true };
}
