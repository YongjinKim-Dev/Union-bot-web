import Image from "next/image";
import styles from "./ProfileAvatar.module.css";

// 브라우저가 디스코드에서 작은 이미지를 직접 받아 기존 표시 방식을 유지한다.
function avatarSrc(image: string, size: number): string {
  try {
    const url = new URL(image);
    url.searchParams.set("size", size <= 64 ? "64" : "128");
    return url.toString();
  } catch {
    return image;
  }
}

export function ProfileAvatar({ image, name, size = 34 }: {
  image: string | null;
  name: string;
  size?: number;
}) {
  return image ? (
    <Image src={avatarSrc(image, size)} alt="" width={size} height={size}
      className={styles.avatar} unoptimized />
  ) : (
    <span className={`${styles.avatar} ${styles.placeholder}`} aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * .4) }}>
      {Array.from(name.trim())[0] || "?"}
    </span>
  );
}
