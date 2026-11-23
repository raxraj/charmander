# Strapi data access (build time only)

This module is the **only** place in Charmander that knows about Strapi's REST
response shape. It is imported exclusively from `src/pages/index.astro` frontmatter,
so all CMS traffic happens during `astro build` / `astro dev` SSR of the page —
never from the browser.

## Configuration

`.env` (gitignored):

```env
STRAPI_URL=http://localhost:1337
```

A non-secret placeholder is committed in `.env.example`. There is no
`PUBLIC_STRAPI_URL`, no API token and no browser-side fetch.

## Verified backend contract

Endpoint: `GET /api/articles` (public `find` permission only).

Fields present on `api::article.article` in Charizard's `schema.json` and used
here: `title`, `slug`, `excerpt`, `featured`, `publishedAt`, `cover` (single
media), `topics` (manyToMany to `api::topic.topic`).

Fields that do **not** exist and are never requested or fabricated:
`readingTime`, `category`, `coverImage`. The `content` dynamic zone is never
populated. Drafts cannot be requested: the public role has only `find` /
`findOne`, Strapi filters unpublished entries for public requests, and
`publicationState=preview` is rejected with HTTP 400.

Request (exact):

```
sort[0]=publishedAt:desc
fields[0]=title
fields[1]=slug
fields[2]=excerpt
fields[3]=featured
fields[4]=publishedAt
populate[cover][fields][0]=url
populate[cover][fields][1]=alternativeText
populate[cover][fields][2]=name
populate[topics][fields][0]=name
populate[topics][fields][1]=slug
pagination[pageSize]=25
```

## Transformation pipeline

`Strapi response → isStrapiArticleItem guard → selectHomepageArticles() →
transformStrapiArticle() → Article → Astro components`

Components consume the `Article` model from `src/data/types.ts`; they never
receive Strapi's `data` / `meta` envelope. Media URLs are made absolute when
Strapi returns a relative upload path. Topic names become the `category`
(uppercased first topic) and `tags` labels.

## Featured selection rules

Input is always newest-first (API sort).

1. The newest article with `featured: true` is featured. This makes the choice
   deterministic when several articles are featured.
2. If none is featured, the newest published article is the fallback.
3. The selected article is excluded from Recent Writing.
4. Recent Writing shows up to five remaining articles in the same order, drawn
   from the 25 most-recent published articles fetched at build time.
5. Zero published articles produce an empty selection and the designed empty
   states render instead of invented content.

## Error states

`StrapiError.kind` distinguishes `connection_failed`, `http_error` and
`malformed_response`. All three render the diagnostic banner on the homepage;
none is converted into fake articles or an empty-content response.

## Article detail routes (03C)

The same client and error model are reused by `src/pages/articles/[slug].astro`:

- `getPublishedArticleSlugs()` — paged `fields[0]=slug` query used by
  `getStaticPaths()`; only published entries are returned by the public role.
- `getArticleBySlug(slug)` — `filters[slug][$eq]` with explicit fields and
  per-component `populate[content][on][article.*]` parameters for all ten
  Dynamic Zone components (plus nested media for `article.image`). No
  `populate=*`.
- `transformArticleDetail()` — maps the entity to the page's `ArticleDetail`
  model and normalizes the Dynamic Zone via `src/lib/article/blocks.ts`.
- `SITE_URL` supplies the base for absolute canonical / OG URLs when an
  article has no `canonicalUrl` field value.
