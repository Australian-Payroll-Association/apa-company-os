import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bstore - Project Scope Summary",
  robots: { index: false, follow: false },
};

export default function BstorePrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
