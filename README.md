<div align="center">
  <img src="assets/canary.svg" width="320" alt="npm-canary" />
</div>

<br/>

<div align="center">

*"Scan what you ship. Not just what you write."*

[![npm](https://img.shields.io/npm/v/npm-canary?color=cyan&label=npm-canary)](https://www.npmjs.com/package/npm-canary)
![License](https://img.shields.io/npm/l/npm-canary)
![Node](https://img.shields.io/node/v/npm-canary)

</div>

---

## The problem

Today's Claude Code source leak hit GitHub with **55k+ stars in hours**. The dev community is reading Anthropic's internals.

While everyone is studying the agent, nobody is checking what the agent **ships**.

ggshield, TruffleHog, detect-secrets, Hawkeye: every security tool out there scans your **git commits and source files**. None of them scan the actual **tarball** uploaded to the npm registry.

That's the difference between auditing a draft and auditing what ships.

**npm-canary closes that gap.**

---

## What makes it different

| Feature | npm-canary | publint | are-the-types-wrong | bundlephobia | npm audit |
|---|:---:|:---:|:---:|:---:|:---:|
| Pre-publish local check | ✅ | ✅ | ✅ | ❌ | ❌ |
| Audit any published package | ✅ | ❌ | ✅ | ✅ | ✅ |
| Source map detection | ✅ | ❌ | ❌ | ❌ | ❌ |
| 15 secret patterns (AWS, GitHub…) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Content-based leaked-key scan | ✅ | ❌ | ❌ | ❌ | ❌ |
| Version diff (`compare`) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Publish safety score (0–100) | ✅ | ❌ | ❌ | ❌ | ❌ |
| File size budget enforcement | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## The Anthropic bug: live demo

Anthropic published a **59 MB source map** exposing their full internal source tree in `@anthropic-ai/claude-code@2.1.7`.

npm-canary catches it in seconds — **no API key needed**, just the npm registry:

```bash
npx npm-canary audit @anthropic-ai/claude-code@2.1.7
```

```
  ✔ 105 files  ·  118 MB

  npm-canary ─────────────────────────────────────
  package  @anthropic-ai/claude-code@2.1.7
  scanned  105 file(s)  ·  118 MB
  ────────────────────────────────────────────────

  [CRITICAL]  2 issues

  ✖  Source map detected: cli.js.map (59.6 MB) — exposes original source code
  ✖  Massive source map: cli.js.map (59.6 MB) — full source tree embedded

  [HIGH]  1 issue

  ⚠  Oversized file: cli.js.map (59.6 MB) — likely source artifact

  Found 2 critical, 1 high

  ────────────────────────────────────────────────

  safety score    0 / 100  ░░░░░░░░░░░░░░░░░░░░  F — Critical issues
```

The current latest (`2.1.87`) still ships a **12.37 MB unminified `cli.js`**:

```
  safety score   80 / 100  ████████████████░░░░  B — Good
```

---

## Installation

```bash
npm install --save-dev npm-canary
```

Gate every `npm publish` with one line in `package.json`:

```json
{
  "scripts": {
    "prepublishOnly": "npm-canary check"
  }
}
```

From that point on, any `npm publish` runs the check and **fails before anything leaks**.

Zero configuration. Zero external dependencies. Node.js built-ins only.

---

## Commands

### `check`: pre-publish local scan

Simulates `npm pack`, reads `.npmignore` and the `files` field, then content-scans every JS/JSON/YAML for secrets.

```bash
npx npm-canary check
npx npm-canary check --fail-on critical
npx npm-canary check --threshold 5         # fail if package > 5 MB
npx npm-canary check --min-severity warn
npx npm-canary check --json > report.json
```

### `audit`: scan any published package

Fetches the tarball from the npm registry, extracts it, and runs the full ruleset + 15 secret patterns.

```bash
npx npm-canary audit react@18.2.0
npx npm-canary audit next@latest
npx npm-canary audit @anthropic-ai/claude-code@2.1.87
```

### `audit-git`: scan a remote GitHub repository

Fetches a repository tarball directly from GitHub and performs pre-publish structural and content scans before a package is ever published. Supports private repos via GitHub tokens.

```bash
npx npm-canary audit-git instructkr/claw-code
npx npm-canary audit-git owner/repo --ref main
npx npm-canary audit-git private/repo --token-env GITHUB_TOKEN
```

### `compare`: diff two versions

Shows exactly what files changed between versions, which violations are new, and which were fixed.

```bash
npx npm-canary compare react@17.0.2 react@18.2.0
npx npm-canary compare lodash@4.17.20 lodash@4.17.21
```

### `rules`: list all detection rules

```bash
npx npm-canary rules
npx npm-canary rules --json
```

### Interactive UI

Run with no arguments to explore features interactively.

```bash
npx npm-canary
```

---

## Detection rules

### Structural rules

| Rule | Severity | What it catches |
|:--|:--|:--|
| `source-map` | 🔴 CRITICAL | `.js.map`, `.ts.map`, `.css.map` |
| `oversized-map` | 🔴 CRITICAL | Source maps > 1 MB |
| `sourcecontent-json` | 🔴 CRITICAL | `sourcesContent` field inside map JSON |
| `dotenv` | 🔴 CRITICAL | `.env`, `.env.local`, `.env.production` |
| `private-key` | 🔴 CRITICAL | `.pem`, `.key`, `id_rsa`, `id_ed25519` |
| `source-typescript` | 🟠 HIGH | `.ts` source (not `.d.ts`) |
| `source-jsx` | 🟠 HIGH | `.jsx`, `.tsx` source |
| `oversized-file` | 🟠 HIGH | Any file > 10 MB |
| `config-internal` | 🟡 WARN | `.eslintrc`, `.babelrc`, `jest.config` |
| `test-directory` | 🟡 WARN | `tests/`, `__tests__/`, `*.test.js` |
| `gitignore-file` | ⚪ INFO | Leaked `.gitignore` |
| `ci-config` | ⚪ INFO | `.github/`, `.travis.yml` |
| `docker-file` | ⚪ INFO | `Dockerfile`, `docker-compose.yml` |

### Content-based secret patterns (15 patterns)

Scans file content in `.js`, `.json`, `.ts`, `.yaml`, `.env`, `.sh` and more:

| Pattern | Examples |
|:--|:--|
| AWS keys | `AKIA…`, `aws_secret_access_key` |
| GitHub tokens | `ghp_…`, `gho_…`, `github_pat_…` |
| npm tokens | `_authToken`, `NPM_TOKEN` |
| OpenAI keys | `sk-…` (48+ chars) |
| Anthropic keys | `sk-ant-…` |
| Google API keys | `AIza…` |
| Stripe secrets | `sk_live_…` |
| SendGrid keys | `SG.…` |
| Slack tokens | `xoxb-…`, `xoxa-…` |
| JWT tokens | `eyJ…eyJ…` |
| PEM private keys | `-----BEGIN PRIVATE KEY-----` |
| Generic API key assignments | `api_key: "…"`, `access_token = "…"` |
| Credentials in URLs | `https://user:pass@host` |

---

## Publish safety score

Every scan produces a **0–100 score** with a letter grade:

| Score | Grade | Meaning |
|:--|:--:|:--|
| 90–100 | **A** | Excellent: publish-ready |
| 75–89 | **B** | Good: minor issues |
| 55–74 | **C** | Needs attention |
| 30–54 | **D** | Poor: significant risk |
| 0–29 | **F** | Critical: do not publish |

---

## Status badges

Generate a `shields.io`-style SVG badge for your README:

```bash
npx npm-canary check --badge canary-badge.svg
```

![Canary Badge](https://img.shields.io/badge/npm--canary-100%2F100-brightgreen)

---

## CI integration

```yaml
# .github/workflows/publish.yml
- name: Canary check
  run: npx npm-canary check --fail-on high --json > canary-report.json

- name: Upload report
  uses: actions/upload-artifact@v4
  with:
    name: canary-report
    path: canary-report.json
```

---

## Configuration

`.canaryrc` or `.canaryrc.json` in your project root:

```json
{
  "failOn": "high",
  "minSeverity": "warn",
  "ignore": ["tests/fixtures/**"]
}
```

Or in `package.json`:

```json
{
  "canary": {
    "failOn": "critical",
    "rules": ["source-map", "dotenv", "private-key"]
  }
}
```

---

## Exit codes

| Code | Meaning |
|:--|:--|
| `0` | All clear |
| `1` | High severity issues found |
| `2` | Critical issues found |

Control the threshold with `--fail-on [info|warn|high|critical]`.

---

## License

MIT © [@diegosantdev](https://github.com/diegosantdev)

---

<div align="center">
  <sub><i>Built after the Claude Code leak. Everyone was reading the agent code: I wanted to know what the agent was quietly shipping.</i></sub>
</div>