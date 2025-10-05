import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lists repositories under the OpenLibrary GitHub org.
 * Optional query params:
 *  - per_page (default 100)
 *  - page (default 1)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const per_page = searchParams.get('per_page') || '100';
    const page = searchParams.get('page') || '1';

    const url = `https://api.github.com/orgs/openlibrary/repos?per_page=${encodeURIComponent(per_page)}&page=${encodeURIComponent(page)}`;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'carrot-app',
    };
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { ok: false, error: `GitHub API error ${res.status}`, body: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    // Map to a lightweight shape we can index later
    const repos = (data as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      html_url: r.html_url,
      description: r.description,
      topics: r.topics,
      language: r.language,
      archived: r.archived,
      pushed_at: r.pushed_at,
      stargazers_count: r.stargazers_count,
      forks_count: r.forks_count,
      open_issues_count: r.open_issues_count,
    }));

    return NextResponse.json({ ok: true, repos });
  } catch (err) {
    console.error('OpenLibrary repos error', err);
    return NextResponse.json({ ok: false, error: 'Failed to fetch repos' }, { status: 500 });
  }
}
