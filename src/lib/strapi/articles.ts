import type { Article, ArticleDetail } from '../../data/types';
import { normalizeBlocks } from '../article/blocks.ts';
import { getArticleHref } from '../article/links.ts';
import { selectRelatedArticles } from '../article/related.ts';
import type { RelatedArticle } from '../article/related.ts';
import { getSiteUrl } from '../site.ts';
import { fetchStrapiCollection } from './client.ts';
import { resolveMedia } from './media.ts';
import { isStrapiArticleDetail, isStrapiArticleItem } from './types.ts';
import type {
  StrapiArticleDetail,
  StrapiArticleItem,
  StrapiSeries,
  StrapiTopic,
  StrapiError,
} from './types.ts';

/** How many published articles to request during the build. */
const FETCH_PAGE_SIZE = 25;
/** How many articles (excluding the featured one) appear under Recent Writing. */
const RECENT_ARTICLE_LIMIT = 5;

/**
 * Deterministically formats an ISO date string to editorial uppercase format
 * (e.g. "NOV 23, 2026"). UTC components keep the output identical across
 * build machines regardless of their local timezone.
 */
export function formatPublicationDate(isoDateStr?: string | null): string {
  if (!isoDateStr) return '';
  const date = new Date(isoDateStr);
  if (isNaN(date.getTime())) return '';

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[date.getUTCMonth()];
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = date.getUTCFullYear();

  return `${month} ${day}, ${year}`;
}

/** Extracts populated topic entities from either Strapi response shape. */
function extractTopics(
  rawTopics: StrapiTopic[] | { data: StrapiTopic[] } | null | undefined
): StrapiTopic[] {
  if (!rawTopics) return [];
  if (Array.isArray(rawTopics)) return rawTopics;
  if ('data' in rawTopics && Array.isArray(rawTopics.data)) return rawTopics.data;
  return [];
}

/**
 * Transform layer: raw Strapi Article entity -> homepage Article model.
 * UI components never see Strapi's response envelope.
 *
 * Reading time is deliberately omitted: Charizard has no `readingTime` field,
 * so inventing one would be misleading. Missing excerpts are represented as an
 * empty string and omitted by the presentation components.
 */
export function transformStrapiArticle(item: StrapiArticleItem, listIndex?: number): Article {
  const topics = extractTopics(item.topics);
  const cover = resolveMedia(item.cover);

  return {
    id: item.documentId || String(item.id),
    index: listIndex !== undefined ? String(listIndex).padStart(2, '0') : '01',
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt || '',
    category: topics.length > 0 ? topics[0].name.toUpperCase() : undefined,
    tags: topics.map((topic) => topic.name),
    publishedAt: formatPublicationDate(item.publishedAt),
    publishedAtRaw: item.publishedAt,
    isFeatured: Boolean(item.featured),
    coverImage: cover
      ? {
          src: cover.src,
          srcSet: cover.srcSet,
          alt: cover.alt || item.title,
          caption: cover.caption,
        }
      : undefined,
  };
}

export interface HomepageSelection {
  featuredArticle: Article | null;
  recentArticles: Article[];
}

/**
 * Pure selection logic for the homepage sections.
 *
 * Input MUST be ordered newest-first by publishedAt (the API request applies
 * `sort[0]=publishedAt:desc`).
 *
 * Selection rules:
 *  1. The newest article with `featured: true` becomes the featured article.
 *     Because the input is sorted, this is deterministic when several articles
 *     are marked featured.
 *  2. If none is featured, the newest published article is the fallback.
 *  3. The chosen article is excluded from Recent Writing.
 *  4. Recent Writing takes up to five remaining articles, still newest-first.
 *  5. An empty input yields an empty selection (designed empty states render).
 */
export function selectHomepageArticles(rawArticles: StrapiArticleItem[]): HomepageSelection {
  if (rawArticles.length === 0) {
    return { featuredArticle: null, recentArticles: [] };
  }

  const featuredCandidate = rawArticles.find((article) => article.featured === true);
  const selectedFeaturedRaw = featuredCandidate || rawArticles[0];
  const selectedId = selectedFeaturedRaw.documentId || String(selectedFeaturedRaw.id);

  const featuredArticle: Article = {
    ...transformStrapiArticle(selectedFeaturedRaw, 1),
    index: '001',
  };

  const recentArticles = rawArticles
    .filter((article) => (article.documentId || String(article.id)) !== selectedId)
    .slice(0, RECENT_ARTICLE_LIMIT)
    .map((article, index) => transformStrapiArticle(article, index + 1));

  return { featuredArticle, recentArticles };
}

export interface HomepageArticlesResult extends HomepageSelection {
  error: StrapiError | null;
  totalPublished: number;
}

/**
 * Fetches published articles from Strapi at Astro build time with an explicit
 * field list and shallow population of only the relations the homepage needs.
 */
export async function getHomepageArticles(): Promise<HomepageArticlesResult> {
  const queryParams = new URLSearchParams({
    'sort[0]': 'publishedAt:desc',
    'fields[0]': 'title',
    'fields[1]': 'slug',
    'fields[2]': 'excerpt',
    'fields[3]': 'featured',
    'fields[4]': 'publishedAt',
    'populate[cover][fields][0]': 'url',
    'populate[cover][fields][1]': 'alternativeText',
    'populate[cover][fields][2]': 'name',
    'populate[topics][fields][0]': 'name',
    'populate[topics][fields][1]': 'slug',
    'pagination[pageSize]': String(FETCH_PAGE_SIZE),
  });

  const result = await fetchStrapiCollection<unknown>('/api/articles', queryParams.toString());

  if (!result.success) {
    return {
      featuredArticle: null,
      recentArticles: [],
      error: result.error,
      totalPublished: 0,
    };
  }

  // A valid envelope carrying unexpected entities is a malformed CMS response,
  // not an empty content state. Keep the two distinguishable.
  if (!result.data.every(isStrapiArticleItem)) {
    return {
      featuredArticle: null,
      recentArticles: [],
      error: {
        kind: 'malformed_response',
        message: 'Strapi returned Article entries that do not match the expected schema.',
        endpoint: '/api/articles',
      },
      totalPublished: 0,
    };
  }

  const rawArticles = result.data;
  const selection = selectHomepageArticles(rawArticles);

  return {
    ...selection,
    error: null,
    totalPublished: rawArticles.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Article detail (build-time)                                                 */
/* -------------------------------------------------------------------------- */

const DETAIL_PAGE_SIZE = 100; // Charizard's configured REST maxLimit

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Returns every published article slug. Pages through the public REST API so
 * the route list is complete even when more than 100 articles exist.
 * An API failure is surfaced as an error; it is never converted into an empty
 * route list silently by this function.
 */
export async function getPublishedArticleSlugs(): Promise<{
  slugs: string[];
  error: StrapiError | null;
}> {
  const slugs: string[] = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount && page <= 100) {
    const query = new URLSearchParams([
      ['fields[0]', 'slug'],
      ['sort[0]', 'publishedAt:desc'],
      ['pagination[page]', String(page)],
      ['pagination[pageSize]', String(DETAIL_PAGE_SIZE)],
    ]);

    const result = await fetchStrapiCollection<{ slug?: unknown }>('/api/articles', query.toString());
    if (!result.success) return { slugs: [], error: result.error };

    pageCount = result.meta?.pagination?.pageCount ?? 1;
    for (const item of result.data) {
      const slug = nonEmpty(item.slug);
      if (slug && !slugs.includes(slug)) slugs.push(slug);
    }
    page += 1;
  }

  return { slugs, error: null };
}

/**
 * Explicit field list and shallow population for one article detail page.
 * Dynamic Zone components are populated per component; no `populate=*` and no
 * unrelated relations (series, SEO extras beyond the used fields) are fetched.
 */
function buildArticleDetailQuery(slug: string): string {
  const query = new URLSearchParams([
    ['filters[slug][$eq]', slug],
    ['fields[0]', 'title'],
    ['fields[1]', 'slug'],
    ['fields[2]', 'excerpt'],
    ['fields[3]', 'featured'],
    ['fields[4]', 'publishedAt'],
    ['fields[5]', 'seoTitle'],
    ['fields[6]', 'seoDescription'],
    ['fields[7]', 'canonicalUrl'],
    ['fields[8]', 'position'],
    ['populate[series][fields][0]', 'title'],
    ['populate[series][fields][1]', 'slug'],
    ['populate[cover][fields][0]', 'url'],
    ['populate[cover][fields][1]', 'alternativeText'],
    ['populate[cover][fields][2]', 'caption'],
    ['populate[cover][fields][3]', 'formats'],
    ['populate[topics][fields][0]', 'name'],
    ['populate[topics][fields][1]', 'slug'],
    ['populate[socialImage][fields][0]', 'url'],
    ['populate[socialImage][fields][1]', 'alternativeText'],

    ['populate[content][on][article.rich-text][fields][0]', 'content'],

    ['populate[content][on][article.code-block][fields][0]', 'language'],
    ['populate[content][on][article.code-block][fields][1]', 'code'],
    ['populate[content][on][article.code-block][fields][2]', 'filename'],
    ['populate[content][on][article.code-block][fields][3]', 'title'],
    ['populate[content][on][article.code-block][fields][4]', 'explanation'],
    ['populate[content][on][article.code-block][fields][5]', 'highlights'],

    ['populate[content][on][article.callout][fields][0]', 'type'],
    ['populate[content][on][article.callout][fields][1]', 'title'],
    ['populate[content][on][article.callout][fields][2]', 'content'],

    ['populate[content][on][article.image][fields][0]', 'caption'],
    ['populate[content][on][article.image][fields][1]', 'attribution'],
    ['populate[content][on][article.image][populate][media][fields][0]', 'url'],
    ['populate[content][on][article.image][populate][media][fields][1]', 'alternativeText'],
    ['populate[content][on][article.image][populate][media][fields][2]', 'caption'],
    ['populate[content][on][article.image][populate][media][fields][3]', 'formats'],

    ['populate[content][on][article.quote][fields][0]', 'content'],
    ['populate[content][on][article.quote][fields][1]', 'attribution'],

    ['populate[content][on][article.table][fields][0]', 'content'],

    ['populate[content][on][article.video][fields][0]', 'provider'],
    ['populate[content][on][article.video][fields][1]', 'url'],
    ['populate[content][on][article.video][fields][2]', 'caption'],

    ['populate[content][on][article.terminal][fields][0]', 'command'],
    ['populate[content][on][article.terminal][fields][1]', 'output'],
    ['populate[content][on][article.terminal][fields][2]', 'explanation'],

    ['populate[content][on][article.mermaid][fields][0]', 'title'],
    ['populate[content][on][article.mermaid][fields][1]', 'code'],

    ['populate[content][on][article.interactive-demo][fields][0]', 'kind'],
    ['populate[content][on][article.interactive-demo][fields][1]', 'config'],
    ['populate[content][on][article.interactive-demo][fields][2]', 'title'],
    ['populate[content][on][article.interactive-demo][fields][3]', 'caption'],
  ]);
  return query.toString();
}

/** Fetches one published article by slug. Null means: not found / not published. */
export async function getArticleBySlug(slug: string): Promise<{
  article: StrapiArticleDetail | null;
  error: StrapiError | null;
}> {
  const result = await fetchStrapiCollection<unknown>(
    '/api/articles',
    buildArticleDetailQuery(slug)
  );

  if (!result.success) return { article: null, error: result.error };
  if (result.data.length === 0) return { article: null, error: null };
  if (!isStrapiArticleDetail(result.data[0])) {
    return {
      article: null,
      error: {
        kind: 'malformed_response',
        message: `Strapi returned a malformed Article for slug "${slug}".`,
        endpoint: '/api/articles',
      },
    };
  }

  return { article: result.data[0], error: null };
}

/** Strapi article entity -> typed article detail page model. */
export function transformArticleDetail(raw: StrapiArticleDetail): ArticleDetail {
  const topics = extractTopics(raw.topics);
  const cover = resolveMedia(raw.cover);
  const socialImage = resolveMedia(raw.socialImage);
  const slug = raw.slug;
  const rawSeries = raw.series;
  const series: StrapiSeries | null = rawSeries
    ? 'data' in rawSeries
      ? rawSeries.data ?? null
      : rawSeries
    : null;
  const seriesTitle = nonEmpty(series?.title);

  return {
    id: raw.documentId || String(raw.id),
    slug,
    title: raw.title,
    excerpt: raw.excerpt || '',
    publishedAt: formatPublicationDate(raw.publishedAt),
    publishedAtRaw: raw.publishedAt,
    category: topics.length > 0 ? topics[0].name.toUpperCase() : undefined,
    tags: topics.map((topic) => topic.name),
    topicSlugs: topics.map((topic) => topic.slug),
    series: seriesTitle
      ? {
          title: seriesTitle,
          ...(nonEmpty(series?.slug) ? { slug: nonEmpty(series?.slug) } : {}),
          ...(typeof raw.position === 'number' ? { position: raw.position } : {}),
        }
      : undefined,
    coverImage: cover
      ? {
          src: cover.src,
          srcSet: cover.srcSet,
          alt: cover.alt || raw.title,
          caption: cover.caption,
        }
      : undefined,
    blocks: normalizeBlocks(raw.content),
    seo: {
      title: nonEmpty(raw.seoTitle) || raw.title,
      description: nonEmpty(raw.seoDescription) || nonEmpty(raw.excerpt) || '',
      canonicalUrl: nonEmpty(raw.canonicalUrl) || `${getSiteUrl()}${getArticleHref(slug)}`,
      image: socialImage?.src || cover?.src,
    },
  };
}

/**
 * Fetches one compact page of published articles for the right sidebar.
 * Supplementary data: on API failure the section is omitted (with a build log)
 * rather than breaking the article page.
 */
export async function getRelatedArticles(
  currentSlug: string,
  currentTopicSlugs: string[],
  limit = 3
): Promise<RelatedArticle[]> {
  const query = new URLSearchParams([
    ['fields[0]', 'title'],
    ['fields[1]', 'slug'],
    ['fields[2]', 'publishedAt'],
    ['populate[topics][fields][0]', 'name'],
    ['populate[topics][fields][1]', 'slug'],
    ['sort[0]', 'publishedAt:desc'],
    ['pagination[pageSize]', String(DETAIL_PAGE_SIZE)],
  ]);

  const result = await fetchStrapiCollection<unknown>('/api/articles', query.toString());
  if (!result.success) {
    console.warn(`[articles] Related articles unavailable: ${result.error.message}`);
    return [];
  }

  const candidates: RelatedArticle[] = result.data
    .filter(isStrapiArticleItem)
    .map((item) => {
      const topics = extractTopics(item.topics);
      return {
        slug: item.slug,
        title: item.title,
        publishedAt: formatPublicationDate(item.publishedAt),
        publishedAtRaw: item.publishedAt,
        category: topics[0]?.name.toUpperCase(),
        topicSlugs: topics.map((topic) => topic.slug),
      };
    });

  return selectRelatedArticles(candidates, currentSlug, currentTopicSlugs, limit);
}
