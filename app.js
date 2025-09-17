// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, updateDoc, getDoc, writeBatch, addDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";// --- Firebase Configuration ---
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js";

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
    OWNER: 'owner',
    MEMBER: 'member'
};

// --- Global App State ---
let state = {
    currentMonth: new Date(),
    selectedDate: new Date(),
    currentView: VIEW_MODES.MONTH,
    allStoredData: {},
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
    unsubscribeFromTeamMembers: []
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

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
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
        // Team Management DOM References
        teamToggleBtn: document.getElementById('team-toggle-btn'),
        teamSection: document.getElementById('team-section'),
        teamArrowDown: document.getElementById('team-arrow-down'),
        teamArrowUp: document.getElementById('team-arrow-up'),
        createTeamModal: document.getElementById('create-team-modal'),
        teamNameInput: document.getElementById('team-name-input'),
        teamOwnerDisplayNameInput: document.getElementById('team-owner-display-name-input'),
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
        kickModalText: document.getElementById('kick-modal-text')
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
    }
    else if (viewToShow === DOM.appView) {
        loadTheme();
        if (DOM.splashScreen) DOM.splashScreen.style.display = 'none';
    }

    if (viewToHide) {
        viewToHide.style.opacity = '0';
    }

    setTimeout(() => {
        if (viewToHide) {
            viewToHide.classList.add('hidden');
        }

        if (viewToShow === DOM.appView) {
            mainContainer.classList.add('is-app-view');
        } else {
            mainContainer.classList.remove('is-app-view');
        }
        viewToShow.classList.remove('hidden');

        setTimeout(() => {
            viewToShow.style.opacity = '1';
            if (callback) callback();
        }, 20);
    }, 0);
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

    // --- START OF THE FIX ---
    // Ensure a user document exists before subscribing to data
    const userDocRef = doc(db, "users", user.uid);
    try {
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
            // Document doesn't exist, so create it with default values.
            // This is crucial for new users.
            await setDoc(userDocRef, {
                activities: {},
                leaveTypes: [],
                teamId: null,
                teamRole: null
            });
            console.log("New user document created in Firestore.");
        }
    } catch (error) {
        console.error("Error ensuring user document exists:", error);
        showMessage("There was a problem setting up your account.", "error");
        // Optional: Handle this error more gracefully, e.g., by logging the user out.
        return;
    }
    // --- END OF THE FIX ---

    // Now, with the user document guaranteed to exist, subscribe to data.
    subscribeToData(user.uid, () => {
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
    DOM.monthViewBottomControls.classList.toggle('hidden', !isMonthView);
    DOM.todayBtnDay.classList.toggle('hidden', isMonthView);
    DOM.dayViewBottomControls.classList.toggle('hidden', isMonthView)

    if (isMonthView) {
        DOM.currentPeriodDisplay.textContent = state.currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
    while (DOM.calendarView.children.length > 7) DOM.calendarView.removeChild(DOM.calendarView.lastChild);

    const year = state.currentMonth.getFullYear();
    const month = state.currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const today = new Date();

    for (let i = 0; i < firstDayOfMonth.getDay(); i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day-cell other-month';
        emptyCell.innerHTML = '<div class="calendar-day-content"></div>';
        DOM.calendarView.appendChild(emptyCell);
    }

    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const date = new Date(year, month, day);
        const dateKey = getYYYYMMDD(date);
        const dayData = state.allStoredData[dateKey] || {};
        const noteText = dayData.note || '';
        const hasActivity = Object.keys(dayData).some(key => key !== '_userCleared' && key !== 'note' && key !== 'leave' && dayData[key].text?.trim());
        const leaveData = dayData.leave;

        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day-cell current-month';
        if (date.getDay() === 0) dayCell.classList.add('is-sunday');
        if (hasActivity) dayCell.classList.add('has-activity');
        if (getYYYYMMDD(date) === getYYYYMMDD(today)) dayCell.classList.add('is-today');
        if (getYYYYMMDD(date) === getYYYYMMDD(state.selectedDate) && state.currentView === VIEW_MODES.DAY) dayCell.classList.add('selected-day');
        if (state.isLoggingLeave && state.leaveSelection.has(dateKey)) dayCell.classList.add('leave-selecting');

        let leaveIndicatorHTML = '';
        if(leaveData) {
            const leaveType = state.leaveTypes.find(lt => lt.id === leaveData.typeId);
            if(leaveType) {
                leaveIndicatorHTML = `<div class="leave-indicator ${leaveData.dayType}-day" style="background-color: ${leaveType.color};"></div>`;
            }
        }

        dayCell.innerHTML = `
            ${leaveIndicatorHTML}
            <div class="calendar-day-content">
                <div class="day-number">${day}</div>
                <div class="day-note-container">${noteText ? `<span class="day-note">${sanitizeHTML(noteText)}</span>` : ''}</div>
                ${hasActivity ? '<div class="activity-indicator"></div>' : ''}
            </div>`;
        dayCell.dataset.date = dateKey;

        const dayNumberEl = dayCell.querySelector('.day-number');
        const dayNoteEl = dayCell.querySelector('.day-note');

        if (leaveData && leaveData.dayType === LEAVE_DAY_TYPES.FULL) {
            dayNumberEl.style.color = 'white';
            if (dayNoteEl) dayNoteEl.style.color = 'white';
        }
        if (date.getDay() === 0) {
            dayNumberEl.style.color = '#ef4444';
        }

        DOM.calendarView.appendChild(dayCell);
    }

    const totalCells = firstDayOfMonth.getDay() + lastDayOfMonth.getDate();
    for (let i = 0; i < (7 - (totalCells % 7)) % 7; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day-cell other-month';
        emptyCell.innerHTML = '<div class="calendar-day-content"></div>';
        DOM.calendarView.appendChild(emptyCell);
    }
}

function renderDailyActivities() {
    DOM.dailyActivityTableBody.innerHTML = '';
    const dateKey = getYYYYMMDD(state.selectedDate);
    const dailyActivitiesMap = state.allStoredData[dateKey] || {};
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

    dailyActivitiesArray.forEach((activity, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-100 transition-colors duration-150';
        row.dataset.time = activity.time;

        const isFirst = index === 0;
        const isLast = index === dailyActivitiesArray.length - 1;

        row.innerHTML = `
            <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-900 cursor-text time-editable" data-time="${activity.time}" contenteditable="true">${activity.time}</td>
            <td class="py-3 px-4 text-sm text-gray-900">
                <div class="activity-text-editable" data-time="${activity.time}" contenteditable="true">${formatTextForDisplay(activity.text)}</div>
            </td>
            <td class="py-3 px-4 text-sm flex space-x-1 justify-center items-center">
                <button class="icon-btn move-up-btn" aria-label="Move Up" ${isFirst ? 'disabled' : ''}>
                    <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                </button>
                <button class="icon-btn move-down-btn" aria-label="Move Down" ${isLast ? 'disabled' : ''}>
                    <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <button class="icon-btn delete-btn delete" aria-label="Delete">
                    <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>`;
        DOM.dailyActivityTableBody.appendChild(row);
    });
}

function renderMonthPicker() {
    DOM.monthGrid.innerHTML = '';
    DOM.pickerYearDisplay.textContent = state.pickerYear;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    monthNames.forEach((name, index) => {
        const button = document.createElement('button');
        button.className = 'px-4 py-3 rounded-lg font-medium text-gray-800 bg-gray-100 hover:bg-blue-100 hover:text-blue-700';
        button.textContent = name;
        if (state.pickerYear === state.currentMonth.getFullYear() && index === state.currentMonth.getMonth()) {
            button.classList.add('bg-blue-500', 'text-white');
            button.classList.remove('bg-gray-100', 'text-gray-800');
        }
        button.addEventListener('click', () => {
            const newMonth = new Date(state.pickerYear, index, 1);
            const lastDayOfNewMonth = new Date(state.pickerYear, index + 1, 0).getDate();
            let newSelectedDate = new Date(state.selectedDate);
            if (newSelectedDate.getDate() > lastDayOfNewMonth) {
                newSelectedDate.setDate(lastDayOfNewMonth);
            }
            newSelectedDate.setMonth(index);
            newSelectedDate.setFullYear(state.pickerYear);

            setState({ currentMonth: newMonth, selectedDate: newSelectedDate });
            updateView();
            DOM.monthPickerModal.classList.remove('visible');
        });
        DOM.monthGrid.appendChild(button);
    });
}

function getYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateForDisplay(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTextForDisplay(text) {
    const tempDiv = document.createElement('div');
    tempDiv.textContent = text || '';
    return tempDiv.innerHTML.replace(/\n/g, '<br>');
}

async function subscribeToData(userId, callback) {
    const userDocRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
        const data = doc.exists() ? doc.data() : {};
        setState({ 
            allStoredData: data.activities || {}, 
            leaveTypes: data.leaveTypes || [],
            currentTeam: data.teamId || null,
            teamRole: data.teamRole || null
        });

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

            // If user is owner, load all member data for the dashboard
            if (state.teamRole === TEAM_ROLES.OWNER) {
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
        showMessage("Could not load real-time team member data.", "error");
    });

    setState({ unsubscribeFromTeamMembers: [unsubscribe] });
}

function cleanupTeamSubscriptions() {
    if (state.unsubscribeFromTeam) {
        state.unsubscribeFromTeam();
        setState({ unsubscribeFromTeam: null });
    }
    
    state.unsubscribeFromTeamMembers.forEach(unsub => unsub());
    setState({ unsubscribeFromTeamMembers: [] });
}

async function saveData(action) {
    const dateKey = getYYYYMMDD(state.selectedDate);
    const dayDataCopy = { ...(state.allStoredData[dateKey] || {}) };
    let successMessage = null;

    const isNewDay = !state.allStoredData[dateKey] || (Object.keys(dayDataCopy).length === 0 && !dayDataCopy._userCleared);

    if (isNewDay && (action.type === ACTION_TYPES.ADD_SLOT || action.type === ACTION_TYPES.UPDATE_ACTIVITY_TEXT)) {
        if (state.selectedDate.getDay() !== 0) {
            for (let h = 8; h <= 17; h++) {
                const timeKey = `${String(h).padStart(2, '0')}:00-${String(h + 1).padStart(2, '0')}:00`;
                dayDataCopy[timeKey] = { text: "", order: h - 8 };
            }
        }
    }

    switch (action.type) {
        case ACTION_TYPES.SAVE_NOTE: {
            if (action.payload) {
                dayDataCopy.note = action.payload;
            } else {
                delete dayDataCopy.note;
            }
            break;
        }
        case ACTION_TYPES.ADD_SLOT: {
            let newTimeKey = "00:00", counter = 0;
            while (dayDataCopy[newTimeKey]) {
                newTimeKey = `00:00-${++counter}`;
            }
            const existingKeys = Object.keys(dayDataCopy).filter(k => k !== '_userCleared' && k !== 'note' && k !== 'leave');
            const maxOrder = existingKeys.length > 0 ? Math.max(...Object.values(dayDataCopy).filter(v => typeof v === 'object').map(v => v.order || 0)) : -1;
            dayDataCopy[newTimeKey] = { text: "", order: maxOrder + 1 };
            delete dayDataCopy._userCleared;
            successMessage = "New slot added!";
            break;
        }
        case ACTION_TYPES.UPDATE_ACTIVITY_TEXT: {
            if (dayDataCopy[action.payload.timeKey]) {
                dayDataCopy[action.payload.timeKey].text = action.payload.newText;
            } else {
                const order = Object.keys(dayDataCopy).filter(k => k !== '_userCleared' && k !== 'note' && k !== 'leave').length;
                dayDataCopy[action.payload.timeKey] = { text: action.payload.newText, order };
            }
            delete dayDataCopy._userCleared;
            successMessage = "Activity updated!";
            break;
        }
        case ACTION_TYPES.UPDATE_TIME: {
            const { oldTimeKey, newTimeKey } = action.payload;
            if (!newTimeKey) {
                showMessage("Time cannot be empty.", 'error');
                return;
            }
            if (dayDataCopy[newTimeKey] && oldTimeKey !== newTimeKey) {
                showMessage(`Time "${newTimeKey}" already exists.`, 'error');
                return;
            }
            const entry = dayDataCopy[oldTimeKey];
            if (entry) {
                delete dayDataCopy[oldTimeKey];
                dayDataCopy[newTimeKey] = entry;
            }
            successMessage = "Time updated!";
            break;
        }
    }

    const updatedData = {
        ...state.allStoredData,
        [dateKey]: dayDataCopy
    };

    if (state.isOnlineMode && state.userId) {
        await saveDataToFirestore({ 
            activities: updatedData, 
            leaveTypes: state.leaveTypes
        });
    } else {
        saveDataToLocalStorage({ activities: updatedData, leaveTypes: state.leaveTypes });
        setState({ allStoredData: updatedData });
        updateView();
    }

    if (successMessage) {
        showMessage(successMessage, 'success');
    }
}

function loadDataFromLocalStorage() {
    try {
        const storedDataString = localStorage.getItem('activityTrackerData');
        if (!storedDataString) {
            return { activities: {}, leaveTypes: [] };
        }

        const storedData = JSON.parse(storedDataString);

        // Backwards compatibility for old data structure
        if (storedData.hasOwnProperty('activities')) {
            return storedData;
        } else {
            return { activities: storedData, leaveTypes: [] };
        }
    } catch (error) {
        console.error("Error loading local data:", error);
        showMessage("Could not load local data.", 'error');
        return { activities: {}, leaveTypes: [] };
    }
}

function saveDataToLocalStorage(data) {
    try {
        localStorage.setItem('activityTrackerData', JSON.stringify(data));
    } catch (error) {
        console.error("Error saving local data:", error);
        showMessage("Could not save data locally.", 'error');
    }
}

async function saveDataToFirestore(data) {
    if (!state.userId) return;
    try {
        await setDoc(doc(db, "users", state.userId), data, { merge: true });
    } catch (error) {
        console.error("Error saving to Firestore:", error);
        showMessage("Error: Could not save data to the cloud.", 'error');
    }
}

function loadOfflineData() {
    localStorage.setItem('sessionMode', 'offline');
    const data = loadDataFromLocalStorage();
    setState({ allStoredData: data.activities, leaveTypes: data.leaveTypes, isOnlineMode: false, userId: null });

    // Switch directly to app view
    switchView(DOM.appView, DOM.loginView, updateView);
}

async function resetAllData() {
    const button = DOM.confirmResetModal.querySelector('#confirm-reset-btn');
    setButtonLoadingState(button, true);
    await new Promise(resolve => setTimeout(resolve, 50));

    if (state.isOnlineMode && state.userId) {
        try {
            await deleteDoc(doc(db, "users", state.userId));
            showMessage("All cloud data has been reset.", 'success');
        } catch (error) {
            showMessage("Failed to reset cloud data.", 'error');
        }
    } else {
        localStorage.removeItem('activityTrackerData');
        setState({ allStoredData: {}, leaveTypes: [] });
        updateView();
        showMessage("All local data has been reset.", 'success');
    }
    DOM.confirmResetModal.classList.remove('visible');
    setButtonLoadingState(button, false);
}

function updateActivityOrder() {
    const dateKey = getYYYYMMDD(state.selectedDate);
    const dayData = state.allStoredData[dateKey] || {};
    const orderedTimeKeys = Array.from(DOM.dailyActivityTableBody.children).map(row => row.dataset.time);

    const newDayData = {};
    if (dayData.note) newDayData.note = dayData.note;
    if (dayData.leave) newDayData.leave = dayData.leave;

    orderedTimeKeys.forEach((timeKey, index) => {
        const originalEntry = dayData[timeKey] || { text: '' };
        newDayData[timeKey] = { text: originalEntry.text, order: index };
    });

    if (dayData._userCleared) newDayData._userCleared = true;

    const updatedData = { ...state.allStoredData, [dateKey]: newDayData };

    if (state.isOnlineMode && state.userId) {
        saveDataToFirestore({ 
            activities: updatedData, 
            leaveTypes: state.leaveTypes
        });
    } else {
        saveDataToLocalStorage({ activities: updatedData, leaveTypes: state.leaveTypes });
        setState({ allStoredData: updatedData });
    }
    showMessage("Activities reordered!", 'success');
}

function deleteActivity(dateKey, timeKey) {
    const dayData = state.allStoredData[dateKey];
    if (!dayData || !dayData[timeKey]) return;

    const dayDataCopy = { ...dayData };
    delete dayDataCopy[timeKey];

    if (Object.keys(dayDataCopy).filter(k => k !== '_userCleared' && k !== 'note' && k !== 'leave').length === 0) {
        dayDataCopy._userCleared = true;
    }

    const dataCopy = { ...state.allStoredData, [dateKey]: dayDataCopy };

    if (state.isOnlineMode && state.userId) {
        saveDataToFirestore({ 
            activities: dataCopy, 
            leaveTypes: state.leaveTypes
        });
    } else {
        saveDataToLocalStorage({ activities: dataCopy, leaveTypes: state.leaveTypes });
        setState({ allStoredData: dataCopy });
        updateView();
    }
    showMessage("Activity deleted.", 'success');
}

// --- CSV Import/Export ---
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

    // Export Leave Types
    state.leaveTypes.forEach(lt => {
        csvRows.push(["LEAVE_TYPE", lt.id, lt.name, lt.totalDays, lt.color]);
    });

    const sortedDateKeys = Object.keys(state.allStoredData).sort();

    sortedDateKeys.forEach(dateKey => {
        const dayData = state.allStoredData[dateKey];

        // Export Note
        if (dayData.note) {
            csvRows.push(["NOTE", dateKey, dayData.note, "", ""]);
        }

        // Export Leave
        if (dayData.leave) {
            csvRows.push(["LEAVE", dateKey, dayData.leave.typeId, dayData.leave.dayType, ""]);
        }

        // Export User Cleared Flag
        if (dayData._userCleared) {
            csvRows.push(["USER_CLEARED", dateKey, "", "", ""]);
        }

        // Export Activities
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
        return showMessage("No data found to export.", 'info');
    }

    const csvString = csvRows.map(row => row.map(escapeCsvField).join(",")).join("\n");

    const link = document.createElement("a");
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvString);
    link.download = `TrackerBuddy_Export_${getYYYYMMDD(new Date())}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // Skip the next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const csvContent = e.target.result;

            const dataCopy = { ...state.allStoredData };
            const leaveTypesMap = new Map(state.leaveTypes.map(lt => [lt.id, { ...lt }]));

            const lines = csvContent.split('\n').filter(line => line.trim());

            if (lines.length <= 1) {
                return showMessage("CSV file is empty or has no data.", 'error');
            }

            let processedRows = 0;
            lines.slice(1).forEach(line => {
                const row = parseCsvLine(line.trim());
                if (row.length < 2) return;

                const [type, detail1, detail2, detail3, detail4] = row;
                let rowProcessed = false;

                switch (type.toUpperCase()) {
                    case 'LEAVE_TYPE':
                        if (detail1 && detail2 && detail3 && detail4) { // Basic validation
                            leaveTypesMap.set(detail1, {
                                id: detail1,
                                name: detail2,
                                totalDays: parseFloat(detail3) || 0,
                                color: detail4
                            });
                            rowProcessed = true;
                        }
                        break;

                    case 'NOTE':
                    case 'LEAVE':
                    case 'ACTIVITY':
                    case 'USER_CLEARED':
                        const dateKey = detail1;
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
                            console.warn(`Skipping row with invalid date format: ${line}`);
                            return;
                        }
                        if (!dataCopy[dateKey]) dataCopy[dateKey] = {};
                        else dataCopy[dateKey] = { ...dataCopy[dateKey] };

                        if (type.toUpperCase() === 'NOTE') {
                            dataCopy[dateKey].note = detail2;
                            rowProcessed = true;
                        } else if (type.toUpperCase() === 'LEAVE') {
                            dataCopy[dateKey].leave = {
                                typeId: detail2,
                                dayType: (detail3 === LEAVE_DAY_TYPES.HALF || detail3 === LEAVE_DAY_TYPES.FULL) ? detail3 : LEAVE_DAY_TYPES.FULL
                            };
                            rowProcessed = true;
                        } else if (type.toUpperCase() === 'ACTIVITY') {
                            const time = detail2;
                            const text = detail3;
                            const order = parseInt(detail4, 10);
                            if (time) {
                                dataCopy[dateKey][time] = { text: text || "", order: isNaN(order) ? 0 : order };
                                rowProcessed = true;
                            }
                        } else if (type.toUpperCase() === 'USER_CLEARED') {
                            dataCopy[dateKey]._userCleared = true;
                            rowProcessed = true;
                        }
                        break;
                }
                if (rowProcessed) processedRows++;
            });

            const finalLeaveTypes = Array.from(leaveTypesMap.values());

            setState({ leaveTypes: finalLeaveTypes, allStoredData: dataCopy });

            if (state.isOnlineMode && state.userId) {
                await saveDataToFirestore({ 
                    activities: dataCopy, 
                    leaveTypes: finalLeaveTypes
                });
            } else {
                saveDataToLocalStorage({ activities: dataCopy, leaveTypes: finalLeaveTypes });
                updateView();
            }

            showMessage(`${processedRows} records imported/updated successfully!`, 'success');
            event.target.value = '';
        } catch(err) {
            console.error("Error during CSV import:", err);
            showMessage("An error occurred while importing the file.", 'error');
        }
    };
    reader.onerror = () => showMessage("Error reading file.", 'error');
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
        allStoredData: {},
        leaveTypes: [],
        userId: null,
        isOnlineMode: false,
        unsubscribeFromFirestore: null,
        logoTapCount: 0, // Reset easter egg counter
        // Reset team state
        currentTeam: null,
        teamName: null,
        teamRole: null,
        teamMembers: [],
        teamMembersData: {},
        unsubscribeFromTeam: null,
        unsubscribeFromTeamMembers: []
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
                const data = loadDataFromLocalStorage();
                setState({ allStoredData: data.activities, leaveTypes: data.leaveTypes, isOnlineMode: false, userId: null });
                document.querySelector('.main-container').classList.add('is-app-view');
                switchView(DOM.appView, DOM.loadingView, updateView);
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
        return showMessage("Email and a password of at least 6 characters are required.", 'error');
    }

    setButtonLoadingState(button, true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        handleUserLogin(userCredential.user);
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            showMessage("An account already exists with this email. Please sign in instead.", 'error');
        } else {
            showMessage(`Sign-up failed: ${error.message}`, 'error');
        }
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function editTeamName() {
    const button = DOM.editTeamNameModal.querySelector('#save-edit-team-name-btn');
    const newTeamName = DOM.newTeamNameInput.value.trim();

    if (!newTeamName) {
        showMessage('Please enter a team name.', 'error');
        return;
    }

    setButtonLoadingState(button, true);
    try {
        const editTeamNameCallable = httpsCallable(functions, 'editTeamName');
        await editTeamNameCallable({ newTeamName: newTeamName, teamId: state.currentTeam });
        showMessage('Team name updated successfully!', 'success');
        closeEditTeamNameModal();
    } catch (error) {
        console.error('Error updating team name:', error);
        showMessage(`Failed to update team name: ${error.message}`, 'error');
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
        return showMessage("Email and password are required.", 'error');
    }

    setButtonLoadingState(button, true);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        handleUserLogin(userCredential.user);
    } catch (error) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            showMessage("Incorrect email or password. Please try again.", 'error');
        } else {
            showMessage(`Sign-in failed: ${error.message}`, 'error');
        }
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function resetPassword(email) {
    const button = DOM.forgotPasswordBtn;
    if (!email) {
        setInputErrorState(document.getElementById('email-input'), true);
        return showMessage("Please enter your email address.", 'info');
    }
    setButtonLoadingState(button, true);
    button.classList.add('loading');
    try {
        await sendPasswordResetEmail(auth, email);
        showMessage("Please check your SPAM folder for the password reset link.", 'success');
    } catch (error) {
        showMessage(`Error sending reset email: ${error.message}`, 'error');
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
        showMessage(`Google sign-in failed: ${error.message}`, 'error');
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
            showMessage(`Sign-out failed: ${error.message}`, 'error');
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

function setupDoubleClickConfirm(element, actionKey, message, callback) {
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
            showMessage(message, 'info');
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
            saveData({ type: ACTION_TYPES.UPDATE_TIME, payload: { oldTimeKey: target.dataset.time, newTimeKey: target.innerText.trim() } });
        } else {
            saveData({ type: ACTION_TYPES.UPDATE_ACTIVITY_TEXT, payload: { timeKey: target.dataset.time, newText: target.innerText.trim() } });
        }
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

    const track = document.createElement('track');
    track.kind = 'captions';
    track.label = 'English';
    track.srclang = 'en';
    track.src = 'assets/captions.vtt';
    video.appendChild(track);

    video.oncanplay = () => {
        video.style.opacity = '1';
    };

    splashImage.parentNode.insertBefore(video, splashImage.nextSibling);
}


// --- Leave Management ---
function openLeaveTypeModal(leaveType = null) {
    DOM.leaveTypeModal.classList.add('visible');
    if (leaveType) {
        DOM.leaveTypeModalTitle.textContent = 'Edit Leave Type';
        DOM.editingLeaveTypeId.value = leaveType.id;
        DOM.leaveNameInput.value = leaveType.name;
        DOM.leaveDaysInput.value = leaveType.totalDays;
        selectColorInPicker(leaveType.color);
        DOM.deleteLeaveTypeBtn.classList.remove('hidden');
    } else {
        DOM.leaveTypeModalTitle.textContent = 'Add New Leave Type';
        DOM.editingLeaveTypeId.value = '';
        DOM.leaveNameInput.value = '';
        DOM.leaveDaysInput.value = '';
        selectColorInPicker(null);
        DOM.deleteLeaveTypeBtn.classList.add('hidden');
    }
}

function closeLeaveTypeModal() {
    DOM.leaveTypeModal.classList.remove('visible');
}

function setupColorPicker() {
    const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#78716c'];
    DOM.leaveColorPicker.innerHTML = colors.map(color => `
        <button type="button" data-color="${color}" style="background-color: ${color};" class="w-10 h-10 rounded-full border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"></button>
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
        showMessage('Please fill all fields and select a color.', 'error');
        setButtonLoadingState(button, false);
        return;
    }

    const isColorTaken = state.leaveTypes.some(lt => lt.color === color && lt.id !== id);
    if (isColorTaken) {
        showMessage('This color is already used by another leave type.', 'error');
        setButtonLoadingState(button, false);
        return;
    }

    const newLeaveTypes = [...state.leaveTypes];
    const existingIndex = newLeaveTypes.findIndex(lt => lt.id === id);

    if (existingIndex > -1) {
        newLeaveTypes[existingIndex] = { id, name, totalDays, color };
    } else {
        newLeaveTypes.push({ id, name, totalDays, color });
    }

    setState({ leaveTypes: newLeaveTypes });
    if(state.isOnlineMode) {
        await saveDataToFirestore({ 
            activities: state.allStoredData, 
            leaveTypes: newLeaveTypes
        });
    } else {
        saveDataToLocalStorage({ activities: state.allStoredData, leaveTypes: newLeaveTypes });
    }

    closeLeaveTypeModal();
    updateView();
    showMessage('Leave type saved!', 'success');

    setButtonLoadingState(button, false);
}

async function deleteLeaveType() {
    const id = DOM.editingLeaveTypeId.value;
    const newLeaveTypes = state.leaveTypes.filter(lt => lt.id !== id);
    setState({ leaveTypes: newLeaveTypes });

    const updatedActivities = { ...state.allStoredData };
    Object.keys(updatedActivities).forEach(dateKey => {
        if (updatedActivities[dateKey].leave?.typeId === id) {
            updatedActivities[dateKey] = { ...updatedActivities[dateKey] };
            delete updatedActivities[dateKey].leave;
        }
    });
    setState({ allStoredData: updatedActivities });

    if(state.isOnlineMode) {
        await saveDataToFirestore({ 
            activities: updatedActivities, 
            leaveTypes: newLeaveTypes
        });
    } else {
        saveDataToLocalStorage({ activities: updatedActivities, leaveTypes: newLeaveTypes });
    }

    closeLeaveTypeModal();
    updateView();
    showMessage('Leave type deleted!', 'success');
}

async function saveLeaveTypes() {
    if (state.isOnlineMode) {
        await saveDataToFirestore({ 
            activities: state.allStoredData, 
            leaveTypes: state.leaveTypes
        });
    } else {
        saveDataToLocalStorage({ activities: state.allStoredData, leaveTypes: state.leaveTypes });
        updateView();
    }
    showMessage('Leave types reordered!', 'success');
}

function moveLeaveType(typeId, direction) {
    const newLeaveTypes = [...state.leaveTypes];
    const index = newLeaveTypes.findIndex(lt => lt.id === typeId);

    if (index === -1) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newLeaveTypes.length) return;

    [newLeaveTypes[index], newLeaveTypes[newIndex]] = [newLeaveTypes[newIndex], newLeaveTypes[index]];

    setState({ leaveTypes: newLeaveTypes });
    saveLeaveTypes();
}

function renderLeavePills() {
    DOM.leavePillsContainer.innerHTML = '';
    state.leaveTypes.forEach(lt => {
        const pill = document.createElement('button');
        pill.className = 'flex-shrink-0 truncate max-w-40 px-3 py-1.5 rounded-full text-sm font-semibold text-white shadow transition-transform transform hover:scale-105';
        pill.style.backgroundColor = lt.color;
        pill.textContent = lt.name;
        pill.dataset.id = lt.id;
        if (state.isLoggingLeave && state.selectedLeaveTypeId === lt.id) {
            pill.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
        }
        DOM.leavePillsContainer.appendChild(pill);
    });
}

function calculateLeaveBalances() {
    const balances = {};
    const leaveCounts = {};

    state.leaveTypes.forEach(lt => {
        leaveCounts[lt.id] = 0;
    });

    Object.values(state.allStoredData).forEach(dayData => {
        if (dayData.leave) {
            const leaveValue = dayData.leave.dayType === LEAVE_DAY_TYPES.HALF ? 0.5 : 1;
            if (leaveCounts.hasOwnProperty(dayData.leave.typeId)) {
                leaveCounts[dayData.leave.typeId] += leaveValue;
            }
        }
    });

    state.leaveTypes.forEach(lt => {
        balances[lt.id] = lt.totalDays - (leaveCounts[lt.id] || 0);
    });

    return balances;
}

// --- NEW: Leave Overview Modal Functions ---
function openLeaveOverviewModal(leaveTypeId) {
    const leaveType = state.leaveTypes.find(lt => lt.id === leaveTypeId);
    if (!leaveType) return;

    DOM.overviewLeaveTypeName.textContent = leaveType.name;
    DOM.overviewLeaveTypeName.title = leaveType.name;
    DOM.overviewLeaveTypeName.style.color = leaveType.color;

    // Get all dates where this leave type is used
    const leaveDates = [];
    Object.keys(state.allStoredData).forEach(dateKey => {
        const dayData = state.allStoredData[dateKey];
        if (dayData.leave && dayData.leave.typeId === leaveTypeId) {
            leaveDates.push({
                date: dateKey,
                dayType: dayData.leave.dayType,
                formatted: formatDateForDisplay(dateKey)
            });
        }
    });

    // Sort dates chronologically
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
                    <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold ${leaveDate.dayType === 'full' ? 'active' : ''}" data-value="full">Full</button>
                    <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold ${leaveDate.dayType === 'half' ? 'active' : ''}" data-value="half">Half</button>
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
    const dayData = state.allStoredData[dateKey];
    if (!dayData || !dayData.leave) return;

    const updatedData = { ...state.allStoredData };
    updatedData[dateKey] = { ...dayData };
    delete updatedData[dateKey].leave;

    if (state.isOnlineMode) {
        await saveDataToFirestore({ 
            activities: updatedData, 
            leaveTypes: state.leaveTypes
        });
    } else {
        saveDataToLocalStorage({ activities: updatedData, leaveTypes: state.leaveTypes });
        setState({ allStoredData: updatedData });
    }

    // Refresh the overview modal if it's open
    const currentLeaveTypeId = dayData.leave.typeId;
    if (DOM.leaveOverviewModal.classList.contains('visible')) {
        setTimeout(() => openLeaveOverviewModal(currentLeaveTypeId), 100);
    }

    updateView();
    showMessage('Leave entry deleted successfully!', 'success');
}

function renderLeaveStats() {
    DOM.leaveStatsSection.innerHTML = '';
    if (state.leaveTypes.length === 0) {
        DOM.leaveStatsSection.innerHTML = '<p class="text-center text-gray-500">No leave types defined yet.</p>';
        return;
    }

    const leaveCounts = {};
    state.leaveTypes.forEach(lt => {
        leaveCounts[lt.id] = 0;
    });

    Object.values(state.allStoredData).forEach(dayData => {
        if (dayData.leave) {
            if(dayData.leave.dayType === LEAVE_DAY_TYPES.FULL) {
                leaveCounts[dayData.leave.typeId] += 1;
            } else if (dayData.leave.dayType === LEAVE_DAY_TYPES.HALF) {
                leaveCounts[dayData.leave.typeId] += 0.5;
            }
        }
    });

    const statsHTML = state.leaveTypes.map((lt, index) => {
        // --- MODIFICATION: UX Enhancement - Round "used" and "balance" values for display ---
        const usedCalculation = leaveCounts[lt.id] || 0;
        const used = parseFloat(usedCalculation.toFixed(2));
        const balanceCalculation = lt.totalDays - used;
        const balance = parseFloat(balanceCalculation.toFixed(2));

        const isFirst = index === 0;
        const isLast = index === state.leaveTypes.length - 1;

        return `
            <div class="bg-white p-4 rounded-lg shadow relative border-2" style="border-color: ${lt.color};">
                <div class="flex justify-between items-start">
                    <div class="flex items-center min-w-0 pr-2">
                        <h4 class="font-bold text-lg truncate min-w-0 mr-2" style="color: ${lt.color};" title="${sanitizeHTML(lt.name)}">${sanitizeHTML(lt.name)}</h4>
                    </div>
                    
                    <div class="flex items-center -mt-2 -mr-2 flex-shrink-0">
                        <button class="info-leave-btn icon-btn text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0" data-id="${lt.id}" title="View leave details">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </button>
                        <button class="move-leave-btn icon-btn" data-id="${lt.id}" data-direction="-1" title="Move Up" ${isFirst ? 'disabled' : ''}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                        </button>
                        <button class="move-leave-btn icon-btn" data-id="${lt.id}" data-direction="1" title="Move Down" ${isLast ? 'disabled' : ''}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <button class="edit-leave-type-btn icon-btn" data-id="${lt.id}" title="Edit">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-2 text-center">
                    <div class="bg-gray-100 p-2 rounded">
                        <p class="text-xs text-gray-500">Used</p>
                        <p class="font-bold text-xl text-gray-800">${used}</p>
                    </div>
                    <div class="p-2 rounded balance-box">
                        <p class="text-xs stats-label">Balance</p>
                        <p class="font-bold text-xl stats-value">${balance}</p>
                    </div>
                </div>
                <div class="bg-gray-100 p-2 rounded mt-2 text-center">
                    <p class="text-xs text-gray-500">Total</p>
                    <p class="font-bold text-xl text-gray-800">${lt.totalDays}</p>
                </div>
            </div>
        `;
    }).join('');
    DOM.leaveStatsSection.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">${statsHTML}</div>`;
    
    // Add event listeners for edit buttons
    DOM.leaveStatsSection.querySelectorAll('.edit-leave-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const leaveType = state.leaveTypes.find(lt => lt.id === e.currentTarget.dataset.id);
            if (leaveType) openLeaveTypeModal(leaveType);
        });
    });

    // Add event listeners for move buttons
    DOM.leaveStatsSection.querySelectorAll('.move-leave-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const direction = parseInt(e.currentTarget.dataset.direction, 10);
            moveLeaveType(id, direction);
        });
    });

    // Add event listeners for info buttons
    DOM.leaveStatsSection.querySelectorAll('.info-leave-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const leaveTypeId = e.currentTarget.dataset.id;
            openLeaveOverviewModal(leaveTypeId);
        });
    });
}

function openLeaveCustomizationModal() {
    if (state.leaveSelection.size === 0) {
        showMessage('Please select at least one day on the calendar.', 'info');
        return;
    }
    setState({ initialLeaveSelection: new Set(state.leaveSelection) });
    DOM.customizeLeaveModal.classList.add('visible');
    renderLeaveCustomizationModal();
}

function createLeaveTypeSelector(container, currentTypeId, onTypeChangeCallback) {
    const selectedType = state.leaveTypes.find(lt => lt.id === currentTypeId);

    let triggerHTML;
    if (currentTypeId === 'remove') {
        triggerHTML = `<span class="font-medium text-sm text-red-500">None (will be removed)</span>`;
    } else if (selectedType) {
        triggerHTML = `
            <span class="flex items-center w-full min-w-0">
                <span class="w-3 h-3 rounded-full mr-2 flex-shrink-0" style="background-color: ${selectedType.color};"></span>
                <span class="font-medium text-sm truncate min-w-0">${sanitizeHTML(selectedType.name)}</span>
            </span>
            <i class="fas fa-chevron-down text-xs text-gray-500 ml-1 flex-shrink-0"></i>`;
    } else {
        triggerHTML = `<span class="font-medium text-sm text-gray-500">Select Type</span>`;
    }

    container.innerHTML = `
        <button type="button" class="leave-type-selector-trigger w-full flex items-center justify-between px-3 py-1.5 border rounded-md shadow-sm text-left">
            ${triggerHTML}
        </button>
        <div class="leave-type-selector-panel">
            <div class="flex flex-col space-y-1">
                <button type="button" data-id="remove" class="leave-type-option w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center">
                    <i class="fas fa-times-circle w-3 h-3 mr-2 text-red-500"></i>
                    <span>None</span>
                </button>
                ${state.leaveTypes.map(lt => `
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
                newTriggerHTML = `<span class="font-medium text-sm text-red-500">None (will be removed)</span>`;
            } else {
                const newType = state.leaveTypes.find(lt => lt.id === newTypeId);

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

    const updateIndividualSelectorDisplay = (container, newTypeId) => {
        const trigger = container.querySelector('.leave-type-selector-trigger');
        if (!trigger) return;
        trigger.dataset.typeId = newTypeId;

        let newTriggerHTML;
        if (newTypeId === 'remove') {
            newTriggerHTML = `<span class="font-medium text-sm text-red-500">None (will be removed)</span>`;
        } else {
            const newType = state.leaveTypes.find(lt => lt.id === newTypeId);
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
    let modalBulkTypeId = state.selectedLeaveTypeId || state.leaveTypes[0]?.id;

    const renderBulkPills = () => {
        bulkPillsContainer.innerHTML = '';
        state.leaveTypes.forEach(lt => {
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

        const existingLeave = state.allStoredData[dateKey]?.leave;
        const currentLeaveTypeId = existingLeave ? existingLeave.typeId : modalBulkTypeId;
        const currentDayType = existingLeave ? existingLeave.dayType : LEAVE_DAY_TYPES.FULL;

        item.innerHTML = `
            <span class="font-medium mb-2 sm:mb-0 truncate min-w-0">${formatDateForDisplay(dateKey)}</span>
            <div class="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end min-w-0">
                <div class="leave-type-selector relative flex-grow w-full sm:w-36 min-w-0">
                </div>
                <div class="day-type-toggle relative flex w-28 h-8 items-center rounded-full bg-gray-200 p-1 cursor-pointer flex-shrink-0" data-selected-value="${currentDayType}">
                    <div class="toggle-bg absolute top-1 left-1 h-6 w-[calc(50%-0.25rem)] rounded-full bg-blue-500 shadow-md transition-transform duration-300 ease-in-out"></div>
                    <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold" data-value="full">Full</button>
                    <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold" data-value="half">Half</button>
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
    await new Promise(resolve => setTimeout(resolve, 50));

    const balances = calculateLeaveBalances();
    const modalItems = DOM.leaveDaysList.querySelectorAll('[data-date-key]');
    let balanceError = false;

    // --- MODIFICATION: Logic Bug Fix - Replaced entire balance check with net change calculation ---
    const changes = {}; // Use a new object to track net changes
    state.leaveTypes.forEach(lt => { changes[lt.id] = 0; });

    modalItems.forEach(item => {
        const dateKey = item.dataset.dateKey;
        const newTypeId = item.querySelector('.leave-type-selector-trigger').dataset.typeId;
        const newDayType = item.querySelector('.day-type-toggle').dataset.selectedValue;
        const newCost = newDayType === LEAVE_DAY_TYPES.HALF ? 0.5 : 1;

        const existingLeave = state.allStoredData[dateKey]?.leave;

        // If there was a leave on this day before, "refund" its cost from the changes
        if (existingLeave) {
            const oldCost = existingLeave.dayType === LEAVE_DAY_TYPES.HALF ? 0.5 : 1;
            changes[existingLeave.typeId] -= oldCost;
        }

        // If the new type is not 'remove', add the new cost to the changes
        if (newTypeId !== 'remove') {
            changes[newTypeId] += newCost;
        }
    });

    // Now, check the final net changes against the current balances
    for (const typeId in changes) {
        if (changes[typeId] > (balances[typeId] || 0)) {
            const leaveType = state.leaveTypes.find(lt => lt.id === typeId);
            showMessage(`Not enough balance for ${leaveType.name}.`, 'error');
            balanceError = true;
            break; // Exit the loop on the first error
        }
    }

    if (balanceError) {
        setButtonLoadingState(button, false);
        return;
    }

    // If no errors, proceed with saving
    const updatedData = { ...state.allStoredData };
    const datesInModal = new Set(Array.from(modalItems).map(item => item.dataset.dateKey));

    // First, handle deletions: if a day was in the initial selection but is no longer in the modal, remove its leave
    state.initialLeaveSelection.forEach(dateKey => {
        if (!datesInModal.has(dateKey) && updatedData[dateKey]?.leave) {
            updatedData[dateKey] = { ...updatedData[dateKey] };
            delete updatedData[dateKey].leave;
        }
    });

    // Next, handle additions/updates for items remaining in the modal
    modalItems.forEach(item => {
        const dateKey = item.dataset.dateKey;
        updatedData[dateKey] = { ...(updatedData[dateKey] || {}) };
        const typeId = item.querySelector('.leave-type-selector-trigger').dataset.typeId;

        if (typeId === 'remove') {
            delete updatedData[dateKey].leave;
        } else {
            const dayType = item.querySelector('.day-type-toggle').dataset.selectedValue;
            updatedData[dateKey].leave = { typeId, dayType };
        }
    });

    if (state.isOnlineMode) {
        await saveDataToFirestore({ 
            activities: updatedData, 
            leaveTypes: state.leaveTypes
        });
    } else {
        saveDataToLocalStorage({ activities: updatedData, leaveTypes: state.leaveTypes });
        setState({ allStoredData: updatedData });
    }

    DOM.customizeLeaveModal.classList.remove('visible');
    setState({ isLoggingLeave: false, selectedLeaveTypeId: null, leaveSelection: new Set(), initialLeaveSelection: new Set() });
    DOM.logNewLeaveBtn.innerHTML = '<i class="fas fa-calendar-plus mr-2"></i> Log Leave';
    DOM.logNewLeaveBtn.classList.replace('btn-danger', 'btn-primary');
    updateView();
    showMessage('Leaves saved successfully!', 'success');

    setButtonLoadingState(button, false);
}

function handleBulkRemoveClick() {
    const list = DOM.leaveDaysList;
    list.querySelectorAll('.leave-day-item').forEach(item => {
        const selectorContainer = item.querySelector('.leave-type-selector');
        const trigger = selectorContainer.querySelector('.leave-type-selector-trigger');
        trigger.dataset.typeId = 'remove';
        trigger.innerHTML = `<span class="font-medium text-sm text-red-500">None (will be removed)</span>`;
    });
    showMessage("All selected leaves marked for removal. Click Save to confirm.", 'info');
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
        DOM.teamSection.innerHTML = '<p class="text-center text-gray-500">Team features are only available when signed in.</p>';
        return;
    }

    if (!state.currentTeam) {
        // No team - show create/join options
        DOM.teamSection.innerHTML = `
            <div class="text-center">
                <h3 class="text-lg font-semibold mb-4">Team Management</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="team-card bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400 cursor-pointer transition-all">
                        <button id="create-team-btn" class="w-full text-left">
                            <div class="flex items-center justify-center mb-4">
                                <div class="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                    <svg class="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                    </svg>
                                </div>
                            </div>
                            <h4 class="text-xl font-bold text-center mb-2">Create Team</h4>
                            <p class="text-center text-gray-600 dark:text-gray-400">Start a new team and invite others to join.</p>
                        </button>
                    </div>
                    <div class="team-card bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-400 cursor-pointer transition-all">
                        <button id="join-team-btn" class="w-full text-left">
                            <div class="flex items-center justify-center mb-4">
                                <div class="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                    <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                    </svg>
                                </div>
                            </div>
                            <h4 class="text-xl font-bold text-center mb-2">Join Team</h4>
                            <p class="text-center text-gray-600 dark:text-gray-400">Enter a room code to join an existing team.</p>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners for create/join buttons
        document.getElementById('create-team-btn').addEventListener('click', openCreateTeamModal);
        document.getElementById('join-team-btn').addEventListener('click', openJoinTeamModal);
        
    } else {
        // Has team - show team info and actions
        const isOwner = state.teamRole === TEAM_ROLES.OWNER;
        const memberCount = state.teamMembers.length || 0;
        
        const teamInfo = `
            <div class="space-y-6">
                <div class="text-center">
                    <h3 class="text-lg font-semibold mb-2 flex items-center justify-center">
                        <i class="fa-solid fa-user-group w-5 h-5 mr-2 text-blue-600"></i>
                        <span class="truncate">${sanitizeHTML(state.teamName || 'Your Team')}</span>
                        ${isOwner ? `
                        <button id="open-edit-team-name-btn" class="icon-btn ml-2 text-gray-500 hover:text-blue-600" title="Edit Team Name">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                        </button>
                        ` : ''}
                    </h3>
                    <p class="text-gray-600 dark:text-gray-400">You are ${isOwner ? 'the owner' : 'a member'} • ${memberCount} member${memberCount !== 1 ? 's' : ''}</p>
                </div>
                
                <div class="bg-white dark:bg-gray-100 p-4 rounded-lg border">
                    <h4 class="font-semibold mb-3 text-center">Team Room Code</h4>
                    <div class="text-center">
                        <div class="room-code">
                            <span>${state.currentTeam}</span>
                            <button id="copy-room-code-btn" class="icon-btn hover:bg-white/20 ml-2" title="Copy Code">
                                <i class="fa-regular fa-copy text-white"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-400 text-center mt-3">Share this code with others to invite them to your team.</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-${isOwner ? '3' : '2'} gap-4">
                    ${isOwner ? `
                        <button id="team-dashboard-btn" class="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                            Team Dashboard
                        </button>
                    ` : ''}
                    <button id="edit-display-name-btn" class="px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center">
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path>
                        </svg>
                        Change Name
                    </button>
                    ${isOwner ? `
                        <button id="delete-team-btn" class="px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                            Delete Team
                        </button>
                    ` : `
                        <button id="leave-team-btn" class="px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center">
                            <i class="fa-solid fa-door-open w-5 h-5 mr-2"></i>
                            Leave Team
                        </button>
                    `}
                </div>
            </div>
        `;
        
        DOM.teamSection.innerHTML = teamInfo;
        
        // Event listeners are now handled by delegation in setupEventListeners
    }
}

function openCreateTeamModal() {
    DOM.teamNameInput.value = '';
    if (DOM.teamOwnerDisplayNameInput) {
        DOM.teamOwnerDisplayNameInput.value = '';
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
    const displayName = DOM.teamOwnerDisplayNameInput.value.trim();

    if (!teamName || !displayName) {
        showMessage('Please enter both a team name and your display name.', 'error');
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
        showMessage(`Failed to create team: ${error.message}`, 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function joinTeam() {
    const button = DOM.joinTeamModal.querySelector('#save-join-team-btn');
    const roomCode = DOM.roomCodeInput.value.trim().toUpperCase();
    const displayName = DOM.displayNameInput.value.trim();

    if (!roomCode || !displayName) {
        showMessage('Please enter both room code and display name.', 'error');
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
        showMessage(`Failed to join team: ${error.message}`, 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function editDisplayName() {
    const button = DOM.editDisplayNameModal.querySelector('#save-edit-name-btn');
    const newDisplayName = DOM.newDisplayNameInput.value.trim();

    if (!newDisplayName) {
        showMessage('Please enter a display name.', 'error');
        return;
    }

    setButtonLoadingState(button, true);
    try {
        const editDisplayNameCallable = httpsCallable(functions, 'editDisplayName');
        await editDisplayNameCallable({ newDisplayName: newDisplayName, teamId: state.currentTeam });
        showMessage('Display name updated successfully!', 'success');
        closeEditDisplayNameModal();
    } catch (error) {
        console.error('Error updating display name:', error);
        showMessage(`Failed to update display name: ${error.message}`, 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

async function leaveTeam(button) {
    try {
        const leaveTeamCallable = httpsCallable(functions, 'leaveTeam');
        await leaveTeamCallable({ teamId: state.currentTeam });
        showMessage('Successfully left the team.', 'success');
        // No need to turn off loading state, as the button will be removed on re-render.
    } catch (error) {
        console.error('Error leaving team:', error);
        showMessage(`Failed to leave team: ${error.message}`, 'error');
        if (button) setButtonLoadingState(button, false); // Turn off loading on error
    }
}

async function deleteTeam() {
    try {
        const deleteTeamCallable = httpsCallable(functions, 'deleteTeam');
        await deleteTeamCallable({ teamId: state.currentTeam });
        showMessage('Team deleted successfully.', 'success');
    } catch (error) {
        console.error('Error deleting team:', error);
        showMessage(`Failed to delete team: ${error.message}`, 'error');
    }
}

function copyRoomCode() {
    navigator.clipboard.writeText(state.currentTeam).then(() => {
        showMessage('Room code copied to clipboard!', 'success');
    }).catch(() => {
        showMessage('Failed to copy room code.', 'error');
    });
}

function openKickMemberModal(memberId, memberName) {
    DOM.kickModalText.innerHTML = `You are about to kick <strong>${sanitizeHTML(memberName)}</strong> from the team. This action cannot be undone.`;
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
        showMessage('Team member kicked successfully!', 'success');
        closeKickMemberModal();
    } catch (error) {
        console.error('Error kicking member:', error);
        showMessage(`Failed to kick member: ${error.message}`, 'error');
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
        DOM.teamDashboardContent.innerHTML = '<p class="text-center text-gray-500">Loading team data...</p>';
        return;
    }

    // Combine team member info with their summary data
    const combinedMembers = state.teamMembers.map(member => ({
        ...member,
        summary: state.teamMembersData[member.userId] || {}
    }));

    const owner = combinedMembers.find(m => m.role === TEAM_ROLES.OWNER);
    const members = combinedMembers.filter(m => m.role !== TEAM_ROLES.OWNER);
    const sortedMembers = [
        ...(owner ? [owner] : []),
        ...members.sort((a, b) => a.displayName.localeCompare(b.displayName))
    ];
    
    const membersHTML = sortedMembers.map(member => {
        const balances = member.summary.leaveBalances || {};
        const isOwner = member.role === TEAM_ROLES.OWNER;
        
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
           <details class="team-member-card ${isOwner ? 'team-owner-card' : ''} bg-white dark:bg-gray-50 rounded-lg shadow-sm border-l-4 overflow-hidden" data-user-id="${member.userId}">
                <summary class="flex items-center justify-between p-6 cursor-pointer">
                    <div class="flex items-center">
                        <div class="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                            ${member.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div class="ml-3">
                            <h4 class="font-bold text-lg">${sanitizeHTML(member.displayName)}</h4>
                            <p class="text-sm text-gray-600 dark:text-gray-400">${isOwner ? 'Team Owner' : 'Member'}</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        ${isOwner ? `
                        <div class="w-6 h-6 bg-yellow-100 dark:bg-yellow-800 rounded-full flex items-center justify-center mr-4">
                            <svg class="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                            </svg>
                        </div>
                        ` : ''}
                        ${(state.teamRole === TEAM_ROLES.OWNER && !isOwner) ? `
                        <button class="kick-member-btn icon-btn text-red-500 hover:text-red-700 dark:text-red-500 dark:hover:text-red-700 mr-2" title="Kick Member" data-kick-member-id="${member.userId}" data-kick-member-name="${member.displayName}">
                            <i class="fa-solid fa-circle-xmark"></i>
                        </button>
                        ` : ''}
                        <svg class="w-6 h-6 text-gray-500 accordion-arrow transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </summary>
                <div class="team-member-details-content p-6 border-t border-gray-200 dark:border-gray-700">
                    ${Object.keys(balances).length > 0 ? `
                        <div>
                            <h5 class="font-semibold mb-4 team-dashboard-title">Leave Balance Overview</h5>
                            ${leaveTypesHTML}
                        </div>
                    ` : `
                        <div class="text-center py-6 text-gray-500">
                            <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <p>No leave types configured for this member.</p>
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

    tableBody.addEventListener('click', e => {
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
                deleteActivity(getYYYYMMDD(state.selectedDate), timeKey);
                button.classList.remove('confirm-action');
                clearTimeout(button.dataset.timeoutId);
            } else {
                tableBody.querySelectorAll('.confirm-action').forEach(el => el.classList.remove('confirm-action'));

                button.classList.add('confirm-action');
                showMessage('Click again to confirm deletion.', 'info');
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

// --- Event Listener Setup ---
function setupEventListeners() {
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    DOM.emailSignupBtn.addEventListener('click', () => signUpWithEmail(emailInput.value, passwordInput.value));
    DOM.emailSigninBtn.addEventListener('click', () => signInWithEmail(emailInput.value, passwordInput.value));
    DOM.forgotPasswordBtn.addEventListener('click', () => resetPassword(emailInput.value));
    DOM.googleSigninBtn.addEventListener('click', signInWithGoogle);
    document.getElementById('anon-continue-btn').addEventListener('click', loadOfflineData);
    // ADD THIS CODE AT THE END OF THE setupEventListeners FUNCTION
    document.getElementById('force-debug-log-btn').addEventListener('click', async () => {
        if (!state.userId) {
            showMessage("You must be logged in to test this.", "error");
            return;
        }
        console.log("Attempting to write a debug log...");
        try {
            const debugColRef = collection(db, "debug_logs");
            await addDoc(debugColRef, {
                message: "This is a direct test from the debug button.",
                userId: state.userId,
                timestamp: new Date()
            });
            showMessage("Debug log written successfully!", "success");
            console.log("Debug log write was successful.");
        } catch (error) {
            showMessage(`Failed to write debug log: ${error.message}`, "error");
            console.error("Error writing debug log:", error);
        }
    });
    
    setupDoubleClickConfirm(
        document.getElementById('sign-out-btn'),
        'signOut',
        'Click again to confirm sign out.',
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
        await new Promise(resolve => setTimeout(resolve, 50));

        if (state.currentView === VIEW_MODES.MONTH) {
            const newMonth = new Date(state.currentMonth.setMonth(state.currentMonth.getMonth() - 1));
            setState({ currentMonth: newMonth });
        } else {
            const newDate = new Date(state.selectedDate.setDate(state.selectedDate.getDate() - 1));
            setState({ selectedDate: newDate, currentMonth: new Date(newDate.getFullYear(), newDate.getMonth(), 1) });
        }
        updateView();
        setButtonLoadingState(button, false);
    });

    document.getElementById('next-btn').addEventListener('click', async (e) => {
        const button = e.currentTarget;
        setButtonLoadingState(button, true);
        await new Promise(resolve => setTimeout(resolve, 50));

        if (state.currentView === VIEW_MODES.MONTH) {
            const newMonth = new Date(state.currentMonth.setMonth(state.currentMonth.getMonth() + 1));
            setState({ currentMonth: newMonth });
        } else {
            const newDate = new Date(state.selectedDate.setDate(state.selectedDate.getDate() + 1));
            setState({ selectedDate: newDate, currentMonth: new Date(newDate.getFullYear(), newDate.getMonth(), 1) });
        }
        updateView();
        setButtonLoadingState(button, false);
    });
    DOM.todayBtnDay.addEventListener('click', async () => {
        setButtonLoadingState(DOM.todayBtnDay, true);
        await new Promise(resolve => setTimeout(resolve, 50));
        const today = new Date();
        setState({
            selectedDate: today,
            currentMonth: new Date(today.getFullYear(), today.getMonth(), 1)
        });
        updateView();
        setButtonLoadingState(DOM.todayBtnDay, false);
    });

    DOM.currentPeriodDisplay.addEventListener('click', () => {
        setState({ pickerYear: state.currentView === VIEW_MODES.MONTH ? state.currentMonth.getFullYear() : state.selectedDate.getFullYear() });
        renderMonthPicker();
        DOM.monthPickerModal.classList.add('visible');
    });

    document.getElementById('close-month-picker-btn').addEventListener('click', () => DOM.monthPickerModal.classList.remove('visible'));
    document.getElementById('prev-year-btn').addEventListener('click', async (e) => {
        const button = e.currentTarget;
        setButtonLoadingState(button, true);
        await new Promise(resolve => setTimeout(resolve, 50));
        setState({ pickerYear: state.pickerYear - 1 });
        renderMonthPicker();
        setButtonLoadingState(button, false);
    });

    document.getElementById('next-year-btn').addEventListener('click', async (e) => {
        const button = e.currentTarget;
        setButtonLoadingState(button, true);
        await new Promise(resolve => setTimeout(resolve, 50));
        setState({ pickerYear: state.pickerYear + 1 });
        renderMonthPicker();
        setButtonLoadingState(button, false);
    });

    DOM.dailyNoteInput.addEventListener('input', debounce((e) => {
        saveData({ type: ACTION_TYPES.SAVE_NOTE, payload: e.target.value });
    }, 500));

    const addNewSlotBtn = document.getElementById('add-new-slot-btn');
    addNewSlotBtn.addEventListener('click', async () => {
        setButtonLoadingState(addNewSlotBtn, true);
        await saveData({ type: ACTION_TYPES.ADD_SLOT });
        setButtonLoadingState(addNewSlotBtn, false);
    });

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
        'Click again to permanently delete this leave type and all its logged entries.',
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
            DOM.logNewLeaveBtn.innerHTML = '<i class="fas fa-calendar-plus mr-2"></i> Log Leave';
            DOM.logNewLeaveBtn.classList.replace('btn-danger', 'btn-primary');
            showMessage('Leave logging cancelled.', 'info');
            updateView();
        } else {
            if (state.leaveTypes.length === 0) {
                showMessage("Please add a leave type first, by clicking on '+' button on top of the calendar.", 'info');
                return;
            }
            setState({ isLoggingLeave: true, selectedLeaveTypeId: null, leaveSelection: new Set() });
            DOM.logNewLeaveBtn.innerHTML = '<i class="fas fa-times mr-2"></i> Cancel Logging';
            DOM.logNewLeaveBtn.classList.replace('btn-primary', 'btn-danger');
            showMessage('Select days on the calendar and then a leave type pill.', 'info');
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
    });

    document.getElementById('save-log-leave-btn').addEventListener('click', saveLoggedLeaves);
    DOM.removeAllLeavesBtn.addEventListener('click', handleBulkRemoveClick);

    DOM.logoContainer.addEventListener('click', handleLogoTap);

    if (DOM.infoToggleBtn && DOM.infoDescription) {
        DOM.infoToggleBtn.addEventListener('click', () => {
            const description = DOM.infoDescription;
            if (description.style.maxHeight && description.style.maxHeight !== '0px') {
                description.style.maxHeight = '0px';
                description.style.opacity = '0';
            } else {
                description.style.opacity = '1';
                description.style.maxHeight = description.scrollHeight + 'px';
            }
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
                showMessage('Click again to confirm deletion.', 'info');
                const timeoutId = setTimeout(() => {
                    deleteBtn.classList.remove('confirm-action');
                }, 3000);
                deleteBtn.dataset.timeoutId = timeoutId;
            }
        } else if (toggleBtn) {
            const toggle = toggleBtn.closest('.day-type-toggle');
            const newValue = toggleBtn.dataset.value;
            const oldValue = toggle.dataset.selectedValue;
    
            if (newValue === oldValue) return; // No change
    
            const item = toggleBtn.closest('.leave-overview-item');
            const dateKey = item.dataset.dateKey;
            const leaveData = state.allStoredData[dateKey]?.leave;
            if (!leaveData) return;
    
            // Balance Check
            const costChange = (newValue === 'full' ? 1 : 0.5) - (oldValue === 'full' ? 1 : 0.5);
            if (costChange > 0) {
                const balances = calculateLeaveBalances();
                const leaveType = state.leaveTypes.find(lt => lt.id === leaveData.typeId);
                if (balances[leaveData.typeId] < costChange) {
                    showMessage(`Not enough balance for ${leaveType.name}.`, 'error');
                    return;
                }
            }
    
            // Update UI
            toggle.dataset.selectedValue = newValue;
            toggle.querySelector('.toggle-bg').style.transform = `translateX(${newValue === 'half' ? '100%' : '0'})`;
            toggle.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.value === newValue));
    
            // Save Data
            const updatedData = { ...state.allStoredData };
            updatedData[dateKey] = { ...updatedData[dateKey] };
            updatedData[dateKey].leave.dayType = newValue;
            
            if (state.isOnlineMode) {
                await saveDataToFirestore({ 
                    activities: updatedData, 
                    leaveTypes: state.leaveTypes
                });
            } else {
                saveDataToLocalStorage({ activities: updatedData, leaveTypes: state.leaveTypes });
                setState({ allStoredData: updatedData });
            }
            
            showMessage('Leave day updated!', 'success');
            updateView(); // Refresh stats in the main view
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

        const handleDoubleClick = (actionKey, message, callback) => {
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
                showMessage(message, 'info');
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
                handleDoubleClick('leaveTeam', 'Click again to confirm leaving the team.', (btn) => {
                    setButtonLoadingState(btn, true);
                    leaveTeam(btn);
                });
                break;
            case 'delete-team-btn':
                handleDoubleClick('deleteTeam', 'Click again to permanently delete the team.', deleteTeam);
                break;
        }
    });

    // Format room code input
    DOM.roomCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
    });

}

// --- App Initialization ---
function handleSplashScreen() {
    setTimeout(() => {
        DOM.splashLoading.style.display = 'none';
        DOM.tapToBegin.style.display = 'block';
        DOM.splashScreen.addEventListener('click', () => {
            DOM.tapToBegin.style.display = 'none';
            DOM.splashLoading.style.display = 'none';
            DOM.splashText.classList.add('animating-out');

            initAuth();

            setTimeout(() => {
                DOM.splashScreen.style.zIndex = '-10';
                DOM.splashScreen.style.cursor = 'default';
                DOM.splashScreen.style.backgroundColor = 'transparent';
            }, 400);

            setTimeout(() => {
                DOM.splashText.style.display = 'none';
            }, 1000);

        }, { once: true });
    }, 50);
}

function init() {
    initUI();
    setupEventListeners();
    setupDailyViewEventListeners();
    setupColorPicker();
    loadTheme();
    handleSplashScreen();
    loadSplashScreenVideo();
}

document.addEventListener('DOMContentLoaded', init);
