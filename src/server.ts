import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkStoryDuplicate,
  computeDigestStats,
  DigestRepository,
  filterStories,
} from './digestManager.js';
import { renderDashboardHtml } from './ui.js';

export interface ServerConfig {
  digestFilePath?: string;
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
  const repo = new DigestRepository(digestPath);

  return http.createServer(async (req, res) => {
    try {
      const host = req.headers.host ?? 'localhost';
      const url = new URL(req.url ?? '/', `http://${host}`);

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { status: 'ok' });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/digests') {
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
  const server = createAppServer();
  server.listen(port, () => {
    console.log(`Daily AI Research Digest server running at http://localhost:${port}`);
  });
}
