import * as store from './store';
import * as LocalAuthentication from 'expo-local-authentication';

const KEY = 'agrisense.applock';
export const lockEnabled = async () => (await store.getItem(KEY).catch(() => null)) === '1';
export const biometricsAvailable = async () => {
  try { return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()); } catch { return false; }
};
export const unlock = async () => {
  try { return (await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock AgriSense', fallbackLabel: 'Use passcode' })).success; } catch { return false; }
};
export async function setLockEnabled(on) {
  if (on && !(await unlock())) return false;          // prove it works before turning it on
  if (on) await store.setItem(KEY, '1'); else await store.deleteItem(KEY);
  return true;
}
