import { describe, expect, it } from "vitest";

import packageJson from "../package.json?raw";
import ogImage from "../public/og.png?raw";
import robots from "../public/robots.txt?raw";
import sitemap from "../public/sitemap.xml?raw";
import product from "../src/config/product.ts?raw";
import layout from "../src/ui/layout.tsx?raw";
import wrangler from "../wrangler.jsonc?raw";

describe("publishing contract", () => {
  it("uses the yhay81.com custom domain as the only production origin", () => {
    for (const content of [product, wrangler, packageJson, robots, sitemap]) {
      expect(content).toContain("uchigraph.yhay81.com");
      expect(content).not.toContain("yusuke8h.workers.dev");
    }
    expect(wrangler).toContain('"workers_dev": false');
    expect(wrangler).toContain('"custom_domain": true');
    expect(wrangler).toContain('"binding": "DB"');
  });

  it("keeps private lessons out of discovery surfaces", () => {
    expect(robots).toContain("Disallow: /p/");
    expect(robots).toContain("Disallow: /manage/");
    expect(robots).toContain("Disallow: /api/");
    expect(sitemap).toContain("/guide");
    expect(sitemap).toContain("/privacy");
    expect(sitemap).not.toContain("/p/");
    expect(sitemap).not.toContain("/manage/");
    expect(layout).toContain("noindex, nofollow, noarchive");
    expect(layout).toContain('property="og:image"');
    expect(layout).toContain("/og.png");
    expect(ogImage.length).toBeGreaterThan(100_000);
  });
});
