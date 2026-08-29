import Link from "next/link";
import { ClassIcon } from "@/components/ClassIcon";
import { SiteHeader } from "@/components/SiteHeader";
import styles from "./docs.module.css";

export const metadata = { title: "문서 · 아시바당" };

/** Bump this when the copy below changes. */
const LAST_UPDATED = "2026-08-28";

const VOTE_TYPES = [
  { label: "참여", description: "본대 참가. 직업 등록 필수." },
  { label: "부속", description: "대기 인원. 참여로 전환해도 순번이 유지됩니다." },
  { label: "늦참", description: "시작 이후 합류. 별도 명단으로 집계됩니다." },
  { label: "미참", description: "불참. 사유 입력은 필요하지 않습니다." },
];

export default function DocsPage() {
  return (
    <main className={styles.main}>
      <SiteHeader active="docs" kicker="DOCS" />

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <span className={styles.sidebarKicker}>문서</span>
          <nav className={styles.toc}>
            <span className={styles.tocLinkActive}>투표 사용법</span>
          </nav>
          <p className={styles.sidebarNote}>다른 문서는 필요할 때 추가합니다.</p>
        </aside>

        <div className={styles.divider} />

        <article className={styles.article}>
          <span className={styles.kicker}>문서 01</span>
          <h1 className={styles.title}>투표 사용법</h1>
          <p className={styles.lead}>
            거점전 설문은 해당 요일 시작 15분 전에 디스코드로 링크가 전송됩니다. 링크를 열면
            디스코드 계정으로 로그인되고, 연맹에 등록된 계정만 투표 화면에 들어갈 수 있습니다.
          </p>

          <h2 className={styles.heading}>1. 표 종류</h2>
          <div className={styles.defList}>
            {VOTE_TYPES.map((v) => (
              <div key={v.label} className={styles.defRow}>
                <span className={styles.defTerm}>{v.label}</span>
                <span className={styles.defDescription}>{v.description}</span>
              </div>
            ))}
          </div>

          <h2 className={styles.heading}>2. 직업 등록</h2>
          <p className={styles.paragraph}>
            참여·부속을 선택하려면 직업이 등록되어 있어야 합니다. 계열(전승·각성·기타)을 먼저
            고르고 직업을 선택하며, 같은 직업이라도 전승과 각성은 다른 항목으로 취급됩니다.
          </p>
          <div className={styles.chipRow}>
            <span className={styles.chip}>
              <ClassIcon name="워리어" type="Succession" size={26} markSize={14} />
              <span className={styles.chipLabel}>전승 워리어</span>
            </span>
            <span className={styles.chip}>
              <ClassIcon name="워리어" type="Awaken" size={26} markSize={14} />
              <span className={styles.chipLabel}>각성 워리어</span>
            </span>
            <Link href="/classes" className={styles.inlineLink}>
              직업 등록 화면 →
            </Link>
          </div>

          <h2 className={styles.heading}>3. 중복 투표와 마감</h2>
          <p className={styles.paragraph}>
            같은 설문에 다시 투표하면 이전 표가 갱신됩니다. 다만 직업만 바뀌는 경우에는 순번이
            바뀌지 않습니다. 기본 마감은 거점전 시작 1시간 전이며, 마감 이후에는 버튼이
            비활성화됩니다. 변경이 필요한 경우 운영진에 직접 요청하세요.
          </p>
          <div className={styles.calloutBox}>
            <span className={styles.calloutKicker}>참고</span>
            <p className={styles.calloutText}>
              거점전은 월·화·수·목·금·일 여섯 요일에 열립니다. 요일마다 설문이 따로 열리며, 홈
              화면의 요일 칸에서 각 설문의 상태를 확인할 수 있습니다.
            </p>
          </div>

          <p className={styles.updated}>최종 수정 {LAST_UPDATED}</p>
        </article>
      </div>
    </main>
  );
}
