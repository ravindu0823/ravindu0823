// One palette for every generated card, so the banner, stack and stats read as one design.
// Accents: .NET violet and Azure blue, with cyan for motion.

export const THEMES = {
  dark: {
    name: "dark",
    bg: "#0d1117",
    bgTo: "#111a33",
    surface: "#0f1629",
    tile: "#161f36",
    border: "#25314f",
    text: "#e6edf3",
    muted: "#8b98b8",
    violet: "#a78bfa",
    azure: "#38bdf8",
    cyan: "#22d3ee",
    grid: "#2a3657",
    // Monochrome-dark logos (Next.js, Helm, ...) vanish on a dark tile; they are re-tinted to this.
    monoTint: "#e6edf3",
  },
  light: {
    name: "light",
    bg: "#f7f9ff",
    bgTo: "#e9f1ff",
    surface: "#ffffff",
    tile: "#f2f5fb",
    border: "#d8dee9",
    text: "#0f172a",
    muted: "#57606a",
    violet: "#6d28d9",
    azure: "#0078d4",
    cyan: "#0891b2",
    grid: "#cdd7ea",
    monoTint: null,
  },
};

export const FONT_SANS = "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
export const FONT_MONO = "'Cascadia Code', 'JetBrains Mono', SFMono-Regular, Consolas, 'Liberation Mono', monospace";

// Cards are 415 wide so two sit side by side in GitHub's 846px README column
// (measured on github.com at 1280px+) and drop to one per row below that.
export const CARD_WIDTH = 415;
export const CARD_HEIGHT = 280;
