let chatHistory = [];

async function loadDashboard() {
  try {
    const data = await apiGet(`/api/restaurants/${encodeURIComponent(STOREID)}`);
    const r = data.restaurant;

    document.getElementById("dash-resto-name").textContent = r.completestorename;
    document.getElementById("dash-resto-sub").innerHTML = `
      <span class="inline-flex items-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${r.city}
      </span>
      <span class="mx-2 text-txt-muted">&middot;</span>
      <span>${fmtNum(r.review_count)} reviews analyzed</span>
    `;

    // KPI strip
    const pos = (r.pct_positive || 0).toFixed(1);
    const neg = (r.pct_negative || 0).toFixed(1);
    const neu = (r.pct_neutral || 0).toFixed(1);
    const aspects = data.aspects.filter((a) => a.reliable_sample);
    const topComplaint = (aspects.length ? aspects : data.aspects).sort((a, b) => b.pct_negative - a.pct_negative)[0];
    const topComplaintName = topComplaint ? (topComplaint.aspect || "").replace(/_/g, " ") : "N/A";

    document.getElementById("dash-kpi-strip").innerHTML = `
      <div class="glass rounded-xl p-4">
        <div class="text-[11px] text-txt-muted mb-1 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Total reviews
        </div>
        <div class="font-display font-bold text-xl text-txt">${fmtNum(r.review_count)}</div>
      </div>
      <div class="glass rounded-xl p-4">
        <div class="text-[11px] text-txt-muted mb-1 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          Positive
        </div>
        <div class="font-display font-bold text-xl text-positive">${pos}%</div>
      </div>
      <div class="glass rounded-xl p-4">
        <div class="text-[11px] text-txt-muted mb-1 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          Negative
        </div>
        <div class="font-display font-bold text-xl text-negative">${neg}%</div>
      </div>
      <div class="glass rounded-xl p-4">
        <div class="text-[11px] text-txt-muted mb-1 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Top issue
        </div>
        <div class="font-display font-bold text-sm text-txt capitalize mt-1">${topComplaintName}</div>
      </div>
    `;

    makeSentimentDoughnut("dash-sentiment-chart", r);

    const aspectsToShow = (aspects.length ? aspects : data.aspects).slice().sort((a, b) => b.pct_negative - a.pct_negative);
    document.getElementById("dash-aspects").innerHTML =
      aspectsToShow.map(aspectRowHTML).join("") ||
      '<p class="text-sm text-txt-muted">Not enough reviews yet for a reliable breakdown.</p>';

    document.getElementById("dash-loading").classList.add("hidden");
    document.getElementById("dash-content").classList.remove("hidden");
  } catch (e) {
    document.getElementById("dash-loading").innerHTML = `
      <div class="glass rounded-2xl p-6 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-negative mx-auto mb-3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p class="text-negative text-sm">Couldn't load dashboard: ${e.message}</p>
      </div>`;
  }
}

/** Lightweight markdown → HTML renderer for Groq assistant responses */
function renderMarkdown(raw) {
  // Pre-process: mark blockquotes before HTML escaping converts > to &gt;
  raw = raw.replace(/^(\s*)&gt;\s?/gm, '$1&gt;');
  // Detect blockquotes on raw text, store markers
  const bqMap = {};
  let bqIdx = 0;
  raw = raw.replace(/^(\s*)>\s?(.*)$/gm, (_, ws, content) => {
    const key = `\x00BQ${bqIdx++}\x00`;
    bqMap[key] = content;
    return key;
  });

  let html = raw;
  // Escape HTML entities (safety)
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  // Restore > (was already safe in blockquote placeholders)
  // Note: &gt; in original text stays as-is

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="chat-code">$1</code>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic (single *)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  const out = [];
  let inUl = false, inOl = false;

  function closeUl() { if (inUl) { out.push('</ul>'); inUl = false; } }
  function closeOl() { if (inOl) { out.push('</ol>'); inOl = false; } }
  function closeAll() { closeUl(); closeOl(); }

  const lines = html.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // --- Blockquote placeholder ---
    const bqMatch = line.match(/^\x00BQ(\d+)\x00$/);
    if (bqMatch) {
      closeAll();
      const content = bqMap['\x00BQ' + bqMatch[1] + '\x00'];
      // Escape HTML in blockquote content
      const safe = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      out.push('<blockquote class="chat-blockquote">' + safe + '</blockquote>');
      continue;
    }

    // --- Table start: current line has |, next line is |---|---| separator ---
    if (/^\s*\|/.test(line) && i + 1 < lines.length &&
        /^\s*\|[\s\-:|]+\|\s*$/.test(lines[i + 1])) {
      closeAll();
      const headerCells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      let table = '<div class="chat-table-wrap"><table class="chat-table"><thead><tr>';
      for (const c of headerCells) table += '<th>' + c + '</th>';
      table += '</tr></thead><tbody>';
      i += 2; // skip header + separator
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].split('|').filter(c => c.trim()).map(c => c.trim());
        table += '<tr>';
        for (const c of cells) table += '<td>' + c + '</td>';
        table += '</tr>';
        i++;
      }
      table += '</tbody></table></div>';
      out.push(table);
      i--; // back up since loop will i++
      continue;
    }

    // --- Heading ---
    if (/^#{1,4}\s+/.test(line)) {
      closeAll();
      const level = line.match(/^(#{1,4})/)[1].length;
      const text = line.replace(/^#{1,4}\s+/, '');
      const tag = 'h' + Math.min(level + 3, 6);
      out.push('<' + tag + ' class="chat-heading">' + text + '</' + tag + '>');
      continue;
    }

    // --- Unordered list (supports -, *, and • bullets) ---
    if (/^\s*[-*\u2022]\s/.test(line)) {
      closeOl();
      if (!inUl) { out.push('<ul class="chat-ul">'); inUl = true; }
      out.push('<li>' + line.replace(/^\s*[-*\u2022]\s+/, '') + '</li>');
      continue;
    }

    // --- Ordered list ---
    if (/^\s*\d+\.\s/.test(line)) {
      closeUl();
      if (!inOl) { out.push('<ol class="chat-ol">'); inOl = true; }
      out.push('<li>' + line.replace(/^\s*\d+\.\s+/, '') + '</li>');
      continue;
    }

    // --- Horizontal rule ---
    if (/^\s*[-*_]{3,}\s*$/.test(line)) {
      closeAll();
      out.push('<hr class="chat-hr">');
      continue;
    }

    // --- Empty line ---
    if (/^\s*$/.test(line)) {
      closeAll();
      continue;
    }

    // --- Plain paragraph ---
    closeAll();
    out.push('<p>' + line + '</p>');
  }
  closeAll();
  return out.join('');
}

function appendMessage(role, text) {
  const container = document.getElementById("chat-messages");
  const bubble = document.createElement("div");
  if (role === "user") {
    bubble.className = "chat-bubble-user rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-[85%] ml-auto text-white fade-in";
    bubble.innerHTML = `
      <div class="flex items-start gap-2 justify-end">
        <div>${text}</div>
      </div>`;
  } else {
    bubble.className = "chat-bubble-assistant rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[85%] fade-in";
    const formatted = renderMarkdown(text);
    bubble.innerHTML = `
      <div class="flex items-start gap-2">
        <div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style="background:var(--brand-light)">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="chat-formatted leading-relaxed">${formatted}</div>
      </div>`;
  }
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function askQuick(text) {
  document.getElementById("chat-input").value = text;
  sendChatMessage();
}

async function sendChatMessage() {
  const input = document.getElementById("chat-input");
  const btn = document.getElementById("chat-send-btn");
  const errorBox = document.getElementById("chat-error");
  const message = input.value.trim();
  if (!message) return;

  errorBox.classList.add("hidden");
  appendMessage("user", message);
  input.value = "";
  btn.disabled = true;

  const typingBubble = document.createElement("div");
  typingBubble.className = "chat-bubble-assistant rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[85%] fade-in";
  typingBubble.id = "typing-indicator";
  typingBubble.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style="background:var(--brand-light)">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <span class="animate-pulse text-txt-muted">Analyzing your data...</span>
    </div>`;
  document.getElementById("chat-messages").appendChild(typingBubble);
  document.getElementById("chat-messages").scrollTop = document.getElementById("chat-messages").scrollHeight;

  try {
    const data = await apiPost("/api/owner/assistant", { storeid: STOREID, message, history: chatHistory });
    document.getElementById("typing-indicator")?.remove();
    appendMessage("assistant", data.reply);
    chatHistory.push({ role: "user", content: message });
    chatHistory.push({ role: "assistant", content: data.reply });
    chatHistory = chatHistory.slice(-10); // keep the payload bounded
  } catch (e) {
    document.getElementById("typing-indicator")?.remove();
    errorBox.textContent = `Assistant unavailable: ${e.message}. (Make sure GROQ_API_KEY is set in .env)`;
    errorBox.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", loadDashboard);
