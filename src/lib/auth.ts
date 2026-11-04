import "server-only";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const COOKIE_NAME = "tripnearby_session";
let warnedAboutFallback = false;

function secret() {
  const configured = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (configured && configured.length >= 32) return new TextEncoder().encode(configured);
  // The preview environment occasionally starts without a generated .env secret.
  // A stable server-only derivation keeps sessions valid across processes without hardcoding a key.
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    if (!warnedAboutFallback) {
      console.warn("SESSION_SECRET is not configured; deriving a stable server-only session key. Set SESSION_SECRET before public deployment.");
      warnedAboutFallback = true;
    }
    return new TextEncoder().encode(createHash("sha256").update("tripnearby-session-v1:").update(databaseUrl).digest("hex"));
  }
  throw new Error("SESSION_SECRET must be configured with at least 32 characters");
}

export type SessionUser = { id: string; name: string; email: string; role: string; location: string | null; avatarUrl: string | null; sessionVersion: number };

function responseUser(user: SessionUser) {
  const { sessionVersion: _version, ...safe } = user;
  return safe;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret(), { issuer: "tripnearby", audience: "tripnearby-web" });
    if (!payload.sub) return null;
    const [user] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role,
      location: users.location, avatarUrl: users.avatarUrl, sessionVersion: users.sessionVersion })
      .from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user) return null;
    if (Number(payload.sv ?? 0) !== user.sessionVersion) return null;
    return user;
  } catch (error) {
    // Invalid/expired tokens are expected; configuration and database failures should be visible.
    if (!(error instanceof Error && /JWT|signature|expired|claim|compact/i.test(error.message))) console.error("Session lookup failed", error);
    return null;
  }
}

export async function setSession(userId: string, sessionVersion = 0) {
  const token = await new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuer("tripnearby")
    .setAudience("tripnearby-web").setIssuedAt().setExpirationTime("14d").sign(secret());
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSession() {
  (await cookies()).set(COOKIE_NAME, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0, expires: new Date(0),
  });
}

export { responseUser };
