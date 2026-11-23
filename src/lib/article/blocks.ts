import type {
  ArticleBlock,
  CalloutVariant,
  DemoEdge,
  DemoNode,
  VideoBlock,
} from '../../data/types';
import { resolveMedia } from '../strapi/media.ts';

const CALLOUT_VARIANTS: CalloutVariant[] = ['info', 'warning', 'success', 'danger'];
const SUPPORTED_DEMO_KIND = 'architecture-diagram';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Converts a validated YouTube/Vimeo URL into a privacy-friendly embed URL.
 * Returns null for every other URL, so no arbitrary iframe can be injected
 * from CMS content.
 */
export function getVideoEmbedUrl(
  provider: unknown,
  rawUrl: unknown
): string | null {
  const urlString = text(rawUrl);
  if (!urlString) return null;

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (provider === 'YouTube') {
    let id: string | null = null;
    if (host === 'youtu.be') {
      id = url.pathname.split('/').filter(Boolean)[0] ?? null;
    } else if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
      id = url.searchParams.get('v');
      if (!id) {
        const parts = url.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live'].includes(parts[0] ?? '')) id = parts[1] ?? null;
      }
    }
    return id && /^[A-Za-z0-9_-]{6,}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}`
      : null;
  }

  if (provider === 'Vimeo') {
    if (!['vimeo.com', 'player.vimeo.com'].includes(host)) return null;
    const id = url.pathname.split('/').filter(Boolean).find((part) => /^\d+$/.test(part));
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }

  return null;
}

/** Validates the JSON configuration of the one supported interactive demo. */
export function normalizeDemoConfig(
  kind: unknown,
  config: unknown
): { supported: boolean; nodes: DemoNode[]; edges: DemoEdge[] } {
  const empty = { supported: false, nodes: [] as DemoNode[], edges: [] as DemoEdge[] };
  if (kind !== SUPPORTED_DEMO_KIND || !isRecord(config)) return empty;
  if (!Array.isArray(config.nodes) || !Array.isArray(config.edges)) return empty;

  const nodes: DemoNode[] = [];
  for (const raw of config.nodes) {
    if (!isRecord(raw)) continue;
    const id = text(raw.id);
    const label = text(raw.label);
    if (!id || !label) continue;
    const column = typeof raw.column === 'number' ? raw.column : undefined;
    const row = typeof raw.row === 'number' ? raw.row : undefined;
    nodes.push({ id, label, column, row });
  }

  const knownIds = new Set(nodes.map((node) => node.id));
  const edges: DemoEdge[] = [];
  for (const raw of config.edges) {
    if (!isRecord(raw)) continue;
    const from = text(raw.from);
    const to = text(raw.to);
    if (!from || !to || !knownIds.has(from) || !knownIds.has(to)) continue;
    const label = text(raw.label);
    edges.push(label ? { from, to, label } : { from, to });
  }

  if (nodes.length === 0) return empty;
  return { supported: true, nodes, edges };
}

/** Normalizes one raw Dynamic Zone entity into a typed presentation block. */
export function normalizeBlock(raw: unknown): ArticleBlock {
  if (!isRecord(raw)) return { type: 'unsupported', component: 'unknown' };
  const component = typeof raw.__component === 'string' ? raw.__component : 'unknown';

  switch (component) {
    case 'article.rich-text': {
      const markdown = text(raw.content);
      return markdown ? { type: 'rich-text', markdown } : { type: 'unsupported', component };
    }

    case 'article.code-block': {
      const code = text(raw.code);
      if (!code) return { type: 'unsupported', component };
      return {
        type: 'code',
        code,
        language: text(raw.language) || 'text',
        filename: text(raw.filename),
        title: text(raw.title),
        explanation: text(raw.explanation),
        highlights: text(raw.highlights),
      };
    }

    case 'article.callout': {
      const content = text(raw.content);
      if (!content) return { type: 'unsupported', component };
      const variant = CALLOUT_VARIANTS.includes(raw.type as CalloutVariant)
        ? (raw.type as CalloutVariant)
        : 'info';
      const title = text(raw.title);
      return title ? { type: 'callout', variant, content, title } : { type: 'callout', variant, content };
    }

    case 'article.image': {
      const media = resolveMedia(raw.media as Parameters<typeof resolveMedia>[0]);
      const caption = text(raw.caption);
      const attribution = text(raw.attribution);
      return {
        type: 'image',
        src: media?.src ?? null,
        srcSet: media?.srcSet,
        alt: media?.alt || caption || '',
        caption: media?.caption || caption,
        attribution,
      };
    }

    case 'article.quote': {
      const content = text(raw.content);
      if (!content) return { type: 'unsupported', component };
      const attribution = text(raw.attribution);
      return attribution ? { type: 'quote', content, attribution } : { type: 'quote', content };
    }

    case 'article.table': {
      const markdown = text(raw.content);
      return markdown ? { type: 'table', markdown } : { type: 'unsupported', component };
    }

    case 'article.video': {
      const url = text(raw.url);
      if (!url) return { type: 'unsupported', component };
      const provider = raw.provider === 'YouTube' || raw.provider === 'Vimeo' ? raw.provider : null;
      const caption = text(raw.caption);

      // Never keep a non-http(s) URL: it could otherwise become an executable
      // href in the "unsupported video" fallback link.
      let safeUrl: string | null = null;
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') safeUrl = url;
      } catch {
        safeUrl = null;
      }

      const video: VideoBlock = {
        type: 'video',
        provider: provider ?? 'YouTube',
        url: safeUrl,
        embedUrl: safeUrl ? getVideoEmbedUrl(provider, url) : null,
        ...(caption ? { caption } : {}),
      };
      return video;
    }

    case 'article.terminal': {
      const command = text(raw.command);
      if (!command) return { type: 'unsupported', component };
      const output = text(raw.output);
      const explanation = text(raw.explanation);
      return {
        type: 'terminal',
        command,
        ...(output ? { output } : {}),
        ...(explanation ? { explanation } : {}),
      };
    }

    case 'article.mermaid': {
      const code = text(raw.code);
      if (!code) return { type: 'unsupported', component };
      const title = text(raw.title);
      return title ? { type: 'mermaid', code, title } : { type: 'mermaid', code };
    }

    case 'article.interactive-demo': {
      const title = text(raw.title);
      const caption = text(raw.caption);
      const normalized = normalizeDemoConfig(raw.kind, raw.config);
      return {
        type: 'demo',
        component,
        supported: normalized.supported,
        nodes: normalized.nodes,
        edges: normalized.edges,
        ...(title ? { title } : {}),
        ...(caption ? { caption } : {}),
      };
    }

    default:
      return { type: 'unsupported', component };
  }
}

/** Normalizes the whole Dynamic Zone array, tolerating missing/malformed data. */
export function normalizeBlocks(raw: unknown): ArticleBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeBlock);
}
