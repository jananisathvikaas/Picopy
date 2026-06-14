# Picopy — From Prompt to Paper

> Turn AI conversations into beautiful study documents.

Picopy transforms your ChatGPT, Claude, or Gemini conversations into clean, structured PDFs, Word docs, flashcards, and slides — powered by the Claude API.

![Picopy](https://img.shields.io/badge/built%20with-Claude%20API-7B4FE0?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-D93CAA?style=flat-square)

---

## ✦ Features

- **Auto-structure** — Titles, headings, and chapters generated from your chat
- **Filler removal** — Strips "Sure!", "Of course!" and keeps only useful content
- **Table of contents** — Auto-generated for longer documents
- **5 output formats** — PDF, Word, Slides, Study Notes, Flashcards
- **Real PDF download** — Powered by jsPDF, downloads instantly
- **Copy for Word/Notion** — Clean Markdown output you can paste anywhere
- **No backend needed** — Runs entirely in the browser

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/picopy.git
cd picopy
```

### 2. Open in browser

No build step needed — just open `index.html` in any browser:

```bash
open index.html
# or just double-click index.html in your file explorer
```

### 3. Add your API key

- Get a free API key from [console.anthropic.com](https://console.anthropic.com/settings/keys)
- Paste it into the API key field in the app
- Click **Save** — it's stored in your browser only, never sent anywhere except Anthropic

### 4. Convert

1. Paste any AI conversation into the text area
2. Choose your output format
3. Hit **Convert with Picopy**

---

## 📁 Project Structure

```
picopy/
├── index.html        # Main app (single page)
├── src/
│   ├── style.css     # All styles — dark theme, purple-pink gradient
│   └── app.js        # Claude API integration, PDF export, rendering
└── README.md
```

---

## 🔑 API Key

Picopy uses the [Anthropic Claude API](https://www.anthropic.com/) (`claude-sonnet-4-6`).

- Your API key is **only stored in your browser's localStorage**
- It is **never sent to any server other than api.anthropic.com**
- You can clear it anytime from your browser's developer tools

---

## 💡 How It Works

1. You paste an AI conversation
2. Picopy sends it to Claude with a smart formatting prompt
3. Claude returns clean, structured Markdown
4. Picopy renders it in the preview and lets you download as PDF or copy as text

---

## 🛠 Extending Picopy

### Add more export formats
Edit the `downloadDoc()` function in `src/app.js`.  
For `.docx` export, add the [docx.js](https://github.com/dolanmiu/docx) library.

### Add a user library
Use `localStorage` to save generated documents with a unique ID.

### Add URL import
To actually import shared conversation links (Claude, ChatGPT), you'll need a small backend proxy since browsers block cross-origin requests. A simple Node/Express or Python FastAPI server works well.

### Deploy online
- **Vercel**: `vercel --prod` (free, instant)
- **Netlify**: drag and drop the folder at netlify.com
- **GitHub Pages**: Settings → Pages → Deploy from branch

---

## 📄 License

MIT — use freely, build on it, make it your own.

---

*Picopy · From Prompt to Paper*
