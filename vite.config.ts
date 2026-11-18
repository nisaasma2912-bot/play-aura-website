import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

function resolveProjectRoot(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.cwd(),
    typeof import.meta.dirname === 'string' ? import.meta.dirname : '',
    moduleDir,
  ].filter(Boolean);

  for (const dir of candidates) {
    if (
      fs.existsSync(path.join(dir, 'package.json')) &&
      fs.existsSync(path.join(dir, 'index.html'))
    ) {
      return dir;
    }
  }

  let current = moduleDir;
  for (let i = 0; i < 6; i += 1) {
    if (
      fs.existsSync(path.join(current, 'package.json')) &&
      fs.existsSync(path.join(current, 'index.html'))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return process.cwd();
}

function copyPublicFilesSafely(srcDir: string, destDir: string): string[] {
  const copied: string[] = [];
  if (!fs.existsSync(srcDir)) {
    return copied;
  }

  const walk = (currentSrc: string, relBase: string) => {
    for (const entryName of fs.readdirSync(currentSrc)) {
      const relPath = relBase ? path.join(relBase, entryName) : entryName;
      const srcPath = path.join(currentSrc, entryName);
      const destPath = path.join(destDir, relPath);
      const stat = fs.statSync(srcPath);

      if (stat.isDirectory()) {
        walk(srcPath, relPath);
      } else if (stat.isFile()) {
        // Never overwrite Vite's bundled root index.html
        if (relPath === 'index.html') {
          continue;
        }
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        copied.push(relPath.replace(/\\/g, '/'));
      }
    }
  };

  walk(srcDir, '');
  return copied;
}

export default defineConfig(() => {
  const projectRoot = resolveProjectRoot();
  const publicDir = fs.existsSync(path.resolve(projectRoot, 'public'))
    ? path.resolve(projectRoot, 'public')
    : fs.existsSync(path.resolve(projectRoot, 'Public'))
      ? path.resolve(projectRoot, 'Public')
      : path.resolve(projectRoot, 'public');
  const distDir = path.resolve(projectRoot, 'dist');

  return {
    root: projectRoot,
    publicDir,
    build: {
      outDir: distDir,
      emptyOutDir: true,
    },
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const srcAssets = path.resolve(projectRoot, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
      // Explicitly copies public static files into dist and verifies required SEO/Cloudflare files exist.
      {
        name: 'ensure-public-static-files',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }

          if (!fs.existsSync(distDir)) {
            throw new Error(`Build verification failed: dist directory not found at ${distDir}`);
          }

          const copiedFiles = copyPublicFilesSafely(publicDir, distDir);

          // Fallback: if any required static file was placed in Public/, public/public/, or repo root,
          // copy its real contents into dist without creating placeholders.
          const requiredStaticFiles = ['sitemap.xml', 'robots.txt', '_headers', '_redirects'];
          for (const filename of requiredStaticFiles) {
            const destPath = path.join(distDir, filename);
            if (fs.existsSync(destPath)) continue;

            const fallbackCandidates = [
              path.join(projectRoot, 'Public', filename),
              path.join(projectRoot, 'public', 'public', filename),
              path.join(projectRoot, filename),
            ];
            for (const candidate of fallbackCandidates) {
              if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                fs.copyFileSync(candidate, destPath);
                copiedFiles.push(filename);
                break;
              }
            }
          }

          const requiredDistFiles = [
            'index.html',
            'sitemap.xml',
            'robots.txt',
            '_headers',
            '_redirects',
            'og-play-aura.jpg',
            'favicon.ico',
            'favicon-32x32.png',
            'favicon-16x16.png',
            'icon-192x192.png',
            'apple-touch-icon.png',
          ];

          const missing = requiredDistFiles.filter(
            (file) => !fs.existsSync(path.join(distDir, file))
          );

          if (missing.length > 0) {
            const rootEntries = fs.existsSync(projectRoot)
              ? fs.readdirSync(projectRoot).join(', ')
              : 'missing';
            const publicEntries = fs.existsSync(publicDir)
              ? fs.readdirSync(publicDir).join(', ')
              : 'missing';
            throw new Error(
              `Build verification failed: missing required dist file(s): ${missing.join(', ')} ` +
                `(projectRoot=${projectRoot} [${rootEntries}], publicDir=${publicDir} [${publicEntries}], copied=${copiedFiles.join(', ') || 'none'})`
            );
          }

          const sitemapContent = fs.readFileSync(path.join(distDir, 'sitemap.xml'), 'utf8');
          if (!sitemapContent.includes('<urlset') || /<!doctype html|<html/i.test(sitemapContent)) {
            throw new Error(
              'Build verification failed: dist/sitemap.xml does not contain valid sitemap XML.'
            );
          }

          const robotsContent = fs.readFileSync(path.join(distDir, 'robots.txt'), 'utf8');
          if (!robotsContent.includes('Sitemap:') || /<!doctype html|<html/i.test(robotsContent)) {
            throw new Error(
              'Build verification failed: dist/robots.txt does not contain valid robots.txt content.'
            );
          }

          console.log(
            `[build-verify] Verified static files in dist (${copiedFiles.length} public files copied): ${requiredDistFiles.join(', ')}`
          );
        },
      },
    ],
    resolve: {
      alias: {
        '@': projectRoot,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
