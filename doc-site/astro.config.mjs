// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
	site: 'https://browserx.dev',
	// Note: API routes require server/hybrid mode with an adapter (e.g., @astrojs/vercel)
	// For static build, API routes are stubbed with mock responses
	integrations: [
		react(),
		starlight({
			title: 'BrowserX',
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/LayerDynamics/BrowserX',
				},
			],
			editLink: {
				baseUrl: 'https://github.com/LayerDynamics/BrowserX/edit/comprehensive-docs/doc-site/',
			},
			sidebar: [
				{
					label: 'Interactive Tools',
					items: [
						{ label: 'Browser Playground', link: '/playground' },
					],
				},
				{
					label: 'Browser Engine',
					items: [
						{ label: 'Overview', slug: 'browser' },
						{ label: 'Page Load Pipeline', slug: 'browser/page-load-pipeline' },
						{ label: 'Network Stack', slug: 'browser/network-stack' },
						{ label: 'Rendering Pipeline', slug: 'browser/rendering-pipeline' },
						{ label: 'WebGPU Rendering', slug: 'browser/webgpu' },
						{ label: 'JavaScript Engine', slug: 'browser/javascript' },
						{ label: 'Storage Layer', slug: 'browser/storage' },
						{ label: 'Security Architecture', slug: 'browser/security' },
						{ label: 'Metrics & Observability', slug: 'browser/metrics' },
					],
				},
				{
					label: 'Proxy Engine',
					items: [
						{ label: 'Overview', slug: 'proxy' },
						{ label: 'Architecture', slug: 'proxy/architecture' },
						{ label: 'Middleware', slug: 'proxy/middleware' },
						{ label: 'Caching', slug: 'proxy/caching' },
						{ label: 'Connection Pooling', slug: 'proxy/connection-pooling' },
						{ label: 'Load Balancing', slug: 'proxy/load-balancing' },
					],
				},
				{
					label: 'Query Engine',
					items: [
						{ label: 'Overview', slug: 'query' },
						{ label: 'Getting Started', slug: 'query/getting-started' },
						{ label: 'Syntax', slug: 'query/syntax' },
						{ label: 'DOM Functions', slug: 'query/dom-functions' },
						{ label: 'Expressions', slug: 'query/expressions' },
						{ label: 'Examples', slug: 'query/examples' },
						{ label: 'Architecture', slug: 'query/architecture' },
						{ label: 'Optimization', slug: 'query/optimization' },
						{ label: 'API Reference', slug: 'query/api-reference' },
					],
				},
				{
					label: 'Runtime',
					items: [
						{ label: 'Overview', slug: 'runtime' },
						{ label: 'Lifecycle', slug: 'runtime/lifecycle' },
						{ label: 'Browser Pool', slug: 'runtime/browser-pool' },
						{ label: 'Events', slug: 'runtime/events' },
						{ label: 'Plugins', slug: 'runtime/plugins' },
						{ label: 'Metrics & Health', slug: 'runtime/metrics-health' },
						{ label: 'Configuration', slug: 'runtime/configuration' },
						{ label: 'Integration', slug: 'runtime/integration' },
					],
				},
				{
					label: 'MCP Server',
					items: [
						{ label: 'Overview', slug: 'mcp' },
						{ label: 'Tools', slug: 'mcp/tools' },
						{ label: 'Resources', slug: 'mcp/resources' },
						{ label: 'Prompts', slug: 'mcp/prompts' },
						{ label: 'Sessions', slug: 'mcp/sessions' },
						{ label: 'Workflows', slug: 'mcp/workflows' },
						{ label: 'Agent Guide', slug: 'mcp/agent-guide' },
					],
				},
				{
					label: 'DevTools',
					items: [
						{ label: 'Overview', slug: 'devtools' },
						{ label: 'Domain Reference', slug: 'devtools/domains' },
						{ label: 'Event System', slug: 'devtools/events' },
						{ label: 'Debugging Guide', slug: 'devtools/debugging' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
		}),
	],
});
