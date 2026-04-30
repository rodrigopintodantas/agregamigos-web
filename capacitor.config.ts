import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agregamigos.app',
  appName: 'AgregaAmigos',
  webDir: 'dist/agregamigos-web/browser',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#1e225fff',
      showSpinner: false
    }
  }
};

export default config;
