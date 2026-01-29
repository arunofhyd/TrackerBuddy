import { doc, onSnapshot, setDoc, updateDoc, deleteField } from './services/firebase.js';
import { LOCAL_STORAGE_KEYS, TOG_BACKUP_PREFIX, COLLECTIONS } from './constants.js';

let state = {
    viewDate: new Date(),
    lastCalculatedDecimal: 0.0,
    storedData: {},
    dayVisibility: [true, true, true, true, true, true, true], // Mon-Sun
    userId: null,
    db: null,
    auth: null,
    unsubscribe: null,
    isInitialized: false,
    i18n: null,
    trackerYearlyData: {},
    trackerLeaveTypes: [],
    showTrackerData: false,
    showConverters: true,
    showVisibleDays: true
};

const DOM = {};

export function initTog(userId, db, auth, i18n) {
    state.userId = userId;
    state.db = db;
    state.auth = auth;
    state.i18n = i18n;

    cacheDOM();

    if (!state.isInitialized) {
        bindEvents();
        state.isInitialized = true;
    }

    // Load local data first if available (for guest mode or offline)
    const local = localStorage.getItem(LOCAL_STORAGE_KEYS.TOG_DATA);
    if(local) {
        try {
            state.storedData = JSON.parse(local);
            if(state.storedData._dayVisibility) state.dayVisibility = state.storedData._dayVisibility;
            if(state.storedData._showConverters !== undefined) state.showConverters = state.storedData._showConverters;
            if(state.storedData._showVisibleDays !== undefined) state.showVisibleDays = state.storedData._showVisibleDays;
        } catch(e) { console.error(e); }
    }

    applyToggleState();

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
    DOM.menuAvatar = document.getElementById('tog-menu-avatar');
    DOM.userEmail = document.getElementById('tog-menu-user-email');

    DOM.backupBtn = document.getElementById('tog-backup-btn');
    DOM.restoreBtn = document.getElementById('tog-restore-btn');
    DOM.resetBtn = document.getElementById('tog-reset-btn');
    DOM.restoreInput = document.getElementById('tog-restore-input');
    DOM.trackerLogoBtn = document.getElementById('tog-tracker-logo-btn');
    DOM.leaveLegendContainer = document.getElementById('tog-leave-legend-container');

    DOM.convertersWrapper = document.getElementById('tog-converters-wrapper');
    DOM.visibleDaysWrapper = document.getElementById('tog-visible-days-wrapper');
    DOM.toggleConvertersBtn = document.getElementById('tog-toggle-converters-btn');
    DOM.toggleVisibleDaysBtn = document.getElementById('tog-toggle-visible-days-btn');
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

    DOM.trackerLogoBtn?.addEventListener('click', toggleTrackerOverlay);

    DOM.toggleConvertersBtn?.addEventListener('click', toggleConverters);
    DOM.toggleVisibleDaysBtn?.addEventListener('click', toggleVisibleDays);

    document.getElementById('tog-logout-btn')?.addEventListener('click', () => {
        if(window.appSignOut) window.appSignOut();
    });

    // Make window functions for inline HTML clicks (legacy support)
    window.tog_insertValue = insertValue;
    window.tog_handleInputChange = handleInputChange;
}

export function refreshTogUI() {
    renderHeader();
    renderCalendar(true);
}

export function updateLeaveData(yearlyData, leaveTypes) {
    state.trackerYearlyData = yearlyData || {};
    state.trackerLeaveTypes = leaveTypes || [];
    if (state.showTrackerData) {
        renderCalendar(true);
    }
}

function applyToggleState() {
    if (DOM.convertersWrapper) {
        if (state.showConverters) DOM.convertersWrapper.classList.add('visible');
        else DOM.convertersWrapper.classList.remove('visible');
    }
    if (DOM.visibleDaysWrapper) {
        if (state.showVisibleDays) DOM.visibleDaysWrapper.classList.add('visible');
        else DOM.visibleDaysWrapper.classList.remove('visible');
    }
}

function toggleConverters() {
    state.showConverters = !state.showConverters;
    applyToggleState();
    saveData('_showConverters', state.showConverters);
    closeDropdown();
}

function toggleVisibleDays() {
    state.showVisibleDays = !state.showVisibleDays;
    applyToggleState();
    saveData('_showVisibleDays', state.showVisibleDays);
    closeDropdown();
}

function toggleTrackerOverlay() {
    state.showTrackerData = !state.showTrackerData;

    if (DOM.trackerLogoBtn) {
        if (state.showTrackerData) {
            // Blue shadow (Blue 500 is #3b82f6), increased prominence
            DOM.trackerLogoBtn.style.boxShadow = '0 0 17px 7px rgba(59, 130, 246, 0.5)';
        } else {
            DOM.trackerLogoBtn.style.boxShadow = 'none';
        }
    }

    if (DOM.leaveLegendContainer) {
        if (state.showTrackerData) {
            DOM.leaveLegendContainer.classList.add('visible');
            renderLeaveLegend();
        } else {
            DOM.leaveLegendContainer.classList.remove('visible');
        }
    }

    renderCalendar(true);
}

function renderLeaveLegend() {
    if (!DOM.leaveLegendContainer) return;

    DOM.leaveLegendContainer.innerHTML = '';
    const currentYear = state.viewDate.getFullYear();
    const yearData = state.trackerYearlyData[currentYear] || {};
    const overrides = yearData.leaveOverrides || {};

    const visibleTypes = state.trackerLeaveTypes.filter(lt => {
        if (overrides[lt.id]?.hidden) return false;
        if (lt.limitYear && lt.limitYear !== currentYear) return false;
        return true;
    });

    visibleTypes.forEach(lt => {
        const pill = document.createElement('div');
        pill.className = 'flex-shrink-0 truncate max-w-40 px-3 py-1.5 rounded-full text-sm font-semibold text-white shadow';
        pill.style.backgroundColor = lt.color;
        pill.innerText = lt.name;
        DOM.leaveLegendContainer.appendChild(pill);
    });
}

function subscribeToData(userId) {
    if(state.unsubscribe) state.unsubscribe();
    if(!state.db) return;

    const userRef = doc(state.db, COLLECTIONS.USERS, userId);
    state.unsubscribe = onSnapshot(userRef, (docSnap) => {
        if(docSnap.exists()) {
            const data = docSnap.data();
            const cloudTogData = data.togData || {};

            // Flatten nested structure (year/month/data) and prioritize over legacy
            let flatCloudData = {};

            // 1. Process nested data first (Priority)
            for (const key in cloudTogData) {
                if (typeof cloudTogData[key] === 'object' && !Array.isArray(cloudTogData[key]) && !key.startsWith('_')) {
                    // Assume it's a year map -> month map -> data
                    const yearData = cloudTogData[key];
                    for (const monthKey in yearData) {
                        const monthData = yearData[monthKey];
                        if (typeof monthData === 'object') {
                            for (const dateKey in monthData) {
                                const dayValue = monthData[dateKey];
                                if (typeof dayValue === 'object') {
                                    if (dayValue.main !== undefined) flatCloudData[dateKey] = dayValue.main;
                                    if (dayValue.bonus !== undefined) flatCloudData[`bonus_${dateKey}`] = dayValue.bonus;
                                } else {
                                    flatCloudData[dateKey] = dayValue;
                                }
                            }
                        }
                    }
                }
            }

            // 2. Process legacy/root keys (only if not already set by nested)
            for (const key in cloudTogData) {
                // Check if it's a root property we want to keep
                if (key.startsWith('_') || typeof cloudTogData[key] !== 'object' || Array.isArray(cloudTogData[key])) {
                    // If it's a date key (legacy), only add if we haven't seen it in nested data
                    // Note: This check is simple; if 'key' exists in flatCloudData, we skip it.
                    // This assumes legacy keys match the flatCloudData keys (YYYY-MM-DD or bonus_YYYY-MM-DD).
                    if (flatCloudData[key] === undefined) {
                        flatCloudData[key] = cloudTogData[key];
                    }
                }
            }

            // Merge strategy: Cloud wins
            state.storedData = { ...state.storedData, ...flatCloudData };

            if(state.storedData._dayVisibility) {
                state.dayVisibility = state.storedData._dayVisibility;
            }
            if(state.storedData._showConverters !== undefined) state.showConverters = state.storedData._showConverters;
            if(state.storedData._showVisibleDays !== undefined) state.showVisibleDays = state.storedData._showVisibleDays;

            applyToggleState();

            // Update local storage for redundancy/offline fallback
            localStorage.setItem(LOCAL_STORAGE_KEYS.TOG_DATA, JSON.stringify(state.storedData));

            // If data doesn't have email, try to get it from Auth
            if (!data.email && state.auth && state.auth.currentUser) {
                data.email = state.auth.currentUser.email;
            }
            // If data doesn't have uid, add it
            if (!data.uid) {
                data.uid = userId;
            }

            renderHeader(data);

            // Render with focus preservation, deferred to match optimistic update and ensure focus stability
            setTimeout(() => renderCalendar(true), 0);
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
    // If user argument is missing, try to use state.auth.currentUser directly
    const effectiveUser = user || (state.auth && state.auth.currentUser);
    const email = effectiveUser ? (effectiveUser.email || "Guest") : "Guest";
    const displayUser = effectiveUser || null;

    if(DOM.userEmail) DOM.userEmail.innerText = email;

    // Update Menu Avatar content (Blue circle with initial or Guest icon)
    if(DOM.menuAvatar) {
        if (displayUser && displayUser.email) {
            DOM.menuAvatar.innerText = displayUser.email.charAt(0).toUpperCase();
        } else {
            DOM.menuAvatar.innerHTML = '<i class="fas fa-user"></i>';
        }
    }
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

    localStorage.setItem(LOCAL_STORAGE_KEYS.TOG_DATA, JSON.stringify(state.storedData));

    // Update UI immediately (optimistic update) - mainly for Guest mode or immediate feedback
    // Pass true to preserve focus so user can continue typing/tabbing
    // Defer render slightly to ensure focus has settled (e.g. if clicking from one input to another)
    setTimeout(() => renderCalendar(true), 0);

    if(state.userId && state.db) {
        const userRef = doc(state.db, COLLECTIONS.USERS, state.userId);

        if (key.startsWith('_')) {
             const fieldPath = `togData.${key}`;
             try {
                 if (value === "") await updateDoc(userRef, { [fieldPath]: deleteField() });
                 else await updateDoc(userRef, { [fieldPath]: value });
             } catch(e) {
                 const payload = { togData: { [key]: value === "" ? deleteField() : value } };
                 await setDoc(userRef, payload, { merge: true });
             }
        } else {
             // Parse date from key
             let datePart = key.startsWith('bonus_') ? key.replace('bonus_', '') : key;
             const [year, month] = datePart.split('-');

             if (!year || !month) {
                 // Fallback for weird keys
                 const fieldPath = `togData.${key}`;
                 await updateDoc(userRef, { [fieldPath]: value === "" ? deleteField() : value });
             } else {
                 // Construct the day object from state, but override with current input value
                 let mainVal = state.storedData[datePart];
                 let bonusVal = state.storedData[`bonus_${datePart}`];

                 // Override the specific field being updated right now
                 if (key === datePart) {
                     mainVal = value;
                 } else if (key === `bonus_${datePart}`) {
                     bonusVal = value;
                 }

                 const dayObj = {};
                 if (mainVal !== undefined && mainVal !== "") dayObj.main = mainVal;
                 if (bonusVal !== undefined && bonusVal !== "") dayObj.bonus = bonusVal;

                 const fieldPath = `togData.${year}.${month}.${datePart}`;

                 try {
                     if (Object.keys(dayObj).length === 0) {
                         await updateDoc(userRef, { [fieldPath]: deleteField() });
                     } else {
                         await updateDoc(userRef, { [fieldPath]: dayObj });
                     }
                 } catch(e) {
                     console.warn("Update failed, trying set/merge", e);

                     // Reconstruct nested object for setDoc
                     const payload = { togData: {} };
                     if (!payload.togData[year]) payload.togData[year] = {};
                     if (!payload.togData[year][month]) payload.togData[year][month] = {};

                     if (Object.keys(dayObj).length === 0) {
                         payload.togData[year][month][datePart] = deleteField();
                     } else {
                         payload.togData[year][month][datePart] = dayObj;
                     }

                     await setDoc(userRef, payload, { merge: true });
                 }
             }
        }
    }
}

// --- Calendar ---
function getSunday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

function formatDateKey(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function renderCalendar(preserveFocus = false) {
    if(!DOM.calendarGrid) return;

    let focusedKey = null;
    let focusedType = null;
    if (preserveFocus && document.activeElement && document.activeElement.dataset.key) {
        focusedKey = document.activeElement.dataset.key;
        focusedType = document.activeElement.dataset.type;
    }

    if (state.showTrackerData) {
        renderLeaveLegend();
    }

    // 1. Toggles
    const daysKey = (state.i18n?.getValue('common.shortDays')) ? 'common.shortDays' : 'common.days';
    const dayNames = state.i18n?.getValue(daysKey) || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
        const textColor = idx === 0 ? "text-red-500" : "text-slate-400";
        div.className = `text-center text-xs font-bold ${textColor} uppercase py-1`;
        div.innerText = name;
        DOM.headerRow.appendChild(div);
    });
    const wkDiv = document.createElement('div');
    wkDiv.className = "text-center text-xs font-bold text-emerald-500 uppercase py-1 border-s border-slate-100 dark:border-slate-800";
    wkDiv.innerText = state.i18n?.t('tog.weekly') || "Weekly";
    DOM.headerRow.appendChild(wkDiv);

    // 4. Body
    DOM.calendarGrid.innerHTML = '';
    const year = state.viewDate.getFullYear();
    const month = state.viewDate.getMonth();
    const monthNames = state.i18n?.getValue('common.months') || ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    if(DOM.monthLabel) DOM.monthLabel.innerText = `${monthNames[month]} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1);
    const startDate = getSunday(firstDayOfMonth);

    // Force 6 weeks (42 days) to ensure consistent row count
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 41);

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
                let cardBg = isToday ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-slate-900';
                const cardBorder = isToday ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700';
                let dayText = isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-400 font-medium';
                if (currentLoopDate.getDay() === 0) {
                    dayText = isToday ? 'text-red-500 font-bold' : 'text-red-500 font-medium';
                }
                const footerBg = 'bg-yellow-50 dark:bg-yellow-900/10';

                let overlayStyle = '';
                if (state.showTrackerData) {
                    const currentYear = currentLoopDate.getFullYear();
                    const trackerDayData = state.trackerYearlyData[currentYear]?.activities?.[dateKey];
                    if (trackerDayData?.leave) {
                        const leaveType = state.trackerLeaveTypes.find(lt => lt.id === trackerDayData.leave.typeId);
                        if (leaveType) {
                            // Convert hex to RGBA for consistency if possible, assuming hex color from picker
                            const hex = leaveType.color.startsWith('#') ? leaveType.color : '#3b82f6';
                            const alphaHex = '40'; // 25% opacity

                            if (trackerDayData.leave.dayType === 'half') {
                                // Half day: Linear gradient
                                // "half filled cells of the same leave type colour"
                                // We use the color with 25% opacity (alphaHex) for the filled part
                                const colorWithOpacity = `${hex}${alphaHex}`;
                                overlayStyle = `background-image: linear-gradient(to bottom right, ${colorWithOpacity} 50%, transparent 50%) !important;`;
                            } else {
                                // Full day
                                overlayStyle = `background-color: ${hex}${alphaHex} !important;`;
                            }
                        }
                    }
                }

                const card = document.createElement('div');
                card.className = `day-card min-h-[100px] border ${cardBorder} ${!overlayStyle ? cardBg : ''} ${baseOpacity}`;
                if (overlayStyle) {
                     card.style.cssText = overlayStyle;
                }

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
                            <button onclick="window.tog_insertValue('${bonusKey}', 'bonus')" class="icon-btn text-yellow-500 hover:text-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 me-1" title="Insert Memory">
                                <!-- lucide arrow-down-to-line replacement -->
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line w-3 h-3"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>
                            </button>
                            <input type="number" step="0.1"
                                data-key="${dateKey}" data-type="bonus"
                                class="input-field bg-transparent border-none font-mono font-bold text-center text-xs w-full text-yellow-700 dark:text-yellow-500 placeholder-yellow-200 tog-bonus-input"
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
                    <span class="text-[9px] uppercase font-bold text-slate-400 block">${state.i18n?.t('tog.wkAvg') || "Wk Avg"}</span>
                    <span class="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">${weekAvg.toFixed(2)}</span>
                </div>
                <div class="border-t border-slate-200 dark:border-slate-700 pt-1">
                    <span class="text-[9px] uppercase font-bold text-slate-400 block">${state.i18n?.t('tog.total') || "Total"}</span>
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
    if(state.lastCalculatedDecimal == 0) { showToast(state.i18n?.t('tog.calcFirst') || "Calculate first!", 'error'); return; }
    saveData(key, state.lastCalculatedDecimal);
    showToast(state.i18n?.t('tog.inserted') || "Inserted!", 'success');
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
    link.download = `${TOG_BACKUP_PREFIX}${new Date().toISOString().split('T')[0]}.json`;
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

            localStorage.setItem(LOCAL_STORAGE_KEYS.TOG_DATA, JSON.stringify(state.storedData));

            if(state.userId) {
                // Save whole object for restore
                const userRef = doc(state.db, COLLECTIONS.USERS, state.userId);
                await updateDoc(userRef, { togData: state.storedData });
            }

            renderCalendar();
            showToast(state.i18n?.t('tog.restored') || "Restored Successfully", "success");
        } catch(err) {
            console.error(err);
            showToast(state.i18n?.t('tog.invalidJson') || "Invalid JSON File", "error");
        }
    };
    reader.readAsText(file);
    closeDropdown();
    e.target.value = ""; // Reset input
}

export async function performReset(userId, db) {
    state.storedData = { _dayVisibility: [true,true,true,true,true,true,true] };
    state.dayVisibility = [true,true,true,true,true,true,true];
    localStorage.removeItem(LOCAL_STORAGE_KEYS.TOG_DATA);

    // Use passed context or fallback to state
    const targetUserId = userId || state.userId;
    const targetDb = db || state.db;

    if(targetUserId && targetDb) {
         const userRef = doc(targetDb, COLLECTIONS.USERS, targetUserId);
         await updateDoc(userRef, { togData: deleteField() });
    }
    renderCalendar();
    if (state.i18n) {
        showToast(state.i18n.t('tog.resetComplete'), "success");
    } else {
        showToast("Reset Complete", "success");
    }
}
