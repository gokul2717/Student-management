/* ================================================================
   STUDENT MANAGEMENT SYSTEM — JAVASCRIPT (API version)
   Talks to Flask backend at http://localhost:5000/api
   ================================================================ */

(function () {
  'use strict';

  // ================================================================
  // API CONFIG
  // ================================================================
  const API_URL = 'http://localhost/student-management/backend/api';

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  // ================================================================
  // STATE
  // ================================================================
  let students = [];
  let editingId = null;
  let pendingDeleteId = null;
  let searchQuery = '';
  let classFilter = '';

  // ================================================================
  // DOM REFERENCES
  // ================================================================
  const studentListEl = document.getElementById('studentList');
  const searchInput = document.getElementById('searchInput');
  const classFilterSelect = document.getElementById('classFilter');
  const addBtn = document.getElementById('addBtn');

  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalTitle = document.getElementById('modalTitle');
  const modalClose = document.getElementById('modalClose');
  const cancelBtn = document.getElementById('cancelBtn');
  const studentForm = document.getElementById('studentForm');

  const confirmBackdrop = document.getElementById('confirmBackdrop');
  const confirmMessage = document.getElementById('confirmMessage');
  const confirmCancel = document.getElementById('confirmCancel');
  const confirmDelete = document.getElementById('confirmDelete');

  const fName = document.getElementById('name');
  const fRollNumber = document.getElementById('rollNumber');
  const fClass = document.getElementById('class');
  const fSection = document.getElementById('section');
  const fBloodGroup = document.getElementById('bloodGroup');
  const fDob = document.getElementById('dob');
  const fParentName = document.getElementById('parentName');
  const fParentMobile = document.getElementById('parentMobile');
  const fAddress = document.getElementById('address');

  // ================================================================
  // HELPERS
  // ================================================================
  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2)
      .map(w => w[0] ? w[0].toUpperCase() : '').join('') || '?';
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  // ================================================================
  // LOAD FROM SERVER
  // ================================================================
  async function loadStudents() {
    try {
      students = await apiRequest('/students.php');
      render();
    } catch (err) {
      console.error('Load failed:', err);
      studentListEl.innerHTML = `
        <div class="empty-state">
          <span class="emoji">⚠️</span>
          <h3>Could not connect to server</h3>
          <p>${escapeHtml(err.message)}. Is the Flask backend running on port 5000?</p>
        </div>
      `;
    }
  }

  // ================================================================
  // CLASS FILTER DROPDOWN
  // ================================================================
  function refreshClassFilterOptions() {
    const classes = [...new Set(students.map(s => s.class))]
      .filter(Boolean)
      .sort((a, b) => Number(a) - Number(b));

    const current = classFilterSelect.value;
    classFilterSelect.innerHTML = '<option value="">All Classes</option>' +
      classes.map(c => `<option value="${escapeHtml(c)}">Class ${escapeHtml(c)}</option>`).join('');

    if (classes.includes(current)) classFilterSelect.value = current;
  }

  // ================================================================
  // FILTER
  // ================================================================
  function getFilteredStudents() {
    const q = searchQuery.trim().toLowerCase();
    return students.filter(s => {
      if (classFilter && String(s.class) !== String(classFilter)) return false;
      if (!q) return true;
      const haystack = [
        s.name, s.rollNumber, s.parentName, s.parentMobile,
        s.section, s.class, s.bloodGroup
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  // ================================================================
  // RENDER
  // ================================================================
  function render() {
    refreshClassFilterOptions();
    const filtered = getFilteredStudents();

    if (filtered.length === 0) {
      const hasStudents = students.length > 0;
      studentListEl.innerHTML = `
        <div class="empty-state">
          <span class="emoji">${hasStudents ? '🔍' : '📚'}</span>
          <h3>${hasStudents ? 'No matching students' : 'No students yet'}</h3>
          <p>${hasStudents
          ? 'Try a different search or clear the filters.'
          : 'Click "Add Student" to enroll your first student.'}</p>
        </div>
      `;
      return;
    }

    const groups = {};
    filtered.forEach(s => {
      const key = String(s.class || 'Unassigned');
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const na = Number(a), nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    let html = '';
    sortedKeys.forEach(classKey => {
      const list = groups[classKey];
      list.sort((a, b) => {
        const ra = parseInt(a.rollNumber, 10);
        const rb = parseInt(b.rollNumber, 10);
        if (!isNaN(ra) && !isNaN(rb)) return ra - rb;
        return String(a.rollNumber).localeCompare(String(b.rollNumber));
      });

      html += `
        <section class="class-group">
          <div class="class-header">
            <h3>Class ${escapeHtml(classKey)}</h3>
            <span class="class-count">${list.length} student${list.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="student-grid">
            ${list.map(renderCard).join('')}
          </div>
        </section>
      `;
    });

    studentListEl.innerHTML = html;

    studentListEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(Number(btn.dataset.id)));
    });
    studentListEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => openDeleteConfirm(Number(btn.dataset.id)));
    });
  }

  function renderCard(s) {
    return `
      <article class="student-card">
        <div class="card-top">
          <div class="avatar">${escapeHtml(initials(s.name))}</div>
          <div class="card-name-block">
            <div class="card-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</div>
            <div class="card-meta">Class ${escapeHtml(s.class)} · Section ${escapeHtml(s.section)}</div>
          </div>
          <span class="roll-badge">#${escapeHtml(s.rollNumber)}</span>
        </div>

        <div class="card-details">
          <div class="detail-item">
            <span class="detail-label">Blood</span>
            <span class="detail-value">
              ${s.bloodGroup ? `<span class="blood-tag">${escapeHtml(s.bloodGroup)}</span>` : '—'}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">DOB</span>
            <span class="detail-value">${escapeHtml(formatDate(s.dob))}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Parent</span>
            <span class="detail-value">${escapeHtml(s.parentName || '—')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Mobile</span>
            <span class="detail-value">${escapeHtml(s.parentMobile || '—')}</span>
          </div>
          <div class="detail-item full">
            <span class="detail-label">Address</span>
            <span class="detail-value">${escapeHtml(s.address || '—')}</span>
          </div>
        </div>

        <div class="card-actions">
          <button class="action-btn edit"   data-action="edit"   data-id="${s.id}">✎ Edit</button>
          <button class="action-btn delete" data-action="delete" data-id="${s.id}">🗑 Delete</button>
        </div>
      </article>
    `;
  }

  // ================================================================
  // MODAL
  // ================================================================
  function openAddModal() {
    editingId = null;
    modalTitle.textContent = 'Add New Student';
    studentForm.reset();
    clearErrors();
    modalBackdrop.classList.add('open');
    setTimeout(() => fName.focus(), 100);
  }

  function openEditModal(id) {
    const student = students.find(s => s.id === id);
    if (!student) return;

    editingId = id;
    modalTitle.textContent = 'Edit Student';

    fName.value = student.name || '';
    fRollNumber.value = student.rollNumber || '';
    fClass.value = student.class || '';
    fSection.value = student.section || '';
    fBloodGroup.value = student.bloodGroup || '';
    fDob.value = student.dob || '';
    fParentName.value = student.parentName || '';
    fParentMobile.value = student.parentMobile || '';
    fAddress.value = student.address || '';

    clearErrors();
    modalBackdrop.classList.add('open');
    setTimeout(() => fName.focus(), 100);
  }

  function closeModal() {
    modalBackdrop.classList.remove('open');
    editingId = null;
    studentForm.reset();
    clearErrors();
  }

  // ================================================================
  // VALIDATION
  // ================================================================
  function clearErrors() {
    document.querySelectorAll('.error-msg').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  }

  function showError(fieldName) {
    const input = document.getElementById(fieldName);
    const msg = document.querySelector(`.error-msg[data-for="${fieldName}"]`);
    if (input) input.classList.add('invalid');
    if (msg) msg.classList.add('show');
  }

  function validateForm() {
    clearErrors();
    let valid = true;

    if (!fName.value.trim()) { showError('name'); valid = false; }
    if (!fRollNumber.value.trim()) { showError('rollNumber'); valid = false; }
    if (!fClass.value) { showError('class'); valid = false; }
    if (!fSection.value) { showError('section'); valid = false; }
    if (!fParentName.value.trim()) { showError('parentName'); valid = false; }

    const mobile = fParentMobile.value.trim();
    if (!/^\d{10}$/.test(mobile)) { showError('parentMobile'); valid = false; }

    return valid;
  }

  // ================================================================
  // SAVE (POST or PUT)
  // ================================================================
  async function handleSave(e) {
    e.preventDefault();
    if (!validateForm()) return;

    const data = {
      name: fName.value.trim(),
      rollNumber: fRollNumber.value.trim(),
      class: fClass.value,
      section: fSection.value,
      bloodGroup: fBloodGroup.value,
      dob: fDob.value,
      parentName: fParentName.value.trim(),
      parentMobile: fParentMobile.value.trim(),
      address: fAddress.value.trim()
    };

    try {
      // In handleSave()
      if (editingId) {
        await apiRequest(`/student.php?id=${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      } else {
        await apiRequest('/students.php', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }

      closeModal();
      await loadStudents();
    } catch (err) {
      console.error('Save failed:', err);
      alert('Save failed: ' + err.message);
    }
  }

  // ================================================================
  // DELETE
  // ================================================================
  function openDeleteConfirm(id) {
    const student = students.find(s => s.id === id);
    if (!student) return;

    pendingDeleteId = id;
    confirmMessage.textContent =
      `Delete "${student.name}" (Class ${student.class} · Roll #${student.rollNumber})? This cannot be undone.`;
    confirmBackdrop.classList.add('open');
  }

  function closeDeleteConfirm() {
    pendingDeleteId = null;
    confirmBackdrop.classList.remove('open');
  }

  async function confirmDeleteStudent() {
    if (!pendingDeleteId) return;

    try {
      await apiRequest(`/students/${pendingDeleteId}`, { method: 'DELETE' });
      closeDeleteConfirm();
      await loadStudents();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Delete failed: ' + err.message);
    }
  }

  // ================================================================
  // EVENTS
  // ================================================================
  addBtn.addEventListener('click', openAddModal);
  modalClose.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  studentForm.addEventListener('submit', handleSave);

  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalBackdrop.classList.contains('open')) closeModal();
      if (confirmBackdrop.classList.contains('open')) closeDeleteConfirm();
    }
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    render();
  });

  classFilterSelect.addEventListener('change', (e) => {
    classFilter = e.target.value;
    render();
  });

  confirmCancel.addEventListener('click', closeDeleteConfirm);
  confirmDelete.addEventListener('click', confirmDeleteStudent);
  confirmBackdrop.addEventListener('click', (e) => {
    if (e.target === confirmBackdrop) closeDeleteConfirm();
  });

  // ================================================================
  // INIT — load from server
  // ================================================================
  loadStudents();

})();