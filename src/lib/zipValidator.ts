import JSZip from 'jszip';
import type { AssetSummary, ExtractedGameFile, ZipValidationResult } from '../types/game';

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_EXTRACTED_BYTES = 250 * 1024 * 1024; // 250 MB
const MAX_FILE_COUNT = 2000;

const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.msi',
  '.dll',
  '.so',
  '.dylib',
  '.php',
  '.phtml',
  '.py',
  '.rb',
  '.pl',
  '.cgi',
  '.jar',
  '.com',
  '.vbs',
  '.scr',
  '.app',
]);

const MIME_MAP: Record<string, string> = {
  // Game code & markup
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.wast': 'text/plain; charset=utf-8',
  '.glsl': 'text/plain; charset=utf-8',
  '.vert': 'text/plain; charset=utf-8',
  '.frag': 'text/plain; charset=utf-8',
  '.wgsl': 'text/plain; charset=utf-8',

  // 2D images, sprites & textures
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.cur': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.ktx2': 'image/ktx2',
  '.ktx': 'image/ktx',
  '.basis': 'application/octet-stream',
  '.hdr': 'image/vnd.radiance',
  '.exr': 'image/x-exr',
  '.dds': 'application/octet-stream',
  '.tga': 'application/octet-stream',
  '.pvr': 'application/octet-stream',

  // 3D models & materials
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.obj': 'model/obj',
  '.mtl': 'text/plain; charset=utf-8',
  '.fbx': 'application/octet-stream',
  '.stl': 'model/stl',
  '.bin': 'application/octet-stream',
  '.usdz': 'model/vnd.usdz+zip',
  '.dae': 'model/vnd.collada+xml',
  '.ply': 'application/octet-stream',
  '.babylon': 'application/json; charset=utf-8',

  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
  '.flac': 'audio/flac',
  '.weba': 'audio/webm',

  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',

  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',

  // Atlases, configs & other game files
  '.xml': 'application/xml',
  '.plist': 'application/xml',
  '.tmx': 'application/xml',
  '.tsx': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.tsv': 'text/tab-separated-values; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.toml': 'text/plain; charset=utf-8',
  '.ini': 'text/plain; charset=utf-8',
  '.cfg': 'text/plain; charset=utf-8',
  '.conf': 'text/plain; charset=utf-8',
  '.properties': 'text/plain; charset=utf-8',
  '.lang': 'text/plain; charset=utf-8',
  '.atlas': 'text/plain; charset=utf-8',
  '.fnt': 'text/plain; charset=utf-8',
  '.dat': 'application/octet-stream',
  '.data': 'application/octet-stream',
  '.pck': 'application/octet-stream',
  '.pak': 'application/octet-stream',
  '.mem': 'application/octet-stream',
  '.unityweb': 'application/octet-stream',
};

const IMAGE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.cur', '.bmp', '.avif',
  '.ktx2', '.ktx', '.basis', '.hdr', '.exr', '.dds', '.tga', '.pvr',
]);
const MODEL_3D_EXTS = new Set([
  '.glb', '.gltf', '.obj', '.mtl', '.fbx', '.stl', '.bin', '.usdz', '.dae', '.ply', '.babylon',
]);
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.opus', '.flac', '.weba']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.ogv', '.mov']);
const FONT_EXTS = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot']);
const DATA_EXTS = new Set([
  '.json', '.xml', '.plist', '.tmx', '.tsx', '.txt', '.csv', '.tsv', '.yaml', '.yml',
  '.toml', '.ini', '.cfg', '.conf', '.properties', '.lang', '.atlas', '.fnt', '.dat', '.data', '.pck', '.pak',
]);

function emptyAssetSummary(): AssetSummary {
  return {
    html: 0,
    scripts: 0,
    styles: 0,
    images: 0,
    models3d: 0,
    audio: 0,
    video: 0,
    fonts: 0,
    data: 0,
    other: 0,
  };
}

function classifyExtension(ext: string, summary: AssetSummary): void {
  if (ext === '.html' || ext === '.htm') summary.html++;
  else if (ext === '.js' || ext === '.mjs' || ext === '.cjs' || ext === '.wasm') summary.scripts++;
  else if (ext === '.css') summary.styles++;
  else if (IMAGE_EXTS.has(ext)) summary.images++;
  else if (MODEL_3D_EXTS.has(ext)) summary.models3d++;
  else if (AUDIO_EXTS.has(ext)) summary.audio++;
  else if (VIDEO_EXTS.has(ext)) summary.video++;
  else if (FONT_EXTS.has(ext)) summary.fonts++;
  else if (DATA_EXTS.has(ext)) summary.data++;
  else summary.other++;
}

function getExtension(path: string): string {
  const base = path.split('/').pop() || '';
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx).toLowerCase();
}

function isUnsafePath(rawPath: string): boolean {
  if (!rawPath || rawPath.includes('\0')) return true;
  if (rawPath.startsWith('/') || rawPath.startsWith('\\')) return true;
  if (/^[a-zA-Z]:/.test(rawPath)) return true;
  const parts = rawPath.split(/[/\\]+/);
  return parts.some((segment) => segment === '..' || segment === '.');
}

function isOsMetadataPath(normalizedPath: string): boolean {
  const lower = normalizedPath.toLowerCase();
  const base = lower.split('/').pop() || '';
  return (
    lower.startsWith('__macosx/') ||
    lower.includes('/__macosx/') ||
    base === '.ds_store' ||
    base === 'thumbs.db' ||
    base === 'desktop.ini'
  );
}

function isExternalOrInlineRef(ref: string): boolean {
  const trimmed = ref.trim();
  return (
    !trimmed ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('//') ||
    /^(?:https?:|data:|blob:|about:|mailto:|javascript:)/i.test(trimmed)
  );
}

function normalizeRelativeSegments(path: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(path);
    } catch {
      return path;
    }
  })();
  const parts = decoded.replace(/\\/g, '/').split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (out.length > 0) out.pop();
    } else {
      out.push(part);
    }
  }
  return out.join('/');
}

function getDirPrefix(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx >= 0 ? filePath.slice(0, idx + 1) : '';
}

function resolveRelativePathCandidate(rawRef: string, fromDir: string): string {
  const clean = rawRef.split('?')[0].split('#')[0].trim();
  if (clean.startsWith('/')) {
    return normalizeRelativeSegments(clean.slice(1));
  }
  return normalizeRelativeSegments(fromDir + clean);
}

function detectMissingDependencies(
  files: ExtractedGameFile[],
  entryPath: string
): string[] {
  const exactSet = new Set(files.map((f) => f.relativePath));
  const lowerSet = new Set(files.map((f) => f.relativePath.toLowerCase()));
  const missing = new Set<string>();

  const existsInZip = (rawRef: string, fromDir: string): boolean => {
    const resolved = resolveRelativePathCandidate(rawRef, fromDir);
    if (!resolved) return true;
    return exactSet.has(resolved) || lowerSet.has(resolved.toLowerCase());
  };

  for (const file of files) {
    const ext = getExtension(file.relativePath);
    const dir = getDirPrefix(file.relativePath);

    // 1. Check HTML entry and HTML files for script/stylesheet/img/media dependencies
    if (file.relativePath === entryPath || ext === '.html' || ext === '.htm') {
      const html = new TextDecoder().decode(file.data);
      const tagRegex = /<(script|link|img|source|video|audio)\b[^>]*?\b(?:src|href|poster)=(["'])([^"']+)\2[^>]*>/gi;
      let match: RegExpExecArray | null;
      while ((match = tagRegex.exec(html)) !== null) {
        const tag = match[1].toLowerCase();
        const ref = match[3].trim();
        if (isExternalOrInlineRef(ref)) continue;
        if (tag === 'link' && !/rel=["'][^"']*(?:stylesheet|preload|modulepreload|icon)/i.test(match[0])) {
          continue;
        }
        if (!existsInZip(ref, dir)) {
          missing.add(`${file.relativePath} → missing "${ref}"`);
        }
      }
    }

    // 2. Check CSS files for missing url(...) assets (fonts, sprites, cursors, textures)
    if (ext === '.css') {
      const css = new TextDecoder().decode(file.data);
      const urlRegex = /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi;
      let match: RegExpExecArray | null;
      while ((match = urlRegex.exec(css)) !== null) {
        const ref = match[2].trim();
        if (isExternalOrInlineRef(ref)) continue;
        if (!existsInZip(ref, dir)) {
          missing.add(`${file.relativePath} → missing stylesheet asset "${ref}"`);
        }
      }
    }

    // 3. Check .gltf JSON for missing .bin buffers and texture images
    if (ext === '.gltf') {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(file.data)) as {
          buffers?: Array<{ uri?: string }>;
          images?: Array<{ uri?: string }>;
        };
        for (const buf of parsed.buffers || []) {
          if (buf.uri && !isExternalOrInlineRef(buf.uri) && !existsInZip(buf.uri, dir)) {
            missing.add(`${file.relativePath} → missing 3D buffer "${buf.uri}"`);
          }
        }
        for (const img of parsed.images || []) {
          if (img.uri && !isExternalOrInlineRef(img.uri) && !existsInZip(img.uri, dir)) {
            missing.add(`${file.relativePath} → missing 3D texture "${img.uri}"`);
          }
        }
      } catch {
        missing.add(`${file.relativePath} → invalid JSON inside .gltf file`);
      }
    }

    // 4. Check .obj for mtllib references
    if (ext === '.obj') {
      const objText = new TextDecoder().decode(file.data);
      const mtlMatches = objText.matchAll(/^\s*mtllib\s+(.+)$/gim);
      for (const m of mtlMatches) {
        const ref = m[1].trim();
        if (ref && !isExternalOrInlineRef(ref) && !existsInZip(ref, dir)) {
          missing.add(`${file.relativePath} → missing material library "${ref}"`);
        }
      }
    }

    // 5. Check .mtl for texture map references
    if (ext === '.mtl') {
      const mtlText = new TextDecoder().decode(file.data);
      const mapMatches = mtlText.matchAll(
        /^\s*(?:map_Ka|map_Kd|map_Ks|map_Ke|map_d|map_Bump|bump|disp|decal|refl|map_Pr|map_Pm|map_Ps|norm)\s+(?:-[a-zA-Z]+\s+[^\s]+\s+)*(.+)$/gim
      );
      for (const m of mapMatches) {
        const ref = m[1].trim();
        if (ref && !isExternalOrInlineRef(ref) && !existsInZip(ref, dir)) {
          missing.add(`${file.relativePath} → missing material texture "${ref}"`);
        }
      }
    }

    // 6. Check Spine/LibGDX .atlas files for page texture images
    if (ext === '.atlas') {
      const atlasLines = new TextDecoder().decode(file.data).split(/\r?\n/);
      for (let i = 0; i < atlasLines.length - 1; i++) {
        const line = atlasLines[i].trim();
        const nextLine = atlasLines[i + 1].trim();
        if (
          line &&
          !line.includes(':') &&
          /^(?:size|format)\s*:/i.test(nextLine) &&
          !isExternalOrInlineRef(line) &&
          !existsInZip(line, dir)
        ) {
          missing.add(`${file.relativePath} → missing atlas texture "${line}"`);
        }
      }
    }

    // 7. Check JS/MJS files for explicit relative ES module imports with file extensions
    if (ext === '.js' || ext === '.mjs') {
      const jsText = new TextDecoder().decode(file.data);
      const importRegex =
        /(?:\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?|\bimport\s*\(\s*)(['"])(\.\.?\/[^'"]+\.(?:js|mjs|cjs|json|wasm))\1/g;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(jsText)) !== null) {
        const ref = match[2].trim();
        if (!existsInZip(ref, dir)) {
          missing.add(`${file.relativePath} → missing module "${ref}"`);
        }
      }
    }
  }

  return Array.from(missing);
}

export function slugifyGameTitle(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `game-${Date.now()}`;
}

export async function validateAndExtractGameZip(file: File): Promise<ZipValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const summary = emptyAssetSummary();

  if (!file.name.toLowerCase().endsWith('.zip')) {
    return {
      valid: false,
      errors: ['Please select a valid .zip archive containing your HTML5 game files.'],
      warnings: [],
      missingDependencies: [],
      entryPath: null,
      fileCount: 0,
      totalSizeBytes: 0,
      assetSummary: summary,
      files: [],
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      errors: ['The selected ZIP file is empty.'],
      warnings: [],
      missingDependencies: [],
      entryPath: null,
      fileCount: 0,
      totalSizeBytes: 0,
      assetSummary: summary,
      files: [],
    };
  }

  if (file.size > MAX_ARCHIVE_BYTES) {
    return {
      valid: false,
      errors: [
        `Archive exceeds the ${Math.round(MAX_ARCHIVE_BYTES / 1024 / 1024)} MB upload limit.`,
      ],
      warnings: [],
      missingDependencies: [],
      entryPath: null,
      fileCount: 0,
      totalSizeBytes: 0,
      assetSummary: summary,
      files: [],
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    return {
      valid: false,
      errors: ['Could not read ZIP archive. The file may be corrupted or password-protected.'],
      warnings: [],
      missingDependencies: [],
      entryPath: null,
      fileCount: 0,
      totalSizeBytes: 0,
      assetSummary: summary,
      files: [],
    };
  }

  const rawEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => ({
      entry,
      normalizedName: entry.name.replace(/\\/g, '/').replace(/^\.\//, ''),
    }))
    .filter(({ normalizedName }) => Boolean(normalizedName) && !isOsMetadataPath(normalizedName));

  if (rawEntries.length === 0) {
    return {
      valid: false,
      errors: ['The ZIP archive does not contain any game files.'],
      warnings: [],
      missingDependencies: [],
      entryPath: null,
      fileCount: 0,
      totalSizeBytes: 0,
      assetSummary: summary,
      files: [],
    };
  }

  if (rawEntries.length > MAX_FILE_COUNT) {
    errors.push(
      `Archive contains ${rawEntries.length} files, which exceeds the maximum of ${MAX_FILE_COUNT} files.`
    );
  }

  for (const { entry, normalizedName } of rawEntries) {
    if (isUnsafePath(normalizedName)) {
      errors.push(`Blocked unsafe file path: ${entry.name}`);
    }
  }

  // Unwrap redundant single top-level wrapper directories while preserving internal structure
  let paths = rawEntries.map((item) => item.normalizedName);
  let stripPrefix = '';

  while (true) {
    const hasRootIndex = paths.some((p) => p.toLowerCase() === 'index.html');
    if (hasRootIndex) break;

    const allNested = paths.every((p) => p.includes('/'));
    if (!allNested) break;

    const topFolders = new Set(paths.map((p) => p.split('/')[0]));
    if (topFolders.size !== 1) break;

    const folder = Array.from(topFolders)[0];
    const prefix = `${folder}/`;
    const nextPaths = paths.map((p) => p.slice(prefix.length));
    const indexExistsInside = nextPaths.some(
      (p) => p.toLowerCase() === 'index.html' || p.toLowerCase().endsWith('/index.html')
    );
    if (!indexExistsInside) break;

    stripPrefix += prefix;
    paths = nextPaths;
  }

  if (stripPrefix) {
    warnings.push(`Unwrapped top-level ZIP folder "${stripPrefix.replace(/\/$/, '')}".`);
  }

  const extractedFiles: ExtractedGameFile[] = [];
  let totalSizeBytes = 0;
  let rootIndexPath: string | null = null;
  const nestedIndexCandidates: string[] = [];

  for (const { entry, normalizedName } of rawEntries) {
    if (isUnsafePath(normalizedName)) continue;

    const relativePath =
      stripPrefix && normalizedName.startsWith(stripPrefix)
        ? normalizedName.slice(stripPrefix.length)
        : normalizedName;

    if (!relativePath || isUnsafePath(relativePath)) {
      errors.push(`Invalid file path inside ZIP: ${entry.name}`);
      continue;
    }

    const ext = getExtension(relativePath);
    if (BLOCKED_EXTENSIONS.has(ext)) {
      errors.push(`Blocked unsafe executable or server script: ${relativePath}`);
      continue;
    }

    let data: Uint8Array;
    try {
      data = await entry.async('uint8array');
    } catch {
      errors.push(`Failed to extract file from ZIP: ${relativePath}`);
      continue;
    }

    totalSizeBytes += data.byteLength;
    if (totalSizeBytes > MAX_EXTRACTED_BYTES) {
      errors.push(
        `Extracted game size exceeds the ${Math.round(MAX_EXTRACTED_BYTES / 1024 / 1024)} MB safety limit.`
      );
      break;
    }

    if (relativePath.toLowerCase() === 'index.html') {
      rootIndexPath = relativePath;
    } else if (relativePath.toLowerCase().endsWith('/index.html')) {
      nestedIndexCandidates.push(relativePath);
    }

    classifyExtension(ext, summary);

    extractedFiles.push({
      relativePath,
      contentType: MIME_MAP[ext] || 'application/octet-stream',
      sizeBytes: data.byteLength,
      data,
    });
  }

  let foundIndexPath: string | null = rootIndexPath;
  if (!foundIndexPath && nestedIndexCandidates.length > 0) {
    nestedIndexCandidates.sort((a, b) => a.split('/').length - b.split('/').length);
    foundIndexPath = nestedIndexCandidates[0];
    warnings.push(`Using nested entry file: ${foundIndexPath}`);
  }

  if (!foundIndexPath) {
    errors.push('Missing playable index.html entry file inside the ZIP archive.');
  }

  const missingDependencies =
    foundIndexPath && extractedFiles.length > 0
      ? detectMissingDependencies(extractedFiles, foundIndexPath)
      : [];

  return {
    valid: errors.length === 0 && Boolean(foundIndexPath),
    errors,
    warnings,
    missingDependencies,
    entryPath: foundIndexPath,
    fileCount: extractedFiles.length,
    totalSizeBytes,
    assetSummary: summary,
    files: extractedFiles,
  };
}

function rewriteCssUrls(
  cssText: string,
  cssDir: string,
  lookupAsset: (ref: string, fromDir: string) => string | undefined
): string {
  return cssText.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (full, quote: string, rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (isExternalOrInlineRef(trimmed)) {
      return full;
    }
    const resolved = lookupAsset(trimmed, cssDir);
    if (!resolved) return full;
    return `url(${quote || '"'}${resolved}${quote || '"'})`;
  });
}

function rewriteJsModuleImports(
  jsText: string,
  jsDir: string,
  lookupAsset: (ref: string, fromDir: string) => string | undefined
): string {
  return jsText.replace(
    /(\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?|\bimport\s*\(\s*)(['"])(\.\.?\/[^'"]+)\2/g,
    (full, prefix: string, quote: string, relSpec: string) => {
      const resolved = lookupAsset(relSpec, jsDir);
      if (!resolved) return full;
      return `${prefix}${quote}${resolved}${quote}`;
    }
  );
}

function rewriteGltfPreviewJson(
  gltfText: string,
  gltfDir: string,
  lookupAsset: (ref: string, fromDir: string) => string | undefined
): string {
  try {
    const parsed = JSON.parse(gltfText) as {
      buffers?: Array<{ uri?: string }>;
      images?: Array<{ uri?: string }>;
    };
    let changed = false;
    for (const buf of parsed.buffers || []) {
      if (buf.uri && !isExternalOrInlineRef(buf.uri)) {
        const resolved = lookupAsset(buf.uri, gltfDir);
        if (resolved) {
          buf.uri = resolved;
          changed = true;
        }
      }
    }
    for (const img of parsed.images || []) {
      if (img.uri && !isExternalOrInlineRef(img.uri)) {
        const resolved = lookupAsset(img.uri, gltfDir);
        if (resolved) {
          img.uri = resolved;
          changed = true;
        }
      }
    }
    return changed ? JSON.stringify(parsed) : gltfText;
  } catch {
    return gltfText;
  }
}

function rewriteMtlPreview(
  mtlText: string,
  mtlDir: string,
  lookupAsset: (ref: string, fromDir: string) => string | undefined
): string {
  return mtlText.replace(
    /^(\s*(?:map_Ka|map_Kd|map_Ks|map_Ke|map_d|map_Bump|bump|disp|decal|refl|map_Pr|map_Pm|map_Ps|norm)\s+(?:-[a-zA-Z]+\s+[^\s]+\s+)*)(.+)$/gim,
    (full, prefix: string, rawRef: string) => {
      const ref = rawRef.trim();
      if (isExternalOrInlineRef(ref)) return full;
      const resolved = lookupAsset(ref, mtlDir);
      return resolved ? `${prefix}${resolved}` : full;
    }
  );
}

function rewriteObjPreview(
  objText: string,
  objDir: string,
  lookupAsset: (ref: string, fromDir: string) => string | undefined
): string {
  return objText.replace(/^(\s*mtllib\s+)(.+)$/gim, (full, prefix: string, rawRef: string) => {
    const ref = rawRef.trim();
    if (isExternalOrInlineRef(ref)) return full;
    const resolved = lookupAsset(ref, objDir);
    return resolved ? `${prefix}${resolved}` : full;
  });
}

/**
 * Builds a self-contained HTML preview document from validated in-memory ZIP files.
 * Original ExtractedGameFile entries are never modified; temporary Blob URLs and a
 * synchronous runtime asset resolver ensure 2D, 2.5D, and 3D assets (GLTF, GLB, OBJ,
 * MTL, textures, CSS, JS, fonts, JSON, WASM, audio, video) load accurately in preview.
 */
export function buildLocalZipPreviewHtml(
  files: ExtractedGameFile[],
  entryPath: string
): { html: string; revoke: () => void } {
  const entryFile = files.find((f) => f.relativePath === entryPath);
  if (!entryFile) {
    return {
      html: '<html><body style="font-family:sans-serif;padding:24px;">Preview entry file not found.</body></html>',
      revoke: () => {},
    };
  }

  const baseDir = getDirPrefix(entryPath);
  const blobUrls: string[] = [];
  const exactMap = new Map<string, string>();
  const lowerMap = new Map<string, string>();
  const registeredBlobSet = new Set<string>();

  const registerBlob = (relativePath: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    blobUrls.push(url);
    registeredBlobSet.add(url);
    exactMap.set(relativePath, url);
    lowerMap.set(relativePath.toLowerCase(), url);
  };

  const lookupAsset = (rawRef: string, fromDir: string): string | undefined => {
    const cleanRef = rawRef.split('?')[0].split('#')[0].trim();
    if (!cleanRef) return undefined;

    const candidates: string[] = [];
    if (cleanRef.startsWith('/')) {
      candidates.push(normalizeRelativeSegments(cleanRef.slice(1)));
    } else {
      if (fromDir) {
        candidates.push(normalizeRelativeSegments(fromDir + cleanRef));
      }
      candidates.push(normalizeRelativeSegments(cleanRef));
    }

    for (const candidate of candidates) {
      const exact = exactMap.get(candidate);
      if (exact) return exact;
      const lower = lowerMap.get(candidate.toLowerCase());
      if (lower) return lower;
    }
    return undefined;
  };

  // Pass 1: Register binary/media/3D-binary/font/data assets first
  const mtlFiles: ExtractedGameFile[] = [];
  const objFiles: ExtractedGameFile[] = [];
  const gltfFiles: ExtractedGameFile[] = [];
  const cssFiles: ExtractedGameFile[] = [];
  const jsFiles: ExtractedGameFile[] = [];
  const otherHtmlFiles: ExtractedGameFile[] = [];

  for (const file of files) {
    if (file.relativePath === entryPath) continue;
    const ext = getExtension(file.relativePath);
    if (ext === '.mtl') mtlFiles.push(file);
    else if (ext === '.obj') objFiles.push(file);
    else if (ext === '.gltf') gltfFiles.push(file);
    else if (ext === '.css') cssFiles.push(file);
    else if (ext === '.js' || ext === '.mjs' || ext === '.cjs') jsFiles.push(file);
    else if (ext === '.html' || ext === '.htm') otherHtmlFiles.push(file);
    else {
      const blob = new Blob([new Uint8Array(file.data)], { type: file.contentType });
      registerBlob(file.relativePath, blob);
    }
  }

  // Pass 2: Rewrite .mtl textures, then .obj mtllib, then .gltf buffers/images
  for (const file of mtlFiles) {
    const dir = getDirPrefix(file.relativePath);
    const rewritten = rewriteMtlPreview(new TextDecoder().decode(file.data), dir, lookupAsset);
    registerBlob(file.relativePath, new Blob([rewritten], { type: file.contentType }));
  }
  for (const file of objFiles) {
    const dir = getDirPrefix(file.relativePath);
    const rewritten = rewriteObjPreview(new TextDecoder().decode(file.data), dir, lookupAsset);
    registerBlob(file.relativePath, new Blob([rewritten], { type: file.contentType }));
  }
  for (const file of gltfFiles) {
    const dir = getDirPrefix(file.relativePath);
    const rewritten = rewriteGltfPreviewJson(new TextDecoder().decode(file.data), dir, lookupAsset);
    registerBlob(file.relativePath, new Blob([rewritten], { type: file.contentType }));
  }

  // Pass 3: Rewrite CSS url(...) references (dependency-ordered for @import)
  const cssByPath = new Map(cssFiles.map((f) => [f.relativePath.toLowerCase(), f]));
  const cssVisited = new Set<string>();
  const registerCssBottomUp = (file: ExtractedGameFile) => {
    const key = file.relativePath.toLowerCase();
    if (cssVisited.has(key)) return;
    cssVisited.add(key);
    const cssDir = getDirPrefix(file.relativePath);
    const rawCss = new TextDecoder().decode(file.data);
    const urlMatches = rawCss.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi);
    for (const m of urlMatches) {
      const ref = m[2].trim();
      if (!isExternalOrInlineRef(ref)) {
        const depKey = resolveRelativePathCandidate(ref, cssDir).toLowerCase();
        const depFile = cssByPath.get(depKey);
        if (depFile) registerCssBottomUp(depFile);
      }
    }
    const rewrittenCss = rewriteCssUrls(rawCss, cssDir, lookupAsset);
    registerBlob(file.relativePath, new Blob([rewrittenCss], { type: file.contentType }));
  };
  for (const file of cssFiles) {
    registerCssBottomUp(file);
  }

  // Pass 4: Rewrite relative ES module imports in JS files (leaf modules registered first)
  const jsByPath = new Map(jsFiles.map((f) => [f.relativePath.toLowerCase(), f]));
  const jsDecoded = new Map<string, string>();
  const jsVisited = new Set<string>();
  const registerJsBottomUp = (file: ExtractedGameFile) => {
    const key = file.relativePath.toLowerCase();
    if (jsVisited.has(key)) return;
    jsVisited.add(key);
    const jsDir = getDirPrefix(file.relativePath);
    const rawJs = new TextDecoder().decode(file.data);
    jsDecoded.set(key, rawJs);
    const importMatches = rawJs.matchAll(
      /(?:\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?|\bimport\s*\(\s*)(['"])(\.\.?\/[^'"]+)\1/g
    );
    for (const m of importMatches) {
      const depKey = resolveRelativePathCandidate(m[2], jsDir).toLowerCase();
      const depFile = jsByPath.get(depKey);
      if (depFile) registerJsBottomUp(depFile);
    }
    const rewrittenJs = rewriteJsModuleImports(rawJs, jsDir, lookupAsset);
    registerBlob(file.relativePath, new Blob([rewrittenJs], { type: file.contentType }));
  };
  for (const file of jsFiles) {
    registerJsBottomUp(file);
  }

  // Pass 5: Register secondary HTML files
  for (const file of otherHtmlFiles) {
    registerBlob(file.relativePath, new Blob([new Uint8Array(file.data)], { type: file.contentType }));
  }

  const runtimeAssetDict: Record<string, string> = {};
  const fallbackAssetDict: Record<string, string> = {};
  const ambiguousFallbacks = new Set<string>();

  for (const [relPath, url] of exactMap.entries()) {
    runtimeAssetDict[relPath] = url;
    runtimeAssetDict[relPath.toLowerCase()] = url;
    if (baseDir && relPath.startsWith(baseDir)) {
      const fromEntry = relPath.slice(baseDir.length);
      runtimeAssetDict[fromEntry] = url;
      runtimeAssetDict[fromEntry.toLowerCase()] = url;
    }

    // Register unambiguous sub-path suffixes for nested 3D/loader relative asset fetches
    const parts = relPath.split('/');
    for (let i = 1; i < parts.length; i++) {
      const suffix = parts.slice(i).join('/');
      const suffixLower = suffix.toLowerCase();
      if (fallbackAssetDict[suffixLower] && fallbackAssetDict[suffixLower] !== url) {
        ambiguousFallbacks.add(suffixLower);
      } else {
        fallbackAssetDict[suffixLower] = url;
      }
    }
  }

  for (const key of ambiguousFallbacks) {
    delete fallbackAssetDict[key];
  }

  let html = new TextDecoder().decode(entryFile.data);

  html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (full, cssContent: string) => {
    const updated = rewriteCssUrls(cssContent, baseDir, lookupAsset);
    return full.replace(cssContent, updated);
  });

  html = html.replace(
    /\bstyle=(?:"([^"]*url\([^"]*)"|'([^']*url\([^']*)')/gi,
    (full, dblVal: string | undefined, sglVal: string | undefined) => {
      const attrQuote = dblVal !== undefined ? '"' : "'";
      const styleVal = dblVal ?? sglVal ?? '';
      const updated = rewriteCssUrls(styleVal, baseDir, lookupAsset);
      if (updated === styleVal) return full;
      const safeUpdated =
        attrQuote === '"' ? updated.replace(/"/g, "'") : updated.replace(/'/g, '"');
      return `style=${attrQuote}${safeUpdated}${attrQuote}`;
    }
  );

  html = html.replace(
    /\b(src|href|poster|data-src)=(["'])(?!https?:\/\/|data:|blob:|mailto:|javascript:|#)([^"']+)\2/gi,
    (full, attr: string, quote: string, rawRef: string) => {
      const resolved = lookupAsset(rawRef, baseDir);
      if (!resolved) return full;
      return `${attr}=${quote}${resolved}${quote}`;
    }
  );
  html = html.replace(/\bsrcset=(["'])([^"']+)\1/gi, (_full, quote: string, rawSet: string) => {
    const rewritten = rawSet
      .split(',')
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed) return part;
        const spaceIdx = trimmed.search(/\s/);
        const urlPart = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
        const descPart = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx);
        const resolved = lookupAsset(urlPart, baseDir);
        return resolved ? `${resolved}${descPart}` : trimmed;
      })
      .join(', ');
    return `srcset=${quote}${rewritten}${quote}`;
  });

  const serializedMap = JSON.stringify(runtimeAssetDict).replace(/<\/script/gi, '<\\/script');
  const serializedFallbackMap = JSON.stringify(fallbackAssetDict).replace(/<\/script/gi, '<\\/script');
  const serializedValidBlobs = JSON.stringify(Array.from(registeredBlobSet)).replace(
    /<\/script/gi,
    '<\\/script'
  );

  const shimScript = `<script data-playaura-preview-shim="true">
(function() {
  var ASSETS = ${serializedMap};
  var FALLBACK_ASSETS = ${serializedFallbackMap};
  var VALID_BLOBS = {};
  var blobList = ${serializedValidBlobs};
  for (var bi = 0; bi < blobList.length; bi++) { VALID_BLOBS[blobList[bi]] = true; }
  var PREVIEW_ORIGIN = 'https://playaura-preview.local/';
  function cleanNorm(path) {
    try { path = decodeURIComponent(path); } catch (e) {}
    var parts = String(path).replace(/\\\\/g, '/').split('/');
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p || p === '.') continue;
      if (p === '..') { if (out.length) out.pop(); }
      else out.push(p);
    }
    return out.join('/');
  }
  function lookupNorm(norm) {
    return ASSETS[norm] || ASSETS[norm.toLowerCase()] || FALLBACK_ASSETS[norm.toLowerCase()] || null;
  }
  function resolveAsset(raw) {
    if (typeof raw !== 'string') return raw;
    var trimmed = raw.trim();
    if (!trimmed) return raw;
    if (VALID_BLOBS[trimmed]) return trimmed;
    if (trimmed.indexOf('blob:') === 0) {
      var slashAfterHost = trimmed.indexOf('/', 12);
      if (slashAfterHost !== -1) {
        var afterBlobHost = trimmed.slice(slashAfterHost + 1);
        var noQ = afterBlobHost.split('?')[0].split('#')[0];
        var n = cleanNorm(noQ);
        var foundBlob = lookupNorm(n);
        if (foundBlob) return foundBlob;
      }
      return raw;
    }
    if (trimmed.indexOf(PREVIEW_ORIGIN) === 0) {
      trimmed = trimmed.slice(PREVIEW_ORIGIN.length);
    } else if (/^(?:https?:|data:|about:|mailto:|javascript:|#)/i.test(trimmed)) {
      return raw;
    }
    var noQuery = trimmed.split('?')[0].split('#')[0];
    var norm = cleanNorm(noQuery.replace(/^\\/+/, ''));
    return lookupNorm(norm) || raw;
  }
  try {
    var OrigURL = window.URL;
    if (OrigURL) {
      var PatchedURL = function(url, base) {
        var baseStr = base == null ? '' : String(base);
        if (arguments.length >= 2 && (!baseStr || baseStr === 'about:srcdoc' || baseStr === 'about:blank')) {
          var mapped = resolveAsset(String(url));
          if (mapped !== String(url)) return new OrigURL(mapped);
          return new OrigURL(String(url), PREVIEW_ORIGIN);
        }
        return arguments.length >= 2 ? new OrigURL(url, base) : new OrigURL(url);
      };
      PatchedURL.prototype = OrigURL.prototype;
      if (OrigURL.createObjectURL) PatchedURL.createObjectURL = OrigURL.createObjectURL.bind(OrigURL);
      if (OrigURL.revokeObjectURL) PatchedURL.revokeObjectURL = OrigURL.revokeObjectURL.bind(OrigURL);
      if (OrigURL.canParse) PatchedURL.canParse = OrigURL.canParse.bind(OrigURL);
      window.URL = PatchedURL;
    }
  } catch (e) {}
  function rewriteHtmlSnippet(markup) {
    if (typeof markup !== 'string' || (markup.indexOf('src=') === -1 && markup.indexOf('href=') === -1 && markup.indexOf('poster=') === -1 && markup.indexOf('url(') === -1)) {
      return markup;
    }
    return markup
      .replace(/\\b(src|href|poster)=(["'])([^"']+)\\2/gi, function(m, attr, q, val) {
        var r = resolveAsset(val);
        return r === val ? m : attr + '=' + q + r + q;
      })
      .replace(/url\\(\\s*(['"]?)([^)'"]+)\\1\\s*\\)/gi, function(m, q, val) {
        var r = resolveAsset(val);
        return r === val ? m : 'url(' + (q || '"') + r + (q || '"') + ')';
      });
  }
  function rewriteCssUrlsValue(val) {
    if (typeof val !== 'string' || val.indexOf('url(') === -1) return val;
    return val.replace(/url\\(\\s*(['"]?)([^)'"]+)\\1\\s*\\)/gi, function(m, q, rawUrl) {
      var r = resolveAsset(rawUrl);
      return r === rawUrl ? m : 'url(' + (q || '"') + r + (q || '"') + ')';
    });
  }
  try {
    var origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function(input, init) {
        if (typeof input === 'string') {
          input = resolveAsset(input);
        } else if (typeof Request !== 'undefined' && input instanceof Request) {
          var mapped = resolveAsset(input.url);
          if (mapped !== input.url) input = new Request(mapped, input);
        }
        return origFetch.call(this, input, init);
      };
    }
  } catch (e) {}
  try {
    var origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof url === 'string') args[1] = resolveAsset(url);
      return origXhrOpen.apply(this, args);
    };
  } catch (e) {}
  function patchSrcProp(proto, prop) {
    try {
      var desc = Object.getOwnPropertyDescriptor(proto, prop);
      if (desc && desc.set && desc.configurable) {
        Object.defineProperty(proto, prop, {
          configurable: true,
          enumerable: desc.enumerable,
          get: desc.get,
          set: function(v) { return desc.set.call(this, resolveAsset(v)); }
        });
      }
    } catch (e) {}
  }
  if (typeof HTMLImageElement !== 'undefined') patchSrcProp(HTMLImageElement.prototype, 'src');
  if (typeof HTMLMediaElement !== 'undefined') patchSrcProp(HTMLMediaElement.prototype, 'src');
  if (typeof HTMLVideoElement !== 'undefined') patchSrcProp(HTMLVideoElement.prototype, 'poster');
  if (typeof HTMLSourceElement !== 'undefined') patchSrcProp(HTMLSourceElement.prototype, 'src');
  if (typeof HTMLScriptElement !== 'undefined') patchSrcProp(HTMLScriptElement.prototype, 'src');
  if (typeof HTMLLinkElement !== 'undefined') patchSrcProp(HTMLLinkElement.prototype, 'href');
  try {
    var OrigAudio = window.Audio;
    if (OrigAudio) {
      window.Audio = function(src) {
        return typeof src === 'string' ? new OrigAudio(resolveAsset(src)) : new OrigAudio();
      };
      window.Audio.prototype = OrigAudio.prototype;
    }
  } catch (e) {}
  try {
    var origSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      var lower = String(name).toLowerCase();
      if ((lower === 'src' || lower === 'href' || lower === 'poster') && typeof value === 'string') {
        value = resolveAsset(value);
      } else if (lower === 'srcset' && typeof value === 'string') {
        value = value.split(',').map(function(part) {
          var t = part.trim();
          if (!t) return part;
          var sp = t.search(/\\s/);
          var u = sp === -1 ? t : t.slice(0, sp);
          var d = sp === -1 ? '' : t.slice(sp);
          return resolveAsset(u) + d;
        }).join(', ');
      } else if (lower === 'style' && typeof value === 'string') {
        value = rewriteCssUrlsValue(value);
      }
      return origSetAttr.call(this, name, value);
    };
  } catch (e) {}
  try {
    var htmlDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (htmlDesc && htmlDesc.set && htmlDesc.configurable) {
      Object.defineProperty(Element.prototype, 'innerHTML', {
        configurable: true,
        enumerable: htmlDesc.enumerable,
        get: htmlDesc.get,
        set: function(v) { return htmlDesc.set.call(this, rewriteHtmlSnippet(v)); }
      });
    }
  } catch (e) {}
  try {
    if (typeof CSSStyleDeclaration !== 'undefined') {
      var origSetProp = CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty = function(prop, val, prio) {
        return origSetProp.call(this, prop, rewriteCssUrlsValue(val), prio);
      };
      ['backgroundImage', 'background'].forEach(function(cssProp) {
        var d = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, cssProp);
        if (d && d.set && d.configurable) {
          Object.defineProperty(CSSStyleDeclaration.prototype, cssProp, {
            configurable: true,
            enumerable: d.enumerable,
            get: d.get,
            set: function(v) { return d.set.call(this, rewriteCssUrlsValue(v)); }
          });
        }
      });
    }
  } catch (e) {}
  try {
    var origDocWrite = document.write;
    document.write = function() {
      var args = Array.prototype.slice.call(arguments).map(rewriteHtmlSnippet);
      return origDocWrite.apply(document, args);
    };
  } catch (e) {}
})();
</script>`;

  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (match) => `${match}\n${shimScript}`);
  } else if (/<html\b[^>]*>/i.test(html)) {
    html = html.replace(/<html\b[^>]*>/i, (match) => `${match}\n<head>${shimScript}</head>`);
  } else {
    html = `${shimScript}\n${html}`;
  }

  return {
    html,
    revoke: () => {
      for (const u of blobUrls) {
        URL.revokeObjectURL(u);
      }
    },
  };
}
