import { describe, expect, it, vi } from "vitest";

import { countGraphemes } from "../src/text";
import { app, type Bindings, type PracticeRow } from "../src/worker";

type QueryArgs = unknown[];
type QueryHandlers = {
  all?: (sql: string, args: QueryArgs) => unknown;
  first?: (sql: string, args: QueryArgs) => unknown;
  run?: (sql: string, args: QueryArgs) => unknown;
};

function makeBindings(handlers: QueryHandlers = {}) {
  const statements: Array<{ args: QueryArgs; sql: string }> = [];
  const prepare = vi.fn((sql: string) => {
    const statement = {
      args: [] as QueryArgs,
      sql,
      all: async () => handlers.all?.(sql, statement.args) ?? { results: [] },
      bind: (...args: QueryArgs) => {
        statement.args = args;
        return statement;
      },
      first: async () => handlers.first?.(sql, statement.args) ?? null,
      run: async () => handlers.run?.(sql, statement.args) ?? { success: true },
    };
    statements.push(statement);
    return statement;
  });
  const batch = vi.fn(async (_statements: unknown[]) => []);
  return {
    batch,
    bindings: {
      ASSETS: { fetch: () => Promise.resolve(new Response("not used")) },
      DB: { batch, prepare },
    } as unknown as Bindings,
    prepare,
    statements,
  };
}

const practiceId = "0123456789abcdef0123456789abcdef";
const taskText = "会議の結論を先に書き、決まったことと期限を短くまとめます。";
const practice: PracticeRow = {
  created_at: 1_700_000_000,
  creator_session_id: "7c0dbe70-8c47-4fc0-aa62-52427133c612",
  expires_at: 4_000_000_000,
  id: practiceId,
  mode: "japanese",
  note: "速さより正確さ",
  owner_token_hash: "",
  status: "active",
  task_text: taskText,
  title: "週報を正確に打つ",
  updated_at: 1_700_000_000,
};

const sessionId = "7c0dbe70-8c47-4fc0-aa62-52427133c612";

const ownerHash = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

describe("worker", () => {
  it("renders the real Japanese lesson builder without experiment copy", async () => {
    const { bindings } = makeBindings();
    const response = await app.request("/", undefined, bindings);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(html).toContain('lang="ja"');
    expect(html).toContain('data-builder="true"');
    expect(html).toContain('class="trace-preview"');
    expect(html).toContain("日本語入力");
    expect(html).toContain("つまずき");
    expect(html).not.toContain("data-template-surface");
    expect(html).not.toContain('class="hero"');
    expect(html).not.toContain("公開パイロット");
    expect(html).not.toContain("成功条件");
  });

  it("renders guide and concrete privacy boundaries", async () => {
    const { bindings } = makeBindings();
    const guide = await (await app.request("/guide", undefined, bindings)).text();
    const privacy = await (await app.request("/privacy", undefined, bindings)).text();

    expect(guide).toContain("普段どおり入力する");
    expect(guide).toContain("公式試験の点数");
    expect(privacy).toContain("入力途中の文章");
    expect(privacy).toContain("35日後");
  });

  it("creates a private practice with a fragment-only management token", async () => {
    const db = makeBindings({
      first: (sql) => (sql.includes("COUNT(*) AS count FROM practices") ? { count: 0 } : null),
    });
    const response = await app.request(
      "/api/practices",
      {
        body: JSON.stringify({
          expiryDays: 14,
          mode: "japanese",
          note: "速さより正確さ",
          sessionId,
          taskText,
          title: "週報を正確に打つ",
          website: "",
        }),
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      },
      db.bindings,
    );
    const body = await response.json<{ id: string; manageUrl: string; shareUrl: string }>();

    expect(response.status).toBe(201);
    expect(body.id).toMatch(/^[0-9a-f]{32}$/);
    expect(body.shareUrl).toBe(`/p/${body.id}`);
    expect(body.manageUrl).toMatch(new RegExp(`^/manage/${body.id}#[0-9a-f]{64}$`));
    expect(db.batch).toHaveBeenCalledOnce();
    const statements = db.batch.mock.calls[0]?.[0] as Array<{ sql: string }>;
    expect(statements.some((statement) => statement.sql.includes("INSERT INTO practices"))).toBe(
      true,
    );
  });

  it("rejects cross-site creation and invalid lesson bodies", async () => {
    const { bindings } = makeBindings();
    const crossSite = await app.request(
      "/api/practices",
      {
        body: "{}",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        },
        method: "POST",
      },
      bindings,
    );
    const invalid = await app.request(
      "/api/practices",
      {
        body: JSON.stringify({
          expiryDays: 14,
          mode: "japanese",
          sessionId,
          taskText: "短い",
          title: "短い",
        }),
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      },
      bindings,
    );

    expect(crossSite.status).toBe(403);
    expect(invalid.status).toBe(400);
  });

  it("serves active lessons as noindex and hides closed lessons", async () => {
    const activeDb = makeBindings({
      first: (sql) => (sql.includes("SELECT * FROM practices") ? practice : null),
    });
    const active = await app.request(`/p/${practiceId}`, undefined, activeDb.bindings);
    const html = await active.text();
    const closedDb = makeBindings({
      first: (sql) =>
        sql.includes("SELECT * FROM practices") ? { ...practice, status: "closed" } : null,
    });
    const closed = await app.request(`/p/${practiceId}`, undefined, closedDb.bindings);

    expect(active.status).toBe(200);
    expect(active.headers.get("x-robots-tag")).toContain("noindex");
    expect(active.headers.get("cache-control")).toContain("no-store");
    expect(html).toContain(taskText);
    expect(html).toContain("本名、メールアドレス、学籍番号");
    expect(closed.status).toBe(404);
  });

  it("accepts a complete attempt and computes results on the server", async () => {
    const db = makeBindings({
      first: (sql) => {
        if (sql.includes("SELECT * FROM practices")) return practice;
        if (sql.includes("COUNT(*) AS count FROM attempts")) return { count: 0 };
        return null;
      },
    });
    const response = await app.request(
      `/api/practices/${practiceId}/attempts`,
      {
        body: JSON.stringify({
          completedText: taskText,
          correctionCount: 3,
          durationMs: 60_000,
          errorCount: 2,
          hotspots: [{ count: 2, index: 4 }],
          learnerCode: "B-12",
          sessionId,
          timeline: [
            { characters: 0, seconds: 0 },
            { characters: countGraphemes(taskText), seconds: 60 },
          ],
        }),
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      },
      db.bindings,
    );
    const body = await response.json<{ accuracy: number; cpm: number }>();

    expect(response.status).toBe(201);
    expect(body.cpm).toBe(countGraphemes(taskText));
    expect(body.accuracy).toBeGreaterThan(90);
    const statements = db.batch.mock.calls[0]?.[0] as Array<{ sql: string }>;
    expect(statements.some((statement) => statement.sql.includes("INSERT INTO attempts"))).toBe(
      true,
    );
  });

  it("rejects incomplete text and personal-looking learner codes outside the format", async () => {
    const db = makeBindings({
      first: (sql) => (sql.includes("SELECT * FROM practices") ? practice : null),
    });
    const response = await app.request(
      `/api/practices/${practiceId}/attempts`,
      {
        body: JSON.stringify({
          completedText: "未完了",
          correctionCount: 0,
          durationMs: 10_000,
          errorCount: 0,
          hotspots: [],
          learnerCode: "山田太郎",
          sessionId,
          timeline: [{ characters: 0, seconds: 0 }],
        }),
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      },
      db.bindings,
    );

    expect(response.status).toBe(400);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("returns aggregate attempts only to the matching owner token", async () => {
    const token = "a".repeat(64);
    const row = { ...practice, owner_token_hash: await ownerHash(token) };
    const db = makeBindings({
      all: (sql) =>
        sql.includes("FROM attempts")
          ? {
              results: [
                {
                  accuracy: 98.5,
                  characters: countGraphemes(taskText),
                  correction_count: 1,
                  cpm: 120,
                  created_at: 1_800_000_000,
                  duration_ms: 30_000,
                  error_count: 1,
                  hotspots_json: '[{"index":3,"count":1}]',
                  id: "b".repeat(32),
                  learner_code: "B-12",
                  timeline_json: '[{"seconds":0,"characters":0}]',
                },
              ],
            }
          : { results: [] },
      first: (sql) => (sql.includes("SELECT * FROM practices") ? row : null),
    });
    const response = await app.request(
      `/api/practices/${practiceId}/manage`,
      { headers: { "x-owner-token": token } },
      db.bindings,
    );
    const body = await response.json<{
      attempts: Array<{ learnerCode: string }>;
      practice: { title: string };
    }>();

    expect(response.status).toBe(200);
    expect(body.practice.title).toBe(practice.title);
    expect(body.attempts[0]?.learnerCode).toBe("B-12");
    expect(JSON.stringify(body)).not.toContain(row.owner_token_hash);
    expect(JSON.stringify(body)).not.toContain(row.creator_session_id);
  });

  it("exposes health and safe not-found responses", async () => {
    const { bindings } = makeBindings();
    const health = await app.request("/healthz", undefined, bindings);
    const healthBody = await health.json<{ healthy: boolean }>();
    const missing = await app.request("/missing", undefined, bindings);
    const missingHtml = await missing.text();

    expect(health.status).toBe(200);
    expect(healthBody.healthy).toBe(true);
    expect(missing.status).toBe(404);
    expect(missingHtml).toContain("ページが見つかりません");
    expect(missingHtml).not.toContain("internal_error");
  });
});
