# Article content rendering

`[slug].astro` fetches one published article at build time, transforms it into
the `ArticleDetail` model (`src/lib/strapi/articles.ts`), and hands its `blocks`
to `ArticleContent.astro`.

`ArticleContent.astro` is the only place that maps a normalized block type to
an Astro component:

| Block type | Renderer |
|---|---|
| `rich-text` | `blocks/RichTextBlock.astro` |
| `code` | `blocks/CodeBlock.astro` |
| `callout` | `blocks/CalloutBlock.astro` |
| `image` | `blocks/ImageBlock.astro` |
| `quote` | `blocks/QuoteBlock.astro` |
| `table` | `blocks/TableBlock.astro` |
| `video` | `blocks/VideoBlock.astro` |
| `terminal` | `blocks/TerminalBlock.astro` |
| `mermaid` | `blocks/MermaidBlock.astro` |
| `demo` | `blocks/InteractiveDemoBlock.astro` |
| `unsupported` | `blocks/UnsupportedBlock.astro` |

Raw Strapi `__component` identifiers are validated and normalized in
`src/lib/article/blocks.ts`. Unknown components, missing required fields and
malformed demo configuration become safe fallback blocks instead of crashing
the article.

## Safety rules

- Markdown is rendered with `markdown-it` (`html: false`) and then sanitized
  with a strict allowlist before `set:html`.
- Video URLs must be valid http(s) URLs and match an allowlisted YouTube/Vimeo
  provider before an iframe is emitted. Invalid URLs render inert text.
- Interactive demos only accept the whitelisted `architecture-diagram` kind
  with validated JSON; no CMS value is evaluated as code.
- Mermaid source is treated as diagram text. Mermaid is dynamically imported
  only on pages containing a diagram and runs with `securityLevel: 'strict'`;
  invalid syntax leaves the source visible and never affects other blocks.
- Media URLs are resolved with the shared `src/lib/strapi/media.ts` helper.
