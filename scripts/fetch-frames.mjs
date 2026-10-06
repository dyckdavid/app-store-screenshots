#!/usr/bin/env node
/**
 * Ensure real device-bezel PNGs (+ masks) exist under public/frames before
 * `next build`. Upstream SHAs/sizes match the vendored assets; used when
 * large binaries were not uploaded to the deploy file store.
 */
import { createWriteStream } from "node:fs";
import { mkdir, access, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DFM =
  "https://raw.githubusercontent.com/jonnyjackson26/device-frames-media/main/device-frames-output";
const BLH =
  "https://raw.githubusercontent.com/bunlongheng/frames/main/public/assets/frames";

const FRAMES = [
  {
    path: "public/frames/iphone/frame.png",
    url: `${DFM}/Apple%20iPhone/16%20Pro%20Max/Black%20Titanium/frame.png`,
    minBytes: 100000,
  },
  {
    path: "public/frames/iphone/mask.png",
    url: `${DFM}/Apple%20iPhone/16%20Pro%20Max/Black%20Titanium/mask.png`,
    minBytes: 5000,
  },
  {
    path: "public/frames/ipad-13/portrait/frame.png",
    url: `${DFM}/Apple%20iPad/iPad%20Pro%2013%20M4%20%26%20M5/Portrait%20-%20Space%20Black/frame.png`,
    minBytes: 100000,
  },
  {
    path: "public/frames/ipad-13/portrait/mask.png",
    url: `${DFM}/Apple%20iPad/iPad%20Pro%2013%20M4%20%26%20M5/Portrait%20-%20Space%20Black/mask.png`,
    minBytes: 5000,
  },
  {
    path: "public/frames/ipad-13/landscape/frame.png",
    url: `${DFM}/Apple%20iPad/iPad%20Pro%2013%20M4%20%26%20M5/Landscape%20-%20Space%20Black/frame.png`,
    minBytes: 100000,
  },
  {
    path: "public/frames/ipad-13/landscape/mask.png",
    url: `${DFM}/Apple%20iPad/iPad%20Pro%2013%20M4%20%26%20M5/Landscape%20-%20Space%20Black/mask.png`,
    minBytes: 5000,
  },
  {
    path: "public/frames/ipad-11/portrait/frame.png",
    url: `${DFM}/Apple%20iPad/iPad%20Pro%2011%20M4%20%26%20M5/Portrait%20-%20Space%20Black/frame.png`,
    minBytes: 100000,
  },
  {
    path: "public/frames/ipad-11/portrait/mask.png",
    url: `${DFM}/Apple%20iPad/iPad%20Pro%2011%20M4%20%26%20M5/Portrait%20-%20Space%20Black/mask.png`,
    minBytes: 5000,
  },
  {
    path: "public/frames/ipad-11/landscape/frame.png",
    url: `${DFM}/Apple%20iPad/iPad%20Pro%2011%20M4%20%26%20M5/Landscape%20-%20Space%20Black/frame.png`,
    minBytes: 100000,
  },
  {
    path: "public/frames/ipad-11/landscape/mask.png",
    url: `${DFM}/Apple%20iPad/iPad%20Pro%2011%20M4%20%26%20M5/Landscape%20-%20Space%20Black/mask.png`,
    minBytes: 5000,
  },
  {
    path: "public/frames/mac/macbook.png",
    url: `${BLH}/macbook.png`,
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
    throw new Error(`GET ${url} -> ${res.status}`);
  }
  await pipeline(res.body, createWriteStream(abs));
}

for (const frame of FRAMES) {
  const abs = join(root, frame.path);
  if (await existsAndBig(abs, frame.minBytes)) {
    const s = await stat(abs);
    console.log(`ok ${frame.path} (${s.size} bytes)`);
    continue;
  }
  console.log(`fetch ${frame.path}`);
  await download(frame.url, abs);
  const s = await stat(abs);
  if (s.size < frame.minBytes) {
    throw new Error(`${frame.path} too small after fetch: ${s.size}`);
  }
  console.log(`wrote ${frame.path} (${s.size} bytes)`);
}
