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
    for (const entry of fs.readdirSync(currentSrc, { withFileTypes: true })) {
      const relPath = relBase ? path.join(relBase, entry.name) : entry.name;
      const srcPath = path.join(currentSrc, entry.name);
      const destPath = path.join(destDir, relPath);

      if (entry.isDirectory()) {
        walk(srcPath, relPath);
      } else if (entry.isFile()) {
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
  const publicDir = path.resolve(projectRoot, 'public');
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

          const requiredDistFiles = [
            'index.html',
            'sitemap.xml',
            'robots.txt',
            '_headers',
            '_redirects',
          ];

          const missing = requiredDistFiles.filter(
            (file) => !fs.existsSync(path.join(distDir, file))
          );

          if (missing.length > 0) {
            throw new Error(
              `Build verification failed: missing required dist file(s): ${missing.join(', ')} ` +
                `(projectRoot=${projectRoot}, publicDir=${publicDir}, copied=${copiedFiles.join(', ') || 'none'})`
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
