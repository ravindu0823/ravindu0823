import { CARD_HEIGHT, CARD_WIDTH, FONT_SANS } from "./theme.mjs";
import { accentGradient, cardFrame, esc, fmt, svgDoc, text } from "./svg.mjs";

const PAD = 24;
const INNER = CARD_WIDTH - 2 * PAD;

const updatedOn = (now) =>
  now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const scope = (s) => (s.restricted > 0 ? "public + visible private" : s.privateRepos > 0 ? "incl. private work" : "public work");

export function renderActivityCard(t, s, now) {
  const hero = fmt(s.contributions);
  const days = (n) => `${fmt(n)} ${n === 1 ? "day" : "days"}`;
  const cells = [
    ["Commits", fmt(s.commits)],
    ["Pull requests", fmt(s.pullRequests)],
    ["Code reviews", fmt(s.reviews)],
    ["Repositories", fmt(s.repositories)],
    ["Current streak", days(s.streak.current)],
    ["Longest streak", days(s.streak.longest)],
  ];
  const cellW = (INNER - 2 * 11) / 3;
  const grid = cells.map(([label, value], i) => {
    const x = PAD + (i % 3) * (cellW + 11);
    const y = 128 + Math.floor(i / 3) * 58;
    return `<rect x="${x.toFixed(1)}" y="${y}" width="${cellW.toFixed(1)}" height="50" rx="10" fill="${t.tile}" stroke="${t.border}"/>
${text(x + 12, y + 23, value, { size: 18, weight: 700, fill: t.text, maxWidth: cellW - 20 })}
${text(x + 12, y + 40, label, { size: 11.5, fill: t.muted, maxWidth: cellW - 20 })}`;
  }).join("\n");

  const body = `${cardFrame(t, { width: CARD_WIDTH, height: CARD_HEIGHT, title: "Activity", caption: `last 12 months · ${scope(s)}`, captionWidth: 260 })}
<text x="${PAD}" y="104" font-family="${FONT_SANS}"><tspan font-size="42" font-weight="800" fill="url(#accent)">${hero}</tspan><tspan dx="10" font-size="15" fill="${t.muted}">contributions</tspan></text>
${grid}
${text(PAD, 262, `${fmt(s.allTime)} contributions since ${s.since} · updated ${updatedOn(now)}`, { size: 11.5, fill: t.muted, maxWidth: INNER })}`;

  return svgDoc({
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    title: `GitHub activity: ${hero} contributions in the last 12 months`,
    desc: `${fmt(s.commits)} commits, ${fmt(s.pullRequests)} pull requests, ${fmt(s.reviews)} code reviews across ${fmt(s.repositories)} repositories. Current streak ${s.streak.current} days, longest ${s.streak.longest} days. ${fmt(s.allTime)} contributions since ${s.since}.`,
    defs: accentGradient(t),
    body,
  });
}

export function renderLanguagesCard(t, s, now) {
  let x = PAD;
  const segments = s.languages.map((l) => {
    const w = l.share * INNER;
    const out = `<rect x="${x.toFixed(2)}" y="62" width="${Math.max(w, 0).toFixed(2)}" height="12" fill="${esc(l.color)}"/>`;
    x += w;
    return out;
  }).join("");

  const colW = (INNER - 16) / 2;
  const legend = s.languages.map((l, i) => {
    const cx = PAD + (i % 2) * (colW + 16);
    const cy = 106 + Math.floor(i / 2) * 36;
    const pct = `${(l.share * 100).toFixed(1)}%`;
    return `<circle cx="${cx + 6}" cy="${cy - 5}" r="6" fill="${esc(l.color)}"/>
${text(cx + 20, cy, l.name, { size: 14, fill: t.text, maxWidth: colW - 80 })}
${text(cx + colW, cy, pct, { size: 14, weight: 700, fill: t.muted, anchor: "end" })}`;
  }).join("\n");

  // Deliberately static: the bar is data, and an animated reveal starts at width 0, which is
  // what a renderer that freezes at t=0 or skips off-screen SMIL would show.
  const defs = `${accentGradient(t)}
<clipPath id="bar"><rect x="${PAD}" y="62" width="${INNER}" height="12" rx="6"/></clipPath>`;

  const body = `${cardFrame(t, { width: CARD_WIDTH, height: CARD_HEIGHT, title: "Languages", caption: `by commits · last 12 months`, captionWidth: 230 })}
<rect x="${PAD}" y="62" width="${INNER}" height="12" rx="6" fill="${t.tile}"/>
<g clip-path="url(#bar)">${segments}</g>
${legend}
${text(PAD, 262, `Weighted by commits across ${fmt(s.languageRepos)} repositories · updated ${updatedOn(now)}`, { size: 11.5, fill: t.muted, maxWidth: INNER })}`;

  const list = s.languages.map((l) => `${l.name} ${(l.share * 100).toFixed(1)}%`).join(", ");
  return svgDoc({
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    title: `Languages by commits: ${list}`,
    desc: `Share of commits in the last 12 months by language: ${list}.`,
    defs,
    body,
  });
}
