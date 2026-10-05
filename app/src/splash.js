import * as SplashScreen from 'expo-splash-screen';
export const holdSplash = () => SplashScreen.preventAutoHideAsync().catch(() => {});
export const hideSplash = () => SplashScreen.hideAsync().catch(() => {});
