import { doc, setDoc, getDoc, updateDoc, deleteField } from './services/firebase.js';

let db;
let auth;
let currentUser;

// State variables
let viewDate = new Date();
let lastCalculatedDecimal = 0.0;
const STORAGE_KEY = 'tog_tracker_v11';
let storedData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
let dayVisibility = storedData._dayVisibility || [true, true, true, true, true, true, true];

// DOM Elements
let dom = {};

export function initTogTracker(firebaseDb, firebaseAuth) {
    db = firebaseDb;
    auth = firebaseAuth;
    currentUser = auth.currentUser;

    dom = {
        c1_h: document.getElementById('c1_h'),
        c1_m: document.getElementById('c1_m'),
        c2_d: document.getElementById('c2_d'),
        res_decimal: document.getElementById('res_decimal'),
        res_time: document.getElementById('res_time'),
        globalMemory: document.getElementById('globalMemory'),
        monthLabel: document.getElementById('monthLabel'),
        dayToggles: document.getElementById('dayToggles'),
        headerRow: document.getElementById('headerRow'),
        calendarGrid: document.getElementById('calendarGrid'),
        monthTotal: document.getElementById('monthTotal'),
        monthAvg: document.getElementById('monthAvg'),
        togToast: document.getElementById('tog-toast'),
        avatarBtn: document.getElementById('user-avatar-btn'),
        userEmail: document.getElementById('menu-user-email'),
        userDropdown: document.getElementById('user-dropdown'),
        userMenuContainer: document.getElementById('user-menu-container'),
        logoutBtn: document.getElementById('tog-logout-btn'),
        themeToggle: document.getElementById('tog-theme-toggle'),
        // New Buttons
        exportBtn: document.getElementById('tog-export-btn'),
        importBtn: document.getElementById('tog-import-btn'),
        importInput: document.getElementById('tog-import-input'),
        resetBtn: document.getElementById('tog-reset-btn')
    };

    if (dom.c1_h) [dom.c1_h, dom.c1_m].forEach(el => el.addEventListener('input', calcTime));
    if (dom.c2_d) dom.c2_d.addEventListener('input', calcDecimal);

    // Bind Window Functions for HTML onclicks
    window.changeMonth = changeMonth;
    window.goToToday = goToToday;
    window.handleInputChange = handleInputChange;
    window.pasteValue = pasteValue;
    window.toggleDay = toggleDay;
    window.toggleTheme = toggleTheme; // Expose toggleTheme

    // Initialize Theme
    try {
        const userPref = localStorage.getItem('theme');
        const systemPref = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (userPref === 'dark' || (!userPref && systemPref)) {
            document.documentElement.classList.add('dark');
            document.body.classList.add('dark'); // Sync with body for main app compatibility
        } else {
            document.documentElement.classList.remove('dark');
            document.body.classList.remove('dark');
        }
        updateThemeIcons();
    } catch(e) { console.error(e); }

    // Init Logic
    initAvatarDropdown();
    initMenuActions();

    if(dom.logoutBtn) {
        dom.logoutBtn.addEventListener('click', async () => {
             const signOutBtn = document.getElementById('sign-out-btn');
             if(signOutBtn) signOutBtn.click();
        });
    }

    if (currentUser) {
        renderHeader(currentUser);
        syncData(currentUser);
    } else {
        renderHeader(null);
    }

    renderCalendar();

    if (window.lucide) window.lucide.createIcons();
}

function initMenuActions() {
    if (dom.exportBtn) {
        dom.exportBtn.onclick = exportData;
    }
    if (dom.importBtn && dom.importInput) {
        dom.importBtn.onclick = () => dom.importInput.click();
        dom.importInput.onchange = importData;
    }
    if (dom.resetBtn) {
        dom.resetBtn.onclick = resetData;
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const body = document.body;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        body.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        body.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
    updateThemeIcons();
}

function updateThemeIcons() {
    const btn = dom.themeToggle;
    if(!btn) return;
    const isDark = document.documentElement.classList.contains('dark');
    const sun = btn.querySelector('svg:first-child');
    const moon = btn.querySelector('svg:last-child');
    if (isDark) {
        if(sun) sun.classList.remove('hidden');
        if(moon) moon.classList.add('hidden');
    } else {
        if(sun) sun.classList.add('hidden');
        if(moon) moon.classList.remove('hidden');
    }
}

// --- DATA MANAGEMENT ---

function exportData() {
    const dataStr = JSON.stringify(storedData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TOG_Tracker_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Data Exported!");
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            // Validation: minimal check
            if (typeof importedData !== 'object') throw new Error("Invalid JSON");

            // Merge logic: Overwrite storedData with imported
            storedData = { ...storedData, ...importedData };

            // Persist
            localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
            if (storedData._dayVisibility) dayVisibility = storedData._dayVisibility;

            if (currentUser) {
                const userRef = doc(db, "users", currentUser.uid);
                await setDoc(userRef, { togTracker: storedData }, { merge: true });
            }

            renderCalendar();
            showToast("Data Imported Successfully!");
        } catch (err) {
            console.error(err);
            showToast("Import Failed: Invalid File");
        }
        event.target.value = ''; // Reset input
    };
    reader.readAsText(file);
}

async function resetData() {
    if (!confirm("Are you sure you want to RESET all TOG Tracker data? This cannot be undone.")) return;

    storedData = {};
    dayVisibility = [true, true, true, true, true, true, true];
    localStorage.removeItem(STORAGE_KEY);

    if (currentUser) {
        try {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, { togTracker: deleteField() });
        } catch (e) {
            console.error("Reset sync error", e);
        }
    }

    renderCalendar();
    showToast("All Data Reset!");
}

// --- AVATAR LOGIC ---
function getAvatar(user) {
    if (!user) {
        return `<div class="bg-gray-200 dark:bg-slate-800 w-full h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>`;
    }

    const email = user.email || "?";
    const letter = email.charAt(0).toUpperCase();

    const uid = user.uid;
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c1 = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    const c2 = ((hash >> 4) & 0x00FFFFFF).toString(16).toUpperCase();
    const color1 = "#" + "00000".substring(0, 6 - c1.length) + c1;
    const color2 = "#" + "00000".substring(0, 6 - c2.length) + c2;

    return `<div style="background: linear-gradient(135deg, ${color1}, ${color2});" class="w-full h-full flex items-center justify-center text-white font-bold text-sm shadow-inner">
        ${letter}
    </div>`;
}

function renderHeader(user) {
    if(dom.avatarBtn) dom.avatarBtn.innerHTML = getAvatar(user);
    if(dom.userEmail) dom.userEmail.innerText = user ? user.email : "Guest Session";
}

function initAvatarDropdown() {
    if (dom.avatarBtn && dom.userDropdown && dom.userMenuContainer) {
        dom.avatarBtn.onclick = (e) => {
            e.stopPropagation();
            const isClosed = dom.userDropdown.classList.contains('opacity-0');
            if(isClosed) {
                dom.userDropdown.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
            } else {
                dom.userDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            }
        };

        document.addEventListener('click', (e) => {
            if(dom.userMenuContainer && !dom.userMenuContainer.contains(e.target)) {
                dom.userDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            }
        });
    }
}

async function syncData(user) {
    try {
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const cloudData = docSnap.data();
            const togData = cloudData.togTracker || {};
            storedData = { ...storedData, ...togData };
            if (storedData._dayVisibility) {
                dayVisibility = storedData._dayVisibility;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
            renderCalendar();
        }
    } catch (e) {
        console.error("Sync error:", e);
        showToast("Sync Error: " + e.message);
    }
}

async function saveData(key, value) {
    if(value === "") { delete storedData[key]; }
    else { storedData[key] = value; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
    renderCalendar(true);

    if(currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const payload = {};
        // Save under togTracker map
        const fieldPath = `togTracker.${key}`;

        if (value === "") payload[fieldPath] = deleteField();
        else payload[fieldPath] = value;

        try {
            await updateDoc(userRef, payload);
        } catch(e) {
            // Fallback to setDoc with merge if update fails (e.g. doc doesn't exist)
             try {
                await setDoc(userRef, { togTracker: { [key]: value === "" ? deleteField() : value } }, { merge: true });
            } catch (ex) { console.error("Save sync error", ex); }
        }
    }
}

function updateMemory(val) {
    lastCalculatedDecimal = val;
    if(dom.globalMemory) dom.globalMemory.innerText = val;
}

function calcTime() {
    const h = parseFloat(dom.c1_h.value) || 0;
    const m = parseFloat(dom.c1_m.value) || 0;
    const decimal = h + (m / 60);
    const fmt = Number.isInteger(decimal) ? decimal : decimal.toFixed(2);
    if(dom.res_decimal) dom.res_decimal.innerText = fmt;
    updateMemory(fmt);
}

function calcDecimal() {
    const val = parseFloat(dom.c2_d.value) || 0;
    const hours = Math.floor(val);
    const minutes = Math.round((val - hours) * 60);
    if(dom.res_time) dom.res_time.innerText = (minutes === 60) ? `${hours + 1}h 0m` : `${hours}h ${minutes}m`;
    updateMemory(val);
}

function toggleDay(index) {
    dayVisibility[index] = !dayVisibility[index];
    saveData('_dayVisibility', dayVisibility);
}

function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function formatDateKey(d) { return d.toISOString().split('T')[0]; }

function renderCalendar(preserveFocus = false) {
    if (!dom.calendarGrid) return;

    let focusedKey = null;
    let focusedType = null;
    if (preserveFocus && document.activeElement && document.activeElement.dataset.key) {
        focusedKey = document.activeElement.dataset.key;
        focusedType = document.activeElement.dataset.type;
    }

    // 1. Render Toggles
    const toggleContainer = dom.dayToggles;
    if(toggleContainer) {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        toggleContainer.innerHTML = '';
        dayNames.forEach((name, idx) => {
            const isVisible = dayVisibility[idx];
            const btn = document.createElement('button');
            const activeClass = isVisible
                ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
                : "bg-slate-50 text-slate-300 border-slate-100 dark:bg-slate-900 dark:text-slate-700 dark:border-slate-800";

            btn.className = `flex items-center justify-center w-8 h-8 rounded text-[10px] font-bold border transition-colors ${activeClass}`;
            btn.onclick = () => toggleDay(idx);
            btn.innerText = name.charAt(0);
            btn.title = isVisible ? `Hide ${name}` : `Show ${name}`;
            toggleContainer.appendChild(btn);
        });
    }

    // 2. Adjust Grid
    const visibleCount = dayVisibility.filter(Boolean).length;
    const gridCols = visibleCount + 1;
    const headerRow = dom.headerRow;
    const grid = dom.calendarGrid;
    const style = `grid-template-columns: repeat(${gridCols}, minmax(100px, 1fr));`;
    if(headerRow) headerRow.style.cssText = style;
    if(grid) grid.style.cssText = style;

    // 3. Headers
    if(headerRow) {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        headerRow.innerHTML = '';
        dayNames.forEach((name, idx) => {
            if(!dayVisibility[idx]) return;
            const div = document.createElement('div');
            div.className = "text-center text-xs font-bold text-slate-400 uppercase py-1";
            div.innerText = name;
            headerRow.appendChild(div);
        });
        const wkDiv = document.createElement('div');
        wkDiv.className = "text-center text-xs font-bold text-emerald-500 uppercase py-1 border-l border-slate-100 dark:border-slate-800";
        wkDiv.innerText = "Weekly";
        headerRow.appendChild(wkDiv);
    }

    // 4. Grid Body
    if(grid) {
        grid.innerHTML = '';
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        if(dom.monthLabel) dom.monthLabel.innerText = `${monthNames[month]} ${year}`;

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
                const rawVal = storedData[dateKey];
                const rawBonus = storedData[bonusKey];
                const val = rawVal !== undefined ? rawVal : '';
                const bonusVal = rawBonus !== undefined ? rawBonus : '';

                const isToday = dateKey === todayKey;
                const isCurrentMonth = currentLoopDate.getMonth() === month;
                const numVal = parseFloat(val) || 0;
                const numBonus = parseFloat(bonusVal) || 0;
                const dailySum = numVal + numBonus;

                if (dayVisibility[i]) {
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
                            <button onclick="window.pasteValue('${dateKey}')" class="icon-btn text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                                <i data-lucide="arrow-down-to-line" class="w-3 h-3"></i>
                            </button>
                        </div>
                        <div class="day-body">
                            <input type="number" step="0.1"
                                data-key="${dateKey}" data-type="main"
                                class="input-field bg-transparent border-none font-mono font-bold text-center text-xl w-full text-slate-900 dark:text-white"
                                value="${val}" onchange="window.handleInputChange('${dateKey}', this.value)">
                        </div>
                        <div class="day-footer ${footerBg}">
                            <div class="flex items-center w-full px-1">
                                <button onclick="window.pasteValue('${bonusKey}')" class="icon-btn text-yellow-500 hover:text-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 mr-1">
                                    <i data-lucide="plus" class="w-3 h-3"></i>
                                </button>
                                <input type="number" step="0.1"
                                    data-key="${dateKey}" data-type="bonus"
                                    class="input-field bg-transparent border-none font-mono font-bold text-center text-xs w-full text-yellow-700 dark:text-yellow-500 placeholder-yellow-200"
                                    value="${bonusVal}" placeholder="-" onchange="window.handleInputChange('${bonusKey}', this.value)">
                            </div>
                        </div>
                    `;
                    weekNodes.push(card);
                }
                currentLoopDate.setDate(currentLoopDate.getDate() + 1);
            }

            weekNodes.forEach(node => grid.appendChild(node));

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
            grid.appendChild(statCard);
        }

        // Month Stats
        const monthAvg = monthActiveDays > 0 ? (monthTotal / monthActiveDays) : 0;
        if(dom.monthTotal) dom.monthTotal.innerText = monthTotal.toFixed(2);
        if(dom.monthAvg) dom.monthAvg.innerText = monthAvg.toFixed(2);

        if (window.lucide) window.lucide.createIcons();
        if (focusedKey) {
            const el = document.querySelector(`input[data-key="${focusedKey}"][data-type="${focusedType}"]`);
            if (el) el.focus();
        }
    }
}

function handleInputChange(key, value) { saveData(key, value); }

function pasteValue(key) {
    if(lastCalculatedDecimal == 0) { showToast("Calculate first!"); return; }
    saveData(key, lastCalculatedDecimal);
    showToast("Pasted!");
}

function changeMonth(offset) {
    viewDate.setMonth(viewDate.getMonth() + offset);
    renderCalendar();
}

function goToToday() { viewDate = new Date(); renderCalendar(); }

function showToast(msg) {
    const toast = dom.togToast;
    if(!toast) return;
    toast.innerText = msg; toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 2000);
}
