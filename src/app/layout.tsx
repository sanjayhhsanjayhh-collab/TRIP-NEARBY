import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer, Header } from "@/components/chrome";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TripNearby — Every Journey Has More to Discover", template: "%s | TripNearby" },
  description: "Explore source-backed places across Karnataka. Discover nearby detours, plan routes, and connect with local travel services.",
  applicationName: "TripNearby", openGraph: { title: "TripNearby", description: "Discover more. Travel nearby.", type: "website" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#194a3b" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return <html lang="en"><body><Header user={user ? { name: user.name, role: user.role } : null} />{children}<Footer /></body></html>;
}
