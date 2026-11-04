import { DailyBriefing, DigestStats, TRACKED_COMPANIES } from './types.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderDashboardHtml(
  briefings: DailyBriefing[],
  stats: DigestStats
): string {
  const payload = JSON.stringify({ briefings, stats }).replace(/</g, '\\u003c');

  const companyButtonsHtml = ['All', ...TRACKED_COMPANIES]
    .map((company) => {
      const count =
        company === 'All'
          ? stats.totalStories
          : (stats.storiesByCompany[company as keyof typeof stats.storiesByCompany] ?? 0);
      const activeClass = company === 'All' ? 'active' : '';
      return `<button class="chip ${activeClass}" data-company="${escapeHtml(company)}">
        <span>${escapeHtml(company)}</span>
        <span class="chip-count">${count}</span>
      </button>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily AI Research Digest — Frontier Intelligence Briefing</title>
  <style>
    :root {
      --bg: #0b0f19;
      --surface: #131b2e;
      --surface-hover: #1a2540;
      --border: #243252;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --accent-soft: rgba(56, 189, 248, 0.14);
      --why-bg: rgba(99, 102, 241, 0.12);
      --why-border: #6366f1;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
      background: radial-gradient(circle at top, #131d38 0%, var(--bg) 55%);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.6;
    }
    .container {
      max-width: 1040px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem 4rem;
    }
    header {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 2rem;
      padding-bottom: 1.75rem;
      border-bottom: 1px solid var(--border);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--accent);
      font-size: 0.82rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    h1 {
      font-size: 2.2rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .subtitle {
      color: var(--muted);
      max-width: 720px;
      font-size: 1rem;
    }
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1.75rem;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem 1.25rem;
    }
    .stat-label {
      color: var(--muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      margin-top: 0.25rem;
      color: #f8fafc;
    }
    .controls {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .search-input {
      width: 100%;
      padding: 0.85rem 1.1rem;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .search-input:focus {
      border-color: var(--accent);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.42rem 0.9rem;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .chip:hover {
      background: var(--surface-hover);
      border-color: var(--accent);
    }
    .chip.active {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent);
    }
    .chip-count {
      font-size: 0.75rem;
      background: rgba(255, 255, 255, 0.08);
      padding: 0.1rem 0.45rem;
      border-radius: 999px;
    }
    .day-section {
      margin-bottom: 2.5rem;
    }
    .day-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }
    .day-title {
      font-size: 1.3rem;
      font-weight: 650;
      color: #f8fafc;
    }
    .story-list {
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
    }
    .story-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.4rem 1.5rem;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .story-card:hover {
      border-color: #3b5284;
    }
    .story-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }
    .story-title {
      font-size: 1.12rem;
      font-weight: 650;
      color: #f8fafc;
    }
    .story-rank {
      display: inline-block;
      color: var(--accent);
      margin-right: 0.4rem;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      flex-shrink: 0;
    }
    .badge {
      font-size: 0.73rem;
      font-weight: 600;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      background: rgba(56, 189, 248, 0.13);
      color: #7dd3fc;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .story-summary {
      color: var(--text);
      margin-bottom: 0.9rem;
      font-size: 0.96rem;
    }
    .why-box {
      background: var(--why-bg);
      border-left: 3px solid var(--why-border);
      padding: 0.75rem 1rem;
      border-radius: 0 8px 8px 0;
      margin-bottom: 1rem;
      font-size: 0.92rem;
    }
    .why-label {
      font-weight: 600;
      color: #a5b4fc;
      margin-right: 0.35rem;
    }
    .sources {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .source-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.82rem;
      color: var(--accent);
      text-decoration: none;
      padding: 0.28rem 0.7rem;
      border-radius: 6px;
      background: rgba(56, 189, 248, 0.08);
      border: 1px solid rgba(56, 189, 248, 0.22);
    }
    .source-link:hover {
      background: rgba(56, 189, 248, 0.18);
    }
    .empty-state {
      text-align: center;
      padding: 3rem 1.5rem;
      color: var(--muted);
      background: var(--surface);
      border: 1px dashed var(--border);
      border-radius: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="eyebrow">Automated Frontier AI Research Agent • Skopje (CET/CEST)</div>
      <h1>Daily AI News Digest</h1>
      <p class="subtitle">
        Curated daily briefing of the 5 most important AI launches, frontier models, and research breakthroughs across OpenAI, Anthropic, Google, Apple, Meta, and Microsoft.
      </p>
    </header>

    <section class="stats-bar">
      <div class="stat-card">
        <div class="stat-label">Total Briefings</div>
        <div class="stat-value">${stats.totalDays}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Curated Stories</div>
        <div class="stat-value">${stats.totalStories}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Latest Edition</div>
        <div class="stat-value">${escapeHtml(stats.latestDate ?? 'N/A')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Schedule</div>
        <div class="stat-value">09:00 Skopje</div>
      </div>
    </section>

    <section class="controls">
      <input
        id="searchInput"
        class="search-input"
        type="search"
        placeholder="Search models, announcements, research papers, or companies (e.g., Gemini 4, GPT-6, robots.txt)..."
      />
      <div class="chips" id="companyChips">
        ${companyButtonsHtml}
      </div>
    </section>

    <main id="digestContainer"></main>
  </div>

  <script>
    const DATA = ${payload};
    let activeCompany = 'All';
    let searchQuery = '';

    const container = document.getElementById('digestContainer');
    const searchInput = document.getElementById('searchInput');
    const chipButtons = document.querySelectorAll('.chip');

    function escapeClientHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function render() {
      const query = searchQuery.trim().toLowerCase();
      const sectionsHtml = [];

      for (const day of DATA.briefings) {
        const filteredStories = day.stories.filter((story) => {
          if (activeCompany !== 'All' && !story.companies.includes(activeCompany)) {
            return false;
          }
          if (query) {
            const haystack = (
              story.title + ' ' +
              story.summary + ' ' +
              story.whyItMatters + ' ' +
              story.companies.join(' ')
            ).toLowerCase();
            return haystack.includes(query);
          }
          return true;
        });

        if (filteredStories.length === 0) continue;

        const storiesCards = filteredStories.map((story) => {
          const badges = story.companies
            .map((c) => '<span class="badge">' + escapeClientHtml(c) + '</span>')
            .join('');
          const sources = story.sources
            .map(
              (s) =>
                '<a class="source-link" href="' +
                escapeClientHtml(s.url) +
                '" target="_blank" rel="noopener noreferrer">' +
                escapeClientHtml(s.label) +
                ' ↗</a>'
            )
            .join('');

          return (
            '<article class="story-card">' +
              '<div class="story-top">' +
                '<h3 class="story-title"><span class="story-rank">#' + story.rank + '</span>' +
                  escapeClientHtml(story.title) +
                '</h3>' +
                '<div class="badges">' + badges + '</div>' +
              '</div>' +
              '<p class="story-summary">' + escapeClientHtml(story.summary) + '</p>' +
              '<div class="why-box">' +
                '<span class="why-label">Why It Matters:</span>' +
                escapeClientHtml(story.whyItMatters) +
              '</div>' +
              '<div class="sources">' + sources + '</div>' +
            '</article>'
          );
        }).join('');

        sectionsHtml.push(
          '<section class="day-section">' +
            '<div class="day-header">' +
              '<h2 class="day-title">' + escapeClientHtml(day.date + ' — ' + day.heading) + '</h2>' +
            '</div>' +
            '<div class="story-list">' + storiesCards + '</div>' +
          '</section>'
        );
      }

      if (sectionsHtml.length === 0) {
        container.innerHTML = '<div class="empty-state">No AI stories matched your filter criteria.</div>';
      } else {
        container.innerHTML = sectionsHtml.join('');
      }
    }

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
    });

    chipButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        chipButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeCompany = btn.getAttribute('data-company') || 'All';
        render();
      });
    });

    render();
  </script>
</body>
</html>`;
}
