'use strict';

const SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  WARN: 'warn',
  INFO: 'info',
};

const RULES = [
  {
    id: 'source-map',
    severity: SEVERITY.CRITICAL,
    description: 'Source map file included in package',
    test: (file) => /\.(js\.map|ts\.map|css\.map|mjs\.map)$/.test(file.path),
    message: (file) =>
      `Source map detected: ${file.path} (${formatBytes(file.size)}) — exposes original source code`,
  },
  {
    id: 'source-typescript',
    severity: SEVERITY.HIGH,
    description: 'TypeScript source file included in package',
    test: (file) =>
      /(?<!\.(d))\.ts$/.test(file.path) && !file.path.endsWith('.d.ts'),
    message: (file) => `TypeScript source included: ${file.path}`,
  },
  {
    id: 'source-jsx',
    severity: SEVERITY.HIGH,
    description: 'JSX/TSX source file included in package',
    test: (file) => /\.(jsx|tsx)$/.test(file.path),
    message: (file) => `JSX/TSX source included: ${file.path}`,
  },
  {
    id: 'dotenv',
    severity: SEVERITY.CRITICAL,
    description: '.env file or variant included in package',
    test: (file) =>
      /(?:^|\/)\.env(\.[a-zA-Z0-9._-]+)?$/.test(file.path) ||
      /(?:^|\/)\.env\.local$/.test(file.path),
    message: (file) => `Environment file detected: ${file.path} — may contain secrets`,
  },
  {
    id: 'private-key',
    severity: SEVERITY.CRITICAL,
    description: 'Private key or certificate file detected',
    test: (file) =>
      /\.(pem|key|p12|pfx|keystore|jks)$/.test(file.path) ||
      /(?:^|\/)(?:id_rsa|id_ed25519|id_ecdsa|id_dsa)$/.test(file.path),
    message: (file) => `Private key/cert detected: ${file.path}`,
  },
  {
    id: 'config-internal',
    severity: SEVERITY.WARN,
    description: 'Internal config file included in package',
    test: (file) =>
      /(?:^|\/)(?:\.eslintrc|\.babelrc|\.prettierrc|jest\.config|tsconfig(?!\.d))/.test(
        file.path
      ) && !/node_modules/.test(file.path),
    message: (file) => `Internal config included: ${file.path}`,
  },
  {
    id: 'oversized-file',
    severity: SEVERITY.HIGH,
    description: 'File exceeds 10 MB',
    test: (file) => file.size > 10 * 1024 * 1024,
    message: (file) =>
      `Oversized file: ${file.path} (${formatBytes(file.size)}) — likely source artifact or unminified asset`,
  },
  {
    id: 'oversized-map',
    severity: SEVERITY.CRITICAL,
    description: 'Source map file exceeds 1 MB',
    test: (file) =>
      /\.(js\.map|ts\.map|css\.map|mjs\.map)$/.test(file.path) &&
      file.size > 1 * 1024 * 1024,
    message: (file) =>
      `Massive source map: ${file.path} (${formatBytes(file.size)}) — full source tree embedded`,
  },
  {
    id: 'sourcecontent-json',
    severity: SEVERITY.CRITICAL,
    description: 'Source map contains sourcesContent field (inline source)',
    test: (file) =>
      /\.(js\.map|ts\.map|css\.map|mjs\.map)$/.test(file.path),
    contentTest: (content) => {
      try {
        const json = JSON.parse(content);
        return Array.isArray(json.sourcesContent) && json.sourcesContent.length > 0;
      } catch {
        return false;
      }
    },
    message: (file) =>
      `Source map has inline sourcesContent: ${file.path} — full original source embedded in JSON`,
  },
  {
    id: 'gitignore-file',
    severity: SEVERITY.INFO,
    description: '.gitignore or similar VCS file included',
    test: (file) =>
      /(?:^|\/)\.gitignore$/.test(file.path) ||
      /(?:^|\/)\.gitattributes$/.test(file.path),
    message: (file) => `VCS config included: ${file.path}`,
  },
  {
    id: 'test-directory',
    severity: SEVERITY.WARN,
    description: 'Test files included in package',
    test: (file) =>
      /(?:^|\/)(?:test|tests|__tests__|spec|__spec__)\//.test(file.path) ||
      /\.(?:test|spec)\.[jt]sx?$/.test(file.path),
    message: (file) => `Test file included: ${file.path}`,
  },
  {
    id: 'ci-config',
    severity: SEVERITY.INFO,
    description: 'CI/CD configuration file included',
    test: (file) =>
      /(?:^|\/)(?:\.github|\.gitlab-ci\.yml|\.travis\.yml|\.circleci|Jenkinsfile)/.test(
        file.path
      ),
    message: (file) => `CI config included: ${file.path}`,
  },
  {
    id: 'docker-file',
    severity: SEVERITY.INFO,
    description: 'Docker-related file included',
    test: (file) =>
      /(?:^|\/)(?:Dockerfile|docker-compose\.yml|\.dockerignore)/.test(file.path),
    message: (file) => `Docker file included: ${file.path}`,
  },
];

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function applyRules(files, options = {}) {
  const enabledIds = options.rules || null;
  const minSeverity = options.minSeverity || null;
  const severityOrder = [SEVERITY.INFO, SEVERITY.WARN, SEVERITY.HIGH, SEVERITY.CRITICAL];
  const minIdx = minSeverity ? severityOrder.indexOf(minSeverity) : 0;

  const violations = [];

  for (const file of files) {
    for (const rule of RULES) {
      if (enabledIds && !enabledIds.includes(rule.id)) continue;
      if (minSeverity && severityOrder.indexOf(rule.severity) < minIdx) continue;

      if (rule.test(file)) {
        if (rule.contentTest && file.content !== undefined) {
          if (!rule.contentTest(file.content)) continue;
        } else if (rule.contentTest) {
          continue;
        }

        violations.push({
          ruleId: rule.id,
          severity: rule.severity,
          file: file.path,
          size: file.size,
          message: rule.message(file),
        });
      }
    }
  }

  return violations;
}

module.exports = { RULES, SEVERITY, applyRules, formatBytes };
