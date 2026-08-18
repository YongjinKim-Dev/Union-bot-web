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
