"use client";

import { clearBaseMapAction, setBaseMapPublicAction, uploadBaseMapAction } from "../actions";
import styles from "../battle.module.css";
import { ImageUploader } from "./ImageUploader";

/*
 * 거점 전체 지도. 자리 사진이 "어디에 서나"를 보여 준다면 이건 "거점이 어떻게
 * 생겼나"를 보여 준다. 그래서 자리보다 먼저, 페이지 폭을 다 써서 놓는다.
 *
 * 지도는 작은 글씨까지 읽어야 하므로 눌러서 원본 크기로 열 수 있게 한다.
 */
export function MapPanel({
  baseId,
  baseName,
  mapKey,
  mapPublic,
  editing,
  onError,
}: {
  baseId: string;
  baseName: string;
  mapKey: string | null;
  mapPublic: boolean;
  editing: boolean;
  onError: (message: string) => void;
}) {
  // 열쇠를 꼬리에 붙여, 지도를 바꾸면 주소도 달라져 새 창에서 바로 새 지도가 열린다.
  const src = mapKey ? `/api/battle-map/${baseId}?v=${encodeURIComponent(mapKey.slice(-12))}` : null;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>거점 지도</h2>
        {src && (
          <a href={src} target="_blank" rel="noreferrer" className={styles.sectionLink}>
            크게 보기 ↗
          </a>
        )}
      </div>

      <div className={styles.mapFrame}>
        {src ? (
          <a href={src} target="_blank" rel="noreferrer" className={styles.mapLink}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 로그인 확인을 거쳐 우리 길로 내주는 사진이라 next/image 의 최적화 경로를 타지 않는다. */}
            <img src={src} alt={`${baseName} 지도`} className={styles.mapImg} />
          </a>
        ) : (
          <span className={styles.shotNote}>거점 지도 자리</span>
        )}
        {src && mapPublic && <span className={styles.openBadge}>공개</span>}
      </div>

      {editing && (
        <div className={styles.mapEdit}>
          <ImageUploader
            label={`"${baseName}" 지도`}
            hasImage={mapKey !== null}
            isPublic={mapPublic}
            upload={(form, isPublic) => uploadBaseMapAction(baseId, form, isPublic)}
            clear={() => clearBaseMapAction(baseId)}
            setPublic={(isPublic) => setBaseMapPublicAction(baseId, isPublic)}
            onError={onError}
          />
        </div>
      )}
    </section>
  );
}
