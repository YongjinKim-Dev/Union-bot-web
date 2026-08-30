/**
 * 디스코드 웹훅 알림.
 *
 * 웹훅을 둘로 나눈다. 투표 로그는 투표할 때마다 한 건씩 쌓이므로 운영진이 보는
 * 로그 채널로, 설문 공지는 연맹원이 봐야 하므로 설문 채널로 가야 한다. 하나로
 * 합치면 공지가 로그 채널에 묻히거나, 로그 150건이 공지 채널을 덮는다.
 *
 * 둘 다 없으면 예전처럼 DISCORD_WEBHOOK_URL 하나를 쓴다. 이미 그렇게 배포된
 * 환경이 그대로 돌아가도록 남겨둔 폴백이다.
 */
function resolveWebhook(specific: string | undefined): string | undefined {
  return specific || process.env.DISCORD_WEBHOOK_URL || undefined;
}

/** 웹훅 전송은 절대 던지지 않는다. 알림이 실패해도 본래 작업은 끝난 상태다. */
async function postToWebhook(url: string | undefined, content: string): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 투표 한 건이 들어올 때마다 로그 채널에 남긴다. */
export async function sendVoteLog(nickname: string, label: string): Promise<boolean> {
  return postToWebhook(
    resolveWebhook(process.env.DISCORD_VOTE_LOG_WEBHOOK_URL),
    `🗳️ **${nickname}**님이 웹에서 **${label}**(으)로 투표했습니다.`,
  );
}

/**
 * 새 설문을 공지한다. 투표 창은 exposed_at 으로 정해지므로 이 공지는 알림일
 * 뿐이고, 언제 열리는지와는 무관하다.
 */
export async function sendSurveyAnnouncement(params: {
  title: string;
  opensAtLabel: string;
  voteUrl: string;
}): Promise<boolean> {
  return postToWebhook(
    resolveWebhook(process.env.DISCORD_ANNOUNCE_WEBHOOK_URL),
    `📋 **${params.title}** 거점전 설문조사\n\n` +
      `투표는 **${params.opensAtLabel}** 에 열립니다. 모두에게 같은 시각에 열리며, ` +
      `링크를 미리 열어두면 남은 시간이 표시됩니다.\n${params.voteUrl}`,
  );
}
