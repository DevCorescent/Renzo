import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

// OWNER: Gauransh | MODULE: Cloudflare R2 Upload
// POST /api/v1/upload — Accepts a file, uploads to Cloudflare R2, returns public URL.
// Auth: any authenticated user.

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/gif":  "gif",
};

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req);
  if (error) return error;

  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  const r2 = getR2Client();

  if (!r2 || !bucket || !publicUrl) {
    console.error("R2 env vars not configured");
    return err("Image upload is not configured", 503);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return err("Invalid form data");
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) return err("No file provided");

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return err("File must be JPEG, PNG, WebP, or GIF");
  if (file.size > MAX_BYTES) return err("File must be under 5 MB");

  const key = `uploads/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ContentLength: buffer.length,
      })
    );
  } catch (e) {
    console.error("R2 upload error:", e);
    return err("Failed to upload image", 502);
  }

  const url = `${publicUrl}/${key}`;
  return ok({ url, key });
}
