/* =============================================
   Prescription OCR Pipeline — Frontend Logic
   Interactive bounding box editor + pipeline
   ============================================= */

// ── State ──
const state = {
  currentStep: 0,       // 0=upload, 1=segment, 2=detect, 3=finalize
  filename: null,
  imageB64: null,
  imageWidth: 0,
  imageHeight: 0,
  boxes: [],             // { label, box_2d: [ymin,xmin,ymax,xmax], id }
  predictions: [],
  cropImages: [],
  finalResult: null,
  selectedBox: null,     // index of selected box
  isDragging: false,
  dragType: null,        // 'move', 'resize-tl', 'resize-tr', 'resize-bl', 'resize-br'
  dragStart: { x: 0, y: 0 },
  dragBoxStart: null,
  isAutoMode: false,
};

let nextBoxId = 0;
const HANDLE_SIZE = 8;

// ── DOM Refs ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Initialization ──
document.addEventListener('DOMContentLoaded', () => {
  setupUploadZone();
  setupCanvasEvents();
  updatePipelineUI();
});


// ==============================
//  Upload Zone
// ==============================
function setupUploadZone() {
  const zone = $('#upload-zone');
  const fileInput = $('#file-input');
  const cameraInput = $('#camera-input');

  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  cameraInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file', 'error');
    return;
  }

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = $('#upload-preview');
    preview.style.display = 'block';
    preview.querySelector('img').src = e.target.result;
    preview.querySelector('.file-info').textContent =
      `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  };
  reader.readAsDataURL(file);

  // Enable buttons
  $('#btn-segment').disabled = false;
  $('#btn-full-auto').disabled = false;
  $('#btn-segment').dataset.file = file.name;

  // Store the file for upload
  state._pendingFile = file;

  addLog('info', `Image selected: ${file.name}`);
}


// ==============================
//  API Calls
// ==============================
async function segmentImage(auto = false) {
  if (!state._pendingFile) {
    showToast('No image selected', 'error');
    return;
  }

  state.isAutoMode = auto;
  showLoading('Processing image...', auto ? 'Auto-running pipeline (Segment → Detect → Finalize)' : 'OpenCV is locating medicine names');
  addLog('info', 'Starting image segmentation (OpenCV)...');

  const form = new FormData();
  form.append('file', state._pendingFile);

  try {
    const resp = await fetch('/api/segment', { method: 'POST', body: form });
    const data = await resp.json();

    if (!data.success) throw new Error(data.error || 'Segmentation failed');

    state.filename = data.filename;
    state.imageB64 = data.image_b64;
    state.imageWidth = data.image_width;
    state.imageHeight = data.image_height;

    // Map detections to box objects
    state.boxes = (data.detections || []).map((d) => ({
      label: d.label || 'unknown',
      box_2d: [...d.box_2d],
      id: nextBoxId++,
    }));

    addLog('success', `Segmentation complete. Found ${state.boxes.length} region(s)`);

    state.currentStep = 1;
    updatePipelineUI();
    
    if (auto) {
      addLog('info', 'Auto-mode: Proceeding to ResNet detection...');
      await detectNames(true);
    } else {
      showSection('editor');
      drawCanvas();
      hideLoading();
      showToast(`Found ${state.boxes.length} medicine region(s)`, 'success');
    }
  } catch (err) {
    hideLoading();
    addLog('error', `Segmentation failed: ${err.message}`);
    showToast(err.message, 'error');
    state.isAutoMode = false;
  }
}

async function detectNames(auto = false) {
  if (!state.filename || state.boxes.length === 0) {
    showToast('No regions to detect', 'error');
    return;
  }

  if (!auto) {
    showLoading('Running ResNet-18 inference...', 'Preprocessing crops and predicting names');
  }
  
  addLog('info', `Sending ${state.boxes.length} box(es) for ResNet detection...`);

  try {
    const resp = await fetch('/api/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: state.filename,
        boxes: state.boxes.map((b) => ({
          label: b.label,
          box_2d: b.box_2d,
        })),
      }),
    });
    const data = await resp.json();

    if (!data.success) throw new Error(data.error || 'Detection failed');

    state.predictions = data.predictions || [];
    state.cropImages = data.crop_images || [];

    state.predictions.forEach((p) => {
      addLog('success', `  ResNet: "${p.resnet_prediction}" (${(p.confidence * 100).toFixed(1)}%)`);
    });

    state.currentStep = 2;
    updatePipelineUI();
    
    if (auto) {
      addLog('info', 'Auto-mode: Finalizing with Gemini (Step 4)...');
      // Tiny pause to ensure UI updates and avoid race conditions
      await new Promise(r => setTimeout(r, 1000));
      await finalizeReading(true);
    } else {
      showSection('predictions');
      showPredictions();
      hideLoading();
      showToast(`Detected ${state.predictions.length} medicine name(s)`, 'success');
    }
  } catch (err) {
    hideLoading();
    addLog('error', `Detection failed: ${err.message}`);
    showToast(err.message, 'error');
    state.isAutoMode = false;
  }
}

async function finalizeReading(auto = false) {
  if (!auto) {
    showLoading('Reading full prescription...', 'Gemini is verifying names and dosage');
  }
  
  addLog('info', 'Finalizing prescription with Gemini...');

  const detectedNames = state.predictions.map((p) => p.resnet_prediction);

  try {
    const resp = await fetch('/api/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: state.filename,
        detected_names: detectedNames,
      }),
    });
    const data = await resp.json();

    if (!data.success) throw new Error(data.error || 'Finalization failed');

    state.finalResult = data.prescription_data;
    state.currentStep = 3;
    updatePipelineUI();
    
    showSection('results');
    showFinalResults();
    hideLoading();
    state.isAutoMode = false;
    showToast('Process complete!', 'success');
  } catch (err) {
    hideLoading();
    addLog('error', `Finalization failed: ${err.message}`);
    showToast(err.message, 'error');
    state.isAutoMode = false;
  }
}

async function processFullAuto() {
  await segmentImage(true);
}

function moveStep(step) {
  state.currentStep = step;
  updatePipelineUI();
  
  if (step === 0) showSection('upload');
  if (step === 1) { showSection('editor'); drawCanvas(); }
  if (step === 2) { showSection('predictions'); showPredictions(); }
  if (step === 3) { showSection('results'); showFinalResults(); }
  
  addLog('info', `Moved back to Step ${step + 1}`);
}

function showSection(name) {
  const sections = ['upload-section', 'editor-section', 'predictions-section', 'results-section'];
  sections.forEach(s => {
    const el = $('#' + s);
    if (s.startsWith(name)) {
      el.style.display = 'block';
      el.classList.remove('section-hidden');
    } else {
      el.style.display = 'none';
      el.classList.add('section-hidden');
    }
  });
}

async function sendToBackend() {
  syncEdits(); // Ensure we have the latest manual corrections
  if (!state.finalResult) return;

  showLoading('Sending to POS backend...', 'Posting prescription data');
  addLog('info', 'Forwarding to Node.js backend...');

  try {
    const resp = await fetch('/api/send-to-backend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: state.finalResult }),
    });
    const data = await resp.json();

    if (!data.success) throw new Error(data.response?.message || 'Backend rejected request');

    addLog('success', `Backend response: ${JSON.stringify(data.response)}`);
    hideLoading();
    showToast('Prescription sent to POS system ✓', 'success');
  } catch (err) {
    hideLoading();
    addLog('error', `Backend send failed: ${err.message}`);
    showToast(err.message, 'error');
  }
}


// ==============================
//  Canvas / Box Editor
// ==============================
function showEditor() {
  showSection('editor');
  drawCanvas();
  updateBoxCount();
}

function drawCanvas() {
  const canvas = $('#editor-canvas');
  const ctx = canvas.getContext('2d');
  const img = new window.Image();

  img.onload = () => {
    // Scale canvas to fit container while maintaining aspect ratio
    const container = canvas.parentElement;
    const maxW = container.clientWidth;
    const scale = maxW / img.width;

    canvas.width = img.width;
    canvas.height = img.height;
    canvas.style.width = maxW + 'px';
    canvas.style.height = (img.height * scale) + 'px';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Draw boxes
    state.boxes.forEach((box, i) => {
      const [ymin, xmin, ymax, xmax] = box.box_2d;
      const x = (xmin / 1000) * canvas.width;
      const y = (ymin / 1000) * canvas.height;
      const w = ((xmax - xmin) / 1000) * canvas.width;
      const h = ((ymax - ymin) / 1000) * canvas.height;

      const isSelected = state.selectedBox === i;
      const color = isSelected ? '#818cf8' : '#fb7185';

      // Filled semi-transparent
      ctx.fillStyle = isSelected ? 'rgba(129,140,248,0.12)' : 'rgba(251,113,133,0.08)';
      ctx.fillRect(x, y, w, h);

      // Border
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(x, y, w, h);

      // Label
      ctx.font = 'bold 14px Inter, sans-serif';
      const labelText = `${i + 1}. ${box.label}`;
      const metrics = ctx.measureText(labelText);
      const labelH = 20;
      ctx.fillStyle = color;
      ctx.fillRect(x, y - labelH - 2, metrics.width + 10, labelH);
      ctx.fillStyle = '#fff';
      ctx.fillText(labelText, x + 5, y - 5);

      // Resize handles (if selected)
      if (isSelected) {
        const handles = [
          [x, y], [x + w, y], [x, y + h], [x + w, y + h]
        ];
        handles.forEach(([hx, hy]) => {
          ctx.fillStyle = '#818cf8';
          ctx.fillRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.strokeRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        });
      }
    });
  };

  img.src = 'data:image/jpeg;base64,' + state.imageB64;
}

function setupCanvasEvents() {
  const canvas = $('#editor-canvas');

  canvas.addEventListener('mousedown', (e) => canvasPointerDown(e, false));
  canvas.addEventListener('mousemove', (e) => canvasPointerMove(e, false));
  canvas.addEventListener('mouseup', () => canvasPointerUp());

  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); canvasPointerDown(e, true); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); canvasPointerMove(e, true); }, { passive: false });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); canvasPointerUp(); }, { passive: false });
}

function getCanvasCoords(e, isTouch) {
  const canvas = $('#editor-canvas');
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  let clientX, clientY;
  if (isTouch) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function canvasPointerDown(e, isTouch) {
  const { x, y } = getCanvasCoords(e, isTouch);
  const canvas = $('#editor-canvas');

  // Check if clicking on a resize handle of the selected box
  if (state.selectedBox !== null) {
    const box = state.boxes[state.selectedBox];
    const [ymin, xmin, ymax, xmax] = box.box_2d;
    const bx1 = (xmin / 1000) * canvas.width;
    const by1 = (ymin / 1000) * canvas.height;
    const bx2 = (xmax / 1000) * canvas.width;
    const by2 = (ymax / 1000) * canvas.height;

    const handles = [
      { x: bx1, y: by1, type: 'resize-tl' },
      { x: bx2, y: by1, type: 'resize-tr' },
      { x: bx1, y: by2, type: 'resize-bl' },
      { x: bx2, y: by2, type: 'resize-br' },
    ];

    for (const h of handles) {
      if (Math.abs(x - h.x) < HANDLE_SIZE * 2 && Math.abs(y - h.y) < HANDLE_SIZE * 2) {
        state.isDragging = true;
        state.dragType = h.type;
        state.dragStart = { x, y };
        state.dragBoxStart = [...box.box_2d];
        return;
      }
    }
  }

  // Check if clicking inside a box
  for (let i = state.boxes.length - 1; i >= 0; i--) {
    const [ymin, xmin, ymax, xmax] = state.boxes[i].box_2d;
    const bx1 = (xmin / 1000) * canvas.width;
    const by1 = (ymin / 1000) * canvas.height;
    const bx2 = (xmax / 1000) * canvas.width;
    const by2 = (ymax / 1000) * canvas.height;

    if (x >= bx1 && x <= bx2 && y >= by1 && y <= by2) {
      state.selectedBox = i;
      state.isDragging = true;
      state.dragType = 'move';
      state.dragStart = { x, y };
      state.dragBoxStart = [...state.boxes[i].box_2d];
      drawCanvas();
      return;
    }
  }

  // Clicked outside all boxes
  state.selectedBox = null;
  drawCanvas();
}

function canvasPointerMove(e, isTouch) {
  if (!state.isDragging || state.selectedBox === null) return;

  const { x, y } = getCanvasCoords(e, isTouch);
  const canvas = $('#editor-canvas');
  const dx = x - state.dragStart.x;
  const dy = y - state.dragStart.y;

  const box = state.boxes[state.selectedBox];
  const [origYmin, origXmin, origYmax, origXmax] = state.dragBoxStart;

  // Convert pixel delta to 0-1000 coords
  const dx1000 = (dx / canvas.width) * 1000;
  const dy1000 = (dy / canvas.height) * 1000;

  if (state.dragType === 'move') {
    box.box_2d = [
      Math.max(0, Math.min(1000, origYmin + dy1000)),
      Math.max(0, Math.min(1000, origXmin + dx1000)),
      Math.max(0, Math.min(1000, origYmax + dy1000)),
      Math.max(0, Math.min(1000, origXmax + dx1000)),
    ];
  } else if (state.dragType === 'resize-tl') {
    box.box_2d[0] = Math.max(0, Math.min(origYmax - 10, origYmin + dy1000));
    box.box_2d[1] = Math.max(0, Math.min(origXmax - 10, origXmin + dx1000));
  } else if (state.dragType === 'resize-tr') {
    box.box_2d[0] = Math.max(0, Math.min(origYmax - 10, origYmin + dy1000));
    box.box_2d[3] = Math.max(origXmin + 10, Math.min(1000, origXmax + dx1000));
  } else if (state.dragType === 'resize-bl') {
    box.box_2d[2] = Math.max(origYmin + 10, Math.min(1000, origYmax + dy1000));
    box.box_2d[1] = Math.max(0, Math.min(origXmax - 10, origXmin + dx1000));
  } else if (state.dragType === 'resize-br') {
    box.box_2d[2] = Math.max(origYmin + 10, Math.min(1000, origYmax + dy1000));
    box.box_2d[3] = Math.max(origXmin + 10, Math.min(1000, origXmax + dx1000));
  }

  // Round values
  box.box_2d = box.box_2d.map((v) => Math.round(v));

  drawCanvas();
}

function canvasPointerUp() {
  state.isDragging = false;
  state.dragType = null;
}

function addBox() {
  state.boxes.push({
    label: 'new_region',
    box_2d: [400, 300, 600, 700],
    id: nextBoxId++,
  });
  state.selectedBox = state.boxes.length - 1;
  updateBoxCount();
  drawCanvas();
  addLog('info', 'Added new selection box — drag/resize to position it');
}

function deleteSelectedBox() {
  if (state.selectedBox === null) {
    showToast('Select a box first', 'info');
    return;
  }
  const label = state.boxes[state.selectedBox].label;
  state.boxes.splice(state.selectedBox, 1);
  state.selectedBox = null;
  updateBoxCount();
  drawCanvas();
  addLog('warn', `Deleted box "${label}"`);
}

function updateBoxCount() {
  const el = $('#box-count');
  if (el) el.textContent = `${state.boxes.length} region(s)`;
}


// ==============================
//  Predictions Display
// ==============================
function showPredictions() {
  showSection('predictions');

  const grid = $('#predictions-grid');
  grid.innerHTML = '';

  state.predictions.forEach((pred, i) => {
    const cropData = state.cropImages.find((c) => c.index === pred.index) || {};
    const confPercent = (pred.confidence * 100).toFixed(1);
    const confClass = pred.confidence > 0.8 ? 'high' : pred.confidence > 0.5 ? 'mid' : 'low';

    const card = document.createElement('div');
    card.className = 'prediction-card';
    card.innerHTML = `
      <div class="pred-header">
        <div class="pred-index">${i + 1}</div>
        <div class="pred-title">${pred.resnet_prediction}</div>
      </div>
      <div class="pred-meta">
        <div class="meta-row">
          <span class="label">Gemini Label</span>
          <span class="value">${pred.gemini_label}</span>
        </div>
        <div class="meta-row">
          <span class="label">ResNet Prediction</span>
          <span class="value" style="color: var(--accent-indigo)">${pred.resnet_prediction}</span>
        </div>
        <div class="meta-row">
          <span class="label">Confidence</span>
          <span class="value">${confPercent}%</span>
        </div>
        <div class="confidence-bar">
          <div class="fill confidence-${confClass}" style="width: ${confPercent}%"></div>
        </div>
      </div>
      ${cropData.original_crop_b64 ? `
        <div class="crop-previews">
          <img src="data:image/jpeg;base64,${cropData.original_crop_b64}" alt="Original crop" title="Original crop">
          <img src="data:image/jpeg;base64,${cropData.preprocessed_b64}" alt="Preprocessed" title="Preprocessed for ResNet">
        </div>
      ` : ''}
    `;
    grid.appendChild(card);
  });
}


// ==============================
//  Final Results
// ==============================
function showFinalResults() {
  showSection('results');

  // Show JSON preview
  const jsonPre = $('#json-preview');
  jsonPre.textContent = JSON.stringify(state.finalResult, null, 2);

  // Build table
  const tbody = $('#results-tbody');
  tbody.innerHTML = '';

  const lines = state.finalResult?.extracted_lines || [];
  lines.forEach((line, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td contenteditable="true" class="editable-cell" oninput="syncEdits()">${line.medicine_name_raw || ''}</td>
      <td contenteditable="true" class="editable-cell" oninput="syncEdits()">${line.frequency || ''}</td>
      <td contenteditable="true" class="editable-cell" oninput="syncEdits()">${line.total_amount ?? '0'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function syncEdits() {
  const tbody = $('#results-tbody');
  const rows = tbody.querySelectorAll('tr');
  const extracted_lines = [];

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    extracted_lines.push({
      medicine_name_raw: cells[1].innerText.trim(),
      frequency: cells[2].innerText.trim(),
      total_amount: parseInt(cells[3].innerText.trim()) || 0
    });
  });

  state.finalResult.extracted_lines = extracted_lines;
  $('#json-preview').textContent = JSON.stringify(state.finalResult, null, 2);
}


// ==============================
//  Pipeline UI Updates
// ==============================
function updatePipelineUI() {
  const steps = $$('.step-item');
  const connectors = $$('.step-connector');

  steps.forEach((el, i) => {
    el.classList.remove('active', 'completed');
    if (i < state.currentStep) el.classList.add('completed');
    if (i === state.currentStep) el.classList.add('active');
  });

  connectors.forEach((el, i) => {
    el.classList.toggle('active', i < state.currentStep);
  });
}

function resetPipeline() {
  state.currentStep = 0;
  state.filename = null;
  state.imageB64 = null;
  state.boxes = [];
  state.predictions = [];
  state.cropImages = [];
  state.finalResult = null;
  state.selectedBox = null;
  state._pendingFile = null;

  // Reset UI
  $('#upload-section').classList.remove('section-hidden');
  $('#editor-section').style.display = 'none';
  $('#predictions-section').style.display = 'none';
  $('#results-section').style.display = 'none';
  $('#upload-preview').style.display = 'none';
  $('#btn-segment').disabled = true;
  $('#btn-full-auto').disabled = true;
  $('#file-input').value = '';
  $('#camera-input').value = '';

  updatePipelineUI();
  addLog('info', '— Pipeline reset —');
}


// ==============================
//  Loading Overlay
// ==============================
function showLoading(text, subtext) {
  const overlay = $('#loading-overlay');
  overlay.querySelector('.loading-text').textContent = text || 'Processing...';
  overlay.querySelector('.loading-subtext').textContent = subtext || '';
  overlay.classList.add('visible');
}

function hideLoading() {
  $('#loading-overlay').classList.remove('visible');
}


// ==============================
//  Toast Notifications
// ==============================
function showToast(message, type = 'info') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}


// ==============================
//  Debug Log
// ==============================
function addLog(type, message) {
  const panel = $('#debug-panel');
  panel.style.display = 'block';

  const now = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <span class="timestamp">${now}</span>
    <span class="log-type ${type}">${type.toUpperCase()}</span>
    <span>${escapeHtml(message)}</span>
  `;
  panel.appendChild(entry);
  panel.scrollTop = panel.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function toggleDebug() {
  const panel = $('#debug-panel');
  if (panel.style.maxHeight === '0px') {
    panel.style.maxHeight = '300px';
    panel.style.padding = '16px';
  } else {
    panel.style.maxHeight = '0px';
    panel.style.padding = '0 16px';
  }
}
