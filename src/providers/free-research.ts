import type { ProviderHealth, ResearchProvider, ResearchRequest, ResearchResult, ResearchSource } from "./types";

type SearchHit = { title: string; url: string; snippet: string };

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim());
}

function unwrap(url: string): string {
  try {
    const parsed = new URL(url, "https://duckduckgo.com/");
    const target = parsed.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : parsed.toString();
  } catch {
    return url;
  }
}

function parseResults(html: string, maxResults: number): SearchHit[] {
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  const regex = new RegExp(
    '<div[^>]*class="[^"]*result[^"]*"[^>]*>[\\s\\S]*?<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\\s\\S]*?)</a>[\\s\\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\\s\\S]*?)</a>',
    "gi",
  );

  for (const match of html.matchAll(regex)) {
    const url = unwrap(decodeHtml(match[1] ?? ""));
    const title = stripTags(match[2] ?? "");
    const snippet = stripTags(match[3] ?? "");
    if (!title || !url || seen.has(url)) continue;
    seen.add(url);
    hits.push({ title, url, snippet });
    if (hits.length >= maxResults) break;
  }

  return hits;
}

async function extractPage(url: string): Promise<{ ok: boolean; text: string; publishedAt?: string }> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported research URL.");

  const response = await fetch(parsed.toString(), {
    headers: { "user-agent": "BUSIQ-Research/1.0", accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return { ok: false, text: "" };

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    return { ok: false, text: "" };
  }

  const html = (await response.text()).slice(0, 500_000);
  const title = stripTags(new RegExp("<title[^>]*>([\\s\\S]*?)</title>", "i").exec(html)?.[1] ?? "");
  const paragraphRegex = new RegExp("<p[^>]*>([\\s\\S]*?)</p>", "gi");
  const paragraphs = [...html.matchAll(paragraphRegex)]
    .map((match) => stripTags(match[1] ?? ""))
    .filter((text) => text.length > 40)
    .slice(0, 12);

  return {
    ok: true,
    text: [title, ...paragraphs].join("\n").slice(0, 12_000),
  };
}

export class FreeWebResearchProvider implements ResearchProvider {
  async search(request: ResearchRequest): Promise<ResearchResult> {
    const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(request.query);
    const response = await fetch(url, {
      headers: { "user-agent": "BUSIQ-Research/1.0", accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error("Free web research provider returned HTTP " + response.status + ".");
    }

    const hits = parseResults(await response.text(), 5);
    const sources: ResearchSource[] = [];
    const claims: ResearchResult["claims"] = [];

    for (const hit of hits) {
      try {
        const page = await extractPage(hit.url);
        if (!page.ok) continue;
        const id = "web-" + crypto.randomUUID();
        sources.push({
          id,
          title: hit.title,
          url: hit.url,
          retrievedAt: new Date().toISOString(),
          authority: /.(gov|gov\\.[a-z]{2}|edu|int|who\\.int)$/i.test(new URL(hit.url).hostname) ? "primary" : "secondary",
        });
        const statement = page.text || hit.snippet;
        if (statement) claims.push({ statement: statement.slice(0, 1800), sourceIds: [id] });
      } catch {
        // One inaccessible source must not invalidate the entire research run.
      }
    }

    return { provider: "free-web", sources, claims };
  }

  async health(): Promise<ProviderHealth> {
    return {
      availability: "available",
      provider: "free-web",
      checkedAt: new Date().toISOString(),
      detail: "DuckDuckGo HTML search with server-side source extraction; no paid API key required.",
    };
  }
}

export function createFreeWebResearchProvider(): FreeWebResearchProvider {
  return new FreeWebResearchProvider();
}
