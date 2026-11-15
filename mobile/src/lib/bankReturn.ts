import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/** Route the bank sends the user back to after they approve (or cancel) access. */
export const BANK_RETURN_PATH = 'bank-callback';

/** Full URL of that route for this platform: financeapp://bank-callback on phones, http://localhost:8081/bank-callback on web. */
export function bankReturnUrl(): string {
  return Linking.createURL(BANK_RETURN_PATH);
}

/**
 * True when this page load IS the bank's redirect, inside the popup that the web build opens.
 * The popup only has to report back to the window that opened it and close, so the root
 * layout skips loading the app (and the session) there.
 */
export const isBankReturnPopup =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  !!window.opener &&
  window.location.pathname.replace(/\/+$/, '').endsWith(`/${BANK_RETURN_PATH}`);
