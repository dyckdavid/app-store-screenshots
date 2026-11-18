import type { Metadata } from "next";
import EditorApp from "@/components/EditorApp";

export const metadata: Metadata = {
  title: "Editor",
  description:
    "Upload screenshots, pick devices and layouts, style captions, and export exact App Store Connect sizes.",
  alternates: { canonical: "/studio" },
};

export default function StudioPage() {
  return (
    <main className="flex-1">
      <EditorApp />
    </main>
  );
}
