import { describe, expect, it } from "vitest";

import script from "../ops/product-metrics.ps1?raw";
import sql from "../ops/product-metrics.sql?raw";

describe("metrics", () => {
  it("covers exposure through completion without exposing content", () => {
    for (const event of [
      "visited",
      "practice_created",
      "practice_shared",
      "lesson_opened",
      "attempt_started",
      "attempt_completed",
      "owner_checked",
      "returned",
    ]) {
      expect(sql).toContain(`name = '${event}'`);
    }
    expect(script).toContain('service = "uchigraph"');
    expect(script).toContain("start_to_complete_percent");
    expect(sql).not.toContain("task_text");
    expect(sql).not.toContain("learner_code AS");
  });
});
