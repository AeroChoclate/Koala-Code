const esbuild = require('esbuild');
const path = require('path');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: process.argv.includes('--production'),
    sourcemap: !process.argv.includes('--production'),
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    // Resolve workspace packages and node_modules
    nodePaths: [path.resolve(__dirname, '../../node_modules')],
    // Ensure ESM packages (like AI SDK) get resolved properly
    mainFields: ['module', 'main'],
    conditions: ['import', 'node', 'default'],
  });
  if (process.argv.includes('--watch')) {
    await ctx.watch();
    console.log('watching...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}
main().catch(e => {
  console.error(e);
  process.exit(1);
});
