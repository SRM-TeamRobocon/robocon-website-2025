import type { ContentCardItem } from "@/components/ContentGrid";

export interface MatchVideo {
  id: string;
  title: string;
  youtubeId: string;
  description?: string;
}

export interface PcbItem {
  id: string;
  title: string;
  imageUrl: string;
  description?: string;
}

export interface CodeRepo {
  id: string;
  title: string;
  url: string;
  description?: string;
  language?: string;
}

export const ddRoboconYear = "2026";

// Real match footage goes here once available — empty renders a "coming soon" state.
export const matchVideos: MatchVideo[] = [];

// Real PCB photos/renders go here — empty renders a "coming soon" state.
export const pcbItems: PcbItem[] = [];

// Real repo links go here — empty renders a "coming soon" state.
export const codeRepos: CodeRepo[] = [];

export const ddRoboconTheme = "Kung Fu Quest";

// All India Rank at DD Robocon 2026.
export const achievement = {
  rank: 5,
  label: "All India Rank",
};

// R1/R2 competition robots. Both use the iron_man placeholder .glb until real models arrive.
// Hotspot positions are bounding-box fractions [x, y, z] (0-1 per axis) — placeholder pins,
// replace labels/positions when the real models land.
export const bots: ContentCardItem[] = [
  {
    key: "r1",
    name: "R1",
    coverImage: "/LOGO.png",
    abstract: "Robot 1 — placeholder model, swap in the real .glb and description.",
    description: "",
    gallery: [],
    modelUrl: "/3dCadFiles/iron_man.glb",
    badges: ["R1"],
    hotspots: [
      { f: [0.5, 0.9, 0.5], label: "Placeholder: sensor head", body: "Swap with the real R1 subsystem description." },
      { f: [0.5, 0.55, 0.6], label: "Placeholder: controller core", body: "Swap with the real R1 subsystem description." },
      { f: [0.2, 0.45, 0.5], label: "Placeholder: actuator arm", body: "Swap with the real R1 subsystem description." },
    ],
  },
  {
    key: "r2",
    name: "R2",
    coverImage: "/LOGO.png",
    abstract: "Robot 2 — placeholder model, swap in the real .glb and description.",
    description: "",
    gallery: [],
    modelUrl: "/3dCadFiles/iron_man.glb",
    badges: ["R2"],
    hotspots: [
      { f: [0.5, 0.9, 0.5], label: "Placeholder: sensor head", body: "Swap with the real R2 subsystem description." },
      { f: [0.8, 0.45, 0.5], label: "Placeholder: drive unit", body: "Swap with the real R2 subsystem description." },
    ],
  },
];
