import { LOCAL_STORAGE_KEYS } from '../config/constants.js';

// ==========================================
// WELCOME SCREEN / NEWS BOARD CONFIGURATION
// ==========================================

// Update this version string (e.g., 'v2', 'v3') whenever you change the content below
// and want to force all users (even existing ones) to see the new messages.
export const WELCOME_VERSION = 'v1';

// The content to display on the Welcome Screen.
// You can use standard i18n translation keys using the 'i18n' property,
// or provide raw HTML strings via the 'html' property for quick un-translated announcements.
export const WELCOME_CONTENT = [
    {
        icon: "fas fa-check-circle text-blue-400 mt-1 me-3 flex-shrink-0",
        i18n: "landing.infoLogActivities",
        fallback: "<strong>Effortlessly log daily activities</strong>, track work hours, and manage custom leave balances."
    },
    {
        icon: "fas fa-file-csv text-blue-400 mt-1 me-3 flex-shrink-0",
        i18n: "landing.infoRestoreBackup",
        fallback: "<strong>Seamlessly restore and backup</strong> your data to CSV for reports and backups."
    },
    {
        icon: "fas fa-user-check text-blue-400 mt-1 me-3 flex-shrink-0",
        i18n: "landing.infoGuestOrSync",
        fallback: "<strong>Get started instantly</strong> as a Guest, or sign in to sync your data across devices."
    },
    {
        icon: "fas fa-cloud-upload-alt text-blue-400 mt-1 me-3 flex-shrink-0",
        i18n: "landing.infoSecureSync",
        fallback: "<strong>Cloud sync.</strong> Highly secure and only you can access your data."
    }
    // Example of adding a quick custom un-translated message:
    // {
    //     icon: "fas fa-bullhorn text-yellow-400 mt-1 me-3 flex-shrink-0",
    //     html: "<strong>New Feature!</strong> We just launched dark mode in v2!"
    // }
];

export function hasSeenWelcomeScreen() {
    return localStorage.getItem('welcomeScreenVersion') === WELCOME_VERSION;
}

function renderWelcomeContent(DOM) {
    const listContainer = document.getElementById('welcome-features-list');
    if (!listContainer) return;

    // Clear existing
    listContainer.innerHTML = '';

    // Inject the configured items
    WELCOME_CONTENT.forEach(item => {
        const li = document.createElement('li');
        li.className = "flex items-start";

        const icon = document.createElement('i');
        icon.className = item.icon;

        const span = document.createElement('span');
        if (item.i18n) {
            span.setAttribute('data-i18n', item.i18n);
        }
        span.innerHTML = item.html || item.fallback || "";

        li.appendChild(icon);
        li.appendChild(span);
        listContainer.appendChild(li);
    });
}

export function showWelcomeScreen(DOM, switchView, setupSplashTapListener, pendingUser) {
    // Render the dynamically configured HTML into the view first
    renderWelcomeContent(DOM);

    // Temporarily store the pending auth state so "Get Started" knows where to go
    window._pendingAuthUser = pendingUser;

    // Trigger fade in class for smooth entry
    DOM.welcomeView.classList.replace('opacity-0', 'opacity-100');
    switchView(DOM.welcomeView, DOM.loadingView);
    setupSplashTapListener();
    DOM.contentWrapper.style.opacity = '1';
    DOM.footer.style.opacity = '1';
}

export function setupWelcomeScreenListener(DOM, switchView, handleUserLogin, loadOfflineData) {
    DOM.welcomeGetStartedBtn?.addEventListener('click', () => {
        localStorage.setItem('welcomeScreenVersion', WELCOME_VERSION);

        // Ensure legacy flag is set so we don't accidentally fall back
        localStorage.setItem('hasVisitedBefore', 'true');

        // "Keynote-style" fluid 3D transform exit animation
        const welcomeContainer = DOM.welcomeView.querySelector('.login-container');

        // Prepare the container for 3D transforms
        DOM.welcomeView.style.perspective = "1000px";
        DOM.contentWrapper.style.perspective = "1000px";

        // Apply smooth transition properties
        welcomeContainer.style.transition = 'all 0.8s cubic-bezier(0.25, 1, 0.5, 1)';

        // Animate out: scale down, fade, and slightly rotate
        requestAnimationFrame(() => {
            welcomeContainer.style.transform = 'translateZ(-200px) translateY(-50px) scale(0.9)';
            welcomeContainer.style.opacity = '0';
            DOM.welcomeView.style.opacity = '0';
        });

        setTimeout(() => {
            // Clean up inline styles before switching
            welcomeContainer.style.transform = '';
            welcomeContainer.style.opacity = '';
            welcomeContainer.style.transition = '';
            DOM.welcomeView.style.perspective = "";
            DOM.contentWrapper.style.perspective = "";

            // Figure out where to route the user
            const pendingUser = window._pendingAuthUser;
            const sessionMode = localStorage.getItem(LOCAL_STORAGE_KEYS.SESSION_MODE);

            if (pendingUser) {
                // Return to their active logged-in session seamlessly
                switchView(DOM.loadingView, DOM.welcomeView);
                handleUserLogin(pendingUser);
                window._pendingAuthUser = null;
            } else if (sessionMode === 'offline') {
                // Return to their active offline session seamlessly
                switchView(DOM.loadingView, DOM.welcomeView);
                loadOfflineData();
            } else {
                // Totally new or logged-out user: proceed to Login View
                switchView(DOM.loginView, DOM.welcomeView);

                // Animate Login view in
                const loginContainer = DOM.loginView.querySelector('.login-container');
                if (loginContainer) {
                    // Start Login state
                    loginContainer.style.transition = 'none';
                    loginContainer.style.transform = 'translateZ(100px) translateY(50px) scale(1.05)';
                    loginContainer.style.opacity = '0';

                    // Allow DOM to register the start state, then animate
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            loginContainer.style.transition = 'all 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
                            loginContainer.style.transform = 'translateZ(0) translateY(0) scale(1)';
                            loginContainer.style.opacity = '1';

                            // Cleanup after enter
                            setTimeout(() => {
                                loginContainer.style.transition = '';
                                loginContainer.style.transform = '';
                                loginContainer.style.opacity = '';
                            }, 800);
                        });
                    });
                }
            }
        }, 600);
    });
}
