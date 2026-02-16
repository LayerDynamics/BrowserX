---
description: Run a BrowserX SQL-like query against web pages
argument-hint: <query>
allowed-tools: []
---

Execute a BrowserX query using the SQL-like query engine.

**Query**: $ARGUMENTS

## Instructions

1. First, validate the query syntax using `browserx_query_explain`:
   - Pass the user's query: `$ARGUMENTS`
   - Check the execution plan for any syntax errors

2. If the query is valid, execute it with `browserx_query`:
   - Query: `$ARGUMENTS`
   - Default format: JSON

3. Present the results clearly to the user.

4. If the query has syntax errors, help the user fix it. Common patterns:
   - Extract data: `SELECT title, price FROM "https://example.com"`
   - Form input: `INSERT "value" INTO "#selector"`
   - Click: `CLICK "#button"`
   - Navigate: `NAVIGATE TO "url" CAPTURE response.body`
   - Conditional: `IF EXISTS("#element") THEN ... ELSE ...`
   - Loop: `FOR EACH url IN ["url1", "url2"] SELECT title FROM url`
