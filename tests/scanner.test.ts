import { describe, expect, it } from 'vitest';
import {
  parseRssOrAtomXml,
  RawFeedItem,
  scoreCandidateItem,
  selectTopFiveStories,
} from '../src/scanner.js';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>OpenAI News</title>
    <item>
      <title><![CDATA[OpenAI Announces New Frontier Reasoning Model and Developer API]]></title>
      <link>https://openai.com/index/new-frontier-reasoning-model</link>
      <description><![CDATA[OpenAI unveiled its latest frontier reasoning model designed for autonomous multi-step software engineering tasks.]]></description>
      <pubDate>Fri, 06 Nov 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe('Live AI Feed Scanner & Story Selector', () => {
  it('parses RSS 2.0 XML into normalized feed items', () => {
    const items = parseRssOrAtomXml(SAMPLE_RSS, 'OpenAI News');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe(
      'OpenAI Announces New Frontier Reasoning Model and Developer API'
    );
    expect(items[0].link).toBe(
      'https://openai.com/index/new-frontier-reasoning-model'
    );
  });

  it('scores major AI company model launches higher than unrelated or noisy items', () => {
    const now = new Date('2026-11-06T10:00:00Z');
    const highSignal: RawFeedItem = {
      title: 'Anthropic Launches New Claude Frontier Model for Autonomous Agents',
      link: 'https://anthropic.com/news/claude-launch',
      description: 'Major model release and research paper on agentic capabilities.',
      pubDate: '2026-11-06T07:00:00Z',
      sourceName: 'Primary Web Source',
    };
    const lowSignal: RawFeedItem = {
      title: 'Sponsored Podcast: Weekly Tech Deals and Discounts',
      link: 'https://example.com/deals',
      description: 'Save 20% on headphones.',
      pubDate: '2026-11-06T07:00:00Z',
      sourceName: 'Tech Blog',
    };

    expect(scoreCandidateItem(highSignal, now)).toBeGreaterThan(60);
    expect(scoreCandidateItem(lowSignal, now)).toBeLessThan(0);
  });

  it('selects up to 5 non-duplicate top stories', () => {
    const now = new Date('2026-11-06T10:00:00Z');
    const candidates: RawFeedItem[] = [
      {
        title: 'OpenAI Releases New GPT Reasoning Model for Autonomous Agents',
        link: 'https://openai.com/news/1',
        description: 'OpenAI launched a new frontier model with strong reasoning benchmarks.',
        pubDate: '2026-11-06T08:00:00Z',
        sourceName: 'OpenAI News',
      },
      {
        title: 'OpenAI Releases New GPT Reasoning Model for Autonomous Agents Today',
        link: 'https://techblog.example.com/openai-1',
        description: 'Duplicate coverage of the same OpenAI release.',
        pubDate: '2026-11-06T08:30:00Z',
        sourceName: 'TechCrunch AI',
      },
      {
        title: 'Google DeepMind Introduces New Gemini Multimodal Research Breakthrough',
        link: 'https://blog.google/ai/2',
        description: 'Google DeepMind unveiled new multimodal research for long-horizon tasks.',
        pubDate: '2026-11-06T07:30:00Z',
        sourceName: 'Google AI Blog',
      },
    ];

    const selected = selectTopFiveStories(candidates, [], '2026-11-06', now);
    expect(selected).toHaveLength(2);
    expect(selected[0].rank).toBe(1);
    expect(selected[1].rank).toBe(2);
  });
});

