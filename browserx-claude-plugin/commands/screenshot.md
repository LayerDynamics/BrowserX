---
description: Take a screenshot of a URL using BrowserX
argument-hint: <url>
allowed-tools: []
---

Take a screenshot of the URL provided by the user using BrowserX browser tools.

**URL**: $ARGUMENTS

## Instructions

1. Navigate to the URL using `browser_navigate`:
   - URL: `$ARGUMENTS`
   - Use `waitUntil: "networkidle"` for best results

2. Wait for the page content to load:
   - Use `browser_wait` with `type: "selector"` for a known content element, or
   - Use `browser_wait` with `type: "function"` and `condition: "document.readyState === 'complete'"`

3. Take the screenshot using `browser_screenshot`:
   - Use `fullPage: true` to capture the entire page

4. Close the session with `browser_close_session`

5. Present the screenshot to the user. The screenshot is also saved to `.browserx/usage_data/screenshots/` — mention the file path.
