// ============================================================
// PICOPY - app.js
// All conversion logic - no API needed, runs in browser only
// ============================================================

let selectedFormat = 'pdf';
const DAILY_LIMIT = 50;

// ── Format selection ────────────────────────────────────────
function selectFormat(btn) {
  document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedFormat = btn.dataset.fmt;
}

// ── Parse conversation into Q&A pairs ──────────────────────
function parseConversation(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const pairs = [];
  let current = null;

  const userPattern = /^(you|user|human|student|me)\s*:/i;
  const aiPattern = /^(ai|assistant|claude|chatgpt|gpt|gemini|bot|copilot|answer|a)\s*:/i;

  for (const line of lines) {
    if (userPattern.test(line)) {
      if (current) pairs.push(current);
      current = {
        q: line.replace(userPattern, '').trim(),
        a: ''
      };
    } else if (aiPattern.test(line)) {
      if (current) current.a = line.replace(aiPattern, '').trim();
      else current = { q: '', a: line.replace(aiPattern, '').trim() };
    } else if (current) {
      if (current.a) current.a += ' ' + line;
      else if (current.q) current.a += line + ' ';
      else current.q += line;
    }
  }
  if (current) pairs.push(current);

  // fallback: if no patterns found, just split by blank lines
  if (pairs.length === 0) {
    const blocks = text.split(/\n\n+/).filter(b => b.trim());
    blocks.forEach((block, i) => {
      pairs.push({ q: `Point ${i + 1}`, a: block.trim() });
    });
  }

  return pairs.filter(p => p.q || p.a);
}

// ── Check & update daily limit ──────────────────────────────
function checkLimit() {
  const today = new Date().toDateString();
  const stored = JSON.parse(localStorage.getItem('picopy_usage') || '{}');
  if (stored.date !== today) {
    localStorage.setItem('picopy_usage', JSON.stringify({ date: today, count: 0 }));
    return true;
  }
  if (stored.count >= DAILY_LIMIT) {
    document.getElementById('popup-overlay').style.display = 'flex';
    return false;
  }
  return true;
}

function incrementCount() {
  const today = new Date().toDateString();
  const stored = JSON.parse(localStorage.getItem('picopy_usage') || '{}');
  const count = stored.date === today ? stored.count + 1 : 1;
  localStorage.setItem('picopy_usage', JSON.stringify({ date: today, count }));
}

// ── Progress bar animation ──────────────────────────────────
function showProgress(callback) {
  const wrap = document.getElementById('progress-wrap');
  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');
  const success = document.getElementById('success-box');
  success.style.display = 'none';
  wrap.style.display = 'block';

  const messages = [
    'Reading your conversation...',
    'Detecting Q&A pairs...',
    'Formatting content...',
    'Preparing your document...',
    'Almost done!'
  ];

  let pct = 0;
  let msgIdx = 0;
  label.textContent = messages[0];

  const interval = setInterval(() => {
    pct += Math.random() * 18 + 5;
    if (pct > 92) pct = 92;
    fill.style.width = pct + '%';
    const newIdx = Math.floor((pct / 100) * messages.length);
    if (newIdx !== msgIdx && newIdx < messages.length) {
      msgIdx = newIdx;
      label.textContent = messages[msgIdx];
    }
  }, 250);

  setTimeout(() => {
    clearInterval(interval);
    fill.style.width = '100%';
    label.textContent = 'Done!';
    callback();
    setTimeout(() => {
      wrap.style.display = 'none';
      fill.style.width = '0%';
      success.style.display = 'block';
      setTimeout(() => { success.style.display = 'none'; }, 4000);
    }, 500);
  }, 2500);
}

// ── Main convert function ───────────────────────────────────
function convertChat() {
  const input = document.getElementById('chat-input').value.trim();
  if (!input) { showToast('⚠️ Please paste a conversation first!'); return; }
  if (!checkLimit()) return;

  showProgress(() => {
    const pairs = parseConversation(input);
    incrementCount();

    if (selectedFormat === 'pdf') downloadPDF(pairs, input);
    else if (selectedFormat === 'word') downloadWord(pairs);
    else if (selectedFormat === 'ppt') downloadPPT(pairs);
    else if (selectedFormat === 'txt') downloadTXT(pairs);

    showFlashcards(pairs);
  });
}

// ── PDF Download ────────────────────────────────────────────
function downloadPDF(pairs, rawText) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210, pageH = 297;
  const margin = 20;
  const lineW = pageW - margin * 2;
  let y = margin;

  const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  // Title page
  doc.setFillColor(83, 74, 183);
  doc.rect(0, 0, pageW, 60, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('Picopy', margin, 28);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text('AI Chat Study Document', margin, 40);
  doc.text(today, margin, 50);

  y = 80;
  doc.setTextColor(30, 30, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Study Notes', margin, y);
  y += 8;
  doc.setDrawColor(83, 74, 183);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 12;

  pairs.forEach((pair, i) => {
    if (y > pageH - 40) { doc.addPage(); addPageHeader(doc, margin, pageW); y = 40; }

    // Question
    doc.setFillColor(237, 237, 254);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const qLines = doc.splitTextToSize(`Q${i + 1}: ${pair.q}`, lineW - 4);
    const qH = qLines.length * 6 + 6;
    doc.roundedRect(margin, y - 4, lineW, qH, 3, 3, 'F');
    doc.setTextColor(83, 74, 183);
    doc.text(qLines, margin + 3, y + 2);
    y += qH + 4;

    // Answer
    if (pair.a) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(60, 60, 80);
      const aLines = doc.splitTextToSize(pair.a, lineW - 4);
      aLines.forEach(line => {
        if (y > pageH - 25) { doc.addPage(); addPageHeader(doc, margin, pageW); y = 35; }
        doc.text(line, margin + 3, y);
        y += 6;
      });
    }
    y += 8;
  });

  // Page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(180, 180, 180);
    doc.text(`Picopy · Page ${p} of ${totalPages}`, pageW / 2, pageH - 8, { align: 'center' });
  }

  doc.save('picopy-study-notes.pdf');
}

function addPageHeader(doc, margin, pageW) {
  doc.setFillColor(83, 74, 183);
  doc.rect(0, 0, pageW, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Picopy Study Document', margin, 10);
}

// ── Word Download ───────────────────────────────────────────
function downloadWord(pairs) {
  try {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;
    const today = new Date().toLocaleDateString('en-IN');

    const children = [
      new Paragraph({
        text: 'Picopy Study Document',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [new TextRun({ text: `Generated on ${today}`, color: '888888', size: 22 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    ];

    pairs.forEach((pair, i) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Q${i + 1}: ${pair.q}`, bold: true, color: '534AB7', size: 26 })],
          spacing: { before: 300, after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({ text: pair.a || '', size: 22, color: '333333' })],
          spacing: { after: 200 },
        })
      );
    });

    const doc2 = new Document({ sections: [{ children }] });
    Packer.toBlob(doc2).then(blob => {
      saveAs(blob, 'picopy-study-notes.docx');
    });
  } catch (e) {
    showToast('Word export failed. Try PDF instead.');
    console.error(e);
  }
}

// ── PowerPoint Download ─────────────────────────────────────
function downloadPPT(pairs) {
  try {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };

    // Title slide
    const title = pptx.addSlide();
    title.background = { color: '534AB7' };
    title.addText('Picopy Study Slides', { x: 0.5, y: 1.5, w: 9, h: 1.2, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center' });
    title.addText(`Generated on ${new Date().toLocaleDateString('en-IN')}`, { x: 0.5, y: 3.2, w: 9, h: 0.6, fontSize: 18, color: 'C5BFF5', align: 'center' });

    // Content slides
    pairs.forEach((pair, i) => {
      const slide = pptx.addSlide();
      slide.background = { color: 'F8F7FF' };

      // Header bar
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.7, fill: { color: '534AB7' } });
      slide.addText('Picopy', { x: 0.2, y: 0.1, w: 3, h: 0.5, fontSize: 14, bold: true, color: 'FFFFFF' });
      slide.addText(`${i + 1} / ${pairs.length}`, { x: 8, y: 0.1, w: 1.8, h: 0.5, fontSize: 12, color: 'C5BFF5', align: 'right' });

      // Question box
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.4, y: 0.9, w: 9.2, h: 1.1, fill: { color: 'EEEDFE' }, rectRadius: 0.1 });
      slide.addText(`Q: ${pair.q}`, { x: 0.6, y: 0.95, w: 8.8, h: 1.0, fontSize: 16, bold: true, color: '534AB7' });

      // Answer
      if (pair.a) {
        slide.addText(pair.a, { x: 0.4, y: 2.2, w: 9.2, h: 2.8, fontSize: 14, color: '333333', valign: 'top', wrap: true });
      }
    });

    pptx.writeFile({ fileName: 'picopy-study-slides.pptx' });
  } catch (e) {
    showToast('PowerPoint export failed. Try PDF instead.');
    console.error(e);
  }
}

// ── Text Download ───────────────────────────────────────────
function downloadTXT(pairs) {
  const today = new Date().toLocaleDateString('en-IN');
  let content = `PICOPY STUDY NOTES\nGenerated: ${today}\n${'='.repeat(50)}\n\n`;
  pairs.forEach((pair, i) => {
    content += `Q${i + 1}: ${pair.q}\n`;
    if (pair.a) content += `A: ${pair.a}\n`;
    content += '\n';
  });
  const blob = new Blob([content], { type: 'text/plain' });
  saveAs(blob, 'picopy-study-notes.txt');
}

// ── Copy to clipboard ───────────────────────────────────────
function copyText() {
  const input = document.getElementById('chat-input').value.trim();
  if (!input) { showToast('Nothing to copy!'); return; }
  const pairs = parseConversation(input);
  let text = 'PICOPY STUDY NOTES\n\n';
  pairs.forEach((p, i) => {
    text += `Q${i+1}: ${p.q}\nA: ${p.a}\n\n`;
  });
  navigator.clipboard.writeText(text)
    .then(() => showToast('✅ Copied to clipboard!'))
    .catch(() => showToast('Could not copy. Try selecting manually.'));
}

// ── Flashcards ──────────────────────────────────────────────
function showFlashcards(pairs) {
  const section = document.getElementById('flashcards-section');
  const grid = document.getElementById('flashcards-grid');
  grid.innerHTML = '';

  pairs.forEach((pair, i) => {
    if (!pair.q) return;
    const card = document.createElement('div');
    card.className = 'flashcard';
    card.innerHTML = `
      <div class="fc-num">#${i + 1}</div>
      <div class="fc-q">${pair.q}</div>
      <div class="fc-a">${pair.a || '—'}</div>
      <div class="fc-hint">👆 Click to reveal answer</div>
    `;
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
      card.querySelector('.fc-hint').textContent = card.classList.contains('flipped') ? '👆 Click to hide' : '👆 Click to reveal answer';
    });
    grid.appendChild(card);
  });

  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeFlashcards() {
  document.getElementById('flashcards-section').style.display = 'none';
}

// ── Share app ───────────────────────────────────────────────
function shareApp() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: 'Picopy — Turn AI chats into study documents', url });
  } else {
    navigator.clipboard.writeText(url);
    showToast('Link copied! Share it with a friend 🎉');
  }
  closePopup();
}

function closePopup() {
  document.getElementById('popup-overlay').style.display = 'none';
}

// ── Toast notification ──────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── On page load ────────────────────────────────────────────
window.addEventListener('load', () => {
  // Reset midnight check
  const stored = JSON.parse(localStorage.getItem('picopy_usage') || '{}');
  if (stored.date !== new Date().toDateString()) {
    localStorage.setItem('picopy_usage', JSON.stringify({ date: new Date().toDateString(), count: 0 }));
  }
});
