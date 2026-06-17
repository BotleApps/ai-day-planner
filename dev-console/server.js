#!/usr/bin/env node
/* eslint-disable */
/**
 * AI Day Planner — Dev Console
 * ----------------------------
 * A tiny zero-dependency control panel that turns run-local.sh / deploy.sh
 * and the common npm scripts into clickable buttons.
 *
 * Two ways to run each action:
 *   • "Open in Terminal" → launches the command in a real Terminal window
 *     (best for interactive scripts: MongoDB prompt, SSO login, Ctrl+C, etc.)
 *   • "Run here"         → streams the command output live into the page
 *     (best for quick non-interactive checks: build, lint, type-check).
 *
 * Security: binds to 127.0.0.1 only and executes ONLY the predefined
 * commands in the allow-list below — no arbitrary input is ever run.
 *
 * Start with:  node dev-console/server.js   (or: npm run console)
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.CONSOLE_PORT || 4599);
const HOST = '127.0.0.1';

// ── Command allow-list ────────────────────────────────────────────────────────
// id → { group, title, desc, cmd, danger?, confirm? }
// `cmd` is the literal shell command run from the project root.
const COMMANDS = {
  // ── Local development ──
  'local:run': {
    group: 'Local Development',
    title: 'Run Local (full setup)',
    desc: 'run-local.sh — checks prerequisites, starts MongoDB (Docker), installs deps, type-checks, then starts the dev server.',
    cmd: './run-local.sh',
    icon: '🚀',
    interactive: true,
  },
  'local:run-nodocker': {
    group: 'Local Development',
    title: 'Run Local (no Docker)',
    desc: 'run-local.sh --no-docker — same as above but skips the Docker/MongoDB container (use your own Mongo URI).',
    cmd: './run-local.sh --no-docker',
    icon: '🐳',
    interactive: true,
  },
  'local:run-clean': {
    group: 'Local Development',
    title: 'Run Local (clean install)',
    desc: 'run-local.sh --clean — removes node_modules & .next first, then full setup. Slower but fixes broken deps.',
    cmd: './run-local.sh --clean',
    icon: '🧹',
    interactive: true,
  },
  'local:dev': {
    group: 'Local Development',
    title: 'Dev server only',
    desc: 'npm run dev — just start Next.js (assumes deps + DB already set up).',
    cmd: 'npm run dev',
    icon: '⚡',
    interactive: true,
  },
  'local:ios': {
    group: 'Local Development',
    title: 'Run on iOS Simulator',
    desc: 'scripts/run-mobile.sh ios — starts the backend (if not already running), points the native shell at http://localhost:3000, then builds & launches in the iOS Simulator. Needs macOS + Xcode + CocoaPods.',
    cmd: 'npm run mobile:ios',
    icon: '',
    interactive: true,
  },
  'local:android': {
    group: 'Local Development',
    title: 'Run on Android Emulator',
    desc: 'scripts/run-mobile.sh android — starts the backend (if not already running), points the native shell at http://10.0.2.2:3000, then builds & launches in the Android Emulator. Needs Android Studio + JDK 17.',
    cmd: 'npm run mobile:android',
    icon: '🤖',
    interactive: true,
  },

  // ── Setup & quality ──
  'setup:install': {
    group: 'Setup & Quality',
    title: 'Install dependencies',
    desc: 'npm install — install/update all packages.',
    cmd: 'npm install',
    icon: '📦',
  },
  'setup:ci': {
    group: 'Setup & Quality',
    title: 'Clean install (npm ci)',
    desc: 'npm ci — reproducible install from package-lock.json.',
    cmd: 'npm ci',
    icon: '🔁',
  },
  'qa:typecheck': {
    group: 'Setup & Quality',
    title: 'Type check',
    desc: 'npm run type-check — TypeScript compile check (no emit).',
    cmd: 'npm run type-check',
    icon: '🔎',
  },
  'qa:lint': {
    group: 'Setup & Quality',
    title: 'Lint',
    desc: 'npm run lint — run ESLint.',
    cmd: 'npm run lint',
    icon: '🧶',
  },
  'qa:lintfix': {
    group: 'Setup & Quality',
    title: 'Lint & auto-fix',
    desc: 'npm run lint:fix — run ESLint and auto-fix issues.',
    cmd: 'npm run lint:fix',
    icon: '🛠️',
  },
  'qa:build': {
    group: 'Setup & Quality',
    title: 'Production build',
    desc: 'npm run build — build the Next.js app (standalone output).',
    cmd: 'npm run build',
    icon: '🏗️',
  },

  // ── Deploy (SAP BTP Cloud Foundry) ──
  'deploy:dev': {
    group: 'Deploy → Cloud Foundry',
    title: 'Deploy to DEV',
    desc: 'deploy.sh dev — build, push & migrate to the development space.',
    cmd: './deploy.sh dev',
    icon: '🟢',
    interactive: true,
  },
  'deploy:qual': {
    group: 'Deploy → Cloud Foundry',
    title: 'Deploy to QUAL',
    desc: 'deploy.sh qual — build, push & migrate to qualification/staging.',
    cmd: './deploy.sh qual',
    icon: '🟡',
    interactive: true,
    confirm: 'Deploy to QUALIFICATION? This will build and push to the qual space.',
  },
  'deploy:prod': {
    group: 'Deploy → Cloud Foundry',
    title: 'Deploy to PROD',
    desc: 'deploy.sh prod — build, push & migrate to PRODUCTION.',
    cmd: './deploy.sh prod',
    icon: '🔴',
    interactive: true,
    danger: true,
    confirm: 'Deploy to PRODUCTION? This pushes live to the production space.',
  },

  // ── Mobile (Capacitor native shell) ──
  'cap:sync': {
    group: 'Mobile (iOS / Android)',
    title: 'Sync native projects',
    desc: 'cap sync — copy config + web fallback into the iOS/Android projects. Set CAP_SERVER_URL first to point at a landscape.',
    cmd: 'npm run cap:sync',
    icon: '🔄',
    interactive: true,
  },
  'cap:ios': {
    group: 'Mobile (iOS / Android)',
    title: 'Open iOS (Xcode)',
    desc: 'cap sync ios && cap open ios — sync and launch Xcode. Needs macOS + Xcode. Export CAP_SERVER_URL first.',
    cmd: 'npm run cap:ios',
    icon: '',
    interactive: true,
  },
  'cap:android': {
    group: 'Mobile (iOS / Android)',
    title: 'Open Android (Studio)',
    desc: 'cap sync android && cap open android — sync and launch Android Studio. Export CAP_SERVER_URL first.',
    cmd: 'npm run cap:android',
    icon: '🤖',
    interactive: true,
  },
  'cap:add:ios': {
    group: 'Mobile (iOS / Android)',
    title: 'Add iOS project (one-time)',
    desc: 'cap add ios — scaffold the native iOS project. Run once. Needs macOS + Xcode + CocoaPods.',
    cmd: 'npm run cap:add:ios',
    icon: '➕',
    interactive: true,
  },
  'cap:add:android': {
    group: 'Mobile (iOS / Android)',
    title: 'Add Android project (one-time)',
    desc: 'cap add android — scaffold the native Android project. Run once. Needs Android Studio + JDK 17.',
    cmd: 'npm run cap:add:android',
    icon: '➕',
    interactive: true,
  },

  // ── Cloud Foundry utilities ──
  'cf:logs': {
    group: 'CF Utilities',
    title: 'Recent logs',
    desc: 'cf logs ai-day-planner --recent',
    cmd: 'cf logs ai-day-planner --recent',
    icon: '📜',
  },
  'cf:tail': {
    group: 'CF Utilities',
    title: 'Live logs (tail)',
    desc: 'cf logs ai-day-planner — stream live logs (Ctrl+C to stop).',
    cmd: 'cf logs ai-day-planner',
    icon: '📡',
    interactive: true,
  },
  'cf:app': {
    group: 'CF Utilities',
    title: 'App status',
    desc: 'cf app ai-day-planner — show app health & instances.',
    cmd: 'cf app ai-day-planner',
    icon: 'ℹ️',
  },
  'cf:tasks': {
    group: 'CF Utilities',
    title: 'Tasks (migrations)',
    desc: 'cf tasks ai-day-planner — list run-task history (DB migrations).',
    cmd: 'cf tasks ai-day-planner',
    icon: '🧬',
  },
  'cf:events': {
    group: 'CF Utilities',
    title: 'App events',
    desc: 'cf events ai-day-planner — recent crash/restart events.',
    cmd: 'cf events ai-day-planner',
    icon: '🗓️',
  },
};

// ── Running jobs (for "Run here" live streaming) ──────────────────────────────
const jobs = new Map(); // jobId → { child, buffer, clients:Set<res>, done, code }

function appleEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function openInTerminal(cmd) {
  const full = `cd "${ROOT}" && ${cmd}`;
  if (process.platform === 'darwin') {
    const script =
      'tell application "Terminal"\n' +
      '  activate\n' +
      `  do script "${appleEscape(full)}"\n` +
      'end tell';
    spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' }).unref();
    return { ok: true, via: 'Terminal.app' };
  }
  if (process.platform === 'linux') {
    // Try a few common terminals.
    const term = process.env.TERMINAL || 'x-terminal-emulator';
    spawn(term, ['-e', `bash -lc '${full.replace(/'/g, "'\\''")}'`], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    return { ok: true, via: term };
  }
  return { ok: false, error: 'Opening a Terminal is only supported on macOS/Linux. Use "Run here" instead.' };
}

function startJob(cmd) {
  const jobId = crypto.randomBytes(6).toString('hex');
  const child = spawn('bash', ['-lc', cmd], { cwd: ROOT });
  const job = { child, buffer: '', clients: new Set(), done: false, code: null };
  jobs.set(jobId, job);

  const push = (chunk) => {
    const text = chunk.toString();
    job.buffer += text;
    if (job.buffer.length > 500_000) job.buffer = job.buffer.slice(-400_000);
    for (const res of job.clients) sendSse(res, 'output', text);
  };
  child.stdout.on('data', push);
  child.stderr.on('data', push);
  child.on('close', (code) => {
    job.done = true;
    job.code = code;
    for (const res of job.clients) {
      sendSse(res, 'exit', String(code));
      res.end();
    }
    setTimeout(() => jobs.delete(jobId), 5 * 60 * 1000);
  });
  child.on('error', (err) => {
    push(`\n[dev-console] failed to start: ${err.message}\n`);
  });
  return jobId;
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  for (const line of String(data).split('\n')) res.write(`data: ${line}\n`);
  res.write('\n');
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Serve UI
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // Command catalog
  if (req.method === 'GET' && url.pathname === '/api/commands') {
    const list = Object.entries(COMMANDS).map(([id, c]) => ({
      id,
      group: c.group,
      title: c.title,
      desc: c.desc,
      cmd: c.cmd,
      icon: c.icon || '•',
      danger: !!c.danger,
      confirm: c.confirm || null,
      interactive: !!c.interactive,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ root: ROOT, commands: list }));
  }

  // Launch in real Terminal
  if (req.method === 'POST' && url.pathname === '/api/launch') {
    return readBody(req, (body) => {
      const cmd = COMMANDS[body.id];
      if (!cmd) return json(res, 400, { error: 'Unknown command id' });
      const result = openInTerminal(cmd.cmd);
      return json(res, result.ok ? 200 : 500, result);
    });
  }

  // Run here (stream)
  if (req.method === 'POST' && url.pathname === '/api/run') {
    return readBody(req, (body) => {
      const cmd = COMMANDS[body.id];
      if (!cmd) return json(res, 400, { error: 'Unknown command id' });
      const jobId = startJob(cmd.cmd);
      return json(res, 200, { jobId });
    });
  }

  // SSE stream of a job
  if (req.method === 'GET' && url.pathname === '/api/stream') {
    const jobId = url.searchParams.get('job');
    const job = jobs.get(jobId);
    if (!job) return json(res, 404, { error: 'Job not found' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    if (job.buffer) sendSse(res, 'output', job.buffer);
    if (job.done) {
      sendSse(res, 'exit', String(job.code));
      return res.end();
    }
    job.clients.add(res);
    req.on('close', () => job.clients.delete(res));
    return;
  }

  // Stop a running job
  if (req.method === 'POST' && url.pathname === '/api/stop') {
    return readBody(req, (body) => {
      const job = jobs.get(body.job);
      if (!job) return json(res, 404, { error: 'Job not found' });
      try {
        job.child.kill('SIGINT');
        setTimeout(() => job.child.kill('SIGKILL'), 3000);
      } catch (_) {}
      return json(res, 200, { ok: true });
    });
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

function readBody(req, cb) {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => {
    try {
      cb(data ? JSON.parse(data) : {});
    } catch (e) {
      cb({});
    }
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

server.listen(PORT, HOST, () => {
  const link = `http://${HOST}:${PORT}`;
  console.log('\n  AI Day Planner — Dev Console');
  console.log('  ' + '─'.repeat(40));
  console.log(`  ▶  ${link}`);
  console.log(`  📁 ${ROOT}`);
  console.log('  Press Ctrl+C to stop.\n');
  // Best-effort auto-open the browser.
  const opener =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' : 'xdg-open';
  try { spawn(opener, [link], { detached: true, stdio: 'ignore' }).unref(); } catch (_) {}
});
