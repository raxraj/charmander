import type { ObsessionItem } from "../types";

export const currentlyObsessedFixture: ObsessionItem[] = [
  {
    id: "obs-1",
    index: "01",
    title: "Local LLMs",
    category: "AI / RUNTIMES",
    status: "ACTIVE",
    summary: "Running quantized models locally with llama.cpp.",
    detail: "Zero latency and offline privacy.",
    techStack: ["GGUF", "llama.cpp"]
  },
  {
    id: "obs-2",
    index: "02",
    title: "Developer Tools",
    category: "SYSTEMS",
    status: "ACTIVE",
    summary: "Building fast, minimalist CLI utilities.",
    detail: "Zero-dependency terminal tooling.",
    techStack: ["Rust", "TypeScript"]
  },
  {
    id: "obs-3",
    index: "03",
    title: "Pixel Art",
    category: "DESIGN",
    status: "EXPERIMENTAL",
    summary: "Brutalist 8-bit visual aesthetics.",
    detail: "Crisp rectangular grid systems.",
    techStack: ["SVG", "Pixel Art"]
  },
  {
    id: "obs-4",
    index: "04",
    title: "Good Coffee",
    category: "LIFESTYLE",
    status: "ACTIVE",
    summary: "Fueling late-night debugging marathons.",
    detail: "Single-origin pour-overs.",
    techStack: ["V60", "Ethiopian Yirgacheffe"]
  }
];
