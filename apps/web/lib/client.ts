import { openDB, type DBSchema } from "idb";
import type {
  ReportInput,
  PublicReport,
} from "../../../packages/domain/src/index";
export interface Draft {
  id: string;
  input: Omit<ReportInput, 'consent'> & {consent:boolean};
  photo: Blob;
  mediaId?: string;
  syncState: "waiting" | "uploading" | "needsAttention";
  createdAt: string;
  attempts: number;
  nextRetryAt: number;
  lastError?: string;
}
interface DraftDB extends DBSchema {
  drafts: { key: string; value: Draft };
}
const db = () =>
  openDB<DraftDB>("denguespot-drafts", 1, {
    upgrade(database) {
      database.createObjectStore("drafts", { keyPath: "id" });
    },
  });
export async function saveDraft(draft: Draft) {
  await (await db()).put("drafts", draft);
}
export async function listDrafts() {
  const database = await db();
  const drafts = await database.getAll("drafts");
  const expired = drafts.filter(
    (d) => Date.now() - Date.parse(d.createdAt) > 7 * 86400000,
  );
  for (const d of expired) await database.delete("drafts", d.id);
  return drafts.filter((d) => !expired.includes(d));
}
export async function removeDraft(id: string) {
  await (await db()).delete("drafts", id);
}
export class ClientError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  route: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api/v1/" + route, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const result = (await response
      .json()
      .catch(() => ({ error: { message: "Request failed" } }))) as {
      error?: { message?: string };
    };
    throw new ClientError(
      result.error?.message || "Request failed",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}
export interface SavedReport {
  publicId: string;
  trackingToken: string;
  createdAt: string;
}
export function savedReports(): SavedReport[] {
  try {
    return JSON.parse(
      localStorage.getItem("dsp-tracking") || "[]",
    ) as SavedReport[];
  } catch {
    return [];
  }
}
export function rememberReport(report: SavedReport) {
  localStorage.setItem(
    "dsp-tracking",
    JSON.stringify([
      ...savedReports().filter((r) => r.publicId !== report.publicId),
      report,
    ]),
  );
}
const inflight = new Map<
  string,
  Promise<{ report: PublicReport; trackingToken: string }>
>();
export function syncDraft(
  draft: Draft,
): Promise<{ report: PublicReport; trackingToken: string }> {
  const current = inflight.get(draft.id);
  if (current) return current;
  const work = (async () => {
    try {
      if(!draft.input.consent) throw new ClientError('Consent required before upload.',422);
      draft.syncState = "uploading";
      await saveDraft(draft);
      if (!draft.mediaId) {
        const data = new FormData();
        data.set("clientReportId", draft.id);
        data.set("kind", "before");
        data.set("consent", "true");
        data.set(
          "photo",
          draft.photo,
          "evidence." +
            (draft.photo.type === "image/png"
              ? "png"
              : draft.photo.type === "image/webp"
                ? "webp"
                : "jpg"),
        );
        const media = await api<{ mediaId: string }>("media/uploads", {
          method: "POST",
          body: data,
        });
        draft.mediaId = media.mediaId;
        await saveDraft(draft);
      }
      const result = await api<{ report: PublicReport; trackingToken: string }>(
        "reports",
        {
          method: "POST",
          headers: { "Idempotency-Key": draft.id },
          body: JSON.stringify({ ...draft.input, mediaId: draft.mediaId }),
        },
      );
      rememberReport({
        publicId: result.report.publicId,
        trackingToken: result.trackingToken,
        createdAt: result.report.createdAt,
      });
      await removeDraft(draft.id);
      return result;
    } catch (error) {
      draft.attempts++;
      draft.syncState =
        error instanceof ClientError &&
        error.status >= 400 &&
        error.status < 500
          ? "needsAttention"
          : "waiting";
      draft.nextRetryAt =
        Date.now() + Math.min(300000, 1000 * 2 ** draft.attempts);
      draft.lastError =
        error instanceof Error ? error.message : "Upload failed";
      await saveDraft(draft);
      throw error;
    }
  })();
  inflight.set(draft.id, work);
  work.finally(() => inflight.delete(draft.id)).catch(() => {});
  return work;
}
export async function syncWaiting() {
  if (!navigator.onLine) return;
  for (const draft of await listDrafts()) {
    if (
      draft.syncState !== "needsAttention" &&
      draft.input.consent &&
      draft.nextRetryAt <= Date.now()
    )
      try {
        await syncDraft(draft);
        window.dispatchEvent(new Event("dsp-synced"));
      } catch {
        /* Status is preserved on the draft. */
      }
  }
}
