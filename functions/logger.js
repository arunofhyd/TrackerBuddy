/**
 * Centralized logger utility for Cloud Functions.
 * Prepends [TrackerBuddy] to logs.
 */
const logger = require("firebase-functions/logger");
const { APP_NAME } = require("./constants");

const Logger = {
    info: (msg, ...args) => logger.info(`[${APP_NAME}] ${msg}`, ...args),
    error: (msg, ...args) => logger.error(`[${APP_NAME}] ${msg}`, ...args),
    warn: (msg, ...args) => logger.warn(`[${APP_NAME}] ${msg}`, ...args)
};

module.exports = { Logger };
