import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../domain/src/index";
export const randomToken = () => randomBytes(32).toString("base64url");
export const keyedHash = (value: string, key: string) =>
  createHmac("sha256", key).update(value).digest("hex");
export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function trackingToken(clientId: string, key: string) {
  return createHmac("sha256", key)
    .update("report-tracking:" + clientId)
    .digest("base64url");
}
const qrSchema = z
  .object({
    siteId: z.string().min(1).max(100),
    version: z.literal(1),
    issuedAt: z.number().int(),
    expiresAt: z.number().int(),
  })
  .strict();
export function signQr(payload: z.infer<typeof qrSchema>, key: string) {
  const data = Buffer.from(JSON.stringify(qrSchema.parse(payload))).toString(
    "base64url",
  );
  return data + "." + keyedHash(data, key);
}
export function verifyQr(
  token: string,
  key: string,
  now = Math.floor(Date.now() / 1000),
) {
  const [payload, signature, extra] = token.split(".");
  if (
    !payload ||
    !signature ||
    extra ||
    !safeEqual(keyedHash(payload, key), signature)
  )
    throw new AppError(400, "QR_INVALID", "Invalid QR signature.");
  try {
    const data = qrSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString()),
    );
    if (data.expiresAt < now || data.issuedAt > now + 30) throw new Error();
    return data;
  } catch {
    throw new AppError(400, "QR_EXPIRED", "QR token is invalid or expired.");
  }
}
export function assertSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const target = new URL(request.url).origin;
  const configured = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : target;
  if (origin && origin !== target && origin !== configured)
    throw new AppError(
      403,
      "ORIGIN_REJECTED",
      "Cross-origin writes are not allowed.",
    );
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new AppError(
      403,
      "ORIGIN_REJECTED",
      "Cross-site writes are not allowed.",
    );
}
export interface RateLimiter {
  consume(key: string, limit: number, windowMs: number): Promise<void>;
}
export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { count: number; reset: number }>();
  async consume(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    let entry = this.buckets.get(key);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      this.buckets.set(key, entry);
    }
    if (++entry.count > limit)
      throw new AppError(
        429,
        "RATE_LIMITED",
        "Too many requests. Try again shortly.",
      );
    if (this.buckets.size > 10000)
      for (const [k, v] of this.buckets)
        if (v.reset < now) this.buckets.delete(k);
  }
}
export function auditHash(entry: object, previousHash: string, key: string) {
  return keyedHash(previousHash + JSON.stringify(entry), key);
}
