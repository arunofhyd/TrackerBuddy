// Import Firebase modules
// Dynamic imports for auth and firestore
import { html, render } from 'lit-html';
import { format } from 'date-fns';
import { TranslationService } from './src/middleware/i18n.js';
import { isMobileDevice, sanitizeHTML, debounce, waitForDOMUpdate, getYYYYMMDD, formatDateForDisplay, formatTextForDisplay, triggerHapticFeedback } from './src/utils/utils.js';
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
    NOTIFICATION_SHAPE,
    APP_NAME,
    TOG_APP_NAME,
    BACKUP_PREFIX
} from './src/config/constants.js';
import { createInitialState } from './src/middleware/state.js';
import { Logger } from './src/utils/logger.js';
import {
    app,
    auth,
    db,
    loadFirebaseModules,
    getFunctionsInstance,
    getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail,
    getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, updateDoc, getDoc, writeBatch, addDoc, deleteField, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    enableNetwork, disableNetwork, waitForPendingWrites, serverTimestamp
} from './src/config/firebase.js';
import { initTog, performReset as performTogReset, refreshTogUI, updateLeaveData } from './src/models/tog.js';
import { hasSeenWelcomeScreen, showWelcomeScreen, setupWelcomeScreenListener } from './src/models/welcome.js';

export const i18n = new TranslationService(() => {
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
        refreshTogUI();
    }
    // Update User ID Display if user is logged in
    if (state.userId && DOM.userIdDisplay) {
        DOM.userIdDisplay.textContent = i18n.t('dashboard.userIdPrefix') + state.userId;
    }
    // Refresh Color Picker (updates tooltips)
    setupColorPicker();

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

    // Update Real-time Updates / Sync Text
    updateSyncUI();
});

import { handleUserLogin } from './src/routes/authRoutes.js';
import { signUpWithEmail } from './src/routes/authRoutes.js';
import { signInWithEmail } from './src/routes/authRoutes.js';
import { signInWithGoogle } from './src/routes/authRoutes.js';
import { resetPassword } from './src/routes/authRoutes.js';
import { appSignOut } from './src/routes/authRoutes.js';
import { handleUserLogout } from './src/routes/authRoutes.js';
import { performLogoutCleanup } from './src/routes/authRoutes.js';
import { initAuth } from './src/routes/authRoutes.js';
import { subscribeToTeamData } from './src/routes/teamRoutes.js';
import { loadTeamMembersData } from './src/routes/teamRoutes.js';
import { triggerTeamSync } from './src/routes/teamRoutes.js';
import { cleanupTeamSubscriptions } from './src/routes/teamRoutes.js';
import { renderTeamSection } from './src/routes/teamRoutes.js';
import { openCreateTeamModal } from './src/routes/teamRoutes.js';
import { closeCreateTeamModal } from './src/routes/teamRoutes.js';
import { openJoinTeamModal } from './src/routes/teamRoutes.js';
import { closeJoinTeamModal } from './src/routes/teamRoutes.js';
import { openEditDisplayNameModal } from './src/routes/teamRoutes.js';
import { closeEditDisplayNameModal } from './src/routes/teamRoutes.js';
import { openEditTeamNameModal } from './src/routes/teamRoutes.js';
import { closeEditTeamNameModal } from './src/routes/teamRoutes.js';
import { createTeam } from './src/routes/teamRoutes.js';
import { joinTeam } from './src/routes/teamRoutes.js';
import { editDisplayName } from './src/routes/teamRoutes.js';
import { editTeamName } from './src/routes/teamRoutes.js';
import { leaveTeam } from './src/routes/teamRoutes.js';
import { deleteTeam } from './src/routes/teamRoutes.js';
import { copyRoomCode } from './src/routes/teamRoutes.js';
import { openKickMemberModal } from './src/routes/teamRoutes.js';
import { closeKickMemberModal } from './src/routes/teamRoutes.js';
import { kickMember } from './src/routes/teamRoutes.js';
import { openTeamDashboard } from './src/routes/teamRoutes.js';
import { closeTeamDashboard } from './src/routes/teamRoutes.js';
import { renderTeamDashboard } from './src/routes/teamRoutes.js';
import { getVisibleLeaveTypesForYear } from './src/routes/leaveRoutes.js';
import { openLeaveTypeModal } from './src/routes/leaveRoutes.js';
import { closeLeaveTypeModal } from './src/routes/leaveRoutes.js';
import { setupColorPicker } from './src/routes/leaveRoutes.js';
import { selectColorInPicker } from './src/routes/leaveRoutes.js';
import { saveLeaveType } from './src/routes/leaveRoutes.js';
import { deleteLeaveType } from './src/routes/leaveRoutes.js';
import { saveLeaveTypes } from './src/routes/leaveRoutes.js';
import { moveLeaveType } from './src/routes/leaveRoutes.js';
import { renderLeavePills } from './src/routes/leaveRoutes.js';
import { calculateLeaveBalances } from './src/routes/leaveRoutes.js';
import { openLeaveOverviewModal } from './src/routes/leaveRoutes.js';
import { closeLeaveOverviewModal } from './src/routes/leaveRoutes.js';
import { renderLeaveOverviewList } from './src/routes/leaveRoutes.js';
import { editLeaveDay } from './src/routes/leaveRoutes.js';
import { deleteLeaveDay } from './src/routes/leaveRoutes.js';
import { renderLeaveStats } from './src/routes/leaveRoutes.js';
import { openLeaveCustomizationModal } from './src/routes/leaveRoutes.js';
import { createLeaveTypeSelector } from './src/routes/leaveRoutes.js';
import { setupDayTypeToggle } from './src/routes/leaveRoutes.js';
import { renderLeaveCustomizationModal } from './src/routes/leaveRoutes.js';
import { saveLoggedLeaves } from './src/routes/leaveRoutes.js';
import { handleBulkRemoveClick } from './src/routes/leaveRoutes.js';
import { initUI } from './src/routes/uiRoutes.js';
import { setInputErrorState } from './src/routes/uiRoutes.js';
import { setButtonLoadingState } from './src/routes/uiRoutes.js';
import { switchView } from './src/routes/uiRoutes.js';
import { showMessage } from './src/routes/uiRoutes.js';
import { hideMessage } from './src/routes/uiRoutes.js';
import { setupMessageSwipe } from './src/routes/uiRoutes.js';
import { updateView } from './src/routes/uiRoutes.js';
import { renderActionButtons } from './src/routes/uiRoutes.js';
import { renderCalendar } from './src/routes/uiRoutes.js';
import { renderDailyActivities } from './src/routes/uiRoutes.js';
import { renderMonthPicker } from './src/routes/uiRoutes.js';
import { renderStorageUsage } from './src/routes/uiRoutes.js';
import { applyTheme } from './src/routes/uiRoutes.js';
import { toggleTheme } from './src/routes/uiRoutes.js';
import { loadTheme } from './src/routes/uiRoutes.js';
import { setupDoubleClickConfirm } from './src/routes/uiRoutes.js';
import { handleMoveUpClick } from './src/routes/uiRoutes.js';
import { handleMoveDownClick } from './src/routes/uiRoutes.js';
import { handleInlineEditClick } from './src/routes/uiRoutes.js';
import { handleInlineEditBlur } from './src/routes/uiRoutes.js';
import { handleInlineEditKeydown } from './src/routes/uiRoutes.js';
import { createMagicParticles } from './src/routes/uiRoutes.js';
import { handleLogoTap } from './src/routes/uiRoutes.js';
import { loadSplashScreenVideo } from './src/routes/uiRoutes.js';
import { setupDailyViewEventListeners } from './src/routes/uiRoutes.js';
import { openSpotlight } from './src/routes/uiRoutes.js';
import { closeSpotlight } from './src/routes/uiRoutes.js';
import { performSearch } from './src/routes/uiRoutes.js';
import { toggleSearchSort } from './src/routes/uiRoutes.js';
import { toggleSearchScope } from './src/routes/uiRoutes.js';
import { renderSearchResults } from './src/routes/uiRoutes.js';
import { setupEventListeners } from './src/routes/uiRoutes.js';
import { exitSearchMode } from './src/routes/uiRoutes.js';
import { renderAdminButton } from './src/routes/uiRoutes.js';
import { openProDurationModal } from './src/routes/uiRoutes.js';
import { renderAdminUserList } from './src/routes/uiRoutes.js';
import { initSplashScreen } from './src/routes/uiRoutes.js';
import { setupSplashTapListener } from './src/routes/uiRoutes.js';
import { dismissSplashScreen } from './src/routes/uiRoutes.js';
import { restoreLastView } from './src/routes/uiRoutes.js';
import { toggleAppMode } from './src/routes/uiRoutes.js';
import { setTrackerView } from './src/routes/uiRoutes.js';
import { switchToTrackerMode } from './src/routes/uiRoutes.js';
import { switchToTogMode } from './src/routes/uiRoutes.js';
import { injectRealTimeControls } from './src/routes/uiRoutes.js';
import { updateSyncUI } from './src/routes/uiRoutes.js';
import { setupTbUserMenu } from './src/routes/uiRoutes.js';
import { confirmTrackerReset } from './src/routes/uiRoutes.js';
import { confirmTogReset } from './src/routes/uiRoutes.js';
import { setupSwipeConfirm } from './src/routes/uiRoutes.js';
import { resetSwipeConfirm } from './src/routes/uiRoutes.js';
import { subscribeToData } from './src/routes/dataRoutes.js';
import { persistData } from './src/routes/dataRoutes.js';
import { handleSaveNote } from './src/routes/dataRoutes.js';
import { handleAddSlot } from './src/routes/dataRoutes.js';
import { handleUpdateActivityText } from './src/routes/dataRoutes.js';
import { handleUpdateTime } from './src/routes/dataRoutes.js';
import { saveData } from './src/routes/dataRoutes.js';
import { loadDataFromLocalStorage } from './src/routes/dataRoutes.js';
import { saveDataToLocalStorage } from './src/routes/dataRoutes.js';
import { saveDataToFirestore } from './src/routes/dataRoutes.js';
import { loadOfflineData } from './src/routes/dataRoutes.js';
import { performTrackerReset } from './src/routes/dataRoutes.js';
import { updateActivityOrder } from './src/routes/dataRoutes.js';
import { deleteActivity } from './src/routes/dataRoutes.js';
import { escapeCsvField } from './src/routes/dataRoutes.js';
import { downloadCSV } from './src/routes/dataRoutes.js';
import { handleFileUpload } from './src/routes/dataRoutes.js';
import { mergeUserData } from './src/routes/dataRoutes.js';
import { calculateDataSize } from './src/routes/dataRoutes.js';
import { formatBytes } from './src/routes/dataRoutes.js';
import { setProStatus } from './src/routes/adminRoutes.js';
import { grantProByEmail } from './src/routes/adminRoutes.js';
import { refreshAdminUserList } from './src/routes/adminRoutes.js';
import { revokeProWhitelist } from './src/routes/adminRoutes.js';
import { openAdminDashboard } from './src/routes/adminRoutes.js';

// --- Global App State ---
export let state = createInitialState();

// --- State Management ---
export function setState(newState) {
    state = { ...state, ...newState };
    if (newState.yearlyData || newState.leaveTypes) {
        updateLeaveData(state.yearlyData, state.leaveTypes);
    }
}

// --- DOM Element References ---
export let DOM = {};

// --- Utilities ---
// Imported from services/utils.js

// --- UI Functions ---




const faSpinner = '<i class="fas fa-spinner fa-spin text-xl"></i>';


export let transitionState = {
    active: false,
    timeoutId: null,
    element: null,
    handler: null
};





















// --- Storage Usage Indicator ---











































// --- CSV Restore/Backup ---










































// --- Easter Egg Functions ---







// --- Leave Management ---














































// --- Team Management Functions ---










































// --- OPTIMIZATION: Event Delegation Setup for Daily View ---


// --- Search Functionality (Spotlight) ---












// --- Event Listener Setup ---










// Helper to call backend for granting pro to email








// --- App Initialization ---






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


window.renderAdminUserList = renderAdminUserList; window.openAdminDashboard = openAdminDashboard;

// Helper to call backend for revoking pro whitelist


async function subscribeToAppConfig() {
    await loadFirebaseModules();
    const configRef = doc(db, COLLECTIONS.CONFIG, COLLECTIONS.APP_CONFIG);

    // Feature: Disable real-time updates for now
    // onSnapshot(configRef, (doc) => { ... });

    try {
        const docSnapshot = await getDoc(configRef);
        if (docSnapshot.exists()) {
             const data = docSnapshot.data();
             setState({ superAdmins: data.superAdmins || [] });
        } else {
             setState({ superAdmins: [] });
        }
        renderAdminButton();
        renderTeamSection(); // Re-render team section as pro status depends on super admin check
    } catch (error) {
        Logger.warn("Could not fetch app config (likely permission issue or missing doc):", error);
    }
}

// --- TOG Tracker Integration ---











window.openSharedMonthPicker = function(initialDate, callback) {
    state.pickerYear = initialDate.getFullYear();
    state.pickerCallback = callback;
    renderMonthPicker();
    DOM.monthPickerModal.classList.add('visible');
}



async function toggleRealTimeUpdates(enabled) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.REAL_TIME_UPDATES, enabled);

    // Update both buttons if they exist
    ['real-time-toggle-btn-tb', 'real-time-toggle-btn-tog'].forEach(id => {
        const toggleBtn = document.getElementById(id);
        if (toggleBtn) {
            const knob = toggleBtn.querySelector('.toggle-knob');
            if (enabled) {
                toggleBtn.classList.remove('bg-gray-200');
                toggleBtn.classList.add('bg-blue-500');
                knob.classList.add('translate-x-5');
                knob.classList.add('rtl:-translate-x-5');
            } else {
                toggleBtn.classList.remove('bg-blue-500');
                toggleBtn.classList.add('bg-gray-200');
                knob.classList.remove('translate-x-5');
                knob.classList.remove('rtl:-translate-x-5');
            }
        }
    });

    if (enabled) {
        try {
            await enableNetwork(db);
            showMessage(i18n.t('landing.realTimeEnabled') || "Real-time updates enabled", 'success');
        } catch (e) {
            Logger.error("Error enabling network:", e);
            showMessage(i18n.t("messages.error") || "Error", 'error');
        }
    } else {
        try {
            await disableNetwork(db);
            showMessage(i18n.t('landing.realTimeDisabled') || "Real-time updates disabled", 'success');
        } catch (e) {
            Logger.error("Error disabling network:", e);
            showMessage(i18n.t("messages.error") || "Error", 'error');
        }
    }
    updateSyncUI();
}

async function performSync() {
    ['tb-sync-now-btn', 'tog-sync-now-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            btn.disabled = true;
        }
    });

    try {
        await enableNetwork(db);
        await waitForPendingWrites(db);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const now = new Date();
        localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_SYNC_TIME, now.toISOString());

        await disableNetwork(db);
        showMessage(i18n.t('landing.syncSuccess') || "Synced successfully", 'success');
    } catch (e) {
        Logger.error("Sync failed:", e);
        showMessage(i18n.t('landing.syncFailed') || "Sync failed", 'error');
    } finally {
        ['tb-sync-now-btn', 'tog-sync-now-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                const icon = btn.querySelector('i');
                if (icon) icon.classList.remove('fa-spin');
                btn.disabled = false;
            }
        });
        updateSyncUI();
    }
}













window.showAppMessage = showMessage;
window.appSignOut = appSignOut;
window.renderAdminUserList = renderAdminUserList;
window.openAdminDashboard = openAdminDashboard;
