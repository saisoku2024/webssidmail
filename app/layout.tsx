import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SAISOKU.ID — Temp Mail",
  description: "Local Next.js design mockup for SSIDMail."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
