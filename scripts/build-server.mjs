/**
 * Server build script using esbuild's JavaScript API.
 * 
 * This avoids the "esbuild: command not found" error on platforms like
 * Vercel where the platform-specific esbuild binary may not be in PATH.
 */
import * as esbuild from 'esbuild';

try {
    await esbuild.build({
        entryPoints: ['server/index.ts'],
        platform: 'node',
        packages: 'external',
        bundle: true,
        format: 'esm',
        outdir: 'dist',
    });
    console.log('✓ Server build complete → dist/index.js');
} catch (error) {
    console.error('Server build failed:', error);
    process.exit(1);
}
