import { signIn } from "@/auth";
import styles from "./login.module.css";

const ERROR_MESSAGES: Record<string, string> = {
  unregistered:
    "등록되지 않은 계정이거나 비활성화 상태입니다. 운영진에게 문의해주세요.",
  AccessDenied:
    "등록되지 않은 계정이거나 비활성화 상태입니다. 운영진에게 문의해주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "로그인 중 오류가 발생했습니다." : null;

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>아지다하카 거점전 투표</h1>
        <p className={styles.subtitle}>디스코드 계정으로 로그인해주세요.</p>
        {errorMessage && <p className={styles.error}>{errorMessage}</p>}
        <form
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: "/vote" });
          }}
        >
          <button type="submit" className={styles.discordButton}>
            Discord로 로그인
          </button>
        </form>
      </div>
    </main>
  );
}
