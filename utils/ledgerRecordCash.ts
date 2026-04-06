import { AppSettings, LedgerAccount, LedgerRecordCashSettings, User } from '../types';
import { getLedgerAccounts } from './ledgerAccounts';
import { isLedgerOptionAvailableToUser } from './ledgerAccess';

const trimString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeAllowedUserIds = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = Array.from(new Set(
    value
      .map(item => trimString(item))
      .filter(Boolean)
  ));

  return normalized.length > 0 ? normalized : [];
};

export const DEFAULT_LEDGER_RECORD_CASH_SETTINGS: LedgerRecordCashSettings = {
  accountId: '',
  accountName: '',
  allowedUserIds: null,
};

export const getLedgerRecordCashSettings = (
  settings: Pick<AppSettings, 'ledger_record_cash'>
): LedgerRecordCashSettings => {
  const raw = settings.ledger_record_cash;

  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_LEDGER_RECORD_CASH_SETTINGS };
  }

  return {
    accountId: trimString(raw.accountId),
    accountName: trimString(raw.accountName),
    allowedUserIds: normalizeAllowedUserIds(raw.allowedUserIds),
  };
};

export const findLedgerRecordCashAccount = (
  settings: Pick<AppSettings, 'ledger_record_cash' | 'ledger_accounts'>,
  users: User[] = []
): LedgerAccount | undefined => {
  const config = getLedgerRecordCashSettings(settings);
  const nameKey = config.accountName?.toLowerCase();

  return getLedgerAccounts(settings, users).find(account =>
    (config.accountId && account.id === config.accountId)
    || (!!nameKey && account.name.toLowerCase() === nameKey)
  );
};

export const canUserAccessLedgerRecordCash = (
  settings: Pick<AppSettings, 'ledger_record_cash' | 'ledger_accounts'>,
  users: User[] = [],
  userId?: string | null
): boolean => {
  const config = getLedgerRecordCashSettings(settings);
  const account = findLedgerRecordCashAccount(settings, users);

  if (!account || !account.isActive) {
    return false;
  }

  return (
    isLedgerOptionAvailableToUser(config, userId)
    && isLedgerOptionAvailableToUser(account, userId)
  );
};
