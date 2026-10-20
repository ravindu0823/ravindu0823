import { FONT_MONO } from "./theme.mjs";
import { estimateWidth, svgDoc, text } from "./svg.mjs";

const W = 846;
const H = 300;

// The right-hand motif is a small event-driven system: a gateway publishes onto a bus,
// and the bus fans out to the services. Packets travel the edges on a loop.
const NODES = {
  gateway: { x: 598, y: 78, label: "api-gateway" },
  identity: { x: 772, y: 78, label: "identity" },
  bus: { x: 685, y: 152, label: "service-bus", hub: true },
  realtime: { x: 598, y: 226, label: "realtime" },
  ledger: { x: 772, y: 226, label: "ledger" },
};
const EDGES = [
  ["gateway", "bus", 0],
  ["bus", "identity", 0.65],
  ["bus", "ledger", 1.3],
  ["bus", "realtime", 1.95],
];
const CHIPS = ["event-driven", "real-time", "cloud-native", "idempotent"];
const KICKER = "$ dotnet run --project ravindu";

export function renderBanner(t) {
  const kickerWidth = estimateWidth(KICKER, 15, { mono: true });

  const edges = EDGES.map(([from, to, delay]) => {
    const a = NODES[from];
    const b = NODES[to];
    const d = `M${a.x} ${a.y} L${b.x} ${b.y}`;
    return `<path d="${d}" stroke="${t.muted}" stroke-opacity="0.55" stroke-width="1.5" fill="none" stroke-dasharray="4 6" class="flow"/>
<circle r="3.4" fill="${t.cyan}" class="motion" opacity="0">
  <animateMotion dur="2.6s" begin="${delay}s" repeatCount="indefinite" path="${d}"/>
  <animate attributeName="opacity" dur="2.6s" begin="${delay}s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.15;0.8;1"/>
</circle>`;
  }).join("\n");

  const nodes = Object.values(NODES).map((n) => {
    const w = estimateWidth(n.label, 12, { mono: true }) + 22;
    const stroke = n.hub ? "url(#accent)" : t.border;
    return `<g>
  <rect x="${(n.x - w / 2).toFixed(1)}" y="${n.y - 14}" width="${w.toFixed(1)}" height="28" rx="8" fill="${t.surface}" stroke="${stroke}" stroke-width="${n.hub ? 1.6 : 1}"/>
  ${text(n.x, n.y + 4.5, n.label, { size: 12, fill: n.hub ? t.text : t.muted, anchor: "middle", family: FONT_MONO, mono: true })}
</g>`;
  }).join("\n");

  let chipX = 44;
  const chips = CHIPS.map((c) => {
    const w = estimateWidth(c, 12.5, { mono: true }) + 20;
    const out = `<rect x="${chipX}" y="248" width="${w.toFixed(1)}" height="26" rx="13" fill="${t.tile}" stroke="${t.border}"/>
${text(chipX + w / 2, 265.5, c, { size: 12.5, fill: t.muted, anchor: "middle", family: FONT_MONO, mono: true })}`;
    chipX += w + 8;
    return out;
  }).join("\n");

  const hub = NODES.bus;
  // Animated geometry rests at its final value (see the typing clip) so a renderer that
  // skips SMIL still shows the whole kicker instead of nothing.
  const defs = `
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg}"/><stop offset="1" stop-color="${t.bgTo}"/></linearGradient>
<linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.violet}"/><stop offset="1" stop-color="${t.azure}"/></linearGradient>
<linearGradient id="name" gradientUnits="userSpaceOnUse" x1="44" y1="0" x2="420" y2="0">
  <stop offset="0" stop-color="${t.violet}"/><stop offset="0.5" stop-color="${t.azure}"/><stop offset="1" stop-color="${t.cyan}"/>
  <animateTransform attributeName="gradientTransform" type="translate" values="0 0; 90 0; 0 0" dur="7s" repeatCount="indefinite"/>
</linearGradient>
<radialGradient id="glowV"><stop offset="0" stop-color="${t.violet}" stop-opacity="0.32"/><stop offset="1" stop-color="${t.violet}" stop-opacity="0"/></radialGradient>
<radialGradient id="glowA"><stop offset="0" stop-color="${t.azure}" stop-opacity="0.26"/><stop offset="1" stop-color="${t.azure}" stop-opacity="0"/></radialGradient>
<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" fill="${t.grid}"/></pattern>
<clipPath id="frame"><rect width="${W}" height="${H}" rx="18"/></clipPath>
<clipPath id="type"><rect x="40" y="52" width="${(kickerWidth + 8).toFixed(1)}" height="28"><animate attributeName="width" from="0" to="${(kickerWidth + 8).toFixed(1)}" dur="1.6s" begin="0s" fill="freeze"/></rect></clipPath>`;

  const style = `
.flow { animation: dash 1.2s linear infinite; }
@keyframes dash { to { stroke-dashoffset: -20; } }
.caret { animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.pulse { animation: pulse 2.6s ease-in-out infinite; transform-origin: ${hub.x}px ${hub.y}px; }
@keyframes pulse { 0%, 100% { opacity: 0.35; transform: scale(0.9); } 50% { opacity: 0.8; transform: scale(1.1); } }`;

  const body = `<g clip-path="url(#frame)">
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect width="${W}" height="${H}" fill="url(#dots)" opacity="0.55"/>
<circle cx="110" cy="-10" r="300" fill="url(#glowV)"/>
<circle cx="760" cy="320" r="300" fill="url(#glowA)"/>
<circle cx="${hub.x}" cy="${hub.y}" r="70" fill="url(#glowV)" class="pulse"/>
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="18" fill="none" stroke="${t.border}"/>
<g clip-path="url(#type)">
  ${text(44, 72, KICKER, { size: 15, fill: t.cyan, family: FONT_MONO, mono: true, extra: ` textLength="${kickerWidth.toFixed(1)}" lengthAdjust="spacing"` })}
</g>
<rect x="${(44 + kickerWidth + 4).toFixed(1)}" y="59" width="8" height="17" fill="${t.cyan}" class="caret" opacity="0">
  <set attributeName="opacity" to="1" begin="1.6s" fill="freeze"/>
</rect>
${text(44, 132, "Ravindu Dhanushka", { size: 46, weight: 800, fill: t.text, maxWidth: 480 })}
${text(44, 184, "Perera", { size: 46, weight: 800, fill: "url(#name)" })}
${text(44, 224, "Software Engineer · .NET & Azure · Sri Lanka", { size: 20, fill: t.muted, maxWidth: 490 })}
${chips}
${edges}
${nodes}`;

  return svgDoc({
    width: W,
    height: H,
    title: "Ravindu Dhanushka Perera: Software Engineer, .NET and Azure",
    desc: "Animated banner: name and role on the left, an event-driven system diagram with packets moving from an API gateway through a service bus to identity, ledger and realtime services on the right.",
    defs,
    style,
    body,
  });
}

