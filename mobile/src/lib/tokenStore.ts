import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Where the refresh token is kept between app launches.
 *
 * - iOS / Android: expo-secure-store (Keychain / Keystore), encrypted by the system.
 * - Web: localStorage, because SecureStore does not exist in a browser. Any script running
 *   on the page can read localStorage, so the web build is weaker here. For a public web
 *   release, move the refresh token to an HttpOnly cookie set by the API.
 *
 * Only the refresh token is stored. The access token lives in memory (see api.ts).
 */
const KEY = 'finance.refreshToken';

const web = {
  get: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(KEY)),
  set: (v: string) => window.localStorage.setItem(KEY, v),
  remove: () => window.localStorage.removeItem(KEY),
};

export const tokenStore = {
  async load(): Promise<string | null> {
    try {
      return Platform.OS === 'web' ? web.get() : await SecureStore.getItemAsync(KEY);
    } catch {
      return null;
    }
  },
  async save(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') web.set(token);
      else await SecureStore.setItemAsync(KEY, token);
    } catch {
      // Storage unavailable (private mode, locked keychain): the session then lasts until the app closes.
    }
  },
  async clear(): Promise<void> {
    try {
      if (Platform.OS === 'web') web.remove();
      else await SecureStore.deleteItemAsync(KEY);
    } catch {}
  },
};
