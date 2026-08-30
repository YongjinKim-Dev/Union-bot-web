/* 서버가 시작될 때 한 번 실행된다. DB 준비처럼 요청 전에 끝나야 하는 일을 여기서 한다. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureResultSentColumn } = await import("@/lib/adminQueries");
  const { ensureSettings } = await import("@/lib/settings");
  const { syncSurveyQueue } = await import("@/lib/surveyQueue");
  const { msUntilNextKstMidnight } = await import("@/lib/week");
  await ensureSettings();
  await ensureResultSentColumn();
  await syncSurveyQueue();

  // 한국시간 자정마다 돌면서 투표 큐를 관리한다
  const scheduleDaily = () => {
    setTimeout(() => {
      syncSurveyQueue().catch((e) => console.error("[surveyQueue]", e));
      scheduleDaily();
    }, msUntilNextKstMidnight(new Date()));
  };
  scheduleDaily();
}
