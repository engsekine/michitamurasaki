export { CookieConsentBanner } from './components/client/CookieConsentBanner';
export { CookieSettingsButton } from './components/client/CookieSettingsButton';
export {
    COOKIE_CONSENT_MAX_AGE_SECONDS,
    COOKIE_CONSENT_NAME,
    type ConsentState,
    getCookieConsentClient,
    getCookieConsentServer,
    setCookieConsent,
} from './lib/cookie-consent';
export { runWhenConsented } from './lib/gating';
// useCookieConsentStore は consent feature 内部専用のため公開しない（コンポーネントは相対 import で利用）
