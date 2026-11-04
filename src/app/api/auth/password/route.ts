import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { getCurrentUser, responseUser, setSession } from "@/lib/auth";
import { guardMutation, parseJson } from "@/lib/security";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const hashCode = (code: string) => createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
const createCode = () => `TN-${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;

const resetSchema = z.object({ action: z.literal("reset"), email: z.email().transform((v) => v.trim().toLowerCase()),
  code: z.string().trim().min(12).max(30), newPassword: z.string().min(8).max(72) });
const changeSchema = z.object({ action: z.literal("change"), currentPassword: z.string().min(8).max(72), newPassword: z.string().min(8).max(72) });
const createSchema = z.object({ action: z.literal("create-code") });

export async function POST(request: Request) {
  const blocked = guardMutation(request, "auth-password", 12);
  if (blocked) return blocked;
  const data = await parseJson(request);
  const action = data && typeof data === "object" && "action" in data ? (data as { action: unknown }).action : null;
  try {
    if (action === "reset") {
      const parsed = resetSchema.safeParse(data);
      if (!parsed.success) return json({ error: "Enter your email, recovery code and a new password of at least 8 characters." }, 400);
      const { email, code, newPassword } = parsed.data;
      const [account] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (!account) return json({ error: "This recovery code is invalid or has expired." }, 401);
      const result = await db.transaction(async (tx) => {
        const claimed = await tx.update(passwordResets).set({ usedAt: new Date() })
          .where(and(eq(passwordResets.userId, account.id), eq(passwordResets.codeHash, hashCode(code)),
            isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
          .returning({ id: passwordResets.id });
        if (!claimed.length) return null;
        const [updated] = await tx.update(users).set({ passwordHash: await hash(newPassword, 12),
          sessionVersion: sql`${users.sessionVersion} + 1`, passwordChangedAt: new Date() })
          .where(eq(users.id, account.id)).returning({ id: users.id, sessionVersion: users.sessionVersion });
        return updated;
      });
      if (!result) return json({ error: "This recovery code is invalid, already used, or has expired." }, 401);
      return json({ ok: true, message: "Password updated. Please log in with your new password." });
    }
    const user = await getCurrentUser();
    if (!user) return json({ error: "Please log in to manage your password." }, 401);
    if (action === "create-code") {
      if (!createSchema.safeParse(data).success) return json({ error: "Invalid request." }, 400);
      const code = createCode();
      await db.insert(passwordResets).values({ userId: user.id, codeHash: hashCode(code), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) });
      return json({ ok: true, recoveryCode: code, message: "New recovery code created. Save it now; it is shown only once." }, 201);
    }
    if (action === "change") {
      const parsed = changeSchema.safeParse(data);
      if (!parsed.success) return json({ error: "Both passwords must be at least 8 characters." }, 400);
      const [account] = await db.select({ passwordHash: users.passwordHash, sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, user.id));
      if (!account || !(await compare(parsed.data.currentPassword, account.passwordHash))) return json({ error: "Current password is incorrect." }, 401);
      const [updated] = await db.update(users).set({ passwordHash: await hash(parsed.data.newPassword, 12),
        sessionVersion: sql`${users.sessionVersion} + 1`, passwordChangedAt: new Date() })
        .where(eq(users.id, user.id)).returning({ sessionVersion: users.sessionVersion });
      await setSession(user.id, updated.sessionVersion);
      return json({ ok: true, user: responseUser({ ...user, sessionVersion: updated.sessionVersion }), message: "Password changed. Your current session remains active." });
    }
    return json({ error: "Unknown password action." }, 400);
  } catch (error) {
    console.error("Password action failed", error);
    return json({ error: "Password service is temporarily unavailable. Please try again." }, 503);
  }
}
