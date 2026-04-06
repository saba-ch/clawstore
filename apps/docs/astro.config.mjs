// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://docs.useclawstore.com',
	integrations: [
		starlight({
			title: 'Clawstore',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/saba-ch/clawstore' },
			],
			customCss: ['./src/custom.css'],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: '' },
						{ label: 'Quick Start', slug: 'getting-started/quick-start' },
					],
				},
				{
					label: 'For Authors',
					items: [
						{ label: 'Publishing Guide', slug: 'authors/publishing' },
						{ label: 'Agent Package Format', slug: 'authors/agent-package' },
						{ label: 'Auth & Ownership', slug: 'authors/auth' },
					],
				},
				{
					label: 'For Operators',
					items: [
						{ label: 'Installing Agents', slug: 'operators/installing' },
						{ label: 'Updates & Rollback', slug: 'operators/updates' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'CLI Commands', slug: 'reference/cli' },
						{ label: 'Trust & Safety', slug: 'reference/trust' },
					],
				},
			],
		}),
	],
});
