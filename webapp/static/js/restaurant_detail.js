let allReviews = [];

async function loadRestaurant() {
  try {
    const data = await apiGet(`/api/restaurants/${encodeURIComponent(STOREID)}`);
    const r = data.restaurant;

    document.getElementById("resto-back").innerHTML =
      `<a href="/user?city=${encodeURIComponent(r.city)}" class="hover:text-txt transition inline-flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>Back to ${r.city}</a>`;

    document.getElementById("resto-name").textContent = r.completestorename;
    document.getElementById("resto-sub").textContent = `${r.city} · ${fmtNum(r.review_count)} reviews analyzed`;
    document.getElementById("resto-review-count").textContent = fmtNum(r.review_count);

    const dominant = r.pct_positive >= r.pct_negative ? "positive" : "negative";
    document.getElementById("resto-overall-badge").innerHTML = sentimentBadge(dominant);

    makeSentimentDoughnut("resto-sentiment-chart", r);

    const aspects = data.aspects.filter((a) => a.reliable_sample);
    const aspectsToShow = aspects.length ? aspects : data.aspects;
    document.getElementById("resto-aspects").innerHTML =
      aspectsToShow.map(aspectRowHTML).join("") ||
      '<p class="text-sm text-txt-muted">Not enough reviews yet for a reliable aspect breakdown.</p>';

    allReviews = data.sample_reviews;
    renderReviews("all");

    document.getElementById("resto-loading").classList.add("hidden");
    document.getElementById("resto-content").classList.remove("hidden");
  } catch (e) {
    document.getElementById("resto-loading").innerHTML =
      `<p class="text-negative">Couldn't load this restaurant: ${e.message}</p>`;
  }
}

function renderReviews(filter) {
  const filtered = filter === "all" ? allReviews : allReviews.filter((r) => r.sentiment_final === filter);
  const container = document.getElementById("resto-reviews");
  container.innerHTML =
    filtered
      .map((r) => {
        const aspects = (r.aspects || "")
          .split(",")
          .filter(Boolean)
          .map((a) => `<span class="aspect-chip">${a.replace(/_/g, " ")}</span>`)
          .join(" ");
        return `
      <div class="glass rounded-2xl p-5 fade-in">
        <div class="flex items-start justify-between gap-3 mb-2">
          ${sentimentBadge(r.sentiment_final)}
          <span class="text-xs text-txt-muted">★ ${r.overall} · ${(r.ensemble_confidence * 100).toFixed(0)}% confidence</span>
        </div>
        <p class="text-sm text-txt-sub leading-relaxed">"${escapeHtml(r.text)}"</p>
        ${aspects ? `<div class="flex flex-wrap gap-1.5 mt-3">${aspects}</div>` : ""}
      </div>`;
      })
      .join("") || '<p class="text-sm text-txt-muted py-6 text-center">No reviews in this category.</p>';
}

function filterReviews(filter) {
  document.querySelectorAll("#review-filter-tabs .tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.filter === filter);
  });
  renderReviews(filter);
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", loadRestaurant);
