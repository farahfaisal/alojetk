// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
  apiKey: "AIzaSyDESlH42qNJVv6ABI0MIQ7zNhEhTQSwgkk",
  authDomain: "ben-edek.firebaseapp.com",
  projectId: "ben-edek",
  storageBucket: "ben-edek.firebasestorage.app",
  messagingSenderId: "557282171991",
  appId: "1:557282171991:android:4badc87bfe101ceb401712"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('📨 Received background message:', payload);
  
  // Customize notification with better Arabic support
  const notificationTitle = payload.notification?.title || 'إشعار جديد من الو جيتك 🔔';
  const notificationOptions = {
    body: payload.notification?.body || 'لديك تحديث جديد في تطبيق الو جيتك',
    icon: 'https://rrhoxgfnikmtgsxwvjuv.supabase.co/storage/v1/object/public/general/WhatsApp%20Image%202025-09-23%20at%2000.16.28.jpeg',
    badge: 'https://rrhoxgfnikmtgsxwvjuv.supabase.co/storage/v1/object/public/general/WhatsApp%20Image%202025-09-23%20at%2000.16.28.jpeg',
    data: payload.data,
    dir: 'rtl',
    lang: 'ar',
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    tag: 'ben-edek-notification',
    actions: [
      { action: 'view', title: 'عرض' },
      { action: 'dismiss', title: 'إغلاق' }
    ],
    image: payload.notification?.image
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification click:', event);
  
  event.notification.close();
  
  // Handle action buttons
  if (event.action === 'dismiss') {
    return;
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    })
    .then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          console.log('📱 Focusing existing app window');
          return client.focus();
        }
      }
      
      // If app is not open, open it
      if (clients.openWindow) {
        console.log('🚀 Opening new app window');
        return clients.openWindow('/');
      }
    })
  );
});

// Handle notification action buttons
self.addEventListener('notificationclick', (event) => {
  if (event.action === 'view') {
    console.log('👁️ View action clicked');
    // Handle view action
    event.waitUntil(
      clients.openWindow('/')
    );
  } else {
    console.log('🔔 Default notification action');
  }
});