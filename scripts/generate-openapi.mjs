import { writeFile } from "node:fs/promises";
const ref = (name) => ({ $ref: "#/components/schemas/" + name });
const text = { type: "string" };
const object = (properties, required = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
const categories = [
  "standing_water",
  "water_container",
  "construction",
  "drain",
  "tire_or_waste",
  "rooftop",
  "public_space",
  "other",
];
const statuses = [
  "draft",
  "submitted",
  "under_review",
  "verified",
  "assigned",
  "in_progress",
  "resolved",
  "rejected",
  "duplicate",
  "withdrawn",
  "archived",
];
const uuid = { type: "string", format: "uuid" };
const date = { type: "string", format: "date-time" };
const schemas = {
  Location: object({
    lat: { type: "number", minimum: 20, maximum: 27 },
    lng: { type: "number", minimum: 88, maximum: 93 },
    accuracyMeters: { type: "number", minimum: 0, maximum: 10000 },
    source: { enum: ["gps", "manual"] },
  }),
  ReportInput: object(
    {
      clientReportId: uuid,
      locale: { enum: ["bn-BD", "en-BD"] },
      category: { enum: categories },
      description: { type: "string", maxLength: 1000 },
      locationNote: { type: "string", maxLength: 160 },
      location: ref("Location"),
      mediaId: uuid,
      capturedAt: date,
      consentVersion: { const: "2026-10-v1" },
      consent: { const: true },
      website: { type: "string", maxLength: 0 },
    },
    [
      "clientReportId",
      "locale",
      "category",
      "description",
      "locationNote",
      "location",
      "mediaId",
      "capturedAt",
      "consentVersion",
      "consent",
    ],
  ),
  PublicReport: object({
    publicId: text,
    category: { enum: categories },
    description: text,
    publicLocation: object({
      lat: { type: "number" },
      lng: { type: "number" },
    }),
    area: text,
    status: { enum: statuses },
    createdAt: date,
    updatedAt: date,
    privacyReviewed: { type: "boolean" },
    resolutionNote: { type: ["string", "null"] },
  }),
  Error: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: text,
          message: text,
          fieldErrors: { type: "object" },
        },
      },
      requestId: { type: "string", format: "uuid" },
    },
    required: ["error", "requestId"],
  },
  Action: object(
    {
      status: { enum: statuses },
      note: { type: "string", maxLength: 1000 },
      assignee: { type: "string", maxLength: 120 },
      mediaId: uuid,
    },
    [],
  ),
  RightsInput: object({ publicId: { type: "string", maxLength: 100 } }),
  Receipt: object({
    id: uuid,
    type: { enum: ["access", "delete", "withdraw"] },
    status: { const: "completed" },
    createdAt: date,
  }),
  Moderation: object(
    {
      action: { enum: ["hide", "release", "reject", "duplicate"] },
      reason: { type: "string", minLength: 1, maxLength: 500 },
      target: { type: "string", maxLength: 100 },
    },
    ["action", "reason"],
  ),
};
const paths = {};
function add(
  path,
  method,
  summary,
  access = "Public",
  requestSchema,
  responseSchema,
) {
  const parameters = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: text,
  }));
  const operation = {
    summary,
    description:
      access +
      ". See API.md for semantics, role restrictions and implementation boundaries.",
    operationId: method + path.replace(/\W/g, "_"),
    parameters,
    responses: {
      200: {
        description: "Success; response shape varies by operation",
        ...(responseSchema
          ? { content: { "application/json": { schema: responseSchema } } }
          : {}),
      },
      default: {
        description: "Validated error response",
        content: { "application/json": { schema: ref("Error") } },
      },
    },
  };
  if (
    access !== "Public" &&
    !access.startsWith("Demo") &&
    !access.startsWith("Consent")
  ) {
    operation.security = [{ session: [] }, { bearer: [] }];
    if (/owner/i.test(access)) operation.security.push({ tracking: [] });
    if (/reviewed public/.test(access)) operation.security.push({});
  }
  if (requestSchema)
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: requestSchema } },
    };
  if (method === "post" && path === "/reports") {
    operation.parameters.push({
      name: "Idempotency-Key",
      in: "header",
      required: true,
      schema: uuid,
    });
    operation.responses["201"] = {
      description: "Created; returns report and private trackingToken",
    };
  }
  (paths[path] ||= {})[method] = operation;
}
for (const path of [
  "/health",
  "/ready",
  "/config",
  "/auth/session",
  "/reports",
  "/analytics/public",
])
  add(path, "get", "Read " + path);
add(
  "/auth/demo",
  "post",
  "Synthetic demo login",
  "Demo mode",
  object({ profileId: text, password: text }),
);
add(
  "/auth/login",
  "post",
  "Configured identity login",
  "Public",
  object({
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 8, maxLength: 200 },
  }),
);
add("/auth/logout", "post", "Clear sign-in session");
add(
  "/media/uploads",
  "post",
  "Upload consented evidence",
  "Consent; after-photo requires scoped officer",
);
paths["/media/uploads"].post.requestBody = {
  required: true,
  content: {
    "multipart/form-data": {
      schema: object(
        {
          photo: { type: "string", format: "binary" },
          clientReportId: uuid,
          kind: { enum: ["before", "after"] },
          consent: { const: "true" },
          reportId: text,
        },
        ["photo", "clientReportId", "consent"],
      ),
    },
  },
};
paths["/media/uploads"].post.responses["201"] = {
  description: "Uploaded; mediaId and privacyReviewRequired",
};
add(
  "/media/{mediaId}",
  "get",
  "Authorized or reviewed derivative",
  "Owner/scoped officer/moderator or reviewed public evidence",
);
paths["/media/{mediaId}"].get.parameters.push({
  name: "original",
  in: "query",
  schema: { type: "boolean" },
  description:
    "Only owner or scoped officer/supervisor can request original-quality sanitized evidence",
});
add(
  "/reports",
  "post",
  "Create report with stable idempotency key",
  "Public",
  ref("ReportInput"),
);
add(
  "/reports/duplicates",
  "post",
  "Recent nearby public suggestions",
  "Public",
  object({
    lat: { type: "number", minimum: 20, maximum: 27 },
    lng: { type: "number", minimum: 88, maximum: 93 },
  }),
);
add("/reports/{id}", "get", "Read public report");
for (const action of ["private", "events"])
  add(
    "/reports/{id}/" + action,
    "get",
    "Read " + action,
    "Scoped officer; events also allow owner",
  );
add("/my-reports", "get", "Signed-in reporter records", "Authenticated owner");
for (const action of ["status", "verify", "assign", "resolve"])
  add(
    "/reports/{id}/" + action,
    "post",
    "Human " + action,
    "Matching-jurisdiction authority",
    ref("Action"),
  );
paths["/reports/{id}/status"].patch = { ...paths["/reports/{id}/status"].post };
paths["/reports/{id}/status"].patch.operationId = "patch_report_status";
add(
  "/reports/{id}/evidence",
  "post",
  "Confirm uploaded after-photo",
  "Matching-jurisdiction authority",
  object({ mediaId: uuid }),
);
add(
  "/reports/{id}/flags",
  "post",
  "Flag for moderation",
  "Public",
  object({
    reason: {
      enum: [
        "spam",
        "duplicate",
        "privacy",
        "harassment",
        "illegal_content",
        "unrelated",
        "unsafe_media",
        "misleading",
        "other",
      ],
    },
  }),
);
add(
  "/reports/{id}/duplicate",
  "post",
  "Link duplicate",
  "Moderator",
  object({
    target: text,
    reason: { type: "string", minLength: 1, maxLength: 500 },
  }),
);
for (const path of [
  "/authority/dashboard",
  "/authority/reports",
  "/analytics/authority",
])
  add(path, "get", "Scoped operations data", "Matching-jurisdiction authority");
add("/authority/export", "get", "Formula-safe coarse CSV", "Scoped supervisor");
add("/moderation", "get", "Private moderation queue", "Moderator");
add(
  "/moderation/{id}",
  "post",
  "Moderate and attest publication",
  "Moderator",
  ref("Moderation"),
);
add(
  "/qr/resolve",
  "post",
  "Verify signed expiring site identity",
  "Public",
  object({ token: { type: "string", maxLength: 2000 } }),
);
for (const action of ["access", "delete", "withdraw"])
  add(
    "/data-rights/" + action,
    "post",
    "Owner " + action,
    "Owner session or tracking credential",
    ref("RightsInput"),
  );
add(
  "/data-rights/requests/{receiptId}",
  "get",
  "Private rights receipt status",
  "Owner session or tracking credential",
  undefined,
  object({ request: ref("Receipt") }),
);
add(
  "/webhooks/sms/{provider}",
  "post",
  "Disabled contract-specific webhook boundary",
  "Configured signed provider",
);
const spec = {
  openapi: "3.1.0",
  info: {
    title: "DengueSpot scaffold API",
    version: "0.1.0",
    description:
      "API.md and server Zod schemas are authoritative for action-specific preconditions. This contract inventories implemented routes; optional transport and direct-storage flows are not claimed.",
  },
  servers: [{ url: "/api/v1" }],
  paths,
  components: {
    schemas,
    securitySchemes: {
      session: {
        type: "apiKey",
        in: "cookie",
        name: "dsp_access",
        description:
          "Real verified Auth session; explicit demo uses dsp_session instead",
      },
      bearer: { type: "http", scheme: "bearer" },
      tracking: {
        type: "apiKey",
        in: "header",
        name: "x-tracking-token",
        description:
          "Only owner routes accept this; it never grants an authority/moderator role",
      },
    },
  },
};
await writeFile("docs/openapi.json", JSON.stringify(spec, null, 2) + "\n");
console.info("Generated docs/openapi.json");
