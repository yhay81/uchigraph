(() => {
  "use strict";

  const shell = document.querySelector("[data-practice-id]");
  const targetElement = document.querySelector("[data-target-display]");
  if (!shell || !targetElement || !window.Uchigraph) return;

  const practiceId = shell.dataset.practiceId;
  const target = targetElement.textContent ?? "";
  const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
  const graphemes = (value) => Array.from(segmenter.segment(value), (part) => part.segment);
  const targetChars = graphemes(target);
  const startScreen = document.querySelector("[data-start-screen]");
  const typingScreen = document.querySelector("[data-typing-screen]");
  const resultScreen = document.querySelector("[data-result-screen]");
  const codeInput = document.querySelector("[data-learner-code]");
  const typingInput = document.querySelector("[data-typing-input]");
  const practiceMessage = document.querySelector("[data-practice-message]");
  const liveMessage = document.querySelector("[data-live-message]");
  const elapsed = document.querySelector("[data-elapsed]");
  const progressLabel = document.querySelector("[data-progress-label]");
  const progressBar = document.querySelector("[data-progress-bar]");

  let learnerCode = "";
  let startedAt = 0;
  let timer = 0;
  let previousValue = "";
  let errorCount = 0;
  let correctionCount = 0;
  let timeline = [];
  let hotspotCounts = new Map();
  let lastSample = 0;
  let finishing = false;
  let composing = false;

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(
      totalSeconds % 60,
    ).padStart(2, "0")}`;
  };

  const commonPrefixLength = (left, right) => {
    const leftChars = graphemes(left);
    const rightChars = graphemes(right);
    const maximum = Math.min(leftChars.length, rightChars.length);
    let index = 0;
    while (index < maximum && leftChars[index] === rightChars[index]) index += 1;
    return index;
  };

  const sample = (force = false) => {
    if (!startedAt) return;
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    if (!force && seconds - lastSample < 5) return;
    lastSample = seconds;
    const characters = commonPrefixLength(typingInput.value, target);
    timeline.push({ characters, seconds });
    if (timeline.length > 180) timeline = timeline.slice(-180);
  };

  const tick = () => {
    if (!startedAt || finishing) return;
    const duration = Date.now() - startedAt;
    if (elapsed) elapsed.textContent = formatTime(duration);
    sample();
  };

  const reset = () => {
    clearInterval(timer);
    startedAt = Date.now();
    previousValue = "";
    errorCount = 0;
    correctionCount = 0;
    timeline = [{ characters: 0, seconds: 0 }];
    hotspotCounts = new Map();
    lastSample = 0;
    finishing = false;
    typingInput.value = "";
    typingInput.removeAttribute("aria-invalid");
    if (elapsed) elapsed.textContent = "00:00";
    if (progressLabel) progressLabel.textContent = "0%";
    if (progressBar) progressBar.style.width = "0%";
    if (liveMessage) liveMessage.textContent = "文章を入力してください。";
    timer = setInterval(tick, 250);
    typingInput.focus();
    void window.Uchigraph.track("attempt_started", practiceId);
  };

  const renderResult = ({ accuracy, cpm }) => {
    const durationMs = Date.now() - startedAt;
    const correctionOutput = document.querySelector("[data-result-corrections]");
    document.querySelector("[data-result-cpm]").textContent = String(Math.round(cpm));
    document.querySelector("[data-result-accuracy]").textContent = `${accuracy.toFixed(1)}%`;
    if (correctionOutput) correctionOutput.textContent = String(correctionCount);

    const bars = document.querySelector("[data-result-bars]");
    bars.replaceChildren();
    const maximum = Math.max(...timeline.map((point) => point.characters), 1);
    for (const point of timeline.slice(-28)) {
      const bar = document.createElement("i");
      bar.style.setProperty("--height", `${Math.max(5, (point.characters / maximum) * 100)}%`);
      bar.title = `${point.seconds}秒・${point.characters}文字`;
      bars.append(bar);
    }

    const hotspots = document.querySelector("[data-result-hotspots]");
    hotspots.replaceChildren();
    const sorted = [...hotspotCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (sorted.length === 0) {
      const clean = document.createElement("span");
      clean.className = "clean-run";
      clean.textContent = "大きなつまずきはありませんでした";
      hotspots.append(clean);
    } else {
      for (const [index, count] of sorted) {
        const chip = document.createElement("span");
        const character = targetChars[index] === "\n" ? "↵" : targetChars[index] || "終";
        chip.textContent = `${character} · ${count}`;
        hotspots.append(chip);
      }
    }

    resultScreen.hidden = false;
    typingScreen.hidden = true;
    resultScreen.scrollIntoView({ behavior: "smooth", block: "start" });
    sessionStorage.setItem(
      `uchigraph_result_${practiceId}`,
      JSON.stringify({ accuracy, cpm, correctionCount, durationMs }),
    );
  };

  const finish = async () => {
    if (finishing) return;
    finishing = true;
    clearInterval(timer);
    sample(true);
    const durationMs = Math.max(1000, Date.now() - startedAt);
    if (liveMessage) liveMessage.textContent = "結果を保存しています…";
    const hotspots = [...hotspotCounts.entries()].map(([index, count]) => ({ count, index }));
    try {
      const response = await fetch(`/api/practices/${practiceId}/attempts`, {
        body: JSON.stringify({
          completedText: target,
          correctionCount,
          durationMs,
          errorCount,
          hotspots,
          learnerCode,
          sessionId: window.Uchigraph.getSessionId(),
          timeline,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        finishing = false;
        if (liveMessage) {
          liveMessage.textContent =
            response.status === 429
              ? "今日は10回まで保存できます。"
              : "結果を保存できませんでした。もう一度お試しください。";
        }
        return;
      }
      renderResult(await response.json());
    } catch {
      finishing = false;
      if (liveMessage) liveMessage.textContent = "通信できませんでした。接続を確認してください。";
    }
  };

  document.querySelector("[data-start]")?.addEventListener("click", () => {
    const normalized = codeInput.value.normalize("NFKC").trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{1,11}$/.test(normalized)) {
      if (practiceMessage) {
        practiceMessage.textContent = "英数字・ハイフン・下線で2〜12文字のコードを入れてください。";
      }
      return;
    }
    learnerCode = normalized;
    startScreen.hidden = true;
    typingScreen.hidden = false;
    reset();
  });

  typingInput?.addEventListener("beforeinput", (event) => {
    if (String(event.inputType).startsWith("delete")) correctionCount += 1;
  });

  typingInput?.addEventListener("compositionstart", () => {
    composing = true;
  });

  typingInput?.addEventListener("compositionend", () => {
    composing = false;
  });

  typingInput?.addEventListener("input", (event) => {
    if (!startedAt || finishing) return;
    const value = typingInput.value;
    const prefix = commonPrefixLength(value, target);
    const previousPrefix = commonPrefixLength(previousValue, target);
    if (prefix < graphemes(value).length && !composing && !event.isComposing) {
      errorCount += 1;
      const index = Math.max(0, prefix);
      hotspotCounts.set(index, (hotspotCounts.get(index) ?? 0) + 1);
      typingInput.setAttribute("aria-invalid", "true");
      if (liveMessage) liveMessage.textContent = `${prefix + 1}文字目を確認してください。`;
    } else {
      typingInput.removeAttribute("aria-invalid");
      if (liveMessage)
        liveMessage.textContent = prefix > previousPrefix ? "そのまま続けてください。" : "";
    }
    const percent = Math.min(100, Math.round((prefix / targetChars.length) * 100));
    if (progressLabel) progressLabel.textContent = `${percent}%`;
    if (progressBar) progressBar.style.width = `${percent}%`;
    previousValue = value;
    if (value === target) void finish();
  });

  document.querySelector("[data-restart]")?.addEventListener("click", reset);
  document.querySelector("[data-again]")?.addEventListener("click", () => {
    resultScreen.hidden = true;
    typingScreen.hidden = false;
    reset();
  });

  document.querySelector("[data-copy-result]")?.addEventListener("click", async (event) => {
    const saved = JSON.parse(sessionStorage.getItem(`uchigraph_result_${practiceId}`) ?? "{}");
    const text = `打ちグラフ：${Math.round(saved.cpm ?? 0)}文字/分・正確さ${Number(
      saved.accuracy ?? 0,
    ).toFixed(1)}%・修正${saved.correctionCount ?? 0}回`;
    await navigator.clipboard.writeText(text);
    event.currentTarget.textContent = "コピーしました";
  });

  const dialog = document.querySelector("[data-report-dialog]");
  document.querySelector("[data-open-report]")?.addEventListener("click", () => dialog.showModal());
  document.querySelector("[data-submit-report]")?.addEventListener("click", async () => {
    const reason = new FormData(dialog.querySelector("form")).get("reason");
    const reportMessage = document.querySelector("[data-report-message]");
    const response = await fetch(`/api/practices/${practiceId}/report`, {
      body: JSON.stringify({
        reason,
        sessionId: window.Uchigraph.getSessionId(),
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (reportMessage) {
      reportMessage.textContent = response.ok ? "報告を受け付けました。" : "報告できませんでした。";
    }
  });

  void window.Uchigraph.track("lesson_opened", practiceId);
})();
