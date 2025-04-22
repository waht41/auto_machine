// vite.config.ts
import { resolve } from 'path';
import { defineConfig } from 'vite';
import electron, { ElectronOptions } from 'vite-plugin-electron';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

const pathResolve = (path: string) => resolve(__dirname, path);

const alias = [
	{ find: '@', replacement: pathResolve('src') },
	{ find: '@core', replacement: pathResolve('src/core') },
	{ find: 'vscode', replacement: pathResolve('vscode') },
	{ find: '@executors', replacement: pathResolve('executors') },
	{ find: '@operation', replacement: pathResolve('operation') },
	{ find: '@webview', replacement: pathResolve('webview-ui/src') },
	{ find: '@webview-ui', replacement: pathResolve('webview-ui/src') },
];

const getElectronConfig = (mode: string) => {
	const mainConfig : ElectronOptions = {
		entry: resolve(__dirname, 'electron-main/main.ts'),
		vite: {
			resolve: { alias },
			build: {
				outDir: 'build/electron',
				rollupOptions: {
					input: resolve(__dirname, 'electron-main/main.ts'),
					external: ['electron'],
				},
			},
		},
	};

	const preloadConfig: ElectronOptions = {
		entry: resolve(__dirname, 'electron-preload/preload.ts'),
		vite: {
			build: {
				outDir: 'build/electron',
				rollupOptions: {
					input: resolve(__dirname, 'electron-preload/preload.ts'),
					external: ['electron'],
				},
			},
		},
	};

	const configs = [
		mainConfig,
		preloadConfig,
	];
	if (mode === 'production') {
		// configs.push(backgroundConfig);
	}

	return configs;
};

export default defineConfig(({ mode }) => ({
	resolve: { alias },
	plugins: [
		electron(getElectronConfig(mode)),
		react(),
		svgr({
			svgrOptions: {
				exportType: 'named',
				ref: true,
				svgo: false,
				titleProp: true,
			},
			include: '**/*.svg',
		}),
	],
	build: {
		outDir: 'build',
		assetsDir: 'assets',
		rollupOptions: { 
			external: ['electron'],
		},
	},
	optimizeDeps: {
		exclude: ['puppeteer-chromium-resolver'],
	},
	server: {
		fs: { strict: false },
	},
}));
