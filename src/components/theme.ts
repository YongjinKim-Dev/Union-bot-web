export type Theme = "light" | "dark";

const STORAGE_KEY = "union-theme";

// React 실행과 스타일의 첫 페인트 전에 적용한다. 저장소가 막혀도 시스템 설정을 쓴다.
export const THEME_INIT_SCRIPT = `(function(){var theme;try{theme=localStorage.getItem("union-theme")}catch(e){}if(theme!=="light"&&theme!=="dark"){theme=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=theme})()`;

let memoryPreference: Theme | null = null;

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function getServerTheme(): Theme {
  return "light";
}

export function toggleTheme(): void {
  const theme = getTheme() === "dark" ? "light" : "dark";
  memoryPreference = theme;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장소가 막힌 브라우저도 현재 탭에서는 전환할 수 있다.
  }
}

export function subscribeTheme(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const syncSystem = () => {
    const choice = memoryPreference ?? savedTheme();
    document.documentElement.dataset.theme = choice ?? (media.matches ? "dark" : "light");
  };
  const syncStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    memoryPreference = null;
    syncSystem();
  };
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  media.addEventListener("change", syncSystem);
  window.addEventListener("storage", syncStorage);
  // 구독하기 전 시스템 설정이 바뀐 경우도 반영한다.
  syncSystem();
  return () => {
    observer.disconnect();
    media.removeEventListener("change", syncSystem);
    window.removeEventListener("storage", syncStorage);
  };
}
