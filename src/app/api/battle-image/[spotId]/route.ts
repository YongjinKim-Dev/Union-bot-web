import { auth } from "@/auth";
import { getSpotImage } from "@/lib/battleQueries";
import { getObject, r2Configured } from "@/lib/r2";

export const dynamic = "force-dynamic";

/*
 * 자리 사진을 내주는 길.
 *
 * 버킷은 비공개라 브라우저가 R2 를 직접 부를 수 없다. 사진은 반드시 여기를
 * 거치고, 여기서 공개 여부를 본다 — 꺼져 있으면 로그인한 사람에게만 준다.
 * 잠그는 곳이 클라우드플레어가 아니라 우리 코드이므로, 사진 하나하나 다르게
 * 정할 수 있다.
 *
 * 서버가 서울에 있어 한 번 거쳐도 느려지지 않는다.
 */
export async function GET(request: Request, { params }: { params: Promise<{ spotId: string }> }) {
  if (!r2Configured()) return new Response("보관함 설정 없음", { status: 503 });

  const { spotId } = await params;
  const image = await getSpotImage(spotId);
  if (!image) return new Response("없음", { status: 404 });

  if (!image.isPublic) {
    const session = await auth();
    if (!session?.user?.dbUserId) return new Response("로그인 필요", { status: 401 });
  }

  /* 열쇠가 그대로면 같은 사진이다. 본문을 다시 보내지 않는다 — 사진을 바꿔야
     열쇠가 바뀌므로, 이것만으로 "바뀌었을 때만 새로 받기"가 된다. */
  const tag = `"${image.key}"`;
  if (request.headers.get("if-none-match") === tag) {
    return new Response(null, { status: 304, headers: { ETag: tag } });
  }

  const object = await getObject(image.key);
  if (!object) return new Response("없음", { status: 404 });

  return new Response(new Uint8Array(object.body), {
    headers: {
      "Content-Type": object.contentType,
      /* 주소는 자리마다 하나뿐이라 사진을 바꿔도 그대로다. 그래서 오래 물고
         있게 두면 새 사진이 안 보인다. 열쇠를 꼬리표로 주고 매번 물어보게 한다. */
      ETag: tag,
      "Cache-Control": image.isPublic
        ? "public, max-age=0, must-revalidate"
        : "private, max-age=0, must-revalidate",
    },
  });
}
