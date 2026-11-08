import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paradox Numbers",
  description: "Connecting Possibilities. Beyond Boundaries.",
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