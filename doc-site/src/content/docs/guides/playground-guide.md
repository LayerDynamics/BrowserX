---
title: Using the Browser Playground
description: Interactive guide to using the BrowserX Browser Playground
---

# Browser Playground Guide

The Browser Playground is an interactive environment for testing BrowserX queries in real-time.

## Getting Started

1. **Write Your Query** - Use the Monaco editor on the left with full syntax highlighting
2. **Execute** - Click the Execute button to run your query
3. **View Results** - See results, screenshots, and console output on the right

## Features

### Query Editor
- Full BrowserX syntax highlighting
- Code completion (coming soon)
- Multi-line queries
- History access

### Execution Controls
- **Execute** - Run the current query
- **Cancel** - Stop a running query
- **Save** - Save query for later
- **Share** - Generate shareable link
- **Export** - Download results as JSON, CSV, or HTML

### Results Viewer
- **Screenshot Tab** - Live browser screenshots
- **Console Tab** - Console logs from execution
- **Network Tab** - Network activity (coming soon)

## Example Queries

### Basic SELECT
```sql
SELECT title, description FROM "https://example.com"
```

### Navigation with Options
```sql
NAVIGATE TO "https://api.example.com"
  WITH {
    headers: { "Authorization": "Bearer token" }
  }
  CAPTURE response.body
```

### Form Interaction
```sql
INSERT "user@example.com" INTO "#email"
INSERT "password123" INTO "#password"
CLICK "#submit"
```

### Conditional Logic
```sql
IF EXISTS("#login-form") THEN
  INSERT "user@example.com" INTO "#email"
  CLICK "#submit"
END
```

## Tips & Tricks

- Use templates to start with common query patterns
- Check the console tab for detailed execution logs
- Export results for further analysis
- Save frequently used queries

## Rate Limits

- **Burst**: 3 requests
- **Sustained**: 10 requests per minute

## Next Steps

- [Query Language Reference](/guides/query/query-language)
- [API Documentation](/api/endpoints)
- [Examples](/guides/query/examples)
