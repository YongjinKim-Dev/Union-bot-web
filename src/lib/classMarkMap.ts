import type { ClassType } from "@/lib/types";

export interface ClassMark {
  src: string;
  /** Badge ring color — CSS custom property reference. */
  borderColor: string;
  alt: string;
}

const SUCCESSION_MARK: ClassMark = {
  src: "/marks/succession.png",
  borderColor: "var(--color-mark-succession)",
  alt: "전승",
};

const AWAKENING_MARK: ClassMark = {
  src: "/marks/awakening.png",
  borderColor: "var(--color-mark-awakening)",
  alt: "각성",
};

// 기타(개방·재능) classes don't share a branch mark — each carries its own
// weapon motif on a neutral ring. These are the live `Else` rows, all six.
// ClassIcon hides the whole badge if a file here is missing, so a class can be
// listed before its art lands.
const ELSE_MARKS: Record<string, string> = {
  아처: "/marks/archer.png",
  샤이: "/marks/shai.png",
  스칼라: "/marks/scholar.png",
  데드아이: "/marks/deadeye.png",
  오공: "/marks/wukong.png",
  세라핌: "/marks/serapin.png",
};

export function getClassMark(name: string, type: ClassType): ClassMark | null {
  if (type === "Succession") return SUCCESSION_MARK;
  if (type === "Awaken") return AWAKENING_MARK;

  const src = ELSE_MARKS[name];
  if (!src) return null;
  return { src, borderColor: "var(--color-mark-neutral)", alt: name };
}
