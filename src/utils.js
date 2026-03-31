'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createWriteStream, mkdirSync, rmSync } = require('fs');
const { pipeline } = require('stream/promises');

const REGISTRY_BASE = 'https://registry.npmjs.org';

async function fetchPackageMetadata(packageSpec) {
  const fetch = (await import('node-fetch')).default;

  const atCount = (packageSpec.match(/@/g) || []).length;
  let name, version;

  if (packageSpec.startsWith('@')) {
    if (atCount >= 2) {
      const lastAt = packageSpec.lastIndexOf('@');
      name = packageSpec.slice(0, lastAt);
      version = packageSpec.slice(lastAt + 1);
    } else {
      name = packageSpec;
      version = 'latest';
    }
  } else {
    const parts = packageSpec.split('@');
    name = parts[0];
    version = parts[1] || 'latest';
  }

  const encodedName = name.startsWith('@')
    ? `@${encodeURIComponent(name.slice(1))}`
    : encodeURIComponent(name);

  const metaUrl = `${REGISTRY_BASE}/${encodedName}`;
  const res = await fetch(metaUrl);

  if (!res.ok) {
    throw new Error(`Registry returned ${res.status} for package "${name}"`);
  }

  const meta = await res.json();

  if (version === 'latest') {
    version = meta['dist-tags']?.latest;
    if (!version) throw new Error(`Could not resolve latest version for "${name}"`);
  }

  const versionData = meta.versions?.[version];
  if (!versionData) {
    throw new Error(`Version "${version}" not found for package "${name}"`);
  }

  return {
    name,
    version,
    tarballUrl: versionData.dist.tarball,
    shasum: versionData.dist.shasum,
    unpackedSize: versionData.dist.unpackedSize,
  };
}

async function downloadTarball(url, destPath) {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download tarball: ${res.status}`);
  const ws = createWriteStream(destPath);
  await pipeline(res.body, ws);
}

async function extractTarball(tarPath, destDir) {
  const tar = require('tar');
  await tar.extract({ file: tarPath, cwd: destDir, strip: 1 });
}

async function collectFiles(dir, baseDir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full, baseDir)));
    } else if (entry.isFile()) {
      const stat = fs.statSync(full);
      const relativePath = path.relative(baseDir, full).replace(/\\/g, '/');
      files.push({
        path: relativePath,
        size: stat.size,
        fullPath: full,
      });
    }
  }

  return files;
}

async function loadFileContent(file, maxBytes = 5 * 1024 * 1024) {
  if (file.size > maxBytes) return undefined;
  try {
    return fs.readFileSync(file.fullPath, 'utf8');
  } catch {
    return undefined;
  }
}

async function fetchAndExtractPackage(packageSpec) {
  const meta = await fetchPackageMetadata(packageSpec);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-canary-'));
  const tarPath = path.join(tmpDir, 'pkg.tgz');
  const extractDir = path.join(tmpDir, 'pkg');

  mkdirSync(extractDir, { recursive: true });

  await downloadTarball(meta.tarballUrl, tarPath);
  await extractTarball(tarPath, extractDir);

  const rawFiles = await collectFiles(extractDir, extractDir);
  const files = [];

  for (const f of rawFiles) {
    const content = await loadFileContent(f);
    files.push({ ...f, content });
  }

  return { meta, files, tmpDir };
}

function cleanupTmp(tmpDir) {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

async function fetchAndExtractGitPackage(repo, ref = '', token = null) {
  const fetch = (await import('node-fetch')).default;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-canary-git-'));
  const tarPath = path.join(tmpDir, 'repo.tgz');
  const extractDir = path.join(tmpDir, 'repo');

  mkdirSync(extractDir, { recursive: true });

  const headers = {
    'User-Agent': 'npm-canary-cli',
    'Accept': 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const url = `https://api.github.com/repos/${repo}/tarball/${ref}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Repository or ref not found: ${repo}${ref ? '@'+ref : ''}`);
    } else if (res.status === 403) {
      throw new Error(`GitHub API rate limit exceeded or access denied (Status: 403)`);
    } else {
      throw new Error(`Failed to fetch GitHub repository (Status: ${res.status})`);
    }
  }

  const rateLimitInfo = {
    limit: res.headers.get('x-ratelimit-limit'),
    remaining: res.headers.get('x-ratelimit-remaining'),
  };

  const ws = createWriteStream(tarPath);
  await pipeline(res.body, ws);

  await extractTarball(tarPath, extractDir);

  return { extractDir, tmpDir, rateLimitInfo };
}

module.exports = {
  fetchPackageMetadata,
  fetchAndExtractPackage,
  fetchAndExtractGitPackage,
  cleanupTmp,
  collectFiles,
  formatBytes,
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
