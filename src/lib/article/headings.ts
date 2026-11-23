/** Heading metadata shared by the renderer and the table of contents. */
export interface TocHeading {
  id: string;
  level: 2 | 3;
  text: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const hex = code[1]?.toLowerCase() === 'x';
      const value = parseInt(hex ? code.slice(2) : code.slice(1), hex ? 16 : 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Removes tags and decodes entities from sanitized HTML text. */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).trim();
}

/** Stable, human-readable heading ID (shared by renderer and TOC). */
export function slugifyHeading(text: string): string {
  const slug = stripTags(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'section';
}

/**
 * Adds stable, unique IDs to H2/H3 elements in already-sanitized HTML.
 * The `used` map is shared across all blocks of one article so duplicates get
 * deterministic suffixes (e.g. `overview`, `overview-2`).
 */
export function annotateHeadingIds(html: string, used: Map<string, number> = new Map()): string {
  return html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_match, level, attrs, inner) => {
    const base = slugifyHeading(stripTags(inner));
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const id = seen === 0 ? base : `${base}-${seen + 1}`;
    const cleanedAttrs = String(attrs).replace(/\s+id\s*=\s*"[^"]*"/gi, '');
    return `<h${level}${cleanedAttrs} id="${id}">${inner}</h${level}>`;
  });
}

/** Reads heading entries from HTML that has been through annotateHeadingIds(). */
export function extractHeadings(html: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const pattern = /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const id = /id\s*=\s*"([^"]+)"/i.exec(match[2])?.[1];
    if (!id) continue;
    headings.push({
      level: Number(match[1]) as 2 | 3,
      id,
      text: stripTags(match[3]),
    });
  }
  return headings;
}
