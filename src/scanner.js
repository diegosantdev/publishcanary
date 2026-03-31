'use strict';

const SECRET_PATTERNS = [
  {
    id: 'aws-access-key',
    label: 'AWS Access Key ID',
    pattern: /AKIA[0-9A-Z]{16}/,
  },
  {
    id: 'aws-secret-key',
    label: 'AWS Secret Access Key',
    pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*=\s*[^\s'"]{20,}/i,
  },
  {
    id: 'github-token',
    label: 'GitHub personal access token',
    pattern: /ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}/,
  },
  {
    id: 'github-oauth',
    label: 'GitHub OAuth token',
    pattern: /gho_[a-zA-Z0-9]{36}/,
  },
  {
    id: 'npm-token',
    label: 'npm auth token',
    pattern: /(?:\/\/registry\.npmjs\.org\/:_authToken|NPM_TOKEN)\s*=?\s*[^\s'"]{20,}/i,
  },
  {
    id: 'generic-api-key',
    label: 'Generic API key assignment',
    pattern:
      /(?:api[_-]?key|apikey|api[_-]?secret|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{20,}['"]?/i,
  },
  {
    id: 'private-key-pem',
    label: 'PEM private key block',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    id: 'jwt-token',
    label: 'JWT token',
    pattern: /eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/,
  },
  {
    id: 'stripe-key',
    label: 'Stripe secret key',
    pattern: /sk_live_[a-zA-Z0-9]{24,}/,
  },
  {
    id: 'sendgrid-key',
    label: 'SendGrid API key',
    pattern: /SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}/,
  },
  {
    id: 'slack-token',
    label: 'Slack token',
    pattern: /xox[baprs]-[a-zA-Z0-9\-]+/,
  },
  {
    id: 'anthropic-key',
    label: 'Anthropic API key',
    pattern: /sk-ant-[a-zA-Z0-9_\-]{40,}/,
  },
  {
    id: 'openai-key',
    label: 'OpenAI API key',
    pattern: /sk-[a-zA-Z0-9]{48,}/,
  },
  {
    id: 'google-api-key',
    label: 'Google API key',
    pattern: /AIza[0-9A-Za-z_\-]{35}/,
  },
  {
    id: 'basic-auth-url',
    label: 'Credentials in URL (Basic Auth)',
    pattern: /https?:\/\/[^:@\s]+:[^:@\s]+@/,
  },
];

const SCAN_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.json', '.env', '.yaml', '.yml', '.toml',
  '.ini', '.conf', '.cfg', '.sh', '.bash', '.zsh', '.ps1', '.properties',
]);

const NEVER_SCAN = new Set([
  '.map', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2',
  '.ttf', '.eot', '.svg', '.mp4', '.webp', '.bin', '.gz', '.tgz',
]);

function shouldScanFile(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (NEVER_SCAN.has(ext)) return false;
  if (SCAN_EXTENSIONS.has(ext)) return true;
  const base = filePath.split('/').pop();
  return base.startsWith('.env') || base === 'Makefile' || base === 'Dockerfile';
}

function scanContent(file) {
  if (!file.content || !shouldScanFile(file.path)) return [];

  const hits = [];
  const lines = file.content.split('\n');

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    for (const sp of SECRET_PATTERNS) {
      if (sp.pattern.test(line)) {
        const redacted = line.replace(sp.pattern, (m) => m.slice(0, 6) + '***REDACTED***');
        hits.push({
          ruleId: `secret:${sp.id}`,
          severity: 'critical',
          file: file.path,
          size: file.size,
          message: `Potential secret in ${file.path} line ${li + 1} — ${sp.label}: ${redacted.trim().slice(0, 120)}`,
        });
        break;
      }
    }
  }

  return hits;
}

function scanAllFiles(files) {
  const violations = [];
  for (const f of files) {
    violations.push(...scanContent(f));
  }
  return violations;
}

module.exports = { scanAllFiles, SECRET_PATTERNS, shouldScanFile };
