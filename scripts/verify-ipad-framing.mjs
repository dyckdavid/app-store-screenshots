/**
 * Headless check: portrait source cover-fills iPad landscape/portrait screens
 * (no letterbox voids), and iPhone/Mac still produce opaque framed exports.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const publicDir = join(root, "public");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
};

async function startStatic() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      let path = decodeURIComponent(url.pathname);
      if (path === "/") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("<!doctype html><title>verify</title>");
        return;
      }
      const abs = join(publicDir, path);
      if (!abs.startsWith(publicDir)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      const data = await readFile(abs);
      res.writeHead(200, {
        "content-type": MIME[extname(abs)] || "application/octet-stream",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  return { server, port: addr.port };
}

async function main() {
  const { server, port } = await startStatic();
  const browser = await chromium.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/`);

  const result = await page.evaluate(async () => {
    async function loadBitmap(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
      return createImageBitmap(await res.blob());
    }

    function drawImageInRect(ctx, image, rect, mode) {
      const iw = image.width;
      const ih = image.height;
      const scale =
        mode === "contain"
          ? Math.min(rect.width / iw, rect.height / ih)
          : Math.max(rect.width / iw, rect.height / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = rect.x + (rect.width - dw) / 2;
      const dy = rect.y + (rect.height - dh) / 2;
      ctx.drawImage(image, dx, dy, dw, dh);
    }

    async function composeDevice(source, frameUrl, maskUrl, screen, mode) {
      const frame = await loadBitmap(frameUrl);
      const mask = await loadBitmap(maskUrl);
      const fw = frame.width;
      const fh = frame.height;
      const off = document.createElement("canvas");
      off.width = fw;
      off.height = fh;
      const ctx = off.getContext("2d");
      drawImageInRect(ctx, source, screen, mode);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(mask, 0, 0, fw, fh);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(frame, 0, 0, fw, fh);
      return { canvas: off, screen };
    }

    function screenFillRatio(canvas, screen) {
      const ctx = canvas.getContext("2d");
      const { data } = ctx.getImageData(
        screen.x,
        screen.y,
        screen.width,
        screen.height,
      );
      let filled = 0;
      let total = 0;
      const step = 32;
      for (let y = 0; y < screen.height; y += step) {
        for (let x = 0; x < screen.width; x += step) {
          const i = (y * screen.width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          total += 1;
          if (a > 200) {
            const isEmptyDark = r < 8 && g < 8 && b < 8;
            if (!isEmptyDark) filled += 1;
          }
        }
      }
      return filled / total;
    }

    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = 1032;
    srcCanvas.height = 1376;
    const sctx = srcCanvas.getContext("2d");
    sctx.fillStyle = "#e11d48";
    sctx.fillRect(0, 0, 1032, 688);
    sctx.fillStyle = "#16a34a";
    sctx.fillRect(0, 688, 1032, 688);
    sctx.fillStyle = "#2563eb";
    sctx.fillRect(200, 300, 632, 776);
    const source = await createImageBitmap(srcCanvas);

    const cases = [
      {
        id: "ipad-13-portrait",
        frame: "/frames/ipad-13/portrait/frame.png",
        mask: "/frames/ipad-13/portrait/mask.png",
        screen: { x: 100, y: 100, width: 2064, height: 2752 },
      },
      {
        id: "ipad-13-landscape",
        frame: "/frames/ipad-13/landscape/frame.png",
        mask: "/frames/ipad-13/landscape/mask.png",
        screen: { x: 100, y: 100, width: 2752, height: 2064 },
      },
      {
        id: "ipad-11-portrait",
        frame: "/frames/ipad-11/portrait/frame.png",
        mask: "/frames/ipad-11/portrait/mask.png",
        screen: { x: 99, y: 100, width: 1668, height: 2420 },
      },
      {
        id: "ipad-11-landscape",
        frame: "/frames/ipad-11/landscape/frame.png",
        mask: "/frames/ipad-11/landscape/mask.png",
        screen: { x: 100, y: 100, width: 2420, height: 1668 },
      },
      {
        id: "iphone-portrait",
        frame: "/frames/iphone/frame.png",
        mask: "/frames/iphone/mask.png",
        screen: { x: 100, y: 100, width: 1320, height: 2868 },
      },
    ];

    const out = [];
    for (const c of cases) {
      const contain = await composeDevice(
        source,
        c.frame,
        c.mask,
        c.screen,
        "contain",
      );
      const cover = await composeDevice(
        source,
        c.frame,
        c.mask,
        c.screen,
        "cover",
      );
      const containRatio = screenFillRatio(contain.canvas, c.screen);
      const coverRatio = screenFillRatio(cover.canvas, c.screen);
      out.push({ id: c.id, containRatio, coverRatio });
    }

    const macFrame = await loadBitmap("/frames/mac/macbook.png");
    const macScreen = { x: 373, y: 123, width: 2560, height: 1600 };
    const mac = document.createElement("canvas");
    mac.width = macFrame.width;
    mac.height = macFrame.height;
    const mctx = mac.getContext("2d");
    mctx.save();
    mctx.beginPath();
    mctx.rect(macScreen.x, macScreen.y, macScreen.width, macScreen.height);
    mctx.clip();
    drawImageInRect(mctx, source, macScreen, "cover");
    mctx.restore();
    mctx.drawImage(macFrame, 0, 0);
    const mid = mctx.getImageData(
      macScreen.x + macScreen.width / 2,
      macScreen.y + macScreen.height / 2,
      1,
      1,
    ).data;
    out.push({
      id: "mac",
      coverRatio: mid[3] > 200 ? 1 : 0,
      macCenter: { r: mid[0], g: mid[1], b: mid[2], a: mid[3] },
    });

    return out;
  });

  await browser.close();
  server.close();

  if (errors.length) {
    console.error("page errors", errors);
    process.exit(1);
  }

  let failed = false;
  for (const row of result) {
    console.log(JSON.stringify(row));
    if (row.id.startsWith("ipad") && row.coverRatio < 0.98) {
      console.error(`FAIL ${row.id}: cover fill ratio ${row.coverRatio}`);
      failed = true;
    }
    if (row.id.includes("landscape") && row.coverRatio <= row.containRatio) {
      console.error(
        `FAIL ${row.id}: cover (${row.coverRatio}) should beat contain (${row.containRatio})`,
      );
      failed = true;
    }
    if (row.id === "mac" && row.coverRatio < 1) {
      console.error("FAIL mac center not filled");
      failed = true;
    }
    if (row.id === "iphone-portrait" && row.coverRatio < 0.98) {
      console.error(`FAIL iphone cover ${row.coverRatio}`);
      failed = true;
    }
  }

  if (failed) process.exit(1);
  console.log("OK: iPad cover-fills screen; iPhone/Mac framing intact");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
