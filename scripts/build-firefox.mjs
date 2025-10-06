#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';
import { Resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'assets');
const distDir = path.join(rootDir, 'dist', 'firefox');
const distAssetsDir = path.join(distDir, 'assets');

await fs.rm(distDir, { recursive: true, force: true });
await fs.mkdir(distAssetsDir, { recursive: true });

const svgFiles = (await fs.readdir(assetsDir)).filter((file) => file.endsWith('.svg'));
const renderedIconMap = new Map();

for (const file of svgFiles) {
  const sourcePath = path.join(assetsDir, file);
  const svgContent = await fs.readFile(sourcePath);
  const baseName = path.parse(file).name;
  const manifestPathKey = path.posix.join('assets', file);
  const sizeMap = new Map();

  for (const size of [48, 128]) {
    const resvg = new Resvg(svgContent, {
      fitTo: {
        mode: 'width',
        value: size,
      },
    });
    const pngData = resvg.render();
    const outputName = `${baseName}-${size}.png`;
    const outputPath = path.join(distAssetsDir, outputName);
    await fs.writeFile(outputPath, pngData.asPng());
    sizeMap.set(String(size), path.posix.join('assets', outputName));
  }

  renderedIconMap.set(manifestPathKey, sizeMap);
}

for (const file of await fs.readdir(assetsDir)) {
  if (!file.endsWith('.svg')) {
    const srcPath = path.join(assetsDir, file);
    const destPath = path.join(distAssetsDir, file);
    await fs.cp(srcPath, destPath, { recursive: true });
  }
}

const copyIfExists = async (relativePath) => {
  const source = path.join(rootDir, relativePath);
  try {
    const stats = await fs.stat(source);
    const destination = path.join(distDir, relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    if (stats.isDirectory()) {
      await fs.cp(source, destination, { recursive: true });
    } else {
      await fs.copyFile(source, destination);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

await copyIfExists('src');
await copyIfExists('LICENSE');

const manifestPath = path.join(rootDir, 'manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

const backgroundSource = manifest?.background?.service_worker || 'src/background.js';
const backgroundOutputDir = path.join(distDir, 'background');
await fs.mkdir(backgroundOutputDir, { recursive: true });
await build({
  entryPoints: [path.join(rootDir, backgroundSource)],
  bundle: true,
  outfile: path.join(backgroundOutputDir, 'index.js'),
  format: 'iife',
  platform: 'browser',
  target: ['firefox102'],
  logLevel: 'silent',
});

const toPngPath = (iconPath, size) => {
  if (!iconPath) {
    return iconPath;
  }
  const normalized = iconPath.replace(/\\/g, '/').replace(/^\.\//, '');
  const mapping = renderedIconMap.get(normalized);
  if (mapping && mapping.has(String(size))) {
    return mapping.get(String(size));
  }
  const parsed = path.posix.parse(normalized);
  return path.posix.join(parsed.dir, `${parsed.name}-${size}.png`);
};

if (manifest.icons) {
  for (const [size, iconPath] of Object.entries(manifest.icons)) {
    manifest.icons[size] = toPngPath(iconPath, size);
  }
}

const normalizeActionIcon = (actionConfig) => {
  if (!actionConfig?.default_icon) {
    return;
  }
  if (typeof actionConfig.default_icon === 'string') {
    actionConfig.default_icon = {
      48: toPngPath(actionConfig.default_icon, 48),
      128: toPngPath(actionConfig.default_icon, 128),
    };
    return;
  }
  for (const [size, iconPath] of Object.entries(actionConfig.default_icon)) {
    actionConfig.default_icon[size] = toPngPath(iconPath, size);
  }
};

normalizeActionIcon(manifest.action);
normalizeActionIcon(manifest.browser_action);

manifest.manifest_version = 2;

if (manifest.host_permissions?.length) {
  const permissions = new Set([...(manifest.permissions ?? []), ...manifest.host_permissions]);
  manifest.permissions = Array.from(permissions);
  delete manifest.host_permissions;
}

if (manifest.action && !manifest.browser_action) {
  manifest.browser_action = manifest.action;
}

if (manifest.browser_action) {
  delete manifest.action;
}

manifest.background = {
  scripts: ['background/index.js'],
};

const firefoxManifestPath = path.join(distDir, 'manifest.json');
await fs.mkdir(path.dirname(firefoxManifestPath), { recursive: true });
await fs.writeFile(firefoxManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
