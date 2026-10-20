import { FONT_SANS } from "./theme.mjs";

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const fmt = (n) => Number(n).toLocaleString("en-US");

// SVGs rendered through <img> cannot load web fonts, so text falls back to whatever the
// viewer's OS has. Estimate width generously and clamp with textLength when a label could
// overflow its box — a wider fallback font then compresses instead of spilling out.
export function estimateWidth(text, size, { mono = false, bold = false } = {}) {
  const per = mono ? 0.61 : bold ? 0.6 : 0.55;
  return String(text).length * size * per;
}

export function text(x, y, content, { size = 14, fill, weight = 400, anchor = "start", mono = false, family, maxWidth, extra = "" } = {}) {
  const fam = family ?? FONT_SANS;
  const clamp =
    maxWidth && estimateWidth(content, size, { mono, bold: weight >= 600 }) > maxWidth
      ? ` textLength="${maxWidth.toFixed(1)}" lengthAdjust="spacingAndGlyphs"`
      : "";
  return `<text x="${x}" y="${y}" font-family="${fam}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${clamp}${extra}>${esc(content)}</text>`;
}

export function svgDoc({ width, height, title, desc, body, defs = "", style = "" }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(desc)}</desc>
<defs>${defs}</defs>
<style>${style}
@media (prefers-reduced-motion: reduce) { .motion { display: none; } * { animation: none !important; } }
</style>
${body}
</svg>
`;
}

// Shared card chrome: rounded surface, hairline border, title and a right-aligned caption.
export function cardFrame(t, { width, height, title, caption, captionWidth = 200 }) {
  return [
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="14" fill="${t.surface}" stroke="${t.border}"/>`,
    `<rect x="24" y="24" width="4" height="18" rx="2" fill="url(#accent)"/>`,
    text(36, 39, title, { size: 17, weight: 700, fill: t.text }),
    caption ? text(width - 24, 39, caption, { size: 12, fill: t.muted, anchor: "end", maxWidth: captionWidth }) : "",
  ].join("\n");
}

export const accentGradient = (t) =>
  `<linearGradient id="accent" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.violet}"/><stop offset="1" stop-color="${t.azure}"/></linearGradient>`;
