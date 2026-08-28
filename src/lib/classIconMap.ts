// Maps character_class.name (Korean) to the English filename used under
// public/classes/Class Icon {filename}.png. Keys match the live
// character_class table exactly (32 distinct names across 57 rows — the same
// name appears under both Succession and Awaken and shares one icon, the mark
// badge is what distinguishes them). Add a line here if a new class ships.
const CLASS_ICON_FILENAME: Record<string, string> = {
  워리어: "Warrior",
  소서러: "Sorceress",
  레인저: "Ranger",
  자이언트: "Berserker",
  금수랑: "Tamer",
  무사: "Musa",
  발키리: "Valkyrie",
  매화: "Maehwa",
  위자드: "Wizard",
  위치: "Witch",
  쿠노이치: "Kunoichi",
  닌자: "Ninja",
  다크나이트: "Dark Knight",
  격투가: "Striker",
  미스틱: "Mystic",
  란: "Lahn",
  아처: "Archer",
  샤이: "Shai",
  가디언: "Guardian",
  하사신: "Hashashin",
  노바: "Nova",
  세이지: "Sage",
  커세어: "Corsair",
  드라카니아: "Drakania",
  우사: "Woosa",
  매구: "Maegu",
  스칼라: "Scholar",
  도사: "Dosa",
  데드아이: "Deadeye",
  오공: "WuKong",
  세라핌: "Serapin",
  에이전트: "Agent",
};

export const DEFAULT_CLASS_ICON = "/classes/default.png";

export function getClassIconPath(name: string): string {
  const filename = CLASS_ICON_FILENAME[name];
  return filename ? `/classes/Class Icon ${filename}.png` : DEFAULT_CLASS_ICON;
}
