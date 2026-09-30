import { describe, expect, it, vi } from "vitest";
import { createFreeWebResearchProvider } from "./free-research";

describe("FreeWebResearchProvider", () => {
  it("extracts and verifies reachable research sources", async () => {
    const html = `
      <div class="result">
        <a class="result__a" href="https://example.com/article">Example Article</a>
        <a class="result__snippet">Example research snippet.</a>
      </div>
    `;
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(html, { status: 200 }))
      .mockResolvedValueOnce(new Response("<html><title>Example</title><p>Verified page content with enough detail to be useful to the research pipeline.</p></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })));

    const result = await createFreeWebResearchProvider().search({
      query: "example research",
      intent: "investigate",
      entities: [],
    });

    expect(result.provider).toBe("free-web");
    expect(result.sources).toHaveLength(1);
    expect(result.claims).toHaveLength(1);
    expect(result.sources[0]?.url).toBe("https://example.com/article");
  });
});
