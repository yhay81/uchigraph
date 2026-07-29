import { Hono } from "hono";
import { requestId } from "hono/request-id";

import { securityHeaders } from "./middleware/security";
import { countGraphemes } from "./text";
import {
  GuidePage,
  HomePage,
  ManagePage,
  NotFoundPage,
  PracticePage,
  PrivacyPage,
} from "./ui/pages";

export type Bindings = {
  ASSETS: Fetcher;
  DB: D1Database;
};

export type PracticeRow = {
  created_at: number;
  creator_session_id: string;
  expires_at: number;
  id: string;
  mode: "japanese" | "english" | "code";
  note: string;
  owner_token_hash: string;
  status: "active" | "closed" | "hidden";
  task_text: string;
  title: string;
  updated_at: number;
};

type AttemptRow = {
  accuracy: number;
  characters: number;
  correction_count: number;
  cpm: number;
  created_at: number;
  duration_ms: number;
  error_count: number;
  hotspots_json: string;
  id: string;
  learner_code: string;
  timeline_json: string;
};

const app = new Hono<{ Bindings: Bindings }>();
const idPattern = /^[0-9a-f]{32}$/;
const ownerTokenPattern = /^[0-9a-f]{64}$/;
const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const learnerCodePattern = /^[A-Z0-9][A-Z0-9_-]{1,11}$/;
const modes = new Set(["japanese", "english", "code"]);
const eventNames = new Set([
  "visited",
  "practice_created",
  "practice_shared",
  "lesson_opened",
  "attempt_started",
  "attempt_completed",
  "owner_checked",
  "practice_closed",
  "returned",
]);
const daySeconds = 86_400;

app.use("*", requestId());
app.use("*", securityHeaders);

const nowSeconds = () => Math.floor(Date.now() / 1000);

const randomHex = (bytes: number) => {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const normalize = (value: unknown, maximum: number) =>
  typeof value === "string" ? value.normalize("NFKC").trim().slice(0, maximum) : "";

const normalizeTask = (value: unknown) =>
  typeof value === "string"
    ? value.normalize("NFC").replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim().slice(0, 2000)
    : "";

const isSameOriginMutation = (request: Request) => {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
};

const isJsonRequest = (request: Request) =>
  request.headers.get("content-type")?.toLowerCase().startsWith("application/json") ?? false;

const noStore = async (response: Response | Promise<Response>) => {
  const resolved = await response;
  resolved.headers.set("Cache-Control", "no-store, private");
  resolved.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return resolved;
};

const publicPractice = (row: PracticeRow | null) =>
  row && row.status === "active" && row.expires_at > nowSeconds() ? row : null;

const ownerPractice = async (db: D1Database, id: string, token: string) => {
  if (!idPattern.test(id) || !ownerTokenPattern.test(token)) return null;
  const row = await db
    .prepare("SELECT * FROM practices WHERE id = ?")
    .bind(id)
    .first<PracticeRow>();
  if (!row) return null;
  const suppliedHash = await sha256(token);
  return constantTimeEqual(row.owner_token_hash, suppliedHash) ? row : null;
};

const recordEventStatement = (db: D1Database, sessionId: string, name: string, practiceId = "") =>
  db
    .prepare(
      "INSERT INTO product_events (session_id, name, practice_id, occurred_on, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(sessionId, name, practiceId, new Date().toISOString().slice(0, 10), nowSeconds());

const parseJsonArray = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

app.get("/", (c) => c.html(<HomePage />));
app.get("/guide", (c) => c.html(<GuidePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));

app.get("/manage/:id", (c) => {
  if (!idPattern.test(c.req.param("id"))) return noStore(c.html(<NotFoundPage />, 404));
  return noStore(c.html(<ManagePage practiceId={c.req.param("id")} />));
});

app.get("/p/:id", async (c) => {
  const id = c.req.param("id");
  if (!idPattern.test(id)) return noStore(c.html(<NotFoundPage />, 404));
  const row = await c.env.DB.prepare("SELECT * FROM practices WHERE id = ?")
    .bind(id)
    .first<PracticeRow>();
  const practice = publicPractice(row);
  if (!practice) return noStore(c.html(<NotFoundPage />, 404));
  return noStore(c.html(<PracticePage practice={practice} />));
});

app.post("/api/practices", async (c) => {
  if (!isSameOriginMutation(c.req.raw)) return c.json({ error: "forbidden" }, 403);
  if (!isJsonRequest(c.req.raw)) return c.json({ error: "unsupported_media_type" }, 415);
  if (Number(c.req.header("content-length") ?? 0) > 12_000) {
    return c.json({ error: "payload_too_large" }, 413);
  }

  const body = await c.req.json<{
    expiryDays?: number;
    mode?: string;
    note?: string;
    sessionId?: string;
    taskText?: string;
    title?: string;
    website?: string;
  }>();
  if (normalize(body.website, 100)) return c.json({ error: "invalid" }, 400);

  const sessionId = normalize(body.sessionId, 36);
  const title = normalize(body.title, 60);
  const taskText = normalizeTask(body.taskText);
  const mode = normalize(body.mode, 20);
  const note = normalize(body.note, 120);
  const expiryDays = Number(body.expiryDays);
  if (
    !sessionIdPattern.test(sessionId) ||
    title.length < 2 ||
    countGraphemes(taskText) < 20 ||
    !modes.has(mode) ||
    ![7, 14, 30].includes(expiryDays)
  ) {
    return c.json({ error: "invalid_practice" }, 400);
  }

  const daily = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM practices WHERE creator_session_id = ? AND created_at >= ?",
  )
    .bind(sessionId, nowSeconds() - daySeconds)
    .first<{ count: number }>();
  if ((daily?.count ?? 0) >= 3) return c.json({ error: "rate_limited" }, 429);

  const id = randomHex(16);
  const ownerToken = randomHex(32);
  const createdAt = nowSeconds();
  const expiresAt = createdAt + expiryDays * daySeconds;
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO practices (
        id, owner_token_hash, creator_session_id, title, task_text, mode, note,
        status, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    ).bind(
      id,
      await sha256(ownerToken),
      sessionId,
      title,
      taskText,
      mode,
      note,
      expiresAt,
      createdAt,
      createdAt,
    ),
    recordEventStatement(c.env.DB, sessionId, "practice_created", id),
  ]);

  return c.json(
    {
      id,
      manageUrl: `/manage/${id}#${ownerToken}`,
      shareUrl: `/p/${id}`,
    },
    201,
  );
});

app.get("/api/practices/:id/manage", async (c) => {
  const id = c.req.param("id");
  const token = c.req.header("x-owner-token") ?? "";
  const practice = await ownerPractice(c.env.DB, id, token);
  if (!practice) return noStore(c.json({ error: "forbidden" }, 403));

  const result = await c.env.DB.prepare(
    `SELECT id, learner_code, duration_ms, characters, cpm, accuracy,
      error_count, correction_count, timeline_json, hotspots_json, created_at
     FROM attempts WHERE practice_id = ? ORDER BY created_at DESC LIMIT 200`,
  )
    .bind(id)
    .all<AttemptRow>();

  return noStore(
    c.json({
      attempts: (result.results ?? []).map((attempt) => ({
        accuracy: attempt.accuracy,
        characters: attempt.characters,
        correctionCount: attempt.correction_count,
        cpm: attempt.cpm,
        createdAt: attempt.created_at,
        durationMs: attempt.duration_ms,
        errorCount: attempt.error_count,
        hotspots: parseJsonArray(attempt.hotspots_json),
        id: attempt.id,
        learnerCode: attempt.learner_code,
        timeline: parseJsonArray(attempt.timeline_json),
      })),
      practice: {
        createdAt: practice.created_at,
        expiresAt: practice.expires_at,
        mode: practice.mode,
        note: practice.note,
        status: practice.status,
        taskLength: countGraphemes(practice.task_text),
        title: practice.title,
      },
    }),
  );
});

app.post("/api/practices/:id/attempts", async (c) => {
  if (!isSameOriginMutation(c.req.raw)) return c.json({ error: "forbidden" }, 403);
  if (!isJsonRequest(c.req.raw)) return c.json({ error: "unsupported_media_type" }, 415);
  if (Number(c.req.header("content-length") ?? 0) > 24_000) {
    return c.json({ error: "payload_too_large" }, 413);
  }

  const id = c.req.param("id");
  if (!idPattern.test(id)) return c.json({ error: "not_found" }, 404);
  const body = await c.req.json<{
    completedText?: string;
    correctionCount?: number;
    durationMs?: number;
    errorCount?: number;
    hotspots?: unknown[];
    learnerCode?: string;
    sessionId?: string;
    timeline?: unknown[];
  }>();
  const row = await c.env.DB.prepare("SELECT * FROM practices WHERE id = ?")
    .bind(id)
    .first<PracticeRow>();
  const practice = publicPractice(row);
  const sessionId = normalize(body.sessionId, 36);
  const learnerCode = normalize(body.learnerCode, 12).toUpperCase();
  const completedText = normalizeTask(body.completedText);
  const durationMs = Number(body.durationMs);
  const errorCount = Number(body.errorCount);
  const correctionCount = Number(body.correctionCount);
  const timeline = Array.isArray(body.timeline) ? body.timeline.slice(0, 180) : [];
  const hotspots = Array.isArray(body.hotspots) ? body.hotspots.slice(0, 20) : [];

  if (
    !practice ||
    !sessionIdPattern.test(sessionId) ||
    !learnerCodePattern.test(learnerCode) ||
    completedText !== practice.task_text ||
    !Number.isInteger(durationMs) ||
    durationMs < 1000 ||
    durationMs > 3_600_000 ||
    !Number.isInteger(errorCount) ||
    errorCount < 0 ||
    errorCount > 10_000 ||
    !Number.isInteger(correctionCount) ||
    correctionCount < 0 ||
    correctionCount > 10_000
  ) {
    return c.json({ error: "invalid_attempt" }, 400);
  }

  const characterCount = countGraphemes(practice.task_text);
  const cleanTimeline = timeline
    .map((point) => {
      if (!point || typeof point !== "object") return null;
      const record = point as { characters?: unknown; seconds?: unknown };
      const seconds = Number(record.seconds);
      const characters = Number(record.characters);
      return Number.isInteger(seconds) &&
        seconds >= 0 &&
        seconds <= 3600 &&
        Number.isInteger(characters) &&
        characters >= 0 &&
        characters <= characterCount
        ? { characters, seconds }
        : null;
    })
    .filter((point): point is { characters: number; seconds: number } => point !== null);
  const cleanHotspots = hotspots
    .map((point) => {
      if (!point || typeof point !== "object") return null;
      const record = point as { count?: unknown; index?: unknown };
      const index = Number(record.index);
      const count = Number(record.count);
      return Number.isInteger(index) &&
        index >= 0 &&
        index < characterCount &&
        Number.isInteger(count) &&
        count > 0 &&
        count <= 10_000
        ? { count, index }
        : null;
    })
    .filter((point): point is { count: number; index: number } => point !== null);
  if (cleanTimeline.length === 0) return c.json({ error: "invalid_attempt" }, 400);

  const daily = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM attempts WHERE learner_session_id = ? AND created_at >= ?",
  )
    .bind(sessionId, nowSeconds() - daySeconds)
    .first<{ count: number }>();
  if ((daily?.count ?? 0) >= 10) return c.json({ error: "rate_limited" }, 429);

  const cpm = Math.round((characterCount / (durationMs / 60_000)) * 10) / 10;
  const accuracy = Math.round((characterCount / (characterCount + errorCount)) * 10_000) / 100;
  const createdAt = nowSeconds();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO attempts (
        id, practice_id, learner_session_id, learner_code, duration_ms, characters,
        cpm, accuracy, error_count, correction_count, timeline_json, hotspots_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      randomHex(16),
      id,
      sessionId,
      learnerCode,
      durationMs,
      characterCount,
      cpm,
      accuracy,
      errorCount,
      correctionCount,
      JSON.stringify(cleanTimeline),
      JSON.stringify(cleanHotspots),
      createdAt,
    ),
    recordEventStatement(c.env.DB, sessionId, "attempt_completed", id),
  ]);

  return c.json({ accuracy, accepted: true, cpm }, 201);
});

app.post("/api/practices/:id/report", async (c) => {
  if (!isSameOriginMutation(c.req.raw)) return c.json({ error: "forbidden" }, 403);
  if (!isJsonRequest(c.req.raw)) return c.json({ error: "unsupported_media_type" }, 415);
  const id = c.req.param("id");
  const body = await c.req.json<{ reason?: string; sessionId?: string }>();
  const sessionId = normalize(body.sessionId, 36);
  const reason = normalize(body.reason, 20);
  if (
    !idPattern.test(id) ||
    !sessionIdPattern.test(sessionId) ||
    !["personal", "copyright", "unsafe"].includes(reason)
  ) {
    return c.json({ error: "invalid_report" }, 400);
  }
  const row = await c.env.DB.prepare("SELECT * FROM practices WHERE id = ?")
    .bind(id)
    .first<PracticeRow>();
  if (!publicPractice(row)) return c.json({ error: "not_found" }, 404);

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO reports (practice_id, reporter_session_id, reason, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(id, sessionId, reason, nowSeconds())
    .run();
  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM reports WHERE practice_id = ?",
  )
    .bind(id)
    .first<{ count: number }>();
  const hidden = (count?.count ?? 0) >= 3;
  if (hidden) {
    await c.env.DB.prepare("UPDATE practices SET status = 'hidden', updated_at = ? WHERE id = ?")
      .bind(nowSeconds(), id)
      .run();
  }
  return c.json({ hidden });
});

app.patch("/api/practices/:id/status", async (c) => {
  if (!isSameOriginMutation(c.req.raw)) return c.json({ error: "forbidden" }, 403);
  if (!isJsonRequest(c.req.raw)) return c.json({ error: "unsupported_media_type" }, 415);
  const id = c.req.param("id");
  const token = c.req.header("x-owner-token") ?? "";
  const practice = await ownerPractice(c.env.DB, id, token);
  if (!practice) return c.json({ error: "forbidden" }, 403);
  const body = await c.req.json<{ status?: string }>();
  const status = normalize(body.status, 10);
  if (!["active", "closed"].includes(status)) return c.json({ error: "invalid_status" }, 400);
  if (
    practice.status === "hidden" ||
    (status === "active" && practice.expires_at <= nowSeconds())
  ) {
    return c.json({ error: "unavailable" }, 409);
  }
  await c.env.DB.prepare("UPDATE practices SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, nowSeconds(), id)
    .run();
  return c.json({ status });
});

app.delete("/api/practices/:id", async (c) => {
  if (!isSameOriginMutation(c.req.raw)) return c.json({ error: "forbidden" }, 403);
  const id = c.req.param("id");
  const token = c.req.header("x-owner-token") ?? "";
  const practice = await ownerPractice(c.env.DB, id, token);
  if (!practice) return c.json({ error: "forbidden" }, 403);
  await c.env.DB.prepare("DELETE FROM practices WHERE id = ?").bind(id).run();
  return c.body(null, 204);
});

app.post("/api/events", async (c) => {
  if (!isSameOriginMutation(c.req.raw)) return c.json({ error: "forbidden" }, 403);
  if (!isJsonRequest(c.req.raw)) return c.json({ error: "unsupported_media_type" }, 415);
  const body = await c.req.json<{ name?: string; practiceId?: string; sessionId?: string }>();
  const sessionId = normalize(body.sessionId, 36);
  const name = normalize(body.name, 40);
  const practiceId = normalize(body.practiceId, 32);
  if (
    !sessionIdPattern.test(sessionId) ||
    !eventNames.has(name) ||
    (practiceId && !idPattern.test(practiceId))
  ) {
    return c.json({ error: "invalid_event" }, 400);
  }
  await recordEventStatement(c.env.DB, sessionId, name, practiceId).run();
  return c.body(null, 204);
});

app.get("/healthz", (c) =>
  c.json({
    healthy: true,
    service: "uchigraph",
    time: new Date().toISOString(),
  }),
);

app.notFound((c) =>
  c.req.path.startsWith("/api/")
    ? c.json({ error: "not_found", requestId: c.get("requestId") }, 404)
    : c.html(<NotFoundPage />, 404),
);

app.onError((error, c) => {
  console.error(
    JSON.stringify({
      event: "request_failed",
      message: error.message,
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (_controller, env) => {
  const now = nowSeconds();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE practices SET status = 'closed', updated_at = ? WHERE status = 'active' AND expires_at <= ?",
    ).bind(now, now),
    env.DB.prepare("DELETE FROM practices WHERE expires_at < ?").bind(now - 35 * daySeconds),
    env.DB.prepare("DELETE FROM product_events WHERE created_at < ?").bind(now - 35 * daySeconds),
  ]);
};

export { app };
export default { fetch: app.fetch, scheduled };
