// Import Firebase modules
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, updateDoc, getDoc, writeBatch, addDoc, deleteField } from "firebase/firestore";
// --- Firebase Configuration ---
import { getFunctions, httpsCallable } from "firebase/functions";
import { html, render } from 'lit-html';
import { format } from 'date-fns';
import Papa from 'papaparse';

const firebaseConfig = {
    apiKey: "AIzaSyC3HKpNpDCMTlARevbpCarZGdOJJGUJ0Vc",
    authDomain: "trackerbuddyaoh.firebaseapp.com",
    projectId: "trackerbuddyaoh",
    storageBucket: "trackerbuddyaoh.firebasestorage.app",
    messagingSenderId: "612126230828",
    appId: "1:612126230828:web:763ef43baec1046d3b0489"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'asia-south1');

// --- Translation Service ---
class TranslationService {
    constructor() {
        this.currentLang = 'en';
        this.translations = {};
        this.supportedLangs = [
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Español' },
            { code: 'fr', name: 'Français' },
            { code: 'de', name: 'Deutsch' },
            { code: 'zh', name: '中文' },
            { code: 'ja', name: '日本語' },
            { code: 'ko', name: '한국어' },
            { code: 'pt', name: 'Português' },
            { code: 'ru', name: 'Русский' },
            { code: 'ar', name: 'العربية' },
            { code: 'hi', name: 'हिन्दी' },
            { code: 'it', name: 'Italiano' },
            { code: 'nl', name: 'Nederlands' },
            { code: 'pl', name: 'Polski' },
            { code: 'vi', name: 'Tiếng Việt' },
            { code: 'th', name: 'ไทย' },
            { code: 'id', name: 'Bahasa Indonesia' },
            { code: 'ms', name: 'Bahasa Melayu' },
            { code: 'ta', name: 'தமிழ்' },
            { code: 'ml', name: 'മലയാളം' }
        ];
    }

    async init() {
        // Check localStorage first, then browser preference
        const savedLang = localStorage.getItem('appLanguage');
        const userLang = navigator.language.split('-')[0];
        const supportedCodes = this.supportedLangs.map(l => l.code);

        if (savedLang && supportedCodes.includes(savedLang)) {
            this.currentLang = savedLang;
        } else {
            this.currentLang = supportedCodes.includes(userLang) ? userLang : 'en';
        }

        try {
            await this.loadTranslations(this.currentLang);
        } catch (e) {
            console.error("Init translation failed", e);
        }
        this.translatePage();
    }

    async setLanguage(langCode) {
        if (this.currentLang === langCode) return;

        this.currentLang = langCode;
        localStorage.setItem('appLanguage', langCode);
        await this.loadTranslations(langCode);
        this.translatePage();
    }

    async loadTranslations(lang) {
        try {
            const response = await fetch(`assets/i18n/${lang}.json`);
            this.translations = await response.json();
        } catch (error) {
            console.error('Failed to load translations:', error);
        }
    }

    t(key, params = {}) {
        let text = this.translations[key] || key;
        Object.keys(params).forEach(param => {
            text = text.replace(new RegExp(`{${param}}`, 'g'), params[param]);
        });
        return text;
    }

    translatePage() {
        document.documentElement.lang = this.currentLang;
        document.documentElement.dir = this.currentLang === 'ar' ? 'rtl' : 'ltr';

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (this.translations[key]) {
                el.innerHTML = this.translations[key];
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            if (this.translations[key]) {
                el.placeholder = this.translations[key];
            }
        });
        document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            const key = el.dataset.i18nAriaLabel;
            if (this.translations[key]) {
                el.setAttribute('aria-label', this.translations[key]);
            }
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.dataset.i18nTitle;
            if (this.translations[key]) {
                el.title = this.translations[key];
            }
        });
        document.querySelectorAll('[data-i18n-alt]').forEach(el => {
            const key = el.dataset.i18nAlt;
            if (this.translations[key]) {
                el.alt = this.translations[key];
            }
        });
        updateView();
    }
}
const i18n = new TranslationService();

// --- MODIFICATION: Code Quality - Replaced magic strings with constants ---
const ACTION_TYPES = {
    SAVE_NOTE: 'SAVE_NOTE',
    ADD_SLOT: 'ADD_SLOT',
    UPDATE_ACTIVITY_TEXT: 'UPDATE_ACTIVITY_TEXT',
    UPDATE_TIME: 'UPDATE_TIME'
};

const VIEW_MODES = {
    MONTH: 'month',
    DAY: 'day'
};

const LEAVE_DAY_TYPES = {
    FULL: 'full',
    HALF: 'half'
};

const TEAM_ROLES = {
    ADMIN: 'admin',
    MEMBER: 'member'
};

const COLOR_MAP = {
    '#ef4444': 'Red',
    '#f97316': 'Orange',
    '#eab308': 'Yellow',
    '#84cc16': 'Lime',
    '#22c55e': 'Green',
    '#14b8a6': 'Teal',
    '#06b6d4': 'Cyan',
    '#3b82f6': 'Blue',
    '#8b5cf6': 'Violet',
    '#d946ef': 'Fuchsia',
    '#ec4899': 'Pink',
    '#78716c': 'Gray'
};

// --- Global App State ---
let state = {
    previousActiveElement: null, // For focus management
    currentMonth: new Date(),
    selectedDate: new Date(),
    currentView: VIEW_MODES.MONTH,
    // FIX: Revert to multi-year structure
    yearlyData: {}, // Holds all data, keyed by year
    currentYearData: { activities: {}, leaveOverrides: {} }, // Data for the currently selected year
    userId: null,
    isOnlineMode: false,
    unsubscribeFromFirestore: null,
    editingInlineTimeKey: null,
    pickerYear: new Date().getFullYear(),
    confirmAction: {}, // For double-click confirmation
    leaveTypes: [],
    isLoggingLeave: false,
    selectedLeaveTypeId: null,
    leaveSelection: new Set(),
    initialLeaveSelection: new Set(),
    logoTapCount: 0, // Easter Egg counter
    // Team Management State
    currentTeam: null,
    teamName: null,
    teamRole: null,
    teamMembers: [],
    teamMembersData: {},
    unsubscribeFromTeam: null,
    unsubscribeFromTeamMembers: [],
    // Search State
    searchResultDates: [], // Sorted list of date keys for navigation
    searchSortOrder: 'newest', // 'newest' or 'oldest'
    searchScope: 'year', // 'year' or 'global'
    searchQuery: '',
    // --- FIX: Add flag to prevent race conditions during updates ---
    isUpdating: false,
    lastUpdated: 0,
    // Admin & Role State
    userRole: 'standard', // 'standard', 'pro', 'co-admin'
    isAdminDashboardOpen: false,
    adminTargetUserId: null,
    superAdmins: []
};

// --- State Management ---
function setState(newState) {
    state = { ...state, ...newState };
}

// --- DOM Element References ---
let DOM = {};

// --- Utilities ---
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
}

function sanitizeHTML(text) {
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
}

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

function waitForDOMUpdate() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

// --- UI Functions ---
function initUI() {
    if (isMobileDevice()) {
        document.body.classList.add('is-mobile');
    }

    DOM = {
        splashScreen: document.getElementById('splash-screen'),
        splashText: document.querySelector('.splash-text'),
        splashLoading: document.getElementById('splash-loading'),
        tapToBegin: document.getElementById('tap-to-begin'),
        contentWrapper: document.getElementById('content-wrapper'),
        footer: document.getElementById('main-footer'),
        loginView: document.getElementById('login-view'),
        appView: document.getElementById('app-view'),
        loadingView: document.getElementById('loading-view'),
        userIdDisplay: document.getElementById('user-id-display'),
        messageDisplay: document.getElementById('message-display'),
        messageText: document.getElementById('message-text'),
        emailSigninBtn: document.getElementById('email-signin-btn'),
        emailSignupBtn: document.getElementById('email-signup-btn'),
        forgotPasswordBtn: document.getElementById('forgot-password-btn'),
        googleSigninBtn: document.getElementById('google-signin-btn'),
        currentPeriodDisplay: document.getElementById('current-period-display'),
        monthViewBtn: document.getElementById('month-view-btn'),
        dayViewBtn: document.getElementById('day-view-btn'),
        calendarView: document.getElementById('calendar-view'),
        dailyView: document.getElementById('daily-view'),
        dailyNoteInput: document.getElementById('daily-note-input'),
        dailyActivityTableBody: document.getElementById('daily-activity-table-body'),
        noDailyActivitiesMessage: document.getElementById('no-daily-activities-message'),
        monthPickerModal: document.getElementById('month-picker-modal'),
        pickerYearDisplay: document.getElementById('picker-year-display'),
        monthGrid: document.getElementById('month-grid'),
        confirmResetModal: document.getElementById('confirm-reset-modal'),
        resetModalText: document.getElementById('reset-modal-text'),
        leaveTypeModal: document.getElementById('leave-type-modal'),
        leaveTypeModalTitle: document.getElementById('leave-type-modal-title'),
        editingLeaveTypeId: document.getElementById('editing-leave-type-id'),
        leaveNameInput: document.getElementById('leave-name-input'),
        leaveDaysInput: document.getElementById('leave-days-input'),
        leaveColorPicker: document.getElementById('leave-color-picker'),
        deleteLeaveTypeBtn: document.getElementById('delete-leave-type-btn'),
        logNewLeaveBtn: document.getElementById('log-new-leave-btn'),
        statsToggleBtn: document.getElementById('stats-toggle-btn'),
        leaveStatsSection: document.getElementById('leave-stats-section'),
        statsArrowDown: document.getElementById('stats-arrow-down'),
        statsArrowUp: document.getElementById('stats-arrow-up'),
        monthViewControls: document.getElementById('month-view-controls'),
        dayViewTopControls: document.getElementById('day-view-top-controls'),
        leavePillsContainer: document.getElementById('leave-pills-container'),
        todayBtnDay: document.getElementById('today-btn-day'),
        addLeaveTypeBtn: document.getElementById('add-leave-type-btn'),
        uploadCsvBtn: document.getElementById('upload-csv-btn'),
        downloadCsvBtn: document.getElementById('download-csv-btn'),
        customizeLeaveModal: document.getElementById('customize-leave-modal'),
        leaveDaysList: document.getElementById('leave-days-list'),
        monthViewBottomControls: document.getElementById('month-view-bottom-controls'),
        dayViewBottomControls: document.getElementById('day-view-bottom-controls'),
        removeAllLeavesBtn: document.getElementById('remove-all-leaves-btn'),
        logoContainer: document.getElementById('logo-container'),
        appLogo: document.getElementById('app-logo'),
        infoToggleBtn: document.getElementById('info-toggle-btn'),
        infoDescription: document.getElementById('info-description'),
        leaveOverviewModal: document.getElementById('leave-overview-modal'),
        overviewLeaveTypeName: document.getElementById('overview-leave-type-name'),
        overviewLeaveDaysList: document.getElementById('overview-leave-days-list'),
        overviewNoLeavesMessage: document.getElementById('overview-no-leaves-message'),
        addNewSlotBtn: document.getElementById('add-new-slot-btn'),
        // Search DOM References (Spotlight)
        spotlightModal: document.getElementById('spotlight-modal'),
        spotlightInput: document.getElementById('spotlight-input'),
        spotlightCloseBtn: document.getElementById('spotlight-close-btn'),
        spotlightResultsList: document.getElementById('spotlight-results-list'),
        spotlightSortBtn: document.getElementById('spotlight-sort-btn'),
        spotlightSortLabel: document.getElementById('spotlight-sort-label'),
        spotlightEmptyState: document.getElementById('spotlight-empty-state'),
        spotlightCount: document.getElementById('spotlight-count'),
        spotlightScopeBtn: document.getElementById('spotlight-scope-btn'),
        spotlightScopeLabel: document.getElementById('spotlight-scope-label'),
        openSpotlightBtn: document.getElementById('open-spotlight-btn'),
        // Team Management DOM References
        teamToggleBtn: document.getElementById('team-toggle-btn'),
        teamSection: document.getElementById('team-section'),
        teamArrowDown: document.getElementById('team-arrow-down'),
        teamArrowUp: document.getElementById('team-arrow-up'),
        createTeamModal: document.getElementById('create-team-modal'),
        teamNameInput: document.getElementById('team-name-input'),
        teamAdminDisplayNameInput: document.getElementById('team-admin-display-name-input'),
        joinTeamModal: document.getElementById('join-team-modal'),
        roomCodeInput: document.getElementById('room-code-input'),
        displayNameInput: document.getElementById('display-name-input'),
        teamDashboardModal: document.getElementById('team-dashboard-modal'),
        teamDashboardContent: document.getElementById('team-dashboard-content'),
        editDisplayNameModal: document.getElementById('edit-display-name-modal'),
        newDisplayNameInput: document.getElementById('new-display-name-input'),
        editTeamNameModal: document.getElementById('edit-team-name-modal'),
        newTeamNameInput: document.getElementById('new-team-name-input'),
        confirmKickModal: document.getElementById('confirm-kick-modal'),
        kickModalText: document.getElementById('kick-modal-text'),
        exitSearchBtn: document.getElementById('exit-search-btn'),
        // Admin DOM
        adminDashboardModal: document.getElementById('admin-dashboard-modal'),
        adminUserList: document.getElementById('admin-user-list'),
        closeAdminDashboardBtn: document.getElementById('close-admin-dashboard-btn')
    };

}

function setInputErrorState(inputElement, hasError) {
    if (hasError) {
        inputElement.classList.add('border-red-500', 'ring-red-500');
        inputElement.classList.remove('border-gray-200');
    } else {
        inputElement.classList.remove('border-red-500', 'ring-red-500');
        inputElement.classList.add('border-gray-200');
    }
}

const faSpinner = '<i class="fas fa-spinner fa-spin text-xl"></i>';
function setButtonLoadingState(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalContent = button.innerHTML;
        const rect = button.getBoundingClientRect();
        button.style.width = `${rect.width}px`;
        button.style.height = `${rect.height}px`;
        if (button.id === 'google-signin-btn') {
            const googleIcon = button.querySelector('img').outerHTML;
            button.innerHTML = `<div class="flex items-center justify-center w-full h-full">${googleIcon} ${faSpinner}</div>`;
        } else {
            button.innerHTML = `<div class="flex items-center justify-center w-full h-full">${faSpinner}</div>`;
        }
    } else {
        button.disabled = false;
        if (button.dataset.originalContent) {
            button.innerHTML = button.dataset.originalContent;
        }
        button.style.width = '';
        button.style.height = '';
    }
}

function switchView(viewToShow, viewToHide, callback) {
    const mainContainer = document.querySelector('.main-container');

    const showNewView = () => {
        if (viewToShow === DOM.loginView || viewToShow === DOM.loadingView) {
            if (DOM.splashScreen) DOM.splashScreen.style.display = 'flex';
        } else if (viewToShow === DOM.appView) {
            loadTheme();
            if (DOM.splashScreen) DOM.splashScreen.style.display = 'none';
        }

        requestAnimationFrame(() => {
            // Ensure the view starts invisible for the fade-in
            viewToShow.style.opacity = '0';
            
            if (viewToShow === DOM.appView) {
                mainContainer.classList.add('is-app-view');
            } else {
                mainContainer.classList.remove('is-app-view');
            }
            viewToShow.classList.remove('hidden');

            requestAnimationFrame(() => {
                viewToShow.style.opacity = '1';
                if (callback) callback();
            });
        });
    };

    if (viewToHide && !viewToHide.classList.contains('hidden')) {
        // Apply optimization only during transition
        viewToHide.style.willChange = 'opacity';
        viewToHide.style.opacity = '0';
        
        let transitionHandler;
        const safetyTimeout = setTimeout(() => {
            viewToHide.removeEventListener('transitionend', transitionHandler);
            finishHide();
        }, 350); 

        const finishHide = () => {
             viewToHide.style.willChange = 'auto'; // Cleanup
             viewToHide.classList.add('hidden');
             // Only show the new view AFTER the old one is gone to prevent layout jumps
             showNewView();
        };

        transitionHandler = () => {
             clearTimeout(safetyTimeout);
             viewToHide.removeEventListener('transitionend', transitionHandler);
             finishHide();
        };

        viewToHide.addEventListener('transitionend', transitionHandler, { once: true });
    } else {
        showNewView();
    }
}

async function handleUserLogin(user) {
    localStorage.setItem('sessionMode', 'online');
    if (state.unsubscribeFromFirestore) {
        state.unsubscribeFromFirestore();
    }
    cleanupTeamSubscriptions();

    setState({ userId: user.uid, isOnlineMode: true });
    DOM.userIdDisplay.textContent = `User ID: ${user.uid}`;

    switchView(DOM.loadingView, DOM.loginView);

    // Now, with the user document guaranteed to exist, subscribe to data.
    subscribeToData(user.uid, async () => {
        // Check for offline data to migrate ONCE, inside callback to ensure we have cloud data for merging
        const guestDataString = localStorage.getItem('guestUserData');
        if (guestDataString) {
            try {
                const guestData = JSON.parse(guestDataString);
                const hasData = Object.keys(guestData.yearlyData || {}).length > 0 || (guestData.leaveTypes && guestData.leaveTypes.length > 0);
                
                if (hasData) {
                    // Use a simple confirm for now as per requirements
                    const promptMsg = i18n.t('migrateDataPrompt');

                    if (confirm(promptMsg)) {
                        try {
                            // Merge with existing cloud data (state)
                            const mergedData = mergeUserData(state, guestData);
                            await persistData(mergedData);
                            localStorage.removeItem('guestUserData');
                            showMessage(i18n.t("msgDataMigratedSuccess"), "success");
                            // Refresh state immediately
                            setState(mergedData);
                        } catch (e) {
                            console.error("Migration failed", e);
                            showMessage(i18n.t("msgFailedToMigrate"), "error");
                        }
                    } else {
                        // User declined, clear local data to stop asking
                        const deleteMsg = i18n.t('deleteGuestDataPrompt');
                        if (confirm(deleteMsg)) {
                            localStorage.removeItem('guestUserData');
                        }
                    }
                }
            } catch (e) {
                console.error("Error parsing guest data for migration:", e);
                // If data is corrupt, clear it to prevent future errors
                localStorage.removeItem('guestUserData');
            }
        }

        // Team data will now be loaded on-demand when the user expands the team section.
        switchView(DOM.appView, DOM.loadingView, updateView);
    });
}

function showMessage(msg, type = 'info') {
    DOM.messageText.textContent = msg;
    DOM.messageDisplay.className = 'fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-md transition-opacity duration-300';
    if (type === 'error') {
        DOM.messageDisplay.classList.add('bg-red-100', 'border', 'border-red-400', 'text-red-700');
    } else if (type === 'success') {
        DOM.messageDisplay.classList.add('bg-green-100', 'border', 'border-green-400', 'text-green-700');
    } else {
        DOM.messageDisplay.classList.add('bg-blue-100', 'border', 'border-blue-400', 'text-blue-700');
    }
    DOM.messageDisplay.classList.add('show');
    clearTimeout(DOM.messageDisplay.dataset.timeoutId);
    const timeoutId = setTimeout(() => DOM.messageDisplay.classList.remove('show'), 3000);
    DOM.messageDisplay.dataset.timeoutId = timeoutId;
}

function updateView() {
    if (!DOM.appView || DOM.appView.classList.contains('hidden')) return;

    const isMonthView = state.currentView === VIEW_MODES.MONTH;
    DOM.monthViewBtn.classList.toggle('btn-primary', isMonthView);
    DOM.monthViewBtn.classList.toggle('btn-secondary', !isMonthView);
    DOM.dayViewBtn.classList.toggle('btn-primary', !isMonthView);
    DOM.dayViewBtn.classList.toggle('btn-secondary', isMonthView);

    DOM.calendarView.classList.toggle('hidden', !isMonthView);
    DOM.dailyView.classList.toggle('hidden', isMonthView);

    DOM.monthViewControls.classList.toggle('hidden', !isMonthView);
    DOM.dayViewTopControls.classList.toggle('hidden', isMonthView); // Controls new day view controls
    DOM.monthViewBottomControls.classList.toggle('hidden', !isMonthView);
    DOM.dayViewBottomControls.classList.toggle('hidden', isMonthView);

    if (isMonthView) {
        DOM.currentPeriodDisplay.textContent = state.currentMonth.toLocaleDateString(i18n.currentLang, { month: 'long', year: 'numeric' });
        renderCalendar();
        renderLeavePills();
        renderLeaveStats();
        renderTeamSection();
    } else {
        DOM.currentPeriodDisplay.textContent = formatDateForDisplay(getYYYYMMDD(state.selectedDate));
        renderDailyActivities();
    }
}
function renderCalendar() {
    // Preserve the header row (first 7 children)
    // Actually, lit-html replacing innerHTML will remove the header rows if I target DOM.calendarView directly.
    // I will recreate the header in lit-html for simplicity, using i18n
    const days = i18n.translations.days || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const header = days.map((day, i) => html`<div class="py-3 text-center text-sm font-semibold ${i === 0 ? 'text-red-500' : 'text-gray-700'}">${day}</div>`);

    const year = state.currentMonth.getFullYear();
    const month = state.currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const today = new Date();
    
    const currentActivities = state.currentYearData.activities || {};
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);

    const emptyCellsBefore = [];
    for (let i = 0; i < firstDayOfMonth.getDay(); i++) {
        emptyCellsBefore.push(html`<div class="calendar-day-cell other-month"><div class="calendar-day-content"></div></div>`);
    }

    const dayCells = [];
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const date = new Date(year, month, day);
        const dateKey = getYYYYMMDD(date);
        const dayData = currentActivities[dateKey] || {}; 
        const noteText = dayData.note || '';
        const hasActivity = Object.keys(dayData).some(key => key !== '_userCleared' && key !== 'note' && key !== 'leave' && dayData[key].text?.trim());
        const leaveData = dayData.leave;

        let leaveIndicator = html``;
        if (leaveData) {
            const leaveType = visibleLeaveTypes.find(lt => lt.id === leaveData.typeId);
            if (leaveType) {
                leaveIndicator = html`<div class="leave-indicator ${leaveData.dayType}-day" style="background-color: ${leaveType.color};"></div>`;
            }
        }

        const classes = ['calendar-day-cell', 'current-month'];
        if (date.getDay() === 0) classes.push('is-sunday');
        if (hasActivity) classes.push('has-activity');
        if (getYYYYMMDD(date) === getYYYYMMDD(today)) classes.push('is-today');
        if (getYYYYMMDD(date) === getYYYYMMDD(state.selectedDate) && state.currentView === VIEW_MODES.DAY) classes.push('selected-day');
        if (state.isLoggingLeave && state.leaveSelection.has(dateKey)) classes.push('leave-selecting');

        const isFullLeave = leaveData && leaveData.dayType === LEAVE_DAY_TYPES.FULL;
        const isSunday = date.getDay() === 0;

        dayCells.push(html`
            <div class="${classes.join(' ')}" data-date="${dateKey}">
                ${leaveIndicator}
                <div class="calendar-day-content">
                    <div class="day-number" style="${isFullLeave ? 'color: white' : (isSunday ? 'color: #ef4444' : '')}">${day}</div>
                    <div class="day-note-container">
                        ${noteText ? html`<span class="day-note" style="${isFullLeave ? 'color: white' : ''}">${noteText}</span>` : ''}
                    </div>
                    ${hasActivity ? html`<div class="activity-indicator"></div>` : ''}
                </div>
            </div>`);
    }

    const totalCells = firstDayOfMonth.getDay() + lastDayOfMonth.getDate();
    const remainingCells = 42 - totalCells;
    const emptyCellsAfter = [];
    for (let i = 0; i < remainingCells; i++) {
        emptyCellsAfter.push(html`<div class="calendar-day-cell other-month"><div class="calendar-day-content"></div></div>`);
    }

    render(html`${header}${emptyCellsBefore}${dayCells}${emptyCellsAfter}`, DOM.calendarView);
}

function renderDailyActivities() {
    const dateKey = getYYYYMMDD(state.selectedDate);
    const currentActivities = state.currentYearData.activities || {};
    const dailyActivitiesMap = currentActivities[dateKey] || {};
    let dailyActivitiesArray = [];

    DOM.dailyNoteInput.value = dailyActivitiesMap.note || '';

    const hasStoredActivities = Object.keys(dailyActivitiesMap).filter(key => key !== '_userCleared' && key !== 'note' && key !== 'leave').length > 0;

    if (hasStoredActivities) {
        dailyActivitiesArray = Object.keys(dailyActivitiesMap)
            .filter(timeKey => timeKey !== '_userCleared' && timeKey !== 'note' && timeKey !== 'leave')
            .map(timeKey => ({ time: timeKey, ...dailyActivitiesMap[timeKey] }))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } else if (dailyActivitiesMap._userCleared !== true && state.selectedDate.getDay() !== 0) {
        for (let h = 8; h <= 17; h++) {
            dailyActivitiesArray.push({ time: `${String(h).padStart(2, '0')}:00-${String(h + 1).padStart(2, '0')}:00`, text: "", order: h - 8 });
        }
    }

    DOM.noDailyActivitiesMessage.classList.toggle('hidden', dailyActivitiesArray.length > 0);

    const rows = dailyActivitiesArray.map((activity, index) => {
        const isFirst = index === 0;
        const isLast = index === dailyActivitiesArray.length - 1;

        return html`
        <tr class="hover:bg-gray-100 transition-colors duration-150" data-time="${activity.time}">
            <td class="py-2 px-2 sm:py-3 sm:px-4 whitespace-nowrap text-sm text-gray-900 cursor-text time-editable" data-time="${activity.time}" contenteditable="true">${activity.time}</td>
            <td class="py-2 px-2 sm:py-3 sm:px-4 text-sm text-gray-900">
                <div class="activity-text-editable" data-time="${activity.time}" contenteditable="true" .innerHTML="${formatTextForDisplay(activity.text, state.searchQuery)}"></div>
            </td>
            <td class="py-2 px-2 sm:py-3 sm:px-4 text-sm flex space-x-1 justify-center items-center">
                <button class="icon-btn move-up-btn" aria-label="Move Up" ?disabled=${isFirst}>
                    <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                </button>
                <button class="icon-btn move-down-btn" aria-label="Move Down" ?disabled=${isLast}>
                    <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <button class="icon-btn delete-btn delete" aria-label="Delete Activity">
                    <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        </tr>`;
    });

    render(html`${rows}`, DOM.dailyActivityTableBody);
}

function renderMonthPicker() {
    DOM.pickerYearDisplay.textContent = state.pickerYear;
    const monthNames = i18n.translations.months || ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const months = monthNames.map((name, index) => {
        const isCurrentMonth = state.pickerYear === state.currentMonth.getFullYear() && index === state.currentMonth.getMonth();
        const classes = `px-4 py-3 rounded-lg font-medium transition-colors duration-200 ${isCurrentMonth ? 'bg-blue-500 text-white' : 'text-gray-800 bg-gray-100 hover:bg-blue-100 hover:text-blue-700'}`;

        return html`
        <button class="${classes}" @click=${() => {
            const newYear = state.pickerYear;
            const currentYear = state.currentMonth.getFullYear();

            // If the year has changed, update the currentYearData
            if (newYear !== currentYear) {
                const newCurrentYearData = state.yearlyData[newYear] || { activities: {}, leaveOverrides: {} };
                setState({ currentYearData: newCurrentYearData });
            }
            
            const newMonth = new Date(newYear, index, 1);
            const lastDayOfNewMonth = new Date(newYear, index + 1, 0).getDate();
            let newSelectedDate = new Date(state.selectedDate);
            if (newSelectedDate.getDate() > lastDayOfNewMonth) {
                newSelectedDate.setDate(lastDayOfNewMonth);
            }
            newSelectedDate.setMonth(index);
            newSelectedDate.setFullYear(newYear);

            setState({ currentMonth: newMonth, selectedDate: newSelectedDate });
            updateView();
            DOM.monthPickerModal.classList.remove('visible');
        }}>${name}</button>`;
    });

    render(html`${months}`, DOM.monthGrid);
}

function getYYYYMMDD(date) {
    return format(date, 'yyyy-MM-dd');
}

function formatDateForDisplay(dateString) {
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(i18n.currentLang, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTextForDisplay(text, highlightQuery = '') {
    const safeText = text || '';

    if (!highlightQuery) {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = safeText;
        return tempDiv.innerHTML.replace(/\n/g, '<br>');
    }

    const escapedQuery = highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = safeText.split(new RegExp(`(${escapedQuery})`, 'gi'));

    return parts.map(part => {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = part;
        const escapedPart = tempDiv.innerHTML.replace(/\n/g, '<br>');

        if (part.toLowerCase() === highlightQuery.toLowerCase()) {
            return `<span class="search-highlight">${escapedPart}</span>`;
        }
        return escapedPart;
    }).join('');
}

// FIX: Overhaul subscribeToData to handle new nested data structure
async function subscribeToData(userId, callback) {
    const userDocRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
        // Prevent external updates from overwriting local state while user is typing
        if (state.editingInlineTimeKey) {
            return;
        }

        let data = docSnapshot.exists() ? docSnapshot.data() : {};

        // Last Write Wins: Ignore if server data is older than our local optimistic state
        if (data.lastUpdated && data.lastUpdated < state.lastUpdated) {
            return;
        }
        
        const year = state.currentMonth.getFullYear();
        const yearlyData = data.yearlyData || {};
        const currentYearData = yearlyData[year] || { activities: {}, leaveOverrides: {} };

        // Check for legacy isPro or new role field
        let userRole = data.role || 'standard';

        // Enforce Expiry
        if (userRole === 'pro' && data.proExpiry) {
            const expiry = data.proExpiry.toDate ? data.proExpiry.toDate() : new Date(data.proExpiry.seconds * 1000);
            if (expiry < new Date()) {
                userRole = 'standard';
            }
        }

        if (userRole === 'standard' && data.isPro) {
            userRole = 'pro';
        }

        setState({
            yearlyData: yearlyData,
            currentYearData: currentYearData,
            leaveTypes: data.leaveTypes || [],
            currentTeam: data.teamId || null,
            teamRole: data.teamRole || null,
            userRole: userRole
        });

        // Render admin button if applicable
        renderAdminButton();

        updateView();

        if (callback) {
            callback();
            callback = null;
        }
    });
    setState({ unsubscribeFromFirestore: unsubscribe });
}

async function subscribeToTeamData(callback) {
    if (!state.currentTeam) {
        if (callback) callback();
        return;
    }

    // Subscribe to team document
    const teamDocRef = doc(db, "teams", state.currentTeam);
    const unsubscribeTeam = onSnapshot(teamDocRef, (doc) => {
        if (doc.exists()) {
            const teamData = doc.data();
            const membersArray = Object.values(teamData.members || {});
            setState({
                teamName: teamData.name,
                teamMembers: membersArray
            });

            // If user is admin, load all member data for the dashboard
            if (state.teamRole === TEAM_ROLES.ADMIN) {
                loadTeamMembersData();
            }
            updateView();
        } else {
            // This can happen if the team is deleted.
            cleanupTeamSubscriptions();
            setState({ currentTeam: null, teamRole: null, teamName: null, teamMembers: [], teamMembersData: {} });
            updateView();
        }
    });

    setState({ unsubscribeFromTeam: unsubscribeTeam });

    if (callback) callback();
}

async function loadTeamMembersData() {
    // Clean up existing member summary listeners
    if (state.unsubscribeFromTeamMembers) {
        state.unsubscribeFromTeamMembers.forEach(unsub => unsub());
    }

    if (!state.currentTeam) return;

    const summaryCollectionRef = collection(db, "teams", state.currentTeam, "member_summaries");

    const unsubscribe = onSnapshot(summaryCollectionRef, (snapshot) => {
        const teamMembersData = { ...state.teamMembersData }; // Preserve existing data

        snapshot.docChanges().forEach((change) => {
            if (change.type === "removed") {
                delete teamMembersData[change.doc.id];
            } else {
                teamMembersData[change.doc.id] = change.doc.data();
            }
        });

        setState({ teamMembersData });

        // If the dashboard is currently open, re-render it
        if (DOM.teamDashboardModal.classList.contains('visible')) {
            renderTeamDashboard();
        }
    }, (error) => {
        console.error("Error listening to team member summaries:", error);
        showMessage(i18n.t("msgRealTimeTeamError"), "error");
    });

    setState({ unsubscribeFromTeamMembers: [unsubscribe] });
}

async function triggerTeamSync() {
    if (!state.isOnlineMode || !state.userId || !state.currentTeam) return;

    try {
        console.log("Triggering team summary sync...");
        const syncCallable = httpsCallable(functions, 'syncTeamMemberSummary');
        // We don't await this to keep the UI responsive, but we catch errors.
        syncCallable().then(() => {
            console.log("Team summary synced successfully.");
        }).catch(error => {
             console.error("Failed to sync team summary:", error);
        });
    } catch (error) {
        console.error("Error triggering team sync:", error);
    }
}

function cleanupTeamSubscriptions() {
    if (state.unsubscribeFromTeam) {
        state.unsubscribeFromTeam();
        setState({ unsubscribeFromTeam: null });
    }

    state.unsubscribeFromTeamMembers.forEach(unsub => unsub());
    setState({ unsubscribeFromTeamMembers: [] });
}

async function persistData(data, partialUpdate = null) {
    if (state.isOnlineMode && state.userId) {
        try {
            await saveDataToFirestore(data, partialUpdate);
        } catch (error) {
            console.error("Error saving to Firestore:", error);
            showMessage(i18n.t("msgSaveError"), 'error');
        }
    } else {
        saveDataToLocalStorage(data);
    }
}

function handleSaveNote(dayDataCopy, payload) {
    if (payload && payload.trim()) {
        dayDataCopy.note = payload;
    } else {
        dayDataCopy.note = '';
    }
}

function handleAddSlot(dayDataCopy) {
    let newTimeKey = "00:00", counter = 0;
    while (dayDataCopy[newTimeKey]) {
        newTimeKey = `00:00-${++counter}`;
    }
    const existingKeys = Object.keys(dayDataCopy).filter(k => k !== '_userCleared' && k !== 'note' && k !== 'leave');
    const maxOrder = existingKeys.length > 0 ? Math.max(...Object.values(dayDataCopy).filter(v => typeof v === 'object').map(v => v.order || 0)) : -1;
    dayDataCopy[newTimeKey] = { text: "", order: maxOrder + 1 };
    delete dayDataCopy._userCleared;
    return { message: i18n.t("newSlotAdded"), newTimeKey };
}

function handleUpdateActivityText(dayDataCopy, payload) {
    if (dayDataCopy[payload.timeKey]) {
        dayDataCopy[payload.timeKey].text = payload.newText;
    } else {
        const order = Object.keys(dayDataCopy).filter(k => k !== '_userCleared' && k !== 'note' && k !== 'leave').length;
        dayDataCopy[payload.timeKey] = { text: payload.newText, order };
    }
    delete dayDataCopy._userCleared;
    return i18n.t("activityUpdated");
}

function handleUpdateTime(dayDataCopy, payload) {
    const { oldTimeKey, newTimeKey } = payload;
    if (!newTimeKey) {
        showMessage(i18n.t("msgTimeEmpty"), 'error');
        return null;
    }
    if (dayDataCopy[newTimeKey] && oldTimeKey !== newTimeKey) {
        showMessage(i18n.t("msgTimeExists").replace('{time}', newTimeKey), 'error');
        return null;
    }

    if (oldTimeKey !== newTimeKey && dayDataCopy.hasOwnProperty(oldTimeKey)) {
        dayDataCopy[newTimeKey] = dayDataCopy[oldTimeKey];
        delete dayDataCopy[oldTimeKey];
    }
    return i18n.t("timeUpdated");
}

// FIX: Update saveData to work with multi-year structure and granular updates
async function saveData(action) {
    const timestamp = Date.now();
    state.lastUpdated = timestamp;

    const dateKey = getYYYYMMDD(state.selectedDate);
    const year = state.selectedDate.getFullYear();

    const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));
    if (!updatedYearlyData[year]) {
        updatedYearlyData[year] = { activities: {}, leaveOverrides: {} };
    }
    const dayDataCopy = { ...(updatedYearlyData[year].activities[dateKey] || {}) };

    let successMessage = null;
    let partialUpdate = null;

    // Check if it's a new day (empty or just userCleared)
    const hasPersistedActivities = updatedYearlyData[year].activities[dateKey] && Object.keys(updatedYearlyData[year].activities[dateKey]).filter(key => key !== '_userCleared' && key !== 'note' && key !== 'leave').length > 0;
    const isNewDay = !hasPersistedActivities && !dayDataCopy._userCleared;
    let populatedDefaultSlots = false;

    if (isNewDay && (action.type === ACTION_TYPES.ADD_SLOT || action.type === ACTION_TYPES.UPDATE_ACTIVITY_TEXT)) {
        if (state.selectedDate.getDay() !== 0) {
            for (let h = 8; h <= 17; h++) {
                const timeKey = `${String(h).padStart(2, '0')}:00-${String(h + 1).padStart(2, '0')}:00`;
                if (!dayDataCopy[timeKey]) dayDataCopy[timeKey] = { text: "", order: h - 8 };
            }
            populatedDefaultSlots = true;
        }
    }

    let addSlotResult = null;

    switch (action.type) {
        case ACTION_TYPES.SAVE_NOTE:
            handleSaveNote(dayDataCopy, action.payload);
            break;
        case ACTION_TYPES.ADD_SLOT:
            addSlotResult = handleAddSlot(dayDataCopy);
            successMessage = addSlotResult.message;
            break;
        case ACTION_TYPES.UPDATE_ACTIVITY_TEXT:
            successMessage = handleUpdateActivityText(dayDataCopy, action.payload);
            break;
        case ACTION_TYPES.UPDATE_TIME:
            successMessage = handleUpdateTime(dayDataCopy, action.payload);
            if (successMessage === null) {
                return;
            }
            break;
    }

    updatedYearlyData[year].activities[dateKey] = dayDataCopy;
    const currentYearData = updatedYearlyData[year] || { activities: {}, leaveOverrides: {} };
    const originalYearlyData = state.yearlyData;

    // Optimistic UI update
    setState({ yearlyData: updatedYearlyData, currentYearData: currentYearData });
    updateView();

    // Construct Partial Update for Firestore
    const basePath = `yearlyData.${year}.activities.${dateKey}`;

    if (populatedDefaultSlots) {
        // If we populated default slots, update the whole day object
        partialUpdate = {
            [basePath]: dayDataCopy
        };
    } else {
        // Granular updates
        partialUpdate = {};

        // Handle _userCleared flag removal
        if (dayDataCopy._userCleared === undefined && originalYearlyData[year]?.activities?.[dateKey]?._userCleared) {
             partialUpdate[`${basePath}._userCleared`] = deleteField();
        }

        if (action.type === ACTION_TYPES.SAVE_NOTE) {
             partialUpdate[`${basePath}.note`] = dayDataCopy.note || "";
        } else if (action.type === ACTION_TYPES.ADD_SLOT && addSlotResult) {
             const { newTimeKey } = addSlotResult;
             partialUpdate[`${basePath}.${newTimeKey}`] = dayDataCopy[newTimeKey];
        } else if (action.type === ACTION_TYPES.UPDATE_ACTIVITY_TEXT) {
             const { timeKey, newText } = action.payload;
             // Ensure we update the whole slot object if it was just created (rare race) or just the text if it existed
             if (originalYearlyData[year]?.activities?.[dateKey]?.[timeKey]) {
                 partialUpdate[`${basePath}.${timeKey}.text`] = newText;
             } else {
                 partialUpdate[`${basePath}.${timeKey}`] = dayDataCopy[timeKey];
             }
        } else if (action.type === ACTION_TYPES.UPDATE_TIME) {
             const { oldTimeKey, newTimeKey } = action.payload;
             partialUpdate[`${basePath}.${oldTimeKey}`] = deleteField();
             partialUpdate[`${basePath}.${newTimeKey}`] = dayDataCopy[newTimeKey];
        }
    }

    const dataToSave = {
        yearlyData: updatedYearlyData,
        leaveTypes: state.leaveTypes,
        lastUpdated: timestamp
    };

    // If migrating away from old structure, implicitly remove old field
    if (state.isOnlineMode && state.yearlyData.activities) {
        dataToSave.activities = deleteField();
        if (partialUpdate) partialUpdate['activities'] = deleteField();
    }

    if (partialUpdate) {
        partialUpdate.lastUpdated = timestamp;
    }

    try {
        await persistData(dataToSave, partialUpdate);
        if (successMessage) showMessage(successMessage, 'success');
    } catch (error) {
        console.error("Error persisting data:", error);
        showMessage(i18n.t("msgSaveRevertError"), 'error');
        const revertedCurrentYearData = originalYearlyData[year] || { activities: {}, leaveOverrides: {} };
        setState({ yearlyData: originalYearlyData, currentYearData: revertedCurrentYearData });
        updateView();
    }
}

function loadDataFromLocalStorage() {
    try {
        const storedDataString = localStorage.getItem('guestUserData');
        if (!storedDataString) {
            return { yearlyData: {}, leaveTypes: [] };
        }
        let data = JSON.parse(storedDataString);
        return data;

    } catch (error) {
        console.error("Error loading local data:", error);
        showMessage(i18n.t("msgLoadLocalError"), 'error');
        return { yearlyData: {}, leaveTypes: [] };
    }
}

function saveDataToLocalStorage(data) {
    try {
        // FIX: Store under the new key/structure
        localStorage.setItem('guestUserData', JSON.stringify(data));
    } catch (error) {
        console.error("Error saving local data:", error);
        showMessage(i18n.t("msgSaveLocalError"), 'error');
    }
}

async function saveDataToFirestore(data, partialUpdate = null) {
    if (!state.userId) return;

    if (partialUpdate) {
        try {
            await updateDoc(doc(db, "users", state.userId), partialUpdate);
            return;
        } catch (e) {
            // Fallback to full save if partial update fails (e.g. document doesn't exist)
            console.warn("Partial update failed, falling back to full merge:", e);
        }
    }
    // FIX: Save with the new data structure
    await setDoc(doc(db, "users", state.userId), data, { merge: true });
}

function loadOfflineData() {
    localStorage.setItem('sessionMode', 'offline');
    const data = loadDataFromLocalStorage(); // This now handles migration

    const year = state.currentMonth.getFullYear();
    const yearlyData = data.yearlyData || {};
    const currentYearData = yearlyData[year] || { activities: {}, leaveOverrides: {} };

    setState({
        yearlyData: yearlyData,
        currentYearData: currentYearData,
        leaveTypes: data.leaveTypes || [],
        isOnlineMode: false,
        userId: null
    });

    // Switch directly to app view
    switchView(DOM.appView, DOM.loginView, updateView);
}

async function resetAllData() {
    const button = DOM.confirmResetModal.querySelector('#confirm-reset-btn');
    setButtonLoadingState(button, true);
    await waitForDOMUpdate();

    // Define the reset state
    const resetState = {
        yearlyData: {},
        currentYearData: { activities: {}, leaveOverrides: {} },
        leaveTypes: []
    };

    if (state.isOnlineMode && state.userId) {
        try {
            // Overwrite the user's document with a cleared state
            await setDoc(doc(db, "users", state.userId), {
                yearlyData: {},
                leaveTypes: []
                // We leave team info intact
            }, { merge: false }); // merge:false replaces the document

            // This will trigger onSnapshot, which will update the local state.
            triggerTeamSync();
            showMessage(i18n.t("msgCloudResetSuccess"), 'success');

        } catch (error) {
            console.error("Error resetting cloud data:", error);
            showMessage(i18n.t("msgCloudResetError"), 'error');
        }
    } else {
        // FIX: Clear the new local storage key
        localStorage.removeItem('guestUserData'); 
        setState(resetState);
        updateView();
        showMessage(i18n.t("msgLocalResetSuccess"), 'success');
    }

    DOM.confirmResetModal.classList.remove('visible');
    setButtonLoadingState(button, false);
}

async function updateActivityOrder() {
    const dateKey = getYYYYMMDD(state.selectedDate);
    const year = state.selectedDate.getFullYear();
    const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));

    if (!updatedYearlyData[year] || !updatedYearlyData[year].activities[dateKey]) {
        return;
    }

    const dayData = updatedYearlyData[year].activities[dateKey];
    const orderedTimeKeys = Array.from(DOM.dailyActivityTableBody.children).map(row => row.dataset.time);
    const newDayData = {};

    if (dayData.note) newDayData.note = dayData.note;
    if (dayData.leave) newDayData.leave = dayData.leave;
    if (dayData._userCleared) newDayData._userCleared = true;

    orderedTimeKeys.forEach((timeKey, index) => {
        const originalEntry = dayData[timeKey] || { text: '' };
        newDayData[timeKey] = { ...originalEntry, order: index };
    });

    updatedYearlyData[year].activities[dateKey] = newDayData;
    const currentYearData = updatedYearlyData[year];

    setState({ yearlyData: updatedYearlyData, currentYearData: currentYearData });

    try {
        const timestamp = Date.now();
        state.lastUpdated = timestamp;
        await persistData({ yearlyData: updatedYearlyData, leaveTypes: state.leaveTypes, lastUpdated: timestamp });
        showMessage(i18n.t("msgActivitiesReordered"), 'success');
    } catch (error) {
        console.error("Failed to reorder activities:", error);
        showMessage(i18n.t("msgOrderSaveError"), "error");
        // NOTE: Consider rolling back state on error
    }
}

async function deleteActivity(dateKey, timeKey) {
    const timestamp = Date.now();
    state.lastUpdated = timestamp;

    const year = new Date(dateKey).getFullYear();
    const originalYearlyData = JSON.parse(JSON.stringify(state.yearlyData));
    const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));

    if (!updatedYearlyData[year] || !updatedYearlyData[year].activities[dateKey] || !updatedYearlyData[year].activities[dateKey][timeKey]) {
        return;
    }

    try {
        // Perform the deletion from the copied data
        delete updatedYearlyData[year].activities[dateKey][timeKey];

        const dayHasNoMoreActivities = Object.keys(updatedYearlyData[year].activities[dateKey]).filter(k => k !== '_userCleared' && k !== 'note' && k !== 'leave').length === 0;
        if (dayHasNoMoreActivities) {
            updatedYearlyData[year].activities[dateKey]._userCleared = true;
        }

        const currentYearData = updatedYearlyData[year];

        // Optimistic UI update
        setState({ yearlyData: updatedYearlyData, currentYearData: currentYearData });
        updateView();

        // Persist the changes
        if (state.isOnlineMode && state.userId) {
            const userDocRef = doc(db, "users", state.userId);
            const fieldPathToDelete = `yearlyData.${year}.activities.${dateKey}.${timeKey}`;
            const updates = { 
                [fieldPathToDelete]: deleteField(),
                lastUpdated: timestamp
            };

            if (dayHasNoMoreActivities) {
                updates[`yearlyData.${year}.activities.${dateKey}._userCleared`] = true;
            }

            await updateDoc(userDocRef, updates);
        } else {
            saveDataToLocalStorage({ yearlyData: updatedYearlyData, leaveTypes: state.leaveTypes, lastUpdated: timestamp });
        }
        showMessage(i18n.t("msgActivityDeleted"), 'success');

    } catch (error) {
        console.error("Failed to delete activity:", error);
        showMessage(i18n.t("msgDeleteSaveError"), "error");
        // Rollback on error
        const currentYear = state.currentMonth.getFullYear();
        const rolledBackCurrentYearData = originalYearlyData[currentYear] || { activities: {}, leaveOverrides: {} };
        setState({ yearlyData: originalYearlyData, currentYearData: rolledBackCurrentYearData });
        updateView();
    }
}

// --- CSV Restore/Backup ---
function escapeCsvField(field) {
    const fieldStr = String(field || '');
    if (/[",\n]/.test(fieldStr)) {
        return `"${fieldStr.replace(/"/g, '""')}"`;
    }
    return fieldStr;
}

function downloadCSV() {
    const csvRows = [
        ["Type", "Detail1", "Detail2", "Detail3", "Detail4"] // Headers
    ];

    // Backup Leave Types and Leave Overrides
    state.leaveTypes.forEach(lt => {
        csvRows.push(["LEAVE_TYPE", lt.id, lt.name, lt.totalDays, lt.color]);
    });

    Object.keys(state.yearlyData).forEach(year => {
        const yearData = state.yearlyData[year];
        if (yearData.leaveOverrides) {
            Object.keys(yearData.leaveOverrides).forEach(leaveTypeId => {
                const overrideData = yearData.leaveOverrides[leaveTypeId] || {};
                if (overrideData.totalDays !== undefined || overrideData.hidden) {
                    csvRows.push([
                        "LEAVE_OVERRIDE",
                        year,
                        leaveTypeId,
                        overrideData.totalDays,
                        overrideData.hidden ? "TRUE" : "FALSE"
                    ]);
                }
            });
        }
    });

    // Get all date keys from all years and sort them
    const allDateKeys = Object.values(state.yearlyData)
        .filter(yearData => yearData.activities) // Guard against years with no activities object
        .flatMap(yearData => Object.keys(yearData.activities));
    const sortedDateKeys = [...new Set(allDateKeys)].sort();

    sortedDateKeys.forEach(dateKey => {
        const year = dateKey.substring(0, 4);
        const dayData = state.yearlyData[year]?.activities[dateKey];
        if (!dayData) return;

        // Backup Note, Leave, User Cleared Flag, and Activities for the day
        if (dayData.note) {
            csvRows.push(["NOTE", dateKey, dayData.note, "", ""]);
        }
        if (dayData.leave) {
            csvRows.push(["LEAVE", dateKey, dayData.leave.typeId, dayData.leave.dayType, ""]);
        }
        if (dayData._userCleared) {
            csvRows.push(["USER_CLEARED", dateKey, "", "", ""]);
        }
        const activities = Object.keys(dayData)
            .filter(key => key !== 'note' && key !== 'leave' && key !== '_userCleared')
            .map(timeKey => ({ time: timeKey, ...dayData[timeKey] }))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        activities.forEach(activity => {
            if (activity.text?.trim()) {
                csvRows.push(["ACTIVITY", dateKey, activity.time, activity.text, activity.order]);
            }
        });
    });

    if (csvRows.length <= 1) {
        return showMessage(i18n.t("msgNoBackupData"), 'info');
    }

    const csvString = csvRows.map(row => row.map(escapeCsvField).join(",")).join("\n");

    const link = document.createElement("a");
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvString);
    link.download = `TrackerBuddy_Backup_${getYYYYMMDD(new Date())}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const csvContent = e.target.result;
            
            // FIX: Use the multi-year copy structure
            const yearlyDataCopy = JSON.parse(JSON.stringify(state.yearlyData));
            const leaveTypesMap = new Map(state.leaveTypes.map(lt => [lt.id, { ...lt }]));

            const parsed = Papa.parse(csvContent, {
                skipEmptyLines: true
            });

            const rows = parsed.data;

            if (rows.length <= 1) {
                return showMessage(i18n.t("msgEmptyCSV"), 'error');
            }

            let processedRows = 0;
            // Skip the header row
            rows.slice(1).forEach(row => {
                if (row.length < 2) return;

                const [type, detail1, detail2, detail3, detail4] = row;
                let rowProcessed = false;
                // Trim potential whitespace from the type
                const recordType = (type || '').trim().toUpperCase();

                switch (recordType) {
                    case 'LEAVE_TYPE':
                        if (detail1 && detail2 && detail3 !== undefined && detail4) {
                            leaveTypesMap.set(detail1, {
                                id: detail1,
                                name: detail2,
                                totalDays: parseFloat(detail3) || 0,
                                color: detail4
                            });
                            rowProcessed = true;
                        }
                        break;

                    case 'LEAVE_OVERRIDE':
                        const year = detail1;
                        const leaveTypeId = detail2;
                        const totalDays = parseFloat(detail3);
                        if (year && leaveTypeId && !isNaN(totalDays)) {
                            if (!yearlyDataCopy[year]) yearlyDataCopy[year] = { activities: {}, leaveOverrides: {} };
                            if (!yearlyDataCopy[year].leaveOverrides) yearlyDataCopy[year].leaveOverrides = {};
                            yearlyDataCopy[year].leaveOverrides[leaveTypeId] = { totalDays };
                            rowProcessed = true;
                        }
                        break;

                    case 'NOTE':
                    case 'LEAVE':
                    case 'ACTIVITY':
                    case 'USER_CLEARED':
                        const dateKey = detail1;
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
                            console.warn(`Skipping row with invalid date format: ${dateKey}`);
                            return;
                        }
                        const activityYear = dateKey.substring(0, 4);

                        if (!yearlyDataCopy[activityYear]) yearlyDataCopy[activityYear] = { activities: {}, leaveOverrides: {} };
                        if (!yearlyDataCopy[activityYear].activities[dateKey]) yearlyDataCopy[activityYear].activities[dateKey] = {};

                        const dayData = yearlyDataCopy[activityYear].activities[dateKey];

                        if (recordType === 'NOTE') {
                            dayData.note = detail2;
                            rowProcessed = true;
                        } else if (recordType === 'LEAVE') {
                            dayData.leave = { typeId: detail2, dayType: detail3 || 'full' };
                            rowProcessed = true;
                        } else if (recordType === 'ACTIVITY') {
                            const time = detail2;
                            if (time) {
                                dayData[time] = { text: detail3 || "", order: isNaN(parseInt(detail4, 10)) ? 0 : parseInt(detail4, 10) };
                                rowProcessed = true;
                            }
                        } else if (recordType === 'USER_CLEARED') {
                            dayData._userCleared = true;
                            rowProcessed = true;
                        }
                        break;
                }
                if (rowProcessed) processedRows++;
            });

            const finalLeaveTypes = Array.from(leaveTypesMap.values());
            const currentYear = state.currentMonth.getFullYear();
            const newCurrentYearData = yearlyDataCopy[currentYear] || { activities: {}, leaveOverrides: {} };

            setState({
                leaveTypes: finalLeaveTypes,
                yearlyData: yearlyDataCopy,
                currentYearData: newCurrentYearData
            });

            await persistData({
                yearlyData: yearlyDataCopy,
                leaveTypes: finalLeaveTypes
            });
            triggerTeamSync();

            showMessage(i18n.t("msgRestoreSuccess").replace('{count}', processedRows), 'success');
            event.target.value = '';
            updateView();
        } catch (err) {
            console.error("Error during CSV restore:", err);
            showMessage(i18n.t("msgRestoreError"), 'error');
        }
    };
    reader.onerror = () => showMessage(i18n.t("msgReadError"), 'error');
    reader.readAsText(file);
}

function handleUserLogout() {
    if (state.unsubscribeFromFirestore) {
        state.unsubscribeFromFirestore();
    }

    // Clean up team subscriptions
    cleanupTeamSubscriptions();

    localStorage.removeItem('sessionMode');

    if (DOM.splashScreen) {
        DOM.splashScreen.style.zIndex = '-10';
        DOM.splashText.style.display = 'none';
        DOM.tapToBegin.style.display = 'none';
        DOM.splashLoading.style.display = 'none';
        DOM.splashText.classList.remove('animating-out');
        DOM.splashScreen.style.cursor = 'default';
    }

    setState({
        currentMonth: new Date(),
        selectedDate: new Date(),
        yearlyData: {},
        currentYearData: { activities: {}, leaveOverrides: {} },
        leaveTypes: [],
        userId: null,
        isOnlineMode: false,
        unsubscribeFromFirestore: null,
        logoTapCount: 0,
        currentTeam: null,
        teamName: null,
        teamRole: null,
        teamMembers: [],
        teamMembersData: {},
        unsubscribeFromTeam: null,
        unsubscribeFromTeamMembers: [],
        isUpdating: false,
        lastUpdated: 0
    });

    switchView(DOM.loginView, DOM.appView);
}

function initAuth() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            handleUserLogin(user);
        } else {
            const sessionMode = localStorage.getItem('sessionMode');
            if (sessionMode === 'offline') {
                loadOfflineData(); // Centralized offline data loading
            } else {
                switchView(DOM.loginView, DOM.loadingView);
            }
        }
        DOM.contentWrapper.style.opacity = '1';
        DOM.footer.style.opacity = '1';
    });
}

async function signUpWithEmail(email, password) {
    const button = DOM.emailSignupBtn;
    let hasError = false;
    if (!email) {
        setInputErrorState(document.getElementById('email-input'), true);
        hasError = true;
    }
    if (password.length < 6) {
        setInputErrorState(document.getElementById('password-input'), true);
        hasError = true;
    }
    if (hasError) {
        return showMessage(i18n.t("msgAuthRequired"), 'error');
    }

    setButtonLoadingState(button, true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        handleUserLogin(userCredential.user);
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            showMessage(i18n.t("msgAccountExists"), 'error');
        } else {
            showMessage(i18n.t("msgSignUpFailed").replace('{error}', error.message), 'error');
        }
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function editTeamName() {
    const button = DOM.editTeamNameModal.querySelector('#save-edit-team-name-btn');
    const newTeamName = DOM.newTeamNameInput.value.trim();

    if (!newTeamName) {
        showMessage(i18n.t("msgTeamNameRequired"), 'error');
        return;
    }

    setButtonLoadingState(button, true);
    try {
        const editTeamNameCallable = httpsCallable(functions, 'editTeamName');
        await editTeamNameCallable({ newTeamName: newTeamName, teamId: state.currentTeam });
        showMessage(i18n.t("msgTeamNameUpdated"), 'success');
        closeEditTeamNameModal();
    } catch (error) {
        console.error('Error updating team name:', error);
        showMessage(i18n.t("msgTeamNameUpdateFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function signInWithEmail(email, password) {
    const button = DOM.emailSigninBtn;
    let hasError = false;
    if (!email) {
        setInputErrorState(document.getElementById('email-input'), true);
        hasError = true;
    }
    if (!password) {
        setInputErrorState(document.getElementById('password-input'), true);
        hasError = true;
    }
    if (hasError) {
        return showMessage(i18n.t("msgEmailPasswordRequired"), 'error');
    }

    setButtonLoadingState(button, true);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        handleUserLogin(userCredential.user);
    } catch (error) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            showMessage(i18n.t("msgAuthFailed"), 'error');
        } else {
            showMessage(i18n.t("msgSignInFailed").replace('{error}', error.message), 'error');
        }
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function resetPassword(email) {
    const button = DOM.forgotPasswordBtn;
    if (!email) {
        setInputErrorState(document.getElementById('email-input'), true);
        return showMessage(i18n.t("msgEmailRequired"), 'info');
    }
    setButtonLoadingState(button, true);
    button.classList.add('loading');
    try {
        await sendPasswordResetEmail(auth, email);
        showMessage(i18n.t("msgResetEmailSent"), 'success');
    } catch (error) {
        showMessage(i18n.t("msgResetEmailFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
        button.classList.remove('loading');
    }
}

async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    const button = DOM.googleSigninBtn;
    setButtonLoadingState(button, true);
    try {
        const result = await signInWithPopup(auth, provider);
        handleUserLogin(result.user);
    } catch (error) {
        showMessage(i18n.t("msgGoogleSignInFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function appSignOut() {
    if (state.isOnlineMode) {
        try {
            await signOut(auth);
            handleUserLogout();
        } catch (error) {
            showMessage(i18n.t("msgSignOutFailed").replace('{error}', error.message), 'error');
        }
    } else {
        handleUserLogout();
    }
}

function applyTheme(theme) {
    const lightIcon = document.getElementById('theme-icon-light');
    const darkIcon = document.getElementById('theme-icon-dark');
    const themeColorMeta = document.getElementById('theme-color-meta');

    if (theme === 'dark') {
        document.body.classList.add('dark');
        lightIcon.classList.add('hidden');
        darkIcon.classList.remove('hidden');
        if (themeColorMeta) themeColorMeta.content = '#000000';
    } else {
        document.body.classList.remove('dark');
        lightIcon.classList.remove('hidden');
        darkIcon.classList.add('hidden');
        if (themeColorMeta) themeColorMeta.content = '#f0f2f5';
    }
}

function toggleTheme() {
    const isDark = document.body.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (systemPrefersDark) {
        applyTheme('dark');
    } else {
        applyTheme('light');
    }
}

function setupDoubleClickConfirm(element, actionKey, messageKey, callback) {
    element.addEventListener('click', (e) => {
        if (state.confirmAction[actionKey]) {
            callback(e);
            delete state.confirmAction[actionKey];
            element.classList.remove('confirm-action');
        } else {
            Object.keys(state.confirmAction).forEach(key => {
                const el = state.confirmAction[key].element;
                if (el) el.classList.remove('confirm-action');
            });
            state.confirmAction = {};

            state.confirmAction[actionKey] = {
                element: element,
                timeoutId: setTimeout(() => {
                    element.classList.remove('confirm-action');
                    delete state.confirmAction[actionKey];
                }, 3000)
            };
            element.classList.add('confirm-action');
            // If messageKey looks like a translation key (no spaces), translate it.
            // Otherwise use it as is (backward compatibility or literal string).
            const msg = (messageKey && !messageKey.includes(' ')) ? i18n.t(messageKey) : messageKey;
            showMessage(msg, 'info');
        }
    });
}

function handleMoveUpClick(currentRow) {
    if (currentRow.previousElementSibling) {
        DOM.dailyActivityTableBody.insertBefore(currentRow, currentRow.previousElementSibling);
        updateActivityOrder();
    }
}

function handleMoveDownClick(currentRow) {
    if (currentRow.nextElementSibling) {
        DOM.dailyActivityTableBody.insertBefore(currentRow.nextElementSibling, currentRow);
        updateActivityOrder();
    }
}

function handleInlineEditClick(event) {
    const target = event.currentTarget;
    if (state.editingInlineTimeKey && state.editingInlineTimeKey !== target.dataset.time) {
        DOM.dailyActivityTableBody.querySelector(`[data-time="${state.editingInlineTimeKey}"]`)?.blur();
    }
    target.classList.add('editing');
    setState({ editingInlineTimeKey: target.dataset.time });
}

function handleInlineEditBlur(event) {
    const target = event.currentTarget;
    if (state.editingInlineTimeKey === target.dataset.time) {
        if (target.classList.contains('time-editable')) {
            const oldTimeKey = state.editingInlineTimeKey;
            const newTimeKey = target.innerText.trim();

            // Only save if the time value has actually changed
            if (oldTimeKey !== newTimeKey) {
                saveData({ type: ACTION_TYPES.UPDATE_TIME, payload: { oldTimeKey, newTimeKey } });
            }
        } else {
            saveData({ type: ACTION_TYPES.UPDATE_ACTIVITY_TEXT, payload: { timeKey: target.dataset.time, newText: target.innerText.trim() } });
        }
        setState({ editingInlineTimeKey: null });
    }
    target.classList.remove('editing');
}

function handleInlineEditKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        event.currentTarget.blur();
    }
}

// --- Easter Egg Functions ---
function createMagicParticles() {
    if (isMobileDevice()) return; // Disable particles on mobile for performance

    const particleCount = 12;
    const container = DOM.logoContainer;
    if (!container) return;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'magic-particle';

        const angle = (i / particleCount) * 360;
        const radius = 40 + Math.random() * 20;
        const x = Math.cos(angle * Math.PI / 180) * radius;
        const y = Math.sin(angle * Math.PI / 180) * radius;

        particle.style.setProperty('--x', `${x}px`);
        particle.style.setProperty('--y', `${y}px`);

        const colors = ['#ffd700', '#ffec80', '#ffab40'];
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        container.appendChild(particle);

        setTimeout(() => {
            particle.remove();
        }, 800);
    }
}

function handleLogoTap() {
    state.logoTapCount++;

    if (navigator.vibrate) {
        navigator.vibrate(50);
    }

    DOM.appLogo.classList.add('is-shaking');
    setTimeout(() => {
        DOM.appLogo.classList.remove('is-shaking');
    }, 500);

    createMagicParticles();

    if (state.logoTapCount >= 7) {
        state.logoTapCount = 0;

        const returnToApp = () => {
            DOM.splashScreen.style.zIndex = '-10';
            DOM.splashScreen.style.display = 'none';
        };

        DOM.splashText.style.display = 'block';
        DOM.splashText.classList.remove('animating-out');
        DOM.tapToBegin.style.display = 'block';
        DOM.tapToBegin.classList.remove('hiding');
        DOM.splashLoading.style.display = 'none';

        DOM.splashScreen.style.display = 'flex';
        DOM.splashScreen.style.zIndex = '100';
        DOM.splashScreen.style.cursor = 'pointer';

        DOM.splashScreen.addEventListener('click', returnToApp, { once: true });
    }
}

function loadSplashScreenVideo() {
    const splashImage = document.getElementById('splash-image');
    if (!splashImage) return;

    const videoSrc = splashImage.dataset.videoSrc;
    if (!videoSrc) return;

    const video = document.createElement('video');
    video.id = 'splash-video';
    video.style.position = 'absolute';
    video.style.top = '50%';
    video.style.left = '50%';
    video.style.minWidth = '100%';
    video.style.minHeight = '100%';
    video.style.width = 'auto';
    video.style.height = 'auto';
    video.style.transform = 'translateX(-50%) translateY(-50%)';
    video.style.objectFit = 'cover';
    video.style.zIndex = '11';
    video.style.opacity = '0';
    video.style.transition = 'opacity 0.5s ease-in';
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;

    const source = document.createElement('source');
    source.src = videoSrc;
    source.type = 'video/mp4';
    video.appendChild(source);

    video.oncanplay = () => {
        video.style.opacity = '1';
    };

    splashImage.parentNode.insertBefore(video, splashImage.nextSibling);
}


// --- Leave Management ---
function getVisibleLeaveTypesForYear(year) {
    const yearData = state.yearlyData[year] || {};
    const overrides = yearData.leaveOverrides || {};
    return state.leaveTypes.filter(lt => !overrides[lt.id]?.hidden);
}

function openLeaveTypeModal(leaveType = null) {
    state.previousActiveElement = document.activeElement;
    DOM.leaveTypeModal.classList.add('visible');
    if (leaveType) {
        const year = state.currentMonth.getFullYear();
        const yearData = state.yearlyData[year] || {};
        const overrides = yearData.leaveOverrides || {};
        const totalDays = overrides[leaveType.id]?.totalDays ?? leaveType.totalDays;

        DOM.leaveTypeModalTitle.dataset.i18n = 'editLeaveType';
        DOM.leaveTypeModalTitle.innerHTML = i18n.t('editLeaveType');
        DOM.editingLeaveTypeId.value = leaveType.id;
        DOM.leaveNameInput.value = leaveType.name; // FIX: Use name here, not totalDays
        DOM.leaveDaysInput.value = totalDays;
        selectColorInPicker(leaveType.color);
        DOM.deleteLeaveTypeBtn.classList.remove('hidden');
    } else {
        DOM.leaveTypeModalTitle.dataset.i18n = 'addNewLeaveType';
        DOM.leaveTypeModalTitle.innerHTML = i18n.t('addNewLeaveType');
        DOM.editingLeaveTypeId.value = '';
        DOM.leaveNameInput.value = '';
        DOM.leaveDaysInput.value = '';
        selectColorInPicker(null);
        DOM.deleteLeaveTypeBtn.classList.add('hidden');
    }
    DOM.leaveNameInput.focus();
}

function closeLeaveTypeModal() {
    DOM.leaveTypeModal.classList.remove('visible');
    if (state.previousActiveElement) {
        state.previousActiveElement.focus();
        state.previousActiveElement = null;
    }
}

function setupColorPicker() {
    const colors = Object.keys(COLOR_MAP);
    DOM.leaveColorPicker.innerHTML = colors.map(color => `
        <button type="button" data-color="${color}" aria-label="Select color: ${COLOR_MAP[color]}" style="background-color: ${color};" class="w-10 h-10 rounded-full border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"></button>
    `).join('');
}

function selectColorInPicker(color) {
    DOM.leaveColorPicker.querySelectorAll('button').forEach(btn => {
        if (btn.dataset.color === color) {
            btn.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
        } else {
            btn.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-500');
        }
    });
}

async function saveLeaveType() {
    const button = DOM.leaveTypeModal.querySelector('#save-leave-type-btn');
    setButtonLoadingState(button, true);
    await waitForDOMUpdate();

    const id = DOM.editingLeaveTypeId.value || `lt_${new Date().getTime()}`;
    const name = DOM.leaveNameInput.value.trim();
    const totalDays = parseFloat(DOM.leaveDaysInput.value);
    const selectedColorEl = DOM.leaveColorPicker.querySelector('.ring-blue-500');
    const color = selectedColorEl ? selectedColorEl.dataset.color : null;

    if (!name || isNaN(totalDays) || !color) {
        showMessage(i18n.t("msgLeaveTypeFieldsRequired"), 'error');
        setButtonLoadingState(button, false);
        return;
    }

    const currentYear = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(currentYear);
    const isColorTaken = visibleLeaveTypes.some(lt => lt.color === color && lt.id !== id);
    if (isColorTaken) {
        showMessage(i18n.t("msgLeaveTypeColorConflict"), 'error');
        setButtonLoadingState(button, false);
        return;
    }

    const newLeaveTypes = [...state.leaveTypes];
    const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));
    const existingIndex = newLeaveTypes.findIndex(lt => lt.id === id);

    if (existingIndex > -1) {
        // Editing existing leave type
        const globalLeaveType = newLeaveTypes[existingIndex];
        // Update global name and color
        globalLeaveType.name = name;
        globalLeaveType.color = color;

        // Check if the totalDays for the current year is different from the global setting
        if (totalDays !== globalLeaveType.totalDays) {
            // Create or update the override for the current year
            if (!updatedYearlyData[currentYear]) {
                updatedYearlyData[currentYear] = { activities: {}, leaveOverrides: {} };
            }
            if (!updatedYearlyData[currentYear].leaveOverrides) {
                updatedYearlyData[currentYear].leaveOverrides = {};
            }
            updatedYearlyData[currentYear].leaveOverrides[id] = {
                ...(updatedYearlyData[currentYear].leaveOverrides[id] || {}),
                totalDays: totalDays
            };
        } else {
            // If the days are the same as global, remove the override for the current year
            if (updatedYearlyData[currentYear]?.leaveOverrides?.[id]) {
                delete updatedYearlyData[currentYear].leaveOverrides[id].totalDays;
                // Clean up empty override objects
                if (Object.keys(updatedYearlyData[currentYear].leaveOverrides[id]).length === 0) {
                    delete updatedYearlyData[currentYear].leaveOverrides[id];
                }
            }
        }
    } else {
        // Adding a new leave type - this is always a global addition
        newLeaveTypes.push({ id, name, totalDays, color });
    }

    // Optimistically update state
    const currentYearData = updatedYearlyData[currentYear] || { activities: {}, leaveOverrides: {} };
    setState({
        leaveTypes: newLeaveTypes,
        yearlyData: updatedYearlyData,
        currentYearData: currentYearData
    });

    // Persist changes
    try {
        const timestamp = Date.now();
        state.lastUpdated = timestamp;

        // Use granular update if possible
        if (state.isOnlineMode && state.userId) {
            const updates = {};
            const leaveTypesUpdate = { leaveTypes: newLeaveTypes };

            // Construct granular updates for leaveOverrides
            if (updatedYearlyData[currentYear]?.leaveOverrides) {
               updates[`yearlyData.${currentYear}.leaveOverrides`] = updatedYearlyData[currentYear].leaveOverrides;
            }

            const dataToSave = {
                leaveTypes: newLeaveTypes,
                lastUpdated: timestamp
            };

            if (updatedYearlyData[currentYear]) {
                dataToSave.yearlyData = {
                    [currentYear]: {
                        leaveOverrides: updatedYearlyData[currentYear].leaveOverrides || {}
                    }
                };
            }

            // We use setDoc with merge: true, which is fine for leaveTypes (array replacement)
            // and fine for leaveOverrides (map merge).
            // Crucially, we are NOT including 'activities' in dataToSave, so concurrent activity edits are safe.
            await saveDataToFirestore(dataToSave);
        } else {
            saveDataToLocalStorage({
                yearlyData: updatedYearlyData,
                leaveTypes: newLeaveTypes,
                lastUpdated: timestamp
            });
        }

        triggerTeamSync();
        showMessage(i18n.t("msgLeaveTypeSaved"), 'success');
    } catch (error) {
        console.error("Failed to save leave type:", error);
        showMessage(i18n.t("msgLeaveTypeSaveFailed"), 'error');
        // NOTE: Consider rolling back state
    } finally {
        closeLeaveTypeModal();
        updateView();
        setButtonLoadingState(button, false);
    }
}

async function deleteLeaveType() {
    const id = DOM.editingLeaveTypeId.value;
    if (!id) return;

    const currentYear = state.currentMonth.getFullYear();
    const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));

    // Ensure the year and leaveOverrides objects exist
    if (!updatedYearlyData[currentYear]) {
        updatedYearlyData[currentYear] = { activities: {}, leaveOverrides: {} };
    }
    if (!updatedYearlyData[currentYear].leaveOverrides) {
        updatedYearlyData[currentYear].leaveOverrides = {};
    }

    // Mark the leave type as hidden for the current year
    updatedYearlyData[currentYear].leaveOverrides[id] = {
        ...(updatedYearlyData[currentYear].leaveOverrides[id] || {}),
        hidden: true
    };

    // Remove all logged leaves of this type for the current year
    const yearActivities = updatedYearlyData[currentYear].activities || {};
    Object.keys(yearActivities).forEach(dateKey => {
        if (yearActivities[dateKey].leave?.typeId === id) {
            delete yearActivities[dateKey].leave;
        }
    });

    // Optimistically update local state
    const currentYearData = updatedYearlyData[currentYear];
    setState({
        yearlyData: updatedYearlyData,
        currentYearData: currentYearData
    });

    // Persist the changes
    try {
        const timestamp = Date.now();
        state.lastUpdated = timestamp;

        if (state.isOnlineMode && state.userId) {
            const batch = writeBatch(db);
            const userDocRef = doc(db, "users", state.userId);

            // 1. Update the hidden flag in leaveOverrides
            batch.update(userDocRef, {
                [`yearlyData.${currentYear}.leaveOverrides.${id}.hidden`]: true,
                lastUpdated: timestamp
            });

            // 2. Remove all activities with this leave type
            // We need to find them first (we already did this in memory)
            const yearActivities = state.yearlyData[currentYear]?.activities || {};
            let deleteCount = 0;

            Object.keys(yearActivities).forEach(dateKey => {
                if (yearActivities[dateKey].leave?.typeId === id) {
                    batch.update(userDocRef, {
                        [`yearlyData.${currentYear}.activities.${dateKey}.leave`]: deleteField()
                    });
                    deleteCount++;
                }
            });

            // Note: batch has limit of 500 ops. If user has > 500 leave days of this type (unlikely), this might fail.
            // Given the scale of this app, it's probably acceptable.
            await batch.commit();
        } else {
            saveDataToLocalStorage({
                yearlyData: updatedYearlyData,
                leaveTypes: state.leaveTypes,
                lastUpdated: timestamp
            });
        }

        triggerTeamSync();
        showMessage(i18n.t("msgLeaveTypeHidden").replace('{year}', currentYear), 'success');
    } catch (error) {
        console.error("Failed to hide leave type:", error);
        showMessage(i18n.t("msgLeaveTypeHideFailed"), 'error');
        // NOTE: A more robust implementation might roll back the state change here
    } finally {
        closeLeaveTypeModal();
        updateView(); // Re-render the UI with the updated state
    }
}

async function saveLeaveTypes() {
    const timestamp = Date.now();
    state.lastUpdated = timestamp;
    // Pass the entire state's yearlyData and leaveTypes to be persisted
    await persistData({ yearlyData: state.yearlyData, leaveTypes: state.leaveTypes, lastUpdated: timestamp });
    triggerTeamSync();
    if (!state.isOnlineMode) {
        updateView();
    }
    showMessage(i18n.t("msgLeaveTypesReordered"), 'success');
}

async function moveLeaveType(typeId, direction) {
    const newLeaveTypes = [...state.leaveTypes];
    const index = newLeaveTypes.findIndex(lt => lt.id === typeId);

    if (index === -1) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newLeaveTypes.length) return;

    [newLeaveTypes[index], newLeaveTypes[newIndex]] = [newLeaveTypes[newIndex], newLeaveTypes[index]];

    setState({ leaveTypes: newLeaveTypes });
    await saveLeaveTypes();
}

function renderLeavePills() {
    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);

    const pills = visibleLeaveTypes.map(lt => {
        const isSelected = state.isLoggingLeave && state.selectedLeaveTypeId === lt.id;
        const classes = `flex-shrink-0 truncate max-w-40 px-3 py-1.5 rounded-full text-sm font-semibold text-white shadow transition-transform transform hover:scale-105 ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`;

        return html`
        <button class="${classes}"
                style="background-color: ${lt.color};"
                data-id="${lt.id}">
            ${lt.name}
        </button>`;
    });

    render(html`${pills}`, DOM.leavePillsContainer);
}

function calculateLeaveBalances() {
    const balances = {};
    const leaveCounts = {};
    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);
    const currentActivities = state.currentYearData.activities || {};

    visibleLeaveTypes.forEach(lt => {
        leaveCounts[lt.id] = 0;
    });

    Object.values(currentActivities).forEach(dayData => {
        if (dayData.leave) {
            const leaveValue = dayData.leave.dayType === LEAVE_DAY_TYPES.HALF ? 0.5 : 1;
            if (leaveCounts.hasOwnProperty(dayData.leave.typeId)) {
                leaveCounts[dayData.leave.typeId] += leaveValue;
            }
        }
    });

    const yearData = state.yearlyData[year] || {};
    const overrides = yearData.leaveOverrides || {};

    visibleLeaveTypes.forEach(lt => {
        const totalDays = overrides[lt.id]?.totalDays ?? lt.totalDays;
        balances[lt.id] = totalDays - (leaveCounts[lt.id] || 0);
    });

    return balances;
}

function openLeaveOverviewModal(leaveTypeId) {
    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);
    const leaveType = visibleLeaveTypes.find(lt => lt.id === leaveTypeId);
    if (!leaveType) return;

    DOM.overviewLeaveTypeName.textContent = leaveType.name;
    DOM.overviewLeaveTypeName.title = leaveType.name;
    DOM.overviewLeaveTypeName.style.color = leaveType.color;

    const currentActivities = state.currentYearData.activities || {};
    const leaveDates = [];

    Object.keys(currentActivities).forEach(dateKey => {
        const dayData = currentActivities[dateKey];
        if (dayData.leave && dayData.leave.typeId === leaveTypeId) {
            leaveDates.push({
                date: dateKey,
                dayType: dayData.leave.dayType,
                formatted: formatDateForDisplay(dateKey)
            });
        }
    });

    leaveDates.sort((a, b) => new Date(a.date) - new Date(b.date));

    renderLeaveOverviewList(leaveDates, leaveType);
    DOM.leaveOverviewModal.classList.add('visible');
}

function closeLeaveOverviewModal() {
    DOM.leaveOverviewModal.classList.remove('visible');
}

function renderLeaveOverviewList(leaveDates, leaveType) {
    DOM.overviewLeaveDaysList.innerHTML = '';

    if (leaveDates.length === 0) {
        DOM.overviewNoLeavesMessage.classList.remove('hidden');
        return;
    }

    DOM.overviewNoLeavesMessage.classList.add('hidden');

    leaveDates.forEach(leaveDate => {
        const item = document.createElement('div');
        item.className = 'leave-overview-item flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors gap-y-2';
        item.dataset.dateKey = leaveDate.date;

        item.innerHTML = `
            <div class="flex items-center space-x-3 w-full sm:w-auto min-w-0">
                <div class="w-4 h-4 rounded-full flex-shrink-0" style="background-color: ${leaveType.color};"></div>
                <div class="flex-grow min-w-0">
                    <span class="font-medium truncate" title="${leaveDate.formatted}">${leaveDate.formatted}</span>
                </div>
            </div>
            <div class="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
                <div class="day-type-toggle relative flex w-28 h-8 items-center rounded-full bg-gray-200 p-1 cursor-pointer flex-shrink-0" data-selected-value="${leaveDate.dayType}">
                    <div class="toggle-bg absolute top-1 left-1 h-6 w-[calc(50%-0.25rem)] rounded-full bg-blue-500 shadow-md transition-transform duration-300 ease-in-out" style="transform: translateX(${leaveDate.dayType === 'half' ? '100%' : '0'});"></div>
                    <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold ${leaveDate.dayType === 'full' ? 'active' : ''}" data-value="full" data-i18n="full">${i18n.t('full')}</button>
                    <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold ${leaveDate.dayType === 'half' ? 'active' : ''}" data-value="half" data-i18n="half">${i18n.t('half')}</button>
                </div>
                <div class="flex items-center space-x-1 flex-shrink-0">
                    <button class="edit-leave-day-btn icon-btn" title="Edit this leave entry">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                    </button>
                    <button class="delete-leave-day-btn icon-btn text-red-500 hover:text-red-700 dark:text-red-500 dark:hover:text-red-700" title="Delete this leave entry">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        `;

        DOM.overviewLeaveDaysList.appendChild(item);
    });
}

async function editLeaveDay(dateKey) {
    // Close the overview modal
    closeLeaveOverviewModal();

    // Set up the customization modal with just this one day
    setState({
        leaveSelection: new Set([dateKey]),
        initialLeaveSelection: new Set([dateKey]),
        isLoggingLeave: false,
        selectedLeaveTypeId: null
    });

    // Open the customization modal
    openLeaveCustomizationModal();
}

async function deleteLeaveDay(dateKey) {
    const year = new Date(dateKey).getFullYear();
    const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));

    if (!updatedYearlyData[year] || !updatedYearlyData[year].activities || !updatedYearlyData[year].activities[dateKey] || !updatedYearlyData[year].activities[dateKey].leave) {
        return;
    }

    const originalLeaveTypeId = updatedYearlyData[year].activities[dateKey].leave.typeId;

    delete updatedYearlyData[year].activities[dateKey].leave;

    const currentYear = state.currentMonth.getFullYear();
    const currentYearData = updatedYearlyData[currentYear] || { activities: {}, leaveOverrides: {} };

    setState({
        yearlyData: updatedYearlyData,
        currentYearData: currentYearData
    });

    try {
        const timestamp = Date.now();
        state.lastUpdated = timestamp;
        await persistData({ yearlyData: updatedYearlyData, leaveTypes: state.leaveTypes, lastUpdated: timestamp });
        triggerTeamSync();
        showMessage(i18n.t("msgLeaveEntryDeleted"), 'success');
    } catch (error) {
        console.error("Failed to delete leave day:", error);
        showMessage(i18n.t("msgDeleteSaveError"), "error");
        // NOTE: A robust implementation might roll back the state change here.
    }

    // If the overview modal for the affected leave type is open, refresh it.
    if (DOM.leaveOverviewModal.classList.contains('visible')) {
        requestAnimationFrame(() => openLeaveOverviewModal(originalLeaveTypeId));
    }

    updateView();
}

function renderLeaveStats() {
    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);

    if (visibleLeaveTypes.length === 0) {
        render(html`<p class="text-center text-gray-500">${i18n.t('noLeaveTypesDefined')}</p>`, DOM.leaveStatsSection);
        return;
    }

    const balances = calculateLeaveBalances();
    const yearData = state.yearlyData[year] || {};
    const overrides = yearData.leaveOverrides || {};

    const stats = visibleLeaveTypes.map((lt, index) => {
        const totalDays = overrides[lt.id]?.totalDays ?? lt.totalDays;
        const calculatedBalance = balances[lt.id] !== undefined ? balances[lt.id] : totalDays;
        const calculatedUsed = totalDays - calculatedBalance;

        const used = parseFloat(calculatedUsed.toFixed(2));
        const balance = parseFloat(calculatedBalance.toFixed(2));
        const percentage = totalDays > 0 ? Math.min(100, Math.max(0, (used / totalDays) * 100)) : 0;
        const isFirst = index === 0;
        const isLast = index === visibleLeaveTypes.length - 1;

        // Use arrow functions in event listeners to capture 'lt'
        return html`
            <div class="bg-white p-4 rounded-lg shadow relative border-2" style="border-color: ${lt.color};">
                <div class="flex justify-between items-start">
                    <div class="flex items-center min-w-0 pr-2">
                        <h4 class="font-bold text-base sm:text-lg truncate min-w-0 mr-2" style="color: ${lt.color};" title="${lt.name}">${lt.name}</h4>
                    </div>
                    
                    <div class="flex items-center -mt-2 -mr-2 flex-shrink-0">
                        <button class="info-leave-btn icon-btn text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0" data-id="${lt.id}" title="${i18n.t('viewLeaveDetails')}" aria-label="${i18n.t('viewLeaveDetails')} for ${lt.name}" @click=${() => openLeaveOverviewModal(lt.id)}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </button>
                        <button class="move-leave-btn icon-btn" data-id="${lt.id}" data-direction="-1" title="${i18n.t('moveUp')}" aria-label="${i18n.t('moveUp')} ${lt.name}" ?disabled=${isFirst} @click=${() => moveLeaveType(lt.id, -1)}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                        </button>
                        <button class="move-leave-btn icon-btn" data-id="${lt.id}" data-direction="1" title="${i18n.t('moveDown')}" aria-label="${i18n.t('moveDown')} ${lt.name}" ?disabled=${isLast} @click=${() => moveLeaveType(lt.id, 1)}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <button class="edit-leave-type-btn icon-btn" data-id="${lt.id}" title="${i18n.t('edit')}" aria-label="${i18n.t('edit')} ${lt.name}" @click=${() => openLeaveTypeModal(lt)}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-2 text-center">
                    <div class="bg-gray-100 p-2 rounded">
                        <p class="text-xs text-gray-500">${i18n.t('used')}</p>
                        <p class="font-bold text-lg sm:text-xl text-gray-800">${used}</p>
                    </div>
                    <div class="p-2 rounded balance-box">
                        <p class="text-xs stats-label">${i18n.t('balance')}</p>
                        <p class="font-bold text-lg sm:text-xl stats-value">${balance}</p>
                    </div>
                </div>
                <div class="bg-gray-100 p-2 rounded mt-2 text-center">
                    <p class="text-xs text-gray-500">${i18n.t('total')}</p>
                    <p class="font-bold text-lg sm:text-xl text-gray-800">${totalDays}</p>
                    <div class="progress-bg h-2 mt-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="progress-bar h-2 rounded-full transition-all duration-500" style="width: ${percentage}%; background-color: ${lt.color};"></div>
                    </div>
                </div>
            </div>
        `;
    });

    render(html`<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">${stats}</div>`, DOM.leaveStatsSection);
}

function openLeaveCustomizationModal() {
    if (state.leaveSelection.size === 0) {
        showMessage(i18n.t("msgSelectDayRequired"), 'info');
        return;
    }
    state.previousActiveElement = document.activeElement;
    setState({ initialLeaveSelection: new Set(state.leaveSelection) });
    DOM.customizeLeaveModal.classList.add('visible');
    renderLeaveCustomizationModal();
    // Focus first interactive element
    const firstButton = DOM.customizeLeaveModal.querySelector('button, input, select');
    if (firstButton) firstButton.focus();
}

function createLeaveTypeSelector(container, currentTypeId, onTypeChangeCallback) {
    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);
    const selectedType = visibleLeaveTypes.find(lt => lt.id === currentTypeId);

    let triggerHTML;
    if (currentTypeId === 'remove') {
        triggerHTML = `<span class="font-medium text-sm text-red-500">${i18n.t('noneWillBeRemoved')}</span>`;
    } else if (selectedType) {
        triggerHTML = `
            <span class="flex items-center w-full min-w-0">
                <span class="w-3 h-3 rounded-full mr-2 flex-shrink-0" style="background-color: ${selectedType.color};"></span>
                <span class="font-medium text-sm truncate min-w-0">${sanitizeHTML(selectedType.name)}</span>
            </span>
            <i class="fas fa-chevron-down text-xs text-gray-500 ml-1 flex-shrink-0"></i>`;
    } else {
        triggerHTML = `<span class="font-medium text-sm text-gray-500">${i18n.t('selectType')}</span>`;
    }

    container.innerHTML = `
        <button type="button" class="leave-type-selector-trigger w-full flex items-center justify-between px-3 py-1.5 border rounded-md shadow-sm text-left">
            ${triggerHTML}
        </button>
        <div class="leave-type-selector-panel">
            <div class="flex flex-col space-y-1">
                <button type="button" data-id="remove" class="leave-type-option w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center">
                    <i class="fas fa-times-circle w-3 h-3 mr-2 text-red-500"></i>
                    <span>${i18n.t('none')}</span>
                </button>
                ${visibleLeaveTypes.map(lt => `
                    <button type="button" data-id="${lt.id}" class="leave-type-option w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center min-w-0">
                        <span class="w-3 h-3 rounded-full mr-2 flex-shrink-0" style="background-color: ${lt.color};"></span>
                        <span class="truncate min-w-0" title="${sanitizeHTML(lt.name)}">${sanitizeHTML(lt.name)}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    const trigger = container.querySelector('.leave-type-selector-trigger');
    const panel = container.querySelector('.leave-type-selector-panel');
    trigger.dataset.typeId = currentTypeId || 'remove';

    const closePanel = () => panel.classList.remove('open');

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.leave-type-selector-panel.open').forEach(p => {
            if (p !== panel) p.classList.remove('open');
        });
        panel.classList.toggle('open');
    });

    panel.querySelectorAll('.leave-type-option').forEach(option => {
        option.addEventListener('click', () => {
            const newTypeId = option.dataset.id;
            trigger.dataset.typeId = newTypeId;

            let newTriggerHTML;
            if (newTypeId === 'remove') {
                newTriggerHTML = `<span class="font-medium text-sm text-red-500">${i18n.t('noneWillBeRemoved')}</span>`;
            } else {
                const newType = visibleLeaveTypes.find(lt => lt.id === newTypeId);

                newTriggerHTML = `
                    <span class="flex items-center w-full min-w-0">
                        <span class="w-3 h-3 rounded-full mr-2 flex-shrink-0" style="background-color: ${newType.color};"></span>
                        <span class="font-medium text-sm truncate min-w-0">${sanitizeHTML(newType.name)}</span>
                    </span>
                    <i class="fas fa-chevron-down text-xs text-gray-500 ml-1 flex-shrink-0"></i>`;
            }
            trigger.innerHTML = newTriggerHTML;

            closePanel();
            if (onTypeChangeCallback) {
                onTypeChangeCallback(newTypeId);
            }
        });
    });

    document.addEventListener('click', closePanel, { once: true });
    container.addEventListener('click', e => e.stopPropagation());
}

function setupDayTypeToggle(toggleElement) {
    const bg = toggleElement.querySelector('.toggle-bg');
    const buttons = toggleElement.querySelectorAll('.toggle-btn');

    const updateUI = (value) => {
        const isHalf = value === LEAVE_DAY_TYPES.HALF;
        bg.style.transform = `translateX(${isHalf ? '100%' : '0'})`;
        buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.value === value));
    };

    updateUI(toggleElement.dataset.selectedValue || LEAVE_DAY_TYPES.FULL);

    toggleElement.addEventListener('click', (e) => {
        const clickedButton = e.target.closest('.toggle-btn');
        if (!clickedButton) return;

        const value = clickedButton.dataset.value;
        if (toggleElement.dataset.selectedValue === value) return;

        toggleElement.dataset.selectedValue = value;
        updateUI(value);

        if (toggleElement.id === 'bulk-day-type-toggle') {
            document.querySelectorAll('#leave-days-list .day-type-toggle').forEach(itemToggle => {
                itemToggle.dataset.selectedValue = value;
                const itemBg = itemToggle.querySelector('.toggle-bg');
                const itemButtons = itemToggle.querySelectorAll('.toggle-btn');
                itemBg.style.transform = `translateX(${value === LEAVE_DAY_TYPES.HALF ? '100%' : '0'})`;
                itemButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.value === value));
            });
        }
    });
}

function renderLeaveCustomizationModal() {
    const list = DOM.leaveDaysList;
    list.innerHTML = '';
    const sortedDates = Array.from(state.leaveSelection).sort();
    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);

    const updateIndividualSelectorDisplay = (container, newTypeId) => {
        const trigger = container.querySelector('.leave-type-selector-trigger');
        if (!trigger) return;
        trigger.dataset.typeId = newTypeId;

        let newTriggerHTML;
        if (newTypeId === 'remove') {
            newTriggerHTML = `<span class="font-medium text-sm text-red-500">${i18n.t('noneWillBeRemoved')}</span>`;
        } else {
            const newType = visibleLeaveTypes.find(lt => lt.id === newTypeId);
            if (newType) {
                newTriggerHTML = `
                    <span class="flex items-center w-full min-w-0">
                        <span class="w-3 h-3 rounded-full mr-2 flex-shrink-0" style="background-color: ${newType.color};"></span>
                        <span class="font-medium text-sm truncate min-w-0">${newType.name}</span>
                    </span>
                    <i class="fas fa-chevron-down text-xs text-gray-500 ml-1 flex-shrink-0"></i>`;
            }
        }
        if (newTriggerHTML) {
            trigger.innerHTML = newTriggerHTML;
        }
    };

    const bulkPillsContainer = document.getElementById('modal-leave-pills-container');
    let modalBulkTypeId = state.selectedLeaveTypeId || visibleLeaveTypes[0]?.id;

    const renderBulkPills = () => {
        bulkPillsContainer.innerHTML = '';
        visibleLeaveTypes.forEach(lt => {
            const pill = document.createElement('button');
            pill.className = 'flex-shrink-0 truncate max-w-40 px-3 py-1.5 rounded-full text-sm font-semibold text-white shadow transition-transform transform hover:scale-105';
            pill.style.backgroundColor = lt.color;
            pill.textContent = lt.name;
            if (lt.id === modalBulkTypeId) {
                pill.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-800');
            }
            pill.addEventListener('click', () => {
                modalBulkTypeId = lt.id;
                renderBulkPills();
                list.querySelectorAll('.leave-type-selector').forEach(container => {
                    updateIndividualSelectorDisplay(container, modalBulkTypeId);
                });
            });
            bulkPillsContainer.appendChild(pill);
        });
    };

    renderBulkPills();
    setupDayTypeToggle(document.getElementById('bulk-day-type-toggle'));

    sortedDates.forEach(dateKey => {
        const item = document.createElement('div');
        item.className = 'leave-day-item flex flex-col sm:flex-row items-center justify-between p-3 rounded-lg shadow-sm border';
        item.dataset.dateKey = dateKey;

        const currentActivities = state.currentYearData.activities || {};
        const existingLeave = currentActivities[dateKey]?.leave;
        const currentLeaveTypeId = existingLeave ? existingLeave.typeId : modalBulkTypeId;
        const currentDayType = existingLeave ? existingLeave.dayType : LEAVE_DAY_TYPES.FULL;

        item.innerHTML = `
            <span class="font-medium mb-2 sm:mb-0 truncate min-w-0">${formatDateForDisplay(dateKey)}</span>
            <div class="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end min-w-0">
                <div class="leave-type-selector relative flex-grow w-full sm:w-36 min-w-0">
                </div>
                <div class="day-type-toggle relative flex w-28 h-8 items-center rounded-full bg-gray-200 p-1 cursor-pointer flex-shrink-0" data-selected-value="${currentDayType}">
                    <div class="toggle-bg absolute top-1 left-1 h-6 w-[calc(50%-0.25rem)] rounded-full bg-blue-500 shadow-md transition-transform duration-300 ease-in-out"></div>
                    <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold" data-value="full" data-i18n="full">${i18n.t('full')}</button>
                    <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold" data-value="half" data-i18n="half">${i18n.t('half')}</button>
                </div>
                <button class="delete-leave-day-btn text-red-500 hover:text-red-700 p-2 flex-shrink-0" title="Remove this day">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        list.appendChild(item);

        createLeaveTypeSelector(item.querySelector('.leave-type-selector'), currentLeaveTypeId);
        setupDayTypeToggle(item.querySelector('.day-type-toggle'));
    });

    list.querySelectorAll('.delete-leave-day-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.currentTarget.closest('[data-date-key]');
            if (item) {
                item.remove(); // Just remove the row visually
            }
        });
    });
}

async function saveLoggedLeaves() {
    const button = DOM.customizeLeaveModal.querySelector('#save-log-leave-btn');
    setButtonLoadingState(button, true);
    await waitForDOMUpdate();

    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);
    const currentActivities = state.currentYearData.activities || {};
    const balances = calculateLeaveBalances(); // This is now year-specific
    const modalItems = DOM.leaveDaysList.querySelectorAll('[data-date-key]');
    let balanceError = false;

    const changes = {};
    visibleLeaveTypes.forEach(lt => { changes[lt.id] = 0; });

    modalItems.forEach(item => {
        const dateKey = item.dataset.dateKey;
        const newTypeId = item.querySelector('.leave-type-selector-trigger').dataset.typeId;
        const newDayType = item.querySelector('.day-type-toggle').dataset.selectedValue;
        const newCost = newDayType === LEAVE_DAY_TYPES.HALF ? 0.5 : 1;
        const existingLeave = currentActivities[dateKey]?.leave;

        if (existingLeave) {
            const oldCost = existingLeave.dayType === LEAVE_DAY_TYPES.HALF ? 0.5 : 1;
            if (changes.hasOwnProperty(existingLeave.typeId)) {
                changes[existingLeave.typeId] -= oldCost;
            }
        }
        if (newTypeId !== 'remove' && changes.hasOwnProperty(newTypeId)) {
            changes[newTypeId] += newCost;
        }
    });

    for (const typeId in changes) {
        if (changes[typeId] > (balances[typeId] || 0)) {
            const leaveType = visibleLeaveTypes.find(lt => lt.id === typeId);
            if (leaveType) {
                showMessage(i18n.t("msgBalanceInsufficient").replace('{name}', leaveType.name), 'error');
                balanceError = true;
                break;
            }
        }
    }

    if (balanceError) {
        setButtonLoadingState(button, false);
        return;
    }

    const updatedActivities = { ...currentActivities };
    const datesInModal = new Set(Array.from(modalItems).map(item => item.dataset.dateKey));

    state.initialLeaveSelection.forEach(dateKey => {
        if (!datesInModal.has(dateKey) && updatedActivities[dateKey]?.leave) {
            delete updatedActivities[dateKey].leave;
        }
    });

    modalItems.forEach(item => {
        const dateKey = item.dataset.dateKey;
        updatedActivities[dateKey] = { ...(updatedActivities[dateKey] || {}) };
        const typeId = item.querySelector('.leave-type-selector-trigger').dataset.typeId;

        if (typeId === 'remove') {
            delete updatedActivities[dateKey].leave;
        } else {
            const dayType = item.querySelector('.day-type-toggle').dataset.selectedValue;
            updatedActivities[dateKey].leave = { typeId, dayType };
        }
    });

    const updatedYearData = { ...state.currentYearData, activities: updatedActivities };
    const updatedYearlyData = { ...state.yearlyData, [year]: updatedYearData };

    setState({ yearlyData: updatedYearlyData, currentYearData: updatedYearData });

    try {
        const timestamp = Date.now();
        state.lastUpdated = timestamp;

        if (state.isOnlineMode && state.userId) {
            const batch = writeBatch(db);
            const userDocRef = doc(db, "users", state.userId);
            let opCount = 0;

            // Handle deletions
            state.initialLeaveSelection.forEach(dateKey => {
                if (!datesInModal.has(dateKey) && state.yearlyData[year]?.activities[dateKey]?.leave) {
                    batch.update(userDocRef, {
                        [`yearlyData.${year}.activities.${dateKey}.leave`]: deleteField()
                    });
                    opCount++;
                }
            });

            // Handle updates/creations
            modalItems.forEach(item => {
                const dateKey = item.dataset.dateKey;
                const typeId = item.querySelector('.leave-type-selector-trigger').dataset.typeId;

                if (typeId === 'remove') {
                    // Check if it actually existed before trying to delete to save ops, or just blindly delete
                     batch.update(userDocRef, {
                        [`yearlyData.${year}.activities.${dateKey}.leave`]: deleteField()
                    });
                } else {
                    const dayType = item.querySelector('.day-type-toggle').dataset.selectedValue;
                    // We only update the 'leave' field of the activity object
                    // This preserves note, text, order, etc.
                    batch.update(userDocRef, {
                        [`yearlyData.${year}.activities.${dateKey}.leave`]: { typeId, dayType }
                    });
                }
                opCount++;
            });

            if (opCount > 0) {
                batch.update(userDocRef, { lastUpdated: timestamp });
                await batch.commit();
            }
        } else {
            saveDataToLocalStorage({ yearlyData: updatedYearlyData, leaveTypes: state.leaveTypes, lastUpdated: timestamp });
        }

        triggerTeamSync();
        showMessage(i18n.t("msgLeavesSaved"), 'success');
    } catch (error) {
        console.error("Failed to save logged leaves:", error);
        showMessage(i18n.t("msgLeavesSaveFailed"), "error");
    } finally {
        DOM.customizeLeaveModal.classList.remove('visible');
        if (state.previousActiveElement) {
            state.previousActiveElement.focus();
            state.previousActiveElement = null;
        }
        setState({ isLoggingLeave: false, selectedLeaveTypeId: null, leaveSelection: new Set(), initialLeaveSelection: new Set() });
        DOM.logNewLeaveBtn.innerHTML = `<i class="fas fa-calendar-plus mr-2"></i> ${i18n.t('logLeave')}`;
        DOM.logNewLeaveBtn.classList.replace('btn-danger', 'btn-primary');
        updateView();
        setButtonLoadingState(button, false);
    }
}

function handleBulkRemoveClick() {
    const list = DOM.leaveDaysList;
    list.querySelectorAll('.leave-day-item').forEach(item => {
        const selectorContainer = item.querySelector('.leave-type-selector');
        const trigger = selectorContainer.querySelector('.leave-type-selector-trigger');
        trigger.dataset.typeId = 'remove';
        trigger.innerHTML = `<span class="font-medium text-sm text-red-500">${i18n.t('noneWillBeRemoved')}</span>`;
    });
    showMessage(i18n.t("msgLeavesRemovalConfirmation"), 'info');
}

// --- Team Management Functions ---
function renderTeamSection() {
    const teamIcon = document.getElementById('team-icon');
    if (teamIcon) {
        if (state.currentTeam) {
            teamIcon.className = 'fa-solid fa-user w-5 h-5 mr-2';
        } else {
            teamIcon.className = 'fa-regular fa-user w-5 h-5 mr-2';
        }
    }

    if (!state.isOnlineMode) {
        render(html`<p class="text-center text-gray-500">${i18n.t('teamFeaturesOffline')}</p>`, DOM.teamSection);
        return;
    }

    // Check for Pro Access
    const isSuperAdmin = state.superAdmins.includes(auth.currentUser?.email);
    const isPro = state.userRole === 'pro' || state.userRole === 'co-admin' || isSuperAdmin;

    if (!state.currentTeam) {
        const createTeamTemplate = html`
            <div class="text-center">
                <h3 class="text-lg font-semibold mb-4">${i18n.t('teamManagement')}</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="team-card bg-gray-50 dark:bg-gray-800 p-4 sm:p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400 cursor-pointer transition-all">
                        <button id="create-team-btn" class="w-full text-left">
                            <div class="flex items-center justify-center mb-3 sm:mb-4">
                                <div class="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                    <svg class="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                    </svg>
                                </div>
                            </div>
                            <h4 class="text-lg sm:text-xl font-bold text-center mb-1 sm:mb-2">${i18n.t('createTeam')}</h4>
                            <p class="text-sm sm:text-base text-center text-gray-600 dark:text-gray-400">${i18n.t('createTeamDesc')}</p>
                        </button>
                    </div>
                    <div class="team-card bg-gray-50 dark:bg-gray-800 p-4 sm:p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-400 cursor-pointer transition-all">
                        <button id="join-team-btn" class="w-full text-left">
                            <div class="flex items-center justify-center mb-3 sm:mb-4">
                                <div class="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                    <svg class="w-6 h-6 sm:w-8 sm:h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                    </svg>
                                </div>
                            </div>
                            <h4 class="text-lg sm:text-xl font-bold text-center mb-1 sm:mb-2">${i18n.t('joinTeam')}</h4>
                            <p class="text-sm sm:text-base text-center text-gray-600 dark:text-gray-400">${i18n.t('joinTeamDesc')}</p>
                        </button>
                    </div>
                </div>
            </div>
        `;
        render(createTeamTemplate, DOM.teamSection);
    } else {
        // Has team - show team info and actions
        const isAdmin = state.teamRole === TEAM_ROLES.ADMIN;
        const memberCount = state.teamMembers.length || 0;

        const teamInfoTemplate = html`
            <div class="space-y-4 sm:space-y-6">
                <div class="text-center">
                    <h3 class="text-base sm:text-lg font-semibold mb-2 flex items-center justify-center">
                        <i class="fa-solid fa-user-group w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600"></i>
                        <span class="truncate">${sanitizeHTML(state.teamName || 'Your Team')}</span>
                        ${isAdmin ? html`
                        <button id="open-edit-team-name-btn" class="icon-btn ml-2 text-gray-500 hover:text-blue-600" title="Edit Team Name">
                            <svg class="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                        </button>
                        ` : ''}
                    </h3>
                    <p class="text-xs sm:text-base text-gray-600 dark:text-gray-400">${isAdmin ? i18n.t('youAreAdmin') : i18n.t('youAreMember')} • ${memberCount === 1 ? i18n.t('memberCount').replace('{count}', memberCount) : i18n.t('membersCount').replace('{count}', memberCount)}</p>
                </div>
                
                <div class="bg-white dark:bg-gray-100 p-3 sm:p-4 rounded-lg border">
                    <h4 class="font-semibold text-sm sm:text-base mb-2 sm:mb-3 text-center">${i18n.t('teamRoomCode')}</h4>
                    <div class="text-center">
                        <div class="room-code text-sm sm:text-base">
                            <span>${state.currentTeam}</span>
                            <button id="copy-room-code-btn" class="icon-btn hover:border hover:border-white ml-2" title="${i18n.t('copyCode')}">
                                <i class="fa-regular fa-copy text-white"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center mt-2 sm:mt-3">${i18n.t('shareCodeMessage')}</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-${isAdmin ? '3' : '2'} gap-3 sm:gap-4">
                    ${isAdmin ? html`
                        <button id="team-dashboard-btn" class="px-3 py-2 sm:px-4 sm:py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center text-sm sm:text-base">
                            <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                            ${i18n.t('teamDashboard')}
                        </button>
                    ` : ''}
                    <button id="edit-display-name-btn" class="px-3 py-2 sm:px-4 sm:py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center text-sm sm:text-base">
                        <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path>
                        </svg>
                        ${i18n.t('changeName')}
                    </button>
                    ${isAdmin ? html`
                        <button id="delete-team-btn" class="px-3 py-2 sm:px-4 sm:py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center text-sm sm:text-base">
                            <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                            ${i18n.t('deleteTeam')}
                        </button>
                    ` : html`
                        <button id="leave-team-btn" class="px-3 py-2 sm:px-4 sm:py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center text-sm sm:text-base">
                            <i class="fa-solid fa-door-open w-4 h-4 sm:w-5 sm:h-5 mr-2"></i>
                            ${i18n.t('leaveTeam')}
                        </button>
                    `}
                </div>
            </div>
        `;

        render(teamInfoTemplate, DOM.teamSection);
    }
}

function openCreateTeamModal() {
    const isSuperAdmin = state.superAdmins.includes(auth.currentUser?.email);
    const isPro = state.userRole === 'pro' || state.userRole === 'co-admin' || isSuperAdmin;

    // Reset visibility of content parts
    let upgradeMsg = DOM.createTeamModal.querySelector('#create-team-upgrade-msg');
    let formContent = DOM.createTeamModal.querySelector('.space-y-4');
    let buttons = DOM.createTeamModal.querySelector('.flex.justify-end');

    if (!isPro) {
        if (formContent) formContent.style.display = 'none';
        if (buttons) buttons.style.display = 'none';

        if (!upgradeMsg) {
            upgradeMsg = document.createElement('div');
            upgradeMsg.id = 'create-team-upgrade-msg';
            upgradeMsg.className = 'text-center py-4';
            upgradeMsg.innerHTML = `
                <div class="mx-auto mb-4 text-center">
                    <i class="fas fa-crown text-5xl text-yellow-500"></i>
                </div>
                <h3 class="text-xl font-bold mb-2">Pro Feature</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-6">
                    Creating a team is available for Pro users. Upgrade to manage your own team!
                </p>
                <button class="w-full px-6 py-3 btn-primary rounded-lg font-semibold" onclick="window.location.href='mailto:arunthomas04042001@gmail.com?subject=Upgrade%20to%20Pro'">
                    Upgrade to Pro
                </button>
                <div class="mt-4">
                    <button class="text-gray-500 hover:text-gray-700 text-sm" onclick="document.getElementById('create-team-modal').classList.remove('visible')">Close</button>
                </div>
            `;
            // Insert after title
            const title = DOM.createTeamModal.querySelector('h2');
            if (title) title.insertAdjacentElement('afterend', upgradeMsg);
        } else {
            upgradeMsg.style.display = 'block';
        }
    } else {
        // Is Pro
        if (formContent) formContent.style.display = 'block';
        if (buttons) buttons.style.display = 'flex';
        if (upgradeMsg) upgradeMsg.style.display = 'none';

        DOM.teamNameInput.value = '';
        if (DOM.teamAdminDisplayNameInput) {
            DOM.teamAdminDisplayNameInput.value = '';
        }
    }

    DOM.createTeamModal.classList.add('visible');
}

function closeCreateTeamModal() {
    DOM.createTeamModal.classList.remove('visible');
}

function openJoinTeamModal() {
    DOM.roomCodeInput.value = '';
    DOM.displayNameInput.value = '';
    DOM.joinTeamModal.classList.add('visible');
}

function closeJoinTeamModal() {
    DOM.joinTeamModal.classList.remove('visible');
}

function openEditDisplayNameModal() {
    // Find current user's display name
    const currentMember = state.teamMembers.find(m => m.userId === state.userId);
    DOM.newDisplayNameInput.value = currentMember?.displayName || '';
    DOM.editDisplayNameModal.classList.add('visible');
}

function closeEditDisplayNameModal() {
    DOM.editDisplayNameModal.classList.remove('visible');
}

function openEditTeamNameModal() {
    DOM.newTeamNameInput.value = state.teamName || '';
    DOM.editTeamNameModal.classList.add('visible');
}

function closeEditTeamNameModal() {
    DOM.editTeamNameModal.classList.remove('visible');
}

async function createTeam() {
    const button = DOM.createTeamModal.querySelector('#save-create-team-btn');
    const teamName = DOM.teamNameInput.value.trim();
    const displayName = DOM.teamAdminDisplayNameInput.value.trim();

    if (!teamName || !displayName) {
        showMessage(i18n.t("msgTeamCreateFieldsRequired"), 'error');
        return;
    }

    setButtonLoadingState(button, true);

    try {
        const createTeamCallable = httpsCallable(functions, 'createTeam');
        const result = await createTeamCallable({ teamName, displayName });

        showMessage(result.data.message, 'success');
        closeCreateTeamModal();

    } catch (error) {
        console.error('Error creating team:', error);
        showMessage(i18n.t("msgTeamCreateFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function joinTeam() {
    const button = DOM.joinTeamModal.querySelector('#save-join-team-btn');
    const roomCode = DOM.roomCodeInput.value.trim().toUpperCase();
    const displayName = DOM.displayNameInput.value.trim();

    if (!roomCode || !displayName) {
        showMessage(i18n.t("msgTeamJoinFieldsRequired"), 'error');
        return;
    }

    setButtonLoadingState(button, true);

    try {
        const joinTeamCallable = httpsCallable(functions, 'joinTeam');
        const result = await joinTeamCallable({ roomCode, displayName });

        showMessage(result.data.message, 'success');
        closeJoinTeamModal();
    } catch (error) {
        console.error('Error calling joinTeam function:', error);
        showMessage(i18n.t("msgTeamJoinFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function editDisplayName() {
    const button = DOM.editDisplayNameModal.querySelector('#save-edit-name-btn');
    const newDisplayName = DOM.newDisplayNameInput.value.trim();

    if (!newDisplayName) {
        showMessage(i18n.t("msgDisplayNameRequired"), 'error');
        return;
    }

    setButtonLoadingState(button, true);
    try {
        const editDisplayNameCallable = httpsCallable(functions, 'editDisplayName');
        await editDisplayNameCallable({ newDisplayName: newDisplayName, teamId: state.currentTeam });
        showMessage(i18n.t("msgDisplayNameUpdated"), 'success');
        closeEditDisplayNameModal();
    } catch (error) {
        console.error('Error updating display name:', error);
        showMessage(i18n.t("msgDisplayNameUpdateFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function leaveTeam(button) {
    try {
        const leaveTeamCallable = httpsCallable(functions, 'leaveTeam');
        await leaveTeamCallable({ teamId: state.currentTeam });
        showMessage(i18n.t("msgTeamLeftSuccess"), 'success');
    } catch (error) {
        console.error('Error leaving team:', error);
        showMessage(i18n.t("msgTeamLeftFailed").replace('{error}', error.message), 'error');
    } finally {
        if (button) setButtonLoadingState(button, false);
    }
}

async function deleteTeam(button) {
    try {
        const deleteTeamCallable = httpsCallable(functions, 'deleteTeam');
        await deleteTeamCallable({ teamId: state.currentTeam });
        showMessage(i18n.t("msgTeamDeletedSuccess"), 'success');
    } catch (error) {
        console.error('Error deleting team:', error);
        showMessage(i18n.t("msgTeamDeleteFailed").replace('{error}', error.message), 'error');
    } finally {
        if (button) setButtonLoadingState(button, false);
    }
}

function copyRoomCode() {
    navigator.clipboard.writeText(state.currentTeam).then(() => {
        showMessage(i18n.t("msgRoomCodeCopied"), 'success');
    }).catch(() => {
        showMessage(i18n.t("msgRoomCodeCopyFailed"), 'error');
    });
}

function openKickMemberModal(memberId, memberName) {
    DOM.kickModalText.innerHTML = i18n.t('confirmKickMessage').replace('{name}', sanitizeHTML(memberName));
    DOM.confirmKickModal.dataset.memberId = memberId;
    DOM.confirmKickModal.classList.add('visible');
}

function closeKickMemberModal() {
    DOM.confirmKickModal.classList.remove('visible');
}

async function kickMember() {
    const memberId = DOM.confirmKickModal.dataset.memberId;
    if (!memberId) return;

    const button = DOM.confirmKickModal.querySelector('#confirm-kick-btn');
    setButtonLoadingState(button, true);

    try {
        const kickTeamMemberCallable = httpsCallable(functions, 'kickTeamMember');
        await kickTeamMemberCallable({ teamId: state.currentTeam, memberId: memberId });
        showMessage(i18n.t("msgKickMemberSuccess"), 'success');
        closeKickMemberModal();
    } catch (error) {
        console.error('Error kicking member:', error);
        showMessage(i18n.t("msgKickMemberFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

function openTeamDashboard() {
    DOM.teamDashboardModal.classList.add('visible');
    renderTeamDashboard();
}

function closeTeamDashboard() {
    DOM.teamDashboardModal.classList.remove('visible');
}

function renderTeamDashboard() {
    // Remember which rows are open before re-rendering.
    const openMemberIds = new Set();
    DOM.teamDashboardContent.querySelectorAll('details[open]').forEach(detail => {
        if (detail.dataset.userId) {
            openMemberIds.add(detail.dataset.userId);
        }
    });
    if (!state.teamMembers || state.teamMembers.length === 0) {
        DOM.teamDashboardContent.innerHTML = `<p class="text-center text-gray-500">${i18n.t('loadingTeamData')}</p>`;
        return;
    }

    // Combine team member info with their summary data
    const combinedMembers = state.teamMembers.map(member => ({
        ...member,
        summary: state.teamMembersData[member.userId] || {}
    }));

    const admin = combinedMembers.find(m => m.role === TEAM_ROLES.ADMIN);
    const members = combinedMembers.filter(m => m.role !== TEAM_ROLES.ADMIN);
    const sortedMembers = [
        ...(admin ? [admin] : []),
        ...members.sort((a, b) => a.displayName.localeCompare(b.displayName))
    ];

    // FIX: Use the current year from the app's month view for the dashboard lookup
    const dashboardYear = state.currentMonth.getFullYear().toString(); 
    

    const membersHTML = sortedMembers.map(member => {
        // FIX: Look up balances using the correctly nested structure (yearlyLeaveBalances[year])
        const balances = member.summary.yearlyLeaveBalances ? (member.summary.yearlyLeaveBalances[dashboardYear] || {}) : {};
        const isAdmin = member.role === TEAM_ROLES.ADMIN;

        const leaveTypesHTML = Object.values(balances).length > 0
            ? '<div class="leave-stat-grid">' + Object.values(balances).map(balance => {
                const usedPercentage = balance.total > 0 ? (balance.used / balance.total) * 100 : 0;
                const radius = 26;
                const circumference = 2 * Math.PI * radius;
                const offset = circumference - (usedPercentage / 100) * circumference;

                return `
            <div class="leave-stat-card">
                <div class="radial-progress-container">
                    <svg class="w-full h-full" viewBox="0 0 60 60">
                        <circle class="radial-progress-bg" cx="30" cy="30" r="${radius}"></circle>
                        <circle class="radial-progress-bar"
                                cx="30" cy="30" r="${radius}"
                                stroke="${balance.color}"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="${offset}"
                                transform="rotate(-90 30 30)">
                        </circle>
                    </svg>
                    <div class="radial-progress-center-text" style="color: ${balance.color};">
                        ${Math.round(usedPercentage)}%
                    </div>
                </div>
                <div class="stat-card-info">
                    <h5>${sanitizeHTML(balance.name)}</h5>
                    <p>Balance: ${balance.balance} days</p>
                    <p>Used: ${balance.used} / ${balance.total} days</p>
                </div>
            </div>
        `;
            }).join('') + '</div>'
            : '';

        return `
           <details class="team-member-card ${isAdmin ? 'team-admin-card' : ''} bg-white dark:bg-gray-50 rounded-lg shadow-sm border-l-4 overflow-hidden" data-user-id="${member.userId}">
                <summary class="flex items-center justify-between p-3 sm:p-6 cursor-pointer">
                    <div class="flex items-center">
                        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0">
                            ${member.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div class="ml-3">
                            <h4 class="font-bold text-base sm:text-lg">${sanitizeHTML(member.displayName)}</h4>
                            <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400" data-i18n="${isAdmin ? 'teamAdmin' : 'member'}">${isAdmin ? i18n.t('teamAdmin') : i18n.t('member')}</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        ${isAdmin ? `
                        <div class="w-6 h-6 bg-yellow-100 dark:bg-yellow-800 rounded-full flex items-center justify-center mr-2 sm:mr-4">
                            <svg class="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                            </svg>
                        </div>
                        ` : ''}
                        ${(state.teamRole === TEAM_ROLES.ADMIN && !isAdmin) ? `
                        <button class="kick-member-btn icon-btn text-red-500 hover:text-red-700 dark:text-red-500 dark:hover:text-red-700 mr-2" title="Kick Member" data-kick-member-id="${member.userId}" data-kick-member-name="${member.displayName}">
                            <i class="fa-solid fa-circle-xmark"></i>
                        </button>
                        ` : ''}
                        <svg class="w-6 h-6 text-gray-500 accordion-arrow transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </summary>
                <div class="team-member-details-content p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700">
                    ${Object.keys(balances).length > 0 ? `
                        <div>
                            <h5 class="font-semibold mb-3 sm:mb-4 team-dashboard-title">${i18n.t('leaveBalanceOverview')} (${dashboardYear})</h5>
                            ${leaveTypesHTML}
                        </div>
                    ` : `
                        <div class="text-center py-6 text-gray-500">
                            <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <p>${i18n.t('noLeaveTypesOrSummary').replace('{year}', dashboardYear)}</p>
                        </div>
                    `}
                </div>
            </details>
        `;
    }).join('');

    DOM.teamDashboardContent.innerHTML = `
        <div class="space-y-3">
            ${membersHTML}
        </div>
    `;
    // Restore the open state of the rows that were open before.
    if (openMemberIds.size > 0) {
        openMemberIds.forEach(userId => {
            const detailElement = DOM.teamDashboardContent.querySelector(`details[data-user-id="${userId}"]`);
            if (detailElement) {
                detailElement.open = true;
            }
        });
    }
}

// --- OPTIMIZATION: Event Delegation Setup for Daily View ---
function setupDailyViewEventListeners() {
    const tableBody = DOM.dailyActivityTableBody;
    if (!tableBody) return;

    tableBody.addEventListener('click', async e => {
        const target = e.target;

        const editableCell = target.closest('.activity-text-editable, .time-editable');
        if (editableCell) {
            handleInlineEditClick({ currentTarget: editableCell });
            return;
        }

        const button = target.closest('.icon-btn');
        if (!button) return;

        const row = button.closest('tr');
        if (!row) return;

        const timeKey = row.dataset.time;

        if (button.classList.contains('move-up-btn')) {
            handleMoveUpClick(row);
        } else if (button.classList.contains('move-down-btn')) {
            handleMoveDownClick(row);
        } else if (button.classList.contains('delete-btn')) {
            if (button.classList.contains('confirm-action')) {
                await deleteActivity(getYYYYMMDD(state.selectedDate), timeKey);
                button.classList.remove('confirm-action');
                clearTimeout(button.dataset.timeoutId);
            } else {
                tableBody.querySelectorAll('.confirm-action').forEach(el => el.classList.remove('confirm-action'));

                button.classList.add('confirm-action');
                showMessage(i18n.t("msgClickToConfirm"), 'info');
                const timeoutId = setTimeout(() => {
                    button.classList.remove('confirm-action');
                }, 3000);
                button.dataset.timeoutId = timeoutId;
            }
        }
    });

    tableBody.addEventListener('blur', e => {
        const target = e.target;
        if (target.matches('.activity-text-editable, .time-editable')) {
            handleInlineEditBlur({ currentTarget: target });
        }
    }, true);

    tableBody.addEventListener('keydown', e => {
        const target = e.target;
        if (target.matches('.activity-text-editable, .time-editable')) {
            handleInlineEditKeydown(e);
        }
    });
}

// --- Search Functionality (Spotlight) ---
function openSpotlight() {
    state.previousActiveElement = document.activeElement;
    DOM.spotlightModal.classList.add('visible');
    DOM.spotlightInput.focus();

    // If there's a previous query, perform search again to refresh results
    if (state.searchQuery) {
        performSearch(state.searchQuery);
    } else {
        DOM.spotlightResultsList.innerHTML = '';
        DOM.spotlightEmptyState.classList.add('hidden');
        DOM.spotlightCount.textContent = '';
    }
}

function closeSpotlight() {
    DOM.spotlightModal.classList.remove('visible');
    updateView();
    if (state.previousActiveElement) {
        state.previousActiveElement.focus();
        state.previousActiveElement = null;
    }
}

function performSearch(query) {
    setState({ searchQuery: query });

    if (!query) {
        DOM.spotlightResultsList.innerHTML = '';
        DOM.spotlightEmptyState.classList.add('hidden');
        DOM.spotlightCount.textContent = '';
        // Clear navigation context so standard navigation resumes
        setState({ searchResultDates: [] });
        if (DOM.exitSearchBtn) DOM.exitSearchBtn.classList.remove('visible');
        return;
    }

    if (DOM.exitSearchBtn) DOM.exitSearchBtn.classList.add('visible');

    const lowerQuery = query.toLowerCase();
    const results = [];
    const foundDateKeys = new Set();

    // Determine which years to search
    let yearsToSearch = [];
    if (state.searchScope === 'global') {
        yearsToSearch = Object.keys(state.yearlyData);
    } else {
        yearsToSearch = [state.currentMonth.getFullYear().toString()];
    }

    yearsToSearch.forEach(year => {
        const yearData = state.yearlyData[year];
        if (!yearData || !yearData.activities) return;

        Object.keys(yearData.activities).forEach(dateKey => {
            const dayData = yearData.activities[dateKey];
            let matchFound = false;

            // Search in Note
            if (dayData.note && dayData.note.toLowerCase().includes(lowerQuery)) {
                results.push({
                    type: 'note',
                    date: dateKey,
                    content: dayData.note,
                    formattedDate: formatDateForDisplay(dateKey)
                });
                matchFound = true;
            }

            // Search in Leave
            if (dayData.leave) {
                const leaveType = state.leaveTypes.find(lt => lt.id === dayData.leave.typeId);
                if (leaveType && leaveType.name.toLowerCase().includes(lowerQuery)) {
                    results.push({
                        type: 'leave',
                        date: dateKey,
                        content: `${leaveType.name} (${dayData.leave.dayType === 'full' ? i18n.t('full') : i18n.t('half')})`,
                        formattedDate: formatDateForDisplay(dateKey),
                        color: leaveType.color
                    });
                    matchFound = true;
                }
            }

            // Search in Activities
            Object.keys(dayData).forEach(key => {
                if (key !== 'note' && key !== 'leave' && key !== '_userCleared' && typeof dayData[key] === 'object' && dayData[key].text) {
                    if (dayData[key].text.toLowerCase().includes(lowerQuery)) {
                        results.push({
                            type: 'activity',
                            date: dateKey,
                            time: key,
                            content: dayData[key].text,
                            formattedDate: formatDateForDisplay(dateKey)
                        });
                        matchFound = true;
                    }
                }
            });

            if (matchFound) {
                foundDateKeys.add(dateKey);
            }
        });
    });

    // Store sorted date keys for navigation (always chronological)
    const sortedDateKeys = Array.from(foundDateKeys).sort();
    setState({ searchResultDates: sortedDateKeys });

    renderSearchResults(results);
}

function toggleSearchSort() {
    const newOrder = state.searchSortOrder === 'newest' ? 'oldest' : 'newest';
    setState({ searchSortOrder: newOrder });
    performSearch(state.searchQuery);
}

function toggleSearchScope() {
    const newScope = state.searchScope === 'year' ? 'global' : 'year';
    setState({ searchScope: newScope });

    // Update button text
    if (DOM.spotlightScopeLabel) {
        const scopeKey = newScope === 'year' ? 'currentYear' : 'allYears';
        DOM.spotlightScopeLabel.textContent = i18n.t(scopeKey);
        DOM.spotlightScopeLabel.setAttribute('data-i18n', scopeKey);
    }

    performSearch(state.searchQuery);
}

function renderSearchResults(results) {
    DOM.spotlightResultsList.innerHTML = '';

    // Sort results for display
    if (state.searchSortOrder === 'newest') {
        results.sort((a, b) => new Date(b.date) - new Date(a.date));
        DOM.spotlightSortLabel.textContent = i18n.t('newestFirst');
        DOM.spotlightSortLabel.setAttribute('data-i18n', 'newestFirst');
        DOM.spotlightSortBtn.querySelector('i').className = "fas fa-sort-amount-down ml-2";
    } else {
        results.sort((a, b) => new Date(a.date) - new Date(b.date));
        DOM.spotlightSortLabel.textContent = i18n.t('oldestFirst');
        DOM.spotlightSortLabel.setAttribute('data-i18n', 'oldestFirst');
        DOM.spotlightSortBtn.querySelector('i').className = "fas fa-sort-amount-up ml-2";
    }

    DOM.spotlightCount.textContent = `${results.length} ${i18n.t('results')}`;

    if (results.length === 0) {
        DOM.spotlightEmptyState.classList.remove('hidden');
        return;
    }
    DOM.spotlightEmptyState.classList.add('hidden');

    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'spotlight-result-item bg-white p-3 rounded-lg border border-gray-200 hover:bg-blue-50 cursor-pointer transition-colors flex items-start group';

        let iconHtml = '';
        let contentHtml = '';

        if (result.type === 'note') {
            iconHtml = '<div class="text-yellow-500 mr-3 mt-1"><i class="fas fa-sticky-note"></i></div>';
            contentHtml = `<p class="font-medium text-gray-800">Note: <span class="font-normal text-gray-600">${sanitizeHTML(result.content)}</span></p>`;
        } else if (result.type === 'leave') {
            iconHtml = `<div class="mr-3 mt-1" style="color: ${result.color};"><i class="fas fa-calendar-check"></i></div>`;
            contentHtml = `<p class="font-medium" style="color: ${result.color};">${sanitizeHTML(result.content)}</p>`;
        } else {
            iconHtml = '<div class="text-blue-500 mr-3 mt-1"><i class="fas fa-clock"></i></div>';
            contentHtml = `
                <div class="flex flex-col">
                    <span class="text-xs font-semibold text-gray-500 uppercase">${sanitizeHTML(result.time)}</span>
                    <p class="text-gray-800">${sanitizeHTML(result.content)}</p>
                </div>`;
        }

        item.innerHTML = `
            ${iconHtml}
            <div class="flex-grow">
                <div class="flex justify-between">
                    <h5 class="text-sm font-bold text-gray-500 mb-1">${result.formattedDate}</h5>
                    <i class="fas fa-chevron-right text-gray-300 group-hover:text-blue-400 transition-colors"></i>
                </div>
                ${contentHtml}
            </div>
        `;

        item.addEventListener('click', () => {
            const date = new Date(result.date + 'T00:00:00');
            setState({ selectedDate: date, currentView: VIEW_MODES.DAY });
            closeSpotlight();
            updateView();
        });

        DOM.spotlightResultsList.appendChild(item);
    });
}

// --- Event Listener Setup ---
function setupEventListeners() {
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    DOM.emailSignupBtn.addEventListener('click', () => signUpWithEmail(emailInput.value, passwordInput.value));
    DOM.emailSigninBtn.addEventListener('click', () => signInWithEmail(emailInput.value, passwordInput.value));
    DOM.forgotPasswordBtn.addEventListener('click', () => resetPassword(emailInput.value));
    DOM.googleSigninBtn.addEventListener('click', signInWithGoogle);
    document.getElementById('anon-continue-btn').addEventListener('click', loadOfflineData);

    setupDoubleClickConfirm(
        document.getElementById('sign-out-btn'),
        'signOut',
        'confirmSignOut',
        appSignOut
    );

    const passwordToggleBtn = document.getElementById('password-toggle-btn');
    const passwordToggleIcon = document.getElementById('password-toggle-icon');
    passwordToggleBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        passwordToggleIcon.classList.toggle('fa-eye', !isPassword);
        passwordToggleIcon.classList.toggle('fa-eye-slash', isPassword);
    });

    emailInput.addEventListener('input', () => setInputErrorState(emailInput, false));
    passwordInput.addEventListener('input', () => setInputErrorState(passwordInput, false));
    document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
    DOM.monthViewBtn.addEventListener('click', () => { setState({ currentView: VIEW_MODES.MONTH }); updateView(); });
    DOM.dayViewBtn.addEventListener('click', () => { setState({ currentView: VIEW_MODES.DAY }); updateView(); });

    document.getElementById('prev-btn').addEventListener('click', async (e) => {
        const button = e.currentTarget;
        setButtonLoadingState(button, true);
        await waitForDOMUpdate();

        const oldYear = state.currentMonth.getFullYear();
        let newDate;

        if (state.currentView === VIEW_MODES.MONTH) {
            newDate = new Date(state.currentMonth.setMonth(state.currentMonth.getMonth() - 1));
            setState({ currentMonth: newDate });
        } else {
            // Check if we are in search navigation mode (Day View + Active Search Results)
            if (state.searchResultDates.length > 0) {
                const currentKey = getYYYYMMDD(state.selectedDate);
                // searchResultDates is always sorted ascending (oldest to newest)
                const currentIndex = state.searchResultDates.indexOf(currentKey);

                let newIndex;
                if (currentIndex === -1) {
                    // Not in list, find closest previous date
                     // Since list is sorted ascending, we look for the last date smaller than current
                    newIndex = -1;
                     for (let i = state.searchResultDates.length - 1; i >= 0; i--) {
                         if (state.searchResultDates[i] < currentKey) {
                             newIndex = i;
                             break;
                         }
                     }
                     if (newIndex === -1 && state.searchResultDates.length > 0) {
                         // If no previous date, wrap to end or stay? Let's wrap to end for better UX
                         newIndex = state.searchResultDates.length - 1;
                     }
                } else {
                    newIndex = currentIndex - 1;
                    if (newIndex < 0) {
                        // Wrap around
                         newIndex = state.searchResultDates.length - 1;
                    }
                }

                if (newIndex >= 0 && newIndex < state.searchResultDates.length) {
                    newDate = new Date(state.searchResultDates[newIndex] + 'T00:00:00');
                    showMessage(i18n.t("msgSearchResultView").replace('{current}', newIndex + 1).replace('{total}', state.searchResultDates.length), 'info');
                } else {
                    // Fallback to standard nav if empty (shouldn't happen due to check)
                     newDate = new Date(state.selectedDate.setDate(state.selectedDate.getDate() - 1));
                }
            } else {
                 newDate = new Date(state.selectedDate.setDate(state.selectedDate.getDate() - 1));
            }
            setState({ selectedDate: newDate, currentMonth: new Date(newDate.getFullYear(), newDate.getMonth(), 1) });
        }

        const newYear = newDate.getFullYear();
        if (newYear !== oldYear) {
            setState({ currentYearData: state.yearlyData[newYear] || { activities: {}, leaveOverrides: {} } });
        }

        updateView();
        setButtonLoadingState(button, false);
    });

    document.getElementById('next-btn').addEventListener('click', async (e) => {
        const button = e.currentTarget;
        setButtonLoadingState(button, true);
        await waitForDOMUpdate();

        const oldYear = state.currentMonth.getFullYear();
        let newDate;

        if (state.currentView === VIEW_MODES.MONTH) {
            newDate = new Date(state.currentMonth.setMonth(state.currentMonth.getMonth() + 1));
            setState({ currentMonth: newDate });
        } else {
            // Check if we are in search navigation mode (Day View + Active Search Results)
             if (state.searchResultDates.length > 0) {
                 const currentKey = getYYYYMMDD(state.selectedDate);
                 // searchResultDates is always sorted ascending (oldest to newest)
                 const currentIndex = state.searchResultDates.indexOf(currentKey);

                 let newIndex;
                 if (currentIndex === -1) {
                     // Not in list, find closest next date
                     newIndex = -1;
                     for (let i = 0; i < state.searchResultDates.length; i++) {
                         if (state.searchResultDates[i] > currentKey) {
                             newIndex = i;
                             break;
                         }
                     }
                      if (newIndex === -1 && state.searchResultDates.length > 0) {
                          // Wrap to start
                          newIndex = 0;
                      }
                 } else {
                     newIndex = currentIndex + 1;
                     if (newIndex >= state.searchResultDates.length) {
                         // Wrap around
                          newIndex = 0;
                     }
                 }

                 if (newIndex >= 0 && newIndex < state.searchResultDates.length) {
                     newDate = new Date(state.searchResultDates[newIndex] + 'T00:00:00');
                     showMessage(i18n.t("msgSearchResultView").replace('{current}', newIndex + 1).replace('{total}', state.searchResultDates.length), 'info');
                 } else {
                      newDate = new Date(state.selectedDate.setDate(state.selectedDate.getDate() + 1));
                 }
             } else {
                 newDate = new Date(state.selectedDate.setDate(state.selectedDate.getDate() + 1));
             }
            setState({ selectedDate: newDate, currentMonth: new Date(newDate.getFullYear(), newDate.getMonth(), 1) });
        }

        const newYear = newDate.getFullYear();
        if (newYear !== oldYear) {
            setState({ currentYearData: state.yearlyData[newYear] || { activities: {}, leaveOverrides: {} } });
        }

        updateView();
        setButtonLoadingState(button, false);
    });
    DOM.todayBtnDay.addEventListener('click', async () => {
        setButtonLoadingState(DOM.todayBtnDay, true);
        await waitForDOMUpdate();
        const today = new Date();
        setState({
            selectedDate: today,
            currentMonth: new Date(today.getFullYear(), today.getMonth(), 1)
        });
        updateView();
        setButtonLoadingState(DOM.todayBtnDay, false);
    });

    DOM.currentPeriodDisplay.addEventListener('click', () => {
        state.previousActiveElement = document.activeElement;
        setState({ pickerYear: state.currentView === VIEW_MODES.MONTH ? state.currentMonth.getFullYear() : state.selectedDate.getFullYear() });
        renderMonthPicker();
        DOM.monthPickerModal.classList.add('visible');
        // Focus close button or first interactive element
        document.getElementById('close-month-picker-btn')?.focus();
    });

    document.getElementById('close-month-picker-btn').addEventListener('click', () => {
        DOM.monthPickerModal.classList.remove('visible');
        if (state.previousActiveElement) {
            state.previousActiveElement.focus();
            state.previousActiveElement = null;
        }
    });
    document.getElementById('prev-year-btn').addEventListener('click', async (e) => {
        const button = e.currentTarget;
        setButtonLoadingState(button, true);
        await waitForDOMUpdate();
        setState({ pickerYear: state.pickerYear - 1 });
        renderMonthPicker();
        setButtonLoadingState(button, false);
    });

    document.getElementById('next-year-btn').addEventListener('click', async (e) => {
        const button = e.currentTarget;
        setButtonLoadingState(button, true);
        await waitForDOMUpdate();
        setState({ pickerYear: state.pickerYear + 1 });
        renderMonthPicker();
        setButtonLoadingState(button, false);
    });

    // Use debounced 'input' for a better UX
    DOM.dailyNoteInput.addEventListener('input', debounce((e) => {
        saveData({ type: ACTION_TYPES.SAVE_NOTE, payload: e.target.value });
    }, 500));

    // Spotlight Search Listeners
    if (DOM.openSpotlightBtn) {
        DOM.openSpotlightBtn.addEventListener('click', openSpotlight);
    }

    if (DOM.spotlightCloseBtn) {
        DOM.spotlightCloseBtn.addEventListener('click', closeSpotlight);
    }

    if (DOM.spotlightModal) {
        DOM.spotlightModal.addEventListener('click', (e) => {
            if (e.target === DOM.spotlightModal) {
                closeSpotlight();
            }
        });
    }

    if (DOM.spotlightInput) {
        DOM.spotlightInput.addEventListener('input', debounce((e) => {
            performSearch(e.target.value.trim());
        }, 300));

        DOM.spotlightInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSpotlight();
            }
        });
    }

    if (DOM.spotlightSortBtn) {
        DOM.spotlightSortBtn.addEventListener('click', toggleSearchSort);
    }

    if (DOM.spotlightScopeBtn) {
        DOM.spotlightScopeBtn.addEventListener('click', toggleSearchScope);
    }

    if (DOM.exitSearchBtn) {
        DOM.exitSearchBtn.addEventListener('click', exitSearchMode);
    }

    // Language Switcher Logic
    const openLangBtn = document.getElementById('open-lang-btn');
    const closeLangBtn = document.getElementById('close-lang-btn');
    const languageModal = document.getElementById('language-modal');
    const languageList = document.getElementById('language-list');

    if (openLangBtn && languageModal && languageList) {
        openLangBtn.addEventListener('click', () => {
            // Render language options
            languageList.innerHTML = ''; // Clear existing
            i18n.supportedLangs.forEach(lang => {
                const isActive = lang.code === i18n.currentLang;
                const option = document.createElement('div');
                option.className = `language-option ${isActive ? 'active' : ''}`;
                option.dataset.lang = lang.code;

                // You could use a flag icon here if desired, but text is robust
                option.innerHTML = `
                    <span class="text-base font-medium text-gray-800 dark:text-gray-200">${lang.name}</span>
                    ${isActive ? '<i class="fas fa-check ml-auto text-blue-500"></i>' : ''}
                `;

                option.addEventListener('click', () => {
                    i18n.setLanguage(lang.code);
                    languageModal.classList.remove('visible');
                });

                languageList.appendChild(option);
            });

            languageModal.classList.add('visible');
        });

        const closeLangModal = () => languageModal.classList.remove('visible');

        if (closeLangBtn) closeLangBtn.addEventListener('click', closeLangModal);

        languageModal.addEventListener('click', (e) => {
            if (e.target === languageModal) closeLangModal();
        });
    }

    // Global shortcut for spotlight (e.g. Ctrl+K or /) could be added here if desired
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            openSpotlight();
        }
        if (e.key === 'Escape' && !DOM.spotlightModal.classList.contains('hidden')) {
            closeSpotlight();
        }
    });

    const addNewSlotBtn = document.getElementById('add-new-slot-btn');
    if (addNewSlotBtn) {
        addNewSlotBtn.addEventListener('click', async () => {
            setButtonLoadingState(addNewSlotBtn, true);
            await saveData({ type: ACTION_TYPES.ADD_SLOT });
            setButtonLoadingState(addNewSlotBtn, false);
        });
    }

    document.getElementById('reset-data-btn').addEventListener('click', () => {
        DOM.resetModalText.textContent = state.isOnlineMode
            ? "This will permanently delete all your activity data from the cloud. This action cannot be undone."
            : "This will permanently delete all your local activity data. This action cannot be undone.";
        DOM.confirmResetModal.classList.add('visible');
    });
    document.getElementById('cancel-reset-btn').addEventListener('click', () => DOM.confirmResetModal.classList.remove('visible'));
    document.getElementById('confirm-reset-btn').addEventListener('click', resetAllData);

    const uploadCsvInput = document.getElementById('upload-csv-input');
    DOM.uploadCsvBtn.addEventListener('click', () => uploadCsvInput.click());
    DOM.downloadCsvBtn.addEventListener('click', downloadCSV);
    uploadCsvInput.addEventListener('change', handleFileUpload);

    DOM.addLeaveTypeBtn.addEventListener('click', () => openLeaveTypeModal());
    document.getElementById('cancel-leave-type-btn').addEventListener('click', closeLeaveTypeModal);
    document.getElementById('save-leave-type-btn').addEventListener('click', saveLeaveType);
    setupDoubleClickConfirm(
        DOM.deleteLeaveTypeBtn,
        'deleteLeaveType',
        'confirmDeleteLeaveType',
        deleteLeaveType
    );
    DOM.leaveColorPicker.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            selectColorInPicker(e.target.dataset.color);
        }
    });
    DOM.statsToggleBtn.addEventListener('click', () => {
        DOM.leaveStatsSection.classList.toggle('visible');
        DOM.statsArrowDown.classList.toggle('hidden');
        DOM.statsArrowUp.classList.toggle('hidden');
    });

    // Team toggle button
    DOM.teamToggleBtn.addEventListener('click', () => {
        const isVisible = DOM.teamSection.classList.toggle('visible');
        DOM.teamArrowDown.classList.toggle('hidden');
        DOM.teamArrowUp.classList.toggle('hidden');

        if (isVisible && !state.unsubscribeFromTeam) {
            // If the section is opened and we're not subscribed yet, subscribe.
            subscribeToTeamData();
        } else if (!isVisible && state.unsubscribeFromTeam) {
            // If the section is closed and we are subscribed, clean up.
            cleanupTeamSubscriptions();
        }
    });

    DOM.logNewLeaveBtn.addEventListener('click', () => {
        if (state.isLoggingLeave) {
            setState({ isLoggingLeave: false, selectedLeaveTypeId: null, leaveSelection: new Set() });
            DOM.logNewLeaveBtn.innerHTML = `<i class="fas fa-calendar-plus mr-2"></i> ${i18n.t('logLeave')}`;
            DOM.logNewLeaveBtn.classList.replace('btn-danger', 'btn-primary');
            showMessage(i18n.t("msgLeaveLoggingCancelled"), 'info');
            updateView();
        } else {
            const year = state.currentMonth.getFullYear();
            const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);
            if (visibleLeaveTypes.length === 0) {
                showMessage(i18n.t("msgAddLeaveTypeFirst"), 'info');
                return;
            }
            setState({ isLoggingLeave: true, selectedLeaveTypeId: null, leaveSelection: new Set() });
            DOM.logNewLeaveBtn.innerHTML = `<i class="fas fa-times mr-2"></i> ${i18n.t('cancelLogging')}`;
            DOM.logNewLeaveBtn.classList.replace('btn-primary', 'btn-danger');
            showMessage(i18n.t("msgSelectDayAndPill"), 'info');
        }
    });

    DOM.leavePillsContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('button');
        if (!pill || !state.isLoggingLeave) return;

        const leaveTypeId = pill.dataset.id;
        setState({ selectedLeaveTypeId: leaveTypeId });
        renderLeavePills();

        if (state.leaveSelection.size > 0) {
            openLeaveCustomizationModal();
        }
    });

    DOM.calendarView.addEventListener('click', (e) => {
        const cell = e.target.closest('.calendar-day-cell.current-month');
        if (!cell) return;

        const dateKey = cell.dataset.date;

        if (state.isLoggingLeave) {
            if (state.leaveSelection.has(dateKey)) {
                state.leaveSelection.delete(dateKey);
            } else {
                state.leaveSelection.add(dateKey);
            }
            renderCalendar();

            if (state.selectedLeaveTypeId && state.leaveSelection.size > 0) {
                openLeaveCustomizationModal();
            }
        } else {
            const date = new Date(dateKey + 'T00:00:00');
            setState({ selectedDate: date, currentView: VIEW_MODES.DAY });
            updateView();
        }
    });

    document.getElementById('cancel-log-leave-btn').addEventListener('click', () => {
        DOM.customizeLeaveModal.classList.remove('visible');
        if (state.previousActiveElement) {
            state.previousActiveElement.focus();
            state.previousActiveElement = null;
        }
    });

    document.getElementById('save-log-leave-btn').addEventListener('click', saveLoggedLeaves);
    DOM.removeAllLeavesBtn.addEventListener('click', handleBulkRemoveClick);

    DOM.logoContainer.addEventListener('click', handleLogoTap);

    if (DOM.infoToggleBtn && DOM.infoDescription) {
        DOM.infoToggleBtn.addEventListener('click', () => {
            DOM.infoDescription.classList.toggle('visible');
        });
    }

    document.getElementById('close-leave-overview-btn').addEventListener('click', closeLeaveOverviewModal);

    DOM.overviewLeaveDaysList.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-leave-day-btn');
        const deleteBtn = e.target.closest('.delete-leave-day-btn');
        const toggleBtn = e.target.closest('.toggle-btn');

        if (editBtn) {
            const item = editBtn.closest('.leave-overview-item');
            const dateKey = item.dataset.dateKey;
            editLeaveDay(dateKey);
        } else if (deleteBtn) {
            const item = deleteBtn.closest('.leave-overview-item');
            const dateKey = item.dataset.dateKey;

            if (deleteBtn.classList.contains('confirm-action')) {
                deleteLeaveDay(dateKey);
                deleteBtn.classList.remove('confirm-action');
                clearTimeout(deleteBtn.dataset.timeoutId);
            } else {
                DOM.overviewLeaveDaysList.querySelectorAll('.confirm-action').forEach(el => {
                    el.classList.remove('confirm-action');
                    clearTimeout(el.dataset.timeoutId);
                });

                deleteBtn.classList.add('confirm-action');
                showMessage(i18n.t("msgClickToConfirm"), 'info');
                const timeoutId = setTimeout(() => {
                    deleteBtn.classList.remove('confirm-action');
                }, 3000);
                deleteBtn.dataset.timeoutId = timeoutId;
            }
        } else if (toggleBtn) {
            const toggle = toggleBtn.closest('.day-type-toggle');
            const newValue = toggleBtn.dataset.value;
            const oldValue = toggle.dataset.selectedValue;

            if (newValue === oldValue) return;

            const item = toggleBtn.closest('.leave-overview-item');
            const dateKey = item.dataset.dateKey;
            const year = new Date(dateKey).getFullYear();

            const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));
            const leaveData = updatedYearlyData[year]?.activities[dateKey]?.leave;
            if (!leaveData) return;

            const costChange = (newValue === 'full' ? 1 : 0.5) - (oldValue === 'full' ? 1 : 0.5);
            if (costChange > 0) {
                const balances = calculateLeaveBalances();
                const leaveType = state.leaveTypes.find(lt => lt.id === leaveData.typeId);
                if (leaveType && balances[leaveData.typeId] < costChange) {
                    showMessage(i18n.t("msgBalanceInsufficient").replace('{name}', leaveType.name), 'error');
                    return;
                }
            }

            toggle.dataset.selectedValue = newValue;
            toggle.querySelector('.toggle-bg').style.transform = `translateX(${newValue === 'half' ? '100%' : '0'})`;
            toggle.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.value === newValue));

            leaveData.dayType = newValue;

            const currentYear = state.currentMonth.getFullYear();
            const currentYearData = updatedYearlyData[currentYear] || { activities: {}, leaveOverrides: {} };

            setState({ yearlyData: updatedYearlyData, currentYearData });

            try {
        const timestamp = Date.now();
        state.lastUpdated = timestamp;
        await persistData({ yearlyData: updatedYearlyData, leaveTypes: state.leaveTypes, lastUpdated: timestamp });
                triggerTeamSync();
                showMessage(i18n.t("msgLeaveDayUpdated"), 'success');
            } catch (error) {
                console.error("Failed to update leave day:", error);
                showMessage(i18n.t("msgUpdateSaveFailed"), "error");
            }

            updateView();
        }
    });

    // Team Management Event Listeners
    document.getElementById('cancel-create-team-btn').addEventListener('click', closeCreateTeamModal);
    document.getElementById('save-create-team-btn').addEventListener('click', createTeam);
    document.getElementById('cancel-join-team-btn').addEventListener('click', closeJoinTeamModal);
    document.getElementById('save-join-team-btn').addEventListener('click', joinTeam);
    document.getElementById('cancel-edit-name-btn').addEventListener('click', closeEditDisplayNameModal);
    document.getElementById('save-edit-name-btn').addEventListener('click', editDisplayName);
    document.getElementById('close-team-dashboard-btn').addEventListener('click', closeTeamDashboard);
    document.getElementById('cancel-edit-team-name-btn').addEventListener('click', closeEditTeamNameModal);
    document.getElementById('save-edit-team-name-btn').addEventListener('click', editTeamName);

    if (DOM.closeAdminDashboardBtn) {
        DOM.closeAdminDashboardBtn.addEventListener('click', () => {
            DOM.adminDashboardModal.classList.remove('visible');
        });
    }

    DOM.teamDashboardContent.addEventListener('click', (e) => {
        const kickBtn = e.target.closest('.kick-member-btn');
        if (kickBtn) {
            const memberId = kickBtn.dataset.kickMemberId;
            const memberName = kickBtn.dataset.kickMemberName;
            openKickMemberModal(memberId, memberName);
        }
    });

    document.getElementById('cancel-kick-btn').addEventListener('click', closeKickMemberModal);
    document.getElementById('confirm-kick-btn').addEventListener('click', kickMember);

    // Delegated event listener for the team section
    DOM.teamSection.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const action = button.id;

        const handleDoubleClick = (actionKey, messageKey, callback) => {
            if (button.classList.contains('confirm-action')) {
                callback(button);
                button.classList.remove('confirm-action');
                clearTimeout(button.dataset.timeoutId);
            } else {
                DOM.teamSection.querySelectorAll('.confirm-action').forEach(el => {
                    el.classList.remove('confirm-action');
                    clearTimeout(el.dataset.timeoutId);
                });

                button.classList.add('confirm-action');
                // Check if messageKey looks like a translation key (no spaces)
                const msg = (messageKey && !messageKey.includes(' ')) ? i18n.t(messageKey) : messageKey;
                showMessage(msg, 'info');
                const timeoutId = setTimeout(() => {
                    button.classList.remove('confirm-action');
                }, 3000);
                button.dataset.timeoutId = timeoutId;
            }
        };

        switch (action) {
            case 'create-team-btn': openCreateTeamModal(); break;
            case 'join-team-btn': openJoinTeamModal(); break;
            case 'team-dashboard-btn': openTeamDashboard(); break;
            case 'edit-display-name-btn': openEditDisplayNameModal(); break;
            case 'open-edit-team-name-btn': openEditTeamNameModal(); break;
            case 'copy-room-code-btn': copyRoomCode(); break;
            case 'leave-team-btn':
                handleDoubleClick('leaveTeam', 'confirmLeaveTeam', (btn) => {
                    setButtonLoadingState(btn, true);
                    leaveTeam(btn);
                });
                break;
            case 'delete-team-btn':
                handleDoubleClick('deleteTeam', 'confirmDeleteTeam', (btn) => {
                    setButtonLoadingState(btn, true);
                    deleteTeam(btn);
                });
                break;
        }
    });

    // Format room code input & Validate
    DOM.roomCodeInput.addEventListener('input', (e) => {
        const input = e.target;
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);

        // Validation for Join button
        const joinBtn = document.getElementById('save-join-team-btn');
        if (joinBtn) {
            if (input.value.length === 8) {
                joinBtn.disabled = false;
                joinBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                joinBtn.disabled = true;
                joinBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
    });

    // Pro Duration Modal Listeners
    const proDurationModal = document.getElementById('pro-duration-modal');
    if (proDurationModal) {
        document.getElementById('cancel-pro-duration-btn').addEventListener('click', () => {
            proDurationModal.classList.remove('visible');
            state.adminTargetUserId = null;
        });

        document.getElementById('pro-till-revoked-btn').addEventListener('click', async () => {
            await setProStatus(state.adminTargetUserId, null);
        });

        document.getElementById('pro-save-date-btn').addEventListener('click', async () => {
            const dateVal = document.getElementById('pro-expiry-date').value;
            if (!dateVal) {
                showMessage(i18n.t("pleaseSelectDate"), "error");
                return;
            }
            await setProStatus(state.adminTargetUserId, dateVal);
        });
    }
}

function exitSearchMode() {
    setState({ searchQuery: '', searchResultDates: [] });
    if (DOM.exitSearchBtn) DOM.exitSearchBtn.classList.remove('visible');
    updateView();
}

function renderAdminButton() {
    // Only render if user matches state.superAdmins or is a co-admin
    const isSuperAdmin = auth.currentUser && state.superAdmins.includes(auth.currentUser.email);
    const isCoAdmin = state.userRole === 'co-admin';

    if (!isSuperAdmin && !isCoAdmin) {
        const existingBtn = document.getElementById('admin-dashboard-btn');
        if (existingBtn) existingBtn.remove();
        return;
    }

    if (document.getElementById('admin-dashboard-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'admin-dashboard-btn';
    btn.className = 'inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 cursor-pointer';
    btn.innerHTML = `<i class="fas fa-shield-alt text-base"></i><span class="hidden sm:inline" data-i18n="adminDashboard">${i18n.t("adminDashboard")}</span>`;

    // Insert before the language button or at the start
    const footer = document.getElementById('main-footer');
    if (footer) {
        footer.insertBefore(btn, footer.firstChild);
        btn.addEventListener('click', openAdminDashboard);
    }
}

function openProDurationModal(userId) {
    state.adminTargetUserId = userId;
    const modal = document.getElementById('pro-duration-modal');
    if (modal) {
        modal.classList.add('visible');
        document.getElementById('pro-expiry-date').value = '';
    }
}

async function setProStatus(targetUserId, expiryDate) {
    const modal = document.getElementById('pro-duration-modal');
    if (modal) {
        const btnId = expiryDate ? 'pro-save-date-btn' : 'pro-till-revoked-btn';
        const btn = document.getElementById(btnId);
        setButtonLoadingState(btn, true);
    }

    try {
        const updateUserRole = httpsCallable(functions, 'updateUserRole');
        await updateUserRole({
            targetUserId: targetUserId,
            newRole: 'pro',
            proExpiry: expiryDate
        });

        // Refresh list
        const getAllUsers = httpsCallable(functions, 'getAllUsers');
        const result = await getAllUsers();
        renderAdminUserList(result.data.users);

        showMessage('User promoted to Pro', 'success');
        if (modal) modal.classList.remove('visible');
    } catch (error) {
        console.error("Failed to set pro status:", error);
        showMessage(i18n.t("failedToUpdateRole"), 'error');
    } finally {
        if (modal) {
            const btnId = expiryDate ? 'pro-save-date-btn' : 'pro-till-revoked-btn';
            const btn = document.getElementById(btnId);
            setButtonLoadingState(btn, false);
        }
        state.adminTargetUserId = null;
    }
}

// Helper to call backend for granting pro to email
async function grantProByEmail(email) {
    if (!email) return;
    try {
        const grantPro = httpsCallable(functions, 'grantProByEmail');
        const result = await grantPro({ email });
        showMessage(result.data.message, 'success');
        // Refresh list
        await refreshAdminUserList();
    } catch (error) {
        console.error("Failed to grant pro by email:", error);
        showMessage(i18n.t("failedToGrantPro"), 'error');
    }
}

async function refreshAdminUserList() {
    DOM.adminUserList.innerHTML = '<div class="flex justify-center py-8"><i class="fas fa-spinner fa-spin text-3xl text-blue-500"></i></div>';
    try {
        const getAllUsers = httpsCallable(functions, 'getAllUsers');
        const result = await getAllUsers();
        renderAdminUserList(result.data.users);
    } catch (error) {
        console.error("Failed to load users:", error);
        DOM.adminUserList.innerHTML = `<p class="text-center text-red-500">${i18n.t('failedToLoadUsers', {error: error.message})}</p>`;
    }
}

async function openAdminDashboard() {
    DOM.adminDashboardModal.classList.add('visible');
    await refreshAdminUserList();
}

function renderAdminUserList(users, searchQuery = '') {
    // Add search bar if not present
    let searchContainer = DOM.adminDashboardModal.querySelector('#admin-search-container');
    if (!searchContainer) {
        searchContainer = document.createElement('div');
        searchContainer.id = 'admin-search-container';
        searchContainer.className = 'mb-4 sticky top-0 z-10 pt-1 pb-2 px-1 -mx-1'; // Sticky header
        searchContainer.innerHTML = `
            <div class="relative mx-2">
                <div class="absolute inset-y-0 left-0 flex items-center pointer-events-none" style="padding-left: 1rem;">
                    <i class="fas fa-search text-gray-400"></i>
                </div>
                <input type="text" id="admin-user-search" placeholder="${i18n.t('searchUserPlaceholder')}" style="padding-left: 3.5rem; padding-right: 1rem;"
                    class="block w-full py-2 border border-gray-300 dark:border-gray-600 rounded-xl leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out">
            </div>
        `;
        // Insert it into the modal body, before the list wrapper.
        const modalBody = DOM.adminDashboardModal.querySelector('.modal-container > div:last-child');
        modalBody.insertBefore(searchContainer, modalBody.firstChild);

        // Add event listener for search
        const searchInput = searchContainer.querySelector('#admin-user-search');
        searchInput.addEventListener('input', debounce((e) => {
            renderAdminUserList(users, e.target.value.trim());
        }, 300));
    } else {
        // Ensure input value matches query if re-rendering completely (though usually we just re-render list content)
        const searchInput = searchContainer.querySelector('#admin-user-search');
        if (searchInput && searchInput.value !== searchQuery) {
            // If we are re-rendering from scratch, keep the input value?
            // Usually we don't want to overwrite user input.
            // But if searchQuery is passed, it implies filter state.
        }
    }

    DOM.adminUserList.innerHTML = '';

    // Filter users
    const lowerQuery = searchQuery.toLowerCase();
    const filteredUsers = users.filter(user => {
        const name = (user.displayName || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        return name.includes(lowerQuery) || email.includes(lowerQuery);
    });

    // Check for "Grant to New" condition
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery);
    const exactMatch = filteredUsers.find(u => u.email.toLowerCase() === lowerQuery);

    if (isEmail && !exactMatch) {
        const grantCard = document.createElement('div');
        grantCard.className = 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4 flex justify-between items-center';
        grantCard.innerHTML = `
            <div>
                <p class="font-medium text-blue-800 dark:text-blue-300">${i18n.t('userNotFound')}</p>
                <p class="text-sm text-blue-600 dark:text-blue-400">${i18n.t('grantProAccessTo', {email: sanitizeHTML(searchQuery)})}</p>
            </div>
            <button id="grant-pro-btn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">${i18n.t('grantProAccess')}</button>
        `;
        DOM.adminUserList.appendChild(grantCard);

        grantCard.querySelector('#grant-pro-btn').addEventListener('click', async (e) => {
            const btn = e.target;
            setButtonLoadingState(btn, true);
            await grantProByEmail(searchQuery);
            // setButtonLoadingState handled by refresh, but just in case
        });
    }

    if (filteredUsers.length === 0 && !isEmail) {
        DOM.adminUserList.innerHTML += `<p class="text-center text-gray-500 py-4">${i18n.t('noUsersFound')}</p>`;
        return;
    }

    // Sort: Owners (4), Co-Admins (3), Pros (2), Standard (1)
    filteredUsers.sort((a, b) => {
        const getScore = (user) => {
            if (state.superAdmins.includes(user.email)) return 4; // Owner is #1
            if (user.role === 'co-admin') return 3;               // Co-Admin is #2
            if (user.role === 'pro') return 2;
            return 1;
        };
        return getScore(b) - getScore(a);
    });

    filteredUsers.forEach(user => {
        const isSuperAdmin = state.superAdmins.includes(user.email);
        const item = document.createElement('div');
        item.className = 'admin-user-item flex flex-col sm:flex-row items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm gap-4';

        let roleBadgeClass = user.role === 'co-admin' ? 'co-admin' : (user.role === 'pro' ? 'pro' : 'standard');
        const isPending = user.status === 'pending';

        // Format Member Since date
        let memberSince = '-';
        if (user.creationTime) {
            try {
                memberSince = new Date(user.creationTime).toLocaleDateString(i18n.currentLang, { year: 'numeric', month: 'short', day: 'numeric' });
            } catch (e) { console.error("Date parse error", e); }
        }

        // Format Pro Since
        let proSinceDate = '';
        let proExpiryText = '';
        let isExpired = false;

        if (user.proSince && !isSuperAdmin) { // Hide for Super Admin
             try {
                proSinceDate = new Date(user.proSince).toLocaleDateString(i18n.currentLang, { year: 'numeric', month: 'short', day: 'numeric' });
                if (user.proExpiry) {
                    const expiryDate = new Date(user.proExpiry);
                    if (expiryDate < new Date()) {
                        isExpired = true;
                        proExpiryText = `<span class="text-red-500 font-bold">${i18n.t('expired')}</span>`;
                    } else {
                        const expiry = expiryDate.toLocaleDateString(i18n.currentLang, { year: 'numeric', month: 'short', day: 'numeric' });
                        proExpiryText = `${i18n.t('expLabel')} ${expiry}`;
                    }
                } else if (user.role === 'pro') {
                     proExpiryText = i18n.t('tillRevoked');
                }
             } catch(e) {}
        }

        // Logic for button text
        let proButtonText = user.role === 'pro' ? i18n.t('revokePro') : i18n.t('makePro');
        if (isPending && user.role === 'pro') {
            proButtonText = i18n.t('revokeInvite');
        }
        if (isExpired && user.role === 'pro') {
            proButtonText = i18n.t('renewPro');
            roleBadgeClass = 'standard';
        }

        let displayRole = (isExpired && user.role === 'pro') ? 'standard' : user.role;
        let roleBadgeHTML;

        if (isPending) {
            roleBadgeHTML = `<span class="role-badge pending">${i18n.t('pendingSignup')}</span>`;
        } else if (isSuperAdmin) {
            roleBadgeHTML = `<span class="role-badge owner">${i18n.t('owner')}</span>`;
        } else {
    // Use the role string as the key (e.g., "pro", "standard")
    roleBadgeHTML = `<span class="role-badge ${roleBadgeClass}" data-i18n="${displayRole}">${i18n.t(displayRole)}</span>`;
        }

        item.innerHTML = `
            <div class="flex items-center flex-grow min-w-0 mr-2 ${isPending ? 'opacity-70' : ''}">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold mr-3 flex-shrink-0">
                    ${(user.displayName || user.email || '?').charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0">
                    <p class="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">${sanitizeHTML(user.displayName || 'No Name')}</p>
                    <p class="text-gray-500 truncate" style="font-size: 10px;">${sanitizeHTML(user.email)}</p>
                    <div class="mt-1 flex items-center gap-2">
                        ${roleBadgeHTML}
                    </div>
                </div>
            </div>

            <!-- Date Stack (Tiny) -->
            <div class="flex flex-col items-end mr-2 sm:mr-4 min-w-[80px]" style="font-size: 10px;">
                <div class="text-gray-400 text-right">
                    <span class="font-medium text-gray-500">${i18n.t('joined')}</span> ${memberSince}
                </div>
                ${proSinceDate ? `
                <div class="text-gray-400 mt-1 text-right">
                    <span class="font-medium text-blue-500">${i18n.t('proLabel')}</span> ${proSinceDate}
                    ${proExpiryText ? `<div class="text-gray-300" style="font-size: 9px;">${proExpiryText}</div>` : ''}
                </div>` : ''}
            </div>

            ${!isSuperAdmin ? `
            <div class="flex items-center gap-2 w-full sm:w-auto justify-end ml-auto">
                <div class="flex flex-col gap-2 w-full sm:w-auto">
                    <button class="toggle-role-btn px-3 py-1 text-xs font-medium rounded border transition-colors ${user.role === 'pro' ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}"
                            data-uid="${user.uid}" data-email="${user.email}" data-pending="${isPending}" data-role="pro" data-current="${user.role === 'pro'}" data-expired="${isExpired}">
                        ${proButtonText}
                    </button>
                    <button class="toggle-role-btn px-3 py-1 text-xs font-medium rounded border transition-colors ${user.role === 'co-admin' ? 'bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}"
                            data-uid="${user.uid}" data-role="co-admin" data-current="${user.role === 'co-admin'}" ${isPending ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                        ${user.role === 'co-admin' ? i18n.t('revokeCoAdmin') : i18n.t('makeCoAdmin')}
                    </button>
                </div>
            </div>
            ` : ''}
        `;

        DOM.adminUserList.appendChild(item);
    });

    // Add event listeners
    DOM.adminUserList.querySelectorAll('.toggle-role-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const uid = btn.dataset.uid;
            const email = btn.dataset.email;
            const isPending = btn.dataset.pending === 'true';
            const targetRole = btn.dataset.role; // 'pro' or 'co-admin'
            const isCurrent = btn.dataset.current === 'true';
            const isExpired = btn.dataset.expired === 'true';

            setButtonLoadingState(btn, true);

            try {
                if (isPending && targetRole === 'pro') {
                    // Handle Revoke Invite for pending users
                    if (isCurrent) { // Only action for pending pro is revoke
                        await revokeProWhitelist(email);
                    }
                } else {
                    if (targetRole === 'pro' && (!isCurrent || isExpired)) {
                        openProDurationModal(uid);
                        setButtonLoadingState(btn, false);
                        return;
                    }

                    // If already has this role, we revoke it -> set to 'standard'
                    // If doesn't have it, we set to targetRole
                    const newRole = isCurrent ? 'standard' : targetRole;

                    const updateUserRole = httpsCallable(functions, 'updateUserRole');
                    await updateUserRole({ targetUserId: uid, newRole: newRole });

                    // Refresh list via helper to maintain search logic capability if we expanded it later
                    await refreshAdminUserList();

                    showMessage(i18n.t('userRoleUpdated', {role: i18n.t(newRole)}), 'success');
                }
            } catch (error) {
                console.error("Failed to update role:", error);
                showMessage(i18n.t("failedToUpdateRole"), 'error');
            } finally {
                // Ensure loading state is cleared if not re-rendered
                // If re-rendered, this element is gone anyway.
            }
        });
    });
}

// --- App Initialization ---
function handleSplashScreen() {
    requestAnimationFrame(() => {
        if (DOM.splashLoading) DOM.splashLoading.style.display = 'none';
        if (DOM.tapToBegin) DOM.tapToBegin.style.display = 'block';
        if (DOM.splashScreen) {
            DOM.splashScreen.addEventListener('click', () => {
                if (DOM.tapToBegin) DOM.tapToBegin.style.display = 'none';
                if (DOM.splashLoading) DOM.splashLoading.style.display = 'none';
                if (DOM.splashText) DOM.splashText.classList.add('animating-out');

                initAuth();

                // Wait for the splash screen to fade out
                const handleSplashTransitionEnd = (e) => {
                    if (e.target === DOM.splashScreen) {
                         DOM.splashScreen.style.zIndex = '-10';
                         DOM.splashScreen.style.cursor = 'default';
                         DOM.splashScreen.style.backgroundColor = 'transparent';
                         DOM.splashScreen.removeEventListener('transitionend', handleSplashTransitionEnd);
                    }
                };
                
                // Wait for splash text to animate out
                const handleTextAnimationEnd = (e) => {
                    if (e.target === DOM.splashText) {
                         DOM.splashText.style.display = 'none';
                         DOM.splashText.removeEventListener('animationend', handleTextAnimationEnd);
                    }
                };

                DOM.splashScreen.addEventListener('transitionend', handleSplashTransitionEnd);
                if (DOM.splashText) {
                     // Check if it's animation or transition based on class 'animating-out'
                     // Assuming animation since it's 'animating-out'
                     DOM.splashText.addEventListener('animationend', handleTextAnimationEnd);
                     
                     // Fallback safety
                     setTimeout(() => {
                         if (DOM.splashText && DOM.splashText.style.display !== 'none') {
                             DOM.splashText.style.display = 'none';
                         }
                     }, 1100);
                }

                // Fallback safety for splash screen
                setTimeout(() => {
                     if (DOM.splashScreen && DOM.splashScreen.style.zIndex !== '-10') {
                         DOM.splashScreen.style.zIndex = '-10';
                         DOM.splashScreen.style.cursor = 'default';
                         DOM.splashScreen.style.backgroundColor = 'transparent';
                     }
                }, 500);

            }, { once: true });
        }
    });
}

async function init() {
    initUI();
    try {
        await i18n.init(); // Initialize i18n and wait for it
    } catch (e) {
        console.error("i18n init error:", e);
    }
    subscribeToAppConfig(); // Start listening for config changes
    setupEventListeners();
    setupDailyViewEventListeners();
    setupColorPicker();
    loadTheme();
    handleSplashScreen();
    loadSplashScreenVideo();

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    }
}

document.addEventListener('DOMContentLoaded', init);
function mergeUserData(cloudState, guestData) {
    const mergedYearlyData = JSON.parse(JSON.stringify(cloudState.yearlyData || {}));
    const mergedLeaveTypes = [...(cloudState.leaveTypes || [])];
    const cloudLeaveTypeIds = new Set(mergedLeaveTypes.map(lt => lt.id));

    if (guestData.leaveTypes) {
        guestData.leaveTypes.forEach(lt => {
            if (!cloudLeaveTypeIds.has(lt.id)) {
                mergedLeaveTypes.push(lt);
                cloudLeaveTypeIds.add(lt.id);
            }
        });
    }

    if (guestData.yearlyData) {
        Object.keys(guestData.yearlyData).forEach(year => {
            if (!mergedYearlyData[year]) {
                mergedYearlyData[year] = guestData.yearlyData[year];
            } else {
                const cloudYear = mergedYearlyData[year];
                const guestYear = guestData.yearlyData[year];

                if (guestYear.leaveOverrides) {
                    if (!cloudYear.leaveOverrides) cloudYear.leaveOverrides = {};
                    Object.keys(guestYear.leaveOverrides).forEach(ltId => {
                        if (!cloudYear.leaveOverrides[ltId]) {
                            cloudYear.leaveOverrides[ltId] = guestYear.leaveOverrides[ltId];
                        }
                    });
                }

                if (guestYear.activities) {
                    if (!cloudYear.activities) cloudYear.activities = {};
                    Object.keys(guestYear.activities).forEach(dateKey => {
                        const guestDay = guestYear.activities[dateKey];
                        const cloudDay = cloudYear.activities[dateKey];

                        if (!cloudDay || Object.keys(cloudDay).length === 0) {
                            cloudYear.activities[dateKey] = guestDay;
                        } else {
                            if (!cloudDay.note && guestDay.note) cloudDay.note = guestDay.note;
                            if (!cloudDay.leave && guestDay.leave) cloudDay.leave = guestDay.leave;
                            if (cloudDay._userCleared === undefined && guestDay._userCleared !== undefined) {
                                cloudDay._userCleared = guestDay._userCleared;
                            }
                            Object.keys(guestDay).forEach(key => {
                                if (key !== 'note' && key !== 'leave' && key !== '_userCleared') {
                                    if (!cloudDay[key]) {
                                        cloudDay[key] = guestDay[key];
                                    }
                                }
                            });
                        }
                    });
                }
            }
        });
    }

    return {
        yearlyData: mergedYearlyData,
        leaveTypes: mergedLeaveTypes
    };
}
window.renderAdminUserList = renderAdminUserList; window.openAdminDashboard = openAdminDashboard;

// Helper to call backend for revoking pro whitelist
async function revokeProWhitelist(email) {
    if (!email) return;
    try {
        const revokePro = httpsCallable(functions, 'revokeProWhitelist');
        const result = await revokePro({ email });
        showMessage(result.data.message, 'success');
        // Refresh list
        await refreshAdminUserList();
    } catch (error) {
        console.error("Failed to revoke pro whitelist:", error);
        showMessage(i18n.t("failedToRevokeProWhitelist"), 'error');
    }
}

function subscribeToAppConfig() {
    const configRef = doc(db, "config", "app_config");
    onSnapshot(configRef, (doc) => {
        if (doc.exists()) {
             const data = doc.data();
             setState({ superAdmins: data.superAdmins || [] });
        } else {
             setState({ superAdmins: [] });
        }
        renderAdminButton();
        renderTeamSection(); // Re-render team section as pro status depends on super admin check
    }, (error) => {
        console.warn("Could not fetch app config (likely permission issue or missing doc):", error);
    });
}
