// services/i18n.js
export class TranslationService {
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

    async init() {
        // Check localStorage first, then browser preference
        const savedLang = localStorage.getItem('appLanguage');
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

    async setLanguage(langCode) {
        if (this.currentLang === langCode) return;

        this.currentLang = langCode;
        localStorage.setItem('appLanguage', langCode);
        await this.loadTranslations(langCode);
        this.translatePage();
    }

    async loadTranslations(lang) {
        try {
            const response = await fetch(`assets/i18n/${lang}.json`);
            this.translations = await response.json();
        } catch (error) {
            console.error('Failed to load translations:', error);
        }
    }

    t(key, params = {}) {
        let text = this.translations[key] || key;
        Object.keys(params).forEach(param => {
            text = text.replace(new RegExp(`{${param}}`, 'g'), params[param]);
        });
        return text;
    }

    translatePage() {
        document.documentElement.lang = this.currentLang;
        document.documentElement.dir = this.currentLang === 'ar' ? 'rtl' : 'ltr';

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (this.translations[key]) {
                el.innerHTML = this.translations[key];
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            if (this.translations[key]) {
                el.placeholder = this.translations[key];
            }
        });
        document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            const key = el.dataset.i18nAriaLabel;
            if (this.translations[key]) {
                el.setAttribute('aria-label', this.translations[key]);
            }
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.dataset.i18nTitle;
            if (this.translations[key]) {
                el.title = this.translations[key];
            }
        });
        document.querySelectorAll('[data-i18n-alt]').forEach(el => {
            const key = el.dataset.i18nAlt;
            if (this.translations[key]) {
                el.alt = this.translations[key];
            }
        });

        if (this.updateViewCallback) {
            this.updateViewCallback();
        }
    }
}
