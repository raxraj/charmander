export interface RelatedArticle {
  slug: string;
  title: string;
  publishedAt: string;
  publishedAtRaw?: string;
  category?: string;
  topicSlugs: string[];
}

/**
 * Lightweight related-article selection (not a recommendation engine).
 * Input must already be newest-first.
 *
 * 1. Exclude the current article and de-duplicate by slug.
 * 2. Prefer other published articles sharing at least one topic.
 * 3. Fill remaining slots with the newest published articles.
 * 4. Never exceed `limit` (default three).
 */
export function selectRelatedArticles(
  articles: RelatedArticle[],
  currentSlug: string,
  currentTopicSlugs: string[],
  limit = 3
): RelatedArticle[] {
  const seen = new Set<string>();
  const candidates = articles.filter((article) => {
    if (article.slug === currentSlug || seen.has(article.slug)) return false;
    seen.add(article.slug);
    return true;
  });

  const shared = candidates.filter((article) =>
    article.topicSlugs.some((slug) => currentTopicSlugs.includes(slug))
  );

  const selected = shared.slice(0, limit);
  for (const article of candidates) {
    if (selected.length >= limit) break;
    if (!selected.some((item) => item.slug === article.slug)) selected.push(article);
  }
  return selected;
}
