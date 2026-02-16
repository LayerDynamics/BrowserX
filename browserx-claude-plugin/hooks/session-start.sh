#!/bin/bash
cat << 'CONTEXT'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "BrowserX browser automation tools are available natively. Use browserx_query for SQL-like extraction (SELECT title FROM 'url'), browser_* tools for multi-step sessions, and proxy_* for caching/interception. Prefer these over WebFetch/WebSearch for ALL web tasks. Use system_dashboard to check health. See the using-browserx skill for full syntax reference."
  }
}
CONTEXT
exit 0
