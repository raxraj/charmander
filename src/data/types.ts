export interface Article {
  id: string;
  index: string;
  slug: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  category?: string;
  tags?: string[];
  publishedAt: string;
  publishedAtRaw?: string;
  readingTime?: string;
  isFeatured?: boolean;
  coverImage?: {
    src: string;
    srcSet?: string;
    alt: string;
    caption?: string;
  };
  author?: {
    name: string;
    role: string;
  };
}

/* -------------------------------------------------------------------------- */
/* Article detail / Dynamic Zone presentation models                          */
/* -------------------------------------------------------------------------- */

export interface RichTextBlock {
  type: 'rich-text';
  markdown: string;
  /** Pre-rendered, heading-ID-annotated HTML prepared by prepareArticleForReading. */
  html?: string;
}

export interface CodeBlockData {
  type: 'code';
  language: string;
  code: string;
  filename?: string;
  title?: string;
  explanation?: string;
  highlights?: string;
}

export type CalloutVariant = 'info' | 'warning' | 'success' | 'danger';

export interface CalloutBlock {
  type: 'callout';
  variant: CalloutVariant;
  title?: string;
  content: string;
}

export interface ImageBlockData {
  type: 'image';
  /** Null when Strapi has no usable media attached to this block. */
  src: string | null;
  srcSet?: string;
  alt: string;
  caption?: string;
  attribution?: string;
}

export interface QuoteBlock {
  type: 'quote';
  content: string;
  attribution?: string;
}

export interface TableBlockData {
  type: 'table';
  markdown: string;
}

export interface VideoBlock {
  type: 'video';
  provider: 'YouTube' | 'Vimeo';
  /** Null when the CMS URL is not a safe http(s) URL. */
  url: string | null;
  /** Null when the URL is not a supported embeddable URL for the provider. */
  embedUrl: string | null;
  caption?: string;
}

export interface TerminalBlock {
  type: 'terminal';
  command: string;
  output?: string;
  explanation?: string;
}

export interface MermaidBlock {
  type: 'mermaid';
  title?: string;
  code: string;
}

export interface DemoNode {
  id: string;
  label: string;
  column?: number;
  row?: number;
}

export interface DemoEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DemoBlock {
  type: 'demo';
  component: string;
  title?: string;
  caption?: string;
  /** False for unknown kinds or malformed configuration. */
  supported: boolean;
  nodes: DemoNode[];
  edges: DemoEdge[];
}

export interface UnsupportedBlock {
  type: 'unsupported';
  component: string;
}

export type ArticleBlock =
  | RichTextBlock
  | CodeBlockData
  | CalloutBlock
  | ImageBlockData
  | QuoteBlock
  | TableBlockData
  | VideoBlock
  | TerminalBlock
  | MermaidBlock
  | DemoBlock
  | UnsupportedBlock;

export interface ArticleDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  publishedAtRaw?: string;
  category?: string;
  tags: string[];
  topicSlugs: string[];
  coverImage?: Article['coverImage'];
  blocks: ArticleBlock[];
  /** Only present when Strapi has an actual series relation. */
  series?: {
    title: string;
    slug?: string;
    position?: number;
  };
  seo: {
    title: string;
    description: string;
    canonicalUrl?: string;
    image?: string;
  };
}

export interface ObsessionItem {
  id: string;
  index: string;
  title: string;
  category: string;
  status: 'ACTIVE' | 'EXPERIMENTAL' | 'RABBITHOLD' | 'BENCHMARKING';
  summary: string;
  detail: string;
  techStack: string[];
}

export interface NavItem {
  label: string;
  href: string;
  badge?: string;
  isExternal?: boolean;
}

export interface SiteMeta {
  name: string;
  publicationName: string;
  tagline: string;
  description: string;
  editorialNotice: string;
  established: string;
  volume: string;
  edition: string;
  author: {
    name: string;
    handle: string;
    bio: string;
  };
  navigation: NavItem[];
  socialLinks: Array<{ label: string; href: string }>;
}
