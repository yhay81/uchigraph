import { describe, expect, it } from "vitest";

import builder from "../public/builder.js?raw";
import common from "../public/common.js?raw";
import owner from "../public/owner.js?raw";
import practice from "../public/practice.js?raw";

describe("client safety and behavior", () => {
  it("uses DOM text APIs instead of HTML injection", () => {
    for (const script of [builder, common, owner, practice]) {
      expect(script).not.toContain("innerHTML");
      expect(script).not.toContain("insertAdjacentHTML");
      expect(script).not.toContain("document.write");
    }
    expect(owner).toContain("textContent");
    expect(practice).toContain("replaceChildren");
  });

  it("supports IME composition and exact completion", () => {
    expect(practice).toContain('"compositionstart"');
    expect(practice).toContain('"compositionend"');
    expect(practice).toContain("value === target");
    expect(practice).toContain("completedText: target");
  });

  it("keeps owner tokens in the URL fragment and requires anonymous codes", () => {
    expect(owner).toContain("location.hash.slice(1)");
    expect(owner).not.toContain("location.search");
    expect(practice).toContain("^[A-Z0-9][A-Z0-9_-]{1,11}$");
    expect(practice).toContain("attempt_started");
  });
});
