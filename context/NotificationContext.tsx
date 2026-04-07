import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { generateId } from '../utils/id';

type NotificationVariant = 'success' | 'error' | 'warning' | 'info';

interface AppNotificationInput {
  title?: string;
  message: string;
  variant?: NotificationVariant;
  durationMs?: number;
}

interface NotificationContextType {
  notify: (notification: AppNotificationInput) => string;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const dismissTimers = new Map<string, number>();
const activeToasts = new Map<string, HTMLDivElement>();
let viewportElement: HTMLDivElement | null = null;

const CLOSE_ICON_SVG = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round">
    <path d="M18 6L6 18"></path>
    <path d="M6 6l12 12"></path>
  </svg>
`;

const NOTIFICATION_STYLES: Record<NotificationVariant, {
  accentBar: string;
  border: string;
  surface: string;
  iconWrap: string;
  iconGlow: string;
  panelGlow: string;
  closeButton: string;
  iconSvg: string;
}> = {
  success: {
    accentBar: 'from-emerald-400 via-emerald-500 to-teal-400',
    border: 'border-emerald-100/90',
    surface: 'from-white via-white to-emerald-50/90',
    iconWrap: 'bg-white/95 text-emerald-600 ring-emerald-100 shadow-[0_12px_28px_rgba(16,185,129,0.15)]',
    iconGlow: 'bg-emerald-300/35',
    panelGlow: 'bg-emerald-200/55',
    closeButton: 'hover:bg-emerald-50/80 hover:text-emerald-700',
    iconSvg: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
    `,
  },
  error: {
    accentBar: 'from-rose-400 via-rose-500 to-orange-400',
    border: 'border-rose-100/90',
    surface: 'from-white via-white to-rose-50/90',
    iconWrap: 'bg-white/95 text-rose-600 ring-rose-100 shadow-[0_12px_28px_rgba(244,63,94,0.16)]',
    iconGlow: 'bg-rose-300/35',
    panelGlow: 'bg-rose-200/50',
    closeButton: 'hover:bg-rose-50/80 hover:text-rose-700',
    iconSvg: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M15 9l-6 6"></path>
        <path d="M9 9l6 6"></path>
      </svg>
    `,
  },
  warning: {
    accentBar: 'from-amber-300 via-amber-500 to-orange-400',
    border: 'border-amber-100/90',
    surface: 'from-white via-white to-amber-50/90',
    iconWrap: 'bg-white/95 text-amber-600 ring-amber-100 shadow-[0_12px_28px_rgba(245,158,11,0.16)]',
    iconGlow: 'bg-amber-300/35',
    panelGlow: 'bg-amber-200/50',
    closeButton: 'hover:bg-amber-50/80 hover:text-amber-700',
    iconSvg: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 4l8 15H4L12 4z"></path>
        <path d="M12 9v4"></path>
        <path d="M12 17h.01"></path>
      </svg>
    `,
  },
  info: {
    accentBar: 'from-sky-300 via-sky-500 to-cyan-400',
    border: 'border-sky-100/90',
    surface: 'from-white via-white to-sky-50/90',
    iconWrap: 'bg-white/95 text-sky-600 ring-sky-100 shadow-[0_12px_28px_rgba(14,165,233,0.16)]',
    iconGlow: 'bg-sky-300/35',
    panelGlow: 'bg-sky-200/50',
    closeButton: 'hover:bg-sky-50/80 hover:text-sky-700',
    iconSvg: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 10v6"></path>
        <path d="M12 7h.01"></path>
      </svg>
    `,
  },
};

const createDiv = (className: string) => {
  const element = document.createElement('div');
  element.className = className;
  return element;
};

const createButton = (className: string) => {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  return element;
};

const ensureViewport = () => {
  if (typeof document === 'undefined') {
    return null;
  }

  if (viewportElement && document.body.contains(viewportElement)) {
    return viewportElement;
  }

  const existingViewport = document.querySelector('[data-role="app-toasts"]') as HTMLDivElement | null;
  if (existingViewport) {
    viewportElement = existingViewport;
    return existingViewport;
  }

  const viewport = createDiv('pointer-events-none fixed right-4 top-[4.75rem] z-[140] flex w-[calc(100vw-2rem)] max-w-[26rem] flex-col gap-3 md:right-6 md:top-6');
  viewport.setAttribute('aria-live', 'polite');
  viewport.setAttribute('aria-atomic', 'true');
  viewport.dataset.role = 'app-toasts';
  document.body.appendChild(viewport);
  viewportElement = viewport;
  return viewport;
};

export const dismissToast = (id: string) => {
  const timerId = dismissTimers.get(id);
  if (timerId !== undefined) {
    window.clearTimeout(timerId);
    dismissTimers.delete(id);
  }

  const toastElement = activeToasts.get(id);
  if (!toastElement) {
    return;
  }

  activeToasts.delete(id);
  toastElement.style.opacity = '0';
  toastElement.style.transform = 'translate3d(18px, -6px, 0) scale(0.98)';
  toastElement.style.transition = 'opacity 180ms ease, transform 180ms ease';
  window.setTimeout(() => toastElement.remove(), 180);
};

export const showToast = (notification: AppNotificationInput): string => {
  const viewport = ensureViewport();
  const id = generateId();

  if (!viewport) {
    return id;
  }

  const tone = NOTIFICATION_STYLES[notification.variant || 'info'];
  const toast = createDiv(`toast-enter pointer-events-auto relative isolate w-full overflow-hidden rounded-[24px] border bg-gradient-to-br shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl ${tone.border} ${tone.surface}`);
  toast.setAttribute('role', 'status');
  toast.dataset.toastId = id;

  const accentBar = createDiv(`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${tone.accentBar}`);
  const sheen = createDiv('toast-sheen absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/90 to-transparent');
  accentBar.appendChild(sheen);

  const panelGlow = createDiv(`toast-artifact absolute -right-8 top-3 h-24 w-24 rounded-full blur-3xl ${tone.panelGlow}`);
  const iconGlow = createDiv(`toast-artifact toast-artifact-delay absolute left-5 top-6 h-16 w-16 rounded-full blur-2xl ${tone.iconGlow}`);
  const surfaceHighlight = createDiv('absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.65),transparent_32%)] opacity-80');
  const content = createDiv('relative flex items-start gap-3 px-4 py-4 pr-3');

  const iconSlot = createDiv('relative flex h-12 w-12 shrink-0 items-center justify-center');
  const iconBloom = createDiv(`toast-icon-bloom absolute inset-0 rounded-2xl ${tone.iconGlow}`);
  const iconWrap = createDiv(`relative flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${tone.iconWrap}`);
  iconWrap.innerHTML = tone.iconSvg;
  iconSlot.append(iconBloom, iconWrap);

  const textBlock = createDiv('min-w-0 flex-1 pt-0.5');
  if (notification.title) {
    const title = document.createElement('p');
    title.className = 'text-[15px] font-semibold leading-5 tracking-[-0.01em] text-slate-900';
    title.textContent = notification.title;
    textBlock.appendChild(title);
  }

  const message = document.createElement('p');
  message.className = `text-[15px] leading-6 ${notification.title ? 'mt-1.5 text-slate-600' : 'font-medium text-slate-800'}`;
  message.textContent = notification.message;
  textBlock.appendChild(message);

  const closeButton = createButton(`rounded-xl p-2 text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${tone.closeButton}`);
  closeButton.setAttribute('aria-label', 'Dismiss toast');
  closeButton.innerHTML = CLOSE_ICON_SVG;
  closeButton.addEventListener('click', () => dismissToast(id));

  content.append(iconSlot, textBlock, closeButton);
  toast.append(accentBar, panelGlow, iconGlow, surfaceHighlight, content);
  viewport.prepend(toast);
  activeToasts.set(id, toast);

  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    console.info('[toast] created', { id, title: notification.title, message: notification.message });
  }

  const durationMs = notification.durationMs ?? 4000;
  if (durationMs > 0) {
    const timerId = window.setTimeout(() => dismissToast(id), durationMs);
    dismissTimers.set(id, timerId);
  }

  return id;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notify = useCallback((notification: AppNotificationInput) => showToast(notification), []);
  const dismiss = useCallback((id: string) => dismissToast(id), []);

  useEffect(() => {
    ensureViewport();

    if (typeof window !== 'undefined') {
      (window as Window & { __showToast?: typeof showToast }).__showToast = showToast;
    }

    return () => {
      dismissTimers.forEach(timerId => window.clearTimeout(timerId));
      dismissTimers.clear();
      activeToasts.forEach(toast => toast.remove());
      activeToasts.clear();
      viewportElement?.remove();
      viewportElement = null;
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, dismiss }}>
      {children}
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
