import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { GeneratedResult } from "./resize";
import type { PlatformId } from "./sizes";
import { PLATFORMS } from "./sizes";

function platformFolder(platform: PlatformId): string {
  return PLATFORMS.find((p) => p.id === platform)?.label ?? platform;
}

export function downloadBlob(blob: Blob, filename: string) {
  saveAs(blob, filename);
}

export async function downloadZip(results: GeneratedResult[], zipName = "asc-screenshots.zip") {
  const zip = new JSZip();

  for (const result of results) {
    const folder = zip.folder(platformFolder(result.size.platform));
    folder?.file(result.filename, result.blob);
  }

  const content = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  saveAs(content, zipName);
}
