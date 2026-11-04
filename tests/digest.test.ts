import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  extractCompanyTags,
  formatDailyBriefing,
  parseDigestMarkdown,
} from '../src/parser.js';
import {
  checkStoryDuplicate,
  computeDigestStats,
  computeTitleSimilarity,
  filterStories,
  prependBriefingToMarkdown,
} from '../src/digestManager.js';
import { DailyBriefing } from '../src/types.js';

const SAMPLE_BRIEFING: DailyBriefing = {
  date: '2026-11-04',
  heading: 'Daily AI Briefing',
  stories: [
    {
      rank: 1,
      title: 'OpenAI and Anthropic Back Unified AI Training Opt-Out Standard',
      summary: 'OpenAI, Google, Microsoft, and Anthropic announced support for __usage_ai-training in robots.txt.',
      whyItMatters: 'Establishes a single governance standard for web publishers.',
      sources: [
        { label: 'Official Spec', url: 'https://example.com/ietf-ai-opt-out' },
      ],
      companies: ['OpenAI', 'Anthropic', 'Google', 'Microsoft'],
      date: '2026-11-04',
    },
    {
      rank: 2,
      title: 'Google DeepMind Unveils Gemini 4 Carbon for Long-Horizon Tasks',
      summary: 'Google launched Gemini 4 Carbon with enhanced multimodal and cybersecurity capabilities.',
      whyItMatters: 'Advances autonomous multi-step execution and vulnerability analysis.',
      sources: [
        { label: 'DeepMind Blog', url: 'https://example.com/gemini-4-carbon' },
      ],
      companies: ['Google'],
      date: '2026-11-04',
    },
  ],
};

describe('Parser & Company Tag Extraction', () => {
  it('extracts major AI company tags from text', () => {
    const tags = extractCompanyTags(
      'OpenAI GPT-6 Astra, Anthropic Claude 5.5, Google Gemini 4, Meta Llama, Apple Siri, and Microsoft Azure'
    );
    expect(tags).toEqual([
      'OpenAI',
      'Anthropic',
      'Google',
      'Apple',
      'Meta',
      'Microsoft',
    ]);
  });

  it('parses real AI_DIGEST.md into 5 structured stories with sources', async () => {
    const markdown = await fs.readFile(
      path.resolve(process.cwd(), 'AI_DIGEST.md'),
      'utf8'
    );
    const briefings = parseDigestMarkdown(markdown);

    expect(briefings.length).toBeGreaterThanOrEqual(1);
    const latest = briefings[0];
    expect(latest.date).toBe('2026-11-04');
    expect(latest.stories).toHaveLength(5);

    for (const story of latest.stories) {
      expect(story.title.length).toBeGreaterThan(10);
      expect(story.summary.length).toBeGreaterThan(20);
      expect(story.whyItMatters.length).toBeGreaterThan(20);
      expect(story.sources.length).toBeGreaterThanOrEqual(1);
      expect(story.companies.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('round-trips a DailyBriefing through formatDailyBriefing and parseDigestMarkdown', () => {
    const markdown = formatDailyBriefing(SAMPLE_BRIEFING);
    const parsed = parseDigestMarkdown(markdown);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].date).toBe('2026-11-04');
    expect(parsed[0].stories).toHaveLength(2);
    expect(parsed[0].stories[0].title).toBe(SAMPLE_BRIEFING.stories[0].title);
    expect(parsed[0].stories[1].sources[0].url).toBe(
      'https://example.com/gemini-4-carbon'
    );
  });
});

describe('Deduplication, Filtering, Stats & Prepending', () => {
  it('detects duplicate stories by title similarity and URL match', () => {
    const sim = computeTitleSimilarity(
      'Google DeepMind Unveils Gemini 4 Carbon for Long-Horizon Tasks',
      'Google DeepMind Unveils Gemini 4 Carbon Model for Long-Horizon Tasks'
    );
    expect(sim).toBeGreaterThan(0.7);

    const byTitle = checkStoryDuplicate(
      [SAMPLE_BRIEFING],
      'Google DeepMind Unveils Gemini 4 Carbon Model for Long-Horizon Tasks'
    );
    expect(byTitle.isDuplicate).toBe(true);
    expect(byTitle.matchedStory?.date).toBe('2026-11-04');

    const byUrl = checkStoryDuplicate(
      [SAMPLE_BRIEFING],
      'Completely Different Headline',
      ['https://example.com/ietf-ai-opt-out/']
    );
    expect(byUrl.isDuplicate).toBe(true);

    const freshStory = checkStoryDuplicate(
      [SAMPLE_BRIEFING],
      'Apple Announces On-Device Neural Engine SDK for macOS'
    );
    expect(freshStory.isDuplicate).toBe(false);
  });

  it('filters stories by company and search query and computes stats', () => {
    const anthropicStories = filterStories([SAMPLE_BRIEFING], {
      company: 'Anthropic',
    });
    expect(anthropicStories).toHaveLength(1);

    const carbonStories = filterStories([SAMPLE_BRIEFING], {
      query: 'cybersecurity',
    });
    expect(carbonStories).toHaveLength(1);
    expect(carbonStories[0].rank).toBe(2);

    const stats = computeDigestStats([SAMPLE_BRIEFING]);
    expect(stats.totalDays).toBe(1);
    expect(stats.totalStories).toBe(2);
    expect(stats.storiesByCompany.Google).toBe(2);
    expect(stats.storiesByCompany.OpenAI).toBe(1);
  });

  it('prepends newer daily briefings at the top while preserving older days', () => {
    const initialMd = prependBriefingToMarkdown('', SAMPLE_BRIEFING);
    const nextDayBriefing: DailyBriefing = {
      date: '2026-11-05',
      heading: 'Daily AI Briefing',
      stories: [
        {
          rank: 1,
          title: 'Apple Introduces New CoreML Foundation Model APIs',
          summary: 'Apple released updated on-device inference APIs for developers.',
          whyItMatters: 'Expands local privacy-preserving AI across iOS and macOS.',
          sources: [{ label: 'Apple Developer', url: 'https://developer.apple.com' }],
          companies: ['Apple'],
          date: '2026-11-05',
        },
      ],
    };

    const updatedMd = prependBriefingToMarkdown(initialMd, nextDayBriefing);
    const parsed = parseDigestMarkdown(updatedMd);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].date).toBe('2026-11-05');
    expect(parsed[1].date).toBe('2026-11-04');
  });
});
