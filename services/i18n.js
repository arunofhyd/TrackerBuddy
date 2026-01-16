// services/i18n.js
import { LOCAL_STORAGE_KEYS } from '../constants.js';

/**
 * Service to handle application localization.
 */
export class TranslationService {
    /**
     * @param {Function} updateViewCallback - Callback to trigger UI updates (re-renders).
     */
    constructor(updateViewCallback) {
        this.currentLang = 'en';
        this.translations = {};
        this.updateViewCallback = updateViewCallback;
        this.supportedLangs = [
            { code: 'id', name: 'Bahasa Indonesia' },
            { code: 'ms', name: 'Bahasa Melayu' },
            { code: 'de', name: 'Deutsch' },
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Español' },
            { code: 'fr', name: 'Français' },
            { code: 'it', name: 'Italiano' },
            { code: 'nl', name: 'Nederlands' },
            { code: 'pl', name: 'Polski' },
            { code: 'pt', name: 'Português' },
            { code: 'vi', name: 'Tiếng Việt' },
            { code: 'ru', name: 'Русский' },
            { code: 'ar', name: 'العربية' },
            { code: 'hi', name: 'हिन्दी' },
            { code: 'ta', name: 'தமிழ்' },
            { code: 'te', name: 'తెలుగు' },
            { code: 'ml', name: 'മലയാളം' },
            { code: 'th', name: 'ไทย' },
            { code: 'zh', name: '中文' },
            { code: 'ja', name: '日本語' },
            { code: 'ko', name: '한국어' }
        ];
    }

    /**
     * Initializes the translation service by detecting the preferred language.
     * @returns {Promise<void>}
     */
    async init() {
        // Check localStorage first, then browser preference
        const savedLang = localStorage.getItem(LOCAL_STORAGE_KEYS.APP_LANGUAGE);
        const userLang = navigator.language.split('-')[0];
        const supportedCodes = this.supportedLangs.map(l => l.code);

        if (savedLang && supportedCodes.includes(savedLang)) {
            this.currentLang = savedLang;
        } else {
            this.currentLang = supportedCodes.includes(userLang) ? userLang : 'en';
        }

        try {
            await this.loadTranslations(this.currentLang);
        } catch (e) {
            console.error("Init translation failed", e);
        }
        this.translatePage();
    }

    /**
     * Switches the application language.
     * @param {string} langCode - The ISO 639-1 language code (e.g., 'en', 'es').
     * @returns {Promise<void>}
     */
    async setLanguage(langCode) {
        if (this.currentLang === langCode) return;

        this.currentLang = langCode;
        localStorage.setItem(LOCAL_STORAGE_KEYS.APP_LANGUAGE, langCode);
        await this.loadTranslations(langCode);
        this.translatePage();
    }

    /**
     * Loads the translation JSON file for a given language.
     * @param {string} lang - The language code.
     * @returns {Promise<void>}
     */
    async loadTranslations(lang) {
        try {
            const response = await fetch(`/assets/i18n/${lang}.json`);
            this.translations = await response.json();
        } catch (error) {
            console.error('Failed to load translations:', error);
        }
    }

    /**
     * Helper to retrieve a nested value from the translations object using a dot-notation key.
     * @param {string} key - The key (e.g., 'auth.signIn').
     * @returns {string|undefined} The translated string or undefined.
     */
    getValue(key) {
        if (!key) return undefined;
        return key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined) ? obj[k] : undefined, this.translations);
    }

    /**
     * Translates a specific key.
     * @param {string} key - The translation key.
     * @param {Object} [params={}] - Parameters to replace in the translation string.
     * @returns {string} The translated string or the key if not found.
     */
    t(key, params = {}) {
        let text = this.getValue(key) || key;
        Object.keys(params).forEach(param => {
            text = text.replace(new RegExp(`{${param}}`, 'g'), params[param]);
        });
        return text;
    }

    /**
     * Applies translations to all elements in the DOM with data-i18n attributes.
     */
    translatePage() {
        document.documentElement.lang = this.currentLang;
        document.documentElement.dir = this.currentLang === 'ar' ? 'rtl' : 'ltr';

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const text = this.getValue(key);
            if (text) {
                el.innerHTML = text;
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            const text = this.getValue(key);
            if (text) {
                el.placeholder = text;
            }
        });
        document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            const key = el.dataset.i18nAriaLabel;
            const text = this.getValue(key);
            if (text) {
                el.setAttribute('aria-label', text);
            }
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.dataset.i18nTitle;
            const text = this.getValue(key);
            if (text) {
                el.title = text;
            }
        });
        document.querySelectorAll('[data-i18n-alt]').forEach(el => {
            const key = el.dataset.i18nAlt;
            const text = this.getValue(key);
            if (text) {
                el.alt = text;
            }
        });

        if (this.updateViewCallback) {
            this.updateViewCallback();
        }
    }
}
