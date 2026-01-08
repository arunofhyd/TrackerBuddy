import { format } from 'date-fns';

export function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
}

export function sanitizeHTML(text) {
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
}

export function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

export function waitForDOMUpdate() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export function getYYYYMMDD(date) {
    return format(date, 'yyyy-MM-dd');
}

export function formatDateForDisplay(dateString, locale = 'en-US') {
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(locale, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
}

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
