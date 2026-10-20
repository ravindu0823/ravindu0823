// Renders the profile's SVG cards in a light and a dark variant.
//
//   node scripts/render.mjs static assets   banner + stack cards (committed to main)
//   node scripts/render.mjs stats  dist     activity + languages cards (built by the workflow)
//
// `stats` reads STATS_TOKEN: a classic PAT of the profile owner with `repo` and `read:user`,
// so private contributions are counted. STATS_EXPECT_PRIVATE=1 makes a token that can no
// longer see private work an error instead of a quietly smaller card. Node built-ins only.
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderBanner } from "./banner.mjs";
import { fetchContributions, summarize, validate } from "./github.mjs";
import { fetchIcons, renderStackCard, STACK } from "./stack.mjs";
import { renderActivityCard, renderLanguagesCard } from "./stats.mjs";
import { THEMES } from "./theme.mjs";

const LOGIN = process.env.PROFILE_LOGIN ?? "ravindu0823";

async function buildStatic() {
  const icons = await fetchIcons();
  const files = {};
  for (const t of Object.values(THEMES)) {
    files[`banner-${t.name}.svg`] = renderBanner(t);
    for (const card of STACK) files[`stack-${card.id}-${t.name}.svg`] = renderStackCard(t, card, icons);
  }
  return files;
}

async function buildStats() {
  const token = process.env.STATS_TOKEN;
  if (!token) throw new Error("STATS_TOKEN is not set");
  const now = new Date();
  const { lastYear, years } = await fetchContributions(token, LOGIN);
  const s = validate(summarize(lastYear, years, now.toISOString().slice(0, 10)), { expectPrivate: process.env.STATS_EXPECT_PRIVATE === "1" });
  // Counts only, never repository names: those are mostly private client work.
  console.log(JSON.stringify({ contributions: s.contributions, allTime: s.allTime, commits: s.commits, pullRequests: s.pullRequests, repositories: s.repositories, privateRepos: s.privateRepos, restricted: s.restricted, streak: s.streak, languages: s.languages.map((l) => `${l.name} ${(l.share * 100).toFixed(1)}%`) }));
  const files = {};
  for (const t of Object.values(THEMES)) {
    files[`stats-activity-${t.name}.svg`] = renderActivityCard(t, s, now);
    files[`stats-languages-${t.name}.svg`] = renderLanguagesCard(t, s, now);
  }
  return files;
}

const [mode, outDir] = process.argv.slice(2);
const builders = { static: buildStatic, stats: buildStats };
if (!builders[mode] || !outDir) {
  console.error("usage: node scripts/render.mjs <static|stats> <outDir>");
  process.exit(64);
}

try {
  // Render everything before touching disk, so an API or render failure leaves the previous
  // cards untouched; each file is then swapped in with a rename, never half-written.
  const files = await builders[mode]();
  await mkdir(outDir, { recursive: true });
  for (const [name, svg] of Object.entries(files)) {
    const path = join(outDir, name);
    await writeFile(`${path}.tmp`, svg);
    await rename(`${path}.tmp`, path);
    console.log(`wrote ${path} (${svg.length} bytes)`);
  }
} catch (err) {
  console.error(`render ${mode} failed: ${err.message}`);
  process.exit(1);
}
