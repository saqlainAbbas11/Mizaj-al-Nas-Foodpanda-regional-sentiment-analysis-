async function loadMethodology() {
  try {
    const data = await apiGet("/api/methodology");
    const c = chartColors();

    // ---- benchmark table + chart ----
    const tbody = document.getElementById("benchmark-table-body");
    tbody.innerHTML = data.benchmark_results
      .map(
        (b) => `
      <tr class="border-b" style="border-color:var(--border-color)">
        <td class="p-4 font-medium text-txt">${b.method}</td>
        <td class="p-4 text-txt-sub capitalize">${b.language.replace(/_/g, " ")}</td>
        <td class="p-4 font-mono ${b.accuracy >= 0.6 ? "text-positive" : "text-amber"}">${(b.accuracy * 100).toFixed(1)}%</td>
        <td class="p-4 font-mono text-txt-sub">${b.macro_f1.toFixed(3)}</td>
        <td class="p-4 text-txt-muted">${fmtNum(b.n_test)}</td>
      </tr>`
      )
      .join("");

    new Chart(document.getElementById("benchmark-chart"), {
      type: "bar",
      data: {
        labels: data.benchmark_results.map((b) => `${b.method.split(" ")[0]} (${b.language})`),
        datasets: [
          {
            label: "Accuracy",
            data: data.benchmark_results.map((b) => (b.accuracy * 100).toFixed(1)),
            backgroundColor: c.brand,
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: { max: 100, ticks: { color: c.text }, grid: { color: c.grid } },
          y: { ticks: { color: c.text, font: { size: 11 } }, grid: { display: false } },
        },
      },
    });

    // ---- zero-shot discovery ----
    const newCats = data.zero_shot_discovery.filter((z) => z.is_new_category).sort((a, b) => b.pct_of_blind_spot_sample - a.pct_of_blind_spot_sample);
    const missed = data.zero_shot_discovery.filter((z) => !z.is_new_category).sort((a, b) => b.pct_of_blind_spot_sample - a.pct_of_blind_spot_sample);
    document.getElementById("zero-shot-findings").innerHTML = `
      <div class="glass rounded-2xl p-5">
        <h4 class="font-semibold text-sm mb-3 text-mint">New categories discovered</h4>
        ${newCats
          .map(
            (z) => `
          <div class="flex justify-between items-center mb-2 text-sm">
            <span class="capitalize text-txt-sub">${z.label}</span>
            <span class="font-mono text-txt-muted">${z.pct_of_blind_spot_sample.toFixed(1)}%</span>
          </div>`
          )
          .join("")}
      </div>
      <div class="glass rounded-2xl p-5">
        <h4 class="font-semibold text-sm mb-3 text-amber">Existing categories the keyword method missed</h4>
        ${missed
          .map(
            (z) => `
          <div class="flex justify-between items-center mb-2 text-sm">
            <span class="capitalize text-txt-sub">${z.label}</span>
            <span class="font-mono text-txt-muted">${z.pct_of_blind_spot_sample.toFixed(1)}%</span>
          </div>`
          )
          .join("")}
      </div>`;

    // ---- temporal chart ----
    const sortedTemporal = [...data.temporal_trends].sort((a, b) => a.month.localeCompare(b.month));
    new Chart(document.getElementById("temporal-chart"), {
      type: "line",
      data: {
        labels: sortedTemporal.map((t) => t.month),
        datasets: [
          { label: "Positive %", data: sortedTemporal.map((t) => t.positive.toFixed(1)), borderColor: c.positive, tension: 0.3, pointRadius: 0 },
          { label: "Negative %", data: sortedTemporal.map((t) => t.negative.toFixed(1)), borderColor: c.negative, tension: 0.3, pointRadius: 0 },
        ],
      },
      options: {
        plugins: { legend: { labels: { color: c.text } } },
        scales: {
          x: { ticks: { color: c.text, maxRotation: 90, font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: c.text }, grid: { color: c.grid } },
        },
      },
    });

    // ---- reliability chart ----
    const sortedReliability = [...data.city_reliability].sort((a, b) => b.review_count - a.review_count).slice(0, 15);
    new Chart(document.getElementById("reliability-chart"), {
      type: "bar",
      data: {
        labels: sortedReliability.map((c2) => c2.city),
        datasets: [
          {
            label: "Model agreement rate %",
            data: sortedReliability.map((c2) => c2.agreement_rate.toFixed(1)),
            backgroundColor: c.mint,
            borderRadius: 4,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text, maxRotation: 90 }, grid: { display: false } },
          y: { min: 0, max: 100, ticks: { color: c.text }, grid: { color: c.grid } },
        },
      },
    });
  } catch (e) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div class="text-negative text-sm p-3 text-center" style="background:rgba(220,38,38,.08)">Couldn't load methodology data: ${e.message}</div>`
    );
  }
}

document.addEventListener("DOMContentLoaded", loadMethodology);
