/** Canonical internal link to an article detail page. */
export function getArticleHref(slug: string): string {
  return `/articles/${encodeURIComponent(slug)}`;
}
