export const TRACKED_COMPANIES = [
  'OpenAI',
  'Anthropic',
  'Google',
  'Apple',
  'Meta',
  'Microsoft',
] as const;

export type CompanyTag = (typeof TRACKED_COMPANIES)[number];

export interface SourceLink {
  label: string;
  url: string;
}

export interface AIStory {
  rank: number;
  title: string;
  summary: string;
  whyItMatters: string;
  sources: SourceLink[];
  companies: CompanyTag[];
  date: string;
}

export interface DailyBriefing {
  date: string;
  heading: string;
  stories: AIStory[];
}

export interface FilterOptions {
  company?: string;
  query?: string;
  date?: string;
}

export interface DigestStats {
  totalDays: number;
  totalStories: number;
  latestDate: string | null;
  storiesByCompany: Record<CompanyTag, number>;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  matchedStory?: {
    title: string;
    date: string;
    similarity: number;
  };
}
