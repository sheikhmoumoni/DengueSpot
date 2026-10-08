import { createClient } from "@supabase/supabase-js";
import { type Actor, AppError } from "../../../packages/domain/src/index";
import { repository, PostgresRepository } from "../../../packages/db/src/index";
import { demoEnabled, secret } from "../../../packages/config/src/index";
import {
  keyedHash,
  safeEqual,
  randomToken,
} from "../../../packages/security/src/index";
export const guest: Actor = { id: "guest", role: "guest", jurisdictions: [] };
export async function actorFor(request: Request): Promise<Actor> {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("dsp_access="))
    ?.slice(11);
  const bearer =
    request.headers.get("authorization")?.replace(/^Bearer /, "") || cookie;
  if (bearer && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase.auth.getUser(bearer);
    if (error || !data.user)
      throw new AppError(401, "AUTH_INVALID", "Invalid session.");
    const actor = await repository().transaction<Actor>(
      async (tx) =>
        tx.state.profiles.find((p) => p.id === data.user.id) || {
          id: data.user.id,
          role: "citizen",
          jurisdictions: [],
        },
    );
    const repo = repository();
    if (repo instanceof PostgresRepository) {
      const memberships = await repo.pool.query<{ jurisdiction_id: string }>(
        "SELECT jurisdiction_id FROM organization_memberships WHERE profile_id=$1",
        [actor.id],
      );
      actor.jurisdictions = memberships.rows.map((r) => r.jurisdiction_id);
    }
    if (
      !demoEnabled() &&
      [
        "authority_officer",
        "authority_supervisor",
        "moderator",
        "privacy_security_officer",
        "system_admin",
      ].includes(actor.role)
    ) {
      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel(bearer);
      if (assuranceError || assurance?.currentLevel !== "aal2")
        throw new AppError(
          403,
          "MFA_REQUIRED",
          "Authority accounts require MFA. Complete MFA through your configured Supabase identity flow.",
        );
    }
    return actor;
  }
  const raw = request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("dsp_session="))
    ?.slice(12);
  if (raw && demoEnabled())
    return repository().transaction(async (tx) => {
      const session = tx.state.sessions.find(
        (s) =>
          safeEqual(s.hash, keyedHash(raw, secret("SESSION_SECRET"))) &&
          Date.parse(s.expiresAt) > Date.now(),
      );
      return tx.state.profiles.find((p) => p.id === session?.actorId) || guest;
    });
  return guest;
}
export async function passwordLogin(email: string, password: string) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY)
    throw new AppError(
      503,
      "AUTH_UNCONFIGURED",
      "Authentication provider is not configured.",
    );
  const client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session)
    throw new AppError(401, "AUTH_INVALID", "Invalid sign-in credentials.");
  return {
    accessToken: data.session.access_token,
    expiresIn: data.session.expires_in,
  };
}
export async function demoLogin(profileId: string, password: string) {
  if (!demoEnabled()) throw new AppError(404, "NOT_FOUND", "Not available.");
  if (
    !process.env.DEMO_LOGIN_PASSWORD ||
    !safeEqual(password, process.env.DEMO_LOGIN_PASSWORD)
  )
    throw new AppError(401, "AUTH_INVALID", "Invalid demo password.");
  const token = randomToken();
  const profile = await repository().transaction(async (tx) => {
    const p = tx.state.profiles.find((p) => p.id === profileId);
    if (!p) throw new AppError(401, "AUTH_INVALID", "Invalid demo identity.");
    tx.state.sessions = tx.state.sessions.filter(
      (s) => Date.parse(s.expiresAt) > Date.now(),
    );
    tx.state.sessions.push({
      hash: keyedHash(token, secret("SESSION_SECRET")),
      actorId: p.id,
      expiresAt: new Date(Date.now() + 8 * 3600000).toISOString(),
    });
    return p;
  });
  return { token, profile };
}
