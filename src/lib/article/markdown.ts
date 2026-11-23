import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

/**
 * Markdown comes from the CMS and is treated as untrusted.
 *
 * Safety strategy (two layers, both applied at build time):
 *  1. markdown-it runs with `html: false`, so raw HTML in CMS content is
 *     escaped rather than emitted, and its link validator rejects dangerous
 *     protocols (javascript:, vbscript:, file:).
 *  2. The generated HTML is passed through sanitize-html with an explicit
 *     allowlist of tags, attributes and URL schemes.
 *
 * Only the resulting sanitized string is ever handed to `set:html`.
 */
const markdown = new MarkdownIt({
  html: false,
  linkify: false,
  breaks: false,
  typographer: false,
});

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'strong', 'em', 'del', 's',
  'ul', 'ol', 'li',
  'blockquote',
  'pre', 'code',
  'a',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'img',
];

export function renderMarkdown(source: string): string {
  const rendered = markdown.render(source);
  return sanitizeHtml(rendered, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title'],
      code: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
  });
}
