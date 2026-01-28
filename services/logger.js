import { APP_NAME } from '../constants.js';

/**
 * Centralized logger utility for the application.
 * Prepends [TrackerBuddy] to logs and provides standard logging methods.
 * Logs are disabled in production for 'info' level to keep the console clean.
 */
// Safely check for production environment (Vite uses import.meta.env, others use process.env)
const isProduction = (typeof import.meta !== 'undefined' && import.meta.env) 
    ? import.meta.env.PROD 
    : (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production');

export const Logger = {
    info: (msg, ...args) => {
        if (!isProduction) {
            console.log(`[${APP_NAME}] ${msg}`, ...args);
        }
    },
    error: (msg, ...args) => console.error(`[${APP_NAME}] ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[${APP_NAME}] ${msg}`, ...args)
};
