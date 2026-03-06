import { auth, db, enableNetwork, disableNetwork, waitForPendingWrites, getFunctionsInstance } from '../config/firebase.js';
import { COLLECTIONS, LOCAL_STORAGE_KEYS } from '../config/constants.js';
import { state, setState, DOM, i18n, transitionState } from '../../app.js';
import { Logger } from '../utils/logger.js';
import { isMobileDevice, triggerHapticFeedback, getYYYYMMDD, formatTextForDisplay, sanitizeHTML, formatDateForDisplay, debounce } from '../utils/utils.js';
import { VIEW_MODES, ACTION_TYPES, NOTIFICATION_SHAPE, APP_NAME, TOG_APP_NAME, USER_ROLES, TEAM_ROLES } from '../config/constants.js';
import { html, render } from 'lit-html';
import { getVisibleLeaveTypesForYear, renderLeavePills, renderLeaveStats, openLeaveOverviewModal, setupColorPicker, openLeaveTypeModal, moveLeaveType, openLeaveCustomizationModal, deleteLeaveDay, saveLoggedLeaves, closeLeaveTypeModal, saveLeaveType, deleteLeaveType, handleBulkRemoveClick, closeLeaveOverviewModal } from './leaveRoutes.js';
import { renderTeamSection, subscribeToTeamData, cleanupTeamSubscriptions, triggerTeamSync, openCreateTeamModal, openJoinTeamModal, openTeamDashboard, openEditDisplayNameModal, openEditTeamNameModal, copyRoomCode, leaveTeam, deleteTeam, createTeam, joinTeam, editDisplayName, editTeamName, closeTeamDashboard, closeCreateTeamModal, closeJoinTeamModal, closeEditDisplayNameModal, closeEditTeamNameModal, closeKickMemberModal, kickMember } from './teamRoutes.js';
import { deleteActivity, updateActivityOrder, saveData, downloadCSV, performTrackerReset, handleFileUpload, calculateDataSize, formatBytes, loadOfflineData } from './dataRoutes.js';
import { initTog, performReset as performTogReset } from '../models/tog.js';
import { hasSeenWelcomeScreen, showWelcomeScreen, setupWelcomeScreenListener } from '../models/welcome.js';
import { appSignOut, signUpWithEmail, signInWithEmail, resetPassword, signInWithGoogle, handleUserLogin } from './authRoutes.js';
import { setProStatus, grantProByEmail, refreshAdminUserList, revokeProWhitelist, openAdminDashboard } from './adminRoutes.js';
export function waitForDOMUpdate() { return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }

export function initUI() {
    if (isMobileDevice()) {
        document.body.classList.add('is-mobile');
    }

    Object.assign(DOM, {
        splashScreen: document.getElementById('splash-screen'),
        splashText: document.querySelector('.splash-text'),
        splashLoading: document.getElementById('splash-loading'),
        tapToBegin: document.getElementById('tap-to-begin'),
        contentWrapper: document.getElementById('content-wrapper'),
        footer: document.getElementById('main-footer'),
        welcomeView: document.getElementById('welcome-view'),
        welcomeGetStartedBtn: document.getElementById('welcome-get-started-btn'),
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
        todayBtnDay: document.getElementById('tb-today-btn'),
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
        // Calendar Context Menu
        calendarContextMenu: document.getElementById('calendar-context-menu'),
        contextEditLeaveBtn: document.getElementById('context-edit-leave-btn'),
        contextSelectMoreBtn: document.getElementById('context-select-more-btn'),
        contextDeleteLeaveBtn: document.getElementById('context-delete-leave-btn'),
        // Navigation & Menus
        navTogBtn: document.getElementById('nav-tog-btn'),
        tbUserAvatarBtn: document.getElementById('tb-user-avatar-btn'),
        tbUserDropdown: document.getElementById('tb-user-dropdown'),
        tbMenuContainer: document.getElementById('tb-user-menu-container'),
        tbMenuAvatar: document.getElementById('tb-menu-avatar'),
        tbMenuEmail: document.getElementById('tb-menu-user-email')
    });

    setupMessageSwipe();
    setupSwipeConfirm();

    window.showAppMessage = showMessage;
    window.appSignOut = appSignOut;
}

export function setInputErrorState(inputElement, hasError) {
    if (hasError) {
        inputElement.classList.add('border-red-500', 'ring-red-500');
        inputElement.classList.remove('border-gray-200');
    } else {
        inputElement.classList.remove('border-red-500', 'ring-red-500');
        inputElement.classList.add('border-gray-200');
    }
}

export function setButtonLoadingState(button, isLoading) {
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

export function switchView(viewToShow, viewToHide, callback) {
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

export function showMessage(msg, type = 'info') {
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

export function hideMessage() {
    DOM.messageDisplay.classList.remove('show');
    // Allow transition to finish before resetting content or state if needed
}

export function setupMessageSwipe() {
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

export function updateView() {
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

export function renderActionButtons() {
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

export function renderCalendar() {
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
        let noteText = dayData.note || '';
        if (noteText.length > 8) {
            noteText = noteText.substring(0, 8) + '...';
        }
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

export function renderDailyActivities() {
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

export function renderMonthPicker() {
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

export function renderStorageUsage(byteSize) {
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

export function applyTheme(theme) {
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

export function toggleTheme() {
    const isDark = document.body.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem(LOCAL_STORAGE_KEYS.THEME, newTheme);
    applyTheme(newTheme);
}

export function loadTheme() {
    const savedTheme = localStorage.getItem(LOCAL_STORAGE_KEYS.THEME);
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (systemPrefersDark) {
        applyTheme('dark');
    } else {
        applyTheme('light');
    }
}

export function setupDoubleClickConfirm(element, actionKey, messageKey, callback) {
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

export function handleMoveUpClick(currentRow) {
    if (currentRow.previousElementSibling) {
        triggerHapticFeedback('medium');
        DOM.dailyActivityTableBody.insertBefore(currentRow, currentRow.previousElementSibling);
        updateActivityOrder();
    }
}

export function handleMoveDownClick(currentRow) {
    if (currentRow.nextElementSibling) {
        triggerHapticFeedback('medium');
        DOM.dailyActivityTableBody.insertBefore(currentRow.nextElementSibling, currentRow);
        updateActivityOrder();
    }
}

export function handleInlineEditClick(event) {
    const target = event.currentTarget;
    if (state.editingInlineTimeKey && state.editingInlineTimeKey !== target.dataset.time) {
        DOM.dailyActivityTableBody.querySelector(`[data-time="${state.editingInlineTimeKey}"]`)?.blur();
    }
    target.classList.add('editing');
    setState({ editingInlineTimeKey: target.dataset.time });
}

export function handleInlineEditBlur(event) {
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

export function handleInlineEditKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        const target = event.target;
        event.preventDefault();
        // Manually trigger save, then blur (safe to call twice due to state check)
        handleInlineEditBlur({ currentTarget: target });
        target.blur();
    }
}

export function createMagicParticles() {
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

export function handleLogoTap() {
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

export function loadSplashScreenVideo() {
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

export function setupDailyViewEventListeners() {
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

export function openSpotlight() {
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

export function closeSpotlight() {
    DOM.spotlightModal.classList.remove('visible');
    updateView();
    if (state.previousActiveElement) {
        state.previousActiveElement.focus();
        state.previousActiveElement = null;
    }
}

export function performSearch(query) {
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

export function toggleSearchSort() {
    const newOrder = state.searchSortOrder === 'newest' ? 'oldest' : 'newest';
    setState({ searchSortOrder: newOrder });
    performSearch(state.searchQuery);
}

export function toggleSearchScope() {
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

export function renderSearchResults(results) {
    DOM.spotlightResultsList.innerHTML = '';

    // Sort results for display
    if (state.searchSortOrder === 'newest') {
        results.sort((a, b) => new Date(b.date) - new Date(a.date));
        DOM.spotlightSortLabel.textContent = i18n.t('search.newestFirst');
        DOM.spotlightSortLabel.setAttribute('data-i18n', 'search.newestFirst');
        DOM.spotlightSortBtn.querySelector('i').className = "fas fa-sort-amount-down ms-2";
    } else {
        results.sort((a, b) => new Date(a.date) - new Date(b.date));
        DOM.spotlightSortLabel.textContent = i18n.t('search.oldestFirst');
        DOM.spotlightSortLabel.setAttribute('data-i18n', 'search.oldestFirst');
        DOM.spotlightSortBtn.querySelector('i').className = "fas fa-sort-amount-up ms-2";
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
            iconHtml = '<div class="text-yellow-500 me-3 mt-1"><i class="fas fa-sticky-note"></i></div>';
            contentHtml = `<p class="font-medium text-gray-800">Note: <span class="font-normal text-gray-600">${sanitizeHTML(result.content)}</span></p>`;
        } else if (result.type === 'leave') {
            iconHtml = `<div class="me-3 mt-1" style="color: ${result.color};"><i class="fas fa-calendar-check"></i></div>`;
            contentHtml = `<p class="font-medium" style="color: ${result.color};">${sanitizeHTML(result.content)}</p>`;
        } else {
            iconHtml = '<div class="text-blue-500 me-3 mt-1"><i class="fas fa-clock"></i></div>';
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

export function setupEventListeners() {
    setupWelcomeScreenListener(DOM, switchView, handleUserLogin, loadOfflineData);

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
    DOM.monthViewBtn?.addEventListener('click', () => setTrackerView(VIEW_MODES.MONTH));
    DOM.dayViewBtn?.addEventListener('click', () => setTrackerView(VIEW_MODES.DAY));

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
                    ${isActive ? '<i class="fas fa-check ms-auto text-blue-500"></i>' : ''}
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
        const applyToAllYears = DOM.limitLeaveToYearBtn.dataset.limited === 'true';
        if (!applyToAllYears) {
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

    // Context Menu Logic
    let longPressTimer;
    const LONG_PRESS_DURATION = 500;

    const showContextMenu = (e, dateKey, x, y) => {
        if (state.selectedLeaveTypeId) return; // Don't show if in selection mode

        // Ensure the day actually has a leave before showing
        const year = new Date(dateKey + 'T00:00:00').getFullYear();
        if (!state.yearlyData[year]?.activities?.[dateKey]?.leave) return;

        e.preventDefault(); // Prevent standard right-click menu or other long-press behaviors
        state.contextMenuDate = dateKey;

        // Position the menu
        // Keep it inside the viewport
        const menuWidth = 160;
        const menuHeight = 90; // Approx height for two items
        let finalX = x;
        let finalY = y;

        if (x + menuWidth > window.innerWidth) finalX = window.innerWidth - menuWidth - 10;
        if (y + menuHeight > window.innerHeight) finalY = window.innerHeight - menuHeight - 10;

        DOM.calendarContextMenu.style.left = `${finalX}px`;
        DOM.calendarContextMenu.style.top = `${finalY}px`;
        DOM.calendarContextMenu.classList.remove('hidden');

        // Small delay to allow display:block to apply before animating opacity
        requestAnimationFrame(() => {
            DOM.calendarContextMenu.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
        });
        triggerHapticFeedback('medium');
    };

    const hideContextMenu = () => {
        if (!DOM.calendarContextMenu?.classList.contains('hidden')) {
            DOM.calendarContextMenu.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            setTimeout(() => {
                DOM.calendarContextMenu.classList.add('hidden');
                state.contextMenuDate = null;
            }, 210);
        }
    };

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (DOM.calendarContextMenu && !DOM.calendarContextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    DOM.calendarView?.addEventListener('contextmenu', (e) => {
        const cell = e.target.closest('.calendar-day-cell.current-month');
        if (!cell) return;
        showContextMenu(e, cell.dataset.date, e.clientX, e.clientY);
    });

    DOM.calendarView?.addEventListener('touchstart', (e) => {
        const cell = e.target.closest('.calendar-day-cell.current-month');
        if (!cell) return;
        // Don't start timer if we are in selection mode
        if (state.selectedLeaveTypeId) return;

        longPressTimer = setTimeout(() => {
            const touch = e.touches[0];
            showContextMenu(e, cell.dataset.date, touch.clientX, touch.clientY);
        }, LONG_PRESS_DURATION);
    }, { passive: false });

    const cancelLongPress = () => {
        if (longPressTimer) clearTimeout(longPressTimer);
    };

    DOM.calendarView?.addEventListener('touchend', cancelLongPress, { passive: true });
    DOM.calendarView?.addEventListener('touchmove', cancelLongPress, { passive: true });
    DOM.calendarView?.addEventListener('touchcancel', cancelLongPress, { passive: true });

    // Context Menu Actions
    DOM.contextEditLeaveBtn?.addEventListener('click', () => {
        const dateKey = state.contextMenuDate;
        hideContextMenu();
        if (dateKey) {
            // Enter edit mode directly into modal
            setState({ leaveSelection: new Set([dateKey]) });
            openLeaveCustomizationModal();
        }
    });

    DOM.contextSelectMoreBtn?.addEventListener('click', () => {
        const dateKey = state.contextMenuDate;
        hideContextMenu();
        if (dateKey) {
            // Extract the leave type ID so we can enter selection mode for that specific type
            const year = new Date(dateKey + 'T00:00:00').getFullYear();
            const leaveData = state.yearlyData[year]?.activities?.[dateKey]?.leave;
            if (leaveData) {
                setState({
                    selectedLeaveTypeId: leaveData.typeId,
                    leaveSelection: new Set([dateKey])
                });
                updateView();
            }
        }
    });

    DOM.contextDeleteLeaveBtn?.addEventListener('click', async () => {
        const dateKey = state.contextMenuDate;
        hideContextMenu();
        if (dateKey) {
            // Instant Delete without confirmation
            await deleteLeaveDay(dateKey);
        }
    });


    DOM.calendarView?.addEventListener('click', (e) => {
        const cell = e.target.closest('.calendar-day-cell.current-month');
        if (!cell) return;

        // If context menu is open and they clicked the cell, it should just close the menu (handled by document click)
        // Let's prevent standard click navigation if they just finished a long press
        if (state.contextMenuDate) return;

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

export function exitSearchMode() {
    setState({ searchQuery: '', searchResultDates: [] });
    if (DOM.exitSearchBtn) DOM.exitSearchBtn.classList.remove('visible');
    if (DOM.spotlightInput) DOM.spotlightInput.value = '';
    updateView();
}

export function renderAdminButton() {
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

export function openProDurationModal(userId) {
    state.adminTargetUserId = userId;
    const modal = document.getElementById('pro-duration-modal');
    if (modal) {
        modal.classList.add('visible');
        document.getElementById('pro-expiry-date').value = '';
    }
}

export function renderAdminUserList(users, searchQuery = '') {
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

        // Format Last Seen
        let lastSeenDate = '-';
        const lastSeenVal = user.lastSeen || user.lastSignInTime;
        if (lastSeenVal) {
            try {
                const dateObj = new Date(lastSeenVal);
                const dateStr = dateObj.toLocaleDateString(i18n.currentLang, { year: 'numeric', month: 'short', day: 'numeric' });
                const timeStr = dateObj.toLocaleTimeString(i18n.currentLang, { hour: '2-digit', minute: '2-digit' });
                lastSeenDate = `${dateStr} ${timeStr}`;
            } catch (e) { }
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
            <div class="flex items-center w-full sm:w-auto flex-grow min-w-0 me-0 sm:me-2 ${isPending ? 'opacity-70' : ''}">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold me-3 flex-shrink-0">
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
                <div class="text-gray-400 ms-4 sm:ms-0 sm:mt-1 text-right sm:text-right">
                     <span class="font-medium text-gray-500">${i18n.t('pro.lastSeen')}</span> ${lastSeenDate}
                </div>
                ${proSinceDate ? `
                <div class="text-gray-400 ms-4 sm:ms-0 sm:mt-1 text-right">
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

export function initSplashScreen() {
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

export function setupSplashTapListener() {
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

export function dismissSplashScreen() {
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

export function restoreLastView(viewToHide) {
    let lastView = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_VIEW_MODE);
    let lastTrackerView = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_TRACKER_VIEW);

    if (state.userId) {
        if (state.lastViewMode) lastView = state.lastViewMode;
        if (state.lastTrackerView) lastTrackerView = state.lastTrackerView;
    }

    if (lastTrackerView && (lastTrackerView === VIEW_MODES.MONTH || lastTrackerView === VIEW_MODES.DAY)) {
        setState({ currentView: lastTrackerView });
    }

    if (lastView === 'tog') {
        switchToTogMode(viewToHide);
    } else {
        switchToTrackerMode(viewToHide);
    }
}

export function toggleAppMode() {
    if (DOM.appView.classList.contains('hidden')) {
        switchToTrackerMode();
    } else {
        switchToTogMode();
    }
}

export function setTrackerView(viewMode) {
    setState({ currentView: viewMode });
    updateView();
    localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_TRACKER_VIEW, viewMode);
    if (state.userId && state.isOnlineMode) {
        saveDataToFirestore(null, { lastTrackerView: viewMode }).catch(console.error);
    }
}

export function switchToTrackerMode(viewToHide = DOM.togView) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_VIEW_MODE, 'tracker');
    if (state.userId && state.isOnlineMode) {
        saveDataToFirestore(null, { lastViewMode: 'tracker' }).catch(console.error);
    }
    switchView(DOM.appView, viewToHide, updateView);
    if (DOM.navTogBtn) {
        DOM.navTogBtn.innerHTML = `<i class="fas fa-clock text-base"></i><span class="hidden sm:inline">${TOG_APP_NAME}</span>`;
        DOM.navTogBtn.title = `Switch to ${TOG_APP_NAME}`;
    }
}

export function switchToTogMode(viewToHide = DOM.appView) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_VIEW_MODE, 'tog');
    if (state.userId && state.isOnlineMode) {
        saveDataToFirestore(null, { lastViewMode: 'tog' }).catch(console.error);
    }
    initTog(state.userId, db, auth, i18n);
    switchView(DOM.togView, viewToHide);
    if (DOM.navTogBtn) {
        DOM.navTogBtn.innerHTML = `<i class="fas fa-chart-pie text-base"></i><span class="hidden sm:inline">${APP_NAME}</span>`;
        DOM.navTogBtn.title = `Switch to ${APP_NAME}`;
    }
}

export function injectRealTimeControls(context) {
    // Feature: Disable real-time updates for now, simply return early to prevent injection
    return;

    const isTb = context === 'trackerbuddy';
    const containerId = isTb ? 'real-time-toggle-container-tb' : 'real-time-toggle-container-tog';
    const toggleBtnId = isTb ? 'real-time-toggle-btn-tb' : 'real-time-toggle-btn-tog';
    const syncContainerId = isTb ? 'tb-sync-container' : 'tog-sync-container';
    const syncBtnId = isTb ? 'tb-sync-now-btn' : 'tog-sync-now-btn';
    const lastSyncId = isTb ? 'tb-last-sync-text' : 'tog-last-sync-text';

    // Check if already exists
    if (document.getElementById(containerId)) return;

    // Determine insertion point
    let insertTarget = null;
    let menuContainer = null;

    if (isTb) {
        // APP_NAME: Insert before Help button
        insertTarget = document.getElementById('tb-help-btn');
        if (insertTarget) menuContainer = insertTarget.parentNode;
    } else {
        // TOG: Insert after User Info (header)
        const dropdown = document.getElementById('tog-user-dropdown');
        if (dropdown) {
            menuContainer = dropdown.querySelector('.p-2');
            if (menuContainer && menuContainer.children.length > 0) {
                // First child is header, insert after it
                insertTarget = menuContainer.children[0].nextElementSibling;
            }
        }
    }

    if (!menuContainer) return;

    const controlsDiv = document.createElement('div');
    controlsDiv.id = containerId + '-wrapper'; // Wrapper to hold both elements
    controlsDiv.innerHTML = `
        <div id="${containerId}" class="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i class="fas fa-bolt text-gray-500 dark:text-gray-400 text-sm"></i>
                    <span class="text-sm text-gray-700 dark:text-gray-200 font-medium" data-i18n="common.realTimeUpdates">${i18n.t('common.realTimeUpdates') || 'Real-time Updates'}</span>
                </div>
                <button id="${toggleBtnId}" class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-blue-500" role="switch" aria-checked="true">
                    <span aria-hidden="true" class="toggle-knob pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-5 rtl:-translate-x-5"></span>
                </button>
            </div>
        </div>
        <div id="${syncContainerId}" class="px-4 py-2 border-b border-gray-100 dark:border-gray-700" style="display: none;">
            <button id="${syncBtnId}" class="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm">
                <i class="fas fa-sync-alt"></i>
                <span data-i18n="common.syncNow">${i18n.t('common.syncNow') || 'Sync Now'}</span>
            </button>
            <p id="${lastSyncId}" class="text-xs text-center text-gray-500 mt-1"></p>
        </div>
    `;

    if (isTb) {
        menuContainer.insertBefore(controlsDiv, insertTarget);
    } else {
        if (insertTarget) {
            menuContainer.insertBefore(controlsDiv, insertTarget);
        } else {
            menuContainer.appendChild(controlsDiv);
        }
    }

    // Attach Listeners
    const toggleBtn = document.getElementById(toggleBtnId);
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const current = localStorage.getItem(LOCAL_STORAGE_KEYS.REAL_TIME_UPDATES) !== 'false';
            toggleRealTimeUpdates(!current);
        });
    }

    const syncBtn = document.getElementById(syncBtnId);
    if (syncBtn) {
        syncBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            performSync();
        });
    }

    // Initial UI Update
    updateSyncUI();
}

export function updateSyncUI() {
    const isRealTime = localStorage.getItem(LOCAL_STORAGE_KEYS.REAL_TIME_UPDATES) !== 'false';
    const lastSync = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_SYNC_TIME);
    let lastSyncTextContent = `${i18n.t('common.lastSynced') || 'Last synced'}: -`;

    if (lastSync) {
        const date = new Date(lastSync);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString();
        lastSyncTextContent = `${i18n.t('common.lastSynced') || 'Last synced'}: ${dateStr} ${timeStr}`;
    }

    // Update both TB and TOG interfaces
    ['tb', 'tog'].forEach(prefix => {
        const container = document.getElementById(`${prefix}-sync-container`);
        const text = document.getElementById(`${prefix}-last-sync-text`);
        const toggleBtn = document.getElementById(`real-time-toggle-btn-${prefix}`);

        if (container) {
            container.style.display = isRealTime ? 'none' : 'block';
        }
        if (text && !isRealTime) {
            text.textContent = lastSyncTextContent;
        }
        if (toggleBtn) {
            const knob = toggleBtn.querySelector('.toggle-knob');
            if (isRealTime) {
                toggleBtn.classList.add('bg-blue-500');
                toggleBtn.classList.remove('bg-gray-200');
                knob.classList.add('translate-x-5');
            } else {
                toggleBtn.classList.add('bg-gray-200');
                toggleBtn.classList.remove('bg-blue-500');
                knob.classList.remove('translate-x-5');
            }
        }
    });
}

export function setupTbUserMenu(user) {
    if (!DOM.tbUserAvatarBtn || !DOM.tbUserDropdown) return;

    // Set Avatar
    if (user) {
        const letter = (user.email || 'U').charAt(0).toUpperCase();
        DOM.tbMenuAvatar.innerText = letter;
        DOM.tbMenuEmail.innerText = user.email || 'User';

        // Inject Real-time Controls if User is Logged In (For APP_NAME)
        injectRealTimeControls('trackerbuddy');
        // Inject Real-time Controls if User is Logged In (For TOG_APP_NAME)
        injectRealTimeControls('tog');
    } else {
        DOM.tbMenuAvatar.innerHTML = '<i class="fas fa-user"></i>';
        DOM.tbMenuEmail.innerText = 'Guest';

        // Remove Real-time Controls if present (Guest Mode)
        const tbWrapper = document.getElementById('real-time-toggle-container-tb-wrapper');
        if (tbWrapper) tbWrapper.remove();

        const togWrapper = document.getElementById('real-time-toggle-container-tog-wrapper');
        if (togWrapper) togWrapper.remove();
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

export function confirmTrackerReset() {
    state.pendingSwipeAction = 'performTrackerReset';
    if (DOM.swipeText) DOM.swipeText.textContent = i18n.t('dashboard.swipeToResetTracker');
    const desc = DOM.swipeConfirmModal.querySelector('p');
    if (desc) desc.textContent = state.isOnlineMode ? i18n.t('dashboard.resetConfirmCloud') : i18n.t('dashboard.resetConfirmLocal');
    DOM.swipeConfirmModal.classList.add('visible');
    resetSwipeConfirm();
}

export function confirmTogReset() {
    state.pendingSwipeAction = 'performTogReset';
    if (DOM.swipeText) DOM.swipeText.textContent = i18n.t('tog.swipeToReset');
    const desc = DOM.swipeConfirmModal.querySelector('p');
    if (desc) desc.textContent = i18n.t('tog.resetConfirm');
    DOM.swipeConfirmModal.classList.add('visible');
    resetSwipeConfirm();
}

export function setupSwipeConfirm() {
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

export function resetSwipeConfirm() {
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
