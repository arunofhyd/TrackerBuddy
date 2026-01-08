/**
 * Centralized logger utility for the application.
 * Prepends [TrackerBuddy] to logs and provides standard logging methods.
 */
export const Logger = {
    info: (msg, ...args) => console.log(`[TrackerBuddy] ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[TrackerBuddy] ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[TrackerBuddy] ${msg}`, ...args)
};
