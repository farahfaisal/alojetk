import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from "@capacitor/app";
import type { PluginListenerHandle } from '@capacitor/core';

export default function BackButtonHandler() {
  const lastBackPress = useRef<number | null>(null);
  const listenerHandle = useRef<PluginListenerHandle | null>(null);

  useEffect(() => {
    // التحقق من توفر Capacitor (للتطبيقات المحمولة)
    if (typeof window !== 'undefined' && window.Capacitor) {
      console.log('📱 تفعيل معالج زر الرجوع للتطبيق المحمول');
      
      const setupListener = async () => {
        const handler = await CapacitorApp.addListener("backButton", () => {
          console.log('⬅️ تم الضغط على زر الرجوع');
          
          // التحقق من الصفحة الحالية
          const currentPath = window.location.pathname;
          console.log('📍 الصفحة الحالية:', currentPath);
          
          // إذا كنا في صفحة فرعية، ارجع للصفحة السابقة
          if (currentPath !== '/' && window.history.length > 1) {
            console.log('🔙 الرجوع للصفحة السابقة');
            window.history.back();
            return;
          }

          // إذا كنا في الصفحة الرئيسية، نفعل "اضغط مرتين للخروج"
          const now = Date.now();
          if (!lastBackPress.current || now - lastBackPress.current > 2000) {
            lastBackPress.current = now;
            console.log('⚠️ اضغط مرة أخرى للخروج من التطبيق');
            
            // عرض رسالة Toast للمستخدم
            showExitToast("اضغط مرة أخرى للخروج", "اضغط زر الرجوع مرة أخرى خلال ثانيتين للخروج من التطبيق");
          } else {
            console.log('🚪 خروج من التطبيق');
            
            showExitToast("جاري الخروج من التطبيق", "شكراً لاستخدام بين إديك");
            showExitToast("جاري الخروج من التطبيق", "شكراً لاستخدام JIB");
            
            // تأخير قصير لعرض الرسالة ثم الخروج
            setTimeout(() => {
              CapacitorApp.exitApp();
            }, 1000);
          }
        });
        
        listenerHandle.current = handler;
      };
      
      setupListener();

      return () => {
        console.log('🔄 إزالة معالج زر الرجوع');
        if (listenerHandle.current) {
          listenerHandle.current.remove();
          listenerHandle.current = null;
        }
      };
    } else {
      console.log('🌐 التطبيق يعمل في المتصفح - لا حاجة لمعالج زر الرجوع');
    }
  }, []);

  // دالة لعرض رسالة الخروج
  const showExitToast = (title: string, description: string) => {
    // إنشاء عنصر Toast مخصص
    const toastElement = document.createElement('div');
    toastElement.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white py-3 px-6 rounded-lg shadow-lg z-[100] max-w-sm text-center';
    toastElement.innerHTML = `
      <div class="font-medium text-sm">${title}</div>
      <div class="text-xs text-gray-300 mt-1">${description}</div>
    `;
    
    document.body.appendChild(toastElement);
    
    // إزالة الرسالة بعد 2 ثانية
    setTimeout(() => {
      if (document.body.contains(toastElement)) {
        document.body.removeChild(toastElement);
      }
    }, 2000);
  };

  return null; // مكون بدون واجهة
}