import { AuthExperience } from "@/components/auth-experience";
import { PageIntro } from "@/components/ui";
import { getCurrentUser, responseUser } from "@/lib/auth";
import { safeNext } from "@/lib/next";

export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const value = (name: string) => typeof query[name] === "string" ? query[name] as string : "";
  const mode = value("mode") === "register" ? "register" : "login";
  const nextPath = safeNext(value("next"));
  const user = await getCurrentUser();
  return <main>
    <PageIntro eyebrow="One account, every journey" title={mode === "register" ? "Join TripNearby." : "Welcome back."} description="Choose Log in or Register below. The screen changes only when you select it, and your session stays active when you refresh." />
    <div className="container-wide page-content" style={{ paddingTop: 30 }}><AuthExperience initialMode={mode} nextPath={nextPath} initialUser={user ? responseUser(user) : null} /></div>
  </main>;
}
