import type { ArticleBlock } from '../../data/types';
import { annotateHeadingIds, extractHeadings } from './headings.ts';
import type { TocHeading } from './headings.ts';
import { renderMarkdown } from './markdown.ts';

export interface ReadingPreparation {
  /** Blocks with pre-rendered, ID-annotated rich text (no duplicate rendering). */
  blocks: ArticleBlock[];
  headings: TocHeading[];
  wordCount: number;
  readingTime: string;
}

const WORDS_PER_MINUTE = 220;

function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

/** Counts prose only — code fences, inline code and Markdown syntax are excluded. */
function proseFromMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[#>*-]+\s?/gm, ' ')
    .replace(/[*_~|]/g, ' ');
}

/**
 * Prepares the article for reading: renders rich text once, assigns heading IDs
 * from a single shared counter, extracts the TOC, and derives honest reading
 * metadata from the actual text (no CMS field is invented).
 */
export function prepareArticleForReading(blocks: ArticleBlock[]): ReadingPreparation {
  const usedIds = new Map<string, number>();
  const headings: TocHeading[] = [];
  let wordCount = 0;

  const prepared = blocks.map((block): ArticleBlock => {
    switch (block.type) {
      case 'rich-text': {
        const html = annotateHeadingIds(renderMarkdown(block.markdown), usedIds);
        headings.push(...extractHeadings(html));
        wordCount += countWords(proseFromMarkdown(block.markdown));
        return { ...block, html };
      }
      case 'callout':
        wordCount += countWords(block.content);
        break;
      case 'quote':
        wordCount += countWords(block.content);
        break;
      case 'table':
        wordCount += countWords(proseFromMarkdown(block.markdown));
        break;
      default:
        break;
    }
    return block;
  });

  const minutes = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
  return {
    blocks: prepared,
    headings,
    wordCount,
    readingTime: `${minutes} MIN READ`,
  };
}
