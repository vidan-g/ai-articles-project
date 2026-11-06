import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkStoryDuplicate,
  computeDigestStats,
  DigestRepository,
  filterStories,
} from './digestManager.js';
import { ensureTodayBriefing, getLocalDateString } from './scanner.js';
import { renderDashboardHtml } from './ui.js';

export interface ServerConfig {
  digestFilePath?: string;
  staticHtmlPath?: string;
  autoScanOnVisit?: boolean;
}

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(data, null, 2));
}

export function createAppServer(config: ServerConfig = {}): http.Server {
  const digestPath =
    config.digestFilePath ?? path.resolve(process.cwd(), 'AI_DIGEST.md');
  const staticHtmlPath =
    config.staticHtmlPath ?? path.resolve(process.cwd(), 'docs/index.html');
  const autoScanOnVisit = config.autoScanOnVisit ?? false;
  const repo = new DigestRepository(digestPath);

  let activeScanPromise: Promise<unknown> | null = null;

  async function syncStaticDashboard(): Promise<void> {
    try {
      const briefings = await repo.loadBriefings();
      const stats = computeDigestStats(briefings);
      const html = renderDashboardHtml(briefings, stats);
      await fs.mkdir(path.dirname(staticHtmlPath), { recursive: true });
      await fs.writeFile(staticHtmlPath, html, 'utf8');
    } catch {
      // Ignore static export errors in read-only environments
    }
  }

  async function maybeScanForToday(force = false) {
    if (activeScanPromise) {
      return activeScanPromise;
    }
    activeScanPromise = ensureTodayBriefing(repo, {
      force,
      onUpdated: syncStaticDashboard,
    }).finally(() => {
      activeScanPromise = null;
    });
    return activeScanPromise;
  }

  return http.createServer(async (req, res) => {
    try {
      const host = req.headers.host ?? 'localhost';
      const url = new URL(req.url ?? '/', `http://${host}`);

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, {
          status: 'ok',
          today: getLocalDateString(),
        });
        return;
      }

      if ((req.method === 'POST' || req.method === 'GET') && url.pathname === '/api/scan') {
        const force = url.searchParams.get('force') === 'true';
        const result = await maybeScanForToday(force);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/digests') {
        if (autoScanOnVisit) {
          await maybeScanForToday(false);
        }
        const briefings = await repo.loadBriefings();
        sendJson(res, 200, { briefings });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/stories') {
        const briefings = await repo.loadBriefings();
        const company = url.searchParams.get('company') ?? undefined;
        const query = url.searchParams.get('q') ?? undefined;
        const date = url.searchParams.get('date') ?? undefined;

        const stories = filterStories(briefings, { company, query, date });
        sendJson(res, 200, { count: stories.length, stories });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/stats') {
        const briefings = await repo.loadBriefings();
        const stats = computeDigestStats(briefings);
        sendJson(res, 200, stats);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/check-duplicate') {
        const title = url.searchParams.get('title') ?? '';
        const sourceUrl = url.searchParams.get('url');
        if (!title.trim()) {
          sendJson(res, 400, { error: 'Missing required "title" query parameter' });
          return;
        }
        const briefings = await repo.loadBriefings();
        const result = checkStoryDuplicate(
          briefings,
          title,
          sourceUrl ? [sourceUrl] : []
        );
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        if (autoScanOnVisit) {
          await maybeScanForToday(false);
        }
        const briefings = await repo.loadBriefings();
        const stats = computeDigestStats(briefings);
        const html = renderDashboardHtml(briefings, stats);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Internal Server Error',
      });
    }
  });
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const port = Number(process.env.PORT ?? 3000);
  const digestPath = path.resolve(process.cwd(), 'AI_DIGEST.md');
  const staticHtmlPath = path.resolve(process.cwd(), 'docs/index.html');
  const repo = new DigestRepository(digestPath);

  const server = createAppServer({
    digestFilePath: digestPath,
    staticHtmlPath,
    autoScanOnVisit: true,
  });

  async function runBackgroundCheck(): Promise<void> {
    try {
      const result = await ensureTodayBriefing(repo, {
        onUpdated: async () => {
          const briefings = await repo.loadBriefings();
          const stats = computeDigestStats(briefings);
          const html = renderDashboardHtml(briefings, stats);
          await fs.mkdir(path.dirname(staticHtmlPath), { recursive: true });
          await fs.writeFile(staticHtmlPath, html, 'utf8');
        },
      });
      if (result.scanned) {
        console.log(`[AutoScanner] ${result.reason}`);
      }
    } catch (err) {
      console.error('[AutoScanner] Background scan failed:', err);
    }
  }

  server.listen(port, () => {
    console.log(`Daily AI Research Digest server running at http://localhost:${port}`);
    // Run an immediate check when the server starts on the Mac
    void runBackgroundCheck();
    // Re-check every 15 minutes whenever the Mac is running/awake
    setInterval(() => {
      void runBackgroundCheck();
    }, 15 * 60 * 1000);
  });
}
