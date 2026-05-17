import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseOps AI Incident Command Center",
  description:
    "A PubNub-powered real-time AI incident command center proof of concept.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
