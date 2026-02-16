#!/bin/bash
# Read tool input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null || echo "")

if [ "$TOOL_NAME" = "WebFetch" ] || [ "$TOOL_NAME" = "WebSearch" ]; then
  echo "BrowserX is available — use browserx_query or browser_navigate instead of ${TOOL_NAME}. Example: browserx_query(\"SELECT title FROM 'https://example.com'\") for extraction, or browser_navigate for interactive sessions." >&2
  exit 2
fi

exit 0
