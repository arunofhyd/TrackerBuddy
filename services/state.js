import { VIEW_MODES, USER_ROLES } from '../constants.js';

export const createInitialState = () => ({
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
    isRangeMode: false,
    rangeStartDate: null,
    pendingRangeSelection: null,
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
    isLoggingOut: false,
    lastUpdated: 0,
    // Admin & Role State
    userRole: USER_ROLES.STANDARD, // 'standard', 'pro', 'co-admin'
    isAdminDashboardOpen: false,
    adminTargetUserId: null,
    superAdmins: []
});
