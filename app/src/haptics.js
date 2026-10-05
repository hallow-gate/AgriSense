import * as Haptics from 'expo-haptics';
export const tick = () => { try { Haptics.selectionAsync().catch(() => {}); } catch {} };
