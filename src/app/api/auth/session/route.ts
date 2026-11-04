import { getCurrentUser, responseUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  return Response.json({ authenticated: !!user, user: user ? responseUser(user) : null },
    { headers: { "Cache-Control": "no-store, private" } });
}
