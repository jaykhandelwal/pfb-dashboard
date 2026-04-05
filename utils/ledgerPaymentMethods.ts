import { AppSettings, LedgerAccount } from '../types';

export const normalizeLedgerPaymentMethod = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const getLedgerPaymentMethodKey = (value: unknown): string =>
  normalizeLedgerPaymentMethod(value).toLowerCase();

const uniqueLedgerPaymentMethods = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  values.forEach(value => {
    const normalized = normalizeLedgerPaymentMethod(value);
    const key = normalized.toLowerCase();

    if (!normalized || seen.has(key)) {
      return;
    }

    seen.add(key);
    unique.push(normalized);
  });

  return unique;
};

export const getLedgerPaymentMethods = (
  settings: Pick<AppSettings, 'ledger_accounts' | 'ledger_payment_methods'>
): string[] => {
  if (Array.isArray(settings.ledger_payment_methods)) {
    return uniqueLedgerPaymentMethods(settings.ledger_payment_methods);
  }

  const derivedFromAccounts = Array.isArray(settings.ledger_accounts)
    ? settings.ledger_accounts.map(account => account.paymentMethod)
    : [];

  return uniqueLedgerPaymentMethods(derivedFromAccounts);
};

export const findLedgerPaymentMethod = (methods: string[], value: unknown): string | undefined => {
  const key = getLedgerPaymentMethodKey(value);

  if (!key) {
    return undefined;
  }

  return methods.find(method => getLedgerPaymentMethodKey(method) === key);
};

export const accountHasDeletedPaymentMethod = (
  account: Pick<LedgerAccount, 'paymentMethod'>,
  methods: string[]
): boolean => {
  const paymentMethod = normalizeLedgerPaymentMethod(account.paymentMethod);

  if (!paymentMethod) {
    return false;
  }

  return !findLedgerPaymentMethod(methods, paymentMethod);
};
