import type { Article } from "../types";

export const featuredArticleFixture: Article = {
  id: "feat-001",
  index: "001",
  slug: "the-great-ai-bill-mystery",
  title: "THE GREAT\nAI BILL\nMYSTERY",
  excerpt: "A technical investigation into where your tokens actually go.",
  category: "ENGINEERING",
  tags: ["AI", "Architecture", "Billing", "LLMs"],
  publishedAt: "NOV 23, 2026",
  readingTime: "8 MIN READ",
  isFeatured: true,
  coverImage: {
    src: "/assets/illustrations/featured-bill-mystery.png",
    alt: "Pixel art of developer looking shocked at a $40 AI invoice receipt",
    caption: "INVOICE DISPATCH // TOKEN ANALYSIS"
  },
  author: {
    name: "Sourcastic Engineer",
    role: "Lead Author"
  }
};

export const recentArticlesFixture: Article[] = [
  {
    id: "rec-01",
    index: "01",
    slug: "things-nobody-tells-you-about-shipping-software",
    title: "The things nobody tells you about shipping software",
    excerpt: "Hidden edge cases, tribal knowledge, and the art of surviving production deploys on Friday afternoon.",
    category: "ENGINEERING",
    tags: ["Engineering", "Production", "Culture"],
    publishedAt: "NOV 20, 2026",
    readingTime: "6 MIN",
    coverImage: {
      src: "/assets/illustrations/icon-laptop.svg",
      alt: "Pixel art laptop"
    },
    author: {
      name: "Sourcastic Engineer",
      role: "Staff Engineer"
    }
  },
  {
    id: "rec-02",
    index: "02",
    slug: "i-built-something-then-i-had-to-maintain-it",
    title: "I built something. Then I had to maintain it.",
    excerpt: "The subtle psychological transition from proud system author to exhausted primary maintainer.",
    category: "EXPERIMENTS",
    tags: ["Experiments", "Maintenance", "Refactoring"],
    publishedAt: "NOV 14, 2026",
    readingTime: "9 MIN",
    coverImage: {
      src: "/assets/illustrations/icon-gear.svg",
      alt: "Pixel art gear"
    },
    author: {
      name: "Sourcastic Engineer",
      role: "Staff Engineer"
    }
  },
  {
    id: "rec-03",
    index: "03",
    slug: "small-collection-of-thoughts-on-ai-tooling",
    title: "A small collection of thoughts on AI tooling",
    excerpt: "Pragmatic observations on context windows, autonomous agents, and where tooling genuinely saves time.",
    category: "AI",
    tags: ["AI", "Tooling", "Agents"],
    publishedAt: "NOV 08, 2026",
    readingTime: "5 MIN",
    coverImage: {
      src: "/assets/illustrations/icon-chip.svg",
      alt: "Pixel art CPU chip"
    },
    author: {
      name: "Sourcastic Engineer",
      role: "Staff Engineer"
    }
  }
];
