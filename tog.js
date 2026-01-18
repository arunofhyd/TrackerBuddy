import { db, doc, onSnapshot, setDoc, updateDoc, deleteField } from './services/firebase.js';
import { COLLECTIONS } from './constants.js';

let state = {
    viewDate: new Date(),
    lastCalculatedDecimal: 0.0,
    storedData: {},
    dayVisibility: [true, true, true, true, true, true, true], // Mon-Sun
    userId: null,
    unsubscribe: null
};

const STORAGE_KEY = 'tog_tracker_v1';
const DOM = {};

export function initTog(userId) {
    state.userId = userId;
    cacheDOM();
    bindEvents();

    // Load local data first if available (for guest mode or offline)
    const local = localStorage.getItem(STORAGE_KEY);
    if(local) {
        try {
            state.storedData = JSON.parse(local);
            if(state.storedData._dayVisibility) state.dayVisibility = state.storedData._dayVisibility;
        } catch(e) { console.error(e); }
    }

    if (userId) {
        subscribeToData(userId);
    } else {
        renderCalendar();
    }
}

function cacheDOM() {
    DOM.c1_h = document.getElementById('tog-c1_h');
    DOM.c1_m = document.getElementById('tog-c1_m');
    DOM.c2_d = document.getElementById('tog-c2_d');
    DOM.globalMemory = document.getElementById('tog-globalMemory');
    DOM.resDecimal = document.getElementById('tog-res_decimal');
    DOM.resTime = document.getElementById('tog-res_time');

    DOM.monthLabel = document.getElementById('tog-monthLabel');
    DOM.dayToggles = document.getElementById('tog-dayToggles');
    DOM.headerRow = document.getElementById('tog-headerRow');
    DOM.calendarGrid = document.getElementById('tog-calendarGrid');
    DOM.monthTotal = document.getElementById('tog-monthTotal');
    DOM.monthAvg = document.getElementById('tog-monthAvg');

    DOM.avatarBtn = document.getElementById('tog-user-avatar-btn');
    DOM.dropdown = document.getElementById('tog-user-dropdown');
    DOM.menuContainer = document.getElementById('tog-user-menu-container');
    DOM.userEmail = document.getElementById('tog-menu-user-email');

    DOM.backupBtn = document.getElementById('tog-backup-btn');
    DOM.restoreBtn = document.getElementById('tog-restore-btn');
    DOM.resetBtn = document.getElementById('tog-reset-btn');
    DOM.restoreInput = document.getElementById('tog-restore-input');
    DOM.toast = document.getElementById('tog-toast');
}

function bindEvents() {
    if(DOM.c1_h) [DOM.c1_h, DOM.c1_m].forEach(el => el.addEventListener('input', calcTime));
    if(DOM.c2_d) DOM.c2_d.addEventListener('input', calcDecimal);

    document.getElementById('tog-prev-month-btn')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('tog-next-month-btn')?.addEventListener('click', () => changeMonth(1));
    document.getElementById('tog-today-btn')?.addEventListener('click', goToToday);

    // Avatar Menu
    if(DOM.avatarBtn) {
        DOM.avatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
        });
        document.addEventListener('click', (e) => {
            if(DOM.menuContainer && !DOM.menuContainer.contains(e.target)) {
                closeDropdown();
            }
        });
    }

    DOM.backupBtn?.addEventListener('click', backupData);
    DOM.restoreBtn?.addEventListener('click', () => DOM.restoreInput.click());
    DOM.restoreInput?.addEventListener('change', handleRestore);
    // Reset is handled by app.js hooking into setupSwipeConfirm, but we need to trigger it.
    // We will dispatch a custom event or let app.js attach the listener.
    // For now, let's expose a method or dispatch event.
    DOM.resetBtn?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('tog-reset-request'));
        closeDropdown();
    });

    // Make window functions for inline HTML clicks (legacy support)
    window.tog_pasteValue = pasteValue;
    window.tog_handleInputChange = handleInputChange;
}

function subscribeToData(userId) {
    if(state.unsubscribe) state.unsubscribe();

    const userRef = doc(db, COLLECTIONS.USERS, userId);
    state.unsubscribe = onSnapshot(userRef, (docSnap) => {
        if(docSnap.exists()) {
            const data = docSnap.data();
            const cloudTogData = data.togData || {};

            // Merge strategy: Cloud wins
            state.storedData = { ...state.storedData, ...cloudTogData };

            if(state.storedData._dayVisibility) {
                state.dayVisibility = state.storedData._dayVisibility;
            }

            // Update local storage for redundancy/offline fallback
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.storedData));

            // Update User Email in menu
            if(DOM.userEmail) DOM.userEmail.innerText = data.email || "User";
            if(DOM.avatarBtn) DOM.avatarBtn.innerHTML = getAvatarContent(data.email || "?");

            renderCalendar();
        }
    });
}

function getAvatarContent(email) {
    const letter = email.charAt(0).toUpperCase();
    return letter;
}

// --- Logic ---

function updateMemory(val) {
    state.lastCalculatedDecimal = val;
    if(DOM.globalMemory) DOM.globalMemory.innerText = val;
}

function calcTime() {
    const h = parseFloat(DOM.c1_h.value) || 0;
    const m = parseFloat(DOM.c1_m.value) || 0;
    const decimal = h + (m / 60);
    const fmt = Number.isInteger(decimal) ? decimal : decimal.toFixed(2);
    if(DOM.resDecimal) DOM.resDecimal.innerText = fmt;
    updateMemory(fmt);
}

function calcDecimal() {
    const val = parseFloat(DOM.c2_d.value) || 0;
    const hours = Math.floor(val);
    const minutes = Math.round((val - hours) * 60);
    if(DOM.resTime) DOM.resTime.innerText = (minutes === 60) ? `${hours + 1}h 0m` : `${hours}h ${minutes}m`;
    updateMemory(val);
}

function toggleDay(index) {
    state.dayVisibility[index] = !state.dayVisibility[index];
    saveData('_dayVisibility', state.dayVisibility);
    renderCalendar();
}

async function saveData(key, value) {
    if(value === "") { delete state.storedData[key]; }
    else { state.storedData[key] = value; }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.storedData));

    if(state.userId) {
        const userRef = doc(db, COLLECTIONS.USERS, state.userId);
        const fieldPath = `togData.${key}`;
        try {
            if(value === "") {
                await updateDoc(userRef, { [fieldPath]: deleteField() });
            } else {
                await updateDoc(userRef, { [fieldPath]: value });
            }
        } catch(e) {
            // If update fails (e.g. doc doesn't exist or togData undefined), try set with merge
            console.warn("Update failed, trying set/merge", e);
            const payload = { togData: { [key]: value } };
            if (value === "") delete payload.togData[key]; // Logic gap here for delete with set, but simpler to rely on update mostly
            await setDoc(userRef, { togData: state.storedData }, { merge: true });
        }
    }
}

// --- Calendar ---
function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function formatDateKey(d) { return d.toISOString().split('T')[0]; }

export function renderCalendar(preserveFocus = false) {
    if(!DOM.calendarGrid) return;

    let focusedKey = null;
    let focusedType = null;
    if (preserveFocus && document.activeElement && document.activeElement.dataset.key) {
        focusedKey = document.activeElement.dataset.key;
        focusedType = document.activeElement.dataset.type;
    }

    // 1. Toggles
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    DOM.dayToggles.innerHTML = '';
    dayNames.forEach((name, idx) => {
        const isVisible = state.dayVisibility[idx];
        const btn = document.createElement('button');
        const activeClass = isVisible
            ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
            : "bg-slate-50 text-slate-300 border-slate-100 dark:bg-slate-900 dark:text-slate-700 dark:border-slate-800";

        btn.className = `flex items-center justify-center w-8 h-8 rounded text-[10px] font-bold border transition-colors ${activeClass}`;
        btn.onclick = () => toggleDay(idx);
        btn.innerText = name.charAt(0);
        DOM.dayToggles.appendChild(btn);
    });

    // 2. Grid Setup
    const visibleCount = state.dayVisibility.filter(Boolean).length;
    const gridCols = visibleCount + 1;
    const style = `grid-template-columns: repeat(${gridCols}, minmax(100px, 1fr));`;
    DOM.headerRow.style.cssText = style;
    DOM.calendarGrid.style.cssText = style;

    // 3. Headers
    DOM.headerRow.innerHTML = '';
    dayNames.forEach((name, idx) => {
        if(!state.dayVisibility[idx]) return;
        const div = document.createElement('div');
        div.className = "text-center text-xs font-bold text-slate-400 uppercase py-1";
        div.innerText = name;
        DOM.headerRow.appendChild(div);
    });
    const wkDiv = document.createElement('div');
    wkDiv.className = "text-center text-xs font-bold text-emerald-500 uppercase py-1 border-l border-slate-100 dark:border-slate-800";
    wkDiv.innerText = "Weekly";
    DOM.headerRow.appendChild(wkDiv);

    // 4. Body
    DOM.calendarGrid.innerHTML = '';
    const year = state.viewDate.getFullYear();
    const month = state.viewDate.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    if(DOM.monthLabel) DOM.monthLabel.innerText = `${monthNames[month]} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDate = getMonday(firstDayOfMonth);
    const endDate = new Date(lastDayOfMonth);
    const endDay = endDate.getDay();
    if (endDay !== 0) endDate.setDate(endDate.getDate() + (7 - endDay));

    const todayKey = formatDateKey(new Date());

    let currentLoopDate = new Date(startDate);
    let monthTotal = 0;
    let monthActiveDays = 0;

    while (currentLoopDate <= endDate) {
        let weekTotal = 0;
        let weekActiveDays = 0;
        const weekNodes = [];

        for (let i = 0; i < 7; i++) {
            const dateKey = formatDateKey(currentLoopDate);
            const bonusKey = `bonus_${dateKey}`;
            const rawVal = state.storedData[dateKey];
            const rawBonus = state.storedData[bonusKey];
            const val = rawVal !== undefined ? rawVal : '';
            const bonusVal = rawBonus !== undefined ? rawBonus : '';

            const isToday = dateKey === todayKey;
            const isCurrentMonth = currentLoopDate.getMonth() === month;
            const numVal = parseFloat(val) || 0;
            const numBonus = parseFloat(bonusVal) || 0;
            const dailySum = numVal + numBonus;

            if (state.dayVisibility[i]) {
                weekTotal += dailySum;

                if(isCurrentMonth) {
                    monthTotal += dailySum;
                    if (rawVal !== undefined && rawVal !== "") monthActiveDays++;
                }
                if (rawVal !== undefined && rawVal !== "") {
                    weekActiveDays++;
                }

                const baseOpacity = isCurrentMonth ? 'opacity-100' : 'opacity-40 hover:opacity-100 transition-opacity';
                const cardBg = isToday ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-slate-900';
                const cardBorder = isToday ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700';
                const dayText = isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-400 font-medium';
                const footerBg = 'bg-yellow-50 dark:bg-yellow-900/10';

                const card = document.createElement('div');
                card.className = `day-card border ${cardBorder} ${cardBg} ${baseOpacity}`;
                card.innerHTML = `
                    <div class="day-header">
                        <span class="${dayText}">${currentLoopDate.getDate()}</span>
                        <button onclick="window.tog_pasteValue('${dateKey}')" class="icon-btn text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                            <i class="fas fa-file-download w-3 h-3"></i>
                        </button>
                    </div>
                    <div class="day-body">
                        <input type="number" step="0.1"
                            data-key="${dateKey}" data-type="main"
                            class="input-field bg-transparent border-none font-mono font-bold text-center text-xl w-full text-slate-900 dark:text-white"
                            value="${val}" onchange="window.tog_handleInputChange('${dateKey}', this.value)">
                    </div>
                    <div class="day-footer ${footerBg}">
                        <div class="flex items-center w-full px-1">
                            <button onclick="window.tog_pasteValue('${bonusKey}')" class="icon-btn text-yellow-500 hover:text-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 mr-1">
                                <i class="fas fa-plus w-3 h-3"></i>
                            </button>
                            <input type="number" step="0.1"
                                data-key="${dateKey}" data-type="bonus"
                                class="input-field bg-transparent border-none font-mono font-bold text-center text-xs w-full text-yellow-700 dark:text-yellow-500 placeholder-yellow-200"
                                value="${bonusVal}" placeholder="-" onchange="window.tog_handleInputChange('${bonusKey}', this.value)">
                        </div>
                    </div>
                `;
                weekNodes.push(card);
            }
            currentLoopDate.setDate(currentLoopDate.getDate() + 1);
        }

        weekNodes.forEach(node => DOM.calendarGrid.appendChild(node));

        // Weekly Stats
        const weekAvg = weekActiveDays > 0 ? (weekTotal / weekActiveDays) : 0;
        const statCard = document.createElement('div');
        statCard.className = "stats-card bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700";
        statCard.innerHTML = `
            <div class="flex flex-col gap-2 text-center">
                <div>
                    <span class="text-[9px] uppercase font-bold text-slate-400 block">Wk Avg</span>
                    <span class="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">${weekAvg.toFixed(2)}</span>
                </div>
                <div class="border-t border-slate-200 dark:border-slate-700 pt-1">
                    <span class="text-[9px] uppercase font-bold text-slate-400 block">Total</span>
                    <span class="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">${weekTotal.toFixed(2)}</span>
                </div>
            </div>
        `;
        DOM.calendarGrid.appendChild(statCard);
    }

    // Month Stats
    const monthAvg = monthActiveDays > 0 ? (monthTotal / monthActiveDays) : 0;
    if(DOM.monthTotal) DOM.monthTotal.innerText = monthTotal.toFixed(2);
    if(DOM.monthAvg) DOM.monthAvg.innerText = monthAvg.toFixed(2);

    if (focusedKey) {
        const el = document.querySelector(`input[data-key="${focusedKey}"][data-type="${focusedType}"]`);
        if (el) el.focus();
    }
}

// --- Helpers ---

function handleInputChange(key, value) { saveData(key, value); }

function pasteValue(key) {
    if(state.lastCalculatedDecimal == 0) { showToast("Calculate first!"); return; }
    saveData(key, state.lastCalculatedDecimal);
    showToast("Pasted!");
}

function changeMonth(offset) {
    state.viewDate.setMonth(state.viewDate.getMonth() + offset);
    renderCalendar();
}

function goToToday() { state.viewDate = new Date(); renderCalendar(); }

function showToast(msg) {
    if(!DOM.toast) return;
    DOM.toast.innerText = msg;
    DOM.toast.className = "show";
    setTimeout(() => { DOM.toast.className = ""; }, 2000);
}

// --- Avatar Menu Logic ---

function toggleDropdown() {
    if(!DOM.dropdown) return;
    const isClosed = DOM.dropdown.classList.contains('opacity-0');
    if(isClosed) {
        DOM.dropdown.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
    } else {
        closeDropdown();
    }
}

function closeDropdown() {
    if(DOM.dropdown) DOM.dropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
}

// Backup (JSON)
function backupData() {
    const dataStr = JSON.stringify(state.storedData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TOG_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    closeDropdown();
}

// Restore (JSON)
function handleRestore(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            state.storedData = { ...state.storedData, ...data };
            if(state.storedData._dayVisibility) state.dayVisibility = state.storedData._dayVisibility;

            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.storedData));

            if(state.userId) {
                // Save whole object for restore
                const userRef = doc(db, COLLECTIONS.USERS, state.userId);
                await updateDoc(userRef, { togData: state.storedData });
            }

            renderCalendar();
            showToast("Restored Successfully");
        } catch(err) {
            console.error(err);
            showToast("Invalid JSON File");
        }
    };
    reader.readAsText(file);
    closeDropdown();
    e.target.value = ""; // Reset input
}

export async function performReset() {
    state.storedData = { _dayVisibility: [true,true,true,true,true,true,true] };
    state.dayVisibility = [true,true,true,true,true,true,true];
    localStorage.removeItem(STORAGE_KEY);

    if(state.userId) {
         const userRef = doc(db, COLLECTIONS.USERS, state.userId);
         await updateDoc(userRef, { togData: deleteField() });
    }
    renderCalendar();
    showToast("Reset Complete");
}
