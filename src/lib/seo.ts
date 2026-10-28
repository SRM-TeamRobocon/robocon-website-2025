import type { Metadata } from "next";

export const SITE_URL = "https://www.srmteamrobocon.com";
export const SITE_NAME = "SRM Team Robocon";
export const SITE_DESCRIPTION =
  "Meet SRM Team Robocon, the official robotics team of SRMIST, Kattankulathur. Explore our robots, ABU Robocon journey, achievements, events and student stories.";
export const SOCIAL_IMAGE = {
  url: "/social-card.png",
  width: 1200,
  height: 630,
  alt: "SRM Team Robocon — Robotics Reimagined",
};

export const PUBLIC_PAGES = {
  "/": { title: "Robotics Reimagined", description: SITE_DESCRIPTION },
  "/team": {
    title: "Our Team",
    description: "Meet the students behind SRM Team Robocon: our mechanical, programming, electronics and creative teams at SRMIST, Kattankulathur.",
  },
  "/projects": {
    title: "Robotics Projects",
    description: "Explore robots and engineering projects built by SRM Team Robocon, from mechanical design and embedded electronics to autonomous systems.",
  },
  "/achievements": {
    title: "Achievements & Competitions",
    description: "Discover SRM Team Robocon's achievements, competition results and milestones in ABU Robocon and student robotics competitions.",
  },
  "/gallery": {
    title: "Photo Gallery",
    description: "See SRM Team Robocon in action: robot builds, competitions, workshops and team memories from our journey at SRMIST.",
  },
  "/events": {
    title: "Events & Workshops",
    description: "Explore robotics events, technical workshops and competitions hosted and attended by SRM Team Robocon at SRMIST, Kattankulathur.",
  },
  "/blog": {
    title: "Robotics Blog",
    description: "Read engineering stories, robot build notes and team updates from the students of SRM Team Robocon at SRMIST.",
  },
  "/alumni": {
    title: "Our Alumni",
    description: "Meet the alumni of SRM Team Robocon and discover the people who helped build our robotics community at SRMIST, Kattankulathur.",
  },
} as const;

export function pageMetadata(path: string, title: string, description: string): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${path}` },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
    openGraph: {
      type: "website",
      locale: "en_IN",
      siteName: SITE_NAME,
      url: `${SITE_URL}${path}`,
      title: fullTitle,
      description,
      images: [SOCIAL_IMAGE],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [SOCIAL_IMAGE] },
  };
}

export function publicPageMetadata(path: keyof typeof PUBLIC_PAGES): Metadata {
  const { title, description } = PUBLIC_PAGES[path];
  return pageMetadata(path, title, description);
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
