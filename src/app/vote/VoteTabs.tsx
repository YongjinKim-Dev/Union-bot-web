"use client";

import { useState, type ReactNode } from "react";
import styles from "./vote.module.css";

export type TabKey = "current" | "past";

const TAB_LABEL: Record<TabKey, string> = {
  current: "현재 설문",
  past: "지난 설문",
};

const TAB_ORDER: TabKey[] = ["current", "past"];

/**
 * 진행중·대기중을 "현재 설문" 하나로 합쳤다. 예전에는 대기중 탭에서 카운트다운이
 * 0이 되어도 진행중 탭을 다시 눌러야 투표 화면이 보였는데, 이제 같은 탭 안에서
 * 대기 상태가 투표 화면으로 그대로 바뀐다 (WaitingSurveyPanel의 5초 폴링이
 * 서버 데이터를 갱신하면 자동 전환).
 */
export function VoteTabs({
  currentContent,
  pastContent,
}: {
  currentContent: ReactNode;
  pastContent: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("current");

  const content: Record<TabKey, ReactNode> = {
    current: currentContent,
    past: pastContent,
  };

  return (
    <div>
      <div className={styles.tabBar} role="tablist">
        {TAB_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            className={`${styles.tabButton} ${activeTab === key ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab(key)}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </div>
      <div className={styles.tabContent}>{content[activeTab]}</div>
    </div>
  );
}
