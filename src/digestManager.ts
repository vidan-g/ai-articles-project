import fs from 'node:fs/promises';
import {
  AIStory,
  CompanyTag,
  DailyBriefing,
  DigestStats,
  DuplicateCheckResult,
  FilterOptions,
  TRACKED_COMPANIES,
} from './types.js';
import { formatDailyBriefing, parseDigestMarkdown } from './parser.js';

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'into',
  'new',
  'its',
  'are',
  'has',
  'have',
  'over',
  'more',
  'than',
]);

const DEFAULT_HEADER = `# Daily AI News Digest

Rolling archive of the 5 most important AI stories from the previous 24 hours. Newest digests are prepended at the top.

---
`;

/**
 * Tokenizes a title or summary into normalized significant words for similarity comparison.
 */
export function tokenizeForSimilarity(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  return new Set(words);
}

/**
 * Computes Jaccard similarity (0 to 1) between two strings.
 */
export function computeTitleSimilarity(a: string, b: string): number {
  const tokensA = tokenizeForSimilarity(a);
  const tokensB = tokenizeForSimilarity(b);

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection++;
    }
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Checks whether a candidate story (title + optional source URLs) duplicates an existing story.
 */
export function checkStoryDuplicate(
  existingBriefings: DailyBriefing[],
  candidateTitle: string,
  candidateUrls: string[] = [],
  similarityThreshold = 0.45
): DuplicateCheckResult {
  const normalizedCandidateUrls = new Set(
    candidateUrls.map((u) => u.trim().replace(/\/+$/, '').toLowerCase()).filter(Boolean)
  );

  for (const briefing of existingBriefings) {
    for (const story of briefing.stories) {
      for (const src of story.sources) {
        const normalizedExistingUrl = src.url.trim().replace(/\/+$/, '').toLowerCase();
        if (normalizedCandidateUrls.has(normalizedExistingUrl)) {
          return {
            isDuplicate: true,
            reason: `Matching source URL already published on ${briefing.date}`,
            matchedStory: {
              title: story.title,
              date: briefing.date,
              similarity: 1,
            },
          };
        }
      }

      const similarity = computeTitleSimilarity(candidateTitle, story.title);
      if (similarity >= similarityThreshold) {
        return {
          isDuplicate: true,
          reason: `High title similarity (${Math.round(similarity * 100)}%) with story on ${briefing.date}`,
          matchedStory: {
            title: story.title,
            date: briefing.date,
            similarity: Number(similarity.toFixed(2)),
          },
        };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Filters stories across all briefings by company tag, search query, and/or date.
 */
export function filterStories(
  briefings: DailyBriefing[],
  options: FilterOptions = {}
): AIStory[] {
  const companyFilter = options.company?.trim().toLowerCase();
  const queryFilter = options.query?.trim().toLowerCase();
  const dateFilter = options.date?.trim();

  const allStories = briefings.flatMap((b) => b.stories);

  return allStories.filter((story) => {
    if (dateFilter && story.date !== dateFilter) {
      return false;
    }

    if (companyFilter && companyFilter !== 'all') {
      const hasCompany = story.companies.some(
        (c) => c.toLowerCase() === companyFilter
      );
      if (!hasCompany) {
        return false;
      }
    }

    if (queryFilter) {
      const haystack = `${story.title} ${story.summary} ${story.whyItMatters} ${story.companies.join(' ')}`.toLowerCase();
      if (!haystack.includes(queryFilter)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Computes aggregate statistics across all parsed briefings.
 */
export function computeDigestStats(briefings: DailyBriefing[]): DigestStats {
  const storiesByCompany: Record<CompanyTag, number> = {
    OpenAI: 0,
    Anthropic: 0,
    Google: 0,
    Apple: 0,
    Meta: 0,
    Microsoft: 0,
  };

  let totalStories = 0;

  for (const briefing of briefings) {
    for (const story of briefing.stories) {
      totalStories++;
      for (const company of story.companies) {
        storiesByCompany[company] = (storiesByCompany[company] ?? 0) + 1;
      }
    }
  }

  return {
    totalDays: briefings.length,
    totalStories,
    latestDate: briefings.length > 0 ? briefings[0].date : null,
    storiesByCompany,
  };
}

/**
 * Prepends a new DailyBriefing at the top of existing AI_DIGEST.md content,
 * replacing the section if the exact same date already exists.
 */
export function prependBriefingToMarkdown(
  existingMarkdown: string,
  newBriefing: DailyBriefing
): string {
  const formattedSection = formatDailyBriefing(newBriefing);
  const trimmed = existingMarkdown.trim();

  if (!trimmed) {
    return `${DEFAULT_HEADER}\n${formattedSection}\n`;
  }

  const firstDayIdx = existingMarkdown.search(/^##\s+\d{4}-\d{2}-\d{2}\s+/m);
  if (firstDayIdx === -1) {
    return `${trimmed}\n\n${formattedSection}\n`;
  }

  const headerPart = existingMarkdown.slice(0, firstDayIdx).trimEnd();
  const existingDays = parseDigestMarkdown(existingMarkdown);
  const remainingDays = existingDays.filter((d) => d.date !== newBriefing.date);

  const allSections = [
    formattedSection,
    ...remainingDays.map((d) => formatDailyBriefing(d)),
  ].join('\n\n---\n\n');

  return `${headerPart}\n\n${allSections}\n`;
}

/**
 * High-level service class for reading and updating an AI_DIGEST.md file on disk.
 */
export class DigestRepository {
  constructor(private readonly filePath: string) {}

  async loadBriefings(): Promise<DailyBriefing[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      return parseDigestMarkdown(content);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async prependBriefing(briefing: DailyBriefing): Promise<void> {
    let existing = '';
    try {
      existing = await fs.readFile(this.filePath, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    const updated = prependBriefingToMarkdown(existing, briefing);
    await fs.writeFile(this.filePath, updated, 'utf8');
  }
}

export { TRACKED_COMPANIES };
