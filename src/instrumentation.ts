/* 서버가 시작될 때 한 번 실행된다. DB 준비처럼 요청 전에 끝나야 하는 일을 여기서 한다. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureResultSentColumn } = await import("@/lib/adminQueries");
  await ensureResultSentColumn();
}
