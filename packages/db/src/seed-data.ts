import { randomUUID } from "node:crypto";
import {
  coarsenLocation,
  emptyState,
  type State,
  type Status,
  categories,
} from "../../domain/src/index";
import { auditHash } from "../../security/src/index";
export function demoSeed(auditSecret: string): State {
  const state = emptyState();
  state.jurisdictions = [
    {
      id: "demo-ward-a",
      name: "Demo Ward A · Dhanmondi",
      minLat: 23.725,
      maxLat: 23.76,
      minLng: 90.36,
      maxLng: 90.39,
      organizationId: "demo-city",
    },
    {
      id: "demo-ward-b",
      name: "Demo Ward B · Kalabagan",
      minLat: 23.725,
      maxLat: 23.76,
      minLng: 90.39,
      maxLng: 90.42,
      organizationId: "demo-city",
    },
  ];
  state.profiles = [
    {
      id: "demo-officer-a",
      role: "authority_officer",
      jurisdictions: ["demo-ward-a"],
      name: "Demo officer · Ward A",
    },
    {
      id: "demo-officer-b",
      role: "authority_officer",
      jurisdictions: ["demo-ward-b"],
      name: "Demo officer · Ward B",
    },
    {
      id: "demo-supervisor",
      role: "authority_supervisor",
      jurisdictions: ["demo-ward-a", "demo-ward-b"],
      name: "Demo supervisor",
    },
    {
      id: "demo-moderator",
      role: "moderator",
      jurisdictions: [],
      name: "Demo moderator",
    },
    {
      id: "demo-citizen",
      role: "citizen",
      jurisdictions: [],
      name: "Demo citizen",
    },
    {
      id: "demo-admin",
      role: "system_admin",
      jurisdictions: [],
      name: "Demo infrastructure admin",
    },
  ];
  const states: Status[] = [
    "submitted",
    "under_review",
    "verified",
    "assigned",
    "in_progress",
    "resolved",
    "resolved",
  ];
  const notes = [
    "Water collected beside a footpath after rainfall.",
    "Open water container near a shared courtyard.",
    "Water accumulation at a demo construction site.",
    "Blocked roadside drain needs inspection.",
    "Discarded containers holding rainwater.",
    "Water collected near a rooftop outlet.",
    "A low-lying public path has standing water.",
    "Please inspect this suspected breeding condition.",
  ];
  for (let i = 0; i < 21; i++) {
    const id = randomUUID();
    const status = states[i % states.length];
    const createdAt = new Date(
      Date.now() - (i * 4 + 2) * 3600000,
    ).toISOString();
    const location = {
      lat: 23.735 + (i % 7) * 0.0027,
      lng: 90.368 + (i % 5) * 0.009,
    };
    const jurisdictionId = location.lng < 90.39 ? "demo-ward-a" : "demo-ward-b";
    state.reports.push({
      id,
      publicId: "DSP-DEMO" + String(i + 1).padStart(2, "0"),
      clientReportId: randomUUID(),
      ownerId: null,
      trackingHash: "not-a-live-credential",
      category: categories[i % 8],
      description: notes[i % 8],
      locationNote: "Synthetic demonstration location",
      locale: "en-BD",
      publicLocation: coarsenLocation(location),
      jurisdictionId,
      area: state.jurisdictions.find((j) => j.id === jurisdictionId)!.name,
      status,
      createdAt,
      updatedAt: createdAt,
      capturedAt: createdAt,
      closedAt:
        status === "resolved"
          ? new Date(Date.now() - i * 3600000).toISOString()
          : null,
      hidden: false,
      privacyReviewed: true,
      assignee: ["assigned", "in_progress", "resolved"].includes(status)
        ? "Demo cleanup team"
        : null,
      resolutionNote:
        status === "resolved"
          ? "Demo cleanup completed; water-holding material removed."
          : null,
      duplicateOf: null,
      consentVersion: "2026-10-v1",
      legalHold: false,
      requestHash: "seed",
    });
    state.locations.push({
      ...location,
      reportId: id,
      accuracyMeters: 18,
      source: "manual",
    });
    state.events.push({
      id: randomUUID(),
      reportId: id,
      type: "submitted",
      from: null,
      to: "submitted",
      actorId: "synthetic-demo",
      note: "Synthetic demonstration report",
      createdAt,
    });
    if (status !== "submitted")
      state.events.push({
        id: randomUUID(),
        reportId: id,
        type: "seeded_status",
        from: "submitted",
        to: status,
        actorId: "synthetic-demo",
        note: "Synthetic workflow history",
        createdAt,
      });
  }
  const entry = {
    id: randomUUID(),
    actorId: "system",
    action: "demo.seed",
    recordId: "demo-city",
    createdAt: new Date().toISOString(),
  };
  state.audits.push({
    ...entry,
    previousHash: "",
    hash: auditHash(entry, "", auditSecret),
  });
  return state;
}
