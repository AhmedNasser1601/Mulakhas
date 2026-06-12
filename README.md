# ملخّص · Mulakhas

Smart text utility for summarizing, rephrasing, reading aloud, and extracting text from images, PDFs, and URLs — in any language.

**Live:** https://mulakhas.lovable.app

## Features

- AI-powered summarization and rephrasing in any output language
- Text extraction (OCR) from images and PDFs
- Extract text from a URL (image or PDF link)
- Text-to-speech reading with stop control
- Copy, share, and export results as PDF
- Local history with restore and delete
- Bilingual UI (Arabic / English) with full RTL support
- Works on web, mobile, and desktop browsers

## Tech Stack

- TanStack Start v1 (React 19, file-based routing, SSR)
- Vite 7
- Tailwind CSS v4
- shadcn/ui components
- Lovable Cloud (backend, AI gateway)

## Development

```bash
bun install
bun run dev
```

Open http://localhost:8080.

## Project Structure

```
src/
  routes/          # File-based routes (index.tsx is the home page)
  lib/
    i18n.tsx       # Bilingual dictionary (ar / en)
    api/           # Server functions (createServerFn)
  components/ui/   # shadcn/ui primitives
  styles.css       # Tailwind v4 entry + design tokens
```

## Editing

This project is built with [Lovable](https://lovable.dev). Changes pushed to
this repo sync back to the Lovable editor automatically, and edits made in
Lovable push commits here.

## Credits

Developed by **Ahmed Nasser** / **أحمد ناصر**.
