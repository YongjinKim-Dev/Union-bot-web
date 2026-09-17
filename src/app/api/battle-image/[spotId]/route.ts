import { getSpotImage } from "@/lib/battleQueries";
import { storedImageResponse } from "@/lib/storedImageResponse";

export const dynamic = "force-dynamic";

/** 자리 사진. 공개 여부와 로그인 확인은 storedImageResponse 가 맡는다. */
export async function GET(request: Request, { params }: { params: Promise<{ spotId: string }> }) {
  const { spotId } = await params;
  return storedImageResponse(request, await getSpotImage(spotId));
}
