import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/*
 * 거점전 스크린샷을 두는 곳.
 *
 * 서버 안에 두지 않는 이유는 배포 때문이다. docker compose up --build 는
 * 컨테이너를 새로 만들므로, 컨테이너 안에 쌓인 파일은 배포할 때마다 사라진다.
 * R2 는 앱과 따로 살아서 서버를 갈아엎어도 남는다.
 *
 * 버킷은 비공개로 둔다. 브라우저는 R2 를 모르고, 사진을 달라는 요청은 전부
 * /api/battle-image 를 거친다. 공개로 열 사진인지는 거기서 우리가 판단한다.
 */

const endpoint = process.env.R2_ACCOUNT_ID
  ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  : "";

export const R2_BUCKET = process.env.R2_BUCKET ?? "";

/** 설정이 다 들어오기 전에도 나머지 화면은 돌아야 하므로 먼저 확인한다. */
export function r2Configured(): boolean {
  return Boolean(
    endpoint && R2_BUCKET && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY,
  );
}

let client: S3Client | null = null;

function r2(): S3Client {
  if (!r2Configured()) {
    throw new Error("R2 설정이 없습니다. R2_ACCOUNT_ID, R2_BUCKET, 키 두 개를 .env 에 넣어 주세요.");
  }
  // 요청마다 새로 만들지 않는다. 연결을 재사용하는 편이 빠르고, 자격 증명을
  // 다시 읽을 일도 없다.
  client ??= new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });
  return client;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2().send(
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

export interface R2Object {
  body: Buffer;
  contentType: string;
}

export async function getObject(key: string): Promise<R2Object | null> {
  try {
    const result = await r2().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    if (!result.Body) return null;
    return {
      body: Buffer.from(await result.Body.transformToByteArray()),
      contentType: result.ContentType ?? "application/octet-stream",
    };
  } catch (error) {
    // 지워진 파일을 가리키는 행이 남아 있을 수 있다. 그때는 화면에서 사진만
    // 빠지면 되고, 거점 전체가 오류로 죽을 일은 아니다.
    if ((error as { name?: string }).name === "NoSuchKey") return null;
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
