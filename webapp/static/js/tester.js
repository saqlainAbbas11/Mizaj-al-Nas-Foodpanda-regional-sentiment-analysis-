function setExample(text) {
  document.getElementById("tester-input").value = text;
  // Auto-focus the textarea
  document.getElementById("tester-input").focus();
}

function scoreBarsHTML(scores) {
  const order = ["positive", "neutral", "negative"];
  const colors = { positive: "bg-positive", neutral: "bg-neutralc", negative: "bg-negative" };
  const icons = {
    positive: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
    neutral: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>',
    negative: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/></svg>'
  };
  return order
    .map((label) => {
      const pct = ((scores[label] || 0) * 100).toFixed(1);
      return `
      <div class="mb-3">
        <div class="flex justify-between text-xs mb-1.5">
          <span class="capitalize text-txt-sub inline-flex items-center gap-1">${icons[label]} ${label}</span>
          <span class="text-txt font-semibold">${pct}%</span>
        </div>
        <div class="progress-track"><div class="progress-fill ${colors[label]}" style="width:${pct}%"></div></div>
      </div>`;
    })
    .join("");
}

async function analyzeSentiment() {
  const text = document.getElementById("tester-input").value.trim();
  const btn = document.getElementById("analyze-btn");
  const errorBox = document.getElementById("tester-error");
  const resultBox = document.getElementById("tester-result");

  errorBox.classList.add("hidden");
  if (!text) return;

  btn.disabled = true;
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    Running both models...`;

  try {
    const data = await apiPost("/api/sentiment/analyze", { text });

    // Final sentiment
    const sentEl = document.getElementById("final-sentiment");
    sentEl.textContent = data.sentiment.toUpperCase();
    sentEl.className =
      "text-4xl sm:text-5xl font-display font-bold mb-2 " +
      (data.sentiment === "positive" ? "text-positive" : data.sentiment === "negative" ? "text-negative" : "text-neutralc");

    document.getElementById("final-confidence").innerHTML = `
      <span class="inline-flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        ${(data.confidence * 100).toFixed(1)}% confidence
      </span>`;

    // Routing pills
    document.getElementById("detected-lang").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      Detected: ${data.detected_language.replace(/_/g, " ")}`;
    document.getElementById("primary-model").innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      Routed to: ${data.primary_model}`;

    // Model breakdowns
    document.getElementById("general-breakdown").innerHTML = scoreBarsHTML(data.breakdown.general_model.scores);
    document.getElementById("ru-breakdown").innerHTML = scoreBarsHTML(data.breakdown.roman_urdu_model.scores);

    // Agreement note
    const agreeEl = document.getElementById("agreement-note");
    if (data.models_agree) {
      agreeEl.innerHTML = `
        <div class="flex items-center justify-center gap-2 text-positive">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span class="font-medium">Both models agree on this prediction</span>
        </div>
        <p class="text-xs text-txt-muted mt-2">In the full pipeline, this review would receive a high-confidence routed label without needing LLM review.</p>`;
    } else {
      agreeEl.innerHTML = `
        <div class="flex items-center justify-center gap-2 text-amber">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span class="font-medium">Models disagree — routed model used as final answer</span>
        </div>
        <p class="text-xs text-txt-muted mt-2">In the full pipeline, this review would be flagged to the LLM review queue for deeper investigation. This is exactly the kind of edge case the confidence-routing system was designed to catch.</p>`;
    }

    resultBox.classList.remove("hidden");
    // Smooth scroll to results
    resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    errorBox.innerHTML = `
      <div class="flex items-start gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>
          <p class="font-medium mb-1">Couldn't analyze that text</p>
          <p class="text-xs text-txt-muted">${e.message}. If running with SENTIMENT_MODE=local, make sure torch + both models are installed.</p>
        </div>
      </div>`;
    errorBox.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      Analyze sentiment`;
  }
}

document.getElementById("tester-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) analyzeSentiment();
});
