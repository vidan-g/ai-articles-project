import fs from 'node:fs/promises';
import path from 'node:path';
import {
  checkStoryDuplicate,
  computeDigestStats,
  DigestRepository,
  filterStories,
} from './digestManager.js';
import { ensureTodayBriefing } from './scanner.js';
import { renderDashboardHtml } from './ui.js';

async function main(): Promise<void> {
  const [command = 'stats', ...rest] = process.argv.slice(2);
  const digestPath = path.resolve(process.cwd(), 'AI_DIGEST.md');
  const staticHtmlPath = path.resolve(process.cwd(), 'docs/index.html');
  const repo = new DigestRepository(digestPath);

  if (command === 'scan') {
    const force = rest.includes('--force');
    const result = await ensureTodayBriefing(repo, {
      force,
      onUpdated: async () => {
        const briefings = await repo.loadBriefings();
        const stats = computeDigestStats(briefings);
        const html = renderDashboardHtml(briefings, stats);
        await fs.mkdir(path.dirname(staticHtmlPath), { recursive: true });
        await fs.writeFile(staticHtmlPath, html, 'utf8');
      },
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const briefings = await repo.loadBriefings();

  if (command === 'stats') {
    const stats = computeDigestStats(briefings);
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  if (command === 'list') {
    const companyArg = rest.find((arg) => arg.startsWith('--company='))?.split('=')[1];
    const queryArg = rest.find((arg) => arg.startsWith('--q='))?.split('=')[1];
    const stories = filterStories(briefings, {
      company: companyArg,
      query: queryArg,
    });
    for (const story of stories) {
      console.log(
        `[${story.date}] #${story.rank} ${story.title} (${story.companies.join(', ')})`
      );
    }
    return;
  }

  if (command === 'check-duplicate') {
    const candidateTitle = rest.join(' ').trim();
    if (!candidateTitle) {
      console.error('Usage: npm run cli -- check-duplicate "<story title>"');
      process.exitCode = 1;
      return;
    }
    const result = checkStoryDuplicate(briefings, candidateTitle);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'export-html') {
    const outputPath = path.resolve(process.cwd(), rest[0] ?? 'docs/index.html');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const stats = computeDigestStats(briefings);
    const html = renderDashboardHtml(briefings, stats);
    await fs.writeFile(outputPath, html, 'utf8');
    console.log(`Exported static dashboard to ${outputPath}`);
    return;
  }

  console.error(
    `Unknown command "${command}". Available commands: scan, stats, list, check-duplicate, export-html`
  );
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
