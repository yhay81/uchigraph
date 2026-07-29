(() => {
  "use strict";

  const shell = document.querySelector("[data-practice-id]");
  if (!shell || !window.Uchigraph) return;
  const practiceId = shell.dataset.practiceId;
  const token = location.hash.slice(1);
  const message = document.querySelector("[data-owner-message]");
  let practiceState = null;

  const median = (values) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  const createAttemptRow = (attempt, maxCpm) => {
    const row = document.createElement("article");
    row.className = "attempt-row";

    const identity = document.createElement("div");
    identity.className = "attempt-identity";
    const code = document.createElement("strong");
    code.textContent = attempt.learnerCode;
    const time = document.createElement("span");
    time.textContent = new Date(attempt.createdAt * 1000).toLocaleString("ja-JP", {
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
    });
    identity.append(code, time);

    const line = document.createElement("div");
    line.className = "attempt-line";
    const fill = document.createElement("i");
    fill.style.width = `${Math.max(6, (attempt.cpm / maxCpm) * 100)}%`;
    line.append(fill);

    const numbers = document.createElement("div");
    numbers.className = "attempt-numbers";
    const cpm = document.createElement("strong");
    cpm.textContent = `${Math.round(attempt.cpm)}`;
    const unit = document.createElement("span");
    unit.textContent = "文字/分";
    const accuracy = document.createElement("b");
    accuracy.textContent = `${Number(attempt.accuracy).toFixed(1)}%`;
    numbers.append(cpm, unit, accuracy);

    const corrections = document.createElement("span");
    corrections.className = "attempt-corrections";
    corrections.textContent = `修正 ${attempt.correctionCount}回`;
    row.append(identity, line, numbers, corrections);
    return row;
  };

  const render = (result) => {
    practiceState = result.practice;
    document.querySelector("[data-owner-title]").textContent = result.practice.title;
    document.querySelector("[data-owner-meta]").textContent = `${result.practice.taskLength}文字・${
      result.practice.status === "active" ? "受付中" : "受付停止中"
    }`;
    const shareUrl = `${location.origin}/p/${practiceId}`;
    document.querySelector("[data-share-url]").textContent = shareUrl;
    document.querySelector("[data-practice-link]").href = shareUrl;

    const attempts = result.attempts ?? [];
    const learnerCodes = new Set(attempts.map((attempt) => attempt.learnerCode));
    const medianCpm = median(attempts.map((attempt) => Number(attempt.cpm)));
    const medianAccuracy = median(attempts.map((attempt) => Number(attempt.accuracy)));
    document.querySelector("[data-learner-count]").textContent = String(learnerCodes.size);
    document.querySelector("[data-attempt-count]").textContent = String(attempts.length);
    document.querySelector("[data-median-cpm]").textContent =
      medianCpm === null ? "—" : String(Math.round(medianCpm));
    document.querySelector("[data-median-accuracy]").textContent =
      medianAccuracy === null ? "—" : `${medianAccuracy.toFixed(1)}%`;

    const list = document.querySelector("[data-attempt-list]");
    list.replaceChildren();
    if (attempts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "完了結果が入ると、ここに線が増えます。";
      list.append(empty);
    } else {
      const maxCpm = Math.max(...attempts.map((attempt) => Number(attempt.cpm)), 1);
      for (const attempt of attempts) list.append(createAttemptRow(attempt, maxCpm));
    }

    const toggle = document.querySelector("[data-toggle-status]");
    if (toggle) {
      toggle.textContent = result.practice.status === "active" ? "受付を止める" : "受付を再開";
    }
  };

  const load = async () => {
    if (!/^[0-9a-f]{64}$/.test(token)) {
      if (message) message.textContent = "管理URLが正しくありません。";
      return;
    }
    const response = await fetch(`/api/practices/${practiceId}/manage`, {
      headers: { "x-owner-token": token },
    });
    if (!response.ok) {
      if (message) message.textContent = "管理URLを確認できませんでした。";
      return;
    }
    render(await response.json());
    void window.Uchigraph.track("owner_checked", practiceId);
  };

  document.querySelector("[data-copy-share]")?.addEventListener("click", async (event) => {
    await navigator.clipboard.writeText(`${location.origin}/p/${practiceId}`);
    event.currentTarget.textContent = "コピーしました";
    void window.Uchigraph.track("practice_shared", practiceId);
  });

  document.querySelector("[data-toggle-status]")?.addEventListener("click", async () => {
    if (!practiceState) return;
    const next = practiceState.status === "active" ? "closed" : "active";
    const response = await fetch(`/api/practices/${practiceId}/status`, {
      body: JSON.stringify({ status: next }),
      headers: { "content-type": "application/json", "x-owner-token": token },
      method: "PATCH",
    });
    if (!response.ok) {
      if (message) message.textContent = "状態を変更できませんでした。";
      return;
    }
    practiceState.status = next;
    document.querySelector("[data-owner-meta]").textContent =
      `${practiceState.taskLength}文字・${next === "active" ? "受付中" : "受付停止中"}`;
    document.querySelector("[data-toggle-status]").textContent =
      next === "active" ? "受付を止める" : "受付を再開";
    if (next === "closed") void window.Uchigraph.track("practice_closed", practiceId);
  });

  document.querySelector("[data-delete]")?.addEventListener("click", async () => {
    if (!confirm("課題文とすべての結果を完全に削除します。元に戻せません。")) return;
    const response = await fetch(`/api/practices/${practiceId}`, {
      headers: { "x-owner-token": token },
      method: "DELETE",
    });
    if (response.ok) location.replace("/");
  });

  void load();
})();
