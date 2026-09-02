// State
let currentProvince = null;
let currentCity = null;
let restoPage = 1;
let restoSearch = "";
let sentimentChart = null;

const views = ["view-provinces", "view-cities", "view-city-detail"];
function showView(id) {
  views.forEach((v) => document.getElementById(v).classList.toggle("hidden", v !== id));
}

function updateBreadcrumb(parts) {
  const el = document.getElementById("breadcrumb");
  el.innerHTML = parts
    .map((p, i) =>
      i === parts.length - 1
        ? `<span class="text-txt">${p.label}</span>`
        : `<button onclick="${p.action}" class="hover:text-txt transition">${p.label}</button><span>/</span>`
    )
    .join(" ");
}

// ---------------- VIEW 1: Provinces ----------------
async function showProvinces() {
  currentProvince = null;
  showView("view-provinces");
  updateBreadcrumb([{ label: "All Provinces", action: "showProvinces()" }]);

  const grid = document.getElementById("province-grid");
  try {
    const provinces = await apiGet("/api/provinces");
    grid.innerHTML = provinces
      .map(
        (p) => `
      <button onclick="openProvince('${p.province.replace(/'/g, "\\'")}')"
              class="glass glass-hover rounded-3xl overflow-hidden text-left group">
        <div class="banner-wrap h-32">
          <img src="/static/img/banners/${p.banner_slug}.svg" alt="">
          <div class="banner-fade"></div>
        </div>
        <div class="p-5">
          <h3 class="font-display font-bold text-lg group-hover:text-brand transition text-txt">${p.province}</h3>
          <p class="text-sm text-txt-muted mt-1">${p.city_count} cities · ${fmtNum(p.review_count)} reviews</p>
        </div>
      </button>`
      )
      .join("");
  } catch (e) {
    grid.innerHTML = `<p class="text-negative col-span-full">Couldn't load provinces: ${e.message}</p>`;
  }
}

// ---------------- VIEW 2: Cities in a province ----------------
async function openProvince(province) {
  currentProvince = province;
  showView("view-cities");
  document.getElementById("cities-title").textContent = province;
  updateBreadcrumb([
    { label: "All Provinces", action: "showProvinces()" },
    { label: province, action: `openProvince('${province.replace(/'/g, "\\'")}')` },
  ]);

  const grid = document.getElementById("city-grid");
  grid.innerHTML = skeletonCards(6, "h-44");
  try {
    const cities = await apiGet(`/api/cities?province=${encodeURIComponent(province)}`);
    grid.innerHTML = cities
      .map(
        (c) => `
      <button onclick="openCity('${c.city.replace(/'/g, "\\'")}')" class="glass glass-hover rounded-2xl p-5 text-left fade-in">
        <div class="flex items-start justify-between mb-3">
          <h3 class="font-display font-semibold text-lg text-txt">${c.city}</h3>
          ${sentimentBadge(c.pct_positive >= c.pct_negative ? "positive" : "negative")}
        </div>
        <div class="progress-track flex mb-2">
          <div class="progress-fill bg-negative" style="width:${c.pct_negative}%"></div>
          <div class="progress-fill bg-neutralc" style="width:${c.pct_neutral}%"></div>
          <div class="progress-fill bg-positive" style="width:${c.pct_positive}%"></div>
        </div>
        <div class="flex justify-between text-xs text-txt-muted">
          <span>${fmtNum(c.review_count)} reviews</span>
          <span>★ ${Number(c.avg_star_rating).toFixed(1)} avg</span>
        </div>
        ${!c.reliable_sample ? '<div class="mt-2 text-[11px] text-amber">Small sample — interpret cautiously</div>' : ""}
      </button>`
      )
      .join("");
  } catch (e) {
    grid.innerHTML = `<p class="text-negative col-span-full">Couldn't load cities: ${e.message}</p>`;
  }
}

// ---------------- VIEW 3: City detail ----------------
async function openCity(city) {
  currentCity = city;
  restoPage = 1;
  restoSearch = "";
  document.getElementById("restaurant-search").value = "";
  showView("view-city-detail");
  updateBreadcrumb([
    { label: "All Provinces", action: "showProvinces()" },
    { label: currentProvince || "Province", action: `openProvince('${(currentProvince || "").replace(/'/g, "\\'")}')` },
    { label: city, action: `openCity('${city.replace(/'/g, "\\'")}')` },
  ]);

  document.getElementById("city-detail-title").textContent = city;
  document.getElementById("city-aspects").innerHTML = skeletonCards(4, "h-16");
  document.getElementById("restaurant-list").innerHTML = skeletonCards(5, "h-20");

  try {
    const data = await apiGet(`/api/cities/${encodeURIComponent(city)}`);
    document.getElementById("city-banner-img").src = `/static/img/banners/${data.banner_slug}.svg`;
    document.getElementById("city-detail-sub").textContent =
      `${data.province} · ${fmtNum(data.summary.review_count)} reviews · ★ ${Number(data.summary.avg_star_rating).toFixed(1)} avg rating`;

    if (sentimentChart) sentimentChart.destroy();
    sentimentChart = makeSentimentDoughnut("city-sentiment-chart", data.summary);

    const reliableAspects = data.aspects.filter((a) => a.reliable_sample);
    const aspectsToShow = reliableAspects.length ? reliableAspects : data.aspects;
    document.getElementById("city-aspects").innerHTML =
      aspectsToShow.slice(0, 6).map(aspectRowHTML).join("") ||
      '<p class="text-sm text-txt-muted">Not enough data for an aspect breakdown yet.</p>';

    await loadRestaurants();
  } catch (e) {
    document.getElementById("city-aspects").innerHTML = `<p class="text-negative">Couldn't load city detail: ${e.message}</p>`;
  }
}

// ---------------- Restaurant list within a city ----------------
async function loadRestaurants() {
  const list = document.getElementById("restaurant-list");
  list.innerHTML = skeletonCards(5, "h-20");
  try {
    const params = new URLSearchParams({ city: currentCity, page: restoPage, per_page: 10 });
    if (restoSearch) params.set("search", restoSearch);
    const data = await apiGet(`/api/restaurants?${params}`);

    list.innerHTML =
      data.results
        .map(
          (r) => `
      <a href="/user/restaurant/${r.storeid}" class="glass glass-hover rounded-2xl p-4 flex items-center justify-between fade-in">
        <div>
          <h4 class="font-semibold text-txt">${r.completestorename}</h4>
          <p class="text-xs text-txt-muted mt-0.5">${fmtNum(r.review_count)} reviews</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right hidden sm:block">
            <div class="text-xs text-positive">${fmtPct(r.pct_positive)} positive</div>
            <div class="text-xs text-negative">${fmtPct(r.pct_negative)} negative</div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-txt-muted flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </a>`
        )
        .join("") || '<p class="text-sm text-txt-muted py-6 text-center">No restaurants match that search.</p>';

    const totalPages = Math.max(1, Math.ceil(data.total / data.per_page));
    document.getElementById("resto-page-label").textContent = `Page ${restoPage} of ${totalPages}`;
    document.getElementById("resto-prev").disabled = restoPage <= 1;
    document.getElementById("resto-next").disabled = restoPage >= totalPages;
  } catch (e) {
    list.innerHTML = `<p class="text-negative">Couldn't load restaurants: ${e.message}</p>`;
  }
}

function changeRestaurantPage(delta) {
  restoPage = Math.max(1, restoPage + delta);
  loadRestaurants();
}

const debouncedSearchRestaurants = debounce(() => {
  restoSearch = document.getElementById("restaurant-search").value.trim();
  restoPage = 1;
  loadRestaurants();
}, 350);

// ---------------- init ----------------
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const city = params.get("city");
  const province = params.get("province");
  if (city) {
    openCity(city);
  } else if (province) {
    openProvince(province);
  } else {
    showProvinces();
  }
});
