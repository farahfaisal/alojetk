import React from 'react';
import { useState, useCallback, useEffect } from 'react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
}

let toastState: ToastState = { toasts: [] };
let listeners: Array<(state: ToastState) => void> = [];

const generateId = () => Math.random().toString(36).substring(2, 9);

const addToast = (toast: Omit<Toast, 'id'>) => {
  const newToast: Toast = {
    ...toast,
    id: generateId(),
    duration: toast.duration || 3000,
  };
  
  toastState.toasts.push(newToast);
  listeners.forEach(listener => listener(toastState));
  
  // Auto remove toast after duration
  setTimeout(() => {
    removeToast(newToast.id);
  }, newToast.duration);
  
  return newToast.id;
};

const removeToast = (id: string) => {
  toastState.toasts = toastState.toasts.filter(toast => toast.id !== id);
  listeners.forEach(listener => listener(toastState));
};

export const useToast = () => {
  const [state, setState] = useState<ToastState>(toastState);
  
  const subscribe = useCallback((listener: (state: ToastState) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);
  
  const toast = useCallback((toast: Omit<Toast, 'id'>) => {
    return addToast(toast);
  }, []);
  
  const dismiss = useCallback((id: string) => {
    removeToast(id);
  }, []);
  
  // Subscribe to state changes
  React.useEffect(() => {
    const unsubscribe = subscribe(setState);
    return unsubscribe;
  }, [subscribe]);
  
  return {
    toast,
    dismiss,
    toasts: state.toasts,
  };
};