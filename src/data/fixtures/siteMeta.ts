import type { SiteMeta } from "../types";

export const siteMetaFixture: SiteMeta = {
  name: "Sourcastic",
  publicationName: "Sourcastic Dev Blogs",
  tagline: "Thoughts, experiments & occasional bad decisions.",
  description: "A developer's perspective on a chaotic, beautiful tech world.",
  editorialNotice: "ISSUE NO. 01 // PERIODICAL TECHNICAL PUBLICATION // ZERO FLUFF",
  established: "2026",
  volume: "VOL. 01",
  edition: "ED. 01",
  author: {
    name: "Sourcastic Engineer",
    handle: "@sourcastic",
    bio: "Software engineer building distributed systems and investigating why AI bills keep climbing."
  },
  navigation: [
    { label: "WRITING", href: "#writing" },
    { label: "NOTES", href: "#notes" },
    { label: "TOPICS", href: "#topics" },
    { label: "ABOUT", href: "#about" }
  ],
  socialLinks: [
    { label: "github", href: "https://github.com" },
    { label: "x", href: "https://x.com" },
    { label: "youtube", href: "https://youtube.com" },
    { label: "rss", href: "/rss.xml" }
  ]
};
