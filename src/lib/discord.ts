/**
 * 설문 공지를 디스코드로 보낸다.
 *
 * 투표 로그는 더 이상 디스코드로 보내지 않는다 — 투표가 열리는 순간 몰리면
 * 웹훅 속도 제한에 걸려 누락됐고, 같은 내용이 survey_history 에 다 남아 있어
 * 관리자 화면에서 본다.
 *
 * ?wait=true 를 붙이면 Discord 가 만들어진 메시지를 돌려준다. 그 id 를
 * survey.discord_message_id 에 저장해두면 봇의 !결과·!마감 같은 명령어가
 * 지금까지처럼 메시지 id 로 설문을 찾을 수 있다.
 */
export async function sendSurveyAnnouncement(content: string): Promise<string | null> {
  // 예전 단일 웹훅 설정으로 배포된 환경도 그대로 돌아가도록 폴백을 둔다.
  const url = process.env.DISCORD_ANNOUNCE_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return null;
    const message = (await res.json()) as { id?: string };
    return message.id ?? null;
  } catch {
    return null;
  }
}
