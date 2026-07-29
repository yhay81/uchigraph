(() => {
  "use strict";

  const sessionKey = "uchigraph_session";
  const lastSeenKey = "uchigraph_last_seen";

  const getSessionId = () => {
    let sessionId = localStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem(sessionKey, sessionId);
    }
    return sessionId;
  };

  const track = (name, practiceId = "") =>
    fetch("/api/events", {
      body: JSON.stringify({ name, practiceId, sessionId: getSessionId() }),
      headers: { "content-type": "application/json" },
      keepalive: true,
      method: "POST",
    }).catch(() => undefined);

  const previous = Number(localStorage.getItem(lastSeenKey) ?? 0);
  const now = Date.now();
  if (previous && now - previous > 86_400_000) void track("returned");
  localStorage.setItem(lastSeenKey, String(now));
  if (location.pathname === "/") void track("visited");

  window.Uchigraph = { getSessionId, track };
})();
