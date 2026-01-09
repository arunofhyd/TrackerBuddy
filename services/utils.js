import { format } from 'date-fns';

/**
 * Checks if the current device is likely a mobile device based on User Agent or screen width.
 * @returns {boolean} True if mobile, false otherwise.
 */
export function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
}

/**
 * Sanitizes a string to prevent XSS attacks by escaping HTML characters.
 * @param {string} text - The raw text to sanitize.
 * @returns {string} The sanitized HTML string (safe for innerHTML).
 */
export function sanitizeHTML(text) {
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
}

/**
 * Creates a debounced version of a function that delays its execution.
 * @param {Function} func - The function to debounce.
 * @param {number} delay - The delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Waits for the browser to repaint the DOM (two animation frames).
 * Useful ensuring DOM updates are visible before performing heavy calculations or transitions.
 * @returns {Promise<void>}
 */
export function waitForDOMUpdate() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/**
 * Formats a Date object into a 'YYYY-MM-DD' string key.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
export function getYYYYMMDD(date) {
    return format(date, 'yyyy-MM-dd');
}

/**
 * Formats a date string (YYYY-MM-DD) for display in the UI.
 * @param {string} dateString - The date string to format.
 * @param {string} [locale='en-US'] - The locale to use for formatting.
 * @returns {string} The localized, formatted date string (e.g., "Mon, January 1, 2023").
 */
export function formatDateForDisplay(dateString, locale = 'en-US') {
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(locale, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Formats text for display, optionally highlighting a search query.
 * @param {string} text - The text to format.
 * @param {string} [highlightQuery=''] - The query substring to highlight.
 * @returns {string} HTML string with line breaks and highlights.
 */
export function formatTextForDisplay(text, highlightQuery = '') {
    const safeText = text || '';

    if (!highlightQuery) {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = safeText;
        return tempDiv.innerHTML.replace(/\n/g, '<br>');
    }

    const escapedQuery = highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = safeText.split(new RegExp(`(${escapedQuery})`, 'gi'));

    return parts.map(part => {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = part;
        const escapedPart = tempDiv.innerHTML.replace(/\n/g, '<br>');

        if (part.toLowerCase() === highlightQuery.toLowerCase()) {
            return `<span class="search-highlight">${escapedPart}</span>`;
        }
        return escapedPart;
    }).join('');
}

/**
 * Triggers haptic feedback vibration on mobile devices.
 * @param {string} type - The type of feedback: 'light', 'medium', 'success', 'error'.
 */
export function triggerHapticFeedback(type = 'light') {
    if (!isMobileDevice() || !navigator.vibrate) return;

    const patterns = {
        light: 10,
        medium: 40,
        success: [10, 50, 20],
        error: [50, 100, 50]
    };

    const pattern = patterns[type] || patterns.light;
    navigator.vibrate(pattern);
}
