import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

type NotificationVariant = 'success' | 'error' | 'warning' | 'info';

interface AppNotificationInput {
  title?: string;
  message: string;
  variant?: NotificationVariant;
  durationMs?: number;
}

interface AppNotification extends Required<Pick<AppNotificationInput, 'message'>> {
  id: string;
  title?: string;
  variant: NotificationVariant;
  durationMs: number;
}

interface NotificationContextType {
  notify: (notification: AppNotificationInput) => string;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIFICATION_STYLES: Record<NotificationVariant, { accent: string; iconWrap: string; icon: React.ReactNode }> = {
  success: {
    accent: 'bg-emerald-500',
    iconWrap: 'bg-emerald-50 text-emerald-600',
    icon: <CheckCircle2 size={18} />,
  },
  error: {
    accent: 'bg-rose-500',
    iconWrap: 'bg-rose-50 text-rose-600',
    icon: <XCircle size={18} />,
  },
  warning: {
    accent: 'bg-amber-500',
    iconWrap: 'bg-amber-50 text-amber-600',
    icon: <AlertTriangle size={18} />,
  },
  info: {
    accent: 'bg-sky-500',
    iconWrap: 'bg-sky-50 text-sky-600',
    icon: <Info size={18} />,
  },
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const dismissTimersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const existingTimer = dismissTimersRef.current.get(id);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
      dismissTimersRef.current.delete(id);
    }

    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const notify = useCallback((notification: AppNotificationInput) => {
    const id = crypto.randomUUID();
    const nextNotification: AppNotification = {
      id,
      title: notification.title,
      message: notification.message,
      variant: notification.variant || 'info',
      durationMs: notification.durationMs ?? 4000,
    };

    setNotifications(prev => [nextNotification, ...prev]);

    if (nextNotification.durationMs > 0) {
      const dismissTimer = window.setTimeout(() => {
        dismiss(id);
      }, nextNotification.durationMs);

      dismissTimersRef.current.set(id, dismissTimer);
    }

    return id;
  }, [dismiss]);

  useEffect(() => {
    return () => {
      dismissTimersRef.current.forEach(timerId => window.clearTimeout(timerId));
      dismissTimersRef.current.clear();
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-20 left-4 right-4 z-[70] flex flex-col gap-3 md:bottom-24 md:left-auto md:w-[24rem]"
      >
        {notifications.map(notification => {
          const tone = NOTIFICATION_STYLES[notification.variant];

          return (
            <div
              key={notification.id}
              role="status"
              className="pointer-events-auto overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.14)] backdrop-blur"
            >
              <div className={`h-1 w-full ${tone.accent}`} />
              <div className="flex items-start gap-3 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone.iconWrap}`}>
                  {tone.icon}
                </div>
                <div className="min-w-0 flex-1">
                  {notification.title && (
                    <p className="text-sm font-bold text-slate-900">{notification.title}</p>
                  )}
                  <p className={`text-sm leading-relaxed ${notification.title ? 'mt-1 text-slate-600' : 'font-medium text-slate-800'}`}>
                    {notification.message}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(notification.id)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }

  return context;
};
