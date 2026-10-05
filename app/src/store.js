import * as SecureStore from 'expo-secure-store';
export const getItem = k => SecureStore.getItemAsync(k);
export const setItem = (k, v) => SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
export const deleteItem = k => SecureStore.deleteItemAsync(k);
