---
description: Navigate to a URL and extract its content using BrowserX
argument-hint: <url>
allowed-tools: []
---

Navigate to the URL provided by the user and extract its content using BrowserX.

**URL**: $ARGUMENTS

## Instructions

1. Use `browserx_query` with a SELECT statement to extract the page title, meta description, and main content:
   ```sql
   SELECT title, description FROM "$ARGUMENTS"
   ```

2. If the query returns useful data, present it clearly to the user.

3. If the page requires JavaScript rendering or the query returns minimal data, fall back to browser tools:
   - `browser_navigate` to load the page (with `waitUntil: "networkidle"` for SPAs)
   - `browser_query_dom` to extract structured content
   - `browser_close_session` when done

4. Present the extracted content in a clean, readable format.
