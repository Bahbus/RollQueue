#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

if (manifest.action && manifest.action.default_icon) {
  if (typeof manifest.action.default_icon === 'string') {
    manifest.action.default_icon = {
      48: toPngPath(manifest.action.default_icon, 48),
      128: toPngPath(manifest.action.default_icon, 128),
    };
  } else {
    for (const [size, iconPath] of Object.entries(manifest.action.default_icon)) {
      manifest.action.default_icon[size] = toPngPath(iconPath, size);
    }
  }
}

const firefoxManifestPath = path.join(distDir, 'manifest.json');
await fs.mkdir(path.dirname(firefoxManifestPath), { recursive: true });
await fs.writeFile(firefoxManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
