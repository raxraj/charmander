import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPublicationDate,
  transformStrapiArticle,
  selectHomepageArticles,
  getHomepageArticles,
} from '../src/lib/strapi/articles.ts';
import { isStrapiArticleItem } from '../src/lib/strapi/types.ts';
import { getStrapiUrl } from '../src/lib/strapi/client.ts';
import {
  getPublishedArticleSlugs,
  getArticleBySlug,
  transformArticleDetail,
} from '../src/lib/strapi/articles.ts';
import {
  normalizeBlock,
  normalizeBlocks,
  getVideoEmbedUrl,
  normalizeDemoConfig,
} from '../src/lib/article/blocks.ts';
import { renderMarkdown } from '../src/lib/article/markdown.ts';
import { getArticleHref } from '../src/lib/article/links.ts';
import {
  slugifyHeading,
  annotateHeadingIds,
  extractHeadings,
} from '../src/lib/article/headings.ts';
import { prepareArticleForReading } from '../src/lib/article/reading.ts';
import { selectRelatedArticles } from '../src/lib/article/related.ts';

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

test('formatPublicationDate formats ISO dates deterministically in UTC', () => {
  assert.equal(formatPublicationDate('2026-11-23T14:30:00.000Z'), 'NOV 23, 2026');
  assert.equal(formatPublicationDate('2026-01-05T08:00:00.000Z'), 'JAN 05, 2026');
  assert.equal(formatPublicationDate(null), '');
  assert.equal(formatPublicationDate(undefined), '');
  assert.equal(formatPublicationDate('invalid-date'), '');
});

// ---------------------------------------------------------------------------
// Strapi response -> homepage model transformation
// ---------------------------------------------------------------------------

test('transformStrapiArticle maps Strapi 5 flat fields, media and topics', () => {
  const item = {
    id: 42,
    documentId: 'doc-article-42',
    title: 'Distributed Systems in Practice',
    slug: 'distributed-systems-in-practice',
    excerpt: 'Deep dive into consensus algorithms and distributed locks.',
    featured: true,
    publishedAt: '2026-11-20T10:00:00.000Z',
    cover: {
      url: '/uploads/distributed_arch.png',
      alternativeText: 'Distributed architecture diagrams',
    },
    topics: [
      { id: 1, name: 'Architecture', slug: 'architecture' },
      { id: 2, name: 'Systems', slug: 'systems' },
    ],
  };

  const result = transformStrapiArticle(item, 3);

  assert.equal(result.id, 'doc-article-42');
  assert.equal(result.index, '03');
  assert.equal(result.slug, 'distributed-systems-in-practice');
  assert.equal(result.title, 'Distributed Systems in Practice');
  assert.equal(result.excerpt, 'Deep dive into consensus algorithms and distributed locks.');
  assert.equal(result.category, 'ARCHITECTURE');
  assert.deepEqual(result.tags, ['Architecture', 'Systems']);
  assert.equal(result.publishedAt, 'NOV 20, 2026');
  assert.equal(result.publishedAtRaw, '2026-11-20T10:00:00.000Z');
  assert.equal(result.isFeatured, true);
  assert.match(result.coverImage.src, /\/uploads\/distributed_arch\.png$/);
  assert.equal(result.coverImage.alt, 'Distributed architecture diagrams');
  // No readingTime field exists in the schema; do not invent one.
  assert.equal(result.readingTime, undefined);
});

test('transformStrapiArticle accepts wrapped { data } media and topics defensively', () => {
  const item = {
    id: 9,
    title: 'Wrapped Relations',
    slug: 'wrapped-relations',
    publishedAt: '2026-10-02T00:00:00.000Z',
    cover: { data: { url: 'https://cdn.example.com/cover.png', alternativeText: null } },
    topics: { data: [{ name: 'Tooling', slug: 'tooling' }] },
  };

  const result = transformStrapiArticle(item);

  assert.equal(result.coverImage.src, 'https://cdn.example.com/cover.png');
  // Falls back to the article title when the media has no alt text.
  assert.equal(result.coverImage.alt, 'Wrapped Relations');
  assert.equal(result.category, 'TOOLING');
  assert.deepEqual(result.tags, ['Tooling']);
});

test('transformStrapiArticle handles missing optional fields gracefully', () => {
  const result = transformStrapiArticle({
    id: 7,
    title: 'Minimal Article',
    slug: 'minimal-article',
    publishedAt: '2026-11-15T00:00:00.000Z',
  });

  assert.equal(result.id, '7');
  assert.equal(result.index, '01');
  assert.equal(result.excerpt, '');
  assert.equal(result.category, undefined);
  assert.deepEqual(result.tags, []);
  assert.equal(result.coverImage, undefined);
  assert.equal(result.isFeatured, false);
});

// ---------------------------------------------------------------------------
// Response validation
// ---------------------------------------------------------------------------

test('isStrapiArticleItem rejects malformed entities and accepts valid ones', () => {
  assert.equal(
    isStrapiArticleItem({
      id: 1,
      title: 'Valid',
      slug: 'valid',
      publishedAt: '2026-11-23T00:00:00.000Z',
      featured: false,
      excerpt: null,
    }),
    true
  );
  assert.equal(isStrapiArticleItem(null), false);
  assert.equal(isStrapiArticleItem({ id: 1, title: 'No slug' }), false);
  assert.equal(
    isStrapiArticleItem({ id: 1, title: 'Bad date', slug: 'x', publishedAt: 123 }),
    false
  );
  assert.equal(
    isStrapiArticleItem({ id: 1, title: 'Bad flag', slug: 'x', publishedAt: 'x', featured: 'yes' }),
    false
  );
});

// ---------------------------------------------------------------------------
// Selection logic (pure, so it can be tested without a running CMS)
// ---------------------------------------------------------------------------

const article = (id, overrides = {}) => ({
  id,
  documentId: `doc-${id}`,
  title: `Article ${id}`,
  slug: `article-${id}`,
  publishedAt: '2026-11-23T00:00:00.000Z',
  featured: false,
  ...overrides,
});

test('selectHomepageArticles picks the newest featured article deterministically', () => {
  // Input is newest-first, as returned by the API sort.
  const selection = selectHomepageArticles([
    article(1, { featured: true }),
    article(2, { featured: true }),
    article(3),
  ]);

  assert.equal(selection.featuredArticle.id, 'doc-1');
  assert.equal(selection.featuredArticle.index, '001');
  assert.deepEqual(selection.recentArticles.map((a) => a.id), ['doc-2', 'doc-3']);
  assert.deepEqual(selection.recentArticles.map((a) => a.index), ['01', '02']);
});

test('selectHomepageArticles falls back to the newest published article when none is featured', () => {
  const selection = selectHomepageArticles([article(10), article(11)]);

  assert.equal(selection.featuredArticle.id, 'doc-10');
  assert.deepEqual(selection.recentArticles.map((a) => a.id), ['doc-11']);
});

test('selectHomepageArticles returns an empty selection for zero published articles', () => {
  const selection = selectHomepageArticles([]);
  assert.equal(selection.featuredArticle, null);
  assert.deepEqual(selection.recentArticles, []);
});

test('selectHomepageArticles limits Recent Writing to five entries', () => {
  const selection = selectHomepageArticles(
    Array.from({ length: 9 }, (_, i) => article(i + 1))
  );

  assert.equal(selection.featuredArticle.id, 'doc-1');
  assert.equal(selection.recentArticles.length, 5);
  assert.deepEqual(
    selection.recentArticles.map((a) => a.id),
    ['doc-2', 'doc-3', 'doc-4', 'doc-5', 'doc-6']
  );
});

// ---------------------------------------------------------------------------
// Configuration + optional live smoke test
// ---------------------------------------------------------------------------

test('getStrapiUrl reads STRAPI_URL and strips trailing slashes outside Astro too', () => {
  const previous = process.env.STRAPI_URL;
  process.env.STRAPI_URL = 'http://example.test:1337/';
  try {
    assert.equal(getStrapiUrl(), 'http://example.test:1337');
  } finally {
    if (previous === undefined) delete process.env.STRAPI_URL;
    else process.env.STRAPI_URL = previous;
  }
});

test(
  'live Strapi smoke test (opt in with RUN_LIVE_STRAPI_TESTS=1)',
  { skip: process.env.RUN_LIVE_STRAPI_TESTS !== '1' },
  async () => {
    const result = await getHomepageArticles();
    assert.equal(result.error, null);
    assert.ok(result.totalPublished >= 0);
    if (result.totalPublished === 0) {
      assert.equal(result.featuredArticle, null);
      assert.deepEqual(result.recentArticles, []);
    } else {
      assert.ok(result.featuredArticle);
      assert.ok(result.recentArticles.length <= 5);
    }
  }
);

// ---------------------------------------------------------------------------
// Article routing helpers
// ---------------------------------------------------------------------------

test('article links point to real detail routes and are escaped', () => {
  assert.equal(getArticleHref('the-great-ai-bill-mystery'), '/articles/the-great-ai-bill-mystery');
  assert.equal(getArticleHref('a b/c'), '/articles/a%20b%2Fc');
});

// ---------------------------------------------------------------------------
// Dynamic Zone normalization / block registry mapping
// ---------------------------------------------------------------------------

test('every known Dynamic Zone component normalizes to its matching block type', () => {
  const samples = [
    [{ __component: 'article.rich-text', content: '# Heading' }, 'rich-text'],
    [{ __component: 'article.code-block', code: 'const x = 1;', language: 'ts' }, 'code'],
    [{ __component: 'article.callout', content: 'Take care', type: 'warning' }, 'callout'],
    [{ __component: 'article.image', media: { url: '/uploads/a.png' } }, 'image'],
    [{ __component: 'article.quote', content: 'Hello' }, 'quote'],
    [{ __component: 'article.table', content: '| a | b |\n|---|---|\n| 1 | 2 |' }, 'table'],
    [{ __component: 'article.video', provider: 'YouTube', url: 'https://youtu.be/abcdefghijk' }, 'video'],
    [{ __component: 'article.terminal', command: 'npm run build' }, 'terminal'],
    [{ __component: 'article.mermaid', code: 'graph TD; A-->B;' }, 'mermaid'],
    [{ __component: 'article.interactive-demo', kind: 'architecture-diagram', config: { nodes: [{ id: 'a', label: 'A' }], edges: [] } }, 'demo'],
  ];

  for (const [raw, expected] of samples) {
    assert.equal(normalizeBlock(raw).type, expected, `failed for ${raw.__component}`);
  }
});

test('unknown, missing and malformed blocks degrade gracefully', () => {
  assert.deepEqual(normalizeBlock({ __component: 'article.unknown-thing' }), {
    type: 'unsupported',
    component: 'article.unknown-thing',
  });
  assert.equal(normalizeBlock(null).type, 'unsupported');
  assert.equal(normalizeBlock({}).type, 'unsupported');
  assert.equal(normalizeBlock({ __component: 'article.rich-text' }).type, 'unsupported');
  assert.equal(normalizeBlock({ __component: 'article.code-block', code: '   ' }).type, 'unsupported');
  assert.equal(normalizeBlock({ __component: 'article.image' }).type, 'image');
  assert.equal(normalizeBlock({ __component: 'article.image' }).src, null);
  assert.deepEqual(normalizeBlocks(undefined), []);
  assert.deepEqual(normalizeBlocks('not an array'), []);
});

test('callout variants are limited to the four Strapi enum values', () => {
  const variants = ['info', 'warning', 'success', 'danger'];
  for (const variant of variants) {
    assert.equal(normalizeBlock({ __component: 'article.callout', content: 'x', type: variant }).variant, variant);
  }
  assert.equal(normalizeBlock({ __component: 'article.callout', content: 'x', type: '<script>' }).variant, 'info');
});

// ---------------------------------------------------------------------------
// Video safety
// ---------------------------------------------------------------------------

test('only supported YouTube / Vimeo URLs produce embeddable URLs', () => {
  assert.equal(
    getVideoEmbedUrl('YouTube', 'https://www.youtube.com/watch?v=abcdefghijk'),
    'https://www.youtube-nocookie.com/embed/abcdefghijk'
  );
  assert.equal(
    getVideoEmbedUrl('YouTube', 'https://youtu.be/abcdefghijk'),
    'https://www.youtube-nocookie.com/embed/abcdefghijk'
  );
  assert.equal(
    getVideoEmbedUrl('Vimeo', 'https://vimeo.com/123456789'),
    'https://player.vimeo.com/video/123456789'
  );
  assert.equal(getVideoEmbedUrl('YouTube', 'https://example.com/watch?v=abcdefghijk'), null);
  assert.equal(getVideoEmbedUrl('Vimeo', 'javascript:alert(1)'), null);
  assert.equal(getVideoEmbedUrl('TikTok', 'https://www.youtube.com/watch?v=abcdefghijk'), null);
  assert.equal(getVideoEmbedUrl('YouTube', 'not-a-url'), null);
});

test('video block with an unsupported URL keeps a safe text fallback', () => {
  const block = normalizeBlock({
    __component: 'article.video',
    provider: 'Vimeo',
    url: 'https://example.com/video',
  });
  assert.equal(block.type, 'video');
  assert.equal(block.embedUrl, null);
  assert.equal(block.url, 'https://example.com/video');

  const dangerous = normalizeBlock({
    __component: 'article.video',
    provider: 'YouTube',
    url: 'javascript:alert(1)',
  });
  assert.equal(dangerous.type, 'video');
  assert.equal(dangerous.embedUrl, null);
  assert.equal(dangerous.url, null);
});

// ---------------------------------------------------------------------------
// Interactive demo safety
// ---------------------------------------------------------------------------

test('interactive demo accepts only the whitelisted kind and validated config', () => {
  const valid = normalizeDemoConfig('architecture-diagram', {
    nodes: [
      { id: 'web', label: 'Web', column: 0, row: 0 },
      { id: 'api', label: 'API', column: 1, row: 0 },
    ],
    edges: [{ from: 'web', to: 'api', label: 'HTTP' }],
  });
  assert.equal(valid.supported, true);
  assert.equal(valid.nodes.length, 2);
  assert.equal(valid.edges.length, 1);

  assert.equal(normalizeDemoConfig('arbitrary-script', {}).supported, false);
  assert.equal(normalizeDemoConfig('architecture-diagram', null).supported, false);
  assert.equal(normalizeDemoConfig('architecture-diagram', { nodes: [], edges: [] }).supported, false);

  const dangling = normalizeDemoConfig('architecture-diagram', {
    nodes: [{ id: 'web', label: 'Web' }],
    edges: [{ from: 'web', to: 'missing' }],
  });
  assert.equal(dangling.supported, true);
  assert.equal(dangling.edges.length, 0);

  const normalized = normalizeBlock({
    __component: 'article.interactive-demo',
    kind: 'unknown-kind',
    config: {},
  });
  assert.equal(normalized.type, 'demo');
  assert.equal(normalized.supported, false);
});

// ---------------------------------------------------------------------------
// Markdown rendering safety
// ---------------------------------------------------------------------------

test('Markdown renders semantic HTML and escapes / strips unsafe content', () => {
  const html = renderMarkdown([
    '# Title',
    '',
    'A paragraph with **bold**, *italic*, `inline code` and a [link](https://example.com).',
    '',
    '- one',
    '- two',
    '',
    '1. first',
    '2. second',
    '',
    '> a quote',
    '',
    '```js',
    'const x = 1;',
    '```',
    '',
    '<script>alert(1)</script>',
    '',
    '[bad](javascript:alert(1))',
  ].join('\n'));

  assert.match(html, /<h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<code>inline code<\/code>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<pre><code[^>]*>const x = 1;/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.doesNotMatch(html, /<script/i);
  // markdown-it rejects the dangerous scheme, leaving it as inert text (no href).
  assert.doesNotMatch(html, /href="javascript:/i);
});

// ---------------------------------------------------------------------------
// Live article detail (opt in)
// ---------------------------------------------------------------------------

test(
  'live Strapi article detail returns published-only slugs and a complete detail model',
  { skip: process.env.RUN_LIVE_STRAPI_TESTS !== '1' },
  async () => {
    const slugsResult = await getPublishedArticleSlugs();
    assert.equal(slugsResult.error, null);
    assert.ok(Array.isArray(slugsResult.slugs));

    const missing = await getArticleBySlug('definitely-not-a-real-slug-03c');
    assert.equal(missing.article, null);
    assert.equal(missing.error, null);

    if (slugsResult.slugs.length === 0) return;

    const result = await getArticleBySlug(slugsResult.slugs[0]);
    assert.equal(result.error, null);
    assert.ok(result.article);
    const detail = transformArticleDetail(result.article);
    assert.equal(detail.slug, slugsResult.slugs[0]);
    assert.ok(Array.isArray(detail.blocks));
    assert.ok(detail.seo.canonicalUrl?.startsWith('http'));
  }
);

// ---------------------------------------------------------------------------
// Shared heading IDs / table of contents
// ---------------------------------------------------------------------------

test('slugifyHeading produces stable, comparable IDs', () => {
  assert.equal(slugifyHeading('The Problem'), 'the-problem');
  assert.equal(slugifyHeading('  Tokens & Billing!  '), 'tokens-billing');
  assert.equal(slugifyHeading('Café & Résumé'), 'cafe-resume');
  assert.equal(slugifyHeading('***'), 'section');
});

test('annotateHeadingIds and extractHeadings share one ID strategy', () => {
  const html = '<h2>The problem</h2><p>text</p><h3>Details</h3><h2>The problem</h2>';
  const annotated = annotateHeadingIds(html);
  assert.match(annotated, /<h2 id="the-problem">/);
  assert.match(annotated, /<h3 id="details">/);
  assert.match(annotated, /<h2 id="the-problem-2">/);

  assert.deepEqual(extractHeadings(annotated), [
    { level: 2, id: 'the-problem', text: 'The problem' },
    { level: 3, id: 'details', text: 'Details' },
    { level: 2, id: 'the-problem-2', text: 'The problem' },
  ]);
});

test('heading counter is shared across multiple rich-text blocks', () => {
  const used = new Map();
  const first = annotateHeadingIds('<h2>Overview</h2>', used);
  const second = annotateHeadingIds('<h2>Overview</h2>', used);
  assert.match(first, /id="overview"/);
  assert.match(second, /id="overview-2"/);
});

// ---------------------------------------------------------------------------
// Reading preparation / honest metadata
// ---------------------------------------------------------------------------

test('prepareArticleForReading builds TOC from rich text and derives reading stats', () => {
  const blocks = [
    {
      type: 'rich-text',
      markdown: '## Introduction\n\nSome prose here.\n\n### Details\n\nMore prose.\n\n```js\nconst ignored = 1;\n```',
    },
    { type: 'code', code: 'const x = 1;', language: 'js' },
    { type: 'rich-text', markdown: '## Conclusion\n\nFinal words.' },
  ];

  const prepared = prepareArticleForReading(blocks);
  assert.deepEqual(prepared.headings.map((h) => h.id), ['introduction', 'details', 'conclusion']);
  assert.equal(prepared.headings[1].level, 3);
  assert.match(prepared.blocks[0].html, /id="introduction"/);
  assert.ok(prepared.wordCount > 0);
  assert.match(prepared.readingTime, /^\d+ MIN READ$/);
  assert.equal(prepared.blocks[1], blocks[1]);
});

test('prepareArticleForReading handles an article with no headings', () => {
  const prepared = prepareArticleForReading([
    { type: 'rich-text', markdown: 'Just a paragraph without headings.' },
  ]);
  assert.deepEqual(prepared.headings, []);
  assert.equal(prepared.readingTime, '1 MIN READ');
});

// ---------------------------------------------------------------------------
// Related article selection
// ---------------------------------------------------------------------------

test('related articles prefer shared topics, exclude current, and cap at three', () => {
  const item = (slug, topicSlugs) => ({
    slug,
    title: slug,
    publishedAt: 'NOV 23, 2026',
    topicSlugs,
  });
  const pool = [
    item('current', ['ai']),
    item('newest-unrelated', ['food']),
    item('shared-one', ['ai']),
    item('shared-two', ['ai', 'systems']),
    item('shared-one', ['ai']), // duplicate slug
    item('older-unrelated', ['music']),
  ];

  const selected = selectRelatedArticles(pool, 'current', ['ai'], 3);
  assert.deepEqual(selected.map((a) => a.slug), ['shared-one', 'shared-two', 'newest-unrelated']);
  assert.ok(!selected.some((a) => a.slug === 'current'));
  assert.equal(new Set(selected.map((a) => a.slug)).size, selected.length);
});

test('related articles can be omitted when no candidates exist', () => {
  assert.deepEqual(
    selectRelatedArticles([{ slug: 'only', title: 'Only', publishedAt: 'x', topicSlugs: [] }], 'only', [], 3),
    []
  );
});
