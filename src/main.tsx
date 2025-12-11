import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { StatusBar, Style } from '@capacitor/status-bar';

// Configure status bar on app load
const configureStatusBar = async () => {
  try {
    await StatusBar.show();
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#ffffff' });
  } catch (error) {
    console.log('Status bar configuration not available on web');
  }
};

configureStatusBar();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);