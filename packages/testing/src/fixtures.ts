import { randomUUID } from "node:crypto";
import type { Repository, Transaction } from "../../db/src/index";
import { demoSeed } from "../../db/src/seed-data";
import { secret } from "../../config/src/index";
import type { ReportInput, State, Actor } from "../../domain/src/index";
export class MemoryRepository implements Repository {
  state: State = demoSeed(secret("AUDIT_HASH_SECRET"));
  async health() {
    return true;
  }
  async transaction<T>(fn: (tx: Transaction) => Promise<T>) {
    const state = structuredClone(this.state);
    const result = await fn({
      state,
      jurisdiction: async (p) =>
        state.jurisdictions.find(
          (j) =>
            p.lat >= j.minLat &&
            p.lat <= j.maxLat &&
            p.lng >= j.minLng &&
            p.lng <= j.maxLng,
        )?.id || null,
      duplicates: async () => null,
    });
    this.state = state;
    return result;
  }
}
export const officer: Actor = {
  id: "demo-officer-a",
  role: "authority_officer",
  jurisdictions: ["demo-ward-a"],
};
export const guest: Actor = { id: "guest", role: "guest", jurisdictions: [] };
export function inputFixture(repo: MemoryRepository): ReportInput {
  const clientReportId = randomUUID();
  const mediaId = randomUUID();
  repo.state.media.push({
    id: mediaId,
    ownerKey: clientReportId,
    reportId: null,
    kind: "before",
    originalKey: null,
    derivativeKey: null,
    sha256: "fixture",
    bytes: 100,
    width: 10,
    height: 10,
    mime: "image/jpeg",
    createdAt: new Date().toISOString(),
    safeForPublic: false,
  });
  return {
    clientReportId,
    mediaId,
    locale: "bn-BD",
    category: "standing_water",
    description: "বৃষ্টির পানি জমে আছে।",
    locationNote: "নিরাপদ দূরত্ব থেকে দেখা",
    location: {
      lat: 23.742,
      lng: 90.377,
      accuracyMeters: 18,
      source: "manual",
    },
    capturedAt: new Date().toISOString(),
    consentVersion: "2026-10-v1",
    consent: true,
  };
}
