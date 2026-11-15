console.log('[RTPS Popup] Script loaded');

// ==================== DOM REFS ====================
const profileList = document.getElementById('profileList');
const profileInput = document.getElementById('profileInput');
const btnSaveProfile = document.getElementById('btnSaveProfile');
const btnFill = document.getElementById('btnFill');
const btnDelete = document.getElementById('btnDelete');
const btnExport = document.getElementById('btnExport');
const btnImport = document.getElementById('btnImport');
const fileInput = document.getElementById('fileInput');
const statusDiv = document.getElementById('status');

// ==================== STATE ====================
let profiles = {};
let selectedProfile = null;

// ==================== STATUS ====================
function hideStatus() {
  clearTimeout(statusDiv._timer);
  statusDiv.style.display = 'none';
}

function showStatus(msg, type, duration) {
  statusDiv.textContent = '';

  const text = document.createElement('span');
  text.className = 'status-text';
  text.textContent = msg;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'status-close';
  close.setAttribute('aria-label', 'Dismiss message');
  close.textContent = '×';
  close.addEventListener('click', hideStatus);

  statusDiv.appendChild(text);
  statusDiv.appendChild(close);
  statusDiv.className = 'status ' + (type || 'info');
  statusDiv.style.display = 'flex';

  clearTimeout(statusDiv._timer);
  statusDiv._timer = setTimeout(hideStatus, duration || 4000);
}

// ==================== STORAGE ====================
function loadProfiles() {
  return new Promise(resolve => {
    chrome.storage.local.get(['rtpsProfiles'], result => {
      profiles = result.rtpsProfiles || {};
      console.log('[RTPS] Loaded', Object.keys(profiles).length, 'profiles');
      resolve(profiles);
    });
  });
}

function saveProfiles() {
  return new Promise(resolve => {
    chrome.storage.local.set({ rtpsProfiles: profiles }, () => {
      console.log('[RTPS] Saved', Object.keys(profiles).length, 'profiles');
      resolve();
    });
  });
}

// ==================== RENDER ====================
function renderProfiles() {
  const names = Object.keys(profiles);
  profileList.innerHTML = '';
  
  if (names.length === 0) {
    profileList.innerHTML = `
      <div class="empty">
        <div class="big">📂</div>
        No saved profiles
        <span class="hint">Fill a form and click Save</span>
      </div>
    `;
    return;
  }
  
  names.sort().forEach(name => {
    const data = profiles[name];
    const count = Object.keys(data).filter(k => !k.startsWith('_')).length;
    const type = data._type || 'unknown';
    const emoji = type === 'residence' ? '🏠' : type === 'caste' ? '👥' : type === 'income' ? '💰' : '📋';
    
    const div = document.createElement('div');
    div.className = 'profile-item' + (selectedProfile === name ? ' selected' : '');
    div.dataset.name = name;
    const label = document.createElement('span');
    const pname = document.createElement('span');
    pname.className = 'pname';
    pname.textContent = emoji + ' ' + name;      // textContent: names are never parsed as HTML
    const pcount = document.createElement('span');
    pcount.className = 'pcount';
    pcount.textContent = '(' + count + ')';
    label.appendChild(pname);
    label.appendChild(pcount);
    const selectBtn = document.createElement('button');
    selectBtn.className = 'select-btn';
    selectBtn.textContent = selectedProfile === name ? 'Selected' : 'Select';
    div.appendChild(label);
    div.appendChild(selectBtn);
    
    div.querySelector('.select-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      selectedProfile = name;
      renderProfiles();
      showStatus('Selected: ' + name, 'info');
    });
    
    div.addEventListener('click', () => {
      selectedProfile = name;
      renderProfiles();
      showStatus('Selected: ' + name, 'info');
    });
    
    profileList.appendChild(div);
  });
}

// ==================== GET ACTIVE TAB ====================
function getActiveTab() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      resolve(tabs[0]);
    });
  });
}

// ==================== INJECT CONTENT SCRIPT ====================
// manifest_version is 3, so chrome.scripting is the right API (it needs the
// "scripting" permission, declared in manifest.json). content.js has a
// double-injection guard, so re-injecting is harmless.
async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content.js']
  });
}

// ==================== SEND MESSAGE ====================
function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.log('[RTPS] Error:', chrome.runtime.lastError.message);
        resolve({ error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}

// ==================== SAVE ====================
async function handleSave() {
  console.log('[RTPS] Save button clicked');
  
  let name = profileInput.value.trim();
  if (!name) {
    const now = new Date();
    name = 'Profile ' + now.toLocaleTimeString();
    profileInput.value = name;
  }
  
  console.log('[RTPS] Profile name:', name);
  
  const tab = await getActiveTab();
  console.log('[RTPS] Current tab:', tab ? tab.url : 'No tab');
  
  if (!tab || !tab.url || !tab.url.includes('serviceonline.bihar.gov.in')) {
    showStatus('❌ Please open an RTPS form first', 'error');
    return;
  }
  
  // Try to extract data
  let response = await sendToTab(tab.id, { action: 'extract' });
  console.log('[RTPS] Extract response:', response);
  
  // If failed, inject content script
  if (!response || response.error) {
    console.log('[RTPS] Injecting content script...');
    try {
      await injectContentScript(tab.id);
      await new Promise(r => setTimeout(r, 500));
      response = await sendToTab(tab.id, { action: 'extract' });
      console.log('[RTPS] Retry response:', response);
    } catch (e) {
      console.error('[RTPS] Injection failed:', e);
      showStatus('❌ Failed to load helper: ' + e.message, 'error');
      return;
    }
  }
  
  if (!response || !response.success || !response.data) {
    showStatus('❌ Failed to extract data', 'error');
    return;
  }
  
  const data = response.data;
  const count = data._fields || Object.keys(data).filter(k => !k.startsWith('_')).length;
  console.log('[RTPS] Extracted', count, 'fields');
  
  if (count === 0) {
    showStatus('❌ No data found. Fill some fields first.', 'error');
    return;
  }
  
  // Save profile
  profiles[name] = data;
  await saveProfiles();
  renderProfiles();
  profileInput.value = '';
  selectedProfile = name;
  showStatus(`✅ Saved "${name}" (${count} fields)`, 'success');
}

// ==================== FILL ====================
let filling = false;

// Wrapper: blocks a second Fill while one is already running, and shows progress on the button.
async function handleFill() {
  if (filling) return;
  filling = true;
  btnFill.disabled = true;
  btnFill.textContent = 'Filling…';
  try {
    await runFill();
  } finally {
    filling = false;
    btnFill.disabled = false;
    btnFill.textContent = 'Fill form';
  }
}

async function runFill() {
  console.log('[RTPS] Fill button clicked');
  
  if (!selectedProfile) {
    showStatus('❌ Select a profile first', 'error');
    return;
  }
  
  const data = profiles[selectedProfile];
  if (!data) {
    showStatus('❌ Profile not found', 'error');
    return;
  }
  
  console.log('[RTPS] Filling with profile:', selectedProfile);
  
  const tab = await getActiveTab();
  if (!tab || !tab.url || !tab.url.includes('serviceonline.bihar.gov.in')) {
    showStatus('❌ Please open an RTPS form first', 'error');
    return;
  }
  
  let response = await sendToTab(tab.id, { action: 'fill', data: data });
  console.log('[RTPS] Fill response:', response);
  
  if (!response || response.error) {
    try {
      await injectContentScript(tab.id);
      await new Promise(r => setTimeout(r, 500));
      response = await sendToTab(tab.id, { action: 'fill', data: data });
    } catch (e) {
      showStatus('❌ Failed to load helper', 'error');
      return;
    }
  }
  
  if (response && response.busy) {
    showStatus('⏳ A fill is already running on this page', 'info');
    return;
  }
  
  if (!response || !response.success) {
    showStatus('❌ Failed to fill form', 'error');
    return;
  }
  
  // The dependent Panchayat / Nagar Nigam name dropdown is never auto-filled,
  // so remind the user at the moment they need it, and keep it up longer.
  showStatus(`✅ Filled ${response.filled || 0} fields. Now choose the Panchayat / Nagar Nigam name yourself.`, 'success', 9000);
}

// ==================== DELETE ====================
async function handleDelete() {
  if (!selectedProfile) {
    showStatus('❌ Select a profile to delete', 'error');
    return;
  }
  if (!confirm('Delete "' + selectedProfile + '"?')) return;
  
  delete profiles[selectedProfile];
  await saveProfiles();
  selectedProfile = null;
  renderProfiles();
  showStatus('🗑️ Deleted', 'info');
}

// ==================== EXPORT ====================
async function handleExport() {
  const keys = Object.keys(profiles);
  if (keys.length === 0) {
    showStatus('❌ No profiles to export', 'error');
    return;
  }
  
  const data = { version: '1.0', exported: new Date().toISOString(), profiles: profiles };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rtps-profiles-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showStatus('📤 Exported ' + keys.length + ' profiles', 'success');
}

// ==================== IMPORT ====================
async function handleImport(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.profiles || typeof data.profiles !== 'object') {
      showStatus('❌ Invalid file format', 'error');
      return;
    }
    
    let count = 0;
    for (const [name, profile] of Object.entries(data.profiles)) {
      if (!profiles[name]) {
        profiles[name] = profile;
        count++;
      }
    }
    await saveProfiles();
    renderProfiles();
    showStatus('📥 Imported ' + count + ' profiles', 'success');
  } catch (e) {
    showStatus('❌ Import failed', 'error');
  }
}

// ==================== EVENTS ====================
btnSaveProfile.addEventListener('click', handleSave);
btnFill.addEventListener('click', handleFill);
btnDelete.addEventListener('click', handleDelete);
btnExport.addEventListener('click', handleExport);
btnImport.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleImport(e.target.files[0]);
    e.target.value = '';
  }
});

profileInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleSave();
  }
});

// ==================== INIT ====================
async function init() {
  await loadProfiles();
  renderProfiles();
  console.log('[RTPS] Ready');
  console.log('[RTPS] Profiles loaded:', Object.keys(profiles).length);
  console.log('[RTPS] Selected profile:', selectedProfile);
}

init();