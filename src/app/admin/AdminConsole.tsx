"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getVotingClosesAt } from "@/lib/format";
import type { AdminSettings } from "@/lib/settings";
import type { DbSurvey } from "@/lib/types";
import styles from "./admin.module.css";
import { OperationTab } from "./OperationTab";
import { PastVotesTab } from "./PastVotesTab";
import { SettingsTab } from "./SettingsTab";
import type { PresetControls, TabKey } from "./adminData";
import { DEFAULT_PRESETS } from "./adminMock";

const TABS: TabKey[] = ["운영", "지난 투표"];

export type Phase = "waiting" | "live" | "closed";

function phaseOf(current: DbSurvey | null, now: Date): Phase {
  if (!current) return "waiting";
  if (now < current.exposed_at) return "waiting";
  // 관리자가 즉시 마감을 누르면 complete 가 찍힌다
  if (current.status === "complete") return "closed";
  if (now < getVotingClosesAt(current.executed_at)) return "live";
  return "closed";
}

interface AdminConsoleProps {
  current: DbSurvey | null;
  queue: DbSurvey[];
  settings: AdminSettings;
}

/* 탭 껍데기. 탭을 오가도 유지돼야 하는 상태(정원 프리셋, 마감 여부, 토스트)만 여기서 든다. */
export function AdminConsole({ current, queue, settings }: AdminConsoleProps) {
  const [tab, setTab] = useState<TabKey>("운영");

  const [cap, setCap] = useState(settings.capPresets[0] ?? DEFAULT_PRESETS[0]);
  const [presetList, setPresetList] = useState<number[]>(
    settings.capPresets.length > 0 ? [...settings.capPresets] : [...DEFAULT_PRESETS],
  );

  // 기기 시계로 1분마다 다시 판정하고, 회차 전환이 시각으로 일어나므로
  // 일정 데이터도 같이 다시 읽어온다. 관리자 화면은 몇 초 밀려도 상관없다
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      router.refresh();
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [router]);
  const phase: Phase = phaseOf(current, now);

  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const presets: PresetControls = {
    cap,
    setCap,
    presets: presetList,
    remove: (index) => {
      // 프리셋은 최소 1개 남긴다
      if (presetList.length <= 1) return;
      const gone = presetList[index];
      setPresetList((prev) => prev.filter((_, i) => i !== index));
      if (cap === gone) setCap(presetList.find((_, i) => i !== index) ?? gone);
    },
    add: (raw) => {
      const v = Number.parseInt(raw, 10);
      if (!Number.isFinite(v) || v <= 0) return;
      setPresetList((prev) => (prev.includes(v) ? prev : [...prev, v].sort((a, b) => a - b)));
    },
  };

  return (
    <div className={styles.console}>
      <div className={styles.tabs}>
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            className={`${styles.tab} ${tab === key ? styles.tabActive : ""}`}
            onClick={() => setTab(key)}
          >
            {key}
          </button>
        ))}
      </div>

      {tab === "운영" && (
        <>
          <SettingsTab
            current={current}
            queue={queue}
            autoRule={settings.autoRule}
            phase={phase}
            showToast={showToast}
          />
          <OperationTab
            presets={presets}
            showToast={showToast}
            closed={phase === "closed"}
            waiting={phase === "waiting"}
            current={current}
          />
        </>
      )}
      {tab === "지난 투표" && <PastVotesTab cap={cap} />}

      <div className={`${styles.toast} ${toast ? styles.toastShow : ""}`}>{toast}</div>
    </div>
  );
}
