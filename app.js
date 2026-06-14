// ── State ──
let selectedFmt = 'pdf';
let lastResult = null;

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  // Restore saved API key
  const saved = localStorage.getItem('picopy_api_key');
  if (saved) {
    document.getElementById('apiKey').value = saved;
    document.getElementById('apiKeyGroup').style.opacity = '0.6';
  }

  // Format button selection
  document.querySelectorAll('.fmt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fmt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFmt = btn.dataset.fmt;
    });
  });
});

// ── Save API Key ──
function saveKey() {
  const key = document.getElementById('apiKey').value.trim();
  if (!key.startsWith('sk-ant-')) {
    showToast('Please enter a valid Anthropic API key (starts with sk-ant-)');
    return;
  }
  localStorage.setItem('picopy_api_key', key);
  showToast('API key saved ✓');
  document.getElementById('apiKeyGroup').style.opacity = '0.6';
}

// ── Import Link (UI demo — real fetch needs a backend proxy) ──
function importLink() {
  const link = document.getElementById('linkInput').value.trim();
  if (!link) return;
  document.getElementById('chatInput').value =
    `[Imported from: ${link}]\n\nUser: What is photosynthesis?\n\nAssistant: Photosynthesis is the process by which plants convert sunlight, water, and carbon dioxide into glucose and oxygen. It occurs in the chloroplasts.\n\nUser: Explain the Calvin cycle.\n\nAssistant: The Calvin cycle takes place in the stroma of the chloroplast. It uses ATP and NADPH from the light reactions to fix CO₂ into organic molecules through enzyme-catalyzed reactions.`;
  showToast('Demo content loaded — paste your real chat for actual conversion');
}

// ── Build prompt for Claude ──
function buildPrompt(chatText, format, options) {
  const tocLine = options.toc ? 'Include a table of contents at the start.' : '';
  const fillerLine = options.filler ? 'Remove all filler phrases from the AI (like "Sure!", "Of course!", "Great question!", "Certainly!", "I\'d be happy to help") and keep only the substantive content.' : '';
  const summaryLine = options.summary ? 'Add a 2-3 sentence executive summary at the very top before the TOC.' : '';

  const formatInstructions = {
    pdf: `Convert this into a well-structured study document with:
- A clear document title
- ${tocLine}
- ${summaryLine}
- Organized sections with headings (use ## for section headings)
- Clean paragraphs of content
- ${fillerLine}
Format as clean Markdown.`,

    word: `Convert this into a professional Word-style document with:
- A document title
- ${tocLine}
- ${summaryLine}
- Clear section headings (## for headings)
- Well-written paragraphs
- ${fillerLine}
Format as clean Markdown.`,

    slides: `Convert this into a slide deck outline with:
- A title slide
- One slide per main topic
- Each slide has: a slide title (## Slide N: Title) and 3-5 bullet points
- ${fillerLine}
Format as clean Markdown with ## for slide titles and - for bullets.`,

    notes: `Convert this into concise study notes with:
- A title
- ${tocLine}
- ${summaryLine}
- Key points organized under headings
- Important terms bolded with **term**
- ${fillerLine}
Format as clean Markdown.`,

    flashcards: `Convert this into a set of study flashcards.
- Extract all key concepts, definitions, and facts
- Format as Q&A pairs
- Use this exact format for each card:
  Q: [question]
  A: [answer]
- ${fillerLine}
- Aim for 8-15 flashcards covering the most important points.
Start with "# Flashcard Set: [topic]" then list all cards.`
  };

  return `You are Picopy, a study document generator. Your job is to transform AI conversations into clean, structured study materials.

${formatInstructions[format]}

Here is the AI conversation to convert:

---
${chatText}
---

Respond with ONLY the formatted document. No preamble, no explanation, just the document content.`;
}

// ── Call Claude API ──
async function callClaude(prompt, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ── Render Markdown to HTML (simple parser) ──
function renderMarkdown(md) {
  const lines = md.split('\n');
  let html = '';
  let inFlashcards = false;
  let flashcards = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // H1
    if (line.startsWith('# ')) {
      html += `<h1>${line.slice(2)}</h1>`;
      const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      html += `<div class="doc-meta">Generated by Picopy · ${date}</div>`;
      continue;
    }

    // H2
    if (line.startsWith('## ')) {
      html += `<h2>${line.slice(3)}</h2>`;
      continue;
    }

    // H3
    if (line.startsWith('### ')) {
      html += `<p><strong style="color:#ccc">${line.slice(4)}</strong></p>`;
      continue;
    }

    // Table of contents block
    if (line.toLowerCase().includes('table of contents') && line.startsWith('##')) {
      let tocHtml = '<div class="toc"><div class="toc-title">Table of contents</div>';
      i++;
      while (i < lines.length && lines[i] !== '') {
        const tocLine = lines[i].replace(/^[-*]\s*/, '').replace(/\[([^\]]+)\]\([^)]+\)/, '$1');
        if (tocLine.trim()) tocHtml += `<a href="#">${tocLine.trim()}</a>`;
        i++;
      }
      tocHtml += '</div>';
      html += tocHtml;
      continue;
    }

    // Flashcard Q/A
    if (line.startsWith('Q:')) {
      inFlashcards = true;
      const q = line.slice(2).trim();
      const nextLine = lines[i + 1] || '';
      const a = nextLine.startsWith('A:') ? nextLine.slice(2).trim() : '';
      if (a) i++;
      flashcards.push({ q, a });
      continue;
    }

    // Flush flashcards when we hit a blank or end
    if (inFlashcards && (line === '' || i === lines.length - 1)) {
      if (flashcards.length > 0) {
        html += '<div class="flashcard-grid">';
        flashcards.forEach(fc => {
          html += `<div class="fc"><strong>Q: ${escHtml(fc.q)}</strong><span>${escHtml(fc.a)}</span></div>`;
        });
        html += '</div>';
        flashcards = [];
        inFlashcards = false;
      }
      continue;
    }

    if (inFlashcards) continue;

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('* ')) {
      html += `<p style="padding-left:12px;color:#888">· ${inlineFormat(line.slice(2))}</p>`;
      continue;
    }

    // Blank lines
    if (line.trim() === '') continue;

    // Normal paragraph
    if (line.trim()) {
      html += `<p>${inlineFormat(line)}</p>`;
    }
  }

  // Flush remaining flashcards
  if (flashcards.length > 0) {
    html += '<div class="flashcard-grid">';
    flashcards.forEach(fc => {
      html += `<div class="fc"><strong>Q: ${escHtml(fc.q)}</strong><span>${escHtml(fc.a)}</span></div>`;
    });
    html += '</div>';
  }

  return html;
}

function inlineFormat(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#ccc">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#1a1a1a;padding:1px 5px;border-radius:3px;font-size:12px">$1</code>');
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Main Convert Function ──
async function runConvert() {
  const chatText = document.getElementById('chatInput').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim() || localStorage.getItem('picopy_api_key');

  if (!chatText) {
    showToast('Please paste an AI conversation first');
    document.getElementById('chatInput').focus();
    return;
  }

  if (!apiKey) {
    showToast('Please enter your Anthropic API key above');
    document.getElementById('apiKey').focus();
    return;
  }

  const options = {
    toc: document.getElementById('optToc').checked,
    filler: document.getElementById('optFiller').checked,
    summary: document.getElementById('optSummary').checked
  };

  // Show loading
  const resultWrap = document.getElementById('resultWrap');
  const docPreview = document.getElementById('docPreview');
  const convertBtn = document.getElementById('convertBtn');

  resultWrap.style.display = 'block';
  docPreview.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div><p>Picopy is reading and formatting your conversation...</p></div>';
  convertBtn.disabled = true;
  convertBtn.textContent = 'Converting...';
  resultWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const prompt = buildPrompt(chatText, selectedFmt, options);
    const markdown = await callClaude(prompt, apiKey);

    lastResult = { markdown, format: selectedFmt };
    docPreview.innerHTML = renderMarkdown(markdown);

    // Update download button label
    const labels = { pdf: 'Download PDF', word: 'Copy for Word', slides: 'Copy outline', notes: 'Download PDF', flashcards: 'Copy flashcards' };
    document.getElementById('downloadBtn').textContent = labels[selectedFmt] || 'Download';

    showToast('Document ready ✓');

  } catch (err) {
    docPreview.innerHTML = `<p style="color:#E24B4A">Error: ${err.message}</p><p style="color:#555;margin-top:8px">Check your API key and try again.</p>`;
    showToast('Something went wrong — check your API key');
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = '✦ Convert with Picopy';
  }
}

// ── Download / Export ──
function downloadDoc() {
  if (!lastResult) return;

  if (lastResult.format === 'pdf' || lastResult.format === 'notes') {
    downloadPDF(lastResult.markdown);
  } else {
    copyToClipboard(lastResult.markdown);
    showToast('Copied to clipboard — paste into Word, Notion, or anywhere');
  }
}

function downloadPDF(markdown) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const lines = markdown.split('\n');
    let y = 20;
    const lh = 7;
    const margin = 18;
    const pageW = 210 - margin * 2;

    doc.setFont('helvetica');

    lines.forEach(line => {
      if (y > 270) { doc.addPage(); y = 20; }

      if (line.startsWith('# ')) {
        doc.setFontSize(18); doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(line.slice(2), margin, y); y += lh * 1.8;
        doc.setFont('helvetica', 'normal');
      } else if (line.startsWith('## ')) {
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.setTextColor(123, 79, 224);
        doc.text(line.slice(3).toUpperCase(), margin, y); y += lh * 1.4;
        doc.setFont('helvetica', 'normal');
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        doc.setFontSize(10); doc.setTextColor(150, 150, 150);
        const wrapped = doc.splitTextToSize('· ' + line.slice(2), pageW - 4);
        doc.text(wrapped, margin + 4, y); y += lh * wrapped.length;
      } else if (line.trim() === '') {
        y += lh * 0.4;
      } else if (line.startsWith('Q:')) {
        doc.setFontSize(10); doc.setTextColor(123, 79, 224);
        doc.text('Q: ' + line.slice(2).trim(), margin, y); y += lh;
      } else if (line.startsWith('A:')) {
        doc.setFontSize(10); doc.setTextColor(150, 150, 150);
        const wrapped = doc.splitTextToSize('A: ' + line.slice(2).trim(), pageW);
        doc.text(wrapped, margin, y); y += lh * wrapped.length + 2;
      } else {
        doc.setFontSize(10); doc.setTextColor(180, 180, 180);
        const clean = line.replace(/\*\*/g, '').replace(/\*/g, '');
        const wrapped = doc.splitTextToSize(clean, pageW);
        doc.text(wrapped, margin, y); y += lh * wrapped.length;
      }
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(60, 60, 60);
      doc.text('Generated by Picopy · picopy.app', margin, 287);
      doc.text(`${i} / ${pageCount}`, 210 - margin, 287, { align: 'right' });
    }

    const title = markdown.match(/^# (.+)/m)?.[1] || 'picopy-document';
    doc.save(title.toLowerCase().replace(/\s+/g, '-') + '.pdf');
    showToast('PDF downloaded ✓');

  } catch (err) {
    copyToClipboard(lastResult.markdown);
    showToast('PDF lib not loaded — copied as text instead');
  }
}

// ── Copy text ──
function copyText() {
  if (!lastResult) return;
  copyToClipboard(lastResult.markdown);
  showToast('Copied to clipboard ✓');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  });
}

// ── Toast ──
function showToast(msg) {
  let toast = document.getElementById('piToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'piToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2800);
}
