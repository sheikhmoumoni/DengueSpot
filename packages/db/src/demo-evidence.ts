import sharp from "sharp";
import { randomUUID, createHash } from "node:crypto";
import type { State } from "../../domain/src/index";
import { storage } from "../../providers/src/storage/index";
export async function addDemoEvidence(state: State) {
  const bucket = storage();
  for (const report of state.reports.filter((r) => r.status === "resolved")) {
    for (const kind of ["before", "after"] as const) {
      const clean = kind === "after";
      const id = randomUUID();
      const svg = `<svg width="640" height="420" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="420" fill="#e8eee5"/><path d="M0 260 640 230V420H0Z" fill="#c6cdbb"/><path d="M0 290 640 260" stroke="#f7f9f0" stroke-width="24"/><rect x="80" y="75" width="170" height="160" rx="6" fill="#a9bda5"/><rect x="95" y="90" width="140" height="35" fill="#d7e4ce"/><path d="M390 240V85M390 150l-40-25M390 170l45-40" stroke="#749575" stroke-width="9"/><circle cx="390" cy="75" r="45" fill="#91b382"/><circle cx="350" cy="107" r="33" fill="#a3bf8d"/><circle cx="426" cy="105" r="32" fill="#a3bf8d"/>${clean ? '<path d="m288 198 24 24 48-58" fill="none" stroke="#21856b" stroke-width="12" stroke-linecap="round"/>' : '<ellipse cx="320" cy="325" rx="135" ry="30" fill="#93bcb8"/><ellipse cx="320" cy="325" rx="95" ry="15" fill="#b5d3cb"/><rect x="450" y="265" width="52" height="48" rx="6" fill="#8da6a0"/>'}<rect x="20" y="20" width="245" height="31" rx="5" fill="#fff"/><text x="34" y="41" font-family="Arial" font-size="16" fill="#47644f">SYNTHETIC DEMO · ${clean ? "AFTER" : "BEFORE"}</text><text x="26" y="393" font-family="Arial" font-size="13" fill="#425947">Illustration only · Not a real site or cleanup</text></svg>`;
      const bytes = await sharp(Buffer.from(svg))
        .jpeg({ quality: 85 })
        .toBuffer();
      const originalKey = `originals/${id}.jpg`;
      const derivativeKey = `derivatives/${id}.jpg`;
      await bucket.put(originalKey, bytes, "image/jpeg");
      await bucket.put(derivativeKey, bytes, "image/jpeg");
      state.media.push({
        id,
        reportId: report.id,
        ownerKey: "synthetic-demo",
        kind,
        originalKey,
        derivativeKey,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.length,
        width: 640,
        height: 420,
        mime: "image/jpeg",
        createdAt: report.createdAt,
        safeForPublic: true,
      });
    }
  }
}
