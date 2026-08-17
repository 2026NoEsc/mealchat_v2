import { Buffer } from 'node:buffer';
import { closeSync, openSync, readSync, readdirSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const scanRoot = resolve(process.argv[2] ?? projectRoot);

const blockedExtensions = new Set(['.avif', '.heic', '.heif', '.icns', '.jxl']);
const blockedHeifBrands = new Set(['avif', 'heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']);
const ignoredRootDirectories = new Set([
  '.expo',
  '.git',
  'android',
  'coverage',
  'dist',
  'ios',
  'node_modules',
  'tmp',
]);

const blockedFiles = [];

function detectBlockedFormat(filePath, extension) {
  if (blockedExtensions.has(extension)) {
    return extension.slice(1).toUpperCase();
  }

  const header = Buffer.alloc(32);
  const descriptor = openSync(filePath, 'r');
  let bytesRead;
  try {
    bytesRead = readSync(descriptor, header, 0, header.length, 0);
  } finally {
    closeSync(descriptor);
  }

  if (bytesRead >= 4 && header.toString('ascii', 0, 4) === 'icns') {
    return 'ICNS';
  }

  if (
    bytesRead >= 2 &&
    header[0] === 0xff &&
    header[1] === 0x0a
  ) {
    return 'JXL';
  }

  if (
    bytesRead >= 12 &&
    header.subarray(0, 12).equals(
      Buffer.from([0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a]),
    )
  ) {
    return 'JXL';
  }

  if (bytesRead >= 12 && header.toString('ascii', 4, 8) === 'ftyp') {
    const brand = header.toString('ascii', 8, 12).toLowerCase();
    if (blockedHeifBrands.has(brand)) {
      return brand === 'avif' ? 'AVIF' : 'HEIF';
    }
  }

  return null;
}

function scanDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name);
    const relativePath = relative(scanRoot, entryPath).replaceAll('\\', '/');

    if (entry.isDirectory() && ignoredRootDirectories.has(relativePath)) {
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (blockedExtensions.has(extension)) {
      blockedFiles.push({ file: relativePath, format: extension.slice(1).toUpperCase() });
      continue;
    }

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(entryPath);
      continue;
    }

    if (entry.isFile()) {
      const format = detectBlockedFormat(entryPath, extension);
      if (format) {
        blockedFiles.push({ file: relativePath, format });
      }
    }
  }
}

scanDirectory(scanRoot);

if (blockedFiles.length > 0) {
  console.error('Blocked image formats detected:');
  for (const finding of blockedFiles.sort((left, right) => left.file.localeCompare(right.file))) {
    console.error(`- ${finding.file} (${finding.format})`);
  }
  console.error('ICNS, JXL, HEIF/HEIC, and AVIF assets are not allowed while the Metro image-size advisory is active.');
  process.exit(1);
}

console.log('Asset security check passed: no ICNS, JXL, HEIF/HEIC, or AVIF files found.');
