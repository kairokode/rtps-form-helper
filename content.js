// ============================================================
//  BIHAR RTPS FORM HELPER - Universal Content Script (FIXED v7)
//  Fixed: double-injection guard, operator-precedence bug, dead hierarchy entry
// ============================================================

if (window.__RTPS_HELPER_LOADED__) {
  console.log('[RTPS] Content script already injected on this page - skipping re-injection');
} else {
  window.__RTPS_HELPER_LOADED__ = true;

console.log('[RTPS] Universal Content Script loaded v6');

// ==================== CONFIGURATION ====================
const CONFIG = {
  SKIP_IDS: ['74559', 'captchaImage', 'captchaAnswer'],
  HIERARCHY_DELAY: 2000,
  HARD_ID_RETRY_DELAY: 1500,
  MAX_RETRIES: 3,
  
  DYNAMIC_DROPDOWN_WAIT: {
    maxDelay: 10000,        // Max 10 seconds
    retryInterval: 300,     // Check every 300ms
  },
  
  HARD_IDS: {
    '4630012': ['63928'],
    '4650013': ['63930', '56891'],
    '4640012': ['64058', '56895']
  },
  
  // Dynamic dropdown IDs with their radio values
  DYNAMIC_DROPDOWN_MAP: {
    '75291': { radioValue: '2', label: 'Municipal Corporation', hindiLabel: 'नगर निगम' },
    '75292': { radioValue: '3', label: 'Municipality', hindiLabel: 'नगर परिषद' },
    '75293': { radioValue: '4', label: 'Town Panchayat', hindiLabel: 'नगर पंचायत' },
    '56886': { radioValue: '1', label: 'Village Panchayat', hindiLabel: 'ग्राम पंचायत' }
  },
  
  IGNORE_VALUES: ['select', 'please select', '--select--', '-- select --', 'please_select', 'select--', '--', '---']
};

// ==================== DETECT FORM TYPE ====================
function detectFormType() {
  const url = window.location.href;
  const body = document.body ? document.body.innerText : '';
  
  const match = url.match(/serviceId=(\d+)/);
  if (match) {
    const id = match[1];
    if (id === '4630012') return 'residence';
    if (id === '4650013') return 'caste';
    if (id === '4640012') return 'income';
  }
  
  if (body.includes('निवास') || body.includes('Residence Certificate')) return 'residence';
  if (body.includes('जाति') || body.includes('Caste Certificate')) return 'caste';
  if (body.includes('आय') || body.includes('Income Certificate')) return 'income';
  
  return 'unknown';
}

function getServiceId() {
  const url = window.location.href;
  const match = url.match(/serviceId=(\d+)/);
  return match ? match[1] : null;
}

// ==================== FIELD HELPERS ====================

function getFieldLabel(el) {
  if (!el) return '';
  
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return cleanText(label.textContent);
  }
  
  const parent = el.closest('.form-group, .row, td, .col-md-6, .col-sm-6, .col-md-4, .tdata, .trow');
  if (parent) {
    const label = parent.querySelector('label, .lbl, .control-label, .field-label');
    if (label) return cleanText(label.textContent);
  }
  
  if (el.placeholder) return cleanText(el.placeholder);
  
  const prev = el.previousElementSibling;
  if (prev && prev.tagName === 'LABEL') return cleanText(prev.textContent);
  
  return '';
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/[*:\s\n\t]+/g, ' ').trim();
}

function isIgnoreValue(val) {
  if (!val) return true;
  const v = String(val).toLowerCase().replace(/[\s_\-]+/g, '');
  return CONFIG.IGNORE_VALUES.some(ignore => 
    v === ignore.toLowerCase().replace(/[\s_\-]+/g, '')
  );
}

function matchLabel(label, keywords) {
  if (!label) return false;
  // Strip both whitespace AND underscores before comparing. findValue()
  // converts a saved formData key's underscores to spaces before calling
  // this (e.g. 'local_body_type' -> 'local body type'), but keyword arrays
  // are often written WITH underscores (e.g. ['local_body_type'],
  // ['i_agree']). Stripping only \s+ left the keyword's underscores intact
  // while the label's had already become (then removed) spaces, so
  // 'localbodytype' was never seen as including 'local_body_type' and the
  // match silently always failed.
  const low = label.toLowerCase().replace(/[\s_]+/g, '');
  return keywords.some(k => low.includes(k.toLowerCase().replace(/[\s_]+/g, '')));
}

// ==================== FIND VISIBLE ELEMENT ====================
function findVisibleElement(keywords, excludeKeywords, elementType) {
  const all = document.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="file"]):not([type="submit"]), select, textarea');
  
  for (const el of all) {
    if (el.disabled || el.offsetParent === null) continue;
    if (CONFIG.SKIP_IDS.includes(el.id)) continue;
    
    const label = getFieldLabel(el);
    if (!matchLabel(label, keywords)) continue;
    if (excludeKeywords && matchLabel(label, excludeKeywords)) continue;
    
    if (elementType === 'select' && el.tagName !== 'SELECT') continue;
    if (elementType === 'radio' && el.type !== 'radio') continue;
    if (elementType === 'checkbox' && el.type !== 'checkbox') continue;
    if (elementType === 'text' && (el.tagName === 'SELECT' || el.type === 'radio' || el.type === 'checkbox')) continue;
    
    return el;
  }
  return null;
}

// ==================== GET SELECTED VALUE ====================
function getSelectedValue(el) {
  if (!el || el.tagName !== 'SELECT') return null;
  const selected = el.options[el.selectedIndex];
  if (selected && selected.text && !isIgnoreValue(selected.text) && selected.text !== 'Please Select') {
    return selected.text.trim();
  }
  return null;
}

// ==================== TRIGGER EVENTS ====================
function triggerEvents(el) {
  if (!el) return;
  
  el.focus();
  el.dispatchEvent(new Event('focus', { bubbles: true }));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  // Many legacy ASP.NET/jQuery government-portal forms (this one included)
  // bind cascading-dropdown AJAX calls to onclick rather than onchange for
  // radio buttons. Setting .checked = true and firing 'change' makes the
  // radio look selected but never triggers that AJAX call, so the dependent
  // dropdown (e.g. the नगर निगम/corporation-name select) never populates.
  // A synthetic, non-trusted 'click' on an already-checked radio is safe:
  // radios don't toggle off on a second click, so this can't undo the
  // selection - it can only additionally fire click-bound handlers.
  if (el.type === 'radio') {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  el.dispatchEvent(new Event('blur', { bubbles: true }));
  
  if (el.onchange) {
    try { el.onchange(); } catch(e) {}
  }
  
  if (typeof jQuery !== 'undefined') {
    try { jQuery(el).trigger('change'); } catch(e) {}
  }
}

// ==================== SET FIELD VALUE ====================
function setFieldValue(el, value) {
  if (!el) return false;
  if (isIgnoreValue(value)) return false;
  
  const sv = String(value).trim();
  
  try {
    if (el.tagName === 'SELECT') {
      const options = Array.from(el.options);
      let matched = options.find(opt => 
        opt.value === sv ||
        opt.text.trim() === sv ||
        opt.text.trim().toLowerCase() === sv.toLowerCase() ||
        opt.text.trim().toLowerCase().includes(sv.toLowerCase())
      );
      if (matched) {
        el.value = matched.value;
        triggerEvents(el);
        return true;
      }
      return false;
    }
    
    if (el.type === 'radio') {
      const radios = document.querySelectorAll(`input[type="radio"][name="${el.name}"]`);
      for (const radio of radios) {
        const label = getFieldLabel(radio);
        if (radio.value === sv || label.toLowerCase() === sv.toLowerCase() || 
            label.toLowerCase().includes(sv.toLowerCase()) || sv.toLowerCase().includes(label.toLowerCase())) {
          radio.checked = true;
          triggerEvents(radio);
          return true;
        }
      }
      return false;
    }
    
    if (el.type === 'checkbox') {
      if (sv === 'yes' || sv === 'Y' || sv === '1' || sv === 'true' || sv === 'on') {
        el.checked = true;
        triggerEvents(el);
        return true;
      }
      return false;
    }
    
    el.value = sv;
    triggerEvents(el);
    return true;
  } catch(e) {
    return false;
  }
}

// ==================== EXTRACT FORM DATA ====================
function extractFormData() {
  console.log('[RTPS] Extracting form data...');
  
  const formData = {};
  const seen = {};
  
  const fields = document.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="file"]):not([type="submit"]), select, textarea');
  
  let count = 0;
  
  for (const el of fields) {
    if (el.disabled || el.offsetParent === null) continue;
    if (CONFIG.SKIP_IDS.includes(el.id)) continue;
    if (/captcha|otp/i.test(el.id || '') || /captcha|otp/i.test(el.name || '')) continue;
    
    const label = getFieldLabel(el);
    let key = label.replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '_').replace(/_+/g, '_').toLowerCase();
    if (!key) key = (el.id || el.name || 'field').toLowerCase();
    
    let finalKey = key;
    let counter = 1;
    while (seen[finalKey]) {
      finalKey = key + '_' + counter++;
    }
    seen[finalKey] = true;
    
    let value = '';
    
    if (el.tagName === 'SELECT') {
      const selected = el.options[el.selectedIndex];
      if (selected && selected.text && !isIgnoreValue(selected.text) && selected.text !== 'Please Select') {
        value = selected.text.trim();
        if (el.id) {
          formData[el.id + '_value'] = el.value;
          formData[el.id + '_text'] = value;
        }
      }
    } 
    else if (el.type === 'radio') {
      if (el.checked) {
        const radioLabel = getFieldLabel(el);
        value = radioLabel || el.value || 'on';
        if (el.name) {
          formData[el.name + '_radio'] = value;
          count++;
        }
      }
    } 
    else if (el.type === 'checkbox') {
      if (el.checked) {
        value = el.value || 'yes';
      }
    } 
    else {
      if (!isIgnoreValue(el.value)) {
        value = el.value.trim();
      }
    }
    
    // Only store under the generic label-derived key for text/select/checkbox
    // fields. Radios are deliberately excluded here: getFieldLabel() returns
    // a radio's own OPTION text (e.g. "ग्राम पंचायत / Village Panchayat"),
    // so a checked radio would get key === value === that option's own text.
    // That text contains generic words like "ग्राम"/"village", so unrelated
    // lookups (e.g. the separate free-text "ग्राम (Village) / मोहल्ला (Town)"
    // field's own keyword search) would match this bogus entry and pull the
    // radio's label text into the wrong field instead of the real value.
    // Local Body Type and Gender already have dedicated, correctly-keyed
    // extraction below, and every radio still gets a safe `name + '_radio'`
    // fallback a few lines up.
    if (value && value !== '' && el.type !== 'radio') {
      formData[finalKey] = value;
      count++;
    }
  }
  
  // Dynamic dropdowns
  for (const [id, info] of Object.entries(CONFIG.DYNAMIC_DROPDOWN_MAP)) {
    const el = document.getElementById(id);
    if (el) {
      const val = getSelectedValue(el);
      if (val) {
        const key = info.label.toLowerCase().replace(/\s+/g, '_');
        formData[key] = val;
        formData[id + '_text'] = val;
        count++;
        console.log(`[RTPS] ✅ Found ${info.label}:`, val);
      }
    }
  }
  
  // Gender
  const genderRadios = document.querySelectorAll('input[type="radio"][name*="gender"], input[type="radio"][name*="17290"]');
  for (const radio of genderRadios) {
    if (radio.checked) {
      const label = getFieldLabel(radio);
      if (label) {
        formData['gender'] = label;
        formData['gender_value'] = radio.value;
        break;
      }
    }
  }
  
  // Local Body Type
  const localBodyRadios = document.querySelectorAll('input[type="radio"][name="75290"]');
  for (const radio of localBodyRadios) {
    if (radio.checked) {
      const label = getFieldLabel(radio);
      if (label) {
        formData['local_body_type'] = label;
        formData['local_body_value'] = radio.value;
        console.log('[RTPS] Local Body Type:', label, 'Value:', radio.value);
        break;
      }
    }
  }
  
  // Hindi Names
  const hindiNameMappings = [
    { selector: 'input[id*="17287"], input[name*="17287"], input[placeholder*="आवेदक"]', key: 'applicant_name_hindi' },
    { selector: 'input[id*="17288"], input[name*="17288"], input[placeholder*="पिता"]', key: 'father_name_hindi' },
    { selector: 'input[id*="41567"], input[name*="41567"], input[placeholder*="माता"]', key: 'mother_name_hindi' },
    { selector: 'input[id*="64877"], input[name*="64877"], input[placeholder*="पति"]', key: 'husband_name_hindi' }
  ];
  
  for (const mapping of hindiNameMappings) {
    const el = document.querySelector(mapping.selector);
    if (el && el.value && !isIgnoreValue(el.value)) {
      formData[mapping.key] = el.value.trim();
    }
  }
  
  // Category, Caste, Sub-Caste
  const specialSelects = [
    { selector: 'select[id*="category"], select[name*="category"], select[id*="वर्ग"]', key: 'category' },
    { selector: 'select[id*="caste"], select[name*="caste"], select[id*="जाति"]', key: 'caste' },
    { selector: 'select[id*="sub_caste"], select[name*="sub_caste"], select[id*="उपजाति"]', key: 'sub_caste' }
  ];
  
  for (const ss of specialSelects) {
    const el = document.querySelector(ss.selector);
    if (el) {
      const val = getSelectedValue(el);
      if (val) {
        formData[ss.key] = val;
      }
    }
  }
  
  const formType = detectFormType();
  formData._type = formType;
  formData._serviceId = getServiceId();
  formData._url = window.location.href;
  formData._fields = count;
  
  console.log(`[RTPS] Extracted ${count} fields from ${formType} form`);
  return formData;
}

// ==================== FIND VALUE ====================
function findValue(formData, keywords, excludeKeywords) {
  for (const [key, value] of Object.entries(formData)) {
    if (!value || isIgnoreValue(value)) continue;
    if (matchLabel(key.replace(/_/g, ' '), keywords)) {
      if (excludeKeywords && matchLabel(key.replace(/_/g, ' '), excludeKeywords)) continue;
      return value;
    }
  }
  return null;
}

// ==================== DELAY ====================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== FILL FORM DATA ====================
async function fillFormData(formData) {
  console.log('[RTPS] Filling form...');
  console.log('[RTPS] Form data keys:', Object.keys(formData));
  
  let filled = 0;
  const serviceId = getServiceId();
  const hardIds = CONFIG.HARD_IDS[serviceId] || [];
  
  console.log('[RTPS] Service ID:', serviceId);
  
  // ====== PHASE 0: CHECKBOXES ======
  if (setFieldValue(findVisibleElement(['i agree', 'agree', 'i_agree']), findValue(formData, ['i agree', 'agree', 'i_agree']) || 'yes')) filled++;
  if (setFieldValue(findVisibleElement(['same as above', 'जैसा']), findValue(formData, ['same as above', 'जैसा']) || 'yes')) filled++;
  await delay(300);
  
  // ====== PHASE 1: HIERARCHY ======
  // NOTE: no 'village' entry here — at this point in Phase 1 the local-body
  // radio (75290) hasn't been selected yet, so every candidate village/
  // municipality select (56886, 75291, 75292, 75293) is still hidden and
  // could never match. That dropdown is filled correctly later in Phase 3.
  const hierarchy = [
    { key: 'state', keywords: ['राज्य', 'state'], exclude: ['वर्तमान', 'present'] },
    { key: 'district', keywords: ['जिला', 'district'], exclude: ['वर्तमान', 'present'] },
    { key: 'subdivision', keywords: ['अनुमंडल', 'sub-division', 'subdivision'], exclude: ['वर्तमान', 'present'] },
    { key: 'block', keywords: ['प्रखंड', 'block'], exclude: ['वर्तमान', 'present'] }
  ];
  
  for (const h of hierarchy) {
    const value = findValue(formData, h.keywords, h.exclude);
    if (value) {
      const el = findVisibleElement(h.keywords, h.exclude, 'select');
      if (el && setFieldValue(el, value)) {
        filled++;
        console.log(`[RTPS] ✅ Filled ${h.key}: ${value}`);
        await delay(CONFIG.HIERARCHY_DELAY);
      }
    }
  }
  
  // ====== PHASE 2: LOCAL BODY TYPE RADIO ======
  // First, check what value we have
  const localBodyValue = findValue(formData, ['local_body_type']);
  console.log('[RTPS] Local Body Value from data:', localBodyValue);
  
  if (localBodyValue) {
    // Try to find and select the radio
    const radioName = '75290';
    const radios = document.querySelectorAll(`input[type="radio"][name="${radioName}"]`);
    
    let radioFound = false;
    for (const radio of radios) {
      const label = getFieldLabel(radio);
      console.log('[RTPS] Radio label:', label, 'Value:', radio.value);
      
      if (label && matchLabel(label, [localBodyValue])) {
        radio.checked = true;
        triggerEvents(radio);
        radioFound = true;
        filled++;
        console.log(`[RTPS] ✅ Filled Local Body: ${localBodyValue}`);
        
        // Wait for AJAX to load dynamic dropdown
        console.log('[RTPS] Waiting for AJAX to load dynamic dropdown...');
        await delay(2000);
        break;
      }
    }
    
    if (!radioFound) {
      // Try to match by value directly
      for (const radio of radios) {
        const label = getFieldLabel(radio);
        if (label && (label.includes('Municipal Corporation') || label.includes('नगर निगम'))) {
          if (localBodyValue.includes('Corporation') || localBodyValue.includes('निगम')) {
            radio.checked = true;
            triggerEvents(radio);
            filled++;
            console.log(`[RTPS] ✅ Filled Local Body (by match): ${localBodyValue}`);
            await delay(2000);
            break;
          }
        }
        if (label && (label.includes('Municipality') || label.includes('नगर परिषद'))) {
          if (localBodyValue.includes('Municipality') || localBodyValue.includes('परिषद')) {
            radio.checked = true;
            triggerEvents(radio);
            filled++;
            console.log(`[RTPS] ✅ Filled Local Body (by match): ${localBodyValue}`);
            await delay(2000);
            break;
          }
        }
        if (label && (label.includes('Town Panchayat') || label.includes('नगर पंचायत'))) {
          if (localBodyValue.includes('Town') || localBodyValue.includes('पंचायत')) {
            radio.checked = true;
            triggerEvents(radio);
            filled++;
            console.log(`[RTPS] ✅ Filled Local Body (by match): ${localBodyValue}`);
            await delay(2000);
            break;
          }
        }
        if (label && (label.includes('Village Panchayat') || label.includes('ग्राम पंचायत'))) {
          if (localBodyValue.includes('Village') || localBodyValue.includes('ग्राम')) {
            radio.checked = true;
            triggerEvents(radio);
            filled++;
            console.log(`[RTPS] ✅ Filled Local Body (by match): ${localBodyValue}`);
            await delay(2000);
            break;
          }
        }
      }
    }
  }
  
  // ====== PHASE 3: DYNAMIC DROPDOWNS ======
  // Intentionally skipped. The Local Body Type radio (Phase 2, above) is
  // still selected automatically and reliably triggers the page's own AJAX
  // call. But the dependent name dropdown it populates (Village Panchayat /
  // Municipal Corporation / Municipality / Town Panchayat) loads on the
  // page's own timing over a real network request, which proved too
  // unpredictable to auto-fill safely here. Left for a single manual
  // dropdown selection after Fill runs, rather than risk a race.
  const selectedRadio = document.querySelector('input[type="radio"][name="75290"]:checked');
  if (selectedRadio) {
    console.log('[RTPS] Local Body Type radio selected:', getFieldLabel(selectedRadio), '- please choose the specific name from the dropdown below it manually.');
  } else {
    console.log('[RTPS] No Local Body Type radio selected - skipping dependent dropdown.');
  }
  
  // ====== PHASE 4: NAME FIELDS ======
  const nameFields = [
    { key: 'applicant name', keywords: ['applicant name', 'name of applicant'] },
    { key: 'applicant_name_hindi', keywords: ['आवेदक', 'आवेदिका'] },
    { key: 'father name', keywords: ['father name', 'name of father'] },
    { key: 'father_name_hindi', keywords: ['पिता'] },
    { key: 'mother name', keywords: ['mother name', 'name of mother'] },
    { key: 'mother_name_hindi', keywords: ['माता'] },
    { key: 'husband name', keywords: ['husband name', 'name of husband'] },
    { key: 'husband_name_hindi', keywords: ['पति'] }
  ];
  
  for (const field of nameFields) {
    const value = findValue(formData, field.keywords);
    if (value) {
      const el = findVisibleElement(field.keywords, [], 'text');
      if (el && setFieldValue(el, value)) {
        filled++;
      }
    }
  }
  
  // ====== PHASE 5: OTHER FIELDS ======
  const fieldList = [
    { keywords: ['salutation', 'अभिवादन'], type: 'select' },
    { keywords: ['mobile', 'मोबाइल', 'phone'], type: 'text' },
    { keywords: ['email', 'ईमेल'], type: 'text' },
    { keywords: ['ward', 'वार्ड', 'ward no', 'ward_number'], type: 'text' },
    { keywords: ['village', 'ग्राम', 'town', 'मोहल्ला'], type: 'text' },
    { keywords: ['post office', 'डाक', 'postoffice'], type: 'text' },
    { keywords: ['police station', 'थाना'], type: 'select' },
    { keywords: ['pin code', 'पिन कोड', 'pincode'], type: 'text' },
    { keywords: ['profession', 'पेशा'], type: 'select' },
    { keywords: ['purpose', 'उद्देश्य'], type: 'text' },
    { keywords: ['annual income', 'आय', 'income', 'total income'], type: 'text' },
    { keywords: ['income source', 'आय स्रोत'], type: 'select' },
    { keywords: ['category', 'वर्ग'], type: 'select' },
    { keywords: ['caste', 'जाति'], type: 'select' },
    { keywords: ['sub_caste', 'sub-caste', 'उपजाति'], type: 'select' }
  ];
  
  await delay(300);
  
  for (const field of fieldList) {
    const value = findValue(formData, field.keywords);
    if (value) {
      const el = findVisibleElement(field.keywords, [], field.type);
      if (el && setFieldValue(el, value)) {
        filled++;
      }
    }
  }
  
  // ====== PHASE 6: GENDER ======
  const genderValue = findValue(formData, ['gender', 'लिंग', 'male', 'female', 'पुरुष', 'स्त्री', 'third', 'तृतीय']);
  if (genderValue) {
    const genderKeywords = [
      ['पुरुष', 'male'],
      ['स्त्री', 'female'],
      ['तृतीय', 'third', 'third gender']
    ];
    for (const keywords of genderKeywords) {
      if (matchLabel(genderValue, keywords)) {
        const el = findVisibleElement(keywords, [], 'radio');
        if (el && setFieldValue(el, genderValue)) {
          filled++;
        }
        break;
      }
    }
  }
  
  // ====== PHASE 7: OTHER RADIOS ======
  const radioGroups = [
    { keywords: ['स्थायी', 'permanent'], value: findValue(formData, ['स्थायी', 'permanent', 'अस्थायी', 'temporary']) },
    { keywords: ['अस्थायी', 'temporary'], value: findValue(formData, ['स्थायी', 'permanent', 'अस्थायी', 'temporary']) },
    { keywords: ['सामान्य', 'general'], value: findValue(formData, ['सामान्य', 'general', 'tatkal', 'तत्काल']) },
    { keywords: ['तत्काल', 'tatkal'], value: findValue(formData, ['सामान्य', 'general', 'tatkal', 'तत्काल']) }
  ];
  
  for (const radio of radioGroups) {
    if (radio.value) {
      const el = findVisibleElement(radio.keywords, [], 'radio');
      if (el && setFieldValue(el, radio.value)) {
        filled++;
      }
    }
  }
  
  // ====== PHASE 8: HARD IDS ======
  console.log('[RTPS] Re-filling hard IDs:', hardIds);
  for (const id of hardIds) {
    const el = document.getElementById(id);
    if (el) {
      const label = getFieldLabel(el);
      const value = findValue(formData, [label]);
      if (value && setFieldValue(el, value)) {
        filled++;
      }
    }
  }
  
  console.log(`[RTPS] Total filled: ${filled} fields`);
  return { filled };
}

// ==================== MESSAGE HANDLER ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[RTPS] Received:', request.action);
  
  if (request.action === 'ping') {
    sendResponse({ status: 'ok', formType: detectFormType() });
    return true;
  }
  
  if (request.action === 'extract') {
    const data = extractFormData();
    sendResponse({ success: true, data });
    return true;
  }
  
  if (request.action === 'fill') {
    // Ignore a second Fill while one is still running (e.g. popup closed and
    // reopened mid-fill) so two runs never overlap and re-click the same radios.
    if (window.__RTPS_FILLING__) {
      console.log('[RTPS] Fill already in progress - ignoring duplicate request');
      sendResponse({ success: false, busy: true });
      return true;
    }
    window.__RTPS_FILLING__ = true;
    fillFormData(request.data).then(result => {
      sendResponse({ success: true, ...result });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    }).finally(() => {
      window.__RTPS_FILLING__ = false;
    });
    return true;
  }
  
  return true;
});

console.log('[RTPS] ✅ Ready');
console.log('[RTPS] Service ID:', getServiceId());
console.log('[RTPS] Form type:', detectFormType());
}
