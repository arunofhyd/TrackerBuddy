// Import Firebase modules
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, updateDoc, getDoc, writeBatch, addDoc, deleteField, serverTimestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { html, render } from 'lit-html';
import { format } from 'date-fns';
import Papa from 'papaparse';

// Import Constants and Effects
import { 
    ACTION_TYPES, 
    DATA_KEYS, 
    LEAVE_DAY_TYPES, 
    USER_ROLES, 
    TEAM_ROLES, 
    TRANS_KEYS, 
    DOM_SELECTORS 
} from './assets/js/constants.js';

import { 
    createMagicParticles, 
    handleLogoTap as handleLogoTapEffect 
} from './assets/js/ui-effects.js';

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

const VIEW_MODES = {
    MONTH: 'month',
    DAY: 'day'
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
    isUpdating: false,
    // pendingSaveCount is replaced by Last Write Wins logic in save operations
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

// --- UI Functions ---
function initUI() {
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

    if (viewToShow === DOM.loginView || viewToShow === DOM.loadingView) {
        if (DOM.splashScreen) DOM.splashScreen.style.display = 'flex';
    } else if (viewToShow === DOM.appView) {
        loadTheme();
        if (DOM.splashScreen) DOM.splashScreen.style.display = 'none';
    }

    if (viewToHide) {
        viewToHide.style.opacity = '0';
    }

    // Replaced setTimeout(..., 0) with requestAnimationFrame for smoother transition
    requestAnimationFrame(() => {
        if (viewToHide) {
            viewToHide.classList.add('hidden');
        }

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

async function subscribeToData(userId, callback) {
    const userDocRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
        // Prevent external updates from overwriting local state while user is typing
        if (state.editingInlineTimeKey) {
            return;
        }

        let data = docSnapshot.exists() ? docSnapshot.data() : {};
        
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

async function saveData(action) {
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
        leaveTypes: state.leaveTypes
    };

    // If migrating away from old structure, implicitly remove old field
    if (state.isOnlineMode && state.yearlyData.activities) {
        dataToSave.activities = deleteField();
        if (partialUpdate) partialUpdate['activities'] = deleteField();
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
        localStorage.setItem('guestUserData', JSON.stringify(data));
    } catch (error) {
        console.error("Error saving local data:", error);
        showMessage(i18n.t("msgSaveLocalError"), 'error');
    }
}

// IMPLEMENTATION: Last Write Wins Strategy
async function saveDataToFirestore(data, partialUpdate = null) {
    if (!state.userId) return;

    // Use serverTimestamp for lastUpdated field to handle concurrency on backend if needed,
    // but here we are using client-side Last Write Wins logic implicitly by trusting the client state.
    // However, to make it robust against overwrites, we typically merge.
    
    // We already use partial updates for granular changes which is good.
    // If we want LWW for the whole document, we just write.
    // The previous implementation used a pendingSaveCount which was fragile.
    // By using partial updates with dot notation, we avoid overwriting the whole document,
    // which effectively implements LWW for specific fields.

    if (partialUpdate) {
        try {
            await updateDoc(doc(db, "users", state.userId), {
                ...partialUpdate,
                lastUpdated: serverTimestamp() // Add timestamp
            });
            return;
        } catch (e) {
            console.warn("Partial update failed, falling back to full merge:", e);
        }
    }
    
    await setDoc(doc(db, "users", state.userId), {
        ...data,
        lastUpdated: serverTimestamp()
    }, { merge: true });
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
    await new Promise(resolve => setTimeout(resolve, 50));

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
                leaveTypes: [],
                lastUpdated: serverTimestamp()
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
        await persistData({ yearlyData: updatedYearlyData, leaveTypes: state.leaveTypes });
        showMessage(i18n.t("msgActivitiesReordered"), 'success');
    } catch (error) {
        console.error("Failed to reorder activities:", error);
        showMessage(i18n.t("msgOrderSaveError"), "error");
        // NOTE: Consider rolling back state on error
    }
}

async function deleteActivity(dateKey, timeKey) {
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
                lastUpdated: serverTimestamp()
            };

            if (dayHasNoMoreActivities) {
                updates[`yearlyData.${year}.activities.${dateKey}._userCleared`] = true;
            }

            await updateDoc(userDocRef, updates);
        } else {
            saveDataToLocalStorage({ yearlyData: updatedYearlyData, leaveTypes: state.leaveTypes });
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

    const csvString = Papa.unparse(csvRows); // Use Papa Parse for generation as well for consistency

    const link = document.createElement("a");
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvString);
    link.download = `TrackerBuddy_Backup_${getYYYYMMDD(new Date())}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// IMPLEMENTATION: Replace Manual CSV Parsing with Papaparse
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        complete: async (results) => {
            try {
                // FIX: Use the multi-year copy structure
                const yearlyDataCopy = JSON.parse(JSON.stringify(state.yearlyData));
                const leaveTypesMap = new Map(state.leaveTypes.map(lt => [lt.id, { ...lt }]));
                const rows = results.data;

                if (rows.length <= 1) {
                    return showMessage(i18n.t("msgEmptyCSV"), 'error');
                }

                let processedRows = 0;
                rows.slice(1).forEach(row => {
                    // Papaparse already parsed the line into an array
                    if (row.length < 2) return;

                    const [type, detail1, detail2, detail3, detail4] = row;
                    let rowProcessed = false;

                    if (!type) return;

                    switch (type.toUpperCase()) {
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

                            if (type.toUpperCase() === 'NOTE') {
                                dayData.note = detail2;
                                rowProcessed = true;
                            } else if (type.toUpperCase() === 'LEAVE') {
                                dayData.leave = { typeId: detail2, dayType: detail3 || 'full' };
                                rowProcessed = true;
                            } else if (type.toUpperCase() === 'ACTIVITY') {
                                const time = detail2;
                                if (time) {
                                    dayData[time] = { text: detail3 || "", order: isNaN(parseInt(detail4, 10)) ? 0 : parseInt(detail4, 10) };
                                    rowProcessed = true;
                                }
                            } else if (type.toUpperCase() === 'USER_CLEARED') {
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
                console.error("Error during CSV restore processing:", err);
                showMessage(i18n.t("msgRestoreError"), 'error');
            }
        },
        error: (err) => {
            console.error("Error parsing CSV:", err);
            showMessage(i18n.t("msgReadError"), 'error');
        }
    });
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
        isUpdating: false
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

// ... (Rest of auth functions: signUpWithEmail, editTeamName, signInWithEmail, resetPassword, signInWithGoogle, appSignOut are fine, just imports changed at top)
// Re-implementing them here to ensure context is correct if they rely on anything I changed.
// They seem fine as they rely on `auth`, `showMessage` etc which are available.

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

function handleLogoTap() {
    state.logoTapCount = handleLogoTapEffect(DOM.appLogo, state.logoTapCount, () => {
         state.logoTapCount = 0;
    });
    
    // Easter Egg Logic extracted in ui-effects.js creates particles on count=5.
    // Here we handle the specific Splash Screen Easter Egg which needs state access (count=7)
    // We can keep the specific app logic here or move it.
    // For now, let's keep the specific "Return to Splash Screen" logic here, but use the effect for the visual part.
    
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

// ... (Rest of functions for Leave Management, Team Management, Search, etc. are largely unchanged except for using constants/imports)
// I will just ensure they are included in the file by copying them from previous read, but I am doing an overwrite_file, so I must include EVERYTHING.

// [INCLUDED ABOVE] Leave Management, Team Management, etc. 
// I have included them in the `render*` functions and helper functions above.
// Double check `getVisibleLeaveTypesForYear` and others are present.
// Yes, `getVisibleLeaveTypesForYear`, `openLeaveTypeModal`, `saveLeaveType`, etc are NOT in the block above yet. 
// I need to paste them.

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
        DOM.leaveNameInput.value = leaveType.name;
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
    await new Promise(resolve => setTimeout(resolve, 50));

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
        const globalLeaveType = newLeaveTypes[existingIndex];
        globalLeaveType.name = name;
        globalLeaveType.color = color;

        if (totalDays !== globalLeaveType.totalDays) {
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
            if (updatedYearlyData[currentYear]?.leaveOverrides?.[id]) {
                delete updatedYearlyData[currentYear].leaveOverrides[id].totalDays;
                if (Object.keys(updatedYearlyData[currentYear].leaveOverrides[id]).length === 0) {
                    delete updatedYearlyData[currentYear].leaveOverrides[id];
                }
            }
        }
    } else {
        newLeaveTypes.push({ id, name, totalDays, color });
    }

    const currentYearData = updatedYearlyData[currentYear] || { activities: {}, leaveOverrides: {} };
    setState({
        leaveTypes: newLeaveTypes,
        yearlyData: updatedYearlyData,
        currentYearData: currentYearData
    });

    try {
        if (state.isOnlineMode && state.userId) {
            const dataToSave = {
                leaveTypes: newLeaveTypes
            };

            if (updatedYearlyData[currentYear]) {
                dataToSave.yearlyData = {
                    [currentYear]: {
                        leaveOverrides: updatedYearlyData[currentYear].leaveOverrides || {}
                    }
                };
            }
            await saveDataToFirestore(dataToSave);
        } else {
            saveDataToLocalStorage({
                yearlyData: updatedYearlyData,
                leaveTypes: newLeaveTypes
            });
        }

        triggerTeamSync();
        showMessage(i18n.t("msgLeaveTypeSaved"), 'success');
    } catch (error) {
        console.error("Failed to save leave type:", error);
        showMessage(i18n.t("msgLeaveTypeSaveFailed"), 'error');
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

    if (!updatedYearlyData[currentYear]) {
        updatedYearlyData[currentYear] = { activities: {}, leaveOverrides: {} };
    }
    if (!updatedYearlyData[currentYear].leaveOverrides) {
        updatedYearlyData[currentYear].leaveOverrides = {};
    }

    updatedYearlyData[currentYear].leaveOverrides[id] = {
        ...(updatedYearlyData[currentYear].leaveOverrides[id] || {}),
        hidden: true
    };

    const yearActivities = updatedYearlyData[currentYear].activities || {};
    Object.keys(yearActivities).forEach(dateKey => {
        if (yearActivities[dateKey].leave?.typeId === id) {
            delete yearActivities[dateKey].leave;
        }
    });

    const currentYearData = updatedYearlyData[currentYear];
    setState({
        yearlyData: updatedYearlyData,
        currentYearData: currentYearData
    });

    try {
        if (state.isOnlineMode && state.userId) {
            const batch = writeBatch(db);
            const userDocRef = doc(db, "users", state.userId);

            batch.update(userDocRef, {
                [`yearlyData.${currentYear}.leaveOverrides.${id}.hidden`]: true
            });

            const yearActivities = state.yearlyData[currentYear]?.activities || {};
            
            Object.keys(yearActivities).forEach(dateKey => {
                if (yearActivities[dateKey].leave?.typeId === id) {
                    batch.update(userDocRef, {
                        [`yearlyData.${currentYear}.activities.${dateKey}.leave`]: deleteField()
                    });
                }
            });

            await batch.commit();
        } else {
            saveDataToLocalStorage({
                yearlyData: updatedYearlyData,
                leaveTypes: state.leaveTypes
            });
        }

        triggerTeamSync();
        showMessage(i18n.t("msgLeaveTypeHidden").replace('{year}', currentYear), 'success');
    } catch (error) {
        console.error("Failed to hide leave type:", error);
        showMessage(i18n.t("msgLeaveTypeHideFailed"), 'error');
    } finally {
        closeLeaveTypeModal();
        updateView();
    }
}

async function saveLeaveTypes() {
    await persistData({ yearlyData: state.yearlyData, leaveTypes: state.leaveTypes });
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
    closeLeaveOverviewModal();
    setState({
        leaveSelection: new Set([dateKey]),
        initialLeaveSelection: new Set([dateKey]),
        isLoggingLeave: false,
        selectedLeaveTypeId: null
    });
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
        await persistData({ yearlyData: updatedYearlyData, leaveTypes: state.leaveTypes });
        triggerTeamSync();
        showMessage(i18n.t("msgLeaveEntryDeleted"), 'success');
    } catch (error) {
        console.error("Failed to delete leave day:", error);
        showMessage(i18n.t("msgDeleteSaveError"), "error");
    }

    if (DOM.leaveOverviewModal.classList.contains('visible')) {
        setTimeout(() => openLeaveOverviewModal(originalLeaveTypeId), 100);
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
                item.remove(); 
            }
        });
    });
}

async function saveLoggedLeaves() {
    const button = DOM.customizeLeaveModal.querySelector('#save-log-leave-btn');
    setButtonLoadingState(button, true);
    await new Promise(resolve => setTimeout(resolve, 50));

    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);
    const currentActivities = state.currentYearData.activities || {};
    const balances = calculateLeaveBalances();
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
        if (state.isOnlineMode && state.userId) {
            const batch = writeBatch(db);
            const userDocRef = doc(db, "users", state.userId);
            let opCount = 0;

            state.initialLeaveSelection.forEach(dateKey => {
                if (!datesInModal.has(dateKey) && state.yearlyData[year]?.activities[dateKey]?.leave) {
                    batch.update(userDocRef, {
                        [`yearlyData.${year}.activities.${dateKey}.leave`]: deleteField()
                    });
                    opCount++;
                }
            });

            modalItems.forEach(item => {
                const dateKey = item.dataset.dateKey;
                const typeId = item.querySelector('.leave-type-selector-trigger').dataset.typeId;

                if (typeId === 'remove') {
                     batch.update(userDocRef, {
                        [`yearlyData.${year}.activities.${dateKey}.leave`]: deleteField()
                    });
                } else {
                    const dayType = item.querySelector('.day-type-toggle').dataset.selectedValue;
                    batch.update(userDocRef, {
                        [`yearlyData.${year}.activities.${dateKey}.leave`]: { typeId, dayType }
                    });
                }
                opCount++;
            });

            if (opCount > 0) {
                await batch.commit();
            }
        } else {
            saveDataToLocalStorage({ yearlyData: updatedYearlyData, leaveTypes: state.leaveTypes });
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

function handleSplashScreen() {
    setTimeout(() => {
        if (DOM.splashLoading) DOM.splashLoading.style.display = 'none';
        if (DOM.tapToBegin) DOM.tapToBegin.style.display = 'block';
        if (DOM.splashScreen) {
            DOM.splashScreen.addEventListener('click', () => {
                if (DOM.tapToBegin) DOM.tapToBegin.style.display = 'none';
                if (DOM.splashLoading) DOM.splashLoading.style.display = 'none';
                if (DOM.splashText) DOM.splashText.classList.add('animating-out');

                initAuth();

                setTimeout(() => {
                    if (DOM.splashScreen) {
                        DOM.splashScreen.style.zIndex = '-10';
                        DOM.splashScreen.style.cursor = 'default';
                        DOM.splashScreen.style.backgroundColor = 'transparent';
                    }
                }, 400);

                setTimeout(() => {
                    if (DOM.splashText) DOM.splashText.style.display = 'none';
                }, 1000);

            }, { once: true });
        }
    }, 50);
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
        renderTeamSection();
    }, (error) => {
        console.warn("Could not fetch app config (likely permission issue or missing doc):", error);
    });
}

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

async function init() {
    initUI();
    try {
        await i18n.init(); 
    } catch (e) {
        console.error("i18n init error:", e);
    }
    subscribeToAppConfig(); 
    setupEventListeners();
    setupDailyViewEventListeners();
    setupColorPicker();
    loadTheme();
    handleSplashScreen();
    loadSplashScreenVideo();
}

// Make globally available for button onclick handlers if any remain in HTML (e.g. mailto link)
window.renderAdminUserList = renderAdminUserList; 
window.openAdminDashboard = openAdminDashboard;

document.addEventListener('DOMContentLoaded', init);
