/**
 * Centralized logger utility for Cloud Functions.
 * Prepends [TrackerBuddy] to logs.
 */
const Logger = {
    info: (msg, ...args) => console.log(`[TrackerBuddy] ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[TrackerBuddy] ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[TrackerBuddy] ${msg}`, ...args)
};

module.exports = { Logger };
