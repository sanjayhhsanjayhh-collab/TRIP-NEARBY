import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { clearSession, responseUser, setSession } from "@/lib/auth";
import { guardMutation, parseJson } from "@/lib/security";

const credentials = z.object({ email: z.email().max(255).transform((v) => v.trim().toLowerCase()), password: z.string().min(8).max(72) });
const registration = credentials.extend({ name: z.string().trim().min(2).max(120) });

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");
const recoveryCode = () => `TN-${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;

async function createRecoveryCode(userId: string) {
  const code = recoveryCode();
  await db.insert(passwordResets).values({ userId, codeHash: hashCode(code), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) });
  return code;
}

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!["login", "register", "logout"].includes(action)) return json({ error: "Not found." }, 404);
  const blocked = guardMutation(request, `auth-${action}`, 20);
  if (blocked) return blocked;
  if (action === "logout") {
    await clearSession();
    return json({ ok: true, message: "You have been logged out." });
  }
  const parsed = (action === "register" ? registration : credentials).safeParse(await parseJson(request));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return json({ error: issue?.path[0] === "password" ? "Password must be between 8 and 72 characters." :
      issue?.path[0] === "email" ? "Enter a valid email address." :
      issue?.path[0] === "name" ? "Enter your name (at least 2 characters)." : "Please check the form fields." }, 400);
  }
  try {
    const { email, password } = parsed.data;
    if (action === "register") {
      const name = (parsed.data as z.infer<typeof registration>).name;
      try {
        const [user] = await db.insert(users).values({ name, email, passwordHash: await hash(password, 12), passwordChangedAt: new Date() })
          .returning({ id: users.id, name: users.name, email: users.email, role: users.role, location: users.location, avatarUrl: users.avatarUrl });
        await setSession(user.id, 0);
        const code = await createRecoveryCode(user.id);
        return json({ user, recoveryCode: code, message: "Account created. Save your recovery code; it is shown only once." }, 201);
      } catch (cause) {
        if (cause instanceof Error && /duplicate key|unique constraint/i.test(cause.message)) return json({ error: "An account with this email already exists. Please log in or reset your password." }, 409);
        throw cause;
      }
    }
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) return json({ error: "No account was found for this email. Please register or check the address." }, 401);
    if (!(await compare(password, user.passwordHash))) return json({ error: "Incorrect password. Use password reset if you cannot remember it." }, 401);
    await setSession(user.id, user.sessionVersion);
    return json({ user: responseUser({ ...user, sessionVersion: user.sessionVersion }) });
  } catch (error) {
    console.error("Authentication error", error);
    return json({ error: "We could not reach the account service. Check your connection and try again." }, 503);
  }
}
