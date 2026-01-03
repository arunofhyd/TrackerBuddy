// Constants for Action Types
export const ACTION_TYPES = {
    UPDATE_VIEW: 'UPDATE_VIEW',
    SAVE_DATA: 'SAVE_DATA',
    LOG_LEAVE: 'LOG_LEAVE',
    DELETE_LEAVE: 'DELETE_LEAVE',
    ADD_LEAVE_TYPE: 'ADD_LEAVE_TYPE',
    DELETE_LEAVE_TYPE: 'DELETE_LEAVE_TYPE',
    CHANGE_LANGUAGE: 'CHANGE_LANGUAGE',
    TOGGLE_THEME: 'TOGGLE_THEME',
    RESTORE_DATA: 'RESTORE_DATA',
    RESET_DATA: 'RESET_DATA',
    CREATE_TEAM: 'CREATE_TEAM',
    JOIN_TEAM: 'JOIN_TEAM',
    LEAVE_TEAM: 'LEAVE_TEAM',
    DELETE_TEAM: 'DELETE_TEAM',
    KICK_MEMBER: 'KICK_MEMBER',
    UPDATE_DISPLAY_NAME: 'UPDATE_DISPLAY_NAME',
    UPDATE_TEAM_NAME: 'UPDATE_TEAM_NAME',
    GRANT_PRO: 'GRANT_PRO',
    REVOKE_PRO: 'REVOKE_PRO',
    UPDATE_USER_ROLE: 'UPDATE_USER_ROLE',
    SYNC_TEAM_SUMMARY: 'SYNC_TEAM_SUMMARY'
};

// Data Keys
export const DATA_KEYS = {
    YEARLY_DATA: 'yearlyData',
    ACTIVITIES: 'activities',
    LEAVE_OVERRIDES: 'leaveOverrides',
    LEAVE_TYPES: 'leaveTypes',
    GUEST_USER_DATA: 'guestUserData',
    SETTINGS: 'settings',
    LANGUAGE: 'language',
    THEME: 'theme',
    USER_ROLE: 'userRole',
    IS_PRO: 'isPro',
    TEAM_ID: 'teamId',
    TEAM_ROLE: 'teamRole',
    DISPLAY_NAME: 'displayName',
    MEMBER_SUMMARIES: 'member_summaries',
    CONFIG_APP_CONFIG: 'config/app_config',
    SUPER_ADMINS: 'superAdmins'
};

// Leave Types
export const LEAVE_DAY_TYPES = {
    FULL: 'full',
    HALF: 'half'
};

// User Roles
export const USER_ROLES = {
    STANDARD: 'standard',
    PRO: 'pro',
    CO_ADMIN: 'co-admin',
    SUPER_ADMIN: 'super-admin' // Derived role
};

// Team Roles
export const TEAM_ROLES = {
    ADMIN: 'admin',
    MEMBER: 'member'
};

// Translation Keys
export const TRANS_KEYS = {
    MSG_DATA_SAVED: 'msgDataSaved',
    MSG_ERROR_SAVING: 'msgErrorSaving',
    MSG_LOGGED_IN: 'msgLoggedIn',
    MSG_LOGGED_OUT: 'msgLoggedOut',
    MSG_LOGIN_ERROR: 'msgLoginError',
    MSG_TEAM_CREATED: 'msgTeamCreated',
    MSG_TEAM_JOINED: 'msgTeamJoined',
    MSG_LEFT_TEAM: 'msgLeftTeam',
    MSG_TEAM_DELETED: 'msgTeamDeleted',
    MSG_MEMBER_KICKED: 'msgMemberKicked',
    MSG_NAME_UPDATED: 'msgNameUpdated',
    MSG_TEAM_NAME_UPDATED: 'msgTeamNameUpdated',
    MSG_DATA_RESTORED: 'msgDataRestored',
    MSG_DATA_RESET: 'msgDataReset',
    MSG_FEATURE_LOCKED: 'msgFeatureLocked',
    MSG_NO_TEAM: 'msgNoTeam',
    MSG_COPIED: 'msgCopied',
    MSG_PRO_GRANTED: 'msgProGranted',
    MSG_PRO_REVOKED: 'msgProRevoked',
    MSG_ROLE_UPDATED: 'msgRoleUpdated',
    MSG_DATA_MIGRATED: 'msgDataMigratedSuccess',
    MSG_EMAIL_SENT: 'msgEmailSent',
    MSG_EMAIL_FAIL: 'msgEmailFail',
    MSG_INVALID_FILE: 'msgInvalidFile',
    MSG_PARSE_ERROR: 'msgParseError',
    MSG_NO_DATA_RESTORE: 'msgNoDataToRestore',
    MSG_DATA_MISMATCH: 'msgDataMismatch',
    MSG_CONFIRM_SIGNOUT: 'confirmSignOut',
    MSG_CONFIRM_RESET: 'confirmReset',
    MSG_CONFIRM_DELETE_TEAM: 'confirmDeleteTeam',
    MSG_CONFIRM_LEAVE_TEAM: 'confirmLeaveTeam',
    MSG_CONFIRM_KICK: 'confirmKick',
    MSG_CONFIRM_REVOKE: 'confirmRevoke',
    
    // UI Labels
    LABEL_FULL: 'full',
    LABEL_HALF: 'half',
    LABEL_MEMBER: 'member',
    LABEL_TEAM_ADMIN: 'teamAdmin',
    LABEL_NEWEST: 'newestFirst',
    LABEL_OLDEST: 'oldestFirst',
    LABEL_CURRENT_YEAR: 'currentYear',
    LABEL_ALL_YEARS: 'allYears',
    LABEL_RESULTS: 'results',
    LABEL_EDIT_LEAVE: 'editLeaveType',
    LABEL_ADD_LEAVE: 'addNewLeaveType',
    LABEL_SHARE_CODE: 'shareCodeMessage',
    LABEL_REACH_OUT: 'reachOut',
    LABEL_ADMIN_DASHBOARD: 'adminDashboard',
};

// Selectors
export const DOM_SELECTORS = {
    SPLASH_SCREEN: '#splash-screen',
    LOGIN_VIEW: '#login-view',
    APP_VIEW: '#app-view',
    LOADING_VIEW: '#loading-view',
    MAIN_CONTENT: '#main-content',
    MESSAGE_DISPLAY: '#message-display',
    // ... add more as needed
};
