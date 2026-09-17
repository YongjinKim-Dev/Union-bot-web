import { getBaseMap } from "@/lib/battleQueries";
import { storedImageResponse } from "@/lib/storedImageResponse";

export const dynamic = "force-dynamic";

/** 거점 전체 지도. 자리 사진과 같은 규칙으로 내준다. */
export async function GET(request: Request, { params }: { params: Promise<{ baseId: string }> }) {
  const { baseId } = await params;
  return storedImageResponse(request, await getBaseMap(baseId));
}
