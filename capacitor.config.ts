import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: "com.alojitak.app",
  appName: "JIB",
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
    scheme: "JIB",
    backgroundColor: "#1759cb",
    limitsNavigationsToAppBoundDomains: true,
    preferredContentMode: "mobile"
  },
  android: {
    backgroundColor: "#1759cb",
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;