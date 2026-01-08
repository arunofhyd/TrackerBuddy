/**
 * Centralized logger utility for Cloud Functions.
 * Prepends [TrackerBuddy] to logs.
 */
const logger = require("firebase-functions/logger");

const Logger = {
    info: (msg, ...args) => logger.info(`[TrackerBuddy] ${msg}`, ...args),
    error: (msg, ...args) => logger.error(`[TrackerBuddy] ${msg}`, ...args),
    warn: (msg, ...args) => logger.warn(`[TrackerBuddy] ${msg}`, ...args)
};

module.exports = { Logger };
