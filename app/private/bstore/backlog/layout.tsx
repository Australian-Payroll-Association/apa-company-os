import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bstore - AI Program",
  robots: { index: false, follow: false },
};

export default function BstoreBacklogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
