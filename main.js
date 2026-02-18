import './style.css';
import { loginUser, checkAuthState, logoutUser } from './src/auth';
import { getRecentLogs, saveErpRows, getAllErpRows, deleteErpRows, saveVesselSchedules, getAllVesselSchedules, clearVesselSchedulesByPort, batchUpdateErpRows } from './src/db';
import { parseExcel } from './src/excel-processor';

const app = document.querySelector('#app');
let erpData = [];
let vesselScheduleData = [];
let currentView = 'master'; // 'master' or 'vessel'
let sortState = { key: null, direction: 'asc' };
let selectedRows = new Set();
let currentLoggedInUser = null;

const renderLogin = (error = null) => {
  app.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-header">
          <h1>MSC KOREA ERP</h1>
          <p>Welcome back, please login</p>
        </div>
        <form id="login-form">
          <div class="form-group">
            <label for="email">Email Address</label>
            <input type="email" id="email" placeholder="name@company.com" required>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" placeholder="••••••••" required>
          </div>
          <button type="submit" class="btn-login">Sign In</button>
          <div id="error-message" class="error-message">${error || ''}</div>
        </form>
      </div>
    </div>
  `;

  document.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#email').value;
    const password = document.querySelector('#password').value;
    const btn = document.querySelector('.btn-login');
    btn.textContent = 'Signing in...';
    btn.disabled = true;

    const { user, error } = await loginUser(email, password);
    if (error) renderLogin(error);
  });
};

const renderLayout = (user) => {
  currentLoggedInUser = user;
  app.innerHTML = `
    <div class="dashboard-container">
      <aside class="sidebar">
        <div class="sidebar-header">
          <h2>MSC KOREA ERP</h2>
        </div>
        <nav class="nav-menu">
          <div class="nav-item ${currentView === 'master' ? 'active' : ''}" id="nav-master">Master Database</div>
          <div class="nav-item ${currentView === 'vessel' ? 'active' : ''}" id="nav-vessel">Vessel Schedule</div>
          <div class="nav-item ${currentView === 'analysis' ? 'active' : ''}" id="nav-analysis">Analysis</div>
          <div class="nav-item">Gate Logs</div>
        </nav>
        <div class="nav-item" id="logout-btn" style="margin-top: auto;">Logout</div>
      </aside>
      <main class="main-content" id="main-content-area">
        <!-- Dashboard content will be rendered here -->
      </main>
    </div>
  `;

  document.querySelector('#nav-master').addEventListener('click', () => {
    currentView = 'master';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector('#nav-master').classList.add('active');
    renderDashboard();
  });
  document.querySelector('#nav-vessel').addEventListener('click', () => {
    currentView = 'vessel';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector('#nav-vessel').classList.add('active');
    renderVesselSchedule();
  });
  document.querySelector('#nav-analysis').addEventListener('click', () => {
    currentView = 'analysis';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector('#nav-analysis').classList.add('active');
    renderAnalysis();
  });
  document.querySelector('#logout-btn').addEventListener('click', () => logoutUser());

  if (currentView === 'master') {
    document.querySelector('#nav-master').classList.add('active');
    renderDashboard();
  } else if (currentView === 'vessel') {
    document.querySelector('#nav-vessel').classList.add('active');
    renderVesselSchedule();
  } else if (currentView === 'analysis') {
    document.querySelector('#nav-analysis').classList.add('active');
    renderAnalysis();
  }
};

const renderDashboard = () => {
  const mainArea = document.querySelector('#main-content-area');
  mainArea.innerHTML = `
        <header class="content-header-main">
          <div class="header-top-row">
            <h1>Master Database Management</h1>
            <div class="user-info-text">You are log in as ${currentLoggedInUser.email}</div>
          </div>
          <div class="header-controls-row">
            <input type="file" id="excel-upload" style="display:none" accept=".xlsx, .xls">
            <button class="btn-action btn-upload" id="upload-btn">Upload Excel</button>
            <button class="btn-action btn-save" id="save-btn">SAVE to DB</button>
            <button class="btn-action btn-delete" id="delete-btn">DELETE Selected</button>
          </div>
        </header>

        <div class="recap-row" id="recap-stats"></div>
        
        <div id="table-view" class="table-wrapper">
           <p style="padding: 20px; color: var(--text-muted);">Loading data...</p>
        </div>

        <div class="stat-card" style="margin-top: 20px; padding: 10px;">
           <span id="db-status" style="font-size: 0.8rem;">● Checking connection...</span>
        </div>
  `;

  document.querySelector('#upload-btn').addEventListener('click', () => document.getElementById('excel-upload').click());
  document.querySelector('#excel-upload').addEventListener('change', handleExcelUpload);
  document.querySelector('#save-btn').addEventListener('click', handleSaveToDb);
  document.querySelector('#delete-btn').addEventListener('click', handleDeleteSelected);

  fetchData();
  checkDbStatus();
};

const renderVesselSchedule = () => {
  const mainArea = document.querySelector('#main-content-area');
  mainArea.innerHTML = `
        <header class="content-header-main">
          <div class="header-top-row">
            <h1>Vessel Schedule</h1>
            <div class="user-info-text">You are log in as ${currentLoggedInUser.email}</div>
          </div>
          <div class="header-controls-row">
            <button class="btn-action btn-apply" id="apply-mapping-btn">APPLY ETA</button>
            <div class="port-control">
              <button class="btn-action btn-upload" id="btn-busan">BUSAN</button>
              <button class="btn-action btn-delete" style="min-width: 80px; height: 30px; font-size: 0.7rem; margin-top: 8px;" id="clear-busan">CLEAR</button>
            </div>
            <div class="port-control">
              <button class="btn-action btn-upload" id="btn-gwangyang">GWANGYANG</button>
              <button class="btn-action btn-delete" style="min-width: 80px; height: 30px; font-size: 0.7rem; margin-top: 8px;" id="clear-gwangyang">CLEAR</button>
            </div>
            <div class="port-control">
              <button class="btn-action btn-upload" id="btn-incheon">INCHEON</button>
              <button class="btn-action btn-delete" style="min-width: 80px; height: 30px; font-size: 0.7rem; margin-top: 8px;" id="clear-incheon">CLEAR</button>
            </div>
          </div>
        </header>

        <div id="vessel-table-view" class="table-wrapper">
           <p style="padding: 20px; color: var(--text-muted);">Select a port and paste data to view schedule.</p>
        </div>
  `;

  document.querySelector('#btn-busan').addEventListener('click', () => handlePortClick('Busan'));
  document.querySelector('#btn-gwangyang').addEventListener('click', () => handlePortClick('Gwangyang'));
  document.querySelector('#btn-incheon').addEventListener('click', () => handlePortClick('Incheon'));

  document.querySelector('#clear-busan').addEventListener('click', () => handleClearPort('Busan'));
  document.querySelector('#clear-gwangyang').addEventListener('click', () => handleClearPort('Gwangyang'));
  document.querySelector('#clear-incheon').addEventListener('click', () => handleClearPort('Incheon'));
  document.querySelector('#apply-mapping-btn').addEventListener('click', handleApplyMapping);

  fetchVesselSchedules();
};

const fetchVesselSchedules = async () => {
  const { schedules, error } = await getAllVesselSchedules();
  if (!error) {
    vesselScheduleData = schedules;
    renderVesselTable();
  }
};

const handleClearPort = async (port) => {
  if (!confirm(`Clear all ${port} schedules from database?`)) return;
  const { error } = await clearVesselSchedulesByPort(port);
  if (error) {
    alert("Error clearing: " + error);
  } else {
    fetchVesselSchedules();
  }
};

const handlePortClick = async (port) => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      alert("Clipboard is empty.");
      return;
    }
    parseVesselData(port, text);
  } catch (err) {
    alert("Could not access clipboard. Please make sure you have granted permission.");
  }
};

const parseVesselData = async (port, text) => {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return;

  const newSchedules = [];

  // Basic heuristic parser for tab-separated or fixed-style clipboard data
  lines.forEach((line) => {
    const parts = line.split(/\t/);
    if (parts.length >= 5) {
      const vessel = parts[0].trim();
      const arrival = parts[3] ? parts[3].trim() : '';
      const departure = parts[4] ? parts[4].trim() : '';
      const service = parts[5] ? parts[5].trim() : '';

      if (vessel && vessel !== "Vessel") {
        newSchedules.push({
          port,
          vessel,
          eta: formatDate(arrival),
          etd: formatDate(departure),
          service
        });
      }
    }
  });

  if (newSchedules.length > 0) {
    const { error } = await saveVesselSchedules(newSchedules);
    if (error) {
      alert("Error saving schedules: " + error);
    } else {
      fetchVesselSchedules();
    }
  } else {
    alert("No valid vessel data found in clipboard. Please copy the schedule table including headers.");
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  // Expecting format like "17/02/2026 12:00" or similar from the image
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return dateStr;
};

const renderVesselTable = () => {
  const view = document.querySelector('#vessel-table-view');
  if (!view) return;

  if (vesselScheduleData.length === 0) {
    view.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">No schedule data available. Click a port button to paste from clipboard.</p>`;
    return;
  }

  const headers = [
    { label: "Port", key: "port" },
    { label: "Vessel", key: "vessel" },
    { label: "ETA", key: "eta" },
    { label: "ETD", key: "etd" },
    { label: "Service", key: "service" }
  ];

  view.innerHTML = `
        <table>
            <thead>
                <tr>
                    ${headers.map(h => `<th onclick="window.sortVesselTable('${h.key}')" style="cursor:pointer">${h.label}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${vesselScheduleData.map(row => `
                    <tr>
                        <td>${row.port}</td>
                        <td style="color: var(--gold); font-weight: bold;">${row.vessel}</td>
                        <td>${row.eta}</td>
                        <td>${row.etd}</td>
                        <td>${row.service}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
};

window.sortVesselTable = (key) => {
  const direction = (sortState.key === key && sortState.direction === 'asc') ? 'desc' : 'asc';
  sortState = { key, direction };

  vesselScheduleData.sort((a, b) => {
    let vA = (a[key] || '').toString().toLowerCase();
    let vB = (b[key] || '').toString().toLowerCase();
    if (vA < vB) return direction === 'asc' ? -1 : 1;
    if (vA > vB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  renderVesselTable();
};

const fetchData = async () => {
  const { rows, error } = await getAllErpRows();
  if (!error) {
    erpData = rows;
    renderTable();
  }
};

const handleExcelUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const { rows } = await parseExcel(file);
    const today = new Date().toISOString().split('T')[0];
    const newRows = rows.map(row => ({
      ...row,
      uploadDate: today,
      isNew: true
    }));
    erpData = [...erpData, ...newRows];
    renderTable();
  } catch (err) {
    alert("Failed to parse Excel: " + err.message);
  }
};

const handleSaveToDb = async () => {
  const newRows = erpData.filter(r => r.isNew);
  if (newRows.length === 0) {
    alert("No new data to save.");
    return;
  }
  const btn = document.querySelector('#save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  const { error } = await saveErpRows(newRows);
  if (!error) {
    alert("Successfully saved to database.");
    fetchData();
  }
  btn.disabled = false;
  btn.textContent = 'SAVE to DB';
};

const handleDeleteSelected = async () => {
  if (selectedRows.size === 0) return;
  if (!confirm(`Delete ${selectedRows.size} rows?`)) return;
  const idsToDelete = Array.from(selectedRows);
  const firebaseIds = idsToDelete.filter(id => typeof id === 'string');
  if (firebaseIds.length > 0) await deleteErpRows(firebaseIds);
  erpData = erpData.filter(row => !selectedRows.has(row.id));
  selectedRows.clear();
  renderTable();
  if (firebaseIds.length > 0) fetchData();
};

const renderTable = () => {
  const tableView = document.querySelector('#table-view');
  if (!tableView) return;
  if (erpData.length === 0) {
    tableView.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">No data available.</p>`;
    return;
  }

  const excelHeaders = [
    "Client", "Vessel Name", "Supplier", "Shipper", "PO No",
    "Ref No. / Description", "Bonded/DG", "Q'ty", "Pkg", "Weight",
    "Dimension", "ETA", "ATA", "ATD", "Stored", "Location",
    "Remark1", "Gate Out Remark", "CIPL", "MSDS", "ETC"
  ];

  tableView.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th><input type="checkbox" id="select-all"></th>
                    <th onclick="window.sortTable('displayId')">ID</th>
                    ${excelHeaders.map(h => `<th onclick="window.sortTable('${h}')">${h}</th>`).join('')}
                    <th onclick="window.sortTable('uploadDate')">Upload Date</th>
                </tr>
            </thead>
            <tbody>
                ${erpData.map((row, index) => `
                    <tr ondblclick="window.editRow('${row.id}')" style="${row.isNew ? 'border-left: 4px solid var(--primary)' : ''}">
                        <td><input type="checkbox" class="row-checkbox" data-id="${row.id}" ${selectedRows.has(row.id) ? 'checked' : ''}></td>
                        <td>${index + 1}</td>
                        ${excelHeaders.map(h => {
    let val = row[h] || '';
    if (h === 'Stored') return `<td><span class="${val === 'Y' ? 'status-o' : 'status-x'}">${val === 'Y' ? 'O' : 'X'}</span></td>`;
    if (['CIPL', 'MSDS', 'ETC'].includes(h)) return `<td><button class="attachment-btn" onclick="event.stopPropagation()">Attach</button></td>`;

    if (row.isMapped) {
      if (h === 'Vessel Name') {
        return `<td class="vessel-matched">${val}</td>`;
      }
      if (h === 'ETA') {
        const parts = val.split(' ');
        const date = parts[0];
        const ports = parts.slice(1).map(p => `<span class="port-badge">${p}</span>`).join('');
        return `<td class="eta-matched">${date}${ports}</td>`;
      }
    }

    return `<td>${val}</td>`;
  }).join('')}
                        <td>${row.uploadDate || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
  updateRecap();

  document.querySelector('#select-all').addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('.row-checkbox').forEach(cb => {
      cb.checked = checked;
      const id = cb.getAttribute('data-id');
      const finalId = isNaN(id) ? id : Number(id);
      if (checked) selectedRows.add(finalId); else selectedRows.delete(finalId);
    });
  });

  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const finalId = isNaN(id) ? id : Number(id);
      if (e.target.checked) selectedRows.add(finalId); else selectedRows.delete(finalId);
    });
  });
};

const updateRecap = () => {
  const recapContainer = document.querySelector('#recap-stats');
  if (!recapContainer) return;
  const total = erpData.length;
  const loaded = erpData.filter(r => r.Stored === 'Y').length;
  recapContainer.innerHTML = `
        <div class="recap-item"><span class="recap-label">Total DB:</span><span class="recap-value">${total}</span></div>
        <div class="recap-item"><span class="recap-label">To be Loaded:</span><span class="recap-value">${total - loaded}</span></div>
        <div class="recap-item"><span class="recap-label">Loaded:</span><span class="recap-value">${loaded}</span></div>
    `;
};

const checkDbStatus = async () => {
  const dbStatus = document.querySelector('#db-status');
  if (!dbStatus) return;
  try { await getRecentLogs(1); dbStatus.innerHTML = `<span style="color: #4ade80;">● Online</span>`; }
  catch (e) { dbStatus.innerHTML = `<span style="color: #f87171;">● Offline</span>`; }
};

window.sortTable = (key) => {
  const direction = (sortState.key === key && sortState.direction === 'asc') ? 'desc' : 'asc';
  sortState = { key, direction };
  erpData.sort((a, b) => {
    let vA = a[key] || ''; let vB = b[key] || '';
    if (!isNaN(vA) && !isNaN(vB)) { vA = Number(vA); vB = Number(vB); }
    return vA < vB ? (direction === 'asc' ? -1 : 1) : (vA > vB ? (direction === 'asc' ? 1 : -1) : 0);
  });
  renderTable();
};

window.editRow = (id) => {
  const searchId = isNaN(id) ? id : Number(id);
  const row = erpData.find(r => r.id === searchId);
  if (!row) return;
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
        <div class="modal">
            <div class="modal-header"><h2>Edit Row</h2><button onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
            <div class="modal-grid">${Object.keys(row).filter(k => !['id', 'isNew', 'uploadDate'].includes(k)).map(k => `<div class="form-group"><label>${k}</label><input type="text" value="${row[k]}" id="edit-${k}"></div>`).join('')}</div>
            <button class="btn-action btn-save" style="margin-top:20px" onclick="window.saveRow('${id}')">Save Changes</button>
        </div>`;
  document.body.appendChild(modal);
};

window.saveRow = (id) => {
  const searchId = isNaN(id) ? id : Number(id);
  const row = erpData.find(r => r.id === searchId);
  Object.keys(row).filter(k => !['id', 'isNew', 'uploadDate'].includes(k)).forEach(k => {
    const input = document.getElementById(`edit-${k}`);
    if (input) row[k] = input.value;
  });
  document.querySelector('.modal-backdrop').remove();
  renderTable();
};

const handleApplyMapping = async () => {
  if (vesselScheduleData.length === 0) {
    alert("No vessel schedule data available to apply.");
    return;
  }

  // Helper to normalize vessel names for better comparison (removes all non-alphanumeric and uppercase)
  const normalize = (name) => (name || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

  // Group by vessel
  const vesselMap = {};
  vesselScheduleData.forEach(s => {
    const normalizedVName = normalize(s.vessel);
    if (!normalizedVName) return;

    if (!vesselMap[normalizedVName]) {
      vesselMap[normalizedVName] = {
        dates: [],
        ports: new Set(),
        originalName: s.vessel
      };
    }
    if (s.eta && s.eta !== "-") {
      vesselMap[normalizedVName].dates.push(s.eta);
    }
    vesselMap[normalizedVName].ports.add(s.port);
  });

  const updates = [];
  let matchCount = 0;

  erpData.forEach(row => {
    const rawVNameInDb = (row["Vessel Name"] || "").toString();
    const normalizedVNameInDb = normalize(rawVNameInDb);
    if (!normalizedVNameInDb) return;

    // Try exact normalized match first
    let matchInfo = vesselMap[normalizedVNameInDb];

    // Fallback: Check if DB name is contained in Schedule name or vice-versa
    if (!matchInfo) {
      const matchedKey = Object.keys(vesselMap).find(key =>
        key.includes(normalizedVNameInDb) || normalizedVNameInDb.includes(key)
      );
      if (matchedKey) matchInfo = vesselMap[matchedKey];
    }

    if (matchInfo && matchInfo.dates.length > 0) {
      const earliestEta = matchInfo.dates.sort()[0];
      const portSuffix = Array.from(matchInfo.ports)
        .map(p => p[0].toUpperCase()) // B, G, I
        .sort().join(' ');

      const newEta = `${earliestEta} ${portSuffix}`;

      // Only add to updates if it's actually different or not yet mapped
      if (row.ETA !== newEta || !row.isMapped) {
        row.ETA = newEta;
        row.isMapped = true;

        // Prepare update for Firestore if it has an ID
        if (row.id) {
          updates.push({
            id: row.id,
            ETA: row.ETA,
            isMapped: true
          });
        }
        matchCount++;
      }
    }
  });

  if (matchCount > 0) {
    if (updates.length > 0) {
      const { error } = await batchUpdateErpRows(updates);
      if (error) {
        alert("Error persisting updates: " + error);
      }
    }
    alert(`Successfully mapped ${matchCount} vessels to the Master Database.`);
    // Switch to master view to see results
    currentView = 'master';
    renderLayout(currentLoggedInUser);
  } else {
    alert("No matching vessels found in Master Database. Please check if the vessel names are similar.");
  }
};

const renderAnalysis = () => {
  const mainArea = document.querySelector('#main-content-area');
  mainArea.innerHTML = `
    <div class="analysis-container">
      <header class="content-header-main" style="margin-bottom:0; padding: 20px 0;">
        <div class="header-top-row">
          <h1>Analysis & Timeline</h1>
          <div class="user-info-text">You are log in as ${currentLoggedInUser.email}</div>
        </div>
        <div class="header-controls-row">
           <div class="analysis-filter-group" style="display:flex; gap:16px; align-items:center;">
             <label style="color:var(--text-muted); font-size:0.8rem">Supplier:</label>
             <input type="text" class="analysis-input" id="filter-supplier" placeholder="Search Supplier...">
             <label style="color:var(--text-muted); font-size:0.8rem">Shipper:</label>
             <input type="text" class="analysis-input" id="filter-shipper" placeholder="Search Shipper...">
           </div>
           <div class="recap-row" id="analysis-recap" style="margin-bottom:0">
             <!-- Stats populated here -->
           </div>
        </div>
      </header>
      
      <div class="analysis-results" id="analysis-results-grid">
        <!-- Timeline cards populated here -->
      </div>

      <div class="analysis-list-section">
        <h2 style="color: var(--gold); margin-bottom: 20px; font-size: 1.1rem;">Calendar Schedule</h2>
        <div id="analysis-calendar-list">
          <!-- List items populated here -->
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div class="analysis-list-section" style="margin-top:0">
          <h2 style="color: var(--gold); margin-bottom: 20px; font-size: 1.1rem;">Supplier Recap (Alphabetical)</h2>
          <div id="analysis-supplier-list">
            <!-- List items populated here -->
          </div>
        </div>
        <div class="analysis-list-section" style="margin-top:0">
          <h2 style="color: var(--gold); margin-bottom: 20px; font-size: 1.1rem;">Shipper Recap (Alphabetical)</h2>
          <div id="analysis-shipper-list">
            <!-- List items populated here -->
          </div>
        </div>
      </div>
    </div>
  `;

  const supplierInput = document.querySelector('#filter-supplier');
  const shipperInput = document.querySelector('#filter-shipper');

  const updateAnalysis = () => {
    const sTerm = supplierInput.value.toUpperCase();
    const shTerm = shipperInput.value.toUpperCase();

    const filtered = erpData.filter(r => {
      const sMatch = !sTerm || (r.Supplier || "").toString().toUpperCase().includes(sTerm);
      const shMatch = !shTerm || (r.Shipper || "").toString().toUpperCase().includes(shTerm);
      return sMatch && shMatch;
    });

    const recap = document.querySelector('#analysis-recap');
    recap.innerHTML = `
      <div class="recap-item"><span class="recap-label">Matched:</span><span class="recap-value">${filtered.length}</span></div>
    `;

    renderTimeline(filtered);
  };

  supplierInput.addEventListener('input', updateAnalysis);
  shipperInput.addEventListener('input', updateAnalysis);

  updateAnalysis();
};

const renderTimeline = (data) => {
  const grid = document.querySelector('#analysis-results-grid');
  const list = document.querySelector('#analysis-calendar-list');
  const supplierList = document.querySelector('#analysis-supplier-list');
  const shipperList = document.querySelector('#analysis-shipper-list');
  if (!grid || !list) return;

  const timelineGroups = {};
  const supplierGroups = {};
  const shipperGroups = {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get local YYYY-MM-DD
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  data.forEach(row => {
    // Vessel Timeline
    const vName = row["Vessel Name"] || "Unknown";
    const rawEta = (row.ETA || "").split(' ')[0];
    const vesselKey = `${vName}|${rawEta}`;

    if (!timelineGroups[vesselKey]) {
      timelineGroups[vesselKey] = { vessel: vName, eta: rawEta, count: 0, rows: [] };
    }
    timelineGroups[vesselKey].count++;
    timelineGroups[vesselKey].rows.push(row);

    // Supplier Recap
    const sup = row.Supplier || "N/A";
    if (!supplierGroups[sup]) {
      supplierGroups[sup] = { name: sup, count: 0, rows: [] };
    }
    supplierGroups[sup].count++;
    supplierGroups[sup].rows.push(row);

    // Shipper Recap
    const shp = row.Shipper || "N/A";
    if (!shipperGroups[shp]) {
      shipperGroups[shp] = { name: shp, count: 0, rows: [] };
    }
    shipperGroups[shp].count++;
    shipperGroups[shp].rows.push(row);
  });

  // 1. Render Grid (Proximity Sorted)
  const gridSorted = Object.values(timelineGroups).sort((a, b) => {
    const dateA = new Date(a.eta);
    const dateB = new Date(b.eta);
    if (isNaN(dateA)) return 1;
    if (isNaN(dateB)) return -1;
    dateA.setHours(0, 0, 0, 0);
    dateB.setHours(0, 0, 0, 0);
    const diffA = Math.abs(dateA - today);
    const diffB = Math.abs(dateB - today);
    if (diffA !== diffB) return diffA - diffB;
    return dateB - dateA;
  });

  grid.innerHTML = gridSorted.map(group => {
    const isToday = group.eta === todayStr;
    return `
      <div class="vessel-card ${isToday ? 'highlight-today' : ''}" onclick="window.showAnalysisDetails('${group.vessel}', '${group.eta}')">
        <div style="margin-bottom: 8px;">
          <span class="recap-value" style="font-size: 1.2rem; float:right;">${group.count}</span>
          <h3 style="margin:0; color:var(--gold)">${group.vessel}</h3>
        </div>
        <div style="color:var(--text-muted); font-size: 0.85rem;">ETA: ${group.eta || 'N/A'}</div>
      </div>
    `;
  }).join('');

  // 2. Render Calendar List (Chronological)
  const listSorted = Object.values(timelineGroups).sort((a, b) => {
    const dA = new Date(a.eta);
    const dB = new Date(b.eta);
    if (isNaN(dA)) return 1;
    if (isNaN(dB)) return -1;
    return dA - dB;
  });

  list.innerHTML = listSorted.map(group => {
    const isToday = group.eta === todayStr;
    return `
      <div class="analysis-list-item ${isToday ? 'highlight-today' : ''}" onclick="window.showAnalysisDetails('${group.vessel}', '${group.eta}')">
        <span class="list-date">${group.eta || 'NO DATE'}</span>
        <span class="list-vessel">${group.vessel}</span>
        <span class="list-count">${group.count} DB</span>
      </div>
    `;
  }).join('');

  // 3. Render Supplier List (Alphabetical)
  if (supplierList) {
    const supSorted = Object.values(supplierGroups).sort((a, b) => a.name.localeCompare(b.name));
    supplierList.innerHTML = supSorted.map(g => `
      <div class="analysis-list-item" onclick="window.showGroupDetails('Supplier', '${g.name}')">
        <span class="list-vessel" style="margin-left:0">${g.name}</span>
        <span class="list-count">${g.count} DB</span>
      </div>
    `).join('');
  }

  // 4. Render Shipper List (Alphabetical)
  if (shipperList) {
    const shpSorted = Object.values(shipperGroups).sort((a, b) => a.name.localeCompare(b.name));
    shipperList.innerHTML = shpSorted.map(g => `
      <div class="analysis-list-item" onclick="window.showGroupDetails('Shipper', '${g.name}')">
        <span class="list-vessel" style="margin-left:0">${g.name}</span>
        <span class="list-count">${g.count} DB</span>
      </div>
    `).join('');
  }

  window.lastAnalysisGroups = timelineGroups;
  window.lastSupplierGroups = supplierGroups;
  window.lastShipperGroups = shipperGroups;
};

window.showGroupDetails = (type, name) => {
  const group = type === 'Supplier' ? window.lastSupplierGroups[name] : window.lastShipperGroups[name];
  if (!group) return;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
      <div class="modal" style="max-width: 950px; width: 95%;">
          <div class="modal-header">
              <h2>${type}: ${name} (${group.count} items)</h2>
              <button onclick="this.closest('.modal-backdrop').remove()">✕</button>
          </div>
          <div class="table-wrapper" style="max-height: 500px; overflow-y: auto;">
              <table>
                  <thead style="position: sticky; top: 0; background: var(--header-bg); z-index: 1;">
                      <tr>
                          <th>Vessel</th>
                          <th>ETA</th>
                          <th>PO No</th>
                          <th>Client</th>
                          <th>Supplier</th>
                          <th>Shipper</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${group.rows.map(r => `
                          <tr>
                              <td>${r["Vessel Name"] || '-'}</td>
                              <td>${r.ETA || '-'}</td>
                              <td>${r["PO No"] || '-'}</td>
                              <td>${r.Client || '-'}</td>
                              <td>${r.Supplier || '-'}</td>
                              <td>${r.Shipper || '-'}</td>
                          </tr>
                      `).join('')}
                  </tbody>
              </table>
          </div>
      </div>
    `;
  document.body.appendChild(modal);
};

window.showAnalysisDetails = (vessel, eta) => {
  const key = `${vessel}|${eta}`;
  const group = window.lastAnalysisGroups[key];
  if (!group) return;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal" style="max-width: 900px; width: 95%;">
        <div class="modal-header">
            <h2>${vessel} (ETA: ${eta})</h2>
            <button onclick="this.closest('.modal-backdrop').remove()">✕</button>
        </div>
        <div class="table-wrapper" style="max-height: 400px; overflow-y: auto;">
            <table>
                <thead style="position: sticky; top: 0; background: var(--header-bg); z-index: 1;">
                    <tr>
                        <th>Client</th>
                        <th>Supplier</th>
                        <th>Shipper</th>
                        <th>PO No</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${group.rows.map(r => `
                        <tr>
                            <td>${r.Client || '-'}</td>
                            <td>${r.Supplier || '-'}</td>
                            <td>${r.Shipper || '-'}</td>
                            <td>${r["PO No"] || '-'}</td>
                            <td><span class="${r.Stored === 'Y' ? 'status-o' : 'status-x'}">${r.Stored === 'Y' ? 'O' : 'X'}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
  `;
  document.body.appendChild(modal);
};

checkAuthState((user) => {
  if (user) renderLayout(user);
  else renderLogin();
});
