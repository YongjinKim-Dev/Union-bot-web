"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./vote.module.css";

export type TabKey = "process" | "wait" | "complete";

const TAB_LABEL: Record<TabKey, string> = {
  process: "진행중",
  wait: "대기중",
  complete: "지난 설문",
};

const TAB_ORDER: TabKey[] = ["process", "wait", "complete"];

export function VoteTabs({
  defaultTab,
  hasProcessSurvey,
  processContent,
  waitContent,
  completeContent,
}: {
  defaultTab: TabKey;
  hasProcessSurvey: boolean;
  processContent: ReactNode;
  waitContent: ReactNode;
  completeContent: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);
  const prevHasProcessSurvey = useRef(hasProcessSurvey);

  // A wait-tab poll (see WaitingSurveyPanel) refreshes this page's server
  // data every 5s. The moment that refresh reports a survey just went live,
  // jump the user to the 진행중 tab regardless of which tab they're on.
  useEffect(() => {
    if (!prevHasProcessSurvey.current && hasProcessSurvey) {
      setActiveTab("process");
    }
    prevHasProcessSurvey.current = hasProcessSurvey;
  }, [hasProcessSurvey]);

  const content: Record<TabKey, ReactNode> = {
    process: processContent,
    wait: waitContent,
    complete: completeContent,
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
