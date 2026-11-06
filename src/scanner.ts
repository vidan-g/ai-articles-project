import {
  AIStory,
  CompanyTag,
  DailyBriefing,
  TRACKED_COMPANIES,
} from './types.js';
import { extractCompanyTags } from './parser.js';
import { checkStoryDuplicate, DigestRepository } from './digestManager.js';

export interface RawFeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  sourceName: string;
  points?: number;
}

export interface FeedSource {
  name: string;
  url: string;
  type: 'rss' | 'hn-algolia';
}

export const DEFAULT_FEED_SOURCES: FeedSource[] = [
  {
    name: 'OpenAI News',
    url: 'https://openai.com/news/rss.xml',
    type: 'rss',
  },
  {
    name: 'Google AI Blog',
    url: 'https://blog.google/technology/ai/rss/',
    type: 'rss',
  },
  {
    name: 'Microsoft AI Blog',
    url: 'https://blogs.microsoft.com/ai/feed/',
    type: 'rss',
  },
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    type: 'rss',
  },
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    type: 'rss',
  },
  {
    name: 'Hacker News Top AI',
    url: 'https://hn.algolia.com/api/v1/search_by_date?query=OpenAI%20OR%20Anthropic%20OR%20Gemini%20OR%20Claude%20OR%20GPT%20OR%20Meta%20AI%20OR%20Apple%20AI%20OR%20Microsoft%20AI&tags=story&numericFilters=points%3E40&hitsPerPage=30',
    type: 'hn-algolia',
  },
];

const HIGH_SIGNAL_KEYWORDS = [
  { pattern: /\b(launch|launches|launched|unveil|unveils|introduce|introduces|release|releases|announces|announced)\b/i, weight: 18 },
  { pattern: /\b(model|frontier|gpt-\d|claude|gemini|llama|siri|copilot|agent|reasoning|multimodal|benchmark)\b/i, weight: 20 },
  { pattern: /\b(research|paper|breakthrough|open-source|open\s+weight|api|sdk|framework|security|safety)\b/i, weight: 14 },
];

const MINOR_NOISE_PATTERNS = /\b(sponsored|podcast|deals|discount|webinar|job\s+opening|hiring\s+now|opinion:|newsletter)\b/i;

function decodeXmlEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses an RSS 2.0 or Atom XML string into normalized RawFeedItems.
 */
export function parseRssOrAtomXml(xml: string, sourceName: string): RawFeedItem[] {
  const items: RawFeedItem[] = [];

  // Match RSS <item> or Atom <entry>
  const itemBlocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];

  for (const block of itemBlocks) {
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch =
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) ??
      block.match(/<link[^>]+href=["']([^"']+)["']/i);
    const descMatch =
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ??
      block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) ??
      block.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
    const dateMatch =
      block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i);

    const title = titleMatch ? decodeXmlEntities(titleMatch[1]) : '';
    const link = linkMatch ? decodeXmlEntities(linkMatch[1]) : '';
    const description = descMatch ? decodeXmlEntities(descMatch[1]) : '';
    const pubDate = dateMatch ? decodeXmlEntities(dateMatch[1]) : new Date().toISOString();

    if (title && link) {
      items.push({
        title,
        link,
        description,
        pubDate,
        sourceName,
      });
    }
  }

  return items;
}

/**
 * Computes an importance score for a candidate feed item based on major AI company mentions,
 * launch/model/research signals, recency, and community engagement.
 */
export function scoreCandidateItem(item: RawFeedItem, now = new Date()): number {
  const combined = `${item.title} ${item.description}`;
  if (MINOR_NOISE_PATTERNS.test(item.title)) {
    return -100;
  }

  const companies = extractCompanyTags(combined);
  let score = companies.length * 30;

  for (const kw of HIGH_SIGNAL_KEYWORDS) {
    if (kw.pattern.test(combined)) {
      score += kw.weight;
    }
  }

  // Official lab blogs get a primary-source authority boost
  if (/OpenAI|Google AI|Microsoft AI/i.test(item.sourceName)) {
    score += 25;
  }

  if (item.points && item.points > 0) {
    score += Math.min(30, Math.round(Math.log2(item.points) * 4));
  }

  const publishedMs = Date.parse(item.pubDate);
  if (!Number.isNaN(publishedMs)) {
    const ageHours = Math.max(0, (now.getTime() - publishedMs) / (1000 * 60 * 60));
    if (ageHours <= 24) {
      score += 25;
    } else if (ageHours <= 48) {
      score += 12;
    } else if (ageHours > 96) {
      score -= 30;
    }
  }

  return score;
}

/**
 * Generates a structured "Why It Matters" explanation tailored to the story's companies and themes.
 */
export function buildWhyItMatters(title: string, description: string, companies: CompanyTag[]): string {
  const text = `${title} ${description}`;
  const orgLabel = companies.length > 0 ? companies.join(', ') : 'Leading AI labs';

  if (/\b(open-source|open\s+weight|apache|mit\s+license)\b/i.test(text)) {
    return `${orgLabel} expanding open-weight and verifiable AI tooling lowers adoption barriers for enterprise and independent developers.`;
  }
  if (/\b(agent|autonomous|workflow|app\s+intents|computer-use)\b/i.test(text)) {
    return `Marks continued progress by ${orgLabel} from passive chat interfaces toward autonomous, multi-step agent execution across real-world software.`;
  }
  if (/\b(security|cyber|vulnerability|safety|alignment|prove|opt-out)\b/i.test(text)) {
    return `Strengthens AI safety, security, and governance standards across ${orgLabel} as frontier models gain deeper system and web access.`;
  }
  if (/\b(model|gpt|claude|gemini|llama|muse|reasoning|multimodal|token)\b/i.test(text)) {
    return `Advances frontier model capabilities from ${orgLabel}, intensifying competition in reasoning accuracy, context length, and inference efficiency.`;
  }
  return `Represents a notable product and research milestone from ${orgLabel} shaping the frontier AI ecosystem.`;
}

/**
 * Selects the top 5 non-duplicate stories from raw feed items.
 */
export function selectTopFiveStories(
  rawItems: RawFeedItem[],
  existingBriefings: DailyBriefing[],
  targetDate: string,
  now = new Date()
): AIStory[] {
  const scored = rawItems
    .map((item) => ({ item, score: scoreCandidateItem(item, now) }))
    .filter((entry) => entry.score > 20)
    .sort((a, b) => b.score - a.score);

  const selected: AIStory[] = [];
  const tempBriefings: DailyBriefing[] = [
    ...existingBriefings,
    { date: targetDate, heading: 'Daily AI Briefing', stories: selected },
  ];

  for (const { item } of scored) {
    if (selected.length >= 5) break;

    const dup = checkStoryDuplicate(tempBriefings, item.title, [item.link], 0.42);
    if (dup.isDuplicate) {
      continue;
    }

    const companies = extractCompanyTags(`${item.title} ${item.description}`);
    const cleanSummary =
      item.description && item.description.length > 25
        ? item.description.slice(0, 280) + (item.description.length > 280 ? '...' : '')
        : `${item.title} — reported via ${item.sourceName}.`;

    selected.push({
      rank: selected.length + 1,
      title: item.title,
      summary: cleanSummary,
      whyItMatters: buildWhyItMatters(item.title, item.description, companies),
      sources: [{ label: `${item.sourceName} Original Source`, url: item.link }],
      companies: companies.length > 0 ? companies : (['OpenAI'] as CompanyTag[]).slice(0, 0),
      date: targetDate,
    });
  }

  return selected;
}

/**
 * Formats a Date object as YYYY-MM-DD in the local machine timezone.
 */
export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetches live AI feeds across primary sources.
 */
export async function fetchLiveFeedItems(
  sources: FeedSource[] = DEFAULT_FEED_SOURCES,
  fetchFn: typeof fetch = fetch
): Promise<RawFeedItem[]> {
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetchFn(source.url, {
          headers: { 'User-Agent': 'DailyAIResearchDigest/1.0' },
          signal: controller.signal,
        });
        if (!res.ok) return [];

        if (source.type === 'hn-algolia') {
          const data = (await res.json()) as {
            hits?: Array<{
              title?: string;
              url?: string;
              created_at?: string;
              points?: number;
            }>;
          };
          return (data.hits ?? [])
            .filter((h) => Boolean(h.title && h.url))
            .map((h) => ({
              title: h.title!,
              link: h.url!,
              description: `${h.title!} (Featured AI story with ${h.points ?? 0} community points).`,
              pubDate: h.created_at ?? new Date().toISOString(),
              sourceName: 'Primary Web Source',
              points: h.points,
            }));
        }

        const xml = await res.text();
        return parseRssOrAtomXml(xml, source.name);
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  const allItems: RawFeedItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      allItems.push(...r.value);
    }
  }
  return allItems;
}

export interface ScanResult {
  date: string;
  scanned: boolean;
  reason: string;
  storiesAdded: number;
}

/**
 * Checks if today's briefing already exists in AI_DIGEST.md.
 * If missing (or if force=true), fetches live AI feeds, selects the top 5 non-duplicate stories,
 * and prepends today's briefing to AI_DIGEST.md.
 */
export async function ensureTodayBriefing(
  repo: DigestRepository,
  options: {
    force?: boolean;
    targetDate?: string;
    fetchFn?: typeof fetch;
    onUpdated?: () => Promise<void>;
  } = {}
): Promise<ScanResult> {
  const today = options.targetDate ?? getLocalDateString();
  const existingBriefings = await repo.loadBriefings();

  const alreadyHasToday = existingBriefings.some((b) => b.date === today);
  if (alreadyHasToday && !options.force) {
    return {
      date: today,
      scanned: false,
      reason: `Briefing for ${today} already exists`,
      storiesAdded: 0,
    };
  }

  const rawItems = await fetchLiveFeedItems(DEFAULT_FEED_SOURCES, options.fetchFn);
  const topStories = selectTopFiveStories(
    rawItems,
    existingBriefings.filter((b) => b.date !== today),
    today
  );

  if (topStories.length === 0) {
    return {
      date: today,
      scanned: true,
      reason: 'No qualifying new stories found from live feeds',
      storiesAdded: 0,
    };
  }

  const newBriefing: DailyBriefing = {
    date: today,
    heading: 'Daily AI Briefing',
    stories: topStories,
  };

  await repo.prependBriefing(newBriefing);
  if (options.onUpdated) {
    await options.onUpdated();
  }

  return {
    date: today,
    scanned: true,
    reason: `Generated and saved ${topStories.length} stories for ${today}`,
    storiesAdded: topStories.length,
  };
}

export { TRACKED_COMPANIES };
