/**
 * 디스코드 공지.
 *
 * 예전에는 투표 한 건마다 로그 채널로 웹훅을 쐈다. 투표가 열리는 순간 150명이
 * 몰리면 웹훅 속도 제한(대략 2초에 5건)에 걸려 상당수가 조용히 누락됐고, 정작
 * 같은 내용이 survey_history 에 이미 다 남아 있었다. 그래서 로그는 관리자
 * 화면에서 보고, 디스코드로는 공지만 보낸다.
 */
export async function sendSurveyAnnouncement(params: {
  title: string;
  opensAtLabel: string;
  voteUrl: string;
}): Promise<boolean> {
  // 예전 단일 웹훅 설정으로 배포된 환경도 그대로 돌아가도록 폴백을 둔다.
  const url = process.env.DISCORD_ANNOUNCE_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (!url) return false;

  try {
    const res = await fetch(url, {
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
    // 공지가 실패해도 설문은 이미 등록됐다. 던지지 않고 결과만 돌려준다.
    return false;
  }
}
