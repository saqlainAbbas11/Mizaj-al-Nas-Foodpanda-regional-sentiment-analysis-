// Shared rendering helpers so every page doesn't reinvent sentiment badges/bars/charts.

function fmtNum(n) {
  return Number(n || 0).toLocaleString();
}
function fmtPct(n) {
  return `${Number(n || 0).toFixed(1)}%`;
}

function sentimentBadge(label) {
  const l = (label || "neutral").toLowerCase();
  return `<span class="sentiment-badge ${l}">${l}</span>`;
}

function debounce(fn, delay = 350) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// Helper to get CSS variable values for theme-aware rendering
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// A single aspect row: name, mention count, and a negative/positive split bar.
// `reliable` controls whether we show a "small sample" caveat instead of hard numbers.
function aspectRowHTML(aspect) {
  const name = (aspect.aspect || "").replace(/_/g, " ");
  const neg = aspect.pct_negative ?? 0;
  const pos = aspect.pct_positive ?? (100 - neg);
  const reliable = aspect.reliable_sample !== false;
  return `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-sm font-medium capitalize text-txt">${name}</span>
        <span class="text-xs text-txt-muted">${fmtNum(aspect.mentions ?? aspect.total_mentions)} mentions${reliable ? "" : " · small sample"}</span>
      </div>
      <div class="progress-track flex">
        <div class="progress-fill bg-negative" style="width:${neg}%"></div>
        <div class="progress-fill bg-positive" style="width:${pos}%"></div>
      </div>
      <div class="flex justify-between mt-1 text-[11px] text-txt-muted">
        <span>${fmtPct(neg)} negative</span>
        <span>${fmtPct(pos)} positive</span>
      </div>
    </div>`;
}

function makeSentimentDoughnut(canvasId, summary) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const c = chartColors();
  return new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Positive", "Neutral", "Negative"],
      datasets: [{
        data: [summary.pct_positive || 0, summary.pct_neutral || 0, summary.pct_negative || 0],
        backgroundColor: [c.positive, c.neutralc, c.negative],
        borderColor: c.border,
        borderWidth: 3,
      }],
    },
    options: {
      plugins: {
        legend: { position: "bottom", labels: { color: c.text, font: { size: 11 }, padding: 14 } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${c.raw.toFixed(1)}%` } },
      },
      cutout: "68%",
    },
  });
}

function skeletonCards(n, heightClass = "h-40") {
  return Array.from({ length: n }, () => `<div class="skeleton ${heightClass} rounded-2xl"></div>`).join("");
}

async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function apiPost(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}
