// skill-manager client. No framework; direct DOM.

let projects = [];
let catalog = { skills: [], agents: [], commands: [] };
let currentIdx = null;
let status = null;

const $projects = document.getElementById('projects');
const $main = document.getElementById('main');
const $addForm = document.getElementById('add-form');
const $pathInput = $addForm.querySelector('input[name="path"]');

// ---------- add project ----------

$addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: $pathInput.value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'add failed' }));
    alert(err.error || 'add failed');
    return;
  }
  projects = await res.json();
  $addForm.reset();
  renderProjects();
});

// ---------- folder picker modal ----------

const $modal = document.getElementById('browse-modal');
const $fsList = document.getElementById('fs-list');
const $fsPath = document.getElementById('fs-path');
const $fsUp = document.getElementById('fs-up');
const $fsHome = document.getElementById('fs-home');
const $fsSelect = document.getElementById('fs-select');
const $fsHint = document.getElementById('fs-hint');
const $browseBtn = document.getElementById('browse-btn');

let fsCurrent = null; // { path, parent, dirs, home, isProjectLike }

function openBrowse() {
  $modal.hidden = false;
  loadDir($pathInput.value || '~');
}
function closeBrowse() {
  $modal.hidden = true;
}

$browseBtn.addEventListener('click', openBrowse);
$modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeBrowse));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$modal.hidden) closeBrowse(); });

async function loadDir(targetPath) {
  const res = await fetch('/api/fs?path=' + encodeURIComponent(targetPath));
  const data = await res.json();
  if (!res.ok) { $fsHint.textContent = data.error || 'cannot read directory'; $fsHint.className = 'hint'; return; }
  fsCurrent = data;
  $fsPath.value = data.path;
  $fsList.innerHTML = '';
  if (!data.dirs.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-row';
    empty.textContent = '(no subdirectories)';
    $fsList.appendChild(empty);
  }
  for (const d of data.dirs) {
    const li = document.createElement('li');
    const icon = document.createElement('span'); icon.className = 'folder-icon'; icon.textContent = '📁';
    const name = document.createElement('span'); name.textContent = d.name;
    li.appendChild(icon); li.appendChild(name);
    if (d.projectLike) {
      const b = document.createElement('span'); b.className = 'badge'; b.textContent = 'project';
      li.appendChild(b);
    }
    li.addEventListener('click', () => loadDir(data.path.replace(/\/$/, '') + '/' + d.name));
    $fsList.appendChild(li);
  }
  if (data.isProjectLike) {
    $fsHint.textContent = 'This folder looks like a project (has package.json or .git).';
    $fsHint.className = 'hint ok';
  } else {
    $fsHint.textContent = 'No package.json / .git here. You can still pick it.';
    $fsHint.className = 'hint';
  }
}

$fsUp.addEventListener('click', () => { if (fsCurrent?.parent) loadDir(fsCurrent.parent); });
$fsHome.addEventListener('click', () => loadDir('~'));
$fsSelect.addEventListener('click', () => {
  if (fsCurrent?.path) {
    $pathInput.value = fsCurrent.path;
    closeBrowse();
    $pathInput.focus();
  }
});

// ---------- project list ----------

function renderProjects() {
  $projects.innerHTML = '';
  projects.forEach((p, i) => {
    const li = document.createElement('li');
    if (i === currentIdx) li.classList.add('active');
    li.addEventListener('click', () => selectProject(i));

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = p.name;
    name.title = p.path;
    li.appendChild(name);

    const remove = document.createElement('span');
    remove.className = 'remove';
    remove.textContent = '×';
    remove.title = 'remove from the manager list (does not touch the project)';
    remove.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Remove "${p.name}" from the list?\n(Does not touch the project or anything installed in it.)`)) return;
      const res = await fetch(`/api/projects/${i}`, { method: 'DELETE' });
      projects = await res.json();
      if (currentIdx === i) { currentIdx = null; status = null; renderMain(); }
      renderProjects();
    });
    li.appendChild(remove);

    $projects.appendChild(li);
  });
}

async function selectProject(i) {
  currentIdx = i;
  const res = await fetch(`/api/projects/${i}/status`);
  if (!res.ok) { alert('failed to load project status'); return; }
  status = await res.json();
  renderProjects();
  renderMain();
}

// ---------- entry preselection ----------

function preselected(name, installed, detected) {
  return installed.includes(name) || !!detected[name];
}

// ---------- collapsible category rendering ----------

function groupByCategory(entries) {
  const groups = {};
  entries.forEach((e) => { (groups[e.category] ||= []).push(e); });
  return groups;
}

function renderCategories(kind, entries, detected, installed) {
  const wrap = document.createElement('div');
  const groups = groupByCategory(entries);
  for (const cat of Object.keys(groups).sort()) {
    const items = groups[cat];
    const detectedInCat = items.filter((e) => detected[e.name]).length;
    const installedInCat = items.filter((e) => installed.includes(e.name)).length;
    const selectedInCat = items.filter((e) => preselected(e.name, installed, detected)).length;

    const section = document.createElement('div');
    section.className = 'category';
    section.dataset.category = cat;
    section.dataset.open = detectedInCat > 0 || installedInCat > 0 ? 'true' : 'false';

    // Header
    const header = document.createElement('div');
    header.className = 'category-header';
    header.addEventListener('click', () => {
      section.dataset.open = section.dataset.open === 'true' ? 'false' : 'true';
    });
    const chev = document.createElement('span'); chev.className = 'chev'; chev.textContent = '›';
    const title = document.createElement('span'); title.className = 'title'; title.textContent = cat;
    const info = document.createElement('span'); info.className = 'info';
    info.innerHTML = detectedInCat
      ? `<span class="has-detected">${selectedInCat} selected</span> · ${items.length} available`
      : `${selectedInCat} selected · ${items.length} available`;
    header.appendChild(chev); header.appendChild(title); header.appendChild(info);
    section.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'category-body';
    for (const entry of items) {
      const row = document.createElement('div');
      row.className = 'entry';

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.name = `${kind}:${entry.name}`;
      box.id = box.name;
      box.checked = preselected(entry.name, installed, detected);
      row.appendChild(box);

      const label = document.createElement('label');
      label.htmlFor = box.id;

      const nameRow = document.createElement('div');
      const name = document.createElement('span'); name.className = 'name'; name.textContent = entry.name;
      nameRow.appendChild(name);
      if (installed.includes(entry.name)) {
        const b = document.createElement('span'); b.className = 'reason';
        b.style.color = '#1e40af';
        b.textContent = 'installed';
        nameRow.appendChild(b);
      }
      const reasons = detected[entry.name] || [];
      if (reasons.length) {
        const r = document.createElement('span');
        r.className = 'reason';
        r.textContent = `detected: ${reasons.join(', ')}`;
        nameRow.appendChild(r);
      }
      label.appendChild(nameRow);

      if (entry.description) {
        const desc = document.createElement('div'); desc.className = 'desc'; desc.textContent = entry.description;
        label.appendChild(desc);
      }

      row.appendChild(label);
      body.appendChild(row);
    }
    section.appendChild(body);
    wrap.appendChild(section);
  }
  return wrap;
}

// ---------- stack summary ----------

function stackSummary(detected) {
  const parts = [];
  if (detected.skills['neolink-fastify-gateway-generator'] || detected.skills['neolink-gateway-setup']) parts.push('backend (Fastify gateway + tRPC)');
  if (detected.skills['angular-nx-architect']) parts.push('frontend (Angular 21)');
  if (detected.skills['angular-neolink-template']) parts.push('portal (Material 3)');
  if (detected.skills['argocd-k8s-deploy']) parts.push('deploys (k8s/ArgoCD)');
  return parts.length ? parts.join(' · ') : 'no stack detected';
}

// ---------- main view ----------

function renderMain() {
  $main.innerHTML = '';
  if (!status) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Add a project on the left, or select one to configure.';
    $main.appendChild(p);
    return;
  }
  const { project, detected, installed } = status;

  const h2 = document.createElement('h2'); h2.textContent = project.name; $main.appendChild(h2);
  const pathEl = document.createElement('p'); pathEl.className = 'path'; pathEl.textContent = project.path; $main.appendChild(pathEl);
  const writesTo = document.createElement('p'); writesTo.className = 'path';
  writesTo.innerHTML = `writes to: <strong>${project.path}/.claude/</strong>`;
  $main.appendChild(writesTo);
  const stack = document.createElement('p'); stack.className = 'stack';
  stack.innerHTML = `stack: <strong>${stackSummary(detected)}</strong>`;
  $main.appendChild(stack);

  // Keep the last apply status message visible across re-renders so people
  // don't miss it when the view refreshes.
  if (window.__lastApplyStatus) {
    const persisted = document.createElement('div');
    persisted.className = 'status';
    persisted.textContent = window.__lastApplyStatus;
    $main.appendChild(persisted);
  }

  // Skills
  const sSec = document.createElement('div'); sSec.className = 'section';
  const sH = document.createElement('h3'); sH.textContent = 'Skills';
  const sCount = document.createElement('span'); sCount.className = 'count';
  sCount.textContent = `${Object.keys(detected.skills).length} detected / ${catalog.skills.length} available`;
  sH.appendChild(sCount); sSec.appendChild(sH);
  sSec.appendChild(renderCategories('skill', catalog.skills, detected.skills, installed.skills));
  $main.appendChild(sSec);

  // Agents
  const aSec = document.createElement('div'); aSec.className = 'section';
  const aH = document.createElement('h3'); aH.textContent = 'Agents';
  const aCount = document.createElement('span'); aCount.className = 'count';
  aCount.textContent = `${Object.keys(detected.agents).length} detected / ${catalog.agents.length} available`;
  aH.appendChild(aCount); aSec.appendChild(aH);
  aSec.appendChild(renderCategories('agent', catalog.agents, detected.agents, installed.agents));
  $main.appendChild(aSec);

  // Commands (slash commands). Preselected if the detector flags them (e.g.
  // /feature for any project with a detected stack). Otherwise available
  // but unchecked.
  if (catalog.commands && catalog.commands.length) {
    const cSec = document.createElement('div'); cSec.className = 'section';
    const cH = document.createElement('h3'); cH.textContent = 'Slash commands';
    const cCount = document.createElement('span'); cCount.className = 'count';
    const detectedCmds = detected.commands || {};
    cCount.textContent = `${Object.keys(detectedCmds).length} detected / ${catalog.commands.length} available`;
    cH.appendChild(cCount); cSec.appendChild(cH);
    cSec.appendChild(renderCategories('command', catalog.commands, detectedCmds, installed.commands));
    $main.appendChild(cSec);
  }

  // Project settings — toggles are always editable. Apply merges into any
  // existing settings.json, preserving keys the manager doesn't own.
  const setSec = document.createElement('div'); setSec.className = 'section';
  const setH = document.createElement('h3'); setH.textContent = 'Project settings'; setSec.appendChild(setH);

  if (installed.hasSettings) {
    const note = document.createElement('div');
    note.className = 'settings-note';
    note.innerHTML = 'Existing <code>.claude/settings.json</code> detected. Toggles reflect its current state; applying will <strong>merge</strong> changes into it (other keys are preserved). Unchecking a toggle removes that key; if nothing remains, the file is deleted.';
    setSec.appendChild(note);
  }

  const agentTeamsChecked = installed.hasSettings
    ? installed.settings.agentTeams
    : !!detected.settings?.agentTeams;
  const autoMemoryChecked = installed.hasSettings
    ? installed.settings.autoMemory
    : !!detected.settings?.autoMemory;

  setSec.appendChild(renderSettingRow(
    'setting:agentTeams',
    'Enable agent teams (experimental)',
    'Adds env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1". Required to spawn teammates via the lead.',
    agentTeamsChecked,
    false,
    !installed.hasSettings && detected.settings?.agentTeams ? ['no existing settings.json'] : []
  ));
  setSec.appendChild(renderSettingRow(
    'setting:autoMemory',
    'Enable auto memory',
    'Adds autoMemoryEnabled = true. Makes Claude accumulate per-project learnings across sessions (on by default in v2.1.59+; this makes intent explicit).',
    autoMemoryChecked,
    false,
    !installed.hasSettings && detected.settings?.autoMemory ? ['no existing settings.json'] : []
  ));
  $main.appendChild(setSec);

  // Action bar
  const actions = document.createElement('div'); actions.className = 'actions';
  const summary = document.createElement('span'); summary.className = 'summary'; summary.id = 'change-summary';
  actions.appendChild(summary);

  const reset = document.createElement('button'); reset.textContent = 'Reset to suggested';
  reset.className = 'secondary';
  reset.addEventListener('click', () => { renderMain(); });
  actions.appendChild(reset);

  const apply = document.createElement('button'); apply.textContent = 'Apply changes';
  apply.addEventListener('click', applyChanges);
  actions.appendChild(apply);

  $main.appendChild(actions);

  // live summary update
  $main.addEventListener('change', () => updateSummary(summary));
  updateSummary(summary);
}

function renderSettingRow(id, title, description, checked, disabled, reasons) {
  const row = document.createElement('div'); row.className = 'entry';
  const box = document.createElement('input');
  box.type = 'checkbox'; box.id = id; box.name = id;
  box.checked = checked; box.disabled = disabled;
  row.appendChild(box);

  const label = document.createElement('label'); label.htmlFor = id;
  const nameRow = document.createElement('div');
  const name = document.createElement('span'); name.className = 'name'; name.textContent = title;
  nameRow.appendChild(name);
  if (reasons && reasons.length) {
    const r = document.createElement('span'); r.className = 'reason'; r.textContent = `detected: ${reasons.join(', ')}`;
    nameRow.appendChild(r);
  }
  label.appendChild(nameRow);
  const desc = document.createElement('div'); desc.className = 'desc'; desc.textContent = description;
  label.appendChild(desc);
  row.appendChild(label);
  return row;
}

function updateSummary(el) {
  if (!status) return;
  const installedSet = new Set([
    ...status.installed.skills.map((s) => `skill:${s}`),
    ...status.installed.agents.map((a) => `agent:${a}`),
    ...(status.installed.commands || []).map((c) => `command:${c}`),
  ]);
  const desired = new Set();
  document.querySelectorAll('input[name^="skill:"]:checked, input[name^="agent:"]:checked, input[name^="command:"]:checked').forEach((b) => desired.add(b.name));
  let adds = 0, drops = 0;
  desired.forEach((d) => { if (!installedSet.has(d)) adds++; });
  installedSet.forEach((i) => { if (!desired.has(i)) drops++; });

  const settingsChange = !status.installed.hasSettings && (
    document.getElementById('setting:agentTeams')?.checked ||
    document.getElementById('setting:autoMemory')?.checked
  );

  const parts = [];
  if (adds) parts.push(`+${adds}`);
  if (drops) parts.push(`-${drops}`);
  if (settingsChange) parts.push('+ settings.json');
  el.textContent = parts.length ? `pending: ${parts.join(' ')}` : 'no changes';
}

// ---------- apply ----------

async function applyChanges() {
  const skills   = Array.from(document.querySelectorAll('input[name^="skill:"]:checked')).map((b) => b.name.slice('skill:'.length));
  const agents   = Array.from(document.querySelectorAll('input[name^="agent:"]:checked')).map((b) => b.name.slice('agent:'.length));
  const commands = Array.from(document.querySelectorAll('input[name^="command:"]:checked')).map((b) => b.name.slice('command:'.length));
  const agentTeamsBox = document.getElementById('setting:agentTeams');
  const autoMemoryBox = document.getElementById('setting:autoMemory');
  const settings = {
    agentTeams: !!(agentTeamsBox && agentTeamsBox.checked && !agentTeamsBox.disabled),
    autoMemory: !!(autoMemoryBox && autoMemoryBox.checked && !autoMemoryBox.disabled),
  };

  const res = await fetch(`/api/projects/${currentIdx}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skills, agents, commands, settings }),
  });
  const result = await res.json();

  const lines = [];
  lines.push(`applied at ${status.project.path}/.claude/`);
  if (result.installed.length) lines.push(`  installed: ${result.installed.join(', ')}`);
  if (result.removed.length)   lines.push(`  removed:   ${result.removed.join(', ')}`);
  if (result.skipped.length)   lines.push(`  skipped:   ${result.skipped.join(', ')}`);
  if (!result.installed.length && !result.removed.length && !result.skipped.length) lines.push('  (no changes)');
  lines.push('');
  lines.push('Restart Claude Code in the project to pick up changes.');
  window.__lastApplyStatus = lines.join('\n');

  // Re-render from fresh server state; the persisted status survives.
  await selectProject(currentIdx);
}

// ---------- init ----------

async function init() {
  try {
    const [pj, cat] = await Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/catalog').then((r) => r.json()),
    ]);
    projects = pj;
    catalog = cat;
    renderProjects();
  } catch (err) {
    document.body.textContent = `Failed to load: ${err}`;
  }
}

init();
