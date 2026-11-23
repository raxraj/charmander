import { getStrapiUrl } from './client.ts';
import type { StrapiMedia } from './types.ts';

export interface ResolvedMedia {
  src: string;
  srcSet?: string;
  alt: string;
  caption?: string;
}

/**
 * Resolves a Strapi media field into a URL usable by the browser.
 * Handles both the Strapi 5 flat media object and the legacy `{ data }`
 * envelope. Relative upload paths are resolved against STRAPI_URL.
 */
export function resolveMedia(
  rawMedia: StrapiMedia | { data: StrapiMedia | null } | null | undefined
): ResolvedMedia | null {
  if (!rawMedia) return null;

  const media: StrapiMedia | null = 'data' in rawMedia ? rawMedia.data : (rawMedia as StrapiMedia);
  if (!media?.url) return null;

  const absolute = (url: string): string => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return url;
    return `${getStrapiUrl()}${url.startsWith('/') ? url : `/${url}`}`;
  };

  const srcSet = media.formats
    ? Object.values(media.formats)
        .map((format) => `${absolute(format.url)} ${format.width}w`)
        .join(', ')
    : undefined;

  return {
    src: absolute(media.url),
    srcSet,
    alt: media.alternativeText || '',
    caption: media.caption || undefined,
  };
}
