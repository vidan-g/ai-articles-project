import {
  AIStory,
  CompanyTag,
  DailyBriefing,
  SourceLink,
  TRACKED_COMPANIES,
} from './types.js';

const COMPANY_PATTERNS: Record<CompanyTag, RegExp> = {
  OpenAI: /\b(openai|gpt-\d+|chatgpt|sora|o1|o3|o4)\b/i,
  Anthropic: /\b(anthropic|claude)\b/i,
  Google: /\b(google|deepmind|gemini|alphabet|vertex\s+ai)\b/i,
  Apple: /\b(apple|siri|apple\s+intelligence|core\s*ml)\b/i,
  Meta: /\b(meta|llama|muse\s+spark|fair)\b/i,
  Microsoft: /\b(microsoft|azure|copilot|imagine\s+cup|maia)\b/i,
};

/**
 * Detects which tracked AI companies are mentioned in a story's title or summary.
 */
export function extractCompanyTags(text: string): CompanyTag[] {
  return TRACKED_COMPANIES.filter((company) => COMPANY_PATTERNS[company].test(text));
}

/**
 * Parses the full AI_DIGEST.md markdown content into structured DailyBriefing objects.
 */
export function parseDigestMarkdown(markdown: string): DailyBriefing[] {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const dayHeadingRegex = /^##\s+(\d{4}-\d{2}-\d{2})\s*(?:—|--|-)\s*(.+)$/gm;

  const matches = Array.from(normalized.matchAll(dayHeadingRegex));
  if (matches.length === 0) {
    return [];
  }

  const briefings: DailyBriefing[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const date = match[1].trim();
    const heading = match[2].trim();
    const startIdx = (match.index ?? 0) + match[0].length;
    const endIdx = i + 1 < matches.length ? (matches[i + 1].index ?? normalized.length) : normalized.length;
    const sectionBody = normalized.slice(startIdx, endIdx);

    const stories = parseStoriesFromSection(sectionBody, date);
    briefings.push({
      date,
      heading,
      stories,
    });
  }

  return briefings;
}

function parseStoriesFromSection(section: string, date: string): AIStory[] {
  const storyHeadingRegex = /^###\s+(\d+)\.\s+(.+)$/gm;
  const matches = Array.from(section.matchAll(storyHeadingRegex));
  const stories: AIStory[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const rank = Number.parseInt(match[1], 10);
    const title = match[2].trim();
    const startIdx = (match.index ?? 0) + match[0].length;
    const endIdx = i + 1 < matches.length ? (matches[i + 1].index ?? section.length) : section.length;
    const storyBlock = section.slice(startIdx, endIdx);

    const summaryMatch = storyBlock.match(/-\s+\*\*Summary:\*\*\s+(.+)/);
    const whyMatch = storyBlock.match(/-\s+\*\*Why It Matters:\*\*\s+(.+)/);

    const summary = summaryMatch ? summaryMatch[1].trim() : '';
    const whyItMatters = whyMatch ? whyMatch[1].trim() : '';

    const sources: SourceLink[] = [];
    const sourceRegex = /^\s+-\s+\[([^\]]+)\]\(([^)]+)\)/gm;
    for (const sourceMatch of storyBlock.matchAll(sourceRegex)) {
      sources.push({
        label: sourceMatch[1].trim(),
        url: sourceMatch[2].trim(),
      });
    }

    const companies = extractCompanyTags(`${title} ${summary} ${whyItMatters}`);

    stories.push({
      rank,
      title,
      summary,
      whyItMatters,
      sources,
      companies,
      date,
    });
  }

  return stories;
}

/**
 * Formats a DailyBriefing object into Markdown matching the AI_DIGEST.md specification.
 */
export function formatDailyBriefing(briefing: DailyBriefing): string {
  const lines: string[] = [];
  lines.push(`## ${briefing.date} — ${briefing.heading}`);
  lines.push('');

  briefing.stories.forEach((story, idx) => {
    const rank = story.rank || idx + 1;
    lines.push(`### ${rank}. ${story.title}`);
    lines.push(`- **Summary:** ${story.summary}`);
    lines.push(`- **Why It Matters:** ${story.whyItMatters}`);
    lines.push('- **Sources:**');
    for (const src of story.sources) {
      lines.push(`  - [${src.label}](${src.url})`);
    }
    if (idx < briefing.stories.length - 1) {
      lines.push('');
    }
  });

  return lines.join('\n');
}
