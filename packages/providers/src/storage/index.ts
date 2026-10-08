import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { dataDir, demoEnabled } from "../../../config/src/index";
export interface PrivateStorage {
  put(key: string, data: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
function checkedKey(key: string) {
  if (!/^(originals|derivatives)\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key))
    throw new Error("Invalid storage key");
  return key;
}
export class LocalPrivateStorage implements PrivateStorage {
  async put(key: string, data: Buffer) {
    const file = path.join(dataDir(), "media", checkedKey(key));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data, { mode: 0o600 });
  }
  async get(key: string) {
    return readFile(path.join(dataDir(), "media", checkedKey(key)));
  }
  async remove(key: string) {
    await unlink(path.join(dataDir(), "media", checkedKey(key))).catch(
      (error) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      },
    );
  }
}
export class SupabasePrivateStorage implements PrivateStorage {
  private client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  private location(key: string) {
    checkedKey(key);
    const [kind, name] = key.split("/");
    return {
      bucket:
        kind === "originals"
          ? process.env.STORAGE_BUCKET_ORIGINAL || "originals"
          : process.env.STORAGE_BUCKET_REDACTED || "derivatives",
      name,
    };
  }
  async put(key: string, data: Buffer, mime: string) {
    const { bucket, name } = this.location(key);
    const { error } = await this.client.storage
      .from(bucket)
      .upload(name, data, { contentType: mime, upsert: false });
    if (error) throw new Error("Private storage upload failed");
  }
  async get(key: string) {
    const { bucket, name } = this.location(key);
    const { data, error } = await this.client.storage
      .from(bucket)
      .download(name);
    if (error || !data) throw new Error("Private storage download failed");
    return Buffer.from(await data.arrayBuffer());
  }
  async remove(key: string) {
    const { bucket, name } = this.location(key);
    const { error } = await this.client.storage.from(bucket).remove([name]);
    if (error) throw new Error("Private storage deletion failed");
  }
  async signedUrl(key: string) {
    const { bucket, name } = this.location(key);
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(name, 60);
    if (error || !data) throw new Error("Signing failed");
    return data.signedUrl;
  }
}
export function storage(): PrivateStorage {
  if (process.env.STORAGE_BACKEND === "s3") return new S3PrivateStorage();
  if (process.env.STORAGE_BACKEND === "supabase")
    return new SupabasePrivateStorage();
  if (demoEnabled()) return new LocalPrivateStorage();
  throw new Error("Private object storage must be configured");
}
export class S3PrivateStorage implements PrivateStorage {
  private client = new S3Client({ region: process.env.AWS_REGION });
  private bucket = process.env.S3_BUCKET;
  private assertBucket() {
    if (!this.bucket) throw new Error("S3_BUCKET required");
    return this.bucket;
  }
  async put(key: string, data: Buffer, mime: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.assertBucket(),
        Key: checkedKey(key),
        Body: data,
        ContentType: mime,
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: process.env.S3_KMS_KEY_ID,
      }),
    );
  }
  async get(key: string) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.assertBucket(),
        Key: checkedKey(key),
      }),
    );
    if (!response.Body) throw new Error("Media not found");
    return Buffer.from(await response.Body.transformToByteArray());
  }
  async remove(key: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.assertBucket(),
        Key: checkedKey(key),
      }),
    );
  }
  async signedUrl(key: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.assertBucket(),
        Key: checkedKey(key),
      }),
      { expiresIn: 60 },
    );
  }
}
