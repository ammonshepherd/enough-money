// Turns the landing page's raw screenshots (landing-screenshots/out/*.png,
// taken by `npm run landing:screenshots`) into small WebP files in
// landing/images/, 600px wide. Needs `cwebp` (brew install webp).
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const SOURCE = "landing-screenshots/out";
const TARGET = "landing/images";
const WIDTH = 600;

mkdirSync(TARGET, { recursive: true });
const pictures = readdirSync(SOURCE).filter((name) => name.endsWith(".png"));
for (const name of pictures) {
  const out = path.join(TARGET, name.replace(/\.png$/, ".webp"));
  execFileSync("cwebp", [
    "-quiet",
    "-q",
    "82",
    "-resize",
    String(WIDTH),
    "0",
    path.join(SOURCE, name),
    "-o",
    out,
  ]);
}
console.log(`Wrote ${pictures.length} pictures to ${TARGET}/.`);
