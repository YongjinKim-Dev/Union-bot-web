"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./admin.module.css";
import { OperationTab } from "./OperationTab";
import { PastVotesTab } from "./PastVotesTab";
import { SettingsTab } from "./SettingsTab";
import type { PresetControls, TabKey } from "./adminData";
import { DEFAULT_PRESETS } from "./adminMock";

const TABS: TabKey[] = ["운영", "지난 투표"];

/* 탭 껍데기. 탭을 오가도 유지돼야 하는 상태(정원 프리셋, 마감 여부, 토스트)만 여기서 든다. */
export function AdminConsole() {
  const [tab, setTab] = useState<TabKey>("운영");

  const [cap, setCap] = useState(DEFAULT_PRESETS[0]);
  // 배선 전 데모용 국면. 배선되면 서버 시각으로 계산한다: 라이브 -> 마감 -> (거점전 뒤) 다음 투표 대기
  const [waiting] = useState(false);
  const [closed, setClosed] = useState(false);
  const [presetList, setPresetList] = useState<number[]>([...DEFAULT_PRESETS]);

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
          <SettingsTab showToast={showToast} closed={closed} waiting={waiting} onClose={() => setClosed(true)} />
          <OperationTab presets={presets} showToast={showToast} closed={closed} waiting={waiting} />
        </>
      )}
      {tab === "지난 투표" && <PastVotesTab cap={cap} />}

      <div className={`${styles.toast} ${toast ? styles.toastShow : ""}`}>{toast}</div>
    </div>
  );
}
