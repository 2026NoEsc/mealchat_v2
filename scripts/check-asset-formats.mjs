import { Buffer } from 'node:buffer';
import { closeSync, openSync, readSync, readdirSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const scanRoot = resolve(process.argv[2] ?? projectRoot);

const blockedExtensions = new Set(['.avif', '.heic', '.heif', '.icns', '.jxl']);
const blockedHeifBrands = new Set(['avif', 'heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']);
const expectedImageFormats = new Map([
  ['.gif', 'GIF'],
  ['.jpeg', 'JPEG'],
  ['.jpg', 'JPEG'],
  ['.png', 'PNG'],
  ['.webp', 'WEBP'],
]);
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
const mismatchedFiles = [];

function readHeader(filePath) {
  const header = Buffer.alloc(32);
  const descriptor = openSync(filePath, 'r');
  let bytesRead;
  try {
    bytesRead = readSync(descriptor, header, 0, header.length, 0);
  } finally {
    closeSync(descriptor);
  }
  return { bytesRead, header };
}

function detectCommonImageFormat(header, bytesRead) {
  if (
    bytesRead >= 8 &&
    header.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return 'PNG';
  }
  if (bytesRead >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'JPEG';
  }
  if (
    bytesRead >= 6 &&
    ['GIF87a', 'GIF89a'].includes(header.toString('ascii', 0, 6))
  ) {
    return 'GIF';
  }
  if (
    bytesRead >= 12 &&
    header.toString('ascii', 0, 4) === 'RIFF' &&
    header.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'WEBP';
  }
  return null;
}

function detectBlockedFormat(filePath, extension) {
  if (blockedExtensions.has(extension)) {
    return extension.slice(1).toUpperCase();
  }

  const { bytesRead, header } = readHeader(filePath);

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

function detectExtensionMismatch(filePath, extension) {
  const expectedFormat = expectedImageFormats.get(extension);
  if (!expectedFormat) {
    return null;
  }

  const { bytesRead, header } = readHeader(filePath);
  const detectedFormat = detectCommonImageFormat(header, bytesRead);
  if (detectedFormat === expectedFormat) {
    return null;
  }
  return detectedFormat ?? 'unknown data';
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
      const detectedFormat = detectExtensionMismatch(entryPath, extension);
      if (detectedFormat) {
        mismatchedFiles.push({
          detectedFormat,
          expectedFormat: expectedImageFormats.get(extension),
          file: relativePath,
        });
      }
    }
  }
}

scanDirectory(scanRoot);

if (blockedFiles.length > 0 || mismatchedFiles.length > 0) {
  if (blockedFiles.length > 0) {
    console.error('Blocked image formats detected:');
    for (const finding of blockedFiles.sort((left, right) => left.file.localeCompare(right.file))) {
      console.error(`- ${finding.file} (${finding.format})`);
    }
    console.error('ICNS, JXL, HEIF/HEIC, and AVIF assets are not allowed while the Metro image-size advisory is active.');
  }
  if (mismatchedFiles.length > 0) {
    console.error('Image extensions do not match their file headers:');
    for (const finding of mismatchedFiles.sort((left, right) => left.file.localeCompare(right.file))) {
      console.error(
        `- ${finding.file} (expected ${finding.expectedFormat}, detected ${finding.detectedFormat})`,
      );
    }
  }
  process.exit(1);
}

console.log('Asset security check passed: blocked formats are absent and common image extensions match their headers.');
