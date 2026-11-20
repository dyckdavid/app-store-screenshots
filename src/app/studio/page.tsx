import type { Metadata } from "next";
import StudioLoader from "@/components/studio/StudioLoader";

export const metadata: Metadata = {
  title: "Studio",
  description:
    "Upload screenshots, write a headline for each, pick a look, and export every App Store Connect size at once.",
  alternates: { canonical: "/studio" },
};

export default function StudioPage() {
  return (
    <main className="flex-1">
      <StudioLoader />
    </main>
  );
}
