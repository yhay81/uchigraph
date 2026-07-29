(() => {
  "use strict";

  const form = document.querySelector("[data-builder]");
  if (!form || !window.Uchigraph) return;

  const message = form.querySelector("[data-form-message]");
  const titleInput = form.elements.namedItem("title");
  const previewTitle = document.querySelector("[data-preview-title]");
  const previewMode = document.querySelector("[data-preview-mode]");
  const modeLabels = {
    code: "コード・記号",
    english: "英数字",
    japanese: "日本語入力",
  };

  titleInput?.addEventListener("input", () => {
    if (previewTitle) previewTitle.textContent = titleInput.value.trim() || "週報を正確に打つ";
  });

  form.addEventListener("change", () => {
    const mode = new FormData(form).get("mode");
    if (previewMode) previewMode.textContent = modeLabels[mode] ?? "日本語入力";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const taskEntry = data.get("taskText");
    const taskText = typeof taskEntry === "string" ? taskEntry.trim() : "";
    const characterCount = Array.from(
      new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(taskText),
    ).length;
    if (characterCount < 20) {
      if (message) message.textContent = "課題文を20文字以上入力してください。";
      return;
    }

    submit.disabled = true;
    if (message) message.textContent = "課題URLを作っています…";
    try {
      const response = await fetch("/api/practices", {
        body: JSON.stringify({
          expiryDays: Number(data.get("expiryDays")),
          mode: data.get("mode"),
          note: data.get("note"),
          sessionId: window.Uchigraph.getSessionId(),
          taskText,
          title: data.get("title"),
          website: data.get("website"),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        if (message) {
          message.textContent =
            response.status === 429
              ? "今日は3件まで作れます。明日もう一度お試しください。"
              : "入力を確認して、もう一度お試しください。";
        }
        return;
      }
      const result = await response.json();
      location.assign(result.manageUrl);
    } catch {
      if (message) message.textContent = "通信できませんでした。接続を確認してください。";
    } finally {
      submit.disabled = false;
    }
  });
})();
