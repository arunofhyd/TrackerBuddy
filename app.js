// Import Firebase modules
// Dynamic imports for auth and firestore
import { html, render } from 'lit-html';
import { format } from 'date-fns';
import { TranslationService } from './services/i18n.js';
import { isMobileDevice, sanitizeHTML, debounce, waitForDOMUpdate, getYYYYMMDD, formatDateForDisplay, formatTextForDisplay, triggerHapticFeedback } from './services/utils.js';
import {
    REGION,
    COLLECTIONS,
    USER_ROLES,
    TEAM_ROLES,
    LEAVE_DAY_TYPES,
    VIEW_MODES,
    ACTION_TYPES,
    COLOR_MAP,
    LOCAL_STORAGE_KEYS,
    NOTIFICATION_SHAPE
} from './constants.js';
import { createInitialState } from './services/state.js';
import { Logger } from './services/logger.js';
import {
    app,
    auth,
    db,
    loadFirebaseModules,
    getFunctionsInstance,
    getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail,
    getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, updateDoc, getDoc, writeBatch, addDoc, deleteField, initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from './services/firebase.js';
import { initTog, performReset as performTogReset } from './tog.js';

const i18n = new TranslationService(() => {
    updateView();
    // Re-render modals if open to update language-dependent content
    if (DOM.teamDashboardModal?.classList.contains('visible')) {
        renderTeamDashboard();
    }
    if (DOM.adminDashboardModal?.classList.contains('visible')) {
        renderAdminUserList(state.adminUsers, state.adminSearchQuery || '');
    }
    if (DOM.customizeLeaveModal?.classList.contains('visible')) {
        renderLeaveCustomizationModal();
    }
    if (DOM.leaveOverviewModal?.classList.contains('visible') && state.overviewLeaveTypeId) {
        openLeaveOverviewModal(state.overviewLeaveTypeId);
    }
    if (DOM.spotlightModal?.classList.contains('visible') && state.searchQuery) {
        performSearch(state.searchQuery);
    }
    if (DOM.monthPickerModal?.classList.contains('visible')) {
        renderMonthPicker();
    }
});

// --- Global App State ---
let state = createInitialState();

// --- State Management ---
function setState(newState) {
    state = { ...state, ...newState };
}

// --- DOM Element References ---
let DOM = {};

// --- Utilities ---
// Imported from services/utils.js

// --- UI Functions ---
function initUI() {
    if (isMobileDevice()) {
        document.body.classList.add('is-mobile');
    }

    // Expose for TOGtracker
    window.showAppMessage = showMessage;
    // Expose Month Picker for TOGtracker
    window.openSharedMonthPicker = openSharedMonthPicker;

    DOM = {
        splashScreen: document.getElementById('splash-screen'),
        splashText: document.querySelector('.splash-text'),
        splashLoading: document.getElementById('splash-loading'),
        tapToBegin: document.getElementById('tap-to-begin'),
        contentWrapper: document.getElementById('content-wrapper'),
        footer: document.getElementById('main-footer'),
        loginView: document.getElementById('login-view'),
        appView: document.getElementById('app-view'),
        togView: document.getElementById('tog-view'),
        navTogBtn: document.getElementById('nav-tog-btn'),
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
        limitLeaveToYearBtn: document.getElementById('limit-leave-to-year-btn'),
        leaveColorPicker: document.getElementById('leave-color-picker'),
        deleteLeaveTypeBtn: document.getElementById('delete-leave-type-btn'),
        weekendOptionModal: document.getElementById('weekend-option-modal'),
        toggleSatBtn: document.getElementById('toggle-sat-btn'),
        toggleSunBtn: document.getElementById('toggle-sun-btn'),
        weekendApplyBtn: document.getElementById('weekend-apply-btn'),
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
        // Help DOM
        helpModal: document.getElementById('help-modal'),
        helpToggleBtn: document.getElementById('help-toggle-btn'),
        closeHelpBtn: document.getElementById('close-help-btn'),
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
        closeAdminDashboardBtn: document.getElementById('close-admin-dashboard-btn'),
        // Floating Confirm Button
        confirmSelectionBtn: document.getElementById('confirm-selection-btn'),
        floatingConfirmContainer: document.getElementById('floating-confirm-container'),
        bottomControlsRow: document.getElementById('bottom-controls-row'),
        // Message Progress
        messageProgress: document.getElementById('message-progress'),
        // Swipe Confirm Modal
        swipeConfirmModal: document.getElementById('swipe-confirm-modal'),
        swipeTrack: document.getElementById('swipe-track'),
        swipeThumb: document.getElementById('swipe-thumb'),
        swipeFill: document.getElementById('swipe-fill'),
        swipeText: document.getElementById('swipe-text'),
        swipeSuccessText: document.getElementById('swipe-success-text'),
        cancelSwipeBtn: document.getElementById('cancel-swipe-btn'),
        // TrackerBuddy User Menu
        tbUserAvatarBtn: document.getElementById('tb-user-avatar-btn'),
        tbUserDropdown: document.getElementById('tb-user-dropdown'),
        tbMenuContainer: document.getElementById('tb-user-menu-container'),
        tbMenuAvatar: document.getElementById('tb-menu-avatar'),
        tbMenuUserEmail: document.getElementById('tb-menu-user-email'),
        tbBackupBtn: document.getElementById('tb-backup-btn'),
        tbRestoreBtn: document.getElementById('tb-restore-btn'),
        tbResetBtn: document.getElementById('tb-reset-btn'),
        tbLogoutBtn: document.getElementById('tb-logout-btn')
    };

    setupMessageSwipe();
    setupSwipeConfirm();
    setupTbUserMenu();
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
        const rect = button.getBoundingClientRect();
        button.disabled = true;
        button.dataset.originalContent = button.innerHTML;
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

let transitionState = {
    active: false,
    timeoutId: null,
    element: null,
    handler: null
};

function switchView(viewToShow, viewToHide, callback) {
    const mainContainer = document.querySelector('.main-container');

    // Cancel pending show for the view we are about to hide
    if (viewToHide && viewToHide._pendingShowRAF) {
        cancelAnimationFrame(viewToHide._pendingShowRAF);
        viewToHide._pendingShowRAF = null;
    }

    // Cancel pending transition to prevent race conditions
    if (transitionState.active) {
        clearTimeout(transitionState.timeoutId);
        transitionState.element.removeEventListener('transitionend', transitionState.handler);
        // Force finish the previous hide
        transitionState.element.style.willChange = 'auto';
        transitionState.element.classList.add('hidden');
        transitionState.element.style.opacity = '0';
        transitionState.active = false;
    }

    const showNewView = () => {
        if (viewToShow === DOM.loginView || viewToShow === DOM.loadingView) {
            // Ensure splash screen is visible (it might be z-index -10 acting as background, or z-index 100 acting as loader)
            if (DOM.splashScreen) DOM.splashScreen.style.display = 'flex';
        } else if (viewToShow === DOM.appView) {
            loadTheme();
            // If splash screen is currently covering the screen (loading flow), fade it out smoothly
            if (DOM.splashScreen && getComputedStyle(DOM.splashScreen).zIndex === '100' && DOM.splashScreen.style.display !== 'none') {
                 DOM.splashScreen.style.transition = 'opacity 0.5s ease-out';
                 DOM.splashScreen.style.opacity = '0';
                 setTimeout(() => {
                     DOM.splashScreen.style.display = 'none';
                 }, 500);
            } else {
                 if (DOM.splashScreen) DOM.splashScreen.style.display = 'none';
            }
        }

        // Store RAF ID to allow cancellation
        viewToShow._pendingShowRAF = requestAnimationFrame(() => {
            viewToShow._pendingShowRAF = null;

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
        transitionState.active = true;
        transitionState.element = viewToHide;

        // Apply optimization only during transition
        viewToHide.style.willChange = 'opacity';
        viewToHide.style.opacity = '0';
        
        const finishHide = () => {
             transitionState.active = false;
             viewToHide.style.willChange = 'auto'; // Cleanup
             viewToHide.classList.add('hidden');
             // Only show the new view AFTER the old one is gone to prevent layout jumps
             showNewView();
        };

        transitionState.handler = () => {
             if (!transitionState.active) return;
             finishHide();
        };

        transitionState.timeoutId = setTimeout(() => {
             if (transitionState.active) {
                 viewToHide.removeEventListener('transitionend', transitionState.handler);
                 finishHide();
             }
        }, 350);

        viewToHide.addEventListener('transitionend', transitionState.handler, { once: true });
    } else {
        // Safety: If switching away, ensure it's hidden (catches race condition where it's hidden but pending show was just cancelled)
        if (viewToHide) viewToHide.classList.add('hidden');
        showNewView();
    }
}

async function handleUserLogin(user) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.SESSION_MODE, 'online');
    if (state.unsubscribeFromFirestore) {
        state.unsubscribeFromFirestore();
    }
    cleanupTeamSubscriptions();

    setState({ userId: user.uid, isOnlineMode: true });
    DOM.userIdDisplay.textContent = i18n.t('dashboard.userIdPrefix') + user.uid;

    switchView(DOM.loadingView, DOM.loginView);

    // Initialize TOG Tracker
    initTog(user.uid);
    DOM.navTogBtn.classList.remove('hidden');

    // Update TB header
    renderTbHeader(user);

    // Now, with the user document guaranteed to exist, subscribe to data.
    subscribeToData(user.uid, async () => {
        // Check for offline data to migrate ONCE, inside callback to ensure we have cloud data for merging
        const guestDataString = localStorage.getItem(LOCAL_STORAGE_KEYS.GUEST_USER_DATA);
        if (guestDataString) {
            try {
                const guestData = JSON.parse(guestDataString);
                const hasData = Object.keys(guestData.yearlyData || {}).length > 0 || (guestData.leaveTypes && guestData.leaveTypes.length > 0);
                
                if (hasData) {
                    // Use a simple confirm for now as per requirements
                    const promptMsg = i18n.t('admin.migrateDataPrompt');

                    if (confirm(promptMsg)) {
                        try {
                            // Merge with existing cloud data (state)
                            const mergedData = mergeUserData(state, guestData);
                            await persistData(mergedData);
                            localStorage.removeItem(LOCAL_STORAGE_KEYS.GUEST_USER_DATA);
                            showMessage(i18n.t("admin.msgMigratedSuccess"), "success");
                            // Refresh state immediately
                            setState(mergedData);
                        } catch (e) {
                            Logger.error("Migration failed", e);
                            showMessage(i18n.t("admin.msgMigratedFailed"), "error");
                        }
                    } else {
                        // User declined, clear local data to stop asking
                        const deleteMsg = i18n.t('admin.deleteGuestDataPrompt');
                        if (confirm(deleteMsg)) {
                            localStorage.removeItem(LOCAL_STORAGE_KEYS.GUEST_USER_DATA);
                        }
                    }
                }
            } catch (e) {
                Logger.error("Error parsing guest data for migration:", e);
                // If data is corrupt, clear it to prevent future errors
                localStorage.removeItem(LOCAL_STORAGE_KEYS.GUEST_USER_DATA);
            }
        }

        // Team data will now be loaded on-demand when the user expands the team section.
        switchView(DOM.appView, DOM.loadingView, updateView);
    });
}

function showMessage(msg, type = 'info') {
    DOM.messageText.textContent = msg;
    // Reset classes but keep base structure
    DOM.messageDisplay.className = `fixed bottom-5 right-5 z-50 px-4 py-3 ${NOTIFICATION_SHAPE} shadow-md transition-opacity duration-300`;

    // Add type-specific styles
    if (type === 'error') {
        DOM.messageDisplay.classList.add('bg-red-100', 'border', 'border-red-400', 'text-red-700');
        triggerHapticFeedback('error');
    } else if (type === 'success') {
        DOM.messageDisplay.classList.add('bg-green-100', 'border', 'border-green-400', 'text-green-700');
        triggerHapticFeedback('success');
    } else {
        DOM.messageDisplay.classList.add('bg-blue-100', 'border', 'border-blue-400', 'text-blue-700');
        triggerHapticFeedback('light');
    }

    // Reset Swipe Transform
    DOM.messageDisplay.style.transform = '';

    // Show
    DOM.messageDisplay.classList.add('show');

    // Reset Progress Bar
    if (DOM.messageProgress) {
        DOM.messageProgress.style.width = '100%';
        DOM.messageProgress.style.transition = 'none';
        requestAnimationFrame(() => {
            DOM.messageProgress.style.transition = 'width 3s linear';
            DOM.messageProgress.style.width = '0%';
        });
    }

    // Auto-dismiss
    clearTimeout(DOM.messageDisplay.dataset.timeoutId);
    const timeoutId = setTimeout(() => hideMessage(), 3000);
    DOM.messageDisplay.dataset.timeoutId = timeoutId;
}

function hideMessage() {
    DOM.messageDisplay.classList.remove('show');
    // Allow transition to finish before resetting content or state if needed
}

function setupMessageSwipe() {
    const el = DOM.messageDisplay;
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    el.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
        // Pause auto-dismiss on interaction
        clearTimeout(el.dataset.timeoutId);
        if (DOM.messageProgress) {
            DOM.messageProgress.style.transition = 'none';
            DOM.messageProgress.style.width = '100%'; // Or freeze current width if possible, but full is fine feedback
        }
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX - startX;
        el.style.transform = `translateX(calc(${isMobileDevice() ? '-50% + ' : ''}${currentX}px))`;
        el.style.opacity = Math.max(0, 1 - Math.abs(currentX) / 150);
    }, { passive: true });

    el.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;

        if (Math.abs(currentX) > 100) {
            // Swipe threshold met - dismiss
            const direction = currentX > 0 ? 1 : -1;
            el.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
            el.style.transform = `translateX(calc(${isMobileDevice() ? '-50% + ' : ''}${direction * 100}%))`;
            el.style.opacity = '0';
            setTimeout(() => hideMessage(), 300);
        } else {
            // Reset position
            el.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
            el.style.transform = '';
            el.style.opacity = '1';

            // Resume auto-dismiss
            const timeoutId = setTimeout(() => hideMessage(), 3000);
            el.dataset.timeoutId = timeoutId;
             if (DOM.messageProgress) {
                DOM.messageProgress.style.transition = 'width 3s linear';
                DOM.messageProgress.style.width = '0%';
            }
        }
        currentX = 0;
    });
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
        DOM.currentPeriodDisplay.textContent = formatDateForDisplay(getYYYYMMDD(state.selectedDate), i18n.currentLang);
        renderDailyActivities();
    }
    renderActionButtons();
}

function renderActionButtons() {
    // Logic for Floating Confirm Button visibility and Bottom Controls
    const hasSelection = state.leaveSelection.size > 0 && state.selectedLeaveTypeId;
    if (hasSelection) {
        DOM.floatingConfirmContainer.classList.add('visible');
    } else {
        DOM.floatingConfirmContainer.classList.remove('visible');
    }

    // Toggle active state for Stats and Teams buttons
    const isStatsVisible = DOM.leaveStatsSection.classList.contains('visible');
    const isTeamVisible = DOM.teamSection.classList.contains('visible');

    if (isStatsVisible) {
         DOM.statsToggleBtn.classList.replace('btn-secondary', 'btn-primary');
         DOM.statsArrowDown.classList.add('hidden');
         DOM.statsArrowUp.classList.remove('hidden');
    } else {
         DOM.statsToggleBtn.classList.replace('btn-primary', 'btn-secondary');
         DOM.statsArrowDown.classList.remove('hidden');
         DOM.statsArrowUp.classList.add('hidden');
    }

    if (isTeamVisible) {
         DOM.teamToggleBtn.classList.replace('btn-secondary', 'btn-primary');
         DOM.teamArrowDown.classList.add('hidden');
         DOM.teamArrowUp.classList.remove('hidden');
    } else {
         DOM.teamToggleBtn.classList.replace('btn-primary', 'btn-secondary');
         DOM.teamArrowDown.classList.remove('hidden');
         DOM.teamArrowUp.classList.add('hidden');
    }
}

function renderCalendar() {
    const daysKey = (isMobileDevice() && i18n.getValue('common.shortDays')) ? 'common.shortDays' : 'common.days';
    const days = i18n.getValue(daysKey) || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const header = days.map((day, i) => html`<div class="py-3 text-center text-sm font-semibold ${i === 0 ? 'text-red-500' : 'text-gray-700'}">${day}</div>`);

    const year = state.currentMonth.getFullYear();
    const month = state.currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const today = new Date();
    
    const currentActivities = state.currentYearData.activities || {};
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);

    // Get selected color if active
    let selectedColor = null;
    if (state.selectedLeaveTypeId) {
        const type = visibleLeaveTypes.find(lt => lt.id === state.selectedLeaveTypeId);
        if (type) selectedColor = type.color;
    }

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

        let styleAttr = '';
        if (state.selectedLeaveTypeId && state.leaveSelection.has(dateKey)) {
            classes.push('leave-selecting');
            if (selectedColor) {
                 styleAttr = `--selected-leave-color: ${selectedColor}; --selected-leave-bg: ${selectedColor}15;`; // 15 = ~8% opacity
            }
        }

        const isFullLeave = leaveData && leaveData.dayType === LEAVE_DAY_TYPES.FULL;
        const isSunday = date.getDay() === 0;

        dayCells.push(html`
            <div class="${classes.join(' ')}" data-date="${dateKey}" style="${styleAttr}">
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
            <td class="py-2 px-2 sm:py-3 sm:px-4 text-sm flex gap-1 justify-center items-center">
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
    // If we have a callback, use provided state or current pickerYear (should be synched)
    const pickerYear = state.pickerYear;

    DOM.pickerYearDisplay.textContent = pickerYear;
    const monthNames = i18n.getValue('common.months') || ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Determine current month highlight logic
    let highlightMonth = -1;
    if (state.monthPickerCallback) {
        // If external callback, we might not want to highlight based on app state,
        // or check what was passed. For simplicity, highlight current date month if same year.
        const d = state.monthPickerCurrentDate || new Date();
        if (d.getFullYear() === pickerYear) highlightMonth = d.getMonth();
    } else {
        if (pickerYear === state.currentMonth.getFullYear()) highlightMonth = state.currentMonth.getMonth();
    }

    const months = monthNames.map((name, index) => {
        const isCurrentMonth = index === highlightMonth;
        const classes = `px-1 sm:px-4 py-2 sm:py-3 text-xs sm:text-base rounded-lg font-medium transition-colors duration-200 ${isCurrentMonth ? 'bg-blue-500 text-white' : 'text-gray-800 bg-gray-100 hover:bg-blue-100 hover:text-blue-700'}`;

        return html`
        <button class="${classes}" @click=${() => {
            const newYear = state.pickerYear;
            const newMonthIndex = index;
            
            if (state.monthPickerCallback) {
                // External usage (TOG)
                const newDate = new Date(newYear, newMonthIndex, 1);
                state.monthPickerCallback(newDate);
                DOM.monthPickerModal.classList.remove('visible');
                // Clean up
                state.monthPickerCallback = null;
                state.monthPickerCurrentDate = null;
            } else {
                // Internal usage (TB)
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
            }
        }}>${name}</button>`;
    });

    render(html`${months}`, DOM.monthGrid);
}

function openSharedMonthPicker(currentDate, callback) {
    state.monthPickerCallback = callback;
    state.monthPickerCurrentDate = currentDate;
    state.previousActiveElement = document.activeElement;
    setState({ pickerYear: currentDate.getFullYear() });

    renderMonthPicker();
    DOM.monthPickerModal.classList.add('visible');
    // Focus close button or first interactive element
    document.getElementById('close-month-picker-btn')?.focus();
}

async function subscribeToData(userId, callback) {
    const userDocRef = doc(db, COLLECTIONS.USERS, userId);
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
        let userRole = data.role || USER_ROLES.STANDARD;

        // Enforce Expiry
        if (userRole === USER_ROLES.PRO && data.proExpiry) {
            const expiry = data.proExpiry.toDate ? data.proExpiry.toDate() : new Date(data.proExpiry.seconds * 1000);
            if (expiry < new Date()) {
                userRole = USER_ROLES.STANDARD;
            }
        }

        if (userRole === USER_ROLES.STANDARD && data.isPro) {
            userRole = USER_ROLES.PRO;
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

        // Update user menu header info
        renderTbHeader(auth.currentUser || { uid: userId, email: data.email });

        updateView();

        if (callback) {
            callback();
            callback = null;
        }
    });
    setState({ unsubscribeFromFirestore: unsubscribe });
}

// ... (Rest of existing functions persistData, handleAddSlot, etc. unchanged)

function loadOfflineData() {
    localStorage.setItem(LOCAL_STORAGE_KEYS.SESSION_MODE, 'offline');
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

    initTog(null);
    DOM.navTogBtn.classList.remove('hidden');

    // Guest header
    renderTbHeader(null);

    // Switch directly to app view
    switchView(DOM.appView, DOM.loginView, updateView);
}

// ... (Rest of existing functions)

function handleUserLogout() {
    if (state.unsubscribeFromFirestore) {
        state.unsubscribeFromFirestore();
    }

    if (DOM.navTogBtn) DOM.navTogBtn.classList.add('hidden');

    // Clean up team subscriptions
    cleanupTeamSubscriptions();

    localStorage.removeItem('sessionMode');

    // 1. Reset splash screen to be visible behind the app (z-index -10)
    // IMPORTANT: Keep display: flex but z-index -10 so it acts as a wallpaper
    if (DOM.splashScreen) {
        DOM.splashScreen.style.display = 'flex';
        DOM.splashScreen.style.zIndex = '-10';
        DOM.splashText.style.display = 'none';
        DOM.tapToBegin.style.display = 'none';
        DOM.splashLoading.style.display = 'none';
        DOM.splashText.classList.remove('animating-out');
        DOM.splashScreen.style.cursor = 'default';
        // Ensure opacity is 1 so it's visible behind the fading app
        DOM.splashScreen.style.opacity = '1';
        DOM.splashScreen.style.backgroundColor = ''; // Reset transparent bg if set
    }

    // 2. Fade out App View manually
    if (DOM.appView && !DOM.appView.classList.contains('hidden')) {
        DOM.appView.style.transition = 'opacity 0.5s ease-out';
        DOM.appView.style.opacity = '0';

        // Wait for fade out to complete (500ms)
        setTimeout(() => {
            // 3. Hide App View completely after fade
            DOM.appView.classList.add('hidden');

            // 4. Perform state cleanup and switch to login
            performLogoutCleanup();
        }, 500);
    } else {
        performLogoutCleanup();
    }
}

// ... (Rest of existing functions)

// Helper functions for new TB menu
function renderTbHeader(user) {
    if (!DOM.tbMenuUserEmail || !DOM.tbMenuAvatar) return;

    const email = user ? (user.email || "Guest Session") : "Guest Session";
    const letter = email.charAt(0).toUpperCase();

    DOM.tbMenuUserEmail.textContent = email;

    if (user && user.uid) {
        // Generate color like TOG
        const uid = user.uid;
        let hash = 0;
        for (let i = 0; i < uid.length; i++) {
            hash = uid.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c1 = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        const c2 = ((hash >> 4) & 0x00FFFFFF).toString(16).toUpperCase();
        const color1 = "#" + "00000".substring(0, 6 - c1.length) + c1;
        const color2 = "#" + "00000".substring(0, 6 - c2.length) + c2;

        DOM.tbMenuAvatar.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
        DOM.tbMenuAvatar.style.color = 'white';
        DOM.tbMenuAvatar.textContent = letter;
    } else {
        // Guest
        DOM.tbMenuAvatar.style.background = '#e5e7eb'; // gray-200
        DOM.tbMenuAvatar.style.color = '#6b7280'; // gray-500
        DOM.tbMenuAvatar.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    }
}

function setupTbUserMenu() {
    if (DOM.tbUserAvatarBtn && DOM.tbUserDropdown && DOM.tbMenuContainer) {
        // Toggle on click
        DOM.tbUserAvatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isClosed = DOM.tbUserDropdown.classList.contains('opacity-0');
            if (isClosed) {
                DOM.tbUserDropdown.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
            } else {
                DOM.tbUserDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!DOM.tbMenuContainer.contains(e.target)) {
                DOM.tbUserDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            }
        });

        // Bind Actions
        if (DOM.tbBackupBtn) DOM.tbBackupBtn.addEventListener('click', () => {
            downloadCSV();
            DOM.tbUserDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        });

        if (DOM.tbRestoreBtn) DOM.tbRestoreBtn.addEventListener('click', () => {
            const uploadCsvInput = document.getElementById('upload-csv-input');
            if (uploadCsvInput) uploadCsvInput.click();
            DOM.tbUserDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        });

        if (DOM.tbResetBtn) DOM.tbResetBtn.addEventListener('click', () => {
            state.swipeActionCallback = resetAllData;
            DOM.swipeText.innerText = "Swipe to Reset >>";
            DOM.swipeConfirmModal.querySelector('h3').innerText = i18n.t("common.areYouSure");
            DOM.swipeConfirmModal.querySelector('p').innerText = state.isOnlineMode ? i18n.t("dashboard.resetConfirmCloud") : i18n.t("dashboard.resetConfirmLocal");
            DOM.swipeConfirmModal.classList.add('visible');
            resetSwipeConfirm();
            DOM.tbUserDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        });

        if (DOM.tbLogoutBtn) {
            setupDoubleClickConfirm(
                DOM.tbLogoutBtn,
                'signOut',
                'auth.confirmSignOut',
                () => {
                    appSignOut();
                    DOM.tbUserDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
                }
            );
        }
    }
}

// ... (Rest of existing functions)

async function subscribeToAppConfig() {
    await loadFirebaseModules();
    const configRef = doc(db, COLLECTIONS.CONFIG, COLLECTIONS.APP_CONFIG);
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
        Logger.warn("Could not fetch app config (likely permission issue or missing doc):", error);
    });
}

function toggleTogView() {
    const isAppVisible = !DOM.appView.classList.contains('hidden');
    const togText = DOM.navTogBtn.querySelector('span');
    const togIcon = DOM.navTogBtn.querySelector('i');

    if (isAppVisible) {
        // Switch to TOG
        switchView(DOM.togView, DOM.appView);
        if (togText) togText.innerText = "TrackerBuddy";
        if (togIcon) {
            togIcon.className = "fas fa-home text-base"; // Change to home icon or similar
        }
    } else {
        // Switch to TB
        switchView(DOM.appView, DOM.togView, () => {
            loadTheme();
            updateView();
        });
        if (togText) togText.innerText = "TOGtracker";
        if (togIcon) {
            togIcon.className = "fas fa-clock text-base";
        }
    }
}

// ... (Swipe Confirm functions unchanged)
function setupSwipeConfirm() {
    const track = DOM.swipeTrack;
    const thumb = DOM.swipeThumb;
    const fill = DOM.swipeFill;
    const text = DOM.swipeText;
    const successText = DOM.swipeSuccessText;

    if (!track || !thumb) return;

    let isDragging = false;
    let startX = 0;
    let maxDrag = 0;

    const startDrag = (clientX) => {
        isDragging = true;
        startX = clientX;
        maxDrag = track.clientWidth - thumb.clientWidth - 8; // -8 for padding/borders approx
        thumb.classList.remove('resetting');
        fill.classList.remove('resetting');
    };

    const onMove = (clientX) => {
        if (!isDragging) return;

        let moveX = clientX - startX;
        if (moveX < 0) moveX = 0;
        if (moveX > maxDrag) moveX = maxDrag;

        requestAnimationFrame(() => {
            thumb.style.transform = `translateX(${moveX}px)`;
            fill.style.width = `${moveX + thumb.clientWidth / 2}px`;
            text.style.opacity = Math.max(0, 1 - (moveX / (maxDrag * 0.6)));
        });
    };

    const endDrag = (clientX) => {
        if (!isDragging) return;
        isDragging = false;

        let moveX = clientX - startX;
        if (moveX > maxDrag * 0.9) {
            // Confirm
            fill.style.width = '100%';
            thumb.style.transform = `translateX(${maxDrag}px)`; // Snap to end
            text.style.opacity = '0';
            successText.style.opacity = '1';

            triggerHapticFeedback('success');

            // Perform Action after brief delay
            setTimeout(() => {
                DOM.swipeConfirmModal.classList.remove('visible');
                if (state.swipeActionCallback) {
                    state.swipeActionCallback();
                    state.swipeActionCallback = null;
                }
            }, 300);
        } else {
            // Reset
            thumb.classList.add('resetting');
            fill.classList.add('resetting');
            thumb.style.transform = 'translateX(0)';
            fill.style.width = '0';
            text.style.opacity = '1';
        }
    };

    // Mouse Events
    thumb.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent text selection
        startDrag(e.clientX);
    });
    document.addEventListener('mousemove', (e) => {
        if (isDragging) onMove(e.clientX);
    });
    document.addEventListener('mouseup', (e) => {
        if (isDragging) endDrag(e.clientX);
    });

    // Touch Events
    thumb.addEventListener('touchstart', (e) => {
        // e.preventDefault(); // Might block scrolling if not careful, but needed here?
        // Using touch-action: none in CSS on track instead.
        startDrag(e.touches[0].clientX);
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
        if (isDragging) onMove(e.touches[0].clientX);
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (isDragging) endDrag(e.changedTouches[0].clientX);
    });

    DOM.cancelSwipeBtn.addEventListener('click', () => {
        DOM.swipeConfirmModal.classList.remove('visible');
    });
}

function resetSwipeConfirm() {
    if (!DOM.swipeThumb) return;
    DOM.swipeThumb.classList.add('resetting');
    DOM.swipeFill.classList.add('resetting');
    DOM.swipeThumb.style.transform = 'translateX(0)';
    DOM.swipeFill.style.width = '0';
    DOM.swipeText.style.opacity = '1';
    DOM.swipeSuccessText.style.opacity = '0';

    // Remove resetting class after animation to allow drag without lag
    setTimeout(() => {
        DOM.swipeThumb.classList.remove('resetting');
        DOM.swipeFill.classList.remove('resetting');
    }, 350);
}
