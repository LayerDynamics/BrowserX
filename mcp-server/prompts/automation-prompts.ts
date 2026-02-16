/**
 * Automation Prompts for MCP Server
 * Reusable templates for common browser automation workflows
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Register automation prompts with the MCP server
 */
export function registerPrompts(server: McpServer): void {
  // Extract structured data from a webpage
  server.prompt(
    "extract-data",
    `Extract structured data from a webpage using BrowserX queries.

USE WHEN: Scraping specific data points from a known URL structure.
DO NOT USE: When you need to interact with the page (click, type, scroll) - use browser_* tools directly.

INPUTS: url (page to scrape), dataDescription (what data to extract)
OUTPUT: Structured JSON with extracted data`,
    {
      url: z.string().describe("URL to scrape"),
      dataDescription: z.string().describe("Description of what data to extract"),
    },
    ({ url, dataDescription }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Navigate to ${url} and extract the following data: ${dataDescription}

Use the browserx_query tool with a SELECT statement to extract the data.
Example query format:
\`\`\`
SELECT field1, field2, field3 FROM '${url}' WHERE <conditions>
\`\`\`

Steps:
1. First use browser_navigate to visit the URL and see the page structure
2. Use browser_query_dom to understand the DOM structure
3. Construct an appropriate BrowserX query to extract the data
4. Return the extracted data in a structured format`,
          },
        },
      ],
    }),
  );

  // Fill out a web form
  server.prompt(
    "fill-form",
    `Fill out a web form with provided data.

USE WHEN: Automating form submission with known field selectors and values.
DO NOT USE: When you need to discover form fields first - use browser_query_dom to inspect the form.

INPUTS: url (page with form), formFields (JSON mapping selectors to values)
OUTPUT: Confirmation of submission result`,
    {
      url: z.string().describe("URL of the page with the form"),
      formFields: z.string().describe("JSON object mapping field selectors to values"),
    },
    ({ url, formFields }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Navigate to ${url} and fill out the form with the following data:
\`\`\`json
${formFields}
\`\`\`

Steps:
1. Use browser_navigate to go to the URL
2. Use browser_query_dom to find the form fields and verify selectors
3. For each field:
   - Use browser_type to enter the value (set clear: true to clear existing text)
4. If there's a submit button, use browser_click to submit
5. Wait for navigation or confirmation using browser_wait
6. Report the result`,
          },
        },
      ],
    }),
  );

  // Monitor page for changes
  server.prompt(
    "monitor-page",
    `Monitor a webpage for content changes.

USE WHEN: Detecting when page content changes (price updates, availability, new posts).
DO NOT USE: For real-time monitoring - this is polling-based, not event-driven.

INPUTS: url (page to monitor), selector (element to watch), description (what changes to detect)
OUTPUT: Report of changes detected during monitoring period`,
    {
      url: z.string().describe("URL to monitor"),
      selector: z.string().describe("CSS selector of element to monitor"),
      description: z.string().describe("What changes to look for"),
    },
    ({ url, selector, description }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Monitor ${url} for changes in the element "${selector}".

Looking for: ${description}

Steps:
1. Use browser_navigate to load the page
2. Use browser_query_dom to capture the current state of "${selector}"
3. Store the initial content
4. Use BrowserX query with FOR loop to periodically check:
   \`\`\`
   FOR iteration IN RANGE(1, 10)
     NAVIGATE TO '${url}'
     SELECT text FROM '${selector}'
     WAIT(5000)
   END
   \`\`\`
5. Compare each result to the initial state
6. Report any changes detected`,
          },
        },
      ],
    }),
  );

  // Take annotated screenshot
  server.prompt(
    "screenshot-with-context",
    `Take a screenshot and provide context about the page.

USE WHEN: Capturing a page with semantic understanding of its content and structure.
DO NOT USE: When you only need the screenshot itself - use browser_screenshot directly.

INPUTS: url (page to capture)
OUTPUT: Screenshot image + summary of page content, navigation, and interactive elements`,
    {
      url: z.string().describe("URL to screenshot"),
    },
    ({ url }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Navigate to ${url}, take a screenshot, and provide context about the page.

Steps:
1. Use browser_navigate to load the page
2. Use browser_screenshot to capture the page
3. Use browser_query_dom to extract:
   - Page title
   - Main headings (h1, h2)
   - Navigation links
   - Key content areas
4. Provide a summary of:
   - What the page appears to be about
   - Key interactive elements
   - Potential areas of interest`,
          },
        },
      ],
    }),
  );

  // Multi-step workflow
  server.prompt(
    "multi-step-workflow",
    `Execute a multi-step browser automation workflow.

USE WHEN: Running a predefined sequence of browser actions (navigate, click, type, screenshot).
DO NOT USE: When you need conditional logic or error recovery - build the workflow step-by-step instead.

INPUTS: steps (JSON array of step configurations with action type and parameters)
OUTPUT: Summary of all completed steps and their results`,
    {
      steps: z.string().describe("JSON array of steps to execute"),
    },
    ({ steps }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Execute the following multi-step browser automation workflow:
\`\`\`json
${steps}
\`\`\`

For each step:
1. Parse the step configuration
2. Execute the appropriate browser action:
   - navigate: Use browser_navigate
   - click: Use browser_click
   - type: Use browser_type
   - screenshot: Use browser_screenshot
   - wait: Use browser_wait
   - extract: Use browser_query_dom
3. Verify the result before proceeding to the next step
4. Report progress after each step
5. If any step fails, report the error and stop

Return a summary of all completed steps and their results.`,
          },
        },
      ],
    }),
  );

  // Query builder assistant
  server.prompt(
    "query-builder",
    `Help build a BrowserX query for a specific task.

USE WHEN: You need to construct a BrowserX SQL-like query but aren't sure of the syntax.
DO NOT USE: For simple extractions - use browserx_query directly with basic SELECT statements.

INPUTS: task (description of what to accomplish), url (optional target URL)
OUTPUT: Recommended query with explanation and expected output format`,
    {
      task: z.string().describe("Description of what you want to accomplish"),
      url: z.string().optional().describe("Optional URL context"),
    },
    ({ task, url }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Help me build a BrowserX query to accomplish the following task:
${task}
${url ? `\nTarget URL: ${url}` : ""}

BrowserX Query Language supports:
- SELECT: Extract data (SELECT title, links FROM 'url')
- NAVIGATE: Navigate to URL (NAVIGATE TO 'url')
- FOR: Loop iteration (FOR item IN collection)
- IF: Conditionals (IF condition THEN ... ELSE ...)
- INSERT: Type into inputs (INSERT 'text' INTO 'selector')
- CLICK: Click elements
- WAIT: Wait for conditions

Provide:
1. The recommended query
2. Explanation of what it does
3. Any prerequisites (like navigating first)
4. Expected output format`,
          },
        },
      ],
    }),
  );
}
