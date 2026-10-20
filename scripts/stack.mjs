import { CARD_HEIGHT, CARD_WIDTH, FONT_MONO } from "./theme.mjs";
import { accentGradient, cardFrame, estimateWidth, svgDoc, text } from "./svg.mjs";

// Pinned so a devicon release can never change a committed card underneath us.
const DEVICON = "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons";

// `mono` marks logos drawn in a single dark colour; on the dark theme they are re-tinted
// light, otherwise they disappear into the tile. `variant` picks a devicon file other than
// `-original` (Linux's original is a 190 KB illustration; `-plain` is 3 KB).
export const STACK = [
  {
    id: "backend",
    title: "Backend",
    caption: "C# and .NET first",
    icons: [
      ["csharp", "C#"], ["dotnetcore", ".NET"], ["blazor", "Blazor"], ["typescript", "TypeScript"], ["javascript", "JavaScript"],
      ["nodejs", "Node.js"], ["python", "Python"], ["java", "Java"], ["spring", "Spring"], ["fastify", "Fastify", { mono: true }],
    ],
    chips: ["ASP.NET Core", "Aspire", "EF Core", "SignalR"],
  },
  {
    id: "data",
    title: "Data & messaging",
    caption: "SQL, cache, queues",
    icons: [
      ["postgresql", "PostgreSQL"], ["microsoftsqlserver", "SQL Server", { variant: "plain" }], ["redis", "Redis"], ["rabbitmq", "RabbitMQ"], ["mongodb", "MongoDB"],
      ["mysql", "MySQL", { mono: true }],
    ],
    chips: ["Service Bus", "MassTransit", "Hangfire", "PostGIS"],
  },
  {
    id: "cloud",
    title: "Cloud & DevOps",
    caption: "Azure first",
    icons: [
      ["azure", "Azure"], ["azuredevops", "Azure DevOps"], ["docker", "Docker"], ["kubernetes", "Kubernetes"], ["helm", "Helm", { mono: true }],
      ["githubactions", "Actions"], ["terraform", "Terraform"], ["digitalocean", "DigitalOcean"], ["linux", "Linux", { mono: true, variant: "plain" }],
    ],
    chips: ["Bicep", "Container Apps", "APIM", "Dokploy"],
  },
  {
    id: "frontend",
    title: "Frontend, ML & observability",
    caption: "",
    icons: [
      ["react", "React"], ["nextjs", "Next.js", { mono: true, variant: "plain" }], ["tailwindcss", "Tailwind"], ["flutter", "Flutter"], ["tensorflow", "TensorFlow"],
      ["opentelemetry", "OpenTelemetry"], ["sentry", "Sentry", { mono: true }],
    ],
    chips: ["ML.NET", "MediaPipe", "Serilog"],
  },
];

export async function fetchIcons() {
  const ids = [...new Map(STACK.flatMap((c) => c.icons.map(([id, , o = {}]) => [id, o.variant ?? "original"]))).entries()];
  const entries = await Promise.all(
    ids.map(async ([id, variant]) => {
      const url = `${DEVICON}/${id}/${id}-${variant}.svg`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`devicon ${id}: HTTP ${res.status}`);
      const svg = await res.text();
      if (!svg.includes("<svg")) throw new Error(`devicon ${id}: not an SVG`);
      return [id, `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`];
    }),
  );
  return Object.fromEntries(entries);
}

const PAD = 24;
const TILE = 56;
const PER_ROW = 5;
const GAP = (CARD_WIDTH - 2 * PAD - PER_ROW * TILE) / (PER_ROW - 1);

export function renderStackCard(t, card, icons) {
  const rows = [];
  for (let i = 0; i < card.icons.length; i += PER_ROW) rows.push(card.icons.slice(i, i + PER_ROW));

  const tiles = rows.map((row, r) => {
    // Centre a short last row instead of leaving it hanging on the left.
    const rowWidth = row.length * TILE + (row.length - 1) * GAP;
    const startX = (CARD_WIDTH - rowWidth) / 2;
    const y = 58 + r * 82;
    return row.map(([id, label, opts = {}], i) => {
      const x = startX + i * (TILE + GAP);
      const tint = opts.mono && t.monoTint ? ` filter="url(#mono)"` : "";
      return `<rect x="${x.toFixed(1)}" y="${y}" width="${TILE}" height="${TILE}" rx="12" fill="${t.tile}" stroke="${t.border}"/>
<image href="${icons[id]}" x="${(x + 12).toFixed(1)}" y="${y + 12}" width="32" height="32"${tint}/>
${text(x + TILE / 2, y + TILE + 16, label, { size: 11.5, fill: t.muted, anchor: "middle", maxWidth: TILE + GAP - 4 })}`;
    }).join("\n");
  }).join("\n");

  let chipX = PAD;
  const chipY = 58 + 2 * 82 + 6;
  const chips = card.chips.map((c) => {
    const w = estimateWidth(c, 11.5, { mono: true }) + 16;
    const out = `<rect x="${chipX.toFixed(1)}" y="${chipY}" width="${w.toFixed(1)}" height="24" rx="12" fill="none" stroke="${t.border}"/>
${text(chipX + w / 2, chipY + 16, c, { size: 11.5, fill: t.text, anchor: "middle", family: FONT_MONO, mono: true })}`;
    chipX += w + 6;
    return out;
  }).join("\n");

  const [r, g, b] = t.monoTint ? [1, 3, 5].map((i) => parseInt(t.monoTint.slice(i, i + 2), 16) / 255) : [0, 0, 0];
  const defs = `${accentGradient(t)}
<filter id="mono"><feColorMatrix type="matrix" values="0 0 0 0 ${r.toFixed(3)}  0 0 0 0 ${g.toFixed(3)}  0 0 0 0 ${b.toFixed(3)}  0 0 0 1 0"/></filter>`;

  const names = card.icons.map(([, label]) => label).concat(card.chips).join(", ");
  return svgDoc({
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    title: `${card.title}: ${names}`,
    desc: `Technology card listing ${names}.`,
    defs,
    body: `${cardFrame(t, { width: CARD_WIDTH, height: CARD_HEIGHT, title: card.title, caption: card.caption })}
${tiles}
${chips}`,
  });
}
