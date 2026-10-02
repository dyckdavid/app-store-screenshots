#!/usr/bin/env node
/**
 * Ensure real iPad bezel PNGs exist under public/frames before next build.
 * Upstream SHAs/sizes match the vendored assets; used when large binaries
 * were not uploaded to the Vercel file store.
 */
import { createWriteStream } from "node:fs";
import { mkdir, access, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DFM =
  "https://raw.githubusercontent.com/jonnyjackson26/device-frames-media/main/device-frames-output";

const FRAMES = [
  {
    path: "public/frames/ipad-13/portrait/frame.png",
    url: `${DFM}/Apple%20iPad/iPad%20Pro%2013%20M4%20%26%20M5/Portrait%20-%20Space%20Black/frame.png`,
    minBytes: 100000,
  },
  {
    path: "public/frames/ipad-11/portrait/frame.png",
    url: `${DFM}/Apple%20iPad/iPad%20Pro%2011%20M4%20%26%20M5/Portrait%20-%20Space%20Black/frame.png`,
    minBytes: 100000,
  },
  {
    path: "public/frames/ipad-11/landscape/frame.png",
    url: `${DFM}/Apple%20iPad/iPad%20Pro%2011%20M4%20%26%20M5/Landscape%20-%20Space%20Black/frame.png`,
    minBytes: 100000,
  },
];

async function existsAndBig(abs, minBytes) {
  try {
    await access(abs);
    const s = await stat(abs);
    return s.size >= minBytes;
  } catch {
    return false;
  }
}

async function download(url, abs) {
  await mkdir(dirname(abs), { recursive: true });
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status}`);
  }
  await pipeline(res.body, createWriteStream(abs));
}

async function main() {
  for (const frame of FRAMES) {
    const abs = join(root, frame.path);
    if (await existsAndBig(abs, frame.minBytes)) {
      console.log(`ok ${frame.path}`);
      continue;
    }
    console.log(`fetch ${frame.path}`);
    await download(frame.url, abs);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
