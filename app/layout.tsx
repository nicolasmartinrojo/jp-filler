import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JP Filler",
  description: "Auto-fill job application forms",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
