// Posts to the webhook configured for the bot's SURVEY_LOG_CHANNEL_ID
// channel, mirroring the log line the bot used to send from SurveyButton's
// callback. Never throws — a webhook outage must not affect voting itself.
export async function sendVoteLog(nickname: string, label: string) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🗳️ **${nickname}**님이 웹에서 **${label}**(으)로 투표했습니다.`,
      }),
    });
  } catch {
    // Swallow errors intentionally.
  }
}

/**
 * 새 설문 링크를 디스코드에 공지한다. 봇의 30초 루프가 하던 일을 웹에서 직접
 * 한다 — 투표 창은 exposed_at 으로 정해지므로, 이 공지는 알림일 뿐 투표가 열리는
 * 시각과는 무관하다.
 *
 * 실패해도 던지지 않는다. 설문은 이미 등록됐고, 공지가 안 갔다고 되돌릴 일은
 * 아니다. 대신 성공 여부를 돌려줘서 화면에 알릴 수 있게 한다.
 */
export async function sendSurveyAnnouncement(params: {
  title: string;
  opensAtLabel: string;
  voteUrl: string;
}): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return false;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content:
          `📋 **${params.title}** 거점전 설문조사\n\n` +
          `투표는 **${params.opensAtLabel}** 에 열립니다. 모두에게 같은 시각에 열리며, ` +
          `링크를 미리 열어두면 남은 시간이 표시됩니다.\n${params.voteUrl}`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
