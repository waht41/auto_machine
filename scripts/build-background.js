const esbuild = require('esbuild');
const path = require('path');

async function buildBackground() {
  try {
    const result = await esbuild.build({
      entryPoints: ['src/background-worker/start-background.ts'],
      bundle: true,
      outfile: 'build/background/start-background.js',
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      sourcemap: true,
      external: ['electron'], // 排除electron，因为它是运行时依赖
    });
    console.log('Worker build completed');
  } catch (error) {
    console.error('Worker build failed:', error);
    process.exit(1);
  }
}

buildBackground();
