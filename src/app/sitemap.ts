import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const pages: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["", 1, "weekly"],
    ["/studio", 0.9, "weekly"],
    ["/pricing", 0.8, "monthly"],
    ["/support", 0.4, "yearly"],
    ["/terms", 0.2, "yearly"],
    ["/privacy", 0.2, "yearly"],
    ["/refund", 0.2, "yearly"],
  ];
  return pages.map(([path, priority, changeFrequency]) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
