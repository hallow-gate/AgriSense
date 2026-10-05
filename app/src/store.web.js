// Browser storage (the web build has no Keychain/Keystore).
export const getItem = async k => { try { return window.localStorage.getItem(k); } catch { return null; } };
export const setItem = async (k, v) => { try { window.localStorage.setItem(k, v); } catch {} };
export const deleteItem = async k => { try { window.localStorage.removeItem(k); } catch {} };
