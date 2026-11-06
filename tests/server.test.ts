import path from 'node:path';
import { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppServer } from '../src/server.js';

describe('HTTP Server & REST API', () => {
  const server = createAppServer({
    digestFilePath: path.resolve(process.cwd(), 'AI_DIGEST.md'),
  });
  let baseUrl = '';

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('GET /health returns status ok and current date', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('GET / renders the HTML dashboard', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Daily AI News Digest');
    expect(html).toContain('Gemini 4 Carbon');
    expect(html).toContain('Scan New Articles');
  });

  it('GET /api/stats returns digest statistics', async () => {
    const res = await fetch(`${baseUrl}/api/stats`);
    expect(res.status).toBe(200);
    const stats = await res.json();
    expect(stats.totalDays).toBeGreaterThanOrEqual(1);
    expect(stats.totalStories).toBeGreaterThanOrEqual(5);
    expect(stats.storiesByCompany.OpenAI).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/stories filters by company and query', async () => {
    const res = await fetch(`${baseUrl}/api/stories?company=Google&q=Carbon`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBeGreaterThanOrEqual(1);
    expect(data.stories[0].title).toContain('Gemini 4 Carbon');
  });

  it('GET /api/check-duplicate identifies duplicate headlines', async () => {
    const res = await fetch(
      `${baseUrl}/api/check-duplicate?title=${encodeURIComponent(
        'Google DeepMind Expands Gemini 4 Frontier Lineup with Gemini 4 Carbon'
      )}`
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isDuplicate).toBe(true);
  });
});
