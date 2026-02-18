# Font Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Syne + DM Sans + JetBrains Mono with Space Grotesk + Manrope + Fira Code across the BrowserX doc-site.

**Architecture:** Two files change — `astro.config.mjs` gets a new Google Fonts URL, and `global.css` has all font-family references swapped plus minor letter-spacing tweaks. No layout, color, or component changes.

**Tech Stack:** Astro, Starlight, Google Fonts (Space Grotesk, Manrope, Fira Code — all OFL 1.1)

---

### Task 1: Update Google Fonts URL in astro.config.mjs

**Files:**
- Modify: `doc-site/astro.config.mjs`

**Step 1: Open the file and locate the font link tag**

The font `<link>` is in the `head` array inside `starlight({})`. It currently loads Syne, DM Sans, and JetBrains Mono:

```
href: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:ital,wght@0,400;0,600;1,400&display=swap'
```

**Step 2: Replace the href value**

Replace the entire `href` string with:

```
href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@300;400;500;600&family=Fira+Code:wght@400;500;600&display=swap'
```

The full updated `head` array should look like:

```js
head: [
  {
    tag: 'link',
    attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  },
  {
    tag: 'link',
    attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
  },
  {
    tag: 'link',
    attrs: {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@300;400;500;600&family=Fira+Code:wght@400;500;600&display=swap',
    },
  },
],
```

**Step 3: Verify no other font URLs exist in the project**

Run:
```bash
grep -r "fonts.googleapis.com" doc-site/
```
Expected: only one result in `astro.config.mjs`

**Step 4: Commit**

```bash
git add doc-site/astro.config.mjs
git commit -m "feat(doc-site): load Space Grotesk, Manrope, Fira Code from Google Fonts"
```

---

### Task 2: Swap font-family references in global.css

**Files:**
- Modify: `doc-site/src/styles/global.css`

**Step 1: Update CSS custom properties (lines 73–74)**

Find:
```css
  --sl-font:      'DM Sans', system-ui, sans-serif;
  --sl-font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

Replace with:
```css
  --sl-font:      'Manrope', system-ui, sans-serif;
  --sl-font-mono: 'Fira Code', 'Fira Mono', monospace;
```

**Step 2: Update heading font-family (lines 101–111)**

Find:
```css
h1, h2, h3, h4, h5, h6,
.sl-markdown-content h1,
.sl-markdown-content h2,
.sl-markdown-content h3,
.sl-markdown-content h4 {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  color: var(--bx-white);
  letter-spacing: -0.02em;
}
```

Replace with:
```css
h1, h2, h3, h4, h5, h6,
.sl-markdown-content h1,
.sl-markdown-content h2,
.sl-markdown-content h3,
.sl-markdown-content h4 {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  color: var(--bx-white);
  letter-spacing: -0.01em;
}
```

**Step 3: Update site title font (lines 120–126)**

Find:
```css
.site-title,
.site-title span {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  color: var(--bx-white);
  letter-spacing: -0.03em;
}
```

Replace with:
```css
.site-title,
.site-title span {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  color: var(--bx-white);
  letter-spacing: -0.02em;
}
```

**Step 4: Update sidebar section labels (lines 157–165)**

Find:
```css
.sidebar details > summary,
.sidebar .group-label {
  font-family: 'Syne', sans-serif;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--bx-gray-3);
}
```

Replace with:
```css
.sidebar details > summary,
.sidebar .group-label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--bx-gray-3);
}
```

**Step 5: Update table header font (lines 229–238)**

Find:
```css
.sl-markdown-content th {
  font-family: 'Syne', sans-serif;
```

Replace with:
```css
.sl-markdown-content th {
  font-family: 'Space Grotesk', sans-serif;
```

**Step 6: Update results-table th font (lines 364–377)**

Find:
```css
.results-table th {
  font-family: 'Syne', sans-serif;
```

Replace with:
```css
.results-table th {
  font-family: 'Space Grotesk', sans-serif;
```

**Step 7: Update tab font (lines 414)**

Find:
```css
  font-family: 'DM Sans', sans-serif;
```

Replace with:
```css
  font-family: 'Manrope', sans-serif;
```

**Step 8: Update all JetBrains Mono references**

Run to find remaining references:
```bash
grep -n "JetBrains Mono" doc-site/src/styles/global.css
```

For each occurrence, replace `'JetBrains Mono', monospace` with `'Fira Code', 'Fira Mono', monospace`.

Occurrences to update (by context):
- `.results-timing` — monospace for timing display
- `.results-table td` — monospace for table data
- `.console-container` — monospace for console logs
- `.screenshot-timestamp` — monospace for timestamp
- `.network-url` — monospace for URLs
- `.network-status` — monospace for status codes
- `.network-duration` / `.network-size` — monospace for metrics

**Step 9: Verify no old font names remain**

```bash
grep -n "Syne\|DM Sans\|JetBrains" doc-site/src/styles/global.css
```
Expected: zero results.

**Step 10: Commit**

```bash
git add doc-site/src/styles/global.css
git commit -m "feat(doc-site): swap to Space Grotesk, Manrope, Fira Code"
```

---

### Task 3: Verify (visual spot-check)

**Step 1: Start the dev server**

```bash
cd doc-site && npx astro dev
```

Open `http://localhost:4321` in a browser.

**Step 2: Check each font is rendering**

- Heading on any page → should be Space Grotesk (geometric, slightly condensed)
- Body paragraph text → should be Manrope (clean, slightly rounded)
- Code blocks and inline code → should be Fira Code (ligatures visible on `=>`, `!=`, etc.)
- Sidebar section labels → Space Grotesk, uppercase, tight

**Step 3: Check no fallback fonts are loading**

Open browser DevTools → Network → filter by "fonts.googleapis.com". Confirm requests for `Space+Grotesk`, `Manrope`, and `Fira+Code` are present and 200.

**Step 4: Commit (if any fixups needed)**

```bash
git add -p
git commit -m "fix(doc-site): font rendering fixups"
```
