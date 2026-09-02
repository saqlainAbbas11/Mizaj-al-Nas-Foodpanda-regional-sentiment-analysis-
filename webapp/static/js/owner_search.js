async function doSearch() {
  const q = document.getElementById("owner-search-input").value.trim();
  const box = document.getElementById("owner-search-results");
  if (!q) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = skeletonCards(3, "h-16");
  try {
    const data = await apiGet(`/api/restaurants?search=${encodeURIComponent(q)}&per_page=15`);
    box.innerHTML =
      data.results
        .map(
          (r) => `
      <a href="/owner/${r.storeid}" class="glass glass-hover rounded-2xl p-4 flex items-center gap-4 fade-in">
        <div class="icon-wrap flex-shrink-0" style="background:var(--brand-light);width:40px;height:40px;border-radius:10px">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-txt truncate">${r.completestorename}</h4>
          <div class="flex items-center gap-3 mt-1">
            <span class="text-xs text-txt-muted flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${r.city}
            </span>
            <span class="text-xs text-txt-muted flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              ${fmtNum(r.review_count)} reviews
            </span>
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-txt-muted flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
      </a>`
        )
        .join("") || `<div class="text-center py-10"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-txt-muted mx-auto mb-3 opacity-40"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p class="text-sm text-txt-muted">No restaurant found with that name. Try a different spelling or shorter name.</p></div>`;
  } catch (e) {
    box.innerHTML = `<div class="glass rounded-2xl p-4 text-negative text-sm">${e.message}</div>`;
  }
}

const debouncedSearch = debounce(doSearch, 350);
