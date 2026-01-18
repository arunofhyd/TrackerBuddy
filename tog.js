import { doc, onSnapshot, setDoc, updateDoc, deleteField } from './services/firebase.js';

const COLLECTIONS = { USERS: 'users' };

let state = {
    viewDate: new Date(),
    lastCalculatedDecimal: 0.0,
    storedData: {},
    dayVisibility: [true, true, true, true, true, true, true], // Mon-Sun
    userId: null,
    db: null,
    auth: null,
    unsubscribe: null,
    isInitialized: false
};

const STORAGE_KEY = 'tog_tracker_v1';
const DOM = {};

export function initTog(userId, db, auth) {
    state.userId = userId;
    state.db = db;
    state.auth = auth;

    cacheDOM();

    if (!state.isInitialized) {
        bindEvents();
        state.isInitialized = true;
    }

    // Load local data first if available (for guest mode or offline)
    const local = localStorage.getItem(STORAGE_KEY);
    if(local) {
        try {
            state.storedData = JSON.parse(local);
            if(state.storedData._dayVisibility) state.dayVisibility = state.storedData._dayVisibility;
        } catch(e) { console.error(e); }
    }

    if (userId && db) {
        subscribeToData(userId);
    } else {
        renderHeader(null); // Ensure guest avatar
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
}

function bindEvents() {
    if(DOM.c1_h) [DOM.c1_h, DOM.c1_m].forEach(el => el.addEventListener('input', calcTime));
    if(DOM.c2_d) DOM.c2_d.addEventListener('input', calcDecimal);

    document.getElementById('tog-prev-month-btn')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('tog-next-month-btn')?.addEventListener('click', () => changeMonth(1));
    document.getElementById('tog-today-btn')?.addEventListener('click', goToToday);

    // Month Picker
    DOM.monthLabel.addEventListener('click', () => {
        if (window.openSharedMonthPicker) {
            window.openSharedMonthPicker(state.viewDate, (newDate) => {
                state.viewDate = newDate;
                renderCalendar();
            });
        }
    });

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

    DOM.resetBtn?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('tog-reset-request'));
        closeDropdown();
    });

    // Make window functions for inline HTML clicks (legacy support)
    window.tog_insertValue = insertValue;
    window.tog_handleInputChange = handleInputChange;
}

function subscribeToData(userId) {
    if(state.unsubscribe) state.unsubscribe();
    if(!state.db) return;

    const userRef = doc(state.db, COLLECTIONS.USERS, userId);
    state.unsubscribe = onSnapshot(userRef, (docSnap) => {
        if(docSnap.exists()) {
            const data = docSnap.data();
            const cloudTogData = data.togData || {};

            // Flatten nested structure (year/month/data)
            let flatCloudData = {};
            for (const key in cloudTogData) {
                // Keep root properties like _dayVisibility or legacy flat keys
                if (typeof cloudTogData[key] !== 'object' || Array.isArray(cloudTogData[key]) || key.startsWith('_')) {
                    flatCloudData[key] = cloudTogData[key];
                } else {
                    // Assume it's a year map -> month map -> data
                    const yearData = cloudTogData[key];
                    for (const monthKey in yearData) {
                        const monthData = yearData[monthKey];
                        if (typeof monthData === 'object') {
                            for (const dateKey in monthData) {
                                flatCloudData[dateKey] = monthData[dateKey];
                            }
                        }
                    }
                }
            }

            // Merge strategy: Cloud wins
            state.storedData = { ...state.storedData, ...flatCloudData };

            if(state.storedData._dayVisibility) {
                state.dayVisibility = state.storedData._dayVisibility;
            }

            // Update local storage for redundancy/offline fallback
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.storedData));

            // If data doesn't have email, try to get it from Auth
            if (!data.email && state.auth && state.auth.currentUser) {
                data.email = state.auth.currentUser.email;
            }
            // If data doesn't have uid, add it
            if (!data.uid) {
                data.uid = userId;
            }

            renderHeader(data);

            renderCalendar();
        } else {
            // Document doesn't exist yet, but user is logged in
            if (state.auth && state.auth.currentUser) {
                renderHeader({ email: state.auth.currentUser.email, uid: state.auth.currentUser.uid });
            }
        }
    });
}

function renderHeader(user) {
    // Fallback if user is null (Guest) or if user object is incomplete
    const email = user ? (user.email || (state.auth && state.auth.currentUser ? state.auth.currentUser.email : "Guest Session")) : "Guest Session";
    const displayUser = user || (state.auth && state.auth.currentUser ? { email: state.auth.currentUser.email, uid: state.auth.currentUser.uid } : null);

    if(DOM.userEmail) DOM.userEmail.innerText = email;
    if(DOM.avatarBtn) DOM.avatarBtn.innerHTML = getAvatarContent(displayUser);
}

function getAvatarContent(user) {
    if (!user) {
        // Guest - Simple user icon SVG
        return `<div style="background-color: #0071e3;" class="w-full h-full flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>`;
    }

    const email = user.email || "?";
    const letter = email.charAt(0).toUpperCase();

    // Generate deterministic color based on UID (reusing logic from prompt)
    const uid = user.uid || email;
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c1 = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    const c2 = ((hash >> 4) & 0x00FFFFFF).toString(16).toUpperCase();
    const color1 = "#" + "00000".substring(0, 6 - c1.length) + c1;
    const color2 = "#" + "00000".substring(0, 6 - c2.length) + c2;

    return `<div style="background-color: #0071e3;" class="w-full h-full flex items-center justify-center text-white font-bold text-sm shadow-inner">
        ${letter}
    </div>`;
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

    if(state.userId && state.db) {
        const userRef = doc(state.db, COLLECTIONS.USERS, state.userId);

        let fieldPath;
        if (key.startsWith('_')) {
             fieldPath = `togData.${key}`;
        } else {
             // Parse date from key
             let datePart = key.startsWith('bonus_') ? key.replace('bonus_', '') : key;
             const [year, month] = datePart.split('-');

             if (!year || !month) {
                 fieldPath = `togData.${key}`;
             } else {
                 fieldPath = `togData.${year}.${month}.${key}`;
             }
        }

        try {
            if(value === "") {
                await updateDoc(userRef, { [fieldPath]: deleteField() });
            } else {
                await updateDoc(userRef, { [fieldPath]: value });
            }
        } catch(e) {
            console.warn("Update failed, trying set/merge", e);

            // Reconstruct nested object for setDoc
            const payload = { togData: {} };
            const parts = fieldPath.split('.'); // e.g. ["togData", "2023", "10", "key"]

            let current = payload.togData;
            for (let i = 1; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!current[part]) current[part] = {};
                current = current[part];
            }
            const lastPart = parts[parts.length - 1];

            if (value === "") {
                current[lastPart] = deleteField();
            } else {
                current[lastPart] = value;
            }

            await setDoc(userRef, payload, { merge: true });
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
            ? "bg-blue-100 text-blue-700 border-blue-200 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
            : "bg-slate-50 text-slate-300 border-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-700";

        // Added flex-shrink-0 to prevent squeezing
        btn.className = `flex-shrink-0 flex items-center justify-center w-8 h-8 rounded text-[10px] font-bold border transition-colors ${activeClass}`;
        btn.onclick = () => toggleDay(idx);
        btn.innerText = name.charAt(0);
        DOM.dayToggles.appendChild(btn);
    });

    // 2. Grid Setup
    const visibleCount = state.dayVisibility.filter(Boolean).length;
    const gridCols = visibleCount + 1;
    const style = `grid-template-columns: repeat(${gridCols}, minmax(100px, 1fr)); min-width: 900px;`;
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
                card.className = `day-card min-h-[100px] border ${cardBorder} ${cardBg} ${baseOpacity}`;
                // Restored structure exactly from prompt source
                card.innerHTML = `
                    <div class="day-header">
                        <span class="${dayText}">${currentLoopDate.getDate()}</span>
                        <button onclick="window.tog_insertValue('${dateKey}', 'main')" class="icon-btn text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800" title="Insert Memory">
                            <!-- lucide arrow-down-to-line replacement -->
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line w-3 h-3"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>
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
                            <button onclick="window.tog_insertValue('${bonusKey}', 'bonus')" class="icon-btn text-yellow-500 hover:text-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 mr-1" title="Insert Memory">
                                <!-- lucide plus replacement -->
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus w-3 h-3"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
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
        statCard.className = "stats-card min-h-[100px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800";
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

function insertValue(key, type) {
    if(state.lastCalculatedDecimal == 0) { showToast("Calculate first!", 'error'); return; }
    saveData(key, state.lastCalculatedDecimal);
    showToast("Inserted!", 'success');
}

function changeMonth(offset) {
    state.viewDate.setMonth(state.viewDate.getMonth() + offset);
    renderCalendar();
}

function goToToday() { state.viewDate = new Date(); renderCalendar(); }

function showToast(msg, type = 'info') {
    if (window.showAppMessage) {
        window.showAppMessage(msg, type);
    } else {
        // Fallback if not available
        console.log("Toast:", msg);
    }
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
            showToast("Restored Successfully", "success");
        } catch(err) {
            console.error(err);
            showToast("Invalid JSON File", "error");
        }
    };
    reader.readAsText(file);
    closeDropdown();
    e.target.value = ""; // Reset input
}

export async function performReset(userId, db) {
    state.storedData = { _dayVisibility: [true,true,true,true,true,true,true] };
    state.dayVisibility = [true,true,true,true,true,true,true];
    localStorage.removeItem(STORAGE_KEY);

    // Use passed context or fallback to state
    const targetUserId = userId || state.userId;
    const targetDb = db || state.db;

    if(targetUserId && targetDb) {
         const userRef = doc(targetDb, COLLECTIONS.USERS, targetUserId);
         await updateDoc(userRef, { togData: deleteField() });
    }
    renderCalendar();
    showToast("Reset Complete", "success");
}
