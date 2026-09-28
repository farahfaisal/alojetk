import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from './supabase';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDESlH42qNJVv6ABI0MIQ7zNhEhTQSwgkk",
  authDomain: "ben-edek.firebaseapp.com",
  projectId: "ben-edek",
  storageBucket: "ben-edek.firebasestorage.app",
  messagingSenderId: "557282171991",
  appId: "1:557282171991:android:4badc87bfe101ceb401712"
};

// Initialize Firebase only in browser environment
let app: any = null;
if (typeof window !== 'undefined') {
  app = initializeApp(firebaseConfig);
}

let messaging: any = null;

// Initialize messaging only if supported
try {
  if (app && typeof window !== 'undefined' && 'serviceWorker' in navigator && !isStackBlitzEnvironment()) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.warn('Firebase messaging not supported:', error);
}

// Function to request location permissions
export async function requestLocationPermission() {
  try {
    console.log('📍 Requesting location permission...');

    if (Capacitor.isNativePlatform()) {
      // For native platforms
      const permissions = await Geolocation.requestPermissions();
      console.log('📱 Native location permission result:', permissions.location);
      return permissions.location === 'granted';
    } else {
      // For web
      if ('geolocation' in navigator) {
        console.log('🌐 Requesting web location permission...');

        // Check if we're on iOS Safari
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isIOSDevice) {
          console.log('📱 iOS device detected, requesting location permission');
        }

        return new Promise((resolve) => {
          // Request permission by attempting to get position
          const timeoutDuration = isIOSDevice ? 20000 : 15000;

          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('✅ Location permission granted, position:', position.coords);
              resolve(true);
            },
            (error) => {
              console.log('⚠️ Location permission error:', {
                code: error.code,
                message: error.message
              });

              // Error codes: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
              if (error.code === 1) {
                console.log('❌ User denied location permission');
                resolve(false);
              } else if (error.code === 2) {
                console.log('⚠️ Location unavailable, but permission may be granted');
                resolve(true); // Permission granted but location unavailable
              } else {
                console.log('⏱️ Location request timeout');
                resolve(false);
              }
            },
            {
              timeout: timeoutDuration,
              enableHighAccuracy: false,
              maximumAge: 0
            }
          );
        });
      }
      console.log('⚠️ Geolocation not supported');
      return false;
    }
  } catch (error) {
    console.warn('⚠️ Location permission request failed:', error);
    return false;
  }
}

// Function to get current location
export async function getCurrentLocation() {
  try {
    if (Capacitor.isNativePlatform()) {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
    } else {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }),
          (error) => reject(error),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }
  } catch (error) {
    console.error('Error getting location:', error);
    throw error;
  }
}

// Function to request notification permissions
export async function requestNotificationPermission() {
  try {
    console.log('🔔 Requesting notification permission...');

    if (Capacitor.isNativePlatform()) {
      // For native platforms
      console.log('📱 Requesting native notification permission...');
      const result = await setupNativePushNotifications();
      console.log('📱 Native notification permission result:', result);
      return result;
    } else {
      // For web
      console.log('🌐 Requesting web notification permission...');
      const result = await setupWebPushNotifications();
      console.log('🌐 Web notification permission result:', result);
      return result;
    }
  } catch (error) {
    console.error('⚠️ Notification permission request failed:', error);
    return false;
  }
}

// Function to request payment notifications specifically
export async function requestPaymentNotificationPermission() {
  try {
    console.log('💳 Enabling payment notifications...');

    // First check if general notifications are enabled
    if (Notification.permission !== 'granted') {
      console.warn('⚠️ General notifications not granted, requesting...');
      const granted = await requestNotificationPermission();
      if (!granted) {
        return false;
      }
    }

    // Enable payment notifications
    localStorage.setItem('payment_notifications_enabled', 'true');
    console.log('✅ Payment notifications enabled');

    // Show a test notification
    setTimeout(() => {
      sendTestNotification('💳 إشعارات الدفع مفعلة', 'ستصلك إشعارات خاصة بالمدفوعات والمعاملات المالية');
    }, 500);

    return true;
  } catch (error) {
    console.error('Error requesting payment notification permission:', error);
    return false;
  }
}

// Function to show payment-related notifications
export function showPaymentNotification(type: 'success' | 'failed' | 'pending', amount: number, orderId?: string) {
  try {
    const paymentNotificationsEnabled = localStorage.getItem('payment_notifications_enabled') === 'true';
    
    if (!paymentNotificationsEnabled || Notification.permission !== 'granted') {
      console.warn('⚠️ Payment notifications not enabled or permission not granted');
      return;
    }
    
    let title = '';
    let body = '';
    let icon = '/vite.svg';
    
    switch (type) {
      case 'success':
        title = '✅ تم الدفع بنجاح!';
        body = `تم دفع ${amount.toFixed(2)} شيكل بنجاح${orderId ? ` للطلب #${orderId}` : ''}`;
        break;
      case 'failed':
        title = '❌ فشل في الدفع';
        body = `فشل في دفع ${amount.toFixed(2)} شيكل${orderId ? ` للطلب #${orderId}` : ''}. يرجى المحاولة مرة أخرى.`;
        break;
      case 'pending':
        title = '⏳ الدفع قيد المعالجة';
        body = `جاري معالجة دفعة ${amount.toFixed(2)} شيكل${orderId ? ` للطلب #${orderId}` : ''}`;
        break;
    }
    
    const notification = new Notification(title, {
      body: body,
      icon: icon,
      badge: icon,
      dir: 'rtl',
      lang: 'ar',
      tag: `payment-${type}-${orderId || Date.now()}`,
      requireInteraction: type === 'failed', // Keep failed payments visible longer
      data: {
        type: 'payment',
        paymentType: type,
        amount: amount,
        orderId: orderId
      }
    });
    
    // Auto close after 5 seconds for success/pending, 10 seconds for failed
    const autoCloseTime = type === 'failed' ? 10000 : 5000;
    setTimeout(() => {
      notification.close();
    }, autoCloseTime);
    
    // Handle click
    notification.onclick = () => {
      if (orderId) {
        // Open order tracking
        window.dispatchEvent(new CustomEvent('notification-order-update', { 
          detail: { orderId: orderId }
        }));
      }
      notification.close();
      window.focus();
    };
    
    console.log('💳 Payment notification shown:', title);
  } catch (error) {
    console.error('Error showing payment notification:', error);
  }
}

// Function to check if payment notifications are enabled
export function arePaymentNotificationsEnabled(): boolean {
  return localStorage.getItem('payment_notifications_enabled') === 'true' && 
         Notification.permission === 'granted';
}
// Setup push notifications for native platforms
async function setupNativePushNotifications() {
  try {
    // Check permission
    const permStatus = await PushNotifications.requestPermissions();
    
    if (permStatus.receive !== 'granted') {
      throw new Error('User denied permissions!');
    }
    
    // Register with FCM
    await PushNotifications.register();
    
    // Setup listeners
    await PushNotifications.addListener('registration', (token) => {
      console.log('Push registration success:', token.value);
      sendTokenToServer(token.value);
    });
    
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });
    
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received:', notification);
      // Handle notification when app is in foreground
      showLocalNotification(notification);
    });
    
    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed:', notification);
      handleNotificationClick(notification.notification.data);
    });
    
    return true;
  } catch (error) {
    console.error('Error setting up native push notifications:', error);
    throw error;
  }
}

// Setup notifications for web (including WebView)
async function setupWebPushNotifications() {
  try {
    console.log('🌐 Setting up web notifications...');

    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('⚠️ This browser does not support notifications');
      return false;
    }

    // Check current permission status first
    console.log('📋 Current notification permission:', Notification.permission);

    if (Notification.permission === 'granted') {
      console.log('✅ Notification permission already granted');
      await setupWebNotificationHandlers();
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('❌ Notification permission previously denied');
      console.warn('💡 User needs to manually enable notifications in browser settings');
      return false;
    }

    // Request permission
    console.log('🔔 Requesting notification permission...');

    try {
      const permission = await Notification.requestPermission();
      console.log('📝 Permission result:', permission);

      if (permission === 'granted') {
        console.log('✅ Notification permission granted successfully');
        await setupWebNotificationHandlers();

        // Send a welcome notification
        setTimeout(() => {
          showNotification(
            '🔔 تم تفعيل الإشعارات!',
            'ستصلك إشعارات حول طلباتك والعروض الجديدة.'
          );
        }, 1000);

        return true;
      } else if (permission === 'denied') {
        console.warn('❌ User denied notification permission');
        return false;
      } else {
        console.warn('⚠️ User dismissed notification permission request');
        return false;
      }
    } catch (permissionError) {
      console.error('❌ Error requesting notification permission:', permissionError);
      return false;
    }

  } catch (error) {
    console.error('❌ Error setting up web push notifications:', error);
    return false;
  }
}

// Setup web notification handlers
async function setupWebNotificationHandlers() {
  try {
    console.log('⚙️ Setting up web notification handlers...');
    
    // Try to setup Firebase messaging if service workers are supported
    if ('serviceWorker' in navigator && !isStackBlitzEnvironment()) {
      try {
        await registerServiceWorker();
        
        // Check if messaging is supported
        const messagingSupported = await isSupported();
        if (messagingSupported) {
          if (!messaging) {
            messaging = getMessaging(app);
          }
          
          await setupFCMToken();
          console.log('🔥 Firebase messaging setup completed');
        } else {
          console.warn('Firebase messaging not supported in this environment');
        }
      } catch (fcmError) {
        console.warn('Firebase messaging setup failed, using basic notifications:', fcmError);
      }
    } else {
      console.log('⚠️ Service workers not supported, using basic notifications only');
    }
    
    // Setup basic notification testing
    setupBasicNotificationTest();
    
    return true;
  } catch (error) {
    console.error('Error setting up notification handlers:', error);
    return false;
  }
}

// Setup basic notification test
function setupBasicNotificationTest() {
  // Don't send automatic test notification
  // Users can test notifications manually from settings
  console.log('📱 Basic notification system ready');
}

// Function to send a test notification manually
export function sendTestNotification(title: string, body: string) {
  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body: body,
        icon: '/vite.svg',
        badge: '/vite.svg',
        dir: 'rtl',
        lang: 'ar',
        tag: 'test-notification',
        requireInteraction: false
      });
      
      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
      
      notification.onclick = () => {
        console.log('Test notification clicked');
        notification.close();
        window.focus();
      };
      
      console.log('✅ Test notification sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      return false;
    }
  } else {
    console.warn('⚠️ Cannot send test notification: permission not granted');
    return false;
  }
}

// Function to send welcome notification
function sendWelcomeNotification() {
  setTimeout(() => {
    if (Notification.permission === 'granted') {
      try {
        const testNotification = new Notification('مرحباً من بين إديك! 🎉', {
          body: 'تم تفعيل الإشعارات بنجاح. ستصلك إشعارات حول طلباتك والعروض الجديدة من JIB.',
          icon: 'https://rrhoxgfnikmtgsxwvjuv.supabase.co/storage/v1/object/public/general/WhatsApp%20Image%202025-09-23%20at%2000.16.28.jpeg',
          badge: 'https://rrhoxgfnikmtgsxwvjuv.supabase.co/storage/v1/object/public/general/WhatsApp%20Image%202025-09-23%20at%2000.16.28.jpeg',
          dir: 'rtl',
          lang: 'ar',
          tag: 'welcome-notification',
          requireInteraction: false
        });
        
        // Auto close after 5 seconds
        setTimeout(() => {
          testNotification.close();
        }, 5000);
        
        testNotification.onclick = () => {
          console.log('Welcome notification clicked');
          testNotification.close();
          window.focus();
        };
        
        console.log('🎉 Welcome notification sent successfully');
      } catch (error) {
        console.error('Error sending welcome notification:', error);
      }
    }
  }, 3000);
}

// Function to show a notification
export function showNotification(title: string, body: string, data?: any) {
  try {
    console.log('📢 Showing notification:', title);

    // Save to database first
    saveFirebaseNotificationToDatabase(title, body, data);

    if (Notification.permission !== 'granted') {
      console.warn('⚠️ Notification permission not granted');
      return;
    }

    const notification = new Notification(title, {
      body: body,
      icon: '/vite.svg',
      badge: '/vite.svg',
      dir: 'rtl',
      lang: 'ar',
      tag: 'notification',
      requireInteraction: false,
      data: data
    });

    // Auto close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    notification.onclick = () => {
      console.log('Notification clicked');
      if (data) {
        handleNotificationClick(data);
      }
      notification.close();
      window.focus();
    };

    console.log('✅ Notification shown successfully');
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

// Register service worker for notifications
async function registerServiceWorker() {
  try {
    // Check if we're in an environment that doesn't support service workers
    if (isStackBlitzEnvironment()) {
      console.warn('Service Workers not supported in this environment');
      return null;
    }
    
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      
      console.log('⚙️ Service Worker registered successfully:', registration);
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      console.log('✅ Service Worker is ready');
      
      return registration;
    }
    return null;
  } catch (error) {
    console.warn('Service Worker registration failed:', error);
    return null;
  }
}

async function setupFCMToken() {
  try {
    if (!messaging || !app) {
      console.warn('Firebase messaging not initialized');
      return;
    }
    
    // Get FCM token
    const token = await getToken(messaging, {
      vapidKey: 'BNKCFL1-csd5Rv4kIjZjJW7_FiVOInjXxYNDfjQp7pHHY0oW4Qo8kSg-pUC5Qk0oTgTduW7TCTkIgbvHHGddNxY'
    });
    
    if (token) {
      console.log('🔑 FCM Token:', token);
      sendTokenToServer(token);
      
      // Handle foreground messages
      onMessage(messaging, (payload) => {
        console.log('Message received in foreground:', payload);
        if (payload.notification) {
          showLocalNotification(payload);
        }
      });
    } else {
      console.warn('⚠️ No FCM token available');
    }
    
  } catch (error) {
    console.warn('Error setting up FCM token:', error);
  }
}

// Save Firebase notification to database
async function saveFirebaseNotificationToDatabase(title: string, body: string, data?: any) {
  try {
    // Get current user from localStorage
    const authUser = localStorage.getItem('auth_user');
    if (!authUser) {
      console.log('No user logged in, skipping notification save');
      return;
    }

    const user = JSON.parse(authUser);
    const userId = user.customer_id || user.id;

    if (!userId) {
      console.log('No user ID found, skipping notification save');
      return;
    }

    console.log('💾 Saving Firebase notification to database for user:', userId);

    const { error } = await supabase
      .from('firebase_notifications')
      .insert({
        user_id: userId,
        title: title,
        body: body || '',
        data: data || {},
        is_read: false
      });

    if (error) {
      console.error('Error saving Firebase notification:', error);
    } else {
      console.log('✅ Firebase notification saved to database');
    }
  } catch (error) {
    console.error('Error in saveFirebaseNotificationToDatabase:', error);
  }
}

// Show local notification
function showLocalNotification(payload: any) {
  try {
    const { title, body } = payload.notification || payload;

    // Save to database
    saveFirebaseNotificationToDatabase(
      title || 'إشعار جديد',
      body || '',
      payload.data
    );

    if (Notification.permission === 'granted') {
      const notification = new Notification(title || 'إشعار جديد', {
        body: body || '',
        icon: '/vite.svg',
        badge: '/vite.svg',
        tag: 'ben-edek-notification',
        requireInteraction: false,
        data: payload.data,
        dir: 'rtl',
        lang: 'ar'
      });

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle click
      notification.onclick = () => {
        handleNotificationClick(payload.data);
        notification.close();
      };
    }
  } catch (error) {
    console.error('Error showing local notification:', error);
  }
}

// Send FCM token to your server
function sendTokenToServer(token: string) {
  console.log('📤 Sending token to server:', token);
  
  // Store token in localStorage for now
  localStorage.setItem('fcm_token', token);
  
  // TODO: Send to your backend server
  // Example:
  // fetch('/api/save-fcm-token', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ token })
  // });
}

// Check if running in StackBlitz environment
function isStackBlitzEnvironment() {
  return window.location.hostname.includes('stackblitz') || 
         window.location.hostname.includes('webcontainer') ||
         window.location.hostname.includes('bolt.new') ||
         window.location.hostname.includes('netlify.app') ||
         window.location.hostname.includes('ben-edek.com');
}

// Handle notification click
function handleNotificationClick(data: any) {
  console.log('Handling notification click:', data);
  
  if (data && data.type === 'order_update') {
    // Dispatch event to open order tracking
    window.dispatchEvent(new CustomEvent('notification-order-update', { 
      detail: { orderId: data.orderId }
    }));
  } else if (data && data.type === 'promotion') {
    // Dispatch event to show promotion
    window.dispatchEvent(new CustomEvent('notification-promotion', { 
      detail: { promotionId: data.promotionId }
    }));
  }
  
  // Focus the app window
  if (window.focus) {
    window.focus();
  }
}

// Function to initialize Firebase
export function initializeFirebase() {
  console.log('🔥 Firebase initialized');
}

// Function to check if notifications are supported
export function isNotificationSupported() {
  if (Capacitor.isNativePlatform()) {
    return true;
  }

  return 'Notification' in window;
}

// Function to check current notification permission status
export function getNotificationPermissionStatus() {
  if (Capacitor.isNativePlatform()) {
    return 'default'; // Will be checked when requesting
  }
  
  return Notification.permission;
}

// Function to check if location is supported
export function isLocationSupported() {
  if (Capacitor.isNativePlatform()) {
    return true;
  }

  return 'geolocation' in navigator;
}

// Function to check location permission status
export async function getLocationPermissionStatus() {
  try {
    if (Capacitor.isNativePlatform()) {
      const permissions = await Geolocation.checkPermissions();
      return permissions.location;
    } else {
      // For web, check using the Permissions API if available
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          return result.state; // 'granted', 'denied', or 'prompt'
        } catch (error) {
          console.warn('Permissions API not available for geolocation:', error);
          return 'prompt';
        }
      }
      return 'prompt';
    }
  } catch (error) {
    console.warn('Error checking location permission:', error);
    return 'prompt';
  }
}
