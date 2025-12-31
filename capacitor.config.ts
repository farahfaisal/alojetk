import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: "com.benedek.app",
  appName: "الو جيتك",
  webDir: "dist", 
  server: {
    androidScheme: "https",
    cleartext: true
  },
  plugins: {
    StatusBar: {
      style: "light",
      overlaysWebView: false,
      backgroundColor: "#ffffff"
    }
  },
  ios: {
    contentInset: "always",
    scheme: "الو جيتك",
    backgroundColor: "#c21d14",
    limitsNavigationsToAppBoundDomains: true,
    preferredContentMode: "mobile"
  },
  android: {
    backgroundColor: "#c21d14",
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;