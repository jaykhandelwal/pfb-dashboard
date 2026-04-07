import { getLocalISOString } from '../constants';
import { AppSettings } from '../types';

export const DEFAULT_BUSINESS_DAY_CUTOFF_HOUR = 15;

const normalizeBusinessDayCutoffHour = (value: unknown): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_BUSINESS_DAY_CUTOFF_HOUR;
  }

  const normalized = Math.trunc(parsed);

  if (normalized < 0 || normalized > 23) {
    return DEFAULT_BUSINESS_DAY_CUTOFF_HOUR;
  }

  return normalized;
};

export const getBusinessDayCutoffHour = (
  settings?: Pick<AppSettings, 'business_day_cutoff_hour'> | null
): number => normalizeBusinessDayCutoffHour(settings?.business_day_cutoff_hour);

export const shouldUsePreviousBusinessDate = (
  settings?: Pick<AppSettings, 'business_day_cutoff_hour'> | null,
  now: Date = new Date()
): boolean => now.getHours() < getBusinessDayCutoffHour(settings);

export const getDefaultBusinessDate = (
  settings?: Pick<AppSettings, 'business_day_cutoff_hour'> | null,
  now: Date = new Date()
): string => {
  const targetDate = new Date(now);

  if (shouldUsePreviousBusinessDate(settings, now)) {
    targetDate.setDate(targetDate.getDate() - 1);
  }

  return getLocalISOString(targetDate);
};

export const getDefaultDashboardTimeRange = (
  settings?: Pick<AppSettings, 'business_day_cutoff_hour'> | null,
  now: Date = new Date()
): 'TODAY' | 'YESTERDAY' => (
  shouldUsePreviousBusinessDate(settings, now) ? 'YESTERDAY' : 'TODAY'
);

export const formatBusinessDayCutoffHour = (
  settings?: Pick<AppSettings, 'business_day_cutoff_hour'> | null
): string => {
  const cutoffHour = getBusinessDayCutoffHour(settings);
  const meridiem = cutoffHour >= 12 ? 'PM' : 'AM';
  const displayHour = cutoffHour % 12 || 12;

  return `${displayHour} ${meridiem}`;
};
