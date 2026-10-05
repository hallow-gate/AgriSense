// No biometric lock in the browser.
export const lockEnabled = async () => false;
export const biometricsAvailable = async () => false;
export const unlock = async () => true;
export const setLockEnabled = async () => false;
