import { auth, db, updateDoc, serverTimestamp, getFunctionsInstance, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, disableNetwork } from '../config/firebase.js';
import { COLLECTIONS, LOCAL_STORAGE_KEYS } from '../config/constants.js';
import { state, setState, DOM, i18n } from '../../app.js';
import { switchView, showMessage, setButtonLoadingState, setInputErrorState, restoreLastView, setupTbUserMenu, setupSplashTapListener } from './uiRoutes.js';
import { triggerTeamSync, cleanupTeamSubscriptions } from './teamRoutes.js';
import { hasSeenWelcomeScreen, showWelcomeScreen, setupWelcomeScreenListener } from '../models/welcome.js';
import { mergeUserData, persistData, loadOfflineData, subscribeToData } from './dataRoutes.js';
import { Logger } from '../utils/logger.js';

export async function handleUserLogin(user) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.SESSION_MODE, 'online');
    if (state.unsubscribeFromFirestore) {
        state.unsubscribeFromFirestore();
    }
    cleanupTeamSubscriptions();

    setState({ userId: user.uid, isOnlineMode: true });
    DOM.userIdDisplay.textContent = i18n.t('dashboard.userIdPrefix') + user.uid;

    switchView(DOM.loadingView, DOM.loginView);

    // Update lastSeen
    try {
        await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), {
            lastSeen: serverTimestamp()
        });
    } catch (e) {
        // Silent fail or log if needed
    }

    // Now, with the user document guaranteed to exist, subscribe to data.
    subscribeToData(user.uid, async () => {
        const realTimeEnabled = localStorage.getItem(LOCAL_STORAGE_KEYS.REAL_TIME_UPDATES) !== 'false';
        if (!realTimeEnabled) {
            setTimeout(async () => {
                const currentPref = localStorage.getItem(LOCAL_STORAGE_KEYS.REAL_TIME_UPDATES) !== 'false';
                if (!currentPref) {
                    try {
                        await disableNetwork(db);
                        updateSyncUI();
                    } catch (e) {
                        Logger.error("Failed to disable network on login", e);
                    }
                }
            }, 2000);
        } else {
            updateSyncUI();
        }

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
        restoreLastView(DOM.loadingView);
        // Toggle Nav Button
        DOM.navTogBtn.classList.remove('hidden');
    });
}

export async function signUpWithEmail(email, password) {
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

export async function signInWithEmail(email, password) {
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

export async function signInWithGoogle() {
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

export async function resetPassword(email) {
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

export async function appSignOut() {
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

export function handleUserLogout() {
    if (state.unsubscribeFromFirestore) {
        state.unsubscribeFromFirestore();
    }

    // Clean up team subscriptions
    cleanupTeamSubscriptions();

    localStorage.removeItem(LOCAL_STORAGE_KEYS.SESSION_MODE);

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

export function performLogoutCleanup() {
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

export async function initAuth() {
    await loadFirebaseModules();
    onAuthStateChanged(auth, (user) => {
        // If the user hasn't seen the current version of the Welcome Screen, intercept the flow
        if (!hasSeenWelcomeScreen()) {
            showWelcomeScreen(DOM, switchView, setupSplashTapListener, user);
            return;
        }

        // Standard Flow (User has seen the Welcome Screen)
        if (user) {
            // User is logged in: Proceed to login flow (which shows spinner -> app)
            // Splash screen remains up (z-index 100) showing loading spinner until app is ready.
            handleUserLogin(user);
        } else {
            if (state.isLoggingOut) {
                // Let handleUserLogout manage the transition to avoid glitches
                return;
            }
            const sessionMode = localStorage.getItem(LOCAL_STORAGE_KEYS.SESSION_MODE);
            if (sessionMode === 'offline') {
                loadOfflineData(); // Centralized offline data loading
            } else {
                // User not logged in: Prepare Login View (behind splash)
                switchView(DOM.loginView, DOM.loadingView);
                // Enable "Tap to Begin" interaction on Splash Screen
                setupSplashTapListener();
            }
        }
        DOM.contentWrapper.style.opacity = '1';
        DOM.footer.style.opacity = '1';
    });
}
