/**
 * Centralized logger utility for the application.
 * Prepends [TrackerBuddy] to logs and provides standard logging methods.
 * Logs are disabled in production for 'info' level to keep the console clean.
 */
const isProduction = import.meta.env.PROD;

export const Logger = {
    info: (msg, ...args) => {
        if (!isProduction) {
            console.log(`[TrackerBuddy] ${msg}`, ...args);
        }
    },
    error: (msg, ...args) => console.error(`[TrackerBuddy] ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[TrackerBuddy] ${msg}`, ...args)
};
