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
import { initTog, performReset as performTogReset, renderCalendar as renderTogCalendar, updateLeaveData } from './tog.js';

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
    if (DOM.togView && !DOM.togView.classList.contains('hidden')) {
        renderTogCalendar();
    }
    // Update swipe modal text if visible
    if (DOM.swipeConfirmModal?.classList.contains('visible')) {
        if (state.pendingSwipeAction === 'performTrackerReset') {
            if (DOM.swipeText) DOM.swipeText.textContent = i18n.t('dashboard.swipeToResetTracker');
            const desc = DOM.swipeConfirmModal.querySelector('p');
            if (desc) desc.textContent = state.isOnlineMode ? i18n.t('dashboard.resetConfirmCloud') : i18n.t('dashboard.resetConfirmLocal');
        } else if (state.pendingSwipeAction === 'performTogReset') {
            if (DOM.swipeText) DOM.swipeText.textContent = i18n.t('tog.swipeToReset');
            const desc = DOM.swipeConfirmModal.querySelector('p');
            if (desc) desc.textContent = i18n.t('tog.resetConfirm');
        } else if (state.pendingSwipeAction === 'deleteLeaveType') {
             if (DOM.swipeText) DOM.swipeText.textContent = i18n.t('admin.swipeToDelete');
             const desc = DOM.swipeConfirmModal.querySelector('p');
             if (desc) desc.textContent = i18n.t('admin.swipeToDeleteDesc');
        }
    }
});

// --- Global App State ---
let state = createInitialState();

// --- State Management ---
function setState(newState) {
    state = { ...state, ...newState };
    if (newState.yearlyData || newState.leaveTypes) {
        updateLeaveData(state.yearlyData, state.leaveTypes);
    }
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
        tbHelpBtn: document.getElementById('tb-help-btn'),
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
        // Navigation & Menus
        navTogBtn: document.getElementById('nav-tog-btn'),
        tbUserAvatarBtn: document.getElementById('tb-user-avatar-btn'),
        tbUserDropdown: document.getElementById('tb-user-dropdown'),
        tbMenuContainer: document.getElementById('tb-user-menu-container'),
        tbMenuAvatar: document.getElementById('tb-menu-avatar'),
        tbMenuEmail: document.getElementById('tb-menu-user-email'),
        // Archive Modal
        archiveModal: document.getElementById('archive-modal'),
        archiveYearList: document.getElementById('archive-year-list')
    };

    setupMessageSwipe();
    setupSwipeConfirm();

    window.showAppMessage = showMessage;
    window.appSignOut = appSignOut;
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
        } else if (viewToShow === DOM.appView || viewToShow === DOM.togView) {
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

        viewToHide?.addEventListener('transitionend', transitionState.handler, { once: true });
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

        setupTbUserMenu(user);
        // Team data will now be loaded on-demand when the user expands the team section.
        switchView(DOM.appView, DOM.loadingView, updateView);
        // Toggle Nav Button
        DOM.navTogBtn.classList.remove('hidden');
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

    el?.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
        // Pause auto-dismiss on interaction
        clearTimeout(el.dataset.timeoutId);
        if (DOM.messageProgress) {
            DOM.messageProgress.style.transition = 'none';
            DOM.messageProgress.style.width = '100%'; // Or freeze current width if possible, but full is fine feedback
        }
    }, { passive: true });

    el?.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX - startX;
        el.style.transform = `translateX(calc(${isMobileDevice() ? '-50% + ' : ''}${currentX}px))`;
        el.style.opacity = Math.max(0, 1 - Math.abs(currentX) / 150);
    }, { passive: true });

    el?.addEventListener('touchend', () => {
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
    try {
        if (!DOM.dailyActivityTableBody) {
             console.warn("dailyActivityTableBody not found");
             return;
        }

        const dateKey = getYYYYMMDD(state.selectedDate);
        const currentYearData = state.currentYearData || { activities: {}, leaveOverrides: {} };
        const currentActivities = currentYearData.activities || {};
        const dailyActivitiesMap = currentActivities[dateKey] || {};
        let dailyActivitiesArray = [];

        if (DOM.dailyNoteInput) {
             DOM.dailyNoteInput.value = dailyActivitiesMap.note || '';
        }

        const hasStoredActivities = Object.keys(dailyActivitiesMap).filter(key => key !== '_userCleared' && key !== 'note' && key !== 'leave').length > 0;

        if (hasStoredActivities) {
            dailyActivitiesArray = Object.keys(dailyActivitiesMap)
                .filter(timeKey => timeKey !== '_userCleared' && timeKey !== 'note' && timeKey !== 'leave')
                .map(timeKey => {
                    const activityData = dailyActivitiesMap[timeKey];
                    // Defensive check to prevent render crashes if data is corrupted
                    if (!activityData || typeof activityData !== 'object') {
                        // Logger.warn(`Invalid activity data for time ${timeKey}`, activityData);
                        return null;
                    }

                    // Ensure text and order exist, defaulting if missing (handles corruption)
                    return {
                        time: timeKey,
                        ...activityData, // Spread first so defaults can overwrite invalid values
                        text: typeof activityData.text === 'string' ? activityData.text : '',
                        order: typeof activityData.order === 'number' ? activityData.order : 0
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.order - b.order);
        } else if (dailyActivitiesMap._userCleared !== true && state.selectedDate.getDay() !== 0) {
            for (let h = 8; h <= 17; h++) {
                dailyActivitiesArray.push({ time: `${String(h).padStart(2, '0')}:00-${String(h + 1).padStart(2, '0')}:00`, text: "", order: h - 8 });
            }
        }

        if (DOM.noDailyActivitiesMessage) {
            DOM.noDailyActivitiesMessage.classList.toggle('hidden', dailyActivitiesArray.length > 0);
        }

        const rows = dailyActivitiesArray.map((activity, index) => {
            try {
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
            } catch (err) {
                Logger.error(`Error rendering activity row for ${activity?.time}:`, err);
                return html``;
            }
        });

        render(html`${rows}`, DOM.dailyActivityTableBody);
    } catch (error) {
        Logger.error("Error rendering daily activities:", error);
        // Fallback or empty state
        if (DOM.noDailyActivitiesMessage) DOM.noDailyActivitiesMessage.classList.remove('hidden');
        if (DOM.dailyActivityTableBody) DOM.dailyActivityTableBody.innerHTML = '';
        showMessage(i18n.t("messages.renderError") || "Error displaying activities", 'error');
    }
}

function renderMonthPicker() {
    DOM.pickerYearDisplay.textContent = state.pickerYear;
    const monthNames = i18n.getValue('common.months') || ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const months = monthNames.map((name, index) => {
        const isCurrentMonth = state.pickerYear === state.currentMonth.getFullYear() && index === state.currentMonth.getMonth();
        const classes = `px-1 sm:px-4 py-2 sm:py-3 text-xs sm:text-base rounded-lg font-medium transition-colors duration-200 ${isCurrentMonth ? 'bg-blue-500 text-white' : 'text-gray-800 bg-gray-100 hover:bg-blue-100 hover:text-blue-700'}`;

        return html`
        <button class="${classes}" @click=${() => {
            const newYear = state.pickerYear;

            if (state.pickerCallback) {
                state.pickerCallback(new Date(newYear, index, 1));
                state.pickerCallback = null;
                DOM.monthPickerModal.classList.remove('visible');
                return;
            }

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

// --- Storage Usage Indicator ---
function calculateDataSize(data) {
    try {
        const json = JSON.stringify(data);
        return new Blob([json]).size;
    } catch (e) {
        return 0;
    }
}

function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function renderStorageUsage(byteSize) {
    const container = document.getElementById('storage-usage-container');
    const bar = document.getElementById('storage-usage-bar');
    const text = document.getElementById('storage-text');

    if (!container || !bar || !text) return;

    const limitBytes = 950 * 1024; // 950 KB safe buffer
    const percentage = Math.min(100, (byteSize / limitBytes) * 100);

    // UI displays "Usage / 928KB" as requested
    const displayLimit = "928 KB";
    text.textContent = `${formatBytes(byteSize)} / ${displayLimit}`;

    bar.style.width = `${percentage}%`;

    // Color coding: Green < 70%, Yellow 70-90%, Red > 90%
    bar.className = 'h-1.5 rounded-full transition-all duration-500';
    if (percentage > 90) {
        bar.classList.add('bg-red-500');
    } else if (percentage > 70) {
        bar.classList.add('bg-yellow-500');
    } else {
        bar.classList.add('bg-green-500');
    }

    container.classList.remove('hidden');
}


async function subscribeToData(userId, callback) {
    const userDocRef = doc(db, COLLECTIONS.USERS, userId);
    const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
        // Prevent external updates from overwriting local state while user is typing
        if (state.editingInlineTimeKey) {
            return;
        }

        let data = docSnapshot.exists() ? docSnapshot.data() : {};

        renderStorageUsage(calculateDataSize(data));

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
            archivedSummaries: data.archivedSummaries || {},
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
    const teamDocRef = doc(db, COLLECTIONS.TEAMS, state.currentTeam);
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

    const summaryCollectionRef = collection(db, COLLECTIONS.TEAMS, state.currentTeam, COLLECTIONS.MEMBER_SUMMARIES);

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
        Logger.error("Error listening to team member summaries:", error);
        showMessage(i18n.t("team.msgRealTimeError"), "error");
    });

    setState({ unsubscribeFromTeamMembers: [unsubscribe] });
}

async function triggerTeamSync() {
    if (!state.isOnlineMode || !state.userId || !state.currentTeam) return;

    try {
        Logger.info("Triggering team summary sync...");
        const { functions, httpsCallable } = await getFunctionsInstance();
        const syncCallable = httpsCallable(functions, 'syncTeamMemberSummary');
        // We don't await this to keep the UI responsive, but we catch errors.
        syncCallable().then(() => {
            Logger.info("Team summary synced successfully.");
        }).catch(error => {
             Logger.error("Failed to sync team summary:", error);
        });
    } catch (error) {
        Logger.error("Error triggering team sync:", error);
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
            Logger.error("Error saving to Firestore:", error);
            showMessage(i18n.t("messages.saveError"), 'error');
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
    return { message: i18n.t("messages.newSlotAdded"), newTimeKey };
}

function handleUpdateActivityText(dayDataCopy, payload) {
    if (dayDataCopy[payload.timeKey]) {
        dayDataCopy[payload.timeKey].text = payload.newText;
    } else {
        const order = Object.keys(dayDataCopy).filter(k => k !== '_userCleared' && k !== 'note' && k !== 'leave').length;
        dayDataCopy[payload.timeKey] = { text: payload.newText, order };
    }
    delete dayDataCopy._userCleared;
    return i18n.t("messages.activityUpdated");
}

function handleUpdateTime(dayDataCopy, payload) {
    const { oldTimeKey, newTimeKey } = payload;
    if (!newTimeKey) {
        showMessage(i18n.t("messages.timeEmpty"), 'error');
        return null;
    }
    if (Object.prototype.hasOwnProperty.call(dayDataCopy, newTimeKey) && oldTimeKey !== newTimeKey) {
        showMessage(i18n.t("messages.timeExists").replace('{time}', newTimeKey), 'error');
        return null;
    }

    if (oldTimeKey !== newTimeKey && Object.prototype.hasOwnProperty.call(dayDataCopy, oldTimeKey)) {
        dayDataCopy[newTimeKey] = dayDataCopy[oldTimeKey];
        delete dayDataCopy[oldTimeKey];
    }
    return i18n.t("messages.timeUpdated");
}

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
            // Sanitize time key to prevent Firestore nesting issues
            if (action.payload.newTimeKey) {
                // Trim and replace invalid characters
                action.payload.newTimeKey = action.payload.newTimeKey.trim().replace(/[./]/g, ':');
            }
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

    renderStorageUsage(calculateDataSize(dataToSave));

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
        Logger.error("Error persisting data:", error);
        showMessage(i18n.t("messages.saveRevertError"), 'error');
        const revertedCurrentYearData = originalYearlyData[year] || { activities: {}, leaveOverrides: {} };
        setState({ yearlyData: originalYearlyData, currentYearData: revertedCurrentYearData });
        updateView();
    }
}

function loadDataFromLocalStorage() {
    try {
        const storedDataString = localStorage.getItem(LOCAL_STORAGE_KEYS.GUEST_USER_DATA);
        if (!storedDataString) {
            return { yearlyData: {}, leaveTypes: [] };
        }
        let data = JSON.parse(storedDataString);
        return data;

    } catch (error) {
        Logger.error("Error loading local data:", error);
        showMessage(i18n.t("admin.msgLoadLocalError"), 'error');
        return { yearlyData: {}, leaveTypes: [] };
    }
}

function saveDataToLocalStorage(data) {
    try {
        renderStorageUsage(calculateDataSize(data));
        localStorage.setItem(LOCAL_STORAGE_KEYS.GUEST_USER_DATA, JSON.stringify(data));
    } catch (error) {
        Logger.error("Error saving local data:", error);
        showMessage(i18n.t("admin.msgSaveLocalError"), 'error');
    }
}

async function saveDataToFirestore(data, partialUpdate = null) {
    if (!state.userId) return;

    // Check for modifications to loaded archived years
    const yearsToSaveToArchive = new Set();
    const dataClone = JSON.parse(JSON.stringify(data));

    if (dataClone.yearlyData) {
        Object.keys(dataClone.yearlyData).forEach(year => {
            if (state.loadedArchivedYears.has(year)) {
                yearsToSaveToArchive.add(year);
            }
        });
    }

    // If partial update, extract year from keys like "yearlyData.2023.activities..."
    if (partialUpdate) {
        Object.keys(partialUpdate).forEach(key => {
            const match = key.match(/^yearlyData\.(\d+)\./);
            if (match && state.loadedArchivedYears.has(match[1])) {
                yearsToSaveToArchive.add(match[1]);
            }
        });
    }

    if (yearsToSaveToArchive.size > 0) {
        const batch = writeBatch(db);
        const userDocRef = doc(db, COLLECTIONS.USERS, state.userId);

        for (const year of yearsToSaveToArchive) {
            // 1. Get the latest data for this year from state
            const yearData = state.yearlyData[year];

            // 2. Save to history subcollection (Full overwrite)
            const historyRef = doc(db, `${COLLECTIONS.USERS}/${state.userId}/history/${year}`);
            batch.set(historyRef, yearData);

            // 3. Update summary in main doc
            const leaveBalances = getLeaveBalancesForYear(year, yearData, state.leaveTypes);
            const summary = {
                leaveBalances,
                archivedAt: new Date().toISOString()
            };
            batch.update(userDocRef, {
                [`archivedSummaries.${year}`]: summary,
                lastUpdated: Date.now()
            });

            // 4. Remove from payload intended for main doc
            if (dataClone.yearlyData) {
                delete dataClone.yearlyData[year];
            }
        }

        // Handle remaining updates for main doc
        if (partialUpdate) {
            const newPartial = {};
            let hasMainDocUpdates = false;
            Object.keys(partialUpdate).forEach(key => {
                const match = key.match(/^yearlyData\.(\d+)\./);
                if (match && state.loadedArchivedYears.has(match[1])) {
                    // Skip, handled by batch above
                } else {
                    newPartial[key] = partialUpdate[key];
                    hasMainDocUpdates = true;
                }
            });

            if (hasMainDocUpdates) {
                batch.update(userDocRef, newPartial);
            }
        } else {
            // Full data save (merge) - check if anything remains to be saved
            if (Object.keys(dataClone).length > 0) {
                // If yearlyData became empty object, we still might want to save other fields
                // But avoid saving empty yearlyData: {} if it wasn't intended to wipe everything
                // Actually, merge: true will just update provided fields.
                batch.set(userDocRef, dataClone, { merge: true });
            }
        }

        await batch.commit();
        return;
    }

    if (partialUpdate) {
        try {
            await updateDoc(doc(db, COLLECTIONS.USERS, state.userId), partialUpdate);
            return;
        } catch (e) {
            // Fallback to full save if partial update fails (e.g. document doesn't exist)
            Logger.warn("Partial update failed, falling back to full merge:", e);
        }
    }
    await setDoc(doc(db, COLLECTIONS.USERS, state.userId), data, { merge: true });
}

function loadOfflineData() {
    localStorage.setItem(LOCAL_STORAGE_KEYS.SESSION_MODE, 'offline');
    const data = loadDataFromLocalStorage(); // This now handles migration

    renderStorageUsage(calculateDataSize(data));

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
    setupTbUserMenu(null);
    // Switch directly to app view
    switchView(DOM.appView, DOM.loginView, updateView);
    DOM.navTogBtn.classList.remove('hidden');
}

async function performTrackerReset() {
    // Safety check: Ensure we are NOT in Tog View when resetting TrackerBuddy
    if (DOM.togView && !DOM.togView.classList.contains('hidden')) {
        Logger.warn("Attempted to reset TrackerBuddy data while in Tog View. Aborting.");
        return;
    }

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
            // Only update specific fields, preserving everything else (like togData, teamId)
            const updates = {
                yearlyData: {},
                leaveTypes: []
            };

            await updateDoc(doc(db, COLLECTIONS.USERS, state.userId), updates);

            // This will trigger onSnapshot, which will update the local state.
            triggerTeamSync();
            showMessage(i18n.t("messages.cloudResetSuccess"), 'success');

        } catch (error) {
            Logger.error("Error resetting cloud data:", error);
            showMessage(i18n.t("messages.cloudResetError"), 'error');
        }
    } else {
        localStorage.removeItem(LOCAL_STORAGE_KEYS.GUEST_USER_DATA);
        setState(resetState);
        updateView();
        showMessage(i18n.t("messages.localResetSuccess"), 'success');
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
        showMessage(i18n.t("messages.activitiesReordered"), 'success');
    } catch (error) {
        Logger.error("Failed to reorder activities:", error);
        showMessage(i18n.t("messages.orderSaveError"), "error");
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
        showMessage(i18n.t("messages.activityDeleted"), 'success');

    } catch (error) {
        Logger.error("Failed to delete activity:", error);
        showMessage(i18n.t("messages.deleteSaveError"), "error");
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
        return showMessage(i18n.t("messages.noBackupData"), 'info');
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

            const yearlyDataCopy = JSON.parse(JSON.stringify(state.yearlyData));
            const leaveTypesMap = new Map(state.leaveTypes.map(lt => [lt.id, { ...lt }]));

            const Papa = (await import('papaparse')).default;
            const parsed = Papa.parse(csvContent, {
                skipEmptyLines: true
            });

            const rows = parsed.data;

            if (rows.length <= 1) {
                return showMessage(i18n.t("messages.emptyCSV"), 'error');
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
                            Logger.warn(`Skipping row with invalid date format: ${dateKey}`);
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

            showMessage(i18n.t("messages.restoreSuccess").replace('{count}', processedRows), 'success');
            event.target.value = '';
            updateView();
        } catch (err) {
            Logger.error("Error during CSV restore:", err);
            showMessage(i18n.t("messages.restoreError"), 'error');
        }
    };
    reader.onerror = () => showMessage(i18n.t("messages.readError"), 'error');
    reader.readAsText(file);
}

function handleUserLogout() {
    if (state.unsubscribeFromFirestore) {
        state.unsubscribeFromFirestore();
    }

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
    let viewToFade = null;
    if (DOM.appView && !DOM.appView.classList.contains('hidden')) {
        viewToFade = DOM.appView;
    } else if (DOM.togView && !DOM.togView.classList.contains('hidden')) {
        viewToFade = DOM.togView;
    }

    if (viewToFade) {
        viewToFade.style.transition = 'opacity 0.5s ease-out';
        viewToFade.style.opacity = '0';

        // Wait for fade out to complete (500ms)
        setTimeout(() => {
            // 3. Hide View completely after fade
            viewToFade.classList.add('hidden');

            // 4. Perform state cleanup and switch to login
            performLogoutCleanup();
        }, 500);
    } else {
        performLogoutCleanup();
    }
}

function performLogoutCleanup() {
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

    // 5. Show Login View
    // Since appView is now strictly hidden (display: none), switchView will only handle showing loginView
    switchView(DOM.loginView, null);
}

async function initAuth() {
    await loadFirebaseModules();
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is logged in: Proceed to login flow (which shows spinner -> app)
            // Splash screen remains up (z-index 100) showing loading spinner until app is ready.
            handleUserLogin(user);
        } else {
            if (state.isLoggingOut) {
                // Let handleUserLogout manage the transition to avoid glitches
                return;
            }
            const sessionMode = localStorage.getItem('sessionMode');
            if (sessionMode === 'offline') {
                loadOfflineData(); // Centralized offline data loading
            } else {
                // User not logged in:
                // 1. Prepare Login View (behind splash)
                switchView(DOM.loginView, DOM.loadingView);
                // 2. Enable "Tap to Begin" interaction on Splash Screen
                setupSplashTapListener();
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
        return showMessage(i18n.t("auth.msgRequired"), 'error');
    }

    setButtonLoadingState(button, true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        handleUserLogin(userCredential.user);
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            showMessage(i18n.t("auth.msgAccountExists"), 'error');
        } else {
            showMessage(i18n.t("auth.msgSignUpFailed").replace('{error}', error.message), 'error');
        }
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function editTeamName() {
    const button = DOM.editTeamNameModal.querySelector('#save-edit-team-name-btn');
    const newTeamName = DOM.newTeamNameInput.value.trim();

    if (!newTeamName) {
        showMessage(i18n.t("team.msgNameRequired"), 'error');
        return;
    }

    setButtonLoadingState(button, true);
    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const editTeamNameCallable = httpsCallable(functions, 'editTeamName');
        await editTeamNameCallable({ newTeamName: newTeamName, teamId: state.currentTeam });
        showMessage(i18n.t("team.msgNameUpdated"), 'success');
        closeEditTeamNameModal();
    } catch (error) {
        Logger.error('Error updating team name:', error);
        showMessage(i18n.t("team.msgNameUpdateFailed").replace('{error}', error.message), 'error');
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
        return showMessage(i18n.t("auth.msgEmailPasswordRequired"), 'error');
    }

    setButtonLoadingState(button, true);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        handleUserLogin(userCredential.user);
    } catch (error) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            showMessage(i18n.t("auth.msgAuthFailed"), 'error');
        } else {
            showMessage(i18n.t("auth.msgSignInFailed").replace('{error}', error.message), 'error');
        }
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function resetPassword(email) {
    const button = DOM.forgotPasswordBtn;
    if (!email) {
        setInputErrorState(document.getElementById('email-input'), true);
        return showMessage(i18n.t("auth.msgEmailRequired"), 'info');
    }
    setButtonLoadingState(button, true);
    button.classList.add('loading');
    try {
        await sendPasswordResetEmail(auth, email);
        showMessage(i18n.t("auth.msgResetEmailSent"), 'success');
    } catch (error) {
        showMessage(i18n.t("auth.msgResetEmailFailed").replace('{error}', error.message), 'error');
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
        showMessage(i18n.t("auth.msgGoogleFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function appSignOut() {
    if (state.isOnlineMode) {
        try {
            setState({ isLoggingOut: true });
            await signOut(auth);
            handleUserLogout();
        } catch (error) {
            setState({ isLoggingOut: false });
            showMessage(i18n.t("auth.msgSignOutFailed").replace('{error}', error.message), 'error');
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
        lightIcon.classList.remove('hidden');
        darkIcon.classList.add('hidden');
        if (themeColorMeta) themeColorMeta.content = '#000000';
    } else {
        document.body.classList.remove('dark');
        lightIcon.classList.add('hidden');
        darkIcon.classList.remove('hidden');
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
    if (!element) return;
    element?.addEventListener('click', (e) => {
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
        triggerHapticFeedback('medium');
        DOM.dailyActivityTableBody.insertBefore(currentRow, currentRow.previousElementSibling);
        updateActivityOrder();
    }
}

function handleMoveDownClick(currentRow) {
    if (currentRow.nextElementSibling) {
        triggerHapticFeedback('medium');
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
        const target = event.target;
        event.preventDefault();
        // Manually trigger save, then blur (safe to call twice due to state check)
        handleInlineEditBlur({ currentTarget: target });
        target.blur();
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
        DOM.splashScreen.style.opacity = '1';
        DOM.splashScreen.style.backgroundColor = '#0f172a';

        DOM.splashScreen?.addEventListener('click', returnToApp, { once: true });
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
    video.preload = 'auto';

    // Set src directly for better compatibility
    video.src = videoSrc;

    const track = document.createElement('track');
    track.kind = 'captions';
    track.label = 'English';
    track.srclang = 'en';
    track.src = 'data:text/vtt;base64,V0VCVVRUClxu'; // Empty VTT file
    track.default = true;
    video.appendChild(track);

    const showVideo = () => {
        video.style.opacity = '1';
    };

    // Use addEventListener for better reliability
    video?.addEventListener('canplay', showVideo, { once: true });
    video?.addEventListener('loadeddata', showVideo, { once: true });

    // Explicitly try to play
    video.play().catch(error => {
        Logger.warn("Autoplay failed:", error);
    });

    splashImage.parentNode.insertBefore(video, splashImage.nextSibling);
}


// --- Leave Management ---
function getVisibleLeaveTypesForYear(year) {
    const yearData = state.yearlyData[year] || {};
    const overrides = yearData.leaveOverrides || {};
    return state.leaveTypes.filter(lt => {
        if (overrides[lt.id]?.hidden) return false;
        if (lt.limitYear && lt.limitYear !== year) return false;
        return true;
    });
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
        DOM.leaveTypeModalTitle.innerHTML = i18n.t('tracker.editLeaveType');
        DOM.editingLeaveTypeId.value = leaveType.id;
        DOM.leaveNameInput.value = leaveType.name;
        DOM.leaveDaysInput.value = totalDays;
        selectColorInPicker(leaveType.color);
        DOM.limitLeaveToYearBtn.dataset.limited = !!leaveType.limitYear;
        DOM.deleteLeaveTypeBtn.classList.remove('hidden');
    } else {
        DOM.leaveTypeModalTitle.dataset.i18n = 'addNewLeaveType';
        DOM.leaveTypeModalTitle.innerHTML = i18n.t('tracker.addNewLeaveType');
        DOM.editingLeaveTypeId.value = '';
        DOM.leaveNameInput.value = '';
        DOM.leaveDaysInput.value = '';
        selectColorInPicker(null);
        DOM.limitLeaveToYearBtn.dataset.limited = 'false';
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
        <button type="button" data-color="${color}" aria-label="${i18n.t('colors.' + COLOR_MAP[color].toLowerCase())}" style="background-color: ${color};" class="w-10 h-10 rounded-full border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"></button>
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
    const limitToCurrentYear = DOM.limitLeaveToYearBtn.dataset.limited === 'true';
    const selectedColorEl = DOM.leaveColorPicker.querySelector('.ring-blue-500');
    const color = selectedColorEl ? selectedColorEl.dataset.color : null;

    if (!name || isNaN(totalDays) || !color) {
        showMessage(i18n.t("tracker.msgLeaveTypeFieldsRequired"), 'error');
        setButtonLoadingState(button, false);
        return;
    }

    const currentYear = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(currentYear);
    const isColorTaken = visibleLeaveTypes.some(lt => lt.color === color && lt.id !== id);
    if (isColorTaken) {
        showMessage(i18n.t("tracker.msgLeaveTypeColorConflict"), 'error');
        setButtonLoadingState(button, false);
        return;
    }

    const newLeaveTypes = [...state.leaveTypes];
    const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));
    const existingIndex = newLeaveTypes.findIndex(lt => lt.id === id);
    const limitYear = limitToCurrentYear ? currentYear : null;

    if (existingIndex > -1) {
        // Editing existing leave type
        const globalLeaveType = newLeaveTypes[existingIndex];

        // 1. Update Global Name & Color (Always Global per current architecture)
        globalLeaveType.name = name;
        globalLeaveType.color = color;

        // 2. Handle Year Limitation Logic
        if (limitToCurrentYear) {
            // If checking "Limit to Current Year", we effectively want this leave type to be valid ONLY for this year.
            // In our simple model, setting `limitYear` on the global object achieves this filter.
            globalLeaveType.limitYear = currentYear;

            // Handle Total Days Override for this specific year if it differs from global default (or if we treat global as default)
            // If we are limiting to this year, the 'global' totalDays might effectively be this year's days.
            globalLeaveType.totalDays = totalDays;

            // Clean up overrides for this year since we just set the global default to match this year?
            // Actually, if we limit to 2023, overrides for 2024 are irrelevant.
            // But overrides for 2023 might be redundant if they match global.
            if (updatedYearlyData[currentYear]?.leaveOverrides?.[id]) {
                 delete updatedYearlyData[currentYear].leaveOverrides[id].totalDays;
                 if (Object.keys(updatedYearlyData[currentYear].leaveOverrides[id]).length === 0) {
                    delete updatedYearlyData[currentYear].leaveOverrides[id];
                }
            }
        } else {
            // If UNCHECKING (Universal), we remove the limit.
            delete globalLeaveType.limitYear;

            // We update the GLOBAL total days.
            globalLeaveType.totalDays = totalDays;

            // And we implicitly want this to apply "as a whole".
            // Standard behavior: Specific overrides > Global.
            // User request: "controls... editing as a whole on all entries overall"
            // This strongly implies resetting deviations.
            // So, we should remove `totalDays` overrides for THIS leave type across ALL years.
            Object.keys(updatedYearlyData).forEach(y => {
                if (updatedYearlyData[y].leaveOverrides && updatedYearlyData[y].leaveOverrides[id]) {
                    delete updatedYearlyData[y].leaveOverrides[id].totalDays;
                    // If override object is empty (and not hidden), delete it
                    if (Object.keys(updatedYearlyData[y].leaveOverrides[id]).length === 0) {
                        delete updatedYearlyData[y].leaveOverrides[id];
                    } else if (Object.keys(updatedYearlyData[y].leaveOverrides[id]).length === 1 && updatedYearlyData[y].leaveOverrides[id].hidden) {
                        // Keep hidden flag if it exists?
                        // If "Universal Function" means "Edit as a whole", maybe it should unhide too?
                        // "Delete" handles hiding. "Edit" usually handles properties.
                        // Let's assume unhiding isn't explicitly requested, but resetting days is.
                    }
                }
            });
        }
    } else {
        // Adding a new leave type - this is always a global addition
        const newLeaveType = { id, name, totalDays, color };
        if (limitYear) {
            newLeaveType.limitYear = limitYear;
        }
        newLeaveTypes.push(newLeaveType);
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
        showMessage(i18n.t("tracker.msgLeaveTypeSaved"), 'success');
    } catch (error) {
        Logger.error("Failed to save leave type:", error);
        showMessage(i18n.t("tracker.msgLeaveTypeSaveFailed"), 'error');
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

    const limitToCurrentYear = DOM.limitLeaveToYearBtn.dataset.limited === 'true';
    const timestamp = Date.now();
    state.lastUpdated = timestamp;

    if (limitToCurrentYear) {
        // --- SCENARIO A: Limit to Current Year (Hide Only) ---
        const currentYear = state.currentMonth.getFullYear();
        const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));

        if (!updatedYearlyData[currentYear]) {
            updatedYearlyData[currentYear] = { activities: {}, leaveOverrides: {} };
        }
        if (!updatedYearlyData[currentYear].leaveOverrides) {
            updatedYearlyData[currentYear].leaveOverrides = {};
        }

        // Mark as hidden for this year
        updatedYearlyData[currentYear].leaveOverrides[id] = {
            ...(updatedYearlyData[currentYear].leaveOverrides[id] || {}),
            hidden: true
        };

        // Remove leaves for this year only
        const yearActivities = updatedYearlyData[currentYear].activities || {};
        Object.keys(yearActivities).forEach(dateKey => {
            if (yearActivities[dateKey].leave?.typeId === id) {
                delete yearActivities[dateKey].leave;
            }
        });

        // Capture original data for persistence logic before state update
        const originalYearlyDataForPersistence = state.yearlyData;

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
                    [`yearlyData.${currentYear}.leaveOverrides.${id}.hidden`]: true,
                    lastUpdated: timestamp
                });

                const originalYearActivities = originalYearlyDataForPersistence[currentYear]?.activities || {};
                Object.keys(originalYearActivities).forEach(dateKey => {
                    if (originalYearActivities[dateKey].leave?.typeId === id) {
                        batch.update(userDocRef, {
                            [`yearlyData.${currentYear}.activities.${dateKey}.leave`]: deleteField()
                        });
                    }
                });
                await batch.commit();
            } else {
                saveDataToLocalStorage({
                    yearlyData: updatedYearlyData,
                    leaveTypes: state.leaveTypes,
                    lastUpdated: timestamp
                });
            }
            triggerTeamSync();
            showMessage(i18n.t("tracker.msgLeaveTypeHidden").replace('{year}', currentYear), 'success');
        } catch (error) {
            Logger.error("Failed to hide leave type:", error);
            showMessage(i18n.t("tracker.msgLeaveTypeHideFailed"), 'error');
        }

    } else {
        // --- SCENARIO B: Universal Delete (Remove Global & All Entries) ---
        // 1. Remove from Global Leave Types
        const newLeaveTypes = state.leaveTypes.filter(lt => lt.id !== id);

        // 2. Remove from All Yearly Data (Overrides & Entries)
        const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));

        Object.keys(updatedYearlyData).forEach(year => {
            const yearData = updatedYearlyData[year];

            // Remove Overrides
            if (yearData.leaveOverrides && yearData.leaveOverrides[id]) {
                delete yearData.leaveOverrides[id];
            }

            // Remove Entries
            if (yearData.activities) {
                Object.keys(yearData.activities).forEach(dateKey => {
                    if (yearData.activities[dateKey].leave?.typeId === id) {
                        delete yearData.activities[dateKey].leave;
                    }
                });
            }
        });

        // Capture original data for persistence logic before state update
        const originalYearlyDataForPersistence = state.yearlyData;

        const currentYear = state.currentMonth.getFullYear();
        const currentYearData = updatedYearlyData[currentYear] || { activities: {}, leaveOverrides: {} };

        setState({
            leaveTypes: newLeaveTypes,
            yearlyData: updatedYearlyData,
            currentYearData: currentYearData
        });

        try {
            if (state.isOnlineMode && state.userId) {
                // For global delete, it's safer to overwrite the document structure or use a massive batch
                // But since we are removing a type and potentially many entries across years,
                // a full set/rewrite might be cleaner if the data isn't huge.
                // However, let's try to be efficient.

                // We need to:
                // 1. Update leaveTypes array
                // 2. Remove the override key from every year
                // 3. Remove the leave field from every activity in every year

                // If we use saveLeaveType logic, we just pass the new state.
                // persistData handles `set({ ... }, { merge: true })`.
                // If we pass the new leaveTypes array, it replaces the old one. Good.
                // If we pass updatedYearlyData, it merges.
                // PROBLEM: `merge: true` won't delete keys (overrides/activities) that are missing in the input!
                // To actually DELETE fields in Firestore via merge, we need `deleteField()`.

                const batch = writeBatch(db);
                const userDocRef = doc(db, "users", state.userId);

                // 1. Update Leave Types
                batch.update(userDocRef, {
                    leaveTypes: newLeaveTypes,
                    lastUpdated: timestamp
                });

                // 2. Delete Overrides & Activities recursively
                // We iterate the *original* state to find what to delete
                Object.keys(originalYearlyDataForPersistence).forEach(year => {
                    const yearData = originalYearlyDataForPersistence[year];

                    // Delete Override if exists
                    if (yearData.leaveOverrides && yearData.leaveOverrides[id]) {
                        batch.update(userDocRef, {
                            [`yearlyData.${year}.leaveOverrides.${id}`]: deleteField()
                        });
                    }

                    // Delete Activities
                    if (yearData.activities) {
                        Object.keys(yearData.activities).forEach(dateKey => {
                            if (yearData.activities[dateKey].leave?.typeId === id) {
                                batch.update(userDocRef, {
                                    [`yearlyData.${year}.activities.${dateKey}.leave`]: deleteField()
                                });
                            }
                        });
                    }
                });

                await batch.commit();
            } else {
                saveDataToLocalStorage({
                    yearlyData: updatedYearlyData,
                    leaveTypes: newLeaveTypes,
                    lastUpdated: timestamp
                });
            }
            triggerTeamSync();
            showMessage(i18n.t("tracker.msgLeaveTypeDeleted"), 'success');
        } catch (error) {
            Logger.error("Failed to delete leave type globally:", error);
            showMessage(i18n.t("tracker.msgLeaveTypeDeleteFailed"), 'error');
        }
    }

    closeLeaveTypeModal();
    updateView();
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
    showMessage(i18n.t("tracker.msgLeaveTypesReordered"), 'success');
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

function getLeaveBalancesForYear(year, yearData, leaveTypes) {
    const balances = {};
    const leaveCounts = {};
    const activities = yearData.activities || {};
    const overrides = yearData.leaveOverrides || {};

    leaveTypes.forEach(lt => {
        leaveCounts[lt.id] = 0;
    });

    Object.values(activities).forEach(dayData => {
        if (dayData.leave) {
            const leaveValue = dayData.leave.dayType === LEAVE_DAY_TYPES.HALF ? 0.5 : 1;
            if (leaveCounts.hasOwnProperty(dayData.leave.typeId)) {
                leaveCounts[dayData.leave.typeId] += leaveValue;
            }
        }
    });

    leaveTypes.forEach(lt => {
        // Respect limitYear logic if present
        if (lt.limitYear && String(lt.limitYear) !== String(year)) return;

        const totalDays = overrides[lt.id]?.totalDays ?? lt.totalDays;
        const used = leaveCounts[lt.id] || 0;

        // Only include in summary if relevant (has allowance or usage)
        if (totalDays > 0 || used > 0) {
             balances[lt.id] = {
                name: lt.name,
                color: lt.color,
                total: totalDays,
                used: parseFloat(used.toFixed(2)),
                balance: parseFloat((totalDays - used).toFixed(2))
            };
        }
    });

    return balances;
}

async function archiveYear(year) {
    if (!state.yearlyData[year]) return;

    const yearData = state.yearlyData[year];
    const leaveBalances = getLeaveBalancesForYear(year, yearData, state.leaveTypes);
    const summary = {
        leaveBalances,
        archivedAt: new Date().toISOString()
    };

    const historyPath = `${COLLECTIONS.USERS}/${state.userId}/history/${year}`;

    try {
        if (state.isOnlineMode && state.userId) {
            const batch = writeBatch(db);
            const userDocRef = doc(db, COLLECTIONS.USERS, state.userId);
            const historyDocRef = doc(db, historyPath);

            // Save to history subcollection
            batch.set(historyDocRef, yearData);

            // Update main doc: Add summary, remove detailed data
            batch.update(userDocRef, {
                [`archivedSummaries.${year}`]: summary,
                [`yearlyData.${year}`]: deleteField(),
                lastUpdated: Date.now()
            });

            await batch.commit();

            const newYearlyData = { ...state.yearlyData };
            delete newYearlyData[year];

            const newArchivedSummaries = { ...state.archivedSummaries, [year]: summary };

            setState({
                yearlyData: newYearlyData,
                archivedSummaries: newArchivedSummaries
            });

            showMessage(i18n.t("messages.archiveSuccess") || `Archived ${year} data`, 'success');

            // If current view is in archived year, switch to valid year
            if (state.currentMonth.getFullYear().toString() === year) {
                 const today = new Date();
                 setState({
                     currentMonth: today,
                     selectedDate: today,
                     currentYearData: state.yearlyData[today.getFullYear()] || { activities: {}, leaveOverrides: {} }
                 });
            }
            updateView();
            // Also refresh modal if open
            if (document.getElementById('archive-modal')?.classList.contains('visible')) {
                renderArchiveModal();
            }
        }
    } catch (error) {
        Logger.error("Archive failed:", error);
        showMessage(i18n.t("messages.archiveFailed") || "Archive failed", 'error');
    }
}

async function loadArchivedYear(year) {
    if (state.yearlyData[year]) return;

    try {
        if (state.isOnlineMode && state.userId) {
            const historyDocRef = doc(db, `${COLLECTIONS.USERS}/${state.userId}/history/${year}`);
            const docSnap = await getDoc(historyDocRef);

            if (docSnap.exists()) {
                const yearData = docSnap.data();
                const newYearlyData = { ...state.yearlyData, [year]: yearData };

                state.loadedArchivedYears.add(year);

                setState({ yearlyData: newYearlyData });

                const date = new Date(year, 0, 1);
                setState({
                    currentMonth: date,
                    selectedDate: date,
                    currentYearData: yearData
                });
                updateView();

                showMessage(`Loaded ${year} data`, 'success');
                // Also refresh modal if open
                if (document.getElementById('archive-modal')?.classList.contains('visible')) {
                    renderArchiveModal();
                }
            } else {
                showMessage(`No data found for ${year}`, 'error');
            }
        }
    } catch (error) {
        Logger.error("Load archive failed:", error);
        showMessage("Failed to load archived data", 'error');
    }
}

function openArchiveModal() {
    renderArchiveModal();
    DOM.archiveModal.classList.add('visible');
}

function closeArchiveModal() {
    DOM.archiveModal.classList.remove('visible');
}

function renderArchiveModal() {
    if (!DOM.archiveYearList) return;
    DOM.archiveYearList.innerHTML = '';

    const allYears = new Set([
        ...Object.keys(state.yearlyData),
        ...Object.keys(state.archivedSummaries || {})
    ]);

    // Convert to numbers for sorting, but keep as strings for keys
    const sortedYears = Array.from(allYears).sort((a, b) => parseInt(b) - parseInt(a));

    if (sortedYears.length === 0) {
        DOM.archiveYearList.innerHTML = `<p class="text-center text-gray-500 italic">${i18n.t("admin.noDataYears") || "No data available."}</p>`;
        return;
    }

    sortedYears.forEach(year => {
        const isLoaded = !!state.yearlyData[year];
        const isArchived = !!state.archivedSummaries?.[year];

        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm';

        let statusBadge = '';
        if (isLoaded && isArchived) {
             statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">${i18n.t("admin.statusLoaded") || "Loaded (Archived)"}</span>`;
        } else if (isLoaded) {
             statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 border border-green-200">${i18n.t("admin.statusActive") || "Active"}</span>`;
        } else {
             statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-200">${i18n.t("admin.statusArchived") || "Archived"}</span>`;
        }

        let actionButton = '';
        if (isLoaded) {
            actionButton = `
                <button class="archive-action-btn px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors" data-year="${year}" data-action="archive">
                    ${i18n.t("admin.archiveBtn") || "Archive"}
                </button>
            `;
        } else {
            actionButton = `
                <button class="archive-action-btn px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-md transition-colors" data-year="${year}" data-action="load">
                    ${i18n.t("admin.loadBtn") || "Load"}
                </button>
            `;
        }

        item.innerHTML = `
            <div>
                <span class="text-lg font-bold text-gray-800 dark:text-gray-200 mr-2">${year}</span>
                ${statusBadge}
            </div>
            ${actionButton}
        `;

        DOM.archiveYearList.appendChild(item);
    });

    // Event listeners
    DOM.archiveYearList.querySelectorAll('.archive-action-btn').forEach(btn => {
        btn?.addEventListener('click', async (e) => {
            const year = e.currentTarget.dataset.year;
            const action = e.currentTarget.dataset.action;

            // Add loading state to button
            e.currentTarget.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            e.currentTarget.disabled = true;

            if (action === 'archive') {
                await archiveYear(year);
            } else {
                await loadArchivedYear(year);
            }

            if (DOM.archiveModal.classList.contains('visible')) {
                 renderArchiveModal();
            }
        });
    });
}

function renderLeavePills() {
    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);

    const pills = visibleLeaveTypes.map(lt => {
        const isSelected = state.selectedLeaveTypeId === lt.id;
        const classes = `flex-shrink-0 truncate max-w-40 px-3 py-1.5 rounded-full text-sm font-semibold text-white shadow transition-transform transform hover:scale-105 ${isSelected ? 'ring-4 ring-offset-2 ring-blue-400 scale-105' : ''}`;

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
    const year = state.currentMonth.getFullYear();
    const yearData = state.yearlyData[year] || { activities: {}, leaveOverrides: {} };
    // Reuse the helper, but map back to simple balance map if needed or use full object
    // Existing code expects simple map: { typeId: balance }

    const fullBalances = getLeaveBalancesForYear(year, yearData, state.leaveTypes);
    const balances = {};

    // Also need to handle types that might have been filtered out by getLeaveBalancesForYear (if 0 total and 0 used)
    // but the UI might expect them if they are visible leave types.
    // getLeaveBalancesForYear filters out irrelevant ones.
    // However, existing calculateLeaveBalances returns balances for ALL visible types.

    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);
    visibleLeaveTypes.forEach(lt => {
        if (fullBalances[lt.id]) {
            balances[lt.id] = fullBalances[lt.id].balance;
        } else {
            // Fallback for types with 0 total and 0 used (if any)
            const overrides = yearData.leaveOverrides || {};
            const totalDays = overrides[lt.id]?.totalDays ?? lt.totalDays;
            balances[lt.id] = totalDays;
        }
    });

    return balances;
}

function openLeaveOverviewModal(leaveTypeId) {
    setState({ overviewLeaveTypeId: leaveTypeId });
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
                formatted: formatDateForDisplay(dateKey, i18n.currentLang)
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
            <div class="flex items-center gap-3 w-full sm:w-auto min-w-0">
                <div class="w-4 h-4 rounded-full flex-shrink-0" style="background-color: ${leaveType.color};"></div>
                <div class="flex-grow min-w-0">
                    <span class="font-medium truncate" title="${leaveDate.formatted}">${leaveDate.formatted}</span>
                </div>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
                <div class="day-type-toggle relative flex w-28 h-8 items-center rounded-full bg-gray-200 p-1 cursor-pointer flex-shrink-0" data-selected-value="${leaveDate.dayType}">
                    <div class="toggle-bg absolute top-1 h-6 w-[calc(50%-0.25rem)] rounded-full bg-blue-500 shadow-md transition-transform duration-300 ease-in-out"></div>
                    <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold ${leaveDate.dayType === 'full' ? 'active' : ''}" data-value="full" data-i18n="tracker.full">${i18n.t('tracker.full')}</button>
                    <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold ${leaveDate.dayType === 'half' ? 'active' : ''}" data-value="half" data-i18n="tracker.half">${i18n.t('tracker.half')}</button>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
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
        showMessage(i18n.t("tracker.msgLeaveEntryDeleted"), 'success');
    } catch (error) {
        Logger.error("Failed to delete leave day:", error);
        showMessage(i18n.t("messages.deleteSaveError"), "error");
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
        render(html`<p class="text-center text-gray-500">${i18n.t('tracker.noLeaveTypesDefined')}</p>`, DOM.leaveStatsSection);
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
            <div class="bg-white p-3 sm:p-4 rounded-lg shadow relative border-2" style="border-color: ${lt.color};">
                <div class="flex justify-between items-start">
                    <div class="flex items-center min-w-0 pr-2">
                        <h4 class="font-bold text-base sm:text-lg truncate min-w-0 mr-2" style="color: ${lt.color};" title="${lt.name}">${lt.name}</h4>
                    </div>

                    <div class="flex items-center -mt-2 -mr-2 flex-shrink-0">
                        <button class="info-leave-btn icon-btn text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0" data-id="${lt.id}" title="${i18n.t('tracker.viewLeaveDetails')}" aria-label="${i18n.t('tracker.viewLeaveDetails')} for ${lt.name}" @click=${() => openLeaveOverviewModal(lt.id)}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </button>
                        <button class="move-leave-btn icon-btn" data-id="${lt.id}" data-direction="-1" title="${i18n.t('tracker.moveUp')}" aria-label="${i18n.t('tracker.moveUp')} ${lt.name}" ?disabled=${isFirst} @click=${() => moveLeaveType(lt.id, -1)}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                        </button>
                        <button class="move-leave-btn icon-btn" data-id="${lt.id}" data-direction="1" title="${i18n.t('tracker.moveDown')}" aria-label="${i18n.t('tracker.moveDown')} ${lt.name}" ?disabled=${isLast} @click=${() => moveLeaveType(lt.id, 1)}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <button class="edit-leave-type-btn icon-btn" data-id="${lt.id}" title="${i18n.t('common.edit')}" aria-label="${i18n.t('common.edit')} ${lt.name}" @click=${() => openLeaveTypeModal(lt)}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-1 sm:gap-2 mt-1 sm:mt-2 text-center">
                    <div class="bg-gray-100 p-1 sm:p-2 rounded">
                        <p class="text-xs text-gray-500">${i18n.t('tracker.used')}</p>
                        <p class="font-bold text-base sm:text-xl text-gray-800">${used}</p>
                    </div>
                    <div class="p-1 sm:p-2 rounded balance-box">
                        <p class="text-xs stats-label">${i18n.t('tracker.balance')}</p>
                        <p class="font-bold text-base sm:text-xl stats-value">${balance}</p>
                    </div>
                </div>
                <div class="bg-gray-100 p-1 sm:p-2 rounded mt-1 sm:mt-2 text-center">
                    <p class="text-xs text-gray-500">${i18n.t('tracker.total')}</p>
                    <p class="font-bold text-base sm:text-xl text-gray-800">${totalDays}</p>
                    <div class="progress-bg h-1.5 sm:h-2 mt-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="progress-bar h-1.5 sm:h-2 rounded-full transition-all duration-500" style="width: ${percentage}%; background-color: ${lt.color};"></div>
                    </div>
                </div>
            </div>
        `;
    });

    render(html`<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">${stats}</div>`, DOM.leaveStatsSection);
}

function openLeaveCustomizationModal() {
    if (state.leaveSelection.size === 0) {
        showMessage(i18n.t("tracker.msgSelectDayRequired"), 'info');
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
        triggerHTML = `<span class="font-medium text-sm text-red-500">${i18n.t('tracker.noneWillBeRemoved')}</span>`;
    } else if (selectedType) {
        triggerHTML = `
            <span class="flex items-center w-full min-w-0">
                <span class="w-3 h-3 rounded-full mr-2 flex-shrink-0" style="background-color: ${selectedType.color};"></span>
                <span class="font-medium text-sm truncate min-w-0">${sanitizeHTML(selectedType.name)}</span>
            </span>
            <i class="fas fa-chevron-down text-xs text-gray-500 ml-1 flex-shrink-0"></i>`;
    } else {
        triggerHTML = `<span class="font-medium text-sm text-gray-500">${i18n.t('tracker.selectType')}</span>`;
    }

    container.innerHTML = `
        <button type="button" class="leave-type-selector-trigger w-full flex items-center justify-between px-3 py-1.5 border rounded-full shadow-sm text-left transition-all duration-200 active:scale-95">
            ${triggerHTML}
        </button>
        <div class="leave-type-selector-panel">
            <div class="flex flex-col space-y-1">
                <button type="button" data-id="remove" class="leave-type-option w-full text-left px-3 py-1.5 rounded-full text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center transition-all duration-200 active:scale-95">
                    <i class="fas fa-times-circle w-3 h-3 mr-2 text-red-500"></i>
                    <span>${i18n.t('tracker.none')}</span>
                </button>
                ${visibleLeaveTypes.map(lt => `
                    <button type="button" data-id="${lt.id}" class="leave-type-option w-full text-left px-3 py-1.5 rounded-full text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center min-w-0 transition-all duration-200 active:scale-95">
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

    trigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.leave-type-selector-panel.open').forEach(p => {
            if (p !== panel) p.classList.remove('open');
        });
        panel.classList.toggle('open');
    });

    panel.querySelectorAll('.leave-type-option').forEach(option => {
        option?.addEventListener('click', () => {
            const newTypeId = option.dataset.id;
            trigger.dataset.typeId = newTypeId;

            let newTriggerHTML;
            if (newTypeId === 'remove') {
                newTriggerHTML = `<span class="font-medium text-sm text-red-500">${i18n.t('tracker.noneWillBeRemoved')}</span>`;
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

    document?.addEventListener('click', closePanel, { once: true });
    container?.addEventListener('click', e => e.stopPropagation());
}

function setupDayTypeToggle(toggleElement) {
    const bg = toggleElement.querySelector('.toggle-bg');
    const buttons = toggleElement.querySelectorAll('.toggle-btn');

    const updateUI = (value) => {
        const isHalf = value === LEAVE_DAY_TYPES.HALF;
        // Transform is handled by CSS based on data-selected-value
        buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.value === value));
    };

    updateUI(toggleElement.dataset.selectedValue || LEAVE_DAY_TYPES.FULL);

    toggleElement?.addEventListener('click', (e) => {
        const clickedButton = e.target.closest('.toggle-btn');
        if (!clickedButton) return;

        const value = clickedButton.dataset.value;
        if (toggleElement.dataset.selectedValue === value) return;

        toggleElement.dataset.selectedValue = value;
        updateUI(value);

        if (toggleElement.id === 'bulk-day-type-toggle') {
            document.querySelectorAll('#leave-days-list .day-type-toggle').forEach(itemToggle => {
                itemToggle.dataset.selectedValue = value;
                const itemButtons = itemToggle.querySelectorAll('.toggle-btn');
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
            newTriggerHTML = `<span class="font-medium text-sm text-red-500">${i18n.t('tracker.noneWillBeRemoved')}</span>`;
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
            pill?.addEventListener('click', () => {
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
            <span class="font-medium mb-2 sm:mb-0 truncate min-w-0 w-full sm:w-auto text-left sm:text-left">${formatDateForDisplay(dateKey, i18n.currentLang)}</span>
            <div class="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end min-w-0">
                <div class="leave-type-selector relative flex-grow w-full sm:w-36 min-w-0">
                </div>
                <div class="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2">
                    <div class="day-type-toggle relative flex w-28 h-8 items-center rounded-full bg-gray-200 p-1 cursor-pointer flex-shrink-0" data-selected-value="${currentDayType}">
                        <div class="toggle-bg absolute top-1 h-6 w-[calc(50%-0.25rem)] rounded-full bg-blue-500 shadow-md transition-transform duration-300 ease-in-out"></div>
                        <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold" data-value="full" data-i18n="tracker.full">${i18n.t('tracker.full')}</button>
                        <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold" data-value="half" data-i18n="tracker.half">${i18n.t('tracker.half')}</button>
                    </div>
                    <button class="delete-leave-day-btn text-red-500 hover:text-red-700 p-2 flex-shrink-0" title="Remove this day">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
        list.appendChild(item);

        createLeaveTypeSelector(item.querySelector('.leave-type-selector'), currentLeaveTypeId);
        setupDayTypeToggle(item.querySelector('.day-type-toggle'));
    });

    list.querySelectorAll('.delete-leave-day-btn').forEach(btn => {
        btn?.addEventListener('click', (e) => {
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
                showMessage(i18n.t("tracker.msgBalanceInsufficient").replace('{name}', leaveType.name), 'error');
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
        showMessage(i18n.t("tracker.msgLeavesSaved"), 'success');
    } catch (error) {
        Logger.error("Failed to save logged leaves:", error);
        showMessage(i18n.t("tracker.msgLeavesSaveFailed"), "error");
    } finally {
        DOM.customizeLeaveModal.classList.remove('visible');
        if (state.previousActiveElement) {
            state.previousActiveElement.focus();
            state.previousActiveElement = null;
        }
        setState({ selectedLeaveTypeId: null, leaveSelection: new Set(), initialLeaveSelection: new Set() });
        // Removed legacy button logic
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
        trigger.innerHTML = `<span class="font-medium text-sm text-red-500">${i18n.t('tracker.noneWillBeRemoved')}</span>`;
    });
    showMessage(i18n.t("tracker.msgLeavesRemovalConfirmation"), 'info');
}

// --- Team Management Functions ---
function renderTeamSection() {
    const teamIcon = document.getElementById('team-icon');
    if (teamIcon) {
        if (state.currentTeam) {
            teamIcon.className = 'fa-solid fa-user w-5 h-5 mr-2 mt-1 sm:mt-0.5';
        } else {
            teamIcon.className = 'fa-regular fa-user w-5 h-5 mr-2 mt-1 sm:mt-0.5';
        }
    }

    if (!state.isOnlineMode) {
        render(html`<p class="text-center text-gray-500">${i18n.t('team.offline')}</p>`, DOM.teamSection);
        return;
    }

    // Check for Pro Access
    const isSuperAdmin = state.superAdmins.includes(auth?.currentUser?.email);
    const isPro = state.userRole === 'pro' || state.userRole === 'co-admin' || isSuperAdmin;

    if (!state.currentTeam) {
        const createTeamTemplate = html`
            <div class="text-center">
                <h3 class="text-lg font-semibold mb-4">${i18n.t('team.management')}</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="team-card bg-gray-50 dark:bg-gray-800 p-4 sm:p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400 cursor-pointer transition-all active:scale-95 duration-200">
                        <button id="create-team-btn" class="w-full text-left">
                            <div class="flex items-center justify-center mb-3 sm:mb-4">
                                <div class="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                    <svg class="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                    </svg>
                                </div>
                            </div>
                            <h4 class="text-lg sm:text-xl font-bold text-center mb-1 sm:mb-2">${i18n.t('team.create')}</h4>
                            <p class="text-sm sm:text-base text-center text-gray-600 dark:text-gray-400">${i18n.t('team.createDesc')}</p>
                        </button>
                    </div>
                    <div class="team-card bg-gray-50 dark:bg-gray-800 p-4 sm:p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-400 cursor-pointer transition-all active:scale-95 duration-200">
                        <button id="join-team-btn" class="w-full text-left">
                            <div class="flex items-center justify-center mb-3 sm:mb-4">
                                <div class="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                    <svg class="w-6 h-6 sm:w-8 sm:h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                    </svg>
                                </div>
                            </div>
                            <h4 class="text-lg sm:text-xl font-bold text-center mb-1 sm:mb-2">${i18n.t('team.join')}</h4>
                            <p class="text-sm sm:text-base text-center text-gray-600 dark:text-gray-400">${i18n.t('team.joinDesc')}</p>
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
                    <p class="text-xs sm:text-base text-gray-600 dark:text-gray-400">${isAdmin ? i18n.t('team.youAreAdmin') : i18n.t('team.youAreMember')} • ${memberCount === 1 ? i18n.t('team.memberCount').replace('{count}', memberCount) : i18n.t('team.membersCount').replace('{count}', memberCount)}</p>
                </div>

                <div class="bg-white dark:bg-gray-100 p-3 sm:p-4 rounded-lg border">
                    <h4 class="font-semibold text-sm sm:text-base mb-2 sm:mb-3 text-center">${i18n.t('team.roomCode')}</h4>
                    <div class="text-center">
                        <div class="room-code text-sm sm:text-base">
                            <span>${state.currentTeam}</span>
                            <button id="copy-room-code-btn" class="icon-btn hover:border hover:border-white ml-2" title="${i18n.t('team.copyCode')}">
                                <i class="fa-regular fa-copy text-white"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center mt-2 sm:mt-3">${i18n.t('team.shareCodeMessage')}</p>
                </div>

                <div class="flex flex-col md:flex-row gap-3 sm:gap-4">
                    ${isAdmin ? html`
                        <button id="team-dashboard-btn" class="w-full md:flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-[#0071e3] text-white rounded-full hover:bg-[#0077ed] transition-colors flex items-center justify-center text-sm sm:text-base active:scale-95 duration-200">
                            <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                            ${i18n.t('team.dashboard')}
                        </button>
                    ` : ''}
                    <button id="edit-display-name-btn" class="w-full md:flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors flex items-center justify-center text-sm sm:text-base active:scale-95 duration-200">
                        <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path>
                        </svg>
                        ${i18n.t('tracker.changeName')}
                    </button>
                    ${isAdmin ? html`
                        <button id="delete-team-btn" class="w-full md:flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-[#ff3b30] text-white rounded-full hover:bg-[#ff4f44] transition-colors flex items-center justify-center text-sm sm:text-base active:scale-95 duration-200">
                            <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                            ${i18n.t('team.delete')}
                        </button>
                    ` : html`
                        <button id="leave-team-btn" class="w-full md:flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-[#ff3b30] text-white rounded-full hover:bg-[#ff4f44] transition-colors flex items-center justify-center text-sm sm:text-base active:scale-95 duration-200">
                            <i class="fa-solid fa-door-open w-4 h-4 sm:w-5 sm:h-5 mr-2"></i>
                            ${i18n.t('team.leave')}
                        </button>
                    `}
                </div>
            </div>
        `;

        render(teamInfoTemplate, DOM.teamSection);
    }
}

function openCreateTeamModal() {
    const isSuperAdmin = state.superAdmins.includes(auth?.currentUser?.email);
    const isPro = state.userRole === 'pro' || state.userRole === 'co-admin' || isSuperAdmin;

    // Reset visibility of content parts
    let upgradeMsg = DOM.createTeamModal.querySelector('#create-team-upgrade-msg');
    let formContent = DOM.createTeamModal.querySelector('.space-y-4');
    let buttons = DOM.createTeamModal.querySelector('#save-create-team-btn')?.parentElement;

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
                <h3 class="text-xl font-bold mb-2">${i18n.t('pro.featureTitle')}</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-6">
                    ${i18n.t('pro.createTeamMsg')}
                </p>
                <button class="w-full px-6 py-3 btn-primary rounded-full font-semibold active:scale-95 transition-all duration-200" onclick="window.location.href='mailto:arunthomas04042001@gmail.com?subject=Upgrade%20to%20Pro'">
                    ${i18n.t('pro.upgrade')}
                </button>
                <div class="mt-4">
                    <button class="text-gray-500 hover:text-gray-700 text-sm" onclick="document.getElementById('create-team-modal').classList.remove('visible')">${i18n.t('common.cancel')}</button>
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
        showMessage(i18n.t("team.msgCreateFieldsRequired"), 'error');
        return;
    }

    setButtonLoadingState(button, true);

    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const createTeamCallable = httpsCallable(functions, 'createTeam');
        const result = await createTeamCallable({ teamName, displayName });

        showMessage(result.data.message, 'success');
        closeCreateTeamModal();

    } catch (error) {
        Logger.error('Error creating team:', error);
        showMessage(i18n.t("team.msgCreateFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function joinTeam() {
    const button = DOM.joinTeamModal.querySelector('#save-join-team-btn');
    const roomCode = DOM.roomCodeInput.value.trim().toUpperCase();
    const displayName = DOM.displayNameInput.value.trim();

    if (!roomCode || !displayName) {
        showMessage(i18n.t("team.msgJoinFieldsRequired"), 'error');
        return;
    }

    setButtonLoadingState(button, true);

    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const joinTeamCallable = httpsCallable(functions, 'joinTeam');
        const result = await joinTeamCallable({ roomCode, displayName });

        showMessage(result.data.message, 'success');
        closeJoinTeamModal();
    } catch (error) {
        Logger.error('Error calling joinTeam function:', error);
        showMessage(i18n.t("team.msgJoinFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function editDisplayName() {
    const button = DOM.editDisplayNameModal.querySelector('#save-edit-name-btn');
    const newDisplayName = DOM.newDisplayNameInput.value.trim();

    if (!newDisplayName) {
        showMessage(i18n.t("team.msgDisplayNameRequired"), 'error');
        return;
    }

    setButtonLoadingState(button, true);
    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const editDisplayNameCallable = httpsCallable(functions, 'editDisplayName');
        await editDisplayNameCallable({ newDisplayName: newDisplayName, teamId: state.currentTeam });
        showMessage(i18n.t("team.msgDisplayNameUpdated"), 'success');
        closeEditDisplayNameModal();
    } catch (error) {
        Logger.error('Error updating display name:', error);
        showMessage(i18n.t("team.msgDisplayNameUpdateFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function leaveTeam(button) {
    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const leaveTeamCallable = httpsCallable(functions, 'leaveTeam');
        await leaveTeamCallable({ teamId: state.currentTeam });
        showMessage(i18n.t("team.msgLeftSuccess"), 'success');
    } catch (error) {
        Logger.error('Error leaving team:', error);
        showMessage(i18n.t("team.msgLeftFailed").replace('{error}', error.message), 'error');
    } finally {
        if (button) setButtonLoadingState(button, false);
    }
}

async function deleteTeam(button) {
    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const deleteTeamCallable = httpsCallable(functions, 'deleteTeam');
        await deleteTeamCallable({ teamId: state.currentTeam });
        showMessage(i18n.t("team.msgDeletedSuccess"), 'success');
    } catch (error) {
        Logger.error('Error deleting team:', error);
        showMessage(i18n.t("team.msgDeleteFailed").replace('{error}', error.message), 'error');
    } finally {
        if (button) setButtonLoadingState(button, false);
    }
}

function copyRoomCode() {
    navigator.clipboard.writeText(state.currentTeam).then(() => {
        showMessage(i18n.t("team.msgCodeCopied"), 'success');
    }).catch(() => {
        showMessage(i18n.t("team.msgCodeCopyFailed"), 'error');
    });
}

function openKickMemberModal(memberId, memberName) {
    DOM.kickModalText.innerHTML = i18n.t('team.confirmKickMessage').replace('{name}', sanitizeHTML(memberName));
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
        const { functions, httpsCallable } = await getFunctionsInstance();
        const kickTeamMemberCallable = httpsCallable(functions, 'kickTeamMember');
        await kickTeamMemberCallable({ teamId: state.currentTeam, memberId: memberId });
        showMessage(i18n.t("team.msgKickSuccess"), 'success');
        closeKickMemberModal();
    } catch (error) {
        Logger.error('Error kicking member:', error);
        showMessage(i18n.t("team.msgKickFailed").replace('{error}', error.message), 'error');
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
        DOM.teamDashboardContent.innerHTML = `<p class="text-center text-gray-500">${i18n.t('team.loadingData')}</p>`;
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

    const dashboardYear = state.currentMonth.getFullYear().toString();


    const membersHTML = sortedMembers.map(member => {
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
                <div class="stat-card-info min-w-0 overflow-hidden">
                    <h5 class="truncate" title="${sanitizeHTML(balance.name)}">${sanitizeHTML(balance.name)}</h5>
                    <p>${i18n.t('tracker.balance')}: ${balance.balance} ${i18n.t('tracker.days')}</p>
                    <p>${i18n.t('tracker.used')}: ${balance.used} / ${balance.total} ${i18n.t('tracker.days')}</p>
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
                            <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400" data-i18n="${isAdmin ? 'teamAdmin' : 'member'}">${isAdmin ? i18n.t('team.roleAdmin') : i18n.t('team.roleMember')}</p>
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
                            <h5 class="font-semibold mb-3 sm:mb-4 team-dashboard-title">${i18n.t('tracker.leaveBalanceOverview')} (${dashboardYear})</h5>
                            ${leaveTypesHTML}
                        </div>
                    ` : `
                        <div class="text-center py-6 text-gray-500">
                            <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <p>${i18n.t('tracker.noLeaveTypesOrSummary').replace('{year}', dashboardYear)}</p>
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
    if (!tableBody) {
        Logger.error("Table body not found in setupDailyViewEventListeners");
        return;
    }

    tableBody?.addEventListener('click', async e => {
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
                showMessage(i18n.t("tracker.msgClickToConfirm"), 'info');
                const timeoutId = setTimeout(() => {
                    button.classList.remove('confirm-action');
                }, 3000);
                button.dataset.timeoutId = timeoutId;
            }
        }
    });

// Global click listener for haptic feedback
document?.addEventListener('click', (e) => {
    // Check if the click target or its parents is a button, link, or interactive element
    if (e.target.closest('button, a, .calendar-day-cell, .leave-day-item, .team-member-card summary, .toggle-btn, .spotlight-result-item')) {
        triggerHapticFeedback('light');
    }
});

    tableBody?.addEventListener('focusout', e => {
        const target = e.target;
        if (target.matches('.activity-text-editable, .time-editable')) {
            handleInlineEditBlur({ currentTarget: target });
        }
    });

    tableBody?.addEventListener('keydown', e => {
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
                        formattedDate: formatDateForDisplay(dateKey, i18n.currentLang)
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
                        content: `${leaveType.name} (${dayData.leave.dayType === 'full' ? i18n.t('tracker.full') : i18n.t('tracker.half')})`,
                        formattedDate: formatDateForDisplay(dateKey, i18n.currentLang),
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
                            formattedDate: formatDateForDisplay(dateKey, i18n.currentLang)
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
        const scopeKey = newScope === 'year' ? 'search.currentYear' : 'search.allYears';
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
        DOM.spotlightSortLabel.textContent = i18n.t('search.newestFirst');
        DOM.spotlightSortLabel.setAttribute('data-i18n', 'search.newestFirst');
        DOM.spotlightSortBtn.querySelector('i').className = "fas fa-sort-amount-down ml-2";
    } else {
        results.sort((a, b) => new Date(a.date) - new Date(b.date));
        DOM.spotlightSortLabel.textContent = i18n.t('search.oldestFirst');
        DOM.spotlightSortLabel.setAttribute('data-i18n', 'search.oldestFirst');
        DOM.spotlightSortBtn.querySelector('i').className = "fas fa-sort-amount-up ml-2";
    }

    DOM.spotlightCount.textContent = `${results.length} ${i18n.t('search.results')}`;

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

        item?.addEventListener('click', () => {
            const date = new Date(result.date + 'T00:00:00');
            const currentYear = state.currentMonth.getFullYear();
            const newYear = date.getFullYear();

            const newState = { selectedDate: date, currentView: VIEW_MODES.DAY };

            if (newYear !== currentYear) {
                newState.currentMonth = new Date(newYear, date.getMonth(), 1);
                newState.currentYearData = state.yearlyData[newYear] || { activities: {}, leaveOverrides: {} };
            }

            setState(newState);
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
    DOM.emailSignupBtn?.addEventListener('click', () => signUpWithEmail(emailInput.value, passwordInput.value));
    DOM.emailSigninBtn?.addEventListener('click', () => signInWithEmail(emailInput.value, passwordInput.value));
    DOM.forgotPasswordBtn?.addEventListener('click', () => resetPassword(emailInput.value));
    DOM.googleSigninBtn?.addEventListener('click', signInWithGoogle);
    document.getElementById('anon-continue-btn')?.addEventListener('click', loadOfflineData);

    // Nav Toggle
    DOM.navTogBtn?.addEventListener('click', toggleAppMode);

    // TOG Events
    document.addEventListener('tog-reset-request', confirmTogReset);

    // User Menu
    document.getElementById('tb-archive-btn')?.addEventListener('click', openArchiveModal);
    document.getElementById('tb-backup-btn')?.addEventListener('click', downloadCSV);
    document.getElementById('tb-restore-btn')?.addEventListener('click', () => DOM.uploadCsvBtn.click());
    document.getElementById('tb-reset-btn')?.addEventListener('click', confirmTrackerReset);
    document.getElementById('tb-logout-btn')?.addEventListener('click', appSignOut);

    const passwordToggleBtn = document.getElementById('password-toggle-btn');
    const passwordToggleIcon = document.getElementById('password-toggle-icon');
    passwordToggleBtn?.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        passwordToggleIcon.classList.toggle('fa-eye', !isPassword);
        passwordToggleIcon.classList.toggle('fa-eye-slash', isPassword);
    });

    emailInput?.addEventListener('input', () => setInputErrorState(emailInput, false));
    passwordInput?.addEventListener('input', () => setInputErrorState(passwordInput, false));
    document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);
    document.getElementById('tog-theme-toggle-btn')?.addEventListener('click', toggleTheme);
    DOM.monthViewBtn?.addEventListener('click', () => { setState({ currentView: VIEW_MODES.MONTH }); updateView(); });
    DOM.dayViewBtn?.addEventListener('click', () => { setState({ currentView: VIEW_MODES.DAY }); updateView(); });

    document.getElementById('prev-btn')?.addEventListener('click', async (e) => {
        triggerHapticFeedback('medium');
        const button = e.currentTarget;
        setButtonLoadingState(button, true);
        try {
            await waitForDOMUpdate();

            const oldYear = state.currentMonth.getFullYear();
            let newDate;

            if (state.currentView === VIEW_MODES.MONTH) {
                // Avoid mutating state.currentMonth in place
                newDate = new Date(state.currentMonth);
                newDate.setMonth(newDate.getMonth() - 1);
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
                        showMessage(i18n.t("search.msgResultView").replace('{current}', newIndex + 1).replace('{total}', state.searchResultDates.length), 'info');
                    } else {
                        // Fallback to standard nav if empty (shouldn't happen due to check)
                        newDate = new Date(state.selectedDate);
                        newDate.setDate(newDate.getDate() - 1);
                    }
                } else {
                    newDate = new Date(state.selectedDate);
                    newDate.setDate(newDate.getDate() - 1);
                }
                setState({ selectedDate: newDate, currentMonth: new Date(newDate.getFullYear(), newDate.getMonth(), 1) });
            }

            const newYear = newDate.getFullYear();
            if (newYear !== oldYear) {
                setState({ currentYearData: state.yearlyData[newYear] || { activities: {}, leaveOverrides: {} } });
            }

            updateView();
        } catch (error) {
            Logger.error("Error navigating previous:", error);
            showMessage(i18n.t("messages.renderError") || "Error navigating", 'error');
        } finally {
            setButtonLoadingState(button, false);
        }
    });

    document.getElementById('next-btn')?.addEventListener('click', async (e) => {
        triggerHapticFeedback('medium');
        const button = e.currentTarget;
        setButtonLoadingState(button, true);
        try {
            await waitForDOMUpdate();

            const oldYear = state.currentMonth.getFullYear();
            let newDate;

            if (state.currentView === VIEW_MODES.MONTH) {
                newDate = new Date(state.currentMonth);
                newDate.setMonth(newDate.getMonth() + 1);
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
                        showMessage(i18n.t("search.msgResultView").replace('{current}', newIndex + 1).replace('{total}', state.searchResultDates.length), 'info');
                    } else {
                        newDate = new Date(state.selectedDate);
                        newDate.setDate(newDate.getDate() + 1);
                    }
                } else {
                    newDate = new Date(state.selectedDate);
                    newDate.setDate(newDate.getDate() + 1);
                }
                setState({ selectedDate: newDate, currentMonth: new Date(newDate.getFullYear(), newDate.getMonth(), 1) });
            }

            const newYear = newDate.getFullYear();
            if (newYear !== oldYear) {
                setState({ currentYearData: state.yearlyData[newYear] || { activities: {}, leaveOverrides: {} } });
            }

            updateView();
        } catch (error) {
            Logger.error("Error navigating next:", error);
            showMessage(i18n.t("messages.renderError") || "Error navigating", 'error');
        } finally {
            setButtonLoadingState(button, false);
        }
    });
    DOM.todayBtnDay?.addEventListener('click', async () => {
        setButtonLoadingState(DOM.todayBtnDay, true);
        try {
            await waitForDOMUpdate();
            const today = new Date();
            const currentYear = state.currentMonth.getFullYear();
            const newYear = today.getFullYear();

            const newState = {
                selectedDate: today,
                currentMonth: new Date(today.getFullYear(), today.getMonth(), 1)
            };

            if (newYear !== currentYear) {
                newState.currentYearData = state.yearlyData[newYear] || { activities: {}, leaveOverrides: {} };
            }

            setState(newState);
            updateView();
        } catch (error) {
            Logger.error("Error navigating to today:", error);
            showMessage(i18n.t("messages.renderError") || "Error navigating", 'error');
        } finally {
            setButtonLoadingState(DOM.todayBtnDay, false);
        }
    });

    DOM.currentPeriodDisplay?.addEventListener('click', () => {
        state.previousActiveElement = document.activeElement;
        setState({ pickerYear: state.currentView === VIEW_MODES.MONTH ? state.currentMonth.getFullYear() : state.selectedDate.getFullYear() });
        renderMonthPicker();
        DOM.monthPickerModal.classList.add('visible');
        // Focus close button or first interactive element
        document.getElementById('close-month-picker-btn')?.focus();
    });

    document.getElementById('close-month-picker-btn')?.addEventListener('click', () => {
        DOM.monthPickerModal.classList.remove('visible');
        if (state.previousActiveElement) {
            state.previousActiveElement.focus();
            state.previousActiveElement = null;
        }
    });
    document.getElementById('prev-year-btn')?.addEventListener('click', async (e) => {
        const button = e.currentTarget;
        setButtonLoadingState(button, true);
        await waitForDOMUpdate();
        setState({ pickerYear: state.pickerYear - 1 });
        renderMonthPicker();
        setButtonLoadingState(button, false);
    });

    document.getElementById('next-year-btn')?.addEventListener('click', async (e) => {
        const button = e.currentTarget;
        setButtonLoadingState(button, true);
        await waitForDOMUpdate();
        setState({ pickerYear: state.pickerYear + 1 });
        renderMonthPicker();
        setButtonLoadingState(button, false);
    });

    // Use debounced 'input' for a better UX
    DOM.dailyNoteInput?.addEventListener('input', debounce((e) => {
        saveData({ type: ACTION_TYPES.SAVE_NOTE, payload: e.target.value });
    }, 500));

    // Spotlight Search Listeners
    if (DOM.openSpotlightBtn) {
        DOM.openSpotlightBtn?.addEventListener('click', openSpotlight);
    }

    if (DOM.spotlightCloseBtn) {
        DOM.spotlightCloseBtn?.addEventListener('click', closeSpotlight);
    }

    if (DOM.spotlightModal) {
        DOM.spotlightModal?.addEventListener('click', (e) => {
            if (e.target === DOM.spotlightModal) {
                closeSpotlight();
            }
        });
    }

    if (DOM.spotlightInput) {
        DOM.spotlightInput?.addEventListener('input', debounce((e) => {
            performSearch(e.target.value.trim());
        }, 300));

        DOM.spotlightInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSpotlight();
            }
        });
    }

    if (DOM.spotlightSortBtn) {
        DOM.spotlightSortBtn?.addEventListener('click', toggleSearchSort);
    }

    if (DOM.spotlightScopeBtn) {
        DOM.spotlightScopeBtn?.addEventListener('click', toggleSearchScope);
    }

    if (DOM.exitSearchBtn) {
        DOM.exitSearchBtn?.addEventListener('click', exitSearchMode);
    }

    // Language Switcher Logic
    const openLangBtn = document.getElementById('open-lang-btn');
    const closeLangBtn = document.getElementById('close-lang-btn');
    const languageModal = document.getElementById('language-modal');
    const languageList = document.getElementById('language-list');

    if (openLangBtn && languageModal && languageList) {
        openLangBtn?.addEventListener('click', () => {
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

                option?.addEventListener('click', () => {
                    i18n.setLanguage(lang.code);
                    languageModal.classList.remove('visible');
                });

                languageList.appendChild(option);
            });

            languageModal.classList.add('visible');
        });

        const closeLangModal = () => languageModal.classList.remove('visible');

        if (closeLangBtn) closeLangBtn?.addEventListener('click', closeLangModal);

        languageModal?.addEventListener('click', (e) => {
            if (e.target === languageModal) closeLangModal();
        });
    }

    // Global shortcuts
    document?.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            openSpotlight();
        }
        if (e.key === 'Escape' && !DOM.spotlightModal.classList.contains('hidden')) {
            closeSpotlight();
        }

        // Navigation Shortcuts (if no input is focused)
        if (!['INPUT', 'TEXTAREA', 'SELECT', 'TD'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
            switch(e.key) {
                case 'ArrowLeft':
                    document.getElementById('prev-btn')?.click();
                    break;
                case 'ArrowRight':
                    document.getElementById('next-btn')?.click();
                    break;
                case 'm':
                case 'M':
                    DOM.monthViewBtn?.click();
                    break;
                case 'd':
                case 'D':
                    DOM.dayViewBtn?.click();
                    break;
                case 't':
                case 'T':
                    DOM.todayBtnDay?.click();
                    break;
            }
        }
    });

    const addNewSlotBtn = document.getElementById('add-new-slot-btn');
    if (addNewSlotBtn) {
        addNewSlotBtn?.addEventListener('click', async () => {
            setButtonLoadingState(addNewSlotBtn, true);
            await saveData({ type: ACTION_TYPES.ADD_SLOT });
            setButtonLoadingState(addNewSlotBtn, false);
        });
    }

    document.getElementById('reset-data-btn')?.addEventListener('click', confirmTrackerReset);
    document.getElementById('cancel-reset-btn')?.addEventListener('click', () => DOM.confirmResetModal.classList.remove('visible'));
    document.getElementById('confirm-reset-btn')?.addEventListener('click', performTrackerReset);

    const uploadCsvInput = document.getElementById('upload-csv-input');
    DOM.uploadCsvBtn?.addEventListener('click', () => uploadCsvInput.click());
    DOM.downloadCsvBtn?.addEventListener('click', downloadCSV);
    uploadCsvInput?.addEventListener('change', handleFileUpload);

    DOM.addLeaveTypeBtn?.addEventListener('click', () => openLeaveTypeModal());
    DOM.limitLeaveToYearBtn?.addEventListener('click', () => {
        const isLimited = DOM.limitLeaveToYearBtn.dataset.limited === 'true';
        DOM.limitLeaveToYearBtn.dataset.limited = !isLimited;
    });
    document.getElementById('cancel-leave-type-btn')?.addEventListener('click', closeLeaveTypeModal);
    document.getElementById('save-leave-type-btn')?.addEventListener('click', saveLeaveType);
    DOM.deleteLeaveTypeBtn?.addEventListener('click', (e) => {
        const limitToCurrentYear = DOM.limitLeaveToYearBtn.dataset.limited === 'true';
        if (limitToCurrentYear) {
            // Use existing double-click confirm for local delete
            if (state.confirmAction['deleteLeaveType']) {
                deleteLeaveType();
                delete state.confirmAction['deleteLeaveType'];
                DOM.deleteLeaveTypeBtn.classList.remove('confirm-action');
            } else {
                Object.keys(state.confirmAction).forEach(key => {
                    const el = state.confirmAction[key].element;
                    if (el) el.classList.remove('confirm-action');
                });
                state.confirmAction['deleteLeaveType'] = {
                    element: DOM.deleteLeaveTypeBtn,
                    timeoutId: setTimeout(() => {
                        DOM.deleteLeaveTypeBtn.classList.remove('confirm-action');
                        delete state.confirmAction['deleteLeaveType'];
                    }, 3000)
                };
                DOM.deleteLeaveTypeBtn.classList.add('confirm-action');
                showMessage(i18n.t("tracker.confirmDeleteLeaveType"), 'info');
            }
        } else {
            // Use Swipe Confirm for Universal Delete
            state.pendingSwipeAction = 'deleteLeaveType';
            if (DOM.swipeText) DOM.swipeText.textContent = i18n.t('admin.swipeToDelete');
            DOM.swipeConfirmModal.classList.add('visible');
            resetSwipeConfirm();
        }
    });
    DOM.leaveColorPicker?.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            selectColorInPicker(e.target.dataset.color);
        }
    });
    DOM.statsToggleBtn?.addEventListener('click', () => {
        DOM.leaveStatsSection.classList.toggle('visible');
        renderActionButtons();
    });

    // Team toggle button
    DOM.teamToggleBtn?.addEventListener('click', () => {
        const isVisible = DOM.teamSection.classList.toggle('visible');
        renderActionButtons();

        if (isVisible && !state.unsubscribeFromTeam) {
            // If the section is opened and we're not subscribed yet, subscribe.
            subscribeToTeamData();
        } else if (!isVisible && state.unsubscribeFromTeam) {
            // If the section is closed and we are subscribed, clean up.
            cleanupTeamSubscriptions();
        }
    });

    DOM.confirmSelectionBtn?.addEventListener('click', () => {
        if (state.leaveSelection.size > 0) {
            openLeaveCustomizationModal();
        }
    });

    DOM.leavePillsContainer?.addEventListener('click', (e) => {
        const pill = e.target.closest('button');
        if (!pill) return;

        const leaveTypeId = pill.dataset.id;
        if (state.selectedLeaveTypeId === leaveTypeId) {
            // Deselect/Cancel
            setState({ selectedLeaveTypeId: null, leaveSelection: new Set() });
        } else {
            // Select new type and start fresh
            setState({ selectedLeaveTypeId: leaveTypeId, leaveSelection: new Set() });
        }
        updateView();
    });

    DOM.calendarView?.addEventListener('click', (e) => {
        const cell = e.target.closest('.calendar-day-cell.current-month');
        if (!cell) return;

        const dateKey = cell.dataset.date;

        if (state.selectedLeaveTypeId) {
            // Toggle selection
            if (state.leaveSelection.has(dateKey)) {
                state.leaveSelection.delete(dateKey);
            } else {
                state.leaveSelection.add(dateKey);
            }
            // Haptic feedback
            triggerHapticFeedback('light');
            renderCalendar();
            renderActionButtons(); // Updates Floating Button Visibility
        } else {
            // Normal navigation
            const date = new Date(dateKey + 'T00:00:00');
            setState({ selectedDate: date, currentView: VIEW_MODES.DAY });
            updateView();
        }
    });

    // Weekend Option Modal Listeners
    DOM.toggleSatBtn?.addEventListener('click', () => {
        const isExcluded = DOM.toggleSatBtn.dataset.excluded === 'true';
        DOM.toggleSatBtn.dataset.excluded = !isExcluded;
    });

    DOM.toggleSunBtn?.addEventListener('click', () => {
        const isExcluded = DOM.toggleSunBtn.dataset.excluded === 'true';
        DOM.toggleSunBtn.dataset.excluded = !isExcluded;
    });

    // Weekend/Range Logic is removed/hidden for now as per new flow requirements.
    // If needed, we can re-introduce it as a feature of the selection mode later.

    document.getElementById('cancel-log-leave-btn')?.addEventListener('click', () => {
        DOM.customizeLeaveModal.classList.remove('visible');
        if (state.previousActiveElement) {
            state.previousActiveElement.focus();
            state.previousActiveElement = null;
        }
    });

    document.getElementById('save-log-leave-btn')?.addEventListener('click', saveLoggedLeaves);
    DOM.removeAllLeavesBtn?.addEventListener('click', handleBulkRemoveClick);

    DOM.logoContainer?.addEventListener('click', handleLogoTap);

    if (DOM.infoToggleBtn && DOM.infoDescription) {
        DOM.infoToggleBtn?.addEventListener('click', () => {
            DOM.infoDescription.classList.toggle('visible');
        });
    }

    // Help Modal
    if (DOM.helpToggleBtn) {
        DOM.helpToggleBtn?.addEventListener('click', () => {
            DOM.helpModal.classList.add('visible');
        });
    }
    if (DOM.tbHelpBtn) {
        DOM.tbHelpBtn?.addEventListener('click', () => {
            DOM.helpModal.classList.add('visible');
        });
    }
    if (DOM.closeHelpBtn) {
        DOM.closeHelpBtn?.addEventListener('click', () => {
            DOM.helpModal.classList.remove('visible');
        });
    }
    if (DOM.helpModal) {
        DOM.helpModal?.addEventListener('click', (e) => {
            if (e.target === DOM.helpModal) {
                DOM.helpModal.classList.remove('visible');
            }
        });
    }

    // Swipe Gestures
    let touchStartX = 0;
    let touchEndX = 0;
    let swipeStartTarget = null;

    const addSwipeListeners = (element) => {
        if (!element) return;
        element?.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
            swipeStartTarget = e.target;
        }, { passive: true });

        element?.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
    };

    addSwipeListeners(DOM.calendarView);
    addSwipeListeners(DOM.dailyView);

    function handleSwipe() {
        // Check if swipe started in excluded areas (e.g., bottom controls in day view)
        if (swipeStartTarget && swipeStartTarget.closest('#day-view-bottom-controls')) return;

        // Check for editing mode or open modals to prevent swipe
        if (state.editingInlineTimeKey) return;

        const openModals = document.querySelectorAll('.modal-backdrop.visible, .spotlight-overlay.visible');
        if (openModals.length > 0) return;

        // Check if an input or contenteditable is focused
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        )) {
            return;
        }

        // Check if text is selected
        if (window.getSelection().toString().length > 0) return;

        // Minimum distance for a swipe
        if (Math.abs(touchEndX - touchStartX) < 50) return;

        if (touchEndX < touchStartX) {
            // Swiped Left -> Next
            triggerHapticFeedback('medium');
            document.getElementById('next-btn')?.click();
        }

        if (touchEndX > touchStartX) {
            // Swiped Right -> Prev
            triggerHapticFeedback('medium');
            document.getElementById('prev-btn')?.click();
        }
    }

    document.getElementById('close-leave-overview-btn')?.addEventListener('click', closeLeaveOverviewModal);

    DOM.overviewLeaveDaysList?.addEventListener('click', async (e) => {
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
                showMessage(i18n.t("tracker.msgClickToConfirm"), 'info');
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
                    showMessage(i18n.t("tracker.msgBalanceInsufficient").replace('{name}', leaveType.name), 'error');
                    return;
                }
            }

            toggle.dataset.selectedValue = newValue;
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
                showMessage(i18n.t("tracker.msgLeaveDayUpdated"), 'success');
            } catch (error) {
                Logger.error("Failed to update leave day:", error);
                showMessage(i18n.t("tracker.msgUpdateSaveFailed"), "error");
            }

            updateView();
        }
    });

    // Team Management Event Listeners
    document.getElementById('cancel-create-team-btn')?.addEventListener('click', closeCreateTeamModal);
    document.getElementById('save-create-team-btn')?.addEventListener('click', createTeam);
    document.getElementById('cancel-join-team-btn')?.addEventListener('click', closeJoinTeamModal);
    document.getElementById('save-join-team-btn')?.addEventListener('click', joinTeam);
    document.getElementById('cancel-edit-name-btn')?.addEventListener('click', closeEditDisplayNameModal);
    document.getElementById('save-edit-name-btn')?.addEventListener('click', editDisplayName);
    document.getElementById('close-team-dashboard-btn')?.addEventListener('click', closeTeamDashboard);
    document.getElementById('cancel-edit-team-name-btn')?.addEventListener('click', closeEditTeamNameModal);
    document.getElementById('save-edit-team-name-btn')?.addEventListener('click', editTeamName);

    if (DOM.closeAdminDashboardBtn) {
        DOM.closeAdminDashboardBtn?.addEventListener('click', () => {
            DOM.adminDashboardModal.classList.remove('visible');
        });
    }

    // Archive Modal
    document.getElementById('close-archive-modal-btn')?.addEventListener('click', closeArchiveModal);
    if (DOM.archiveModal) {
        DOM.archiveModal.addEventListener('click', (e) => {
            if (e.target === DOM.archiveModal) {
                closeArchiveModal();
            }
        });
    }

    DOM.teamDashboardContent?.addEventListener('click', (e) => {
        const kickBtn = e.target.closest('.kick-member-btn');
        if (kickBtn) {
            const memberId = kickBtn.dataset.kickMemberId;
            const memberName = kickBtn.dataset.kickMemberName;
            openKickMemberModal(memberId, memberName);
        }
    });

    document.getElementById('cancel-kick-btn')?.addEventListener('click', closeKickMemberModal);
    document.getElementById('confirm-kick-btn')?.addEventListener('click', kickMember);

    // Delegated event listener for the team section
    DOM.teamSection?.addEventListener('click', (e) => {
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
                handleDoubleClick('leaveTeam', 'team.confirmLeave', (btn) => {
                    setButtonLoadingState(btn, true);
                    leaveTeam(btn);
                });
                break;
            case 'delete-team-btn':
                handleDoubleClick('deleteTeam', 'team.confirmDelete', (btn) => {
                    setButtonLoadingState(btn, true);
                    deleteTeam(btn);
                });
                break;
        }
    });

    // Format room code input & Validate
    DOM.roomCodeInput?.addEventListener('input', (e) => {
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
        document.getElementById('cancel-pro-duration-btn')?.addEventListener('click', () => {
            proDurationModal.classList.remove('visible');
            state.adminTargetUserId = null;
        });

        document.getElementById('pro-till-revoked-btn')?.addEventListener('click', async () => {
            await setProStatus(state.adminTargetUserId, null);
        });

        document.getElementById('pro-save-date-btn')?.addEventListener('click', async () => {
            const dateVal = document.getElementById('pro-expiry-date').value;
            if (!dateVal) {
                showMessage(i18n.t("tracker.pleaseSelectDate"), "error");
                return;
            }
            await setProStatus(state.adminTargetUserId, dateVal);
        });
    }
}

function exitSearchMode() {
    setState({ searchQuery: '', searchResultDates: [] });
    if (DOM.exitSearchBtn) DOM.exitSearchBtn.classList.remove('visible');
    if (DOM.spotlightInput) DOM.spotlightInput.value = '';
    updateView();
}

function renderAdminButton() {
    // Only render if user matches state.superAdmins or is a co-admin
    const isSuperAdmin = auth?.currentUser && state.superAdmins.includes(auth.currentUser.email);
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
    btn.innerHTML = `<i class="fas fa-shield-alt text-base"></i><span class="hidden sm:inline" data-i18n="admin.dashboard">${i18n.t("admin.dashboard")}</span>`;

    // Insert before the language button or at the start
    const footer = document.getElementById('main-footer');
    if (footer) {
        footer.insertBefore(btn, footer.firstChild);
        btn?.addEventListener('click', openAdminDashboard);
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
        const { functions, httpsCallable } = await getFunctionsInstance();
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

        showMessage(i18n.t('pro.msgPromoted'), 'success');
        if (modal) modal.classList.remove('visible');
    } catch (error) {
        Logger.error("Failed to set pro status:", error);
        showMessage(i18n.t("pro.msgFailedUpdateRole"), 'error');
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
        const { functions, httpsCallable } = await getFunctionsInstance();
        const grantPro = httpsCallable(functions, 'grantProByEmail');
        const result = await grantPro({ email });
        showMessage(result.data.message, 'success');
        // Refresh list
        await refreshAdminUserList();
    } catch (error) {
        Logger.error("Failed to grant pro by email:", error);
        showMessage(i18n.t("pro.msgFailedGrant"), 'error');
    }
}

async function refreshAdminUserList(reset = true) {
    if (reset) {
        setState({ adminUsers: [], adminNextPageToken: null });
        DOM.adminUserList.innerHTML = '<div class="flex justify-center py-8"><i class="fas fa-spinner fa-spin text-3xl text-blue-500"></i></div>';
    }

    const loadMoreBtn = document.getElementById('admin-load-more-btn');
    if (loadMoreBtn) setButtonLoadingState(loadMoreBtn, true);

    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const getAllUsers = httpsCallable(functions, 'getAllUsers');
        const result = await getAllUsers({ nextPageToken: state.adminNextPageToken, limit: 100 });

        const newUsers = result.data.users;
        const nextToken = result.data.nextPageToken;

        // Deduplicate just in case
        const currentUsers = state.adminUsers || [];
        const existingIds = new Set(currentUsers.map(u => u.uid));
        const uniqueNewUsers = newUsers.filter(u => !existingIds.has(u.uid));

        const updatedUsers = [...currentUsers, ...uniqueNewUsers];

        setState({
            adminUsers: updatedUsers,
            adminNextPageToken: nextToken
        });

        renderAdminUserList(updatedUsers, state.adminSearchQuery || '');
    } catch (error) {
        Logger.error("Failed to load users:", error);
        if (reset) {
            DOM.adminUserList.innerHTML = `<p class="text-center text-red-500">${i18n.t('pro.msgFailedLoadUsers', {error: error.message})}</p>`;
        } else {
            showMessage(i18n.t('pro.msgFailedLoadUsers', {error: error.message}), 'error');
        }
    } finally {
        if (loadMoreBtn) setButtonLoadingState(loadMoreBtn, false);
    }
}

async function openAdminDashboard() {
    DOM.adminDashboardModal.classList.add('visible');
    setState({ adminSearchQuery: '' });
    await refreshAdminUserList(true);
}

function renderAdminUserList(users, searchQuery = '') {
    setState({ adminSearchQuery: searchQuery });

    // Add search bar if not present
    let searchContainer = DOM.adminDashboardModal.querySelector('#admin-search-container');
    if (!searchContainer) {
        searchContainer = document.createElement('div');
        searchContainer.id = 'admin-search-container';
        searchContainer.className = 'mb-4 sticky top-0 z-10 pt-1 pb-2 px-1 -mx-1'; // Added bg for sticky
        searchContainer.innerHTML = `
            <div class="relative mx-2">
                <div class="absolute inset-y-0 left-0 flex items-center pointer-events-none" style="padding-left: 1rem;">
                    <i class="fas fa-search text-gray-400"></i>
                </div>
                <input type="text" id="admin-user-search" placeholder="${i18n.t('pro.searchUserPlaceholder') || 'Search loaded users...'}" style="padding-left: 3.5rem; padding-right: 1rem;"
                    class="block w-full py-2 border border-gray-300 dark:border-gray-600 rounded-xl leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out">
            </div>
        `;
        // Insert it into the modal body, before the list wrapper.
        const modalBody = DOM.adminDashboardModal.querySelector('.modal-container > div:last-child');
        modalBody.insertBefore(searchContainer, modalBody.firstChild);

        // Add event listener for search
        const searchInput = searchContainer.querySelector('#admin-user-search');
        searchInput?.addEventListener('input', debounce((e) => {
            renderAdminUserList(state.adminUsers, e.target.value.trim());
        }, 300));
    }

    DOM.adminUserList.innerHTML = '';

    // Filter users (Client-side filtering of loaded users)
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
                <p class="font-medium text-blue-800 dark:text-blue-300">${i18n.t('pro.userNotFound')}</p>
                <p class="text-sm text-blue-600 dark:text-blue-400">${i18n.t('pro.grantAccessTo', {email: sanitizeHTML(searchQuery)})}</p>
            </div>
            <button id="grant-pro-btn" class="px-4 py-2 bg-[#0071e3] text-white rounded-full hover:bg-[#0077ed] transition-colors text-sm font-medium active:scale-95 duration-200">${i18n.t('pro.grantAccess')}</button>
        `;
        DOM.adminUserList.appendChild(grantCard);

        grantCard.querySelector('#grant-pro-btn')?.addEventListener('click', async (e) => {
            const btn = e.target;
            setButtonLoadingState(btn, true);
            await grantProByEmail(searchQuery);
            // setButtonLoadingState handled by refresh, but just in case
        });
    }

    if (filteredUsers.length === 0 && !isEmail) {
        DOM.adminUserList.innerHTML += `<p class="text-center text-gray-500 py-4">${i18n.t('pro.noUsersFound')}</p>`;
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
        item.className = 'admin-user-item flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm gap-4';

        let roleBadgeClass = user.role === 'co-admin' ? 'co-admin' : (user.role === 'pro' ? 'pro' : 'standard');
        const isPending = user.status === 'pending';

        // Format Member Since date
        let memberSince = '-';
        if (user.creationTime) {
            try {
                memberSince = new Date(user.creationTime).toLocaleDateString(i18n.currentLang, { year: 'numeric', month: 'short', day: 'numeric' });
            } catch (e) { Logger.error("Date parse error", e); }
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
                        proExpiryText = `<span class="text-red-500 font-bold">${i18n.t('pro.expired')}</span>`;
                    } else {
                        const expiry = expiryDate.toLocaleDateString(i18n.currentLang, { year: 'numeric', month: 'short', day: 'numeric' });
                        proExpiryText = `${i18n.t('pro.expLabel')} ${expiry}`;
                    }
                } else if (user.role === 'pro') {
                     proExpiryText = i18n.t('pro.tillRevoked');
                }
             } catch(e) {}
        }

        // Logic for button text
        let proButtonText = user.role === 'pro' ? i18n.t('pro.revoke') : i18n.t('pro.makePro');
        if (isPending && user.role === 'pro') {
            proButtonText = i18n.t('pro.revokeInvite');
        }
        if (isExpired && user.role === 'pro') {
            proButtonText = i18n.t('pro.renew');
            roleBadgeClass = 'standard';
        }

        let displayRole = (isExpired && user.role === 'pro') ? 'standard' : user.role;
        let roleBadgeHTML;

        if (isPending) {
            roleBadgeHTML = `<span class="role-badge pending">${i18n.t('pro.pendingSignup')}</span>`;
        } else if (isSuperAdmin) {
            roleBadgeHTML = `<span class="role-badge owner">${i18n.t('pro.owner')}</span>`;
        } else {
            const roleKeyMap = {
                'pro': 'pro.label',
                'standard': 'pro.standard',
                'co-admin': 'pro.coAdmin'
            };
            const i18nKey = roleKeyMap[displayRole] || `pro.${displayRole}`;
            roleBadgeHTML = `<span class="role-badge ${roleBadgeClass}" data-i18n="${i18nKey}">${i18n.t(i18nKey)}</span>`;
        }

        item.innerHTML = `
            <div class="flex items-center w-full sm:w-auto flex-grow min-w-0 mr-0 sm:mr-2 ${isPending ? 'opacity-70' : ''}">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold mr-3 flex-shrink-0">
                    ${(user.displayName || user.email || '?').charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0 flex-grow">
                    <p class="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">${sanitizeHTML(user.displayName || 'No Name')}</p>
                    <p class="text-gray-500 truncate" style="font-size: 10px;">${sanitizeHTML(user.email)}</p>
                    <div class="mt-1 flex items-center gap-2">
                        ${roleBadgeHTML}
                    </div>
                </div>
            </div>

            <!-- Date Stack (Tiny) -->
            <div class="flex flex-row sm:flex-col justify-between sm:items-end w-full sm:w-auto sm:min-w-[80px] mt-2 sm:mt-0" style="font-size: 10px;">
                <div class="text-gray-400">
                    <span class="font-medium text-gray-500">${i18n.t('pro.joined')}</span> ${memberSince}
                </div>
                ${proSinceDate ? `
                <div class="text-gray-400 ml-4 sm:ml-0 sm:mt-1 text-right">
                    <span class="font-medium text-blue-500">${i18n.t('pro.label')}</span> ${proSinceDate}
                    ${proExpiryText ? `<div class="text-gray-300" style="font-size: 9px;">${proExpiryText}</div>` : ''}
                </div>` : ''}
            </div>

            ${!isSuperAdmin ? `
            <div class="flex items-center gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                <div class="flex flex-col sm:flex-col gap-2 w-full sm:w-auto">
                    <button class="toggle-role-btn flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-full border transition-colors active:scale-95 duration-200 justify-center ${user.role === 'pro' ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}"
                            data-uid="${user.uid}" data-email="${user.email}" data-pending="${isPending}" data-role="pro" data-current="${user.role === 'pro'}" data-expired="${isExpired}">
                        ${proButtonText}
                    </button>
                    <button class="toggle-role-btn flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-full border transition-colors active:scale-95 duration-200 justify-center ${user.role === 'co-admin' ? 'bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}"
                            data-uid="${user.uid}" data-role="co-admin" data-current="${user.role === 'co-admin'}" ${isPending ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                        ${user.role === 'co-admin' ? i18n.t('pro.revokeCoAdmin') : i18n.t('pro.makeCoAdmin')}
                    </button>
                </div>
            </div>
            ` : ''}
        `;

        DOM.adminUserList.appendChild(item);
    });

    // Add event listeners
    DOM.adminUserList.querySelectorAll('.toggle-role-btn').forEach(btn => {
        btn?.addEventListener('click', async (e) => {
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

                    const { functions, httpsCallable } = await getFunctionsInstance();
                    const updateUserRole = httpsCallable(functions, 'updateUserRole');
                    await updateUserRole({ targetUserId: uid, newRole: newRole });

                    // Refresh list - but try to keep position/data if possible, or just reset?
                    // Resetting is safer for consistency
                    await refreshAdminUserList(true);

                    const roleKeyMap = {
                        'pro': 'pro.label',
                        'standard': 'pro.standard',
                        'co-admin': 'pro.coAdmin'
                    };
                    const roleLabelKey = roleKeyMap[newRole] || `pro.${newRole}`;
                    showMessage(i18n.t('pro.msgRoleUpdated', {role: i18n.t(roleLabelKey)}), 'success');
                }
            } catch (error) {
                Logger.error("Failed to update role:", error);
                showMessage(i18n.t("pro.msgFailedUpdateRole"), 'error');
            } finally {
                // Ensure loading state is cleared if not re-rendered
                // If re-rendered, this element is gone anyway.
            }
        });
    });

    // Add Load More Button if there's a next page token and no active search
    // (Search is client-side filtering on loaded data, complex to combine with server pagination without Algolia)
    if (state.adminNextPageToken && !searchQuery) {
        const loadMoreContainer = document.createElement('div');
        loadMoreContainer.className = 'text-center py-4';
        loadMoreContainer.innerHTML = `
            <button id="admin-load-more-btn" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium active:scale-95 duration-200">
                ${i18n.t('pro.loadMore') || 'Load More'}
            </button>
        `;
        DOM.adminUserList.appendChild(loadMoreContainer);

        loadMoreContainer.querySelector('#admin-load-more-btn')?.addEventListener('click', () => {
            refreshAdminUserList(false);
        });
    }
}

// --- App Initialization ---
function initSplashScreen() {
    requestAnimationFrame(() => {
        // Reset Splash Screen State (for reload/logout scenarios)
        if (DOM.splashScreen) {
            DOM.splashScreen.style.display = 'flex';
            DOM.splashScreen.style.zIndex = '100'; // Bring to front
            DOM.splashScreen.style.opacity = '1';
            DOM.splashScreen.style.backgroundColor = '#0f172a'; // Reset background color
            DOM.splashScreen.style.cursor = 'default';
        }

        // Show Loading, Hide Tap to Begin initially
        if (DOM.splashLoading) {
            DOM.splashLoading.style.display = 'flex';
            DOM.splashLoading.classList.remove('hiding');
        }
        if (DOM.tapToBegin) {
            DOM.tapToBegin.style.display = 'none';
            DOM.tapToBegin.classList.remove('hiding');
        }
        if (DOM.splashText) {
            DOM.splashText.style.display = 'block';
            DOM.splashText.classList.remove('animating-out');
        }
    });
}

function setupSplashTapListener() {
    requestAnimationFrame(() => {
        if (DOM.splashLoading) DOM.splashLoading.style.display = 'none';
        if (DOM.tapToBegin) {
            DOM.tapToBegin.style.display = 'block';
            DOM.tapToBegin.style.opacity = '1'; // Ensure visibility
        }
        if (DOM.splashScreen) {
            DOM.splashScreen.style.cursor = 'pointer';
            DOM.splashScreen?.addEventListener('click', dismissSplashScreen, { once: true });
        }
    });
}

function dismissSplashScreen() {
    if (DOM.tapToBegin) DOM.tapToBegin.style.display = 'none';
    if (DOM.splashLoading) DOM.splashLoading.style.display = 'none';
    if (DOM.splashText) DOM.splashText.classList.add('animating-out');

    // Explicitly trigger background fade to transparent
    if (DOM.splashScreen) {
        DOM.splashScreen.style.backgroundColor = 'transparent';
    }

    // Wait for the splash screen to fade out
    const handleSplashTransitionEnd = (e) => {
        if (e.target === DOM.splashScreen) {
             DOM.splashScreen.style.zIndex = '-10';
             DOM.splashScreen.style.cursor = 'default';
             // Background color is already transparent from above
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

    DOM.splashScreen?.addEventListener('transitionend', handleSplashTransitionEnd);
    if (DOM.splashText) {
         DOM.splashText?.addEventListener('animationend', handleTextAnimationEnd);

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
}

async function init() {
    initUI();

    // Start loading Firebase modules in parallel
    const firebaseLoad = loadFirebaseModules();

    try {
        await i18n.init(); // Initialize i18n and wait for it
    } catch (e) {
        Logger.error("i18n init error:", e);
    }
    subscribeToAppConfig(); // Start listening for config changes
    setupEventListeners();
    setupDailyViewEventListeners();
    setupColorPicker();
    loadTheme();

    initSplashScreen();
    loadSplashScreenVideo();
    initAuth(); // Call immediately

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                Logger.info('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                Logger.info('ServiceWorker registration failed: ', err);
            });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
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
window.renderAdminUserList = renderAdminUserList; window.openAdminDashboard = openAdminDashboard;

// Helper to call backend for revoking pro whitelist
async function revokeProWhitelist(email) {
    if (!email) return;
    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const revokePro = httpsCallable(functions, 'revokeProWhitelist');
        const result = await revokePro({ email });
        showMessage(result.data.message, 'success');
        // Refresh list
        await refreshAdminUserList();
    } catch (error) {
        Logger.error("Failed to revoke pro whitelist:", error);
        showMessage(i18n.t("pro.msgFailedRevoke"), 'error');
    }
}

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

// --- TOG Tracker Integration ---

function toggleAppMode() {
    if (DOM.appView.classList.contains('hidden')) {
        switchToTrackerMode();
    } else {
        switchToTogMode();
    }
}

function switchToTrackerMode() {
    switchView(DOM.appView, DOM.togView);
    if (DOM.navTogBtn) {
        DOM.navTogBtn.innerHTML = `<i class="fas fa-clock text-base"></i><span class="hidden sm:inline">TOGtracker</span>`;
        DOM.navTogBtn.title = "Switch to TOGtracker";
    }
}

function switchToTogMode() {
    initTog(state.userId, db, auth, i18n);
    switchView(DOM.togView, DOM.appView);
    if (DOM.navTogBtn) {
        DOM.navTogBtn.innerHTML = `<i class="fas fa-chart-pie text-base"></i><span class="hidden sm:inline">TrackerBuddy</span>`;
        DOM.navTogBtn.title = "Switch to TrackerBuddy";
    }
}

window.openSharedMonthPicker = function(initialDate, callback) {
    state.pickerYear = initialDate.getFullYear();
    state.pickerCallback = callback;
    renderMonthPicker();
    DOM.monthPickerModal.classList.add('visible');
}

function setupTbUserMenu(user) {
    if (!DOM.tbUserAvatarBtn || !DOM.tbUserDropdown) return;

    // Set Avatar
    if (user) {
        const letter = (user.email || 'U').charAt(0).toUpperCase();
        DOM.tbMenuAvatar.innerText = letter;
        DOM.tbMenuEmail.innerText = user.email || 'User';
    } else {
        DOM.tbMenuAvatar.innerHTML = '<i class="fas fa-user"></i>';
        DOM.tbMenuEmail.innerText = 'Guest';
    }

    // Toggle
    DOM.tbUserAvatarBtn.onclick = (e) => {
        e.stopPropagation();
        const isClosed = DOM.tbUserDropdown.classList.contains('opacity-0');
        if (isClosed) {
            DOM.tbUserDropdown.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
        } else {
            DOM.tbUserDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        }
    };

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (DOM.tbMenuContainer && !DOM.tbMenuContainer.contains(e.target)) {
            DOM.tbUserDropdown.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
        }
    });
}

function confirmTrackerReset() {
    state.pendingSwipeAction = 'performTrackerReset';
    if (DOM.swipeText) DOM.swipeText.textContent = i18n.t('dashboard.swipeToResetTracker');
    const desc = DOM.swipeConfirmModal.querySelector('p');
    if (desc) desc.textContent = state.isOnlineMode ? i18n.t('dashboard.resetConfirmCloud') : i18n.t('dashboard.resetConfirmLocal');
    DOM.swipeConfirmModal.classList.add('visible');
    resetSwipeConfirm();
}

function confirmTogReset() {
    state.pendingSwipeAction = 'performTogReset';
    if (DOM.swipeText) DOM.swipeText.textContent = i18n.t('tog.swipeToReset');
    const desc = DOM.swipeConfirmModal.querySelector('p');
    if (desc) desc.textContent = i18n.t('tog.resetConfirm');
    DOM.swipeConfirmModal.classList.add('visible');
    resetSwipeConfirm();
}

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
                if (state.pendingSwipeAction === 'performTrackerReset') {
                    performTrackerReset();
                } else if (state.pendingSwipeAction === 'performTogReset') {
                    performTogReset(state.userId, db);
                } else if (state.pendingSwipeAction === 'deleteLeaveType') { // Explicit check
                     deleteLeaveType();
                } else {
                     // Default behavior only if explicit action matches or legacy handling if strictly needed,
                     // but for safety, we should avoid default destructive actions.
                     // However, deleteLeaveType was the implied default in original code.
                     // To be safe, we only run deleteLeaveType if it was set (which we handle below).
                     // If pendingSwipeAction is null or unknown, do nothing.
                     if (!state.pendingSwipeAction) {
                         deleteLeaveType(); // Keeping legacy default for now if it was relying on null?
                         // Actually, deleteLeaveType logic sets confirmAction on the button,
                         // BUT `DOM.deleteLeaveTypeBtn` listener sets `swipeConfirmModal` visible.
                         // Let's check `DOM.deleteLeaveTypeBtn` listener.
                         // It does: `DOM.swipeConfirmModal.classList.add('visible'); resetSwipeConfirm();`
                         // It DOES NOT set `state.pendingSwipeAction`.
                         // So it relies on the 'else' block.
                         // We should update the listener to set the action.
                     } else {
                         // Unknown action, do nothing
                         Logger.warn("Unknown swipe action:", state.pendingSwipeAction);
                     }
                }
                state.pendingSwipeAction = null;
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
    thumb?.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent text selection
        startDrag(e.clientX);
    });
    document?.addEventListener('mousemove', (e) => {
        if (isDragging) onMove(e.clientX);
    });
    document?.addEventListener('mouseup', (e) => {
        if (isDragging) endDrag(e.clientX);
    });

    // Touch Events
    thumb?.addEventListener('touchstart', (e) => {
        // e.preventDefault(); // Might block scrolling if not careful, but needed here?
        // Using touch-action: none in CSS on track instead.
        startDrag(e.touches[0].clientX);
    }, { passive: true });

    track?.addEventListener('touchmove', (e) => {
        if (isDragging) onMove(e.touches[0].clientX);
    }, { passive: true });

    document?.addEventListener('touchend', (e) => {
        if (isDragging) endDrag(e.changedTouches[0].clientX);
    });

    DOM.cancelSwipeBtn?.addEventListener('click', () => {
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
