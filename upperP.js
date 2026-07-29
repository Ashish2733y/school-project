/* ============================================
   School Next Pro — Student Fee Management System
   Application Logic (app.js)
   ============================================ */

// ============ CONSTANTS ============
const FEE_CONFIG = {
    admissionFee: 500,      // default admission fee, editable
    annualFee: 200,         // one-time, renews after 1 year
    tuitionFeeByClass: {    // monthly tuition fee by class
        'Nursery': 200,
        'LKG': 200,
        'UKG': 200,
        '1': 250,
        '2': 250,
        '3': 300,
        '4': 300,
        '5': 350,
        '6': 400,
        '7': 450,
        '8': 500,
        '9': 550,
        '10': 600,
        '11': 700,
        '12': 800
    },
    activityFee: 50,        // one-time fee (at admission)
    busFees: {              // by distance range
        '5': 500,           // 1-5 KM
        '10': 1000,         // 5-10 KM
        '15': 1500,         // 10-15 KM
        '20': 2000           // 15-20 KM
    }
};

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// ============ XSS PREVENTION — HTML ESCAPE HELPER ============
// Always use this before inserting user-supplied strings into innerHTML.
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============ DATA STORE (ISOLATED PER SCHOOL CODE) ============
let studentsDB = {};
let currentSearchId = null;

// ============ AUTH STORE ============
let schoolAccounts = JSON.parse(localStorage.getItem('schoolnext_accounts') || '{}');
let activeSchoolCode = localStorage.getItem('schoolnext_active_user') || null;

// ============ REST API BASE URL (SQL BACKEND) ============
// On Vercel (no explicit port) or when served from port 5000, use relative /api.
// Otherwise (e.g. live-server on port 5500), point to the local backend.
const getApiBaseUrl = () => {
    const { port, hostname, protocol } = window.location;
    // Vercel / production (port is empty), or served directly from Express (port 5000)
    if (!port || port === '5000' || hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return '/api';
    }
    return `${protocol}//${hostname}:5000/api`;
};
const API_BASE_URL = getApiBaseUrl();

function loadSchoolStudentData() {
    if (!activeSchoolCode) {
        studentsDB = {};
        return;
    }
    const key = 'schoolnext_students_' + activeSchoolCode;
    const saved = localStorage.getItem(key);
    if (saved) {
        studentsDB = JSON.parse(saved);
    } else {
        studentsDB = {};
    }
    syncWithSQLServer();
}

async function syncWithSQLServer() {
    if (!activeSchoolCode) return;
    try {
        const res = await fetch(`${API_BASE_URL}/students/${activeSchoolCode}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.students) {
                studentsDB = data.students;
                const key = 'schoolnext_students_' + activeSchoolCode;
                localStorage.setItem(key, JSON.stringify(studentsDB));
                updateHeaderStats();
            }
        }
    } catch (err) {
        // Offline / Local fallback mode
    }
}

// ============ GLOBAL VARIABLES FOR FEE VALUES ============
let currentAdmissionFee = 500;
let currentAnnualFee = 200;
let currentActivityFee = 50;

// ============ THEME PALETTE MANAGER ============
const SNP_THEMES = [
    { id: 'cream', name: '🍦 Warm Cream', class: 'theme-cream', animate: false },
    { id: 'classic', name: '💼 Classic Slate', class: 'theme-classic', animate: false },
    { id: 'normal', name: '🎨 Normal 3-Color', class: 'theme-normal', animate: false },
    { id: 'cyber', name: '⚡ Cyber Neon', class: '', animate: true },
    { id: 'sunset', name: '🌅 Sunset Glow', class: 'theme-sunset', animate: true },
    { id: 'emerald', name: '🌲 Emerald Gold', class: 'theme-emerald', animate: true }
];
let currentThemeIndex = 0;

function initTheme() {
    const saved = localStorage.getItem('snp_theme_index');
    if (saved !== null) {
        const idx = parseInt(saved, 10);
        if (!isNaN(idx) && idx >= 0 && idx < SNP_THEMES.length) {
            currentThemeIndex = idx;
        }
    }
    applyTheme(currentThemeIndex, false);
    initDarkMode();
}

function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % SNP_THEMES.length;
    applyTheme(currentThemeIndex, true);
}

function applyTheme(idx, notify = true) {
    const theme = SNP_THEMES[idx];
    document.documentElement.classList.remove('theme-cream', 'theme-sunset', 'theme-emerald', 'theme-normal', 'theme-classic');
    if (theme.class) {
        document.documentElement.classList.add(theme.class);
    }
    const nameEl = document.getElementById('themeName');
    if (nameEl) nameEl.textContent = theme.name;
    localStorage.setItem('snp_theme_index', idx);

    const particlesContainer = document.getElementById('particles');
    if (theme.animate !== false) {
        if (particlesContainer) particlesContainer.style.display = 'block';
        createParticles();
    } else {
        if (particlesContainer) {
            particlesContainer.innerHTML = '';
            particlesContainer.style.display = 'none';
        }
    }

    if (notify && typeof showToast === 'function') {
        showToast('info', 'Theme Updated', `Switched theme to ${theme.name}`);
    }
}

// ============ PASSWORD VISIBILITY TOGGLE ============
function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// ============ DARK / LIGHT MODE TOGGLE ============
function initDarkMode() {
    const savedMode = localStorage.getItem('snp_dark_mode');
    if (savedMode === 'light') {
        document.documentElement.classList.add('light-mode');
        updateDarkModeUI(false);
    } else {
        document.documentElement.classList.remove('light-mode');
        updateDarkModeUI(true);
    }
}

function toggleDarkMode() {
    const isLight = document.documentElement.classList.toggle('light-mode');
    const isDark = !isLight;
    localStorage.setItem('snp_dark_mode', isDark ? 'dark' : 'light');
    updateDarkModeUI(isDark);
    if (typeof showToast === 'function') {
        showToast('info', 'Mode Switched', isDark ? 'Switched to Dark Mode' : 'Switched to Light Mode');
    }
}

function updateDarkModeUI(isDark) {
    const icon = document.getElementById('darkModeIcon');
    const text = document.getElementById('darkModeText');
    if (icon) {
        icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
    }
    if (text) {
        text.textContent = isDark ? 'Dark Mode' : 'Light Mode';
    }
    document.querySelectorAll('.loginDarkModeIcon').forEach(el => {
        el.className = isDark ? 'fas fa-moon loginDarkModeIcon' : 'fas fa-sun loginDarkModeIcon';
    });
    document.querySelectorAll('.loginDarkModeText').forEach(el => {
        el.textContent = isDark ? 'Dark Mode' : 'Light Mode';
    });
}

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    createParticles();
    updateHeaderStats();
    setCurrentMonth();
    setupPaymentAmountListener();
    checkAuthStatus();
});

// ============ MOBILE HEADER MENU TOGGLE ============
function toggleMobileHeaderMenu() {
    const stats = document.getElementById('headerStats');
    if (stats) {
        stats.classList.toggle('mobile-active');
    }
}

// Close mobile dropdown when clicking outside
document.addEventListener('click', (e) => {
    const stats = document.getElementById('headerStats');
    const btn = document.getElementById('mobileMenuBtn');
    if (stats && btn && !stats.contains(e.target) && !btn.contains(e.target)) {
        stats.classList.remove('mobile-active');
    }
});

// ============ PARTICLE BACKGROUND (ZERO-LAG 120FPS) ============
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    container.innerHTML = '';
    const count = 12;
    const colors = [
        'var(--color-cyan)',
        'var(--color-violet)',
        'var(--color-amber)'
    ];
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const size = Math.random() * 3 + 2;
        const color = colors[i % colors.length];
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.background = color;
        particle.style.animationDuration = (Math.random() * 14 + 10) + 's';
        particle.style.animationDelay = (Math.random() * 6) + 's';
        container.appendChild(particle);
    }
}

// ============ TAB SWITCHING ============
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));

    if (tab === 'newAdmission') {
        document.getElementById('tabNewAdmission').classList.add('active');
        document.getElementById('sectionNewAdmission').classList.add('active');
    } else {
        document.getElementById('tabSearchStudent').classList.add('active');
        document.getElementById('sectionSearchStudent').classList.add('active');
    }
}

// ============ HEADER STATS ============
function updateHeaderStats() {
    const students = Object.keys(studentsDB);
    document.getElementById('totalStudentsCount').textContent = students.length;

    let totalDues = 0;
    students.forEach(id => {
        const student = studentsDB[id];
        if (student.payments) {
            student.payments.forEach(p => {
                if (p.due > 0) totalDues += p.due;
            });
        }
        if (student.remainingDue) {
            totalDues += student.remainingDue;
        }
    });
    document.getElementById('totalDueCount').textContent = totalDues;
}

// ============ SET CURRENT MONTH ============
function setCurrentMonth() {
    const now = new Date();
    const yearInput = document.getElementById('paymentYear');
    if (yearInput) yearInput.value = now.getFullYear();
    const admissionMonth = document.getElementById('admissionMonth');
    if (admissionMonth) admissionMonth.value = MONTHS[now.getMonth()];
    const admissionYear = document.getElementById('admissionYear');
    if (admissionYear) admissionYear.value = now.getFullYear();
}

// ============ TOGGLE STUDENT LIST ============
function toggleStudentList() {
    const dropdown = document.getElementById('studentDropdown');
    if (!dropdown) return;

    if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
        return;
    }

    const students = Object.keys(studentsDB);
    if (students.length === 0) {
        dropdown.innerHTML = '<div class="student-dropdown-item">No students registered yet</div>';
    } else {
    let html = '';
        students.forEach(id => {
            const s = studentsDB[id];
            const safeId   = escapeHTML(id);
            const safeName = escapeHTML(s.name);
            const safeMob  = escapeHTML(s.mobile || '—');
            html += `<div class="student-dropdown-item" onclick="selectStudentFromDropdown('${safeId}')" style="cursor:pointer; display:flex; align-items:center; gap:0.6rem; padding:0.6rem 0.85rem;">
                <span class="student-id" style="font-family:var(--font-mono); font-weight:700; color:var(--color-cyan); font-size:0.8rem;">${safeId}</span>
                <span class="student-name" style="font-weight:600; color:var(--text-primary); font-size:0.85rem;">${safeName}</span>
                <span class="student-mobile" style="color:var(--text-muted); font-size:0.75rem; font-family:var(--font-mono); margin-left:auto; margin-right:0.4rem;">
                    <i class="fas fa-phone-alt" style="font-size:0.7rem; color:var(--color-cyan);"></i> ${safeMob}
                </span>
                <button class="btn-delete-student" onclick="deleteStudent('${safeId}', event)" title="Delete Student" aria-label="Delete student ${safeName}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </div>`;
        });
        dropdown.innerHTML = html;
    }

    dropdown.style.display = 'block';
}

// ============ TOGGLE DUE LIST ============
function toggleDueList() {
    const dropdown = document.getElementById('dueDropdown');
    if (!dropdown) return;

    if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
        return;
    }

    // Close student dropdown if open
    const studentDropdown = document.getElementById('studentDropdown');
    if (studentDropdown) studentDropdown.style.display = 'none';

    const students = Object.keys(studentsDB);
    const dueStudents = [];

    students.forEach(id => {
        const s = studentsDB[id];
        let totalDue = 0;
        if (s.payments) {
            s.payments.forEach(p => {
                totalDue += p.due;
            });
        }
        if (s.remainingDue) {
            totalDue += s.remainingDue;
        }
        if (totalDue > 0) {
            dueStudents.push({ id, name: s.name, mobile: s.mobile, totalDue });
        }
    });

    if (dueStudents.length === 0) {
        dropdown.innerHTML = '<div class="student-dropdown-item">No dues pending</div>';
    } else {
    let html = '';
        dueStudents.forEach(s => {
            const safeId   = escapeHTML(s.id);
            const safeName = escapeHTML(s.name);
            const safeMob  = escapeHTML(s.mobile || '—');
            html += `<div class="student-dropdown-item" onclick="selectStudentFromDropdown('${safeId}')" style="cursor:pointer; display:flex; align-items:center; gap:0.6rem; padding:0.6rem 0.85rem;">
                <span class="student-id" style="font-family:var(--font-mono); font-weight:700; color:var(--color-cyan); font-size:0.8rem;">${safeId}</span>
                <span class="student-name" style="font-weight:600; color:var(--text-primary); font-size:0.85rem;">${safeName}</span>
                <span class="student-mobile" style="color:var(--text-muted); font-size:0.75rem; font-family:var(--font-mono); margin-left:auto;">
                    <i class="fas fa-phone-alt" style="font-size:0.7rem; color:var(--color-cyan);"></i> ${safeMob}
                </span>
                <span class="student-due" style="color:var(--danger); font-weight:700; font-size:0.82rem; font-family:var(--font-mono); margin-left:0.4rem; margin-right:0.4rem;">₹${s.totalDue.toLocaleString('en-IN')}</span>
                <button class="btn-delete-student" onclick="deleteStudent('${safeId}', event)" title="Delete Student" aria-label="Delete student ${safeName}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </div>`;
        });
        dropdown.innerHTML = html;
    }

    dropdown.style.display = 'block';
}

// ============ SELECT STUDENT FROM DROPDOWN ============
function selectStudentFromDropdown(id) {
    const studentDropdown = document.getElementById('studentDropdown');
    const dueDropdown = document.getElementById('dueDropdown');
    if (studentDropdown) studentDropdown.style.display = 'none';
    if (dueDropdown) dueDropdown.style.display = 'none';

    switchTab('searchStudent');
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = id;
        searchStudent();
    }
}

// ============ DELETE STUDENT ============
function deleteStudent(id, event) {
    if (event) {
        event.stopPropagation();
    }

    if (!id || !studentsDB[id]) {
        showToast('error', 'Error', 'Student not found.');
        return;
    }

    const student = studentsDB[id];

    // BUG FIX: Check confirmation BEFORE deleting.
    // Previous code deleted the student regardless of the user's answer.
    const confirmDelete = confirm(
        `Are you sure you want to delete student "${student.name}" (ID: ${id})?\nThis action cannot be undone.`
    );
    if (!confirmDelete) return; // User cancelled — do nothing

    delete studentsDB[id];
    saveData();
    updateHeaderStats();

    // Async sync delete with SQL server
    fetch(`${API_BASE_URL}/students/${activeSchoolCode}/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    }).catch(() => { /* Network error — local state already updated */ });

    // Refresh dropdowns if open
    const studentDropdown = document.getElementById('studentDropdown');
    if (studentDropdown && studentDropdown.style.display === 'block') {
        studentDropdown.style.display = 'none';
        toggleStudentList();
    }

    const dueDropdown = document.getElementById('dueDropdown');
    if (dueDropdown && dueDropdown.style.display === 'block') {
        dueDropdown.style.display = 'none';
        toggleDueList();
    }

    // If currently searching this student, hide search results
    if (currentSearchId === id) {
        currentSearchId = null;
        const searchResults = document.getElementById('searchResults');
        if (searchResults) searchResults.style.display = 'none';
        const editCard = document.getElementById('editStudentCard');
        if (editCard) editCard.style.display = 'none';
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
    }

    showToast('error', 'Student Deleted',
        `Student "${escapeHTML(student.name)}" (${escapeHTML(id)}) has been deleted successfully.`);
}

// Close dropdowns when clicking outside
document.addEventListener('click', function (e) {
    const studentPill = document.getElementById('totalStudentsPill');
    const studentDropdown = document.getElementById('studentDropdown');
    const duePill = document.getElementById('totalDuePill');
    const dueDropdown = document.getElementById('dueDropdown');

    if (studentDropdown && studentDropdown.style.display === 'block') {
        if (!studentPill.contains(e.target) && !studentDropdown.contains(e.target)) {
            studentDropdown.style.display = 'none';
        }
    }

    if (dueDropdown && dueDropdown.style.display === 'block') {
        if (!duePill.contains(e.target) && !dueDropdown.contains(e.target)) {
            dueDropdown.style.display = 'none';
        }
    }
});
function updateFeePreview() {
    const stdClass = document.getElementById('stdClass').value;
    const distance = document.getElementById('busDistance').value;
    const feeType = document.getElementById('feeTypeSelect').value;
    const inputValue = parseInt(document.getElementById('admissionFeeInput').value) || 0;
    const paidAmount = parseInt(document.getElementById('paidAmountInput').value) || 0;
    
    // Update ONLY the selected fee type
    if (feeType === 'admission') {
        currentAdmissionFee = inputValue;
    } else if (feeType === 'annual') {
        currentAnnualFee = inputValue;
    } else if (feeType === 'activity') {
        currentActivityFee = inputValue;
    }
    
    const tuitionFee = stdClass ? (FEE_CONFIG.tuitionFeeByClass[stdClass] || 0) : 0;
    const busFee = distance ? FEE_CONFIG.busFees[distance] : 0;
    const monthlyTotal = tuitionFee + busFee;
    
    // Total at Admission = One-Time (Admission + Annual + Activity) + Monthly (Tuition + Bus)
    const totalAtAdmission = currentAdmissionFee + currentAnnualFee + currentActivityFee + tuitionFee + busFee;
    const remainingDue = Math.max(0, totalAtAdmission - paidAmount);

    document.getElementById('previewAdmissionFee').textContent = '₹' + currentAdmissionFee.toLocaleString('en-IN');
    document.getElementById('previewAnnualFee').textContent = '₹' + currentAnnualFee.toLocaleString('en-IN');
    document.getElementById('previewActivityFee').textContent = '₹' + currentActivityFee.toLocaleString('en-IN');
    document.getElementById('previewTuitionFee').textContent = '₹' + tuitionFee.toLocaleString('en-IN');
    document.getElementById('previewBusFee').textContent = '₹' + busFee.toLocaleString('en-IN');
    
    const monthlyPreview = document.getElementById('previewMonthlyTotal');
    if (monthlyPreview) {
        monthlyPreview.textContent = '₹' + monthlyTotal.toLocaleString('en-IN');
    }

    document.getElementById('previewGrandTotal').textContent = '₹' + totalAtAdmission.toLocaleString('en-IN');
    
    // Update paid amount preview
    const paidPreview = document.getElementById('previewPaidAmount');
    if (paidPreview) {
        paidPreview.textContent = '₹' + paidAmount.toLocaleString('en-IN');
    }

    // Update due status preview
    const dueStatusPreview = document.getElementById('previewDueStatus');
    const dueRow = document.getElementById('previewDueRow');

    if (dueStatusPreview) {
        if (remainingDue === 0) {
            dueStatusPreview.textContent = '✅ No Due (₹0)';
            dueStatusPreview.style.color = 'var(--success)';
            if (dueRow) {
                dueRow.style.background = 'var(--success-bg)';
                dueRow.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            }
        } else {
            dueStatusPreview.textContent = '⚠️ Due: ₹' + remainingDue.toLocaleString('en-IN');
            dueStatusPreview.style.color = 'var(--danger)';
            if (dueRow) {
                dueRow.style.background = 'var(--danger-bg)';
                dueRow.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }
        }
    }
}

// ============ UPDATE FEE TYPE SELECTION ============
function updateFeeTypeSelection() {
    const feeType = document.getElementById('feeTypeSelect').value;
    const feeInput = document.getElementById('admissionFeeInput');
    const label = document.querySelector('label[for="admissionFeeInput"]');
    
    if (feeType === 'admission') {
        feeInput.value = currentAdmissionFee;
        if (label) label.innerHTML = `<i class="fas fa-money-bill-wave"></i> Admission Fee Amount`;
    } else if (feeType === 'annual') {
        feeInput.value = currentAnnualFee;
        if (label) label.innerHTML = `<i class="fas fa-money-bill-wave"></i> Annual Fee Amount (valid for 1 year)`;
    } else if (feeType === 'activity') {
        feeInput.value = currentActivityFee;
        if (label) label.innerHTML = `<i class="fas fa-money-bill-wave"></i> Activity Fee Amount (One-Time)`;
    } else {
        feeInput.value = 0;
        if (label) label.innerHTML = `<i class="fas fa-money-bill-wave"></i> Fee Amount`;
    }
    
    updateFeePreview();
}

// ============ NEW ADMISSION - WITH PAID AMOUNT & SAFETY CHECKS ============
function handleAdmission(event) {
    event.preventDefault();

    // Strict Validation: Paid Amount (at Admission) is REQUIRED
    const paidAmountInput = document.getElementById('paidAmountInput');
    const paidAmountRaw = paidAmountInput ? paidAmountInput.value.trim() : '';

    if (paidAmountRaw === '' || isNaN(parseInt(paidAmountRaw, 10))) {
        showToast('warning', 'Paid Amount Required', 'Please enter Paid Amount (at Admission) to complete admission registration.');
        if (paidAmountInput) {
            paidAmountInput.focus();
            paidAmountInput.style.borderColor = 'var(--danger)';
            paidAmountInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.25)';
        }
        return false;
    }

    const stdId = document.getElementById('stdId').value.trim().toUpperCase();
    const stdName = document.getElementById('stdName').value.trim();
    const stdFatherName = document.getElementById('stdFatherName').value.trim();
    const stdMotherName = document.getElementById('stdMotherName').value.trim();
    const stdAddress = document.getElementById('stdAddress').value.trim();
    const stdMobile = document.getElementById('stdMobile').value.trim();
    const stdClass = document.getElementById('stdClass').value;
    const stdSection = document.getElementById('stdSection').value.toUpperCase();
    const busNumber = document.getElementById('busNumber').value.trim();
    const busDistance = document.getElementById('busDistance').value;
    const feeType = document.getElementById('feeTypeSelect').value;
    const inputValue = parseInt(document.getElementById('admissionFeeInput').value) || 0;
    const paidAmount = parseInt(paidAmountRaw, 10);
    
    // Get admission month and year (with fallback if elements don't exist)
    const monthElement = document.getElementById('admissionMonth');
    const yearElement = document.getElementById('admissionYear');
    
    let admissionMonth, admissionYear;
    
    if (monthElement && yearElement) {
        admissionMonth = monthElement.value;
        admissionYear = parseInt(yearElement.value);
    } else {
        // Fallback: use current month and year
        const now = new Date();
        admissionMonth = MONTHS[now.getMonth()];
        admissionYear = now.getFullYear();
    }
    
    let admissionFee = currentAdmissionFee;
    let annualFee = currentAnnualFee;
    let activityFee = currentActivityFee;
    
    if (feeType === 'admission') {
        admissionFee = inputValue;
    } else if (feeType === 'annual') {
        annualFee = inputValue;
    } else if (feeType === 'activity') {
        activityFee = inputValue;
    }

    // Check for duplicate
    if (studentsDB[stdId]) {
        const existing = studentsDB[stdId];
        const isSame = (
            existing.name.toLowerCase() === stdName.toLowerCase() &&
            existing.fatherName.toLowerCase() === stdFatherName.toLowerCase() &&
            existing.motherName.toLowerCase() === stdMotherName.toLowerCase() &&
            existing.address.toLowerCase() === stdAddress.toLowerCase() &&
            existing.mobile === stdMobile &&
            existing.class === stdClass &&
            existing.section === stdSection
        );

        if (isSame) {
            showModal(
                'error',
                'Admission Denied!',
                `Sorry, this student is already in our data. Student "${stdName}" with ID "${stdId}" is already registered.`
            );
            showToast('error', 'Duplicate Found', 'This student already exists in the system.');
            return false;
        } else {
            showModal(
                'warning',
                'ID Already Taken!',
                `Student ID "${stdId}" is already assigned to "${existing.name}". Please use a different Student ID.`
            );
            showToast('warning', 'ID Conflict', 'This student ID is already in use.');
            return false;
        }
    }

    // Check duplicate by details
    const duplicateByDetails = Object.values(studentsDB).find(s =>
        s.name.toLowerCase() === stdName.toLowerCase() &&
        s.fatherName.toLowerCase() === stdFatherName.toLowerCase() &&
        s.motherName.toLowerCase() === stdMotherName.toLowerCase()
    );

    if (duplicateByDetails) {
        showModal(
            'error',
            'Admission Denied!',
            `Sorry, this student is already in our data. A student with name "${stdName}", father "${stdFatherName}", and mother "${stdMotherName}" is already registered with ID "${duplicateByDetails.id}".`
        );
        showToast('error', 'Duplicate Found', 'This student already exists with a different ID.');
        return false;
    }

    // Calculate fees
    const tuitionFee = FEE_CONFIG.tuitionFeeByClass[stdClass] || 0;
    const busFee = busDistance ? FEE_CONFIG.busFees[busDistance] : 0;
    const monthlyFee = tuitionFee + busFee;
    const totalAtAdmission = admissionFee + annualFee + activityFee + monthlyFee;
    const remainingDue = Math.max(0, totalAtAdmission - paidAmount);

    // Create initial payment record for admission month
    // Monthly fee is part of totalAtAdmission, so mark it as paid in the record
    // The remainingDue field tracks whatever is left over from the total
    const initialPayment = {
        month: admissionMonth,
        year: admissionYear,
        totalFee: monthlyFee,
        paid: monthlyFee,
        due: 0,
        date: new Date().toISOString()
    };

    const photo = document.getElementById('stdPhotoData') ? document.getElementById('stdPhotoData').value : '';

    // Create student record
    const student = {
        id: stdId,
        name: stdName,
        photo: photo,
        fatherName: stdFatherName,
        motherName: stdMotherName,
        address: stdAddress,
        mobile: stdMobile,
        class: stdClass,
        section: stdSection,
        busNumber: busNumber,
        busDistance: busDistance,
        admissionFee: admissionFee,
        annualFee: annualFee,
        annualFeePaidDate: new Date().toISOString(),
        annualFeeActive: true,
        tuitionFee: tuitionFee,
        activityFee: activityFee,
        busFee: busFee,
        monthlyFee: monthlyFee,
        totalAtAdmission: totalAtAdmission,
        paidAtAdmission: paidAmount,
        remainingDue: remainingDue,
        admissionDate: new Date().toISOString(),
        admissionMonth: admissionMonth,
        admissionYear: admissionYear,
        payments: [initialPayment],
        totalDue: remainingDue
    };

    // Save
    studentsDB[stdId] = student;
    saveData();
    updateHeaderStats();

    // Sync add student with Neon PostgreSQL server
    fetch(`${API_BASE_URL}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolCode: activeSchoolCode, student: student })
    }).then(async res => {
        const data = await res.json();
        if (data.success) {
            console.log('✅ Student saved to Neon DB successfully!');
            showToast('success', 'Neon DB Synced', `${stdName} saved to Neon Cloud Database!`);
        } else {
            console.error('❌ Neon DB error:', data.message);
            showToast('warning', 'DB Sync Error', data.message);
        }
    }).catch(err => {
        console.error('❌ Network error syncing student with Neon DB:', err);
    });

    // Show success with fee breakdown
    const isFullyPaid = remainingDue === 0;
    
    const feeBreakdownHTML = `
        <div class="fee-row">
            <span>Admission Fee</span>
            <span class="fee-amount">₹${admissionFee.toLocaleString('en-IN')}</span>
        </div>
        <div class="fee-row">
            <span>Annual Fee (valid for 1 year)</span>
            <span class="fee-amount">₹${annualFee.toLocaleString('en-IN')}</span>
        </div>
        <div class="fee-row">
            <span>Activity Fee (One-Time)</span>
            <span class="fee-amount">₹${activityFee.toLocaleString('en-IN')}</span>
        </div>
        <div class="fee-row">
            <span>Tuition Fee</span>
            <span class="fee-amount">₹${tuitionFee.toLocaleString('en-IN')}</span>
        </div>
        <div class="fee-row">
            <span>Bus Fee</span>
            <span class="fee-amount">₹${busFee.toLocaleString('en-IN')}</span>
        </div>
        <div class="fee-row" style="background:var(--info-bg);border-radius:var(--radius-sm);padding:0.5rem 0.75rem;margin:0.5rem 0;border:1px solid rgba(59,130,246,0.2);">
            <span><strong>Admission Month:</strong> ${admissionMonth} ${admissionYear}</span>
        </div>
        <div class="fee-row grand-total" style="margin-top:0.5rem;">
            <span><strong>Total at Admission</strong></span>
            <span class="fee-amount" style="font-size:1.1rem;">₹${totalAtAdmission.toLocaleString('en-IN')}</span>
        </div>
        <div class="fee-row" style="background:var(--success-bg);border-radius:var(--radius-sm);padding:0.5rem 0.75rem;border:1px solid rgba(16,185,129,0.2);">
            <span><strong>💰 Paid Amount</strong></span>
            <span class="fee-amount" style="color:var(--success);">₹${paidAmount.toLocaleString('en-IN')}</span>
        </div>
        <div class="fee-row" style="background:${isFullyPaid ? 'var(--success-bg)' : 'var(--danger-bg)'};border-radius:var(--radius-sm);padding:0.5rem 0.75rem;border:1px solid ${isFullyPaid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'};">
            <span><strong>${isFullyPaid ? '✅' : '⚠️'} Remaining Due</strong></span>
            <span class="fee-amount" style="color:${isFullyPaid ? 'var(--success)' : 'var(--danger)'};">${isFullyPaid ? '₹0 - No Due 🎉' : '₹' + remainingDue.toLocaleString('en-IN')}</span>
        </div>
        <div class="fee-row monthly-total" style="margin-top:0.5rem;">
            <span><strong>Monthly Fee (Next Month Onwards)</strong></span>
            <span class="fee-amount">₹${monthlyFee.toLocaleString('en-IN')}</span>
        </div>
        <small style="display:block;text-align:center;color:var(--text-muted);margin-top:0.5rem;font-size:0.75rem;">
            Total = Admission + Annual + Activity + Tuition + Bus. Remaining Due = Total - Paid.
        </small>
    `;

    showModal(
        'success',
        'Admission Successful!',
        `Student "${stdName}" (${stdId}) has been registered successfully.`,
        feeBreakdownHTML
    );

    showToast('success', 'Admission Complete', `${stdName} registered with ID ${stdId}`);

    // Reset form & photo
    document.getElementById('admissionForm').reset();
    removeUploadedPhoto('admissionPhotoPreview', 'stdPhotoData');
    document.getElementById('admissionFeeInput').value = 500;
    document.getElementById('paidAmountInput').value = 0;
    currentAdmissionFee = 500;
    currentAnnualFee = 200;
    currentActivityFee = 50;
    document.getElementById('feeTypeSelect').value = '';
    const label = document.querySelector('label[for="admissionFeeInput"]');
    if (label) {
        label.innerHTML = `<i class="fas fa-money-bill-wave"></i> Fee Amount`;
    }
    updateFeePreview();

    return false;
}

// ============ SEARCH STUDENT ============
function handleSearchKeyup(e) {
    if (e.key === 'Enter') searchStudent();
}

function searchStudent() {
    const searchId = document.getElementById('searchInput').value.trim().toUpperCase();

    if (!searchId) {
        showToast('warning', 'Empty Search', 'Please enter a Student ID to search.');
        return;
    }

    const student = studentsDB[searchId];

    if (!student) {
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('noResults').style.display = 'block';
        showToast('error', 'Not Found', `No student found with ID "${searchId}"`);
        return;
    }

    currentSearchId = searchId;
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('searchResults').style.display = 'block';
    document.getElementById('editStudentCard').style.display = 'none';

    populateProfile(student);
    populateFeeDashboard(student);
    populatePaymentHistory(student);

    showToast('success', 'Student Found', `Loaded details for ${student.name}`);
}

function populateProfile(student) {
    const avatarEl = document.getElementById('profileAvatar');
    if (avatarEl) {
        if (student.photo) {
            avatarEl.innerHTML = `<img src="${student.photo}" alt="${student.name}" class="profile-avatar-img">`;
        } else {
            avatarEl.innerHTML = `<i class="fas fa-user-graduate"></i>`;
        }
    }
    document.getElementById('profileName').textContent = student.name;
    document.getElementById('profileId').textContent = 'ID: ' + student.id;
    document.getElementById('profileClass').textContent = 'Class ' + student.class;
    document.getElementById('profileSection').textContent = 'Section ' + student.section;
    document.getElementById('profileBus').textContent = 'Bus ' + student.busNumber;
    document.getElementById('profileFather').textContent = student.fatherName;
    document.getElementById('profileMother').textContent = student.motherName;
    document.getElementById('profileMobile').textContent = student.mobile;
    document.getElementById('profileAddress').textContent = student.address;
}

function populateFeeDashboard(student) {
    // Admission Fee
    document.getElementById('dashAdmissionFee').textContent = '₹' + student.admissionFee.toLocaleString('en-IN');
    document.getElementById('dashAdmissionStatus').textContent = 'Paid (One-Time)';
    document.getElementById('dashAdmissionStatus').className = 'fee-status paid';

    // Annual Fee
    document.getElementById('dashAnnualFee').textContent = '₹' + student.annualFee.toLocaleString('en-IN');
    const annualPaidDate = new Date(student.annualFeePaidDate);
    const oneYearLater = new Date(annualPaidDate);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const now = new Date();

    if (now > oneYearLater) {
        document.getElementById('dashAnnualStatus').textContent = 'Expired — Renew Now';
        document.getElementById('dashAnnualStatus').className = 'fee-status danger';
        student.annualFeeActive = false;
    } else {
        const monthsLeft = Math.ceil((oneYearLater - now) / (1000 * 60 * 60 * 24 * 30));
        document.getElementById('dashAnnualStatus').textContent = `Active (${monthsLeft} months left)`;
        document.getElementById('dashAnnualStatus').className = 'fee-status paid';
    }

    // Monthly Fee
    document.getElementById('dashMonthlyFee').textContent = '₹' + student.monthlyFee.toLocaleString('en-IN');

    // Total Due — only remainingDue from admission (no separate monthly due during admission)
    let totalDue = student.remainingDue || 0;
    // Add monthly payment dues (from future month payments, NOT admission month)
    if (student.payments) {
        student.payments.forEach(p => {
            totalDue += p.due;
        });
    }
    student.totalDue = totalDue;
    document.getElementById('dashTotalDue').textContent = '₹' + totalDue.toLocaleString('en-IN');

    if (totalDue > 0) {
        document.getElementById('dashDueStatus').textContent = 'Due Pending';
        document.getElementById('dashDueStatus').className = 'fee-status danger';
    } else {
        document.getElementById('dashDueStatus').textContent = 'No Due';
        document.getElementById('dashDueStatus').className = 'fee-status paid';
    }

    // Due breakdown
    const dueBreakdown = document.getElementById('dashDueBreakdown');
    if (dueBreakdown) {
        let breakdownHTML = '';
        if (student.remainingDue && student.remainingDue > 0) {
            breakdownHTML += `<div class="fee-row" style="background:var(--danger-bg);border-radius:var(--radius-sm);padding:0.4rem 0.75rem;border:1px solid rgba(239,68,68,0.2);margin-top:0.5rem;">
                <span><strong>⚠️ Admission Remaining Due</strong></span>
                <span class="fee-amount" style="color:var(--danger);">₹${student.remainingDue.toLocaleString('en-IN')}</span>
            </div>`;
        }
        dueBreakdown.innerHTML = breakdownHTML;
    }

    // Update payment info bar
    document.getElementById('payInfoMonthly').textContent = '₹' + student.monthlyFee.toLocaleString('en-IN');
    document.getElementById('paymentAmount').value = '';
    document.getElementById('payInfoPaying').textContent = '₹0';
    const totalFeeEl = document.getElementById('payInfoTotalFee');
    if (totalFeeEl) totalFeeEl.textContent = '₹0';
    const monthCountEl = document.getElementById('payInfoMonthCount');
    if (monthCountEl) monthCountEl.textContent = '0';
    const alreadyPaidEl = document.getElementById('payInfoAlreadyPaid');
    if (alreadyPaidEl) alreadyPaidEl.textContent = '—';

    // Admission Due option checkbox container
    const admDueContainer = document.getElementById('admissionDueOptionContainer');
    const admDueLabel = document.getElementById('admissionDueAmountLabel');
    const admDueCb = document.getElementById('payAdmissionDueCheckbox');

    if (student.remainingDue && student.remainingDue > 0) {
        if (admDueContainer) admDueContainer.style.display = 'block';
        if (admDueLabel) admDueLabel.textContent = '₹' + student.remainingDue.toLocaleString('en-IN');
        if (admDueCb) admDueCb.checked = true; // Auto-select admission remaining due by default
    } else {
        if (admDueContainer) admDueContainer.style.display = 'none';
        if (admDueCb) admDueCb.checked = false;
    }

    // Uncheck all month checkboxes
    document.querySelectorAll('input[name="payMonths"]').forEach(cb => cb.checked = false);

    // Initial update of info bar
    updateMultiMonthInfo();
}

function populatePaymentHistory(student) {
    const tbody = document.getElementById('paymentHistoryBody');

    if ((!student.payments || student.payments.length === 0) && !(student.remainingDue && student.remainingDue > 0)) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No payment records found</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    // Show admission remaining due as a separate row (if any)
    if (student.remainingDue && student.remainingDue > 0) {
        const tr = document.createElement('tr');
        const totalAtAdm = student.totalAtAdmission || 0;
        const paidAtAdm = student.paidAtAdmission || 0;
        tr.innerHTML = `
            <td><strong>Admission Due</strong></td>
            <td>${student.admissionYear || '—'}</td>
            <td>₹${totalAtAdm.toLocaleString('en-IN')}</td>
            <td style="color: var(--success); font-weight:600;">₹${paidAtAdm.toLocaleString('en-IN')}</td>
            <td style="color: var(--danger); font-weight:600;">₹${student.remainingDue.toLocaleString('en-IN')}</td>
            <td><span class="status-unpaid">${paidAtAdm > 0 ? 'Partial Due' : 'Unpaid'}</span></td>
        `;
        tbody.appendChild(tr);
    }

    const sorted = [...student.payments].reverse();
    sorted.forEach(p => {
        const tr = document.createElement('tr');
        let statusClass = 'status-paid';
        let statusText = 'Paid';

        if (p.due > 0 && p.paid > 0) {
            statusClass = 'status-partial';
            statusText = 'Partial';
        } else if (p.due > 0 && p.paid === 0) {
            statusClass = 'status-unpaid';
            statusText = 'Unpaid';
        }

        tr.innerHTML = `
            <td>${p.month}</td>
            <td>${p.year}</td>
            <td>₹${p.totalFee.toLocaleString('en-IN')}</td>
            <td style="color: var(--success); font-weight:600;">₹${p.paid.toLocaleString('en-IN')}</td>
            <td style="color: ${p.due > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:600;">₹${p.due.toLocaleString('en-IN')}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// ============ MULTI-MONTH INFO UPDATE ============
function getSelectedMonths() {
    const checkboxes = document.querySelectorAll('input[name="payMonths"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function updateMultiMonthInfo() {
    if (!currentSearchId || !studentsDB[currentSearchId]) return;
    const student = studentsDB[currentSearchId];
    const year = parseInt(document.getElementById('paymentYear').value);
    const selectedMonths = getSelectedMonths();
    const amount = parseInt(document.getElementById('paymentAmount').value) || 0;

    let totalFeeForSelected = 0;
    let alreadyPaidMonths = [];

    const admDueCb = document.getElementById('payAdmissionDueCheckbox');
    const isAdmDueChecked = (admDueCb && admDueCb.checked && student.remainingDue && student.remainingDue > 0);

    if (isAdmDueChecked) {
        totalFeeForSelected += student.remainingDue;
    }

    selectedMonths.forEach(month => {
        const existing = student.payments.find(p => p.month === month && p.year === year);
        if (existing && existing.due === 0) {
            alreadyPaidMonths.push(month);
        } else if (existing && existing.due > 0) {
            totalFeeForSelected += existing.due;
        } else {
            totalFeeForSelected += student.monthlyFee;
        }
    });

    const monthCountEl = document.getElementById('payInfoMonthCount');
    if (monthCountEl) monthCountEl.textContent = selectedMonths.length + (isAdmDueChecked ? 1 : 0);

    const totalFeeEl = document.getElementById('payInfoTotalFee');
    if (totalFeeEl) totalFeeEl.textContent = '₹' + totalFeeForSelected.toLocaleString('en-IN');

    const payingEl = document.getElementById('payInfoPaying');
    if (payingEl) payingEl.textContent = '₹' + amount.toLocaleString('en-IN');

    const alreadyPaidEl = document.getElementById('payInfoAlreadyPaid');
    if (alreadyPaidEl) {
        if (alreadyPaidMonths.length > 0) {
            alreadyPaidEl.textContent = alreadyPaidMonths.join(', ');
            alreadyPaidEl.style.color = 'var(--warning)';
        } else {
            alreadyPaidEl.textContent = '—';
            alreadyPaidEl.style.color = '';
        }
    }
}

function setupPaymentAmountListener() {
    document.getElementById('paymentAmount').addEventListener('input', function () {
        updateMultiMonthInfo();
    });
}

// ============ PROCESS PAYMENT (MULTI-MONTH & ADMISSION DUE) ============
function processPayment() {
    if (!currentSearchId || !studentsDB[currentSearchId]) {
        showToast('error', 'No Student', 'Please search for a student first.');
        return;
    }

    const student = studentsDB[currentSearchId];
    const year = parseInt(document.getElementById('paymentYear').value);
    const amount = parseInt(document.getElementById('paymentAmount').value) || 0;
    const selectedMonths = getSelectedMonths();
    const admDueCb = document.getElementById('payAdmissionDueCheckbox');
    const isAdmDueChecked = (admDueCb && admDueCb.checked && student.remainingDue && student.remainingDue > 0);

    if (selectedMonths.length === 0 && !isAdmDueChecked) {
        showToast('warning', 'No Option Selected', 'Please select at least one month or check Admission Remaining Due to pay.');
        return;
    }

    if (amount <= 0) {
        showToast('warning', 'Invalid Amount', 'Please enter a valid payment amount.');
        return;
    }

    // Calculate total required fee for selected options
    let totalRequired = 0;
    let alreadyPaidMonths = [];
    let payableMonths = [];

    if (isAdmDueChecked) {
        totalRequired += student.remainingDue;
    }

    selectedMonths.forEach(month => {
        const existing = student.payments.find(p => p.month === month && p.year === year);
        if (existing && existing.due === 0) {
            alreadyPaidMonths.push(month);
        } else if (existing && existing.due > 0) {
            totalRequired += existing.due;
            payableMonths.push({ month, type: 'due', due: existing.due });
        } else {
            totalRequired += student.monthlyFee;
            payableMonths.push({ month, type: 'new', due: student.monthlyFee });
        }
    });

    if (alreadyPaidMonths.length > 0 && payableMonths.length === 0 && !isAdmDueChecked) {
        showToast('warning', 'Already Paid', `You have already paid for: ${alreadyPaidMonths.join(', ')} ${year}. No due remaining.`);
        return;
    }

    if (amount > totalRequired) {
        showToast('warning', 'Excess Amount', `Total fee for selected options is ₹${totalRequired.toLocaleString('en-IN')}. Please do not enter more than the total due.`);
        return;
    }

    let remainingAmount = amount;
    let appliedToAdmission = 0;

    // 1. Process Admission Remaining Due
    if (isAdmDueChecked && student.remainingDue && student.remainingDue > 0) {
        appliedToAdmission = Math.min(remainingAmount, student.remainingDue);
        student.remainingDue -= appliedToAdmission;
        student.paidAtAdmission = (student.paidAtAdmission || 0) + appliedToAdmission;
        remainingAmount -= appliedToAdmission;

        if (student.remainingDue <= 0) {
            student.remainingDue = 0;
        }
    }

    // 2. Process Monthly Payments
    let paidMonths = [];
    let partialMonths = [];

    for (const pm of payableMonths) {
        if (remainingAmount <= 0) break;

        const existingIndex = student.payments.findIndex(
            p => p.month === pm.month && p.year === year
        );

        if (existingIndex >= 0) {
            const existing = student.payments[existingIndex];
            const canPay = Math.min(remainingAmount, existing.due);
            existing.paid += canPay;
            existing.due = Math.max(0, existing.totalFee - existing.paid);
            remainingAmount -= canPay;

            if (existing.due === 0) {
                paidMonths.push(pm.month);
            } else {
                partialMonths.push(pm.month);
            }
        } else {
            const canPay = Math.min(remainingAmount, student.monthlyFee);
            const due = student.monthlyFee - canPay;
            student.payments.push({
                month: pm.month,
                year: year,
                totalFee: student.monthlyFee,
                paid: canPay,
                due: Math.max(0, due),
                date: new Date().toISOString()
            });
            remainingAmount -= canPay;

            if (due === 0) {
                paidMonths.push(pm.month);
            } else {
                partialMonths.push(pm.month);
            }
        }
    }

    // Update total due
    let totalDue = student.remainingDue || 0;
    student.payments.forEach(p => totalDue += p.due);
    student.totalDue = totalDue;

    // Save Data locally
    studentsDB[currentSearchId] = student;
    saveData();
    updateHeaderStats();

    // Async Sync with SQL Server API
    fetch(`${API_BASE_URL}/students/${activeSchoolCode}/${currentSearchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
    }).catch(err => console.error('Payment sync error:', err));

    // Refresh UI
    populateFeeDashboard(student);
    populatePaymentHistory(student);
    document.getElementById('paymentAmount').value = '';
    updateMultiMonthInfo();

    let successMsg = `Payment of ₹${amount.toLocaleString('en-IN')} processed successfully!`;
    if (appliedToAdmission > 0) {
        successMsg += ` (₹${appliedToAdmission.toLocaleString('en-IN')} cleared from Admission Remaining Due)`;
    }

    showToast('success', 'Payment Successful', successMsg);
    showModal('success', 'Payment Received!', successMsg);
}

// ============ LIVE EDIT FEE PREVIEW ============
function updateEditFeePreview(triggerSource = 'class') {
    const editClass = document.getElementById('editClass').value;
    const editDistance = document.getElementById('editBusDistance').value;
    const tuitionInput = document.getElementById('editTuitionFee');

    let tuitionFee = 0;
    if (triggerSource === 'class') {
        tuitionFee = editClass ? (FEE_CONFIG.tuitionFeeByClass[editClass] || 0) : 0;
        if (tuitionInput) tuitionInput.value = tuitionFee;
    } else {
        tuitionFee = tuitionInput ? (parseInt(tuitionInput.value, 10) || 0) : (FEE_CONFIG.tuitionFeeByClass[editClass] || 0);
    }

    const busFee = editDistance ? (FEE_CONFIG.busFees[editDistance] || 0) : 0;
    const monthlyFee = tuitionFee + busFee;

    const monthlyEl = document.getElementById('editMonthlyFeePreview');
    const tuitionEl = document.getElementById('editTuitionFeePreview');
    const busEl = document.getElementById('editBusFeePreview');

    if (monthlyEl) monthlyEl.textContent = '₹' + monthlyFee.toLocaleString('en-IN');
    if (tuitionEl) tuitionEl.textContent = '₹' + tuitionFee.toLocaleString('en-IN');
    if (busEl) busEl.textContent = '₹' + busFee.toLocaleString('en-IN');
}

// ============ EDIT STUDENT ============
function toggleEditMode() {
    const editCard = document.getElementById('editStudentCard');
    const isVisible = editCard.style.display !== 'none';

    if (isVisible) {
        editCard.style.display = 'none';
        document.getElementById('btnEditProfile').innerHTML = '<i class="fas fa-pen"></i> Edit';
        return;
    }

    if (!currentSearchId || !studentsDB[currentSearchId]) return;
    const student = studentsDB[currentSearchId];

    document.getElementById('editName').value = student.name;
    document.getElementById('editFather').value = student.fatherName;
    document.getElementById('editMother').value = student.motherName;
    document.getElementById('editMobile').value = student.mobile;
    document.getElementById('editAddress').value = student.address;
    document.getElementById('editClass').value = student.class;
    document.getElementById('editSection').value = student.section;
    document.getElementById('editBusNumber').value = student.busNumber;
    document.getElementById('editBusDistance').value = student.busDistance;

    const tuitionInput = document.getElementById('editTuitionFee');
    if (tuitionInput) {
        tuitionInput.value = student.tuitionFee !== undefined ? student.tuitionFee : (FEE_CONFIG.tuitionFeeByClass[student.class] || 0);
    }

    // Load photo into edit form
    const photo = student.photo || '';
    const hiddenPhoto = document.getElementById('editPhotoData');
    const previewBox = document.getElementById('editPhotoPreview');
    const removeBtn = document.getElementById('btnRemoveEditPhoto');

    if (hiddenPhoto) hiddenPhoto.value = photo;
    if (previewBox) {
        if (photo) {
            previewBox.innerHTML = `<img src="${photo}" alt="Profile Preview" class="profile-preview-img">`;
            if (removeBtn) removeBtn.style.display = 'inline-flex';
        } else {
            previewBox.innerHTML = `<i class="fas fa-user-graduate"></i>`;
            if (removeBtn) removeBtn.style.display = 'none';
        }
    }

    // Live preview update for current class & distance
    updateEditFeePreview('manual');

    editCard.style.display = 'block';
    document.getElementById('btnEditProfile').innerHTML = '<i class="fas fa-times"></i> Cancel';
}

function saveStudentEdits(event) {
    event.preventDefault();

    if (!currentSearchId || !studentsDB[currentSearchId]) return false;

    const student = studentsDB[currentSearchId];
    const newClass = document.getElementById('editClass').value;
    const newDistance = document.getElementById('editBusDistance').value;
    const tuitionInput = document.getElementById('editTuitionFee');

    const newTuitionFee = tuitionInput ? (parseInt(tuitionInput.value, 10) || 0) : (FEE_CONFIG.tuitionFeeByClass[newClass] || 0);
    const newBusFee = FEE_CONFIG.busFees[newDistance] || 0;
    const newMonthlyFee = newTuitionFee + newBusFee;

    student.name = document.getElementById('editName').value.trim();
    student.photo = document.getElementById('editPhotoData') ? document.getElementById('editPhotoData').value : '';
    student.fatherName = document.getElementById('editFather').value.trim();
    student.motherName = document.getElementById('editMother').value.trim();
    student.mobile = document.getElementById('editMobile').value.trim();
    student.address = document.getElementById('editAddress').value.trim();
    student.class = newClass;
    student.section = document.getElementById('editSection').value.toUpperCase();
    student.busNumber = document.getElementById('editBusNumber').value.trim();
    student.busDistance = newDistance;
    student.tuitionFee = newTuitionFee;
    student.busFee = newBusFee;
    student.monthlyFee = newMonthlyFee;

    saveData();

    // Async sync with SQL server PUT API
    fetch(`${API_BASE_URL}/students/${activeSchoolCode}/${currentSearchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
    }).catch(err => console.error('Student edit sync error:', err));

    populateProfile(student);
    populateFeeDashboard(student);
    toggleEditMode();

    showToast('success', 'Updated', `${student.name}'s class updated to ${newClass} (Monthly Fee: ₹${newMonthlyFee.toLocaleString('en-IN')}).`);
    return false;
}

// ============ DATA PERSISTENCE (SQL BACKEND SYNC) ============
function saveData() {
    if (!activeSchoolCode) return;
    const key = 'schoolnext_students_' + activeSchoolCode;
    localStorage.setItem(key, JSON.stringify(studentsDB));

    // Async sync payment update with SQL Server if current student active
    if (currentSearchId && studentsDB[currentSearchId]) {
        const student = studentsDB[currentSearchId];
        fetch(`${API_BASE_URL}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                schoolCode: activeSchoolCode,
                studentId: student.id,
                payments: student.payments || [],
                remainingDue: student.remainingDue || 0
            })
        }).catch(err => {});
    }
}

// ============ MODAL ============
function showModal(type, title, message, feeBreakdown) {
    const overlay = document.getElementById('modalOverlay');
    const icon = document.getElementById('modalIcon');
    const titleEl = document.getElementById('modalTitle');
    const messageEl = document.getElementById('modalMessage');
    const feeEl = document.getElementById('modalFeeBreakdown');

    icon.className = 'modal-icon ' + type;

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle'
    };

    icon.innerHTML = `<i class="${icons[type] || icons.success}"></i>`;
    titleEl.textContent = title;
    messageEl.textContent = message;

    if (feeBreakdown) {
        feeEl.style.display = 'block';
        feeEl.innerHTML = feeBreakdown;
    } else {
        feeEl.style.display = 'none';
    }

    overlay.style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}

document.getElementById('modalOverlay').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
});

// ============ TOAST NOTIFICATIONS ============
function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // Use escapeHTML for user-supplied content to prevent XSS
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${icons[type] || icons.info}"></i>
        </div>
        <div class="toast-content">
            <strong>${escapeHTML(title)}</strong>
            <p>${escapeHTML(message)}</p>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ============ PHOTO UPLOAD HANDLERS ============
function handlePhotoUpload(event, previewId, hiddenInputId) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('warning', 'Invalid File', 'Please select a valid image file (JPG, PNG, WEBP).');
        return;
    }

    // Limit size to ~3MB
    if (file.size > 3 * 1024 * 1024) {
        showToast('warning', 'File Too Large', 'Image size should be under 3MB.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const dataUrl = e.target.result;
        const previewBox = document.getElementById(previewId);
        const hiddenInput = document.getElementById(hiddenInputId);

        if (previewBox) {
            // School logo uses contain fit; student photos use cover
            const isLogo = previewId === 'signupLogoPreview';
            const imgClass = isLogo ? 'header-logo-img' : 'profile-preview-img';
            previewBox.innerHTML = `<img src="${dataUrl}" alt="Preview" class="${imgClass}">`;
        }
        if (hiddenInput) {
            hiddenInput.value = dataUrl;
        }

        // Determine the remove button for all 3 upload contexts
        let removeBtnId;
        if (previewId === 'admissionPhotoPreview') {
            removeBtnId = 'btnRemoveAdmissionPhoto';
        } else if (previewId === 'signupLogoPreview') {
            removeBtnId = 'btnRemoveSignupLogo';
        } else {
            removeBtnId = 'btnRemoveEditPhoto';
        }
        const removeBtn = document.getElementById(removeBtnId);
        if (removeBtn) removeBtn.style.display = 'inline-flex';

        const msg = previewId === 'signupLogoPreview'
            ? 'School logo selected successfully.'
            : 'Profile photo selected successfully.';
        showToast('success', 'Image Loaded', msg);
    };
    reader.readAsDataURL(file);
}

function removeUploadedPhoto(previewId, hiddenInputId) {
    const previewBox = document.getElementById(previewId);
    const hiddenInput = document.getElementById(hiddenInputId);

    if (previewBox) {
        // Restore appropriate placeholder icon
        const icon = previewId === 'signupLogoPreview' ? 'fa-school' : 'fa-user-graduate';
        previewBox.innerHTML = `<i class="fas ${icon}"></i>`;
    }
    if (hiddenInput) {
        hiddenInput.value = '';
    }

    const removeBtnId = previewId === 'admissionPhotoPreview'
        ? 'btnRemoveAdmissionPhoto'
        : (previewId === 'signupLogoPreview' ? 'btnRemoveSignupLogo' : 'btnRemoveEditPhoto');
    const removeBtn = document.getElementById(removeBtnId);
    if (removeBtn) removeBtn.style.display = 'none';
}

// ============ AUTHENTICATION LOGIC ============
async function syncLocalAccountsToDB() {
    for (const code in schoolAccounts) {
        const acc = schoolAccounts[code];
        if (acc && acc.code && acc.password) {
            try {
                await fetch(`${API_BASE_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        logo: acc.logo || '',
                        name: acc.name,
                        code: acc.code,
                        email: acc.email || '',
                        ownerNumber: acc.ownerNumber || '',
                        password: acc.password
                    })
                });
            } catch (e) {
                // Ignore background sync errors
            }
        }
    }
}

function checkAuthStatus() {
    const authOverlay = document.getElementById('authOverlay');
    if (!authOverlay) return;

    syncLocalAccountsToDB();

    if (activeSchoolCode && schoolAccounts[activeSchoolCode]) {
        authOverlay.style.display = 'none';
        document.body.style.overflow = '';
        loadSchoolStudentData();
        updateHeaderStats();
        applySchoolProfileHeader(schoolAccounts[activeSchoolCode]);
    } else {
        studentsDB = {};
        updateHeaderStats();
        authOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        const hasAccounts = Object.keys(schoolAccounts).length > 0;
        if (hasAccounts) {
            switchAuthTab('login');
        } else {
            switchAuthTab('signup');
        }
    }
}

function switchAuthTab(tab) {
    const loginBtn = document.getElementById('tabAuthLogin');
    const signupBtn = document.getElementById('tabAuthSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const bannerTitle = document.getElementById('authBannerTitle');

    if (!loginBtn || !signupBtn || !loginForm || !signupForm) return;

    if (tab === 'login') {
        loginBtn.classList.add('active');
        signupBtn.classList.remove('active');
        loginForm.style.display = 'flex';
        signupForm.style.display = 'none';
        if (bannerTitle) bannerTitle.textContent = 'LOGIN YOUR SCHOOL';
    } else {
        signupBtn.classList.add('active');
        loginBtn.classList.remove('active');
        signupForm.style.display = 'grid';
        loginForm.style.display = 'none';
        if (bannerTitle) bannerTitle.textContent = 'REGISTER SCHOOL';
    }
}

async function handleSignup(event) {
    event.preventDefault();

    const logo = document.getElementById('signupLogoData') ? document.getElementById('signupLogoData').value : '';
    const name = document.getElementById('signupSchoolName').value.trim();
    const code = document.getElementById('signupSchoolCode').value.trim().toUpperCase();
    const email = document.getElementById('signupSchoolEmail').value.trim();
    const ownerNumber = document.getElementById('signupOwnerNumber').value.trim();
    const password = document.getElementById('signupPassword').value;

    if (!code || !name || !email || !ownerNumber || !password) {
        showToast('warning', 'Missing Details', 'Please fill in all required fields.');
        return false;
    }

    const account = {
        logo: logo,
        name: name,
        code: code,
        email: email,
        ownerNumber: ownerNumber,
        password: password,
        createdAt: new Date().toISOString()
    };

    // Register school account on Neon DB server first
    try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                logo: logo,
                name: name,
                code: code,
                email: email,
                ownerNumber: ownerNumber,
                password: password
            })
        });

        const data = await res.json();

        if (!data.success) {
            showToast('error', 'Registration Failed', data.message || 'Could not save school to Neon DB.');
            return false;
        }

        console.log('✅ School account registered on Neon DB!');
    } catch (err) {
        console.error('School DB registration error:', err);
        showToast('error', 'Server Error', 'Cannot connect to Backend Server (node server.js). Please ensure server is running to register school in Neon DB!');
        return false;
    }

    // Save locally after DB confirms
    schoolAccounts[code] = account;
    localStorage.setItem('schoolnext_accounts', JSON.stringify(schoolAccounts));

    // Reset signup form
    document.getElementById('signupForm').reset();
    removeUploadedPhoto('signupLogoPreview', 'signupLogoData');

    // Pre-fill login school code and switch to login tab
    document.getElementById('loginSchoolCode').value = code;
    switchAuthTab('login');

    showModal(
        'success',
        'School Registered Successfully!',
        `Your school "${name}" with Code "${code}" has been saved in Neon DB. Please enter your password to login.`
    );
    showToast('success', 'Registration Complete', `School Code: ${code} saved in Neon DB.`);

    return false;
}

async function handleLogin(event) {
    if (event) event.preventDefault();

    const code = document.getElementById('loginSchoolCode').value.trim().toUpperCase();
    const password = document.getElementById('loginPassword').value;

    if (!code || !password) {
        showToast('warning', 'Empty Fields', 'Please enter School Code and Password.');
        return false;
    }

    // 1. Check local account first
    const localAccount = schoolAccounts[code];
    if (localAccount && localAccount.password === password) {
        executeLoginSuccess(code, localAccount);
        return false;
    }

    // 2. Query Neon PostgreSQL Cloud API (enables login across any browser / device)
    try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code, password: password })
        });

        const data = await res.json();

        if (data.success && data.school) {
            const fetchedSchool = {
                code: data.school.code,
                name: data.school.name,
                email: data.school.email,
                ownerNumber: data.school.ownerNumber,
                password: password,
                logo: data.school.logo || ''
            };

            // Save account locally for instant future access
            schoolAccounts[code] = fetchedSchool;
            localStorage.setItem('schoolnext_accounts', JSON.stringify(schoolAccounts));

            executeLoginSuccess(code, fetchedSchool);
            return false;
        } else {
            showToast('error', 'Login Failed', data.message || 'Invalid School Code or Password.');
            return false;
        }
    } catch (err) {
        console.error('Cloud login error:', err);
        if (!localAccount) {
            showToast('error', 'Server Connection Error', `Cannot connect to Backend Server. Make sure "node server.js" is running in VS Code Terminal so Chrome can load your school data from Neon DB!`);
        } else if (localAccount.password !== password) {
            showToast('error', 'Incorrect Password', 'Invalid password. Please try again.');
        }
        return false;
    }
}

function executeLoginSuccess(code, account) {
    activeSchoolCode = code;
    localStorage.setItem('schoolnext_active_user', code);

    loadSchoolStudentData();
    updateHeaderStats();
    applySchoolProfileHeader(account);

    currentSearchId = null;
    const searchResults = document.getElementById('searchResults');
    if (searchResults) searchResults.style.display = 'none';

    const authOverlay = document.getElementById('authOverlay');
    if (authOverlay) authOverlay.style.display = 'none';
    document.body.style.overflow = '';

    document.getElementById('loginForm').reset();

    showToast('success', 'Welcome Back!', `Logged in to ${account.name} (${code})`);

    // Trigger grand welcome splash animation
    showWelcomeSplash(account);
}

function applySchoolProfileHeader(school) {
    const logoIcon = document.getElementById('headerSchoolLogo');
    const nameEl = document.getElementById('headerSchoolName');
    const subEl = document.getElementById('headerSchoolSub');

    if (logoIcon) {
        if (school.logo) {
            logoIcon.innerHTML = `<img src="${school.logo}" alt="${school.name}" class="header-logo-img">`;
        } else {
            logoIcon.innerHTML = `<i class="fas fa-graduation-cap"></i>`;
        }
    }

    if (nameEl) {
        nameEl.innerHTML = `${school.name}`;
    }

    if (subEl) {
        subEl.innerHTML = `<span style="color:var(--accent-primary);font-weight:700;">Code: ${school.code}</span> • Student Fee Management`;
    }
}

function handleLogout() {
    if (!confirm('Are you sure you want to log out from your school account?')) return;

    activeSchoolCode = null;
    localStorage.removeItem('schoolnext_active_user');

    studentsDB = {};
    currentSearchId = null;
    const searchResults = document.getElementById('searchResults');
    if (searchResults) searchResults.style.display = 'none';

    checkAuthStatus();
    showToast('info', 'Logged Out', 'You have been logged out successfully.');
}

// ============ EDIT SCHOOL PROFILE (LOGO ONLY) ============
function openEditSchoolModal() {
    if (!activeSchoolCode || !schoolAccounts[activeSchoolCode]) {
        showToast('warning', 'Not Logged In', 'Please login to your school account first.');
        return;
    }
    const school = schoolAccounts[activeSchoolCode];

    const logoDataEl = document.getElementById('editSchoolLogoData');
    const logoPreview = document.getElementById('editSchoolLogoPreview');
    const codeDisplay = document.getElementById('editSchoolCodeDisplay');
    const nameDisplay = document.getElementById('editSchoolNameDisplay');
    const emailDisplay = document.getElementById('editSchoolEmailDisplay');
    const phoneDisplay = document.getElementById('editSchoolPhoneDisplay');

    if (codeDisplay) codeDisplay.textContent = school.code;
    if (nameDisplay) nameDisplay.textContent = school.name || '—';
    if (emailDisplay) emailDisplay.textContent = school.email || '—';
    if (phoneDisplay) phoneDisplay.textContent = school.ownerNumber || '—';

    if (logoDataEl) logoDataEl.value = school.logo || '';
    if (logoPreview) {
        if (school.logo) {
            logoPreview.innerHTML = `<img src="${school.logo}" alt="School Logo" class="profile-preview-img">`;
        } else {
            logoPreview.innerHTML = `<i class="fas fa-university"></i>`;
        }
    }

    const overlay = document.getElementById('editSchoolOverlay');
    if (overlay) overlay.style.display = 'flex';
}

function closeEditSchoolModal() {
    const overlay = document.getElementById('editSchoolOverlay');
    if (overlay) overlay.style.display = 'none';
}

function handleUpdateSchool(event) {
    if (event) event.preventDefault();

    if (!activeSchoolCode || !schoolAccounts[activeSchoolCode]) {
        showToast('error', 'Authentication Error', 'No active school account found.');
        return false;
    }

    const logo = document.getElementById('editSchoolLogoData') ? document.getElementById('editSchoolLogoData').value : '';

    // Update School Logo Only
    schoolAccounts[activeSchoolCode].logo = logo;
    localStorage.setItem('schoolnext_accounts', JSON.stringify(schoolAccounts));

    // Update Neon PostgreSQL DB Backend API for Logo
    const school = schoolAccounts[activeSchoolCode];
    fetch(`${API_BASE_URL}/auth/school/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: activeSchoolCode,
            name: school.name,
            email: school.email,
            ownerNumber: school.ownerNumber,
            password: school.password,
            logo: logo
        })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            console.log('✅ School logo updated on Neon PostgreSQL DB server!');
        }
    }).catch(err => console.error('School logo update API error:', err));

    // Refresh Header and UI elements
    applySchoolProfileHeader(schoolAccounts[activeSchoolCode]);
    closeEditSchoolModal();

    showModal('success', 'School Logo Updated!', `School logo for "${school.name}" has been updated successfully.`);
    showToast('success', 'Logo Updated', 'School official logo updated successfully.');

    return false;
}

// ============ FORGOT PASSWORD & OTP RECOVERY ENGINE ============
let recoveryState = {
    schoolCode: null,
    phone: '',
    generatedOtp: null,
    verified: false
};

function openForgotPasswordModal(event) {
    if (event) event.preventDefault();

    const overlay = document.getElementById('forgotPasswordOverlay');
    if (!overlay) return;

    // Reset steps
    document.getElementById('recoveryStep1').style.display = 'block';
    document.getElementById('recoveryStep2').style.display = 'none';
    document.getElementById('recoveryStep3').style.display = 'none';

    // Reset input fields
    document.getElementById('recoveryPhoneInput').value = '';
    document.getElementById('recoveryOtpInput').value = '';

    recoveryState = { schoolCode: null, phone: '', generatedOtp: null, verified: false };
    overlay.style.display = 'flex';
}

function closeForgotPasswordModal() {
    const overlay = document.getElementById('forgotPasswordOverlay');
    if (overlay) overlay.style.display = 'none';
}

function backToRecoveryStep1() {
    document.getElementById('recoveryStep1').style.display = 'block';
    document.getElementById('recoveryStep2').style.display = 'none';
    document.getElementById('recoveryStep3').style.display = 'none';
}

function sendRecoveryOTP() {
    const inputVal = document.getElementById('recoveryPhoneInput').value.trim();

    if (!inputVal) {
        showToast('warning', 'Required Field', 'Please enter your registered 10-digit mobile number or School Code.');
        return;
    }

    // Search for school account by Mobile Number or School Code
    let targetCode = null;
    let targetAccount = null;

    const formattedVal = inputVal.toUpperCase();

    // Direct Code Match
    if (schoolAccounts[formattedVal]) {
        targetCode = formattedVal;
        targetAccount = schoolAccounts[formattedVal];
    } else {
        // Search by owner phone number
        for (const code in schoolAccounts) {
            if (schoolAccounts[code].ownerNumber === inputVal || schoolAccounts[code].code === formattedVal) {
                targetCode = code;
                targetAccount = schoolAccounts[code];
                break;
            }
        }
    }

    if (!targetAccount) {
        showToast('error', 'Account Not Found', `No registered school account found for "${inputVal}". Please verify your mobile number or school code.`);
        return;
    }

    // Generate random 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    recoveryState = {
        schoolCode: targetCode,
        phone: targetAccount.ownerNumber || inputVal,
        generatedOtp: generatedOtp,
        verified: false
    };

    // Update Step 2 UI
    const phoneTargetEl = document.getElementById('otpSentPhoneTarget');
    if (phoneTargetEl) phoneTargetEl.textContent = targetAccount.ownerNumber ? `+91 ${targetAccount.ownerNumber}` : inputVal;

    const demoOtpEl = document.getElementById('demoOtpDisplay');
    if (demoOtpEl) demoOtpEl.textContent = generatedOtp;

    document.getElementById('recoveryStep1').style.display = 'none';
    document.getElementById('recoveryStep2').style.display = 'block';
    document.getElementById('recoveryStep3').style.display = 'none';

    showToast('info', 'OTP Sent!', `Demo OTP for ${targetAccount.name}: ${generatedOtp}`);
}

function verifyRecoveryOTP() {
    const enteredOtp = document.getElementById('recoveryOtpInput').value.trim();

    if (!enteredOtp || enteredOtp.length !== 6) {
        showToast('warning', 'Invalid OTP', 'Please enter the 6-digit OTP code.');
        return;
    }

    if (enteredOtp !== recoveryState.generatedOtp) {
        showToast('error', 'Incorrect OTP', 'The OTP code you entered is invalid. Please check and try again.');
        return;
    }

    // OTP Verified Successfully!
    recoveryState.verified = true;
    const account = schoolAccounts[recoveryState.schoolCode];

    // Pre-fill Step 3 Reset Form
    const emailInput = document.getElementById('resetNewEmail');
    const phoneInput = document.getElementById('resetNewPhone');
    const passInput = document.getElementById('resetNewPassword');

    if (emailInput) emailInput.value = account.email || '';
    if (phoneInput) phoneInput.value = account.ownerNumber || '';
    if (passInput) passInput.value = '';

    document.getElementById('recoveryStep1').style.display = 'none';
    document.getElementById('recoveryStep2').style.display = 'none';
    document.getElementById('recoveryStep3').style.display = 'block';

    showToast('success', 'OTP Verified!', 'Please enter your new password, email, or mobile number to update.');
}

function handleResetPasswordAndDetails(event) {
    if (event) event.preventDefault();

    if (!recoveryState.verified || !recoveryState.schoolCode || !schoolAccounts[recoveryState.schoolCode]) {
        showToast('error', 'Security Error', 'OTP verification session expired. Please restart recovery.');
        return false;
    }

    const newPassword = document.getElementById('resetNewPassword').value;
    const newEmail = document.getElementById('resetNewEmail').value.trim();
    const newPhone = document.getElementById('resetNewPhone').value.trim();

    if (!newPassword || !newEmail || !newPhone) {
        showToast('warning', 'Missing Details', 'Please fill in new password, email and 10-digit mobile number.');
        return false;
    }

    const code = recoveryState.schoolCode;

    // Update Local Storage Store
    schoolAccounts[code].password = newPassword;
    schoolAccounts[code].email = newEmail;
    schoolAccounts[code].ownerNumber = newPhone;

    localStorage.setItem('schoolnext_accounts', JSON.stringify(schoolAccounts));

    // Update Backend Database API
    fetch(`${API_BASE_URL}/auth/school/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: code,
            name: schoolAccounts[code].name,
            email: newEmail,
            ownerNumber: newPhone,
            password: newPassword,
            logo: schoolAccounts[code].logo || ''
        })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            console.log('✅ Credentials updated on Neon PostgreSQL DB!');
        }
    }).catch(err => console.error('Reset password API error:', err));

    closeForgotPasswordModal();

    // Auto fill login code & password
    const loginCodeEl = document.getElementById('loginSchoolCode');
    const loginPassEl = document.getElementById('loginPassword');
    if (loginCodeEl) loginCodeEl.value = code;
    if (loginPassEl) loginPassEl.value = newPassword;

    switchAuthTab('login');

    showModal('success', 'Password & Credentials Updated!', `School credentials for Code "${code}" have been reset successfully. You can now login with your new password.`);
    showToast('success', 'Reset Complete', 'Password & contact details updated successfully.');

    return false;
}

// ============ WELCOME SPLASH ANIMATION ============
function showWelcomeSplash(school) {
    const welcomeOverlay = document.getElementById('welcomeOverlay');
    if (!welcomeOverlay) return;

    const welcomeSchoolLogo = document.getElementById('welcomeSchoolLogo');
    const welcomeSchoolName = document.getElementById('welcomeSchoolName');
    const welcomeSchoolBadge = document.getElementById('welcomeSchoolBadge');
    const welcomeText = document.getElementById('welcomeText');

    if (welcomeSchoolLogo) {
        if (school.logo) {
            welcomeSchoolLogo.innerHTML = `<img src="${school.logo}" alt="${school.name}" class="header-logo-img">`;
        } else {
            welcomeSchoolLogo.innerHTML = `<i class="fas fa-university"></i>`;
        }
    }

    if (welcomeSchoolName) {
        welcomeSchoolName.textContent = school.name;
    }

    if (welcomeSchoolBadge) {
        welcomeSchoolBadge.textContent = `School Code: ${school.code}`;
    }

    if (welcomeText) {
        welcomeText.innerHTML = `Welcome to <strong>School Next</strong>! We are here to help and manage your fee system.`;
    }

    welcomeOverlay.style.display = 'flex';

    // Auto close after 3.8 seconds if user doesn't click launch button
    if (window.welcomeTimer) clearTimeout(window.welcomeTimer);
    window.welcomeTimer = setTimeout(() => {
        closeWelcomeSplash();
    }, 3800);
}

function closeWelcomeSplash() {
    const welcomeOverlay = document.getElementById('welcomeOverlay');
    if (welcomeOverlay) {
        welcomeOverlay.style.animation = 'fadeOut 0.4s ease forwards';
        setTimeout(() => {
            welcomeOverlay.style.display = 'none';
            welcomeOverlay.style.animation = '';
        }, 400);
    }
}

// ============ PRINTABLE FEE RECEIPT GENERATOR ============
function generateAndPrintReceipt(studentId) {
    const targetId = studentId || currentSearchId;

    if (!targetId || !studentsDB[targetId]) {
        showToast('error', 'No Student Selected', 'Please search for a student first to print receipt.');
        return;
    }

    const student = studentsDB[targetId];
    const school = (activeSchoolCode && schoolAccounts[activeSchoolCode])
        ? schoolAccounts[activeSchoolCode]
        : { name: 'School Next Pro', code: 'SCH001', email: 'support@schoolnext.com', ownerNumber: '-' };

    // School Header Info
    const logoEl = document.getElementById('receiptSchoolLogo');
    if (logoEl) {
        if (school.logo) {
            logoEl.innerHTML = `<img src="${school.logo}" alt="${school.name}" class="header-logo-img">`;
        } else {
            logoEl.innerHTML = `<i class="fas fa-university" style="font-size:1.8rem;color:var(--accent-primary);"></i>`;
        }
    }

    const nameEl = document.getElementById('receiptSchoolName');
    if (nameEl) nameEl.textContent = school.name;

    const subEl = document.getElementById('receiptSchoolSub');
    if (subEl) subEl.textContent = `School Code: ${school.code} | Official Fee Receipt`;

    const contactEl = document.getElementById('receiptSchoolContact');
    if (contactEl) contactEl.textContent = `Email: ${school.email || '-'} | Phone: ${school.ownerNumber || '-'}`;

    // Meta Info
    const today = new Date();
    const dateEl = document.getElementById('receiptDate');
    if (dateEl) dateEl.textContent = 'Date: ' + today.toLocaleDateString('en-IN');

    const noEl = document.getElementById('receiptNo');
    if (noEl) noEl.textContent = 'Receipt No: REC-' + today.getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

    // Student Information
    const stdIdEl = document.getElementById('receiptStudentId');
    if (stdIdEl) stdIdEl.textContent = student.id;

    const stdNameEl = document.getElementById('receiptStudentName');
    if (stdNameEl) stdNameEl.textContent = student.name;

    const stdFatherEl = document.getElementById('receiptFatherName');
    if (stdFatherEl) stdFatherEl.textContent = student.fatherName;

    const stdClassEl = document.getElementById('receiptClassSection');
    if (stdClassEl) stdClassEl.textContent = `Class ${student.class} - Section ${student.section}`;

    const stdBusEl = document.getElementById('receiptBusNumber');
    if (stdBusEl) stdBusEl.textContent = student.busNumber ? `Bus No. ${student.busNumber} (${student.busDistance || '-'} KM)` : 'N/A (No Bus)';

    const admMonth = student.admissionMonth || 'Admission Month';
    const admYear = student.admissionYear || today.getFullYear();
    const stdAdmEl = document.getElementById('receiptAdmissionMonth');
    if (stdAdmEl) stdAdmEl.textContent = `${admMonth} ${admYear}`;

    // Fee breakdown
    const tuitionFeeVal = Number(student.tuitionFee || 0);
    const busFeeVal = Number(student.busFee || 0);
    const monthlyFeeVal = Number(student.monthlyFee || 0);

    const tuitionEl = document.getElementById('receiptTuitionFee');
    if (tuitionEl) tuitionEl.textContent = '₹' + tuitionFeeVal.toLocaleString('en-IN');

    const busFeeEl = document.getElementById('receiptBusFee');
    if (busFeeEl) busFeeEl.textContent = '₹' + busFeeVal.toLocaleString('en-IN');

    const monthlyTotalEl = document.getElementById('receiptMonthlyTotal');
    if (monthlyTotalEl) monthlyTotalEl.textContent = '₹' + monthlyFeeVal.toLocaleString('en-IN');

    // Calculate Month-wise Payment Breakdown & Totals
    let breakdownHTML = '';
    let grossTotalSum = 0;
    let paidTotalSum = 0;
    let dueTotalSum = 0;

    // 1. Admission & Initial Fee Row
    const admTotal = Number(student.totalAtAdmission || 0);
    const admPaid = Number(student.paidAtAdmission || 0);
    const admDue = Number(student.remainingDue || 0);

    grossTotalSum += admTotal;
    paidTotalSum += admPaid;
    dueTotalSum += admDue;

    const admDueStyle = admDue > 0 ? 'color:#ef4444;font-weight:700;' : 'color:#64748b;';
    breakdownHTML += `<tr>
        <td><strong>Admission & Initial Fee (${admMonth} ${admYear})</strong></td>
        <td style="text-align:right;">₹${admTotal.toLocaleString('en-IN')}</td>
        <td style="text-align:right;color:#059669;font-weight:600;">₹${admPaid.toLocaleString('en-IN')}</td>
        <td style="text-align:right;${admDueStyle}">${admDue > 0 ? '₹' + admDue.toLocaleString('en-IN') : '₹0 (Paid)'}</td>
    </tr>`;

    // 2. Monthly Payments Rows
    if (student.payments && student.payments.length > 0) {
        student.payments.forEach(p => {
            const pTotal = Number(p.totalFee || 0);
            const pPaid = Number(p.paid || 0);
            const pDue = Number(p.due || 0);

            grossTotalSum += pTotal;
            paidTotalSum += pPaid;
            dueTotalSum += pDue;

            const dueStyle = pDue > 0 ? 'color:#ef4444;font-weight:700;' : 'color:#64748b;';
            breakdownHTML += `<tr>
                <td>Monthly Fee — ${p.month} ${p.year}</td>
                <td style="text-align:right;">₹${pTotal.toLocaleString('en-IN')}</td>
                <td style="text-align:right;color:#059669;font-weight:600;">₹${pPaid.toLocaleString('en-IN')}</td>
                <td style="text-align:right;${dueStyle}">${pDue > 0 ? '₹' + pDue.toLocaleString('en-IN') : '₹0 (Paid)'}</td>
            </tr>`;
        });
    }

    const tbody = document.getElementById('receiptMonthBreakdownBody');
    if (tbody) tbody.innerHTML = breakdownHTML;

    // 3. Calculation Summary Box
    const grossEl = document.getElementById('receiptGrossTotal');
    if (grossEl) grossEl.textContent = '₹' + grossTotalSum.toLocaleString('en-IN');

    const paidSumEl = document.getElementById('receiptTotalPaidSum');
    if (paidSumEl) paidSumEl.textContent = '- ₹' + paidTotalSum.toLocaleString('en-IN');

    const netDueEl = document.getElementById('receiptNetDueBalance');
    if (netDueEl) {
        if (dueTotalSum > 0) {
            netDueEl.textContent = `= ₹${dueTotalSum.toLocaleString('en-IN')} (Pending Due ⚠️)`;
            netDueEl.style.color = '#ef4444';
        } else {
            netDueEl.textContent = '= ₹0 (No Due - Fully Paid 🎉)';
            netDueEl.style.color = '#059669';
        }
    }

    const receiptOverlay = document.getElementById('receiptOverlay');
    if (receiptOverlay) receiptOverlay.style.display = 'flex';
}

function closeReceiptModal() {
    const receiptOverlay = document.getElementById('receiptOverlay');
    if (receiptOverlay) receiptOverlay.style.display = 'none';
}

/* ============ BUILD RECEIPT HTML (used by both Print & PDF) ============ */
function buildReceiptHTML(student, school) {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN');
    const receiptNo = 'REC-' + today.getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

    const admMonth = student.admissionMonth || '—';
    const admYear  = student.admissionYear  || today.getFullYear();

    const tuitionFee = Number(student.tuitionFee || 0);
    const busFee     = Number(student.busFee     || 0);
    const monthlyFee = Number(student.monthlyFee || 0);

    // ── Month-wise breakdown rows ──
    let rowsHTML = '';
    let grossTotal = 0, paidTotal = 0, dueTotal = 0;

    // Admission row
    const aTotal = Number(student.totalAtAdmission || 0);
    const aPaid  = Number(student.paidAtAdmission  || 0);
    const aDue   = Number(student.remainingDue      || 0);
    grossTotal += aTotal; paidTotal += aPaid; dueTotal += aDue;
    const aDueBg  = aDue > 0 ? '#fff0f0' : '#f0fff8';
    const aDueClr = aDue > 0 ? '#c0392b' : '#1a7a4a';
    rowsHTML += `<tr style="background:#f5faff;">
      <td style="padding:5px 8px;font-weight:700;font-size:0.78rem;">
        🏫 Admission &amp; Initial Fee<br><small style="font-weight:400;color:#555;">${admMonth} ${admYear}</small>
      </td>
      <td style="text-align:right;padding:5px 8px;">₹${aTotal.toLocaleString('en-IN')}</td>
      <td style="text-align:right;padding:5px 8px;color:#1a7a4a;font-weight:700;">₹${aPaid.toLocaleString('en-IN')}</td>
      <td style="text-align:right;padding:5px 8px;background:${aDueBg};color:${aDueClr};font-weight:700;border-radius:4px;">
        ${aDue > 0 ? '⚠️ ₹' + aDue.toLocaleString('en-IN') : '✅ Paid'}
      </td>
    </tr>`;

    // Monthly rows
    if (student.payments && student.payments.length > 0) {
        student.payments.forEach((p, i) => {
            const pTotal = Number(p.totalFee || 0);
            const pPaid  = Number(p.paid     || 0);
            const pDue   = Number(p.due      || 0);
            grossTotal += pTotal; paidTotal += pPaid; dueTotal += pDue;
            const bg    = i % 2 === 0 ? '#ffffff' : '#f9f9f9';
            const dueBg = pDue > 0 ? '#fff0f0' : '#f0fff8';
            const dueClr = pDue > 0 ? '#c0392b' : '#1a7a4a';
            rowsHTML += `<tr style="background:${bg};">
              <td style="padding:5px 8px;font-size:0.78rem;">📅 Monthly — ${p.month} ${p.year}</td>
              <td style="text-align:right;padding:5px 8px;">₹${pTotal.toLocaleString('en-IN')}</td>
              <td style="text-align:right;padding:5px 8px;color:#1a7a4a;font-weight:700;">₹${pPaid.toLocaleString('en-IN')}</td>
              <td style="text-align:right;padding:5px 8px;background:${dueBg};color:${dueClr};font-weight:700;border-radius:4px;">
                ${pDue > 0 ? '⚠️ ₹' + pDue.toLocaleString('en-IN') : '✅ Paid'}
              </td>
            </tr>`;
        });
    }

    const logoHTML = school.logo
        ? `<img src="${school.logo}" alt="${school.name}" style="width:52px;height:52px;object-fit:contain;border-radius:8px;">`
        : `<span style="font-size:1.8rem;">🏫</span>`;

    const netDueStyle = dueTotal > 0 ? 'color:#c0392b;font-weight:800;' : 'color:#1a7a4a;font-weight:800;';
    const netDueText  = dueTotal > 0
        ? `= ₹${dueTotal.toLocaleString('en-IN')} PENDING ⚠️`
        : '= ₹0 (Fully Paid ✅)';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Fee Receipt — ${student.name}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: A4 portrait; margin: 12mm 14mm 12mm 14mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; background:#fff; }
  
  /* ── Header ── */
  .rh { display:flex; align-items:center; gap:12px; padding-bottom:10px; border-bottom:3px solid #008b8b; margin-bottom:8px; }
  .rh-logo { width:52px; height:52px; background:linear-gradient(135deg,#008b8b,#20b2aa); border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }
  .rh-info h1 { font-size:15pt; font-weight:800; color:#008b8b; line-height:1.2; }
  .rh-info p  { font-size:8pt; color:#555; margin-top:1px; }
  .rh-meta { margin-left:auto; text-align:right; }
  .rh-meta .rec-tag { background:#008b8b; color:#fff; padding:3px 9px; border-radius:4px; font-size:8pt; font-weight:700; letter-spacing:1px; text-transform:uppercase; display:inline-block; margin-bottom:4px; }
  .rh-meta small { display:block; font-size:8pt; color:#666; }

  /* ── Student Info Grid ── */
  .si { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; margin-bottom:8px; }
  .si-item { background:#f0fafa; border:1px solid #b3e0e0; border-radius:5px; padding:5px 8px; }
  .si-item .lbl { font-size:7pt; color:#008b8b; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:1px; }
  .si-item .val { font-size:9pt; font-weight:700; color:#0b1a1a; line-height:1.3; }
  .si-full { grid-column: 1 / -1; }

  /* ── Fee Rate Bar ── */
  .fee-bar { display:flex; gap:8px; justify-content:space-between; background:#e6f7f7; border:1px solid #99d9d9; border-radius:5px; padding:5px 10px; margin-bottom:8px; font-size:8.5pt; }
  .fee-bar span { color:#005b5b; }
  .fee-bar strong { color:#008b8b; }

  /* ── Table ── */
  .sec-title { font-size:9pt; font-weight:800; color:#008b8b; margin-bottom:5px; border-left:3px solid #008b8b; padding-left:7px; text-transform:uppercase; letter-spacing:0.5px; }
  table { width:100%; border-collapse:collapse; margin-bottom:8px; font-size:8.5pt; }
  thead th { background:#008b8b; color:#e6f9f9; padding:6px 8px; font-size:7.5pt; text-transform:uppercase; letter-spacing:0.6px; font-weight:800; }
  thead th:first-child { border-radius:4px 0 0 0; text-align:left; }
  thead th:last-child  { border-radius:0 4px 0 0; text-align:right; }
  thead th:not(:first-child) { text-align:right; }
  tbody tr:nth-child(even) td { background:#f5f5f5; }
  tbody td { padding:5px 8px; border-bottom:1px solid #e8e8e8; vertical-align:top; }

  /* ── Summary ── */
  .summary { background:#f0fafa; border:1px solid #99d9d9; border-radius:6px; padding:8px 12px; margin-bottom:8px; }
  .sum-row { display:flex; justify-content:space-between; font-size:9pt; padding:3px 0; border-bottom:1px solid #d4eeee; }
  .sum-row:last-child { border-bottom:none; padding-top:5px; margin-top:2px; font-size:10pt; }
  .sum-row span { color:#333; }

  /* ── Footer ── */
  .rf { display:flex; justify-content:space-between; align-items:flex-end; border-top:2px solid #008b8b; padding-top:8px; margin-top:4px; }
  .rf .sign { text-align:center; }
  .rf .sign-line { width:130px; height:1px; background:#008b8b; margin:0 auto 4px; }
  .rf small { font-size:7pt; color:#777; font-style:italic; }
  .rf .comp-note { font-size:7pt; color:#aaa; font-style:italic; text-align:right; max-width:260px; }
  
  /* ── Print ── */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display:none !important; }
  }
  .no-print { text-align:center; padding:14px; display:flex; gap:10px; justify-content:center; }
  .btn-p { background:#008b8b; color:#fff; border:none; padding:9px 22px; border-radius:7px; font-size:10pt; font-weight:700; cursor:pointer; }
  .btn-c { background:#e0e0e0; color:#333; border:none; padding:9px 22px; border-radius:7px; font-size:10pt; font-weight:700; cursor:pointer; }
</style>
</head>
<body>

<div class="no-print">
  <button class="btn-p" onclick="window.print()">🖨️ Print Receipt</button>
  <button class="btn-c" onclick="window.close()">✕ Close</button>
</div>

<!-- ── RECEIPT START ── -->
<div class="rh">
  <div class="rh-logo">${logoHTML}</div>
  <div class="rh-info">
    <h1>${school.name}</h1>
    <p>School Code: ${school.code} &nbsp;|&nbsp; Official Fee Receipt</p>
    <p>${school.email || ''} &nbsp;|&nbsp; ${school.ownerNumber || ''}</p>
  </div>
  <div class="rh-meta">
    <div class="rec-tag">📄 Fee Receipt</div>
    <small>Date: ${dateStr}</small>
    <small>Receipt No: ${receiptNo}</small>
  </div>
</div>

<!-- Student Info -->
<div class="si">
  <div class="si-item">
    <span class="lbl">Student ID</span>
    <span class="val">${student.id}</span>
  </div>
  <div class="si-item">
    <span class="lbl">Student Name</span>
    <span class="val">${student.name}</span>
  </div>
  <div class="si-item">
    <span class="lbl">Father's Name</span>
    <span class="val">${student.fatherName || '—'}</span>
  </div>
  <div class="si-item">
    <span class="lbl">Mother's Name</span>
    <span class="val">${student.motherName || '—'}</span>
  </div>
  <div class="si-item">
    <span class="lbl">Class &amp; Section</span>
    <span class="val">Class ${student.class} — Section ${student.section}</span>
  </div>
  <div class="si-item">
    <span class="lbl">Bus Number</span>
    <span class="val">${student.busNumber ? 'Bus No. ' + student.busNumber + (student.busDistance ? ' (' + student.busDistance + ' KM)' : '') : 'No Bus / Self'}</span>
  </div>
  <div class="si-item">
    <span class="lbl">Mobile</span>
    <span class="val">${student.mobile || '—'}</span>
  </div>
  <div class="si-item">
    <span class="lbl">Admission Month</span>
    <span class="val">${admMonth} ${admYear}</span>
  </div>
  <div class="si-item si-full">
    <span class="lbl">Address</span>
    <span class="val">${student.address || '—'}</span>
  </div>
</div>

<!-- Fee Rate Bar -->
<div class="fee-bar">
  <span>Tuition Fee: <strong>₹${tuitionFee.toLocaleString('en-IN')}/mo</strong></span>
  <span>Bus Fee: <strong>₹${busFee.toLocaleString('en-IN')}/mo</strong></span>
  <span>Monthly Total: <strong>₹${monthlyFee.toLocaleString('en-IN')}/mo</strong></span>
</div>

<!-- Month-wise Breakdown -->
<div class="sec-title">Month-wise Payment &amp; Due Breakdown</div>
<table>
  <thead>
    <tr>
      <th>Month / Particular</th>
      <th>Total Fee</th>
      <th>Amount Paid</th>
      <th>Due / Status</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHTML}
  </tbody>
</table>

<!-- Summary Box -->
<div class="summary">
  <div class="sum-row"><span>Total Gross Fees (Admission + Monthly):</span><strong>₹${grossTotal.toLocaleString('en-IN')}</strong></div>
  <div class="sum-row" style="color:#1a7a4a;"><span>Total Amount Paid (-):</span><strong>− ₹${paidTotal.toLocaleString('en-IN')}</strong></div>
  <div class="sum-row"><span>Net Remaining Due Balance (=):</span><strong style="${netDueStyle}">${netDueText}</strong></div>
</div>

<!-- Footer -->
<div class="rf">
  <div class="sign">
    <div class="sign-line"></div>
    <small>Authorized Signatory / Accountant</small>
  </div>
  <div class="comp-note">This is an official computer-generated receipt from School Next Pro. No signature required if digitally verified.</div>
</div>

</body>
</html>`;
}

/* ============ PRINT RECEIPT IN ISOLATED POPUP ============ */
function printReceiptWindow() {
    const targetId = currentSearchId;
    if (!targetId || !studentsDB[targetId]) {
        showToast('error', 'No Student', 'Please search for a student first.');
        return;
    }
    const student = studentsDB[targetId];
    const school  = (activeSchoolCode && schoolAccounts[activeSchoolCode])
        ? schoolAccounts[activeSchoolCode]
        : { name: 'School Next Pro', code: 'SCH001', email: '', ownerNumber: '' };

    const html = buildReceiptHTML(student, school);

    const popup = window.open('', '_blank', 'width=820,height=1100,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no');
    if (!popup) {
        showToast('warning', 'Popup Blocked', 'Please allow popups for this site to print receipts.');
        return;
    }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    // Auto-trigger print after page loads
    popup.onload = () => { popup.focus(); popup.print(); };
}

/* ============ DOWNLOAD PDF ============ */
function downloadReceiptPDF() {
    const targetId = currentSearchId;
    if (!targetId || !studentsDB[targetId]) {
        showToast('error', 'No Student', 'Please search for a student first.');
        return;
    }
    const element = document.getElementById('printableReceiptArea');
    if (!element) return;

    const student  = studentsDB[targetId];
    const cleanName = (student.name || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
    const filename  = `${cleanName}_Fee_Receipt_${student.id}.pdf`;

    showToast('info', 'Generating PDF...', 'Please wait while your PDF receipt is created.');

    const opt = {
        margin:      [0.15, 0.2, 0.15, 0.2],
        filename:    filename,
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF:       { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(element).save().then(() => {
            showToast('success', 'PDF Ready!', `Downloaded ${filename}`);
        }).catch(err => {
            console.error('PDF Error:', err);
            printReceiptWindow();
        });
    } else {
        printReceiptWindow();
    }
}