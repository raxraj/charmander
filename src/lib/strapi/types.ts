/**
 * Strapi 5 REST API Data Contracts
 * Strictly aligned with Charizard's Article and Topic schemas.
 *
 * Verified fields on `api::article.article` (see charizard):
 *   title (string), slug (uid), excerpt (text), cover (single media),
 *   topics (manyToMany -> api::topic.topic), featured (boolean, default false),
 *   publishedAt (datetime), updatedAt (datetime), createdAt (datetime).
 *
 * Fields that do NOT exist and are therefore never requested or invented:
 *   readingTime, category, coverImage.
 *
 * The `content` dynamic zone is intentionally never populated by the homepage.
 */

export interface StrapiPagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export interface StrapiMedia {
  id?: number;
  documentId?: string;
  name?: string;
  alternativeText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  url: string;
  formats?: Record<string, { url: string; width: number; height: number }>;
}

export interface StrapiTopic {
  id?: number;
  documentId?: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface StrapiArticleItem {
  id: number;
  documentId?: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
  publishedAt: string;
  // Media: cover field in Charizard schema (media, single)
  cover?: StrapiMedia | { data: StrapiMedia | null } | null;
  // Relation: topics field in Charizard schema (manyToMany to Topic)
  topics?: StrapiTopic[] | { data: StrapiTopic[] } | null;
}

/**
 * Runtime guard for one Article entity returned by the public REST API.
 * Only fields the homepage actually consumes are validated; Strapi may add
 * extra system fields without breaking the contract.
 */
export function isStrapiArticleItem(value: unknown): value is StrapiArticleItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'number' &&
    typeof item.title === 'string' &&
    typeof item.slug === 'string' &&
    typeof item.publishedAt === 'string' &&
    (item.featured === undefined || typeof item.featured === 'boolean') &&
    (item.excerpt === undefined || item.excerpt === null || typeof item.excerpt === 'string')
  );
}

export interface StrapiCollectionResponse<T> {
  data: T[];
  meta?: {
    pagination?: StrapiPagination;
  };
  error?: {
    status: number;
    name: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface StrapiError {
  kind: 'connection_failed' | 'http_error' | 'malformed_response';
  message: string;
  status?: number;
  endpoint: string;
}

export type StrapiResult<T> =
  | { success: true; data: T; meta?: { pagination?: StrapiPagination } }
  | { success: false; error: StrapiError };

/* -------------------------------------------------------------------------- */
/* Article detail + Dynamic Zone component payloads                            */
/* -------------------------------------------------------------------------- */

interface StrapiBlockBase {
  id?: number;
  __component: string;
}

export interface StrapiRichTextBlock extends StrapiBlockBase {
  __component: 'article.rich-text';
  content?: string | null;
}

export interface StrapiCodeBlock extends StrapiBlockBase {
  __component: 'article.code-block';
  language?: string | null;
  code?: string | null;
  filename?: string | null;
  title?: string | null;
  explanation?: string | null;
  highlights?: string | null;
}

export interface StrapiCalloutBlock extends StrapiBlockBase {
  __component: 'article.callout';
  type?: string | null;
  title?: string | null;
  content?: string | null;
}

export interface StrapiImageBlock extends StrapiBlockBase {
  __component: 'article.image';
  media?: StrapiMedia | { data: StrapiMedia | null } | null;
  caption?: string | null;
  attribution?: string | null;
}

export interface StrapiQuoteBlock extends StrapiBlockBase {
  __component: 'article.quote';
  content?: string | null;
  attribution?: string | null;
}

export interface StrapiTableBlock extends StrapiBlockBase {
  __component: 'article.table';
  content?: string | null;
}

export interface StrapiVideoBlock extends StrapiBlockBase {
  __component: 'article.video';
  provider?: string | null;
  url?: string | null;
  caption?: string | null;
}

export interface StrapiTerminalBlock extends StrapiBlockBase {
  __component: 'article.terminal';
  command?: string | null;
  output?: string | null;
  explanation?: string | null;
}

export interface StrapiMermaidBlock extends StrapiBlockBase {
  __component: 'article.mermaid';
  title?: string | null;
  code?: string | null;
}

export interface StrapiDemoBlock extends StrapiBlockBase {
  __component: 'article.interactive-demo';
  kind?: string | null;
  config?: unknown;
  title?: string | null;
  caption?: string | null;
}

export type StrapiBlock =
  | StrapiRichTextBlock
  | StrapiCodeBlock
  | StrapiCalloutBlock
  | StrapiImageBlock
  | StrapiQuoteBlock
  | StrapiTableBlock
  | StrapiVideoBlock
  | StrapiTerminalBlock
  | StrapiMermaidBlock
  | StrapiDemoBlock;

export interface StrapiSeries {
  id?: number;
  documentId?: string;
  title?: string | null;
  slug?: string | null;
  description?: string | null;
}

export interface StrapiArticleDetail extends StrapiArticleItem {
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  position?: number | null;
  socialImage?: StrapiMedia | { data: StrapiMedia | null } | null;
  series?: StrapiSeries | { data: StrapiSeries | null } | null;
  content?: StrapiBlock[];
}

/**
 * Validates the article envelope for the detail route. Individual Dynamic Zone
 * blocks are validated separately by the block normalizer so one malformed
 * block cannot take down the whole article page.
 */
export function isStrapiArticleDetail(value: unknown): value is StrapiArticleDetail {
  if (!isStrapiArticleItem(value)) return false;
  const item = value as unknown as Record<string, unknown>;
  return item.content === undefined || Array.isArray(item.content);
}
