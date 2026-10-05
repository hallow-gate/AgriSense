import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const KEY = 'agrisense.applock';
export const lockEnabled = async () => (await SecureStore.getItemAsync(KEY).catch(() => null)) === '1';
export const biometricsAvailable = async () => {
  try { return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()); } catch { return false; }
};
export const unlock = async () => {
  try { return (await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock AgriSense', fallbackLabel: 'Use passcode' })).success; } catch { return false; }
};
export async function setLockEnabled(on) {
  if (on && !(await unlock())) return false;          // prove it works before turning it on
  if (on) await SecureStore.setItemAsync(KEY, '1'); else await SecureStore.deleteItemAsync(KEY);
  return true;
}
