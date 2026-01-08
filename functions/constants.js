const REGION = 'asia-south1';

const COLLECTIONS = {
    USERS: 'users',
    TEAMS: 'teams',
    MEMBER_SUMMARIES: 'member_summaries',
    CONFIG: 'config',
    APP_CONFIG: 'app_config',
    PRO_WHITELIST: 'pro_whitelist'
};

const USER_ROLES = {
    STANDARD: 'standard',
    PRO: 'pro',
    CO_ADMIN: 'co-admin'
};

const TEAM_ROLES = {
    ADMIN: 'admin',
    MEMBER: 'member'
};

const LEAVE_DAY_TYPES = {
    FULL: 'full',
    HALF: 'half'
};

module.exports = {
    REGION,
    COLLECTIONS,
    USER_ROLES,
    TEAM_ROLES,
    LEAVE_DAY_TYPES
};
