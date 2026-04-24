#!/usr/bin/env node
// skill-manager — small HTTP server for assigning team-claude-skills to projects.
// Zero npm dependencies. Node 18+ only (uses no deprecated APIs).

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 4599);
const STATE_DIR = path.join(process.env.HOME, '.claude', 'team-claude-skills-ui');
const PROJECTS_FILE = path.join(STATE_DIR, 'projects.json');

fs.mkdirSync(STATE_DIR, { recursive: true });

// --- state -------------------------------------------------------------------

function loadProjects() {
  try { return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8')); } catch { return []; }
}
function saveProjects(projects) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

// --- catalog: skills and agents from this repo -------------------------------

function readFrontmatter(filePath, field) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const match = text.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim() : '';
  } catch { return ''; }
}

function listCatalog() {
  const skills = [];
  const skillsDir = path.join(ROOT, 'skills');

  for (const entry of fs.readdirSync(skillsDir)) {
    const entryPath = path.join(skillsDir, entry);
    if (!fs.statSync(entryPath).isDirectory()) continue;

    const topSkill = path.join(entryPath, 'SKILL.md');
    if (fs.existsSync(topSkill)) {
      skills.push({
        name: entry,
        category: 'misc',
        source: entryPath,
        description: readFrontmatter(topSkill, 'description'),
      });
      continue;
    }

    for (const sub of fs.readdirSync(entryPath)) {
      const subPath = path.join(entryPath, sub);
      const skillMd = path.join(subPath, 'SKILL.md');
      if (fs.existsSync(skillMd)) {
        skills.push({
          name: sub,
          category: entry,
          source: subPath,
          description: readFrontmatter(skillMd, 'description'),
        });
      }
    }
  }

  const agents = [];
  const agentsDir = path.join(ROOT, 'agents');
  for (const category of fs.readdirSync(agentsDir)) {
    const catPath = path.join(agentsDir, category);
    if (!fs.statSync(catPath).isDirectory()) continue;
    for (const file of fs.readdirSync(catPath)) {
      if (!file.endsWith('.md') || file.toLowerCase() === 'readme.md') continue;
      const agentFile = path.join(catPath, file);
      agents.push({
        name: path.basename(file, '.md'),
        category,
        source: agentFile,
        description: readFrontmatter(agentFile, 'description'),
      });
    }
  }

  const commands = [];
  const commandsDir = path.join(ROOT, 'commands');
  try {
    for (const category of fs.readdirSync(commandsDir)) {
      const catPath = path.join(commandsDir, category);
      if (!fs.statSync(catPath).isDirectory()) continue;
      for (const file of fs.readdirSync(catPath)) {
        if (!file.endsWith('.md') || file.toLowerCase() === 'readme.md') continue;
        const cmdFile = path.join(catPath, file);
        commands.push({
          name: path.basename(file, '.md'),
          category,
          source: cmdFile,
          description: readFrontmatter(cmdFile, 'description'),
        });
      }
    }
  } catch { /* no commands dir */ }

  skills.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  agents.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  commands.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  return { skills, agents, commands };
}

// --- stack detection (mirrors install-project.sh rules) ---------------------

function detectStack(projectPath) {
  const hits = { skills: {}, agents: {}, commands: {}, settings: {} };
  const flag = (bucket, name, reason) => {
    const m = hits[bucket];
    if (!m[name]) m[name] = [];
    if (!m[name].includes(reason)) m[name].push(reason);
  };

  let pkg = '';
  try { pkg = fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'); } catch {}
  const hasDep = (n) => new RegExp(`"${n.replace(/[/\\.]/g, '\\$&')}"\\s*:`).test(pkg);
  const hasDepPrefix = (p) => pkg.includes(`"${p}`);
  const hasFile = (n) => { try { return fs.statSync(path.join(projectPath, n)).isFile(); } catch { return false; } };
  const hasDir = (n) => { try { return fs.statSync(path.join(projectPath, n)).isDirectory(); } catch { return false; } };
  const hasFileGlob = (prefix) => {
    try {
      return fs.readdirSync(projectPath).some(f => f.startsWith(prefix));
    } catch { return false; }
  };

  // --- Backend: Fastify gateway + observability + API spec ---
  let isBackend = false;
  if (hasDep('fastify')) {
    isBackend = true;
    flag('skills', 'neolink-fastify-gateway-generator', 'fastify');
    flag('skills', 'neolink-gateway-setup',             'fastify');
    flag('skills', 'api-spec-generator',                'fastify');
  }
  if (hasDep('@fastify/autoload')) {
    isBackend = true;
    flag('skills', 'neolink-fastify-gateway-generator', '@fastify/autoload');
  }
  if (hasDep('fastify-plugin')) {
    isBackend = true;
    flag('skills', 'neolink-fastify-gateway-generator', 'fastify-plugin dep');
  }
  if (hasDepPrefix('@neolinkrnd/fastify-bundle')) {
    isBackend = true;
    flag('skills', 'neolink-fastify-gateway-generator', '@neolinkrnd/fastify-bundle-*');
    flag('skills', 'neolink-gateway-setup',             '@neolinkrnd/fastify-bundle-*');
  }
  if (isBackend) {
    if (hasDep('@trpc/server'))       flag('skills', 'api-spec-generator',                '@trpc/server');
    if (hasDep('@sinclair/typemap'))  flag('skills', 'neolink-fastify-gateway-generator', '@sinclair/typemap');
    if (hasDep('@nx/node'))           flag('skills', 'neolink-fastify-gateway-generator', '@nx/node');
    flag('agents', 'backend-implementer', 'backend detected');
  }

  // --- Frontend: Angular 21 + NX ---
  let isFrontend = false;
  if (hasDep('@angular/core') || hasFile('angular.json')) {
    isFrontend = true;
    flag('skills', 'angular-nx-architect', '@angular/core');
    flag('skills', 'angular-unit-test',    '@angular/core');
  }
  if (hasDep('@nx/angular')) { isFrontend = true; flag('skills', 'angular-nx-architect', '@nx/angular'); }
  if (isFrontend) {
    if (hasDep('@angular/material'))        flag('skills', 'angular-nx-architect', '@angular/material');
    if (hasDep('tailwindcss'))              flag('skills', 'angular-nx-architect', 'tailwindcss');
    if (hasFileGlob('tailwind.config.'))    flag('skills', 'angular-nx-architect', 'tailwind.config');
    if (hasDep('vitest'))                   flag('skills', 'angular-unit-test',    'vitest');
    if (hasFileGlob('vitest.config.'))      flag('skills', 'angular-unit-test',    'vitest.config');
    if (hasFileGlob('playwright.config.'))  flag('skills', 'angular-unit-test',    'playwright.config');

    // Neolink portal repos only — angular-neolink-template is specific to
    // apps/portal-example, portal-neolink, portal-hive.
    const pkgName = (pkg.match(/"name"\s*:\s*"([^"]+)"/) || [])[1] || '';
    if (/portal|neolink/i.test(pkgName)) {
      flag('skills', 'angular-neolink-template', 'portal/neolink package name');
    }
    try {
      const apps = fs.readdirSync(path.join(projectPath, 'apps'));
      if (apps.some((a) => a.startsWith('portal-'))) {
        flag('skills', 'angular-neolink-template', 'apps/portal-* present');
      }
    } catch { /* no apps/ dir, ignore */ }

    flag('agents', 'frontend-implementer', 'frontend detected');
  }

  // --- Shared: Zod (still valid; no replacement among the new skills) ---
  if (hasDep('zod'))               flag('skills', 'zod-schema', 'zod');
  if (hasDep('@sinclair/typemap')) flag('skills', 'zod-schema', '@sinclair/typemap');

  // --- DevOps ---
  let isDevops = false;
  for (const m of ['Dockerfile', 'Dockerfile.prod', 'Dockerfile.dev',
                   'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml',
                   'Chart.yaml', 'skaffold.yaml', 'kustomization.yaml']) {
    if (hasFile(m)) { isDevops = true; flag('skills', 'argocd-k8s-deploy', m); }
  }
  for (const d of ['k8s', 'kubernetes', 'manifests', 'deploy', 'helm', 'charts', '.argocd', 'argocd']) {
    if (hasDir(d)) { isDevops = true; flag('skills', 'argocd-k8s-deploy', `${d}/`); }
  }
  if (hasDepPrefix('@neolinkrnd/')) { isDevops = true; flag('skills', 'argocd-k8s-deploy', '@neolinkrnd/* (Neolink service)'); }
  if (isDevops) flag('agents', 'deploy-captain', 'deploy markers');

  // --- Full-stack monorepo ---
  if (isBackend && isFrontend) {
    flag('agents', 'schema-owner', 'full-stack monorepo');
    flag('skills', 'agent-teams',  'full-stack monorepo');
    flag('skills', 'team-lead',    'agent-teams enabled');
  }

  // --- Project brain + /feature workflow for any stack ---
  if (isBackend || isFrontend) {
    flag('skills',   'codebase-scan',   'stack detected');
    flag('skills',   'feature-outcome', 'stack detected');
    flag('commands', 'feature',         'stack detected');
  }

  // --- Settings (independent toggles) ---
  // Preselect if no existing settings.json; if one exists, UI will disable
  // the toggles and reflect parsed state instead.
  if (!hasFile(path.join('.claude', 'settings.json'))) {
    flag('settings', 'agentTeams', 'no existing settings.json');
    flag('settings', 'autoMemory', 'no existing settings.json');
  }

  return hits;
}

// --- what's currently installed ---------------------------------------------

function currentlyInstalled(projectPath) {
  const installed = {
    skills: [],
    agents: [],
    commands: [],
    hasSettings: false,
    settings: { agentTeams: false, autoMemory: false },
  };
  const skillsDir = path.join(projectPath, '.claude', 'skills');
  const agentsDir = path.join(projectPath, '.claude', 'agents');
  const commandsDir = path.join(projectPath, '.claude', 'commands');
  try { installed.skills = fs.readdirSync(skillsDir); } catch {}
  try {
    installed.agents = fs.readdirSync(agentsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''));
  } catch {}
  try {
    installed.commands = fs.readdirSync(commandsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''));
  } catch {}
  const settingsFile = path.join(projectPath, '.claude', 'settings.json');
  if (fs.existsSync(settingsFile)) {
    installed.hasSettings = true;
    try {
      const s = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      installed.settings.agentTeams = s?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1';
      installed.settings.autoMemory = s?.autoMemoryEnabled === true;
    } catch { /* malformed JSON — leave both false */ }
  }
  return installed;
}

// --- apply desired state -----------------------------------------------------

function applyInstall(projectPath, plan) {
  const claudeDir = path.join(projectPath, '.claude');
  fs.mkdirSync(path.join(claudeDir, 'skills'),   { recursive: true });
  fs.mkdirSync(path.join(claudeDir, 'agents'),   { recursive: true });
  fs.mkdirSync(path.join(claudeDir, 'commands'), { recursive: true });

  const catalog = listCatalog();
  const skillMap   = Object.fromEntries(catalog.skills.map(s => [s.name, s]));
  const agentMap   = Object.fromEntries(catalog.agents.map(a => [a.name, a]));
  const commandMap = Object.fromEntries(catalog.commands.map(c => [c.name, c]));

  const results = { installed: [], removed: [], skipped: [] };

  const wantSkills   = new Set(plan.skills   || []);
  const wantAgents   = new Set(plan.agents   || []);
  const wantCommands = new Set(plan.commands || []);

  // Skills: install wanted; remove any symlinks in .claude/skills that aren't wanted
  for (const name of wantSkills) {
    const entry = skillMap[name];
    if (!entry) { results.skipped.push(`skill:${name} (not in catalog)`); continue; }
    const dst = path.join(claudeDir, 'skills', name);
    removeAt(dst);
    fs.symlinkSync(entry.source, dst);
    results.installed.push(`skill:${name}`);
  }
  let existing = [];
  try { existing = fs.readdirSync(path.join(claudeDir, 'skills')); } catch {}
  for (const name of existing) {
    if (!wantSkills.has(name)) {
      removeAt(path.join(claudeDir, 'skills', name));
      results.removed.push(`skill:${name}`);
    }
  }

  // Agents
  for (const name of wantAgents) {
    const entry = agentMap[name];
    if (!entry) { results.skipped.push(`agent:${name} (not in catalog)`); continue; }
    const dst = path.join(claudeDir, 'agents', `${name}.md`);
    removeAt(dst);
    fs.symlinkSync(entry.source, dst);
    results.installed.push(`agent:${name}`);
  }
  let existingAgents = [];
  try { existingAgents = fs.readdirSync(path.join(claudeDir, 'agents')).filter(f => f.endsWith('.md')); } catch {}
  for (const file of existingAgents) {
    const name = file.replace(/\.md$/, '');
    if (!wantAgents.has(name)) {
      removeAt(path.join(claudeDir, 'agents', file));
      results.removed.push(`agent:${name}`);
    }
  }

  // Commands
  for (const name of wantCommands) {
    const entry = commandMap[name];
    if (!entry) { results.skipped.push(`command:/${name} (not in catalog)`); continue; }
    const dst = path.join(claudeDir, 'commands', `${name}.md`);
    removeAt(dst);
    fs.symlinkSync(entry.source, dst);
    results.installed.push(`command:/${name}`);
  }
  let existingCommands = [];
  try { existingCommands = fs.readdirSync(path.join(claudeDir, 'commands')).filter(f => f.endsWith('.md')); } catch {}
  for (const file of existingCommands) {
    const name = file.replace(/\.md$/, '');
    if (!wantCommands.has(name)) {
      removeAt(path.join(claudeDir, 'commands', file));
      results.removed.push(`command:/${name}`);
    }
  }

  // Settings — safely merge into existing settings.json (if any), touching
  // only the two keys we manage. Other keys the user has in the file are
  // preserved. If both flags end up disabled and the file becomes empty, we
  // remove it.
  const wantAgentTeams = !!(plan.settings && plan.settings.agentTeams);
  const wantAutoMemory = !!(plan.settings && plan.settings.autoMemory);
  const target = path.join(claudeDir, 'settings.json');

  let payload = {};
  let parseOk = true;
  if (fs.existsSync(target)) {
    try { payload = JSON.parse(fs.readFileSync(target, 'utf8')); if (payload === null || typeof payload !== 'object') { payload = {}; parseOk = false; } }
    catch { parseOk = false; }
  }

  if (!parseOk) {
    results.skipped.push('settings.json (malformed JSON — left as-is)');
  } else {
    // Agent teams env var
    if (wantAgentTeams) {
      if (typeof payload.env !== 'object' || payload.env === null) payload.env = {};
      payload.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1';
    } else if (payload.env && typeof payload.env === 'object') {
      delete payload.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
      if (Object.keys(payload.env).length === 0) delete payload.env;
    }

    // Auto memory flag
    if (wantAutoMemory) payload.autoMemoryEnabled = true;
    else delete payload.autoMemoryEnabled;

    const hadFile = fs.existsSync(target);
    const isEmpty = Object.keys(payload).length === 0;

    if (isEmpty) {
      if (hadFile) { fs.unlinkSync(target); results.removed.push('settings.json (empty after toggle-off)'); }
    } else {
      fs.writeFileSync(target, JSON.stringify(payload, null, 2) + '\n');
      const parts = [];
      if (wantAgentTeams) parts.push('agentTeams=1');
      if (wantAutoMemory) parts.push('autoMemoryEnabled=true');
      const label = parts.length ? `settings.json (${parts.join(', ')})` : 'settings.json (other keys preserved)';
      if (hadFile) results.installed.push(`updated ${label}`);
      else         results.installed.push(`wrote ${label}`);
    }
  }

  return results;
}

function removeAt(p) {
  try {
    const s = fs.lstatSync(p);
    if (s.isSymbolicLink() || s.isFile()) fs.unlinkSync(p);
    else fs.rmSync(p, { recursive: true, force: true });
  } catch {}
}

// --- HTTP --------------------------------------------------------------------

function send(res, status, body, contentType = 'application/json') {
  const headers = { 'Content-Type': contentType };
  if (contentType.startsWith('application/json')) headers['Cache-Control'] = 'no-store';
  res.writeHead(status, headers);
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function staticFile(res, relPath, contentType) {
  try {
    send(res, 200, fs.readFileSync(path.join(__dirname, 'public', relPath), 'utf8'), contentType);
  } catch {
    send(res, 404, 'not found', 'text/plain');
  }
}

async function handle(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;

  try {
    if (req.method === 'GET' && pathname === '/')            return staticFile(res, 'index.html', 'text/html; charset=utf-8');
    if (req.method === 'GET' && pathname === '/app.js')      return staticFile(res, 'app.js',     'text/javascript; charset=utf-8');
    if (req.method === 'GET' && pathname === '/styles.css')  return staticFile(res, 'styles.css', 'text/css; charset=utf-8');

    if (req.method === 'GET' && pathname === '/api/catalog') return send(res, 200, listCatalog());
    if (req.method === 'GET' && pathname === '/api/projects') return send(res, 200, loadProjects());

    if (req.method === 'GET' && pathname === '/api/fs') {
      const rawReq = url.searchParams.get('path') || process.env.HOME || '/';
      const expanded = rawReq.replace(/^~(?=\/|$)/, process.env.HOME || '');
      const resolved = path.resolve(expanded);
      try {
        const stat = fs.statSync(resolved);
        if (!stat.isDirectory()) return send(res, 400, { error: 'not a directory', path: resolved });
        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        const dirs = entries
          .filter(e => e.isDirectory() && !e.name.startsWith('.'))
          .map(e => ({
            name: e.name,
            // a dir is "project-like" if it has any of these markers — nice hint for the picker
            projectLike: fs.existsSync(path.join(resolved, e.name, 'package.json'))
                     || fs.existsSync(path.join(resolved, e.name, '.git')),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const parent = path.dirname(resolved);
        return send(res, 200, {
          path: resolved,
          parent: parent === resolved ? null : parent,
          dirs,
          home: process.env.HOME || null,
          isProjectLike: fs.existsSync(path.join(resolved, 'package.json'))
                     || fs.existsSync(path.join(resolved, '.git')),
        });
      } catch (err) {
        return send(res, 400, { error: err.message, path: resolved });
      }
    }

    if (req.method === 'POST' && pathname === '/api/projects') {
      const body = await readBody(req);
      if (!body.path) return send(res, 400, { error: 'path required' });
      const target = path.resolve(body.path.replace(/^~/, process.env.HOME || ''));
      if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
        return send(res, 400, { error: `${target} is not a directory` });
      }
      const projects = loadProjects();
      if (!projects.some(p => p.path === target)) {
        let name = path.basename(target);
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
          if (pkg.name) name = pkg.name;
        } catch {}
        projects.push({ path: target, name });
        saveProjects(projects);
      }
      return send(res, 200, projects);
    }

    const delMatch = pathname.match(/^\/api\/projects\/(\d+)$/);
    if (req.method === 'DELETE' && delMatch) {
      const projects = loadProjects();
      const idx = Number(delMatch[1]);
      if (idx >= 0 && idx < projects.length) {
        projects.splice(idx, 1);
        saveProjects(projects);
      }
      return send(res, 200, projects);
    }

    const statusMatch = pathname.match(/^\/api\/projects\/(\d+)\/status$/);
    if (req.method === 'GET' && statusMatch) {
      const projects = loadProjects();
      const project = projects[Number(statusMatch[1])];
      if (!project) return send(res, 404, { error: 'project not found' });
      return send(res, 200, {
        project,
        detected: detectStack(project.path),
        installed: currentlyInstalled(project.path),
      });
    }

    const applyMatch = pathname.match(/^\/api\/projects\/(\d+)\/apply$/);
    if (req.method === 'POST' && applyMatch) {
      const projects = loadProjects();
      const project = projects[Number(applyMatch[1])];
      if (!project) return send(res, 404, { error: 'project not found' });
      const body = await readBody(req);
      const result = applyInstall(project.path, body);
      const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
      console.log(`[${ts}] apply -> ${project.path}/.claude/`);
      for (const line of result.installed) console.log(`  + ${line}`);
      for (const line of result.removed)   console.log(`  - ${line}`);
      for (const line of result.skipped)   console.log(`  ~ ${line}`);
      return send(res, 200, result);
    }

    send(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: String(err && err.message ? err.message : err) });
  }
}

const server = http.createServer(handle);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`team-claude-skills manager running at http://localhost:${PORT}/`);
  console.log(`state:  ${PROJECTS_FILE}`);
  console.log(`source: ${ROOT}`);
});
