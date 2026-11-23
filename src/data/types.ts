export interface Article {
  id: string;
  index: string;
  slug: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  category: string;
  tags: string[];
  publishedAt: string;
  readingTime: string;
  isFeatured?: boolean;
  coverImage?: {
    src: string;
    alt: string;
    caption?: string;
  };
  author: {
    name: string;
    role: string;
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
