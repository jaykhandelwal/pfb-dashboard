import { AppSettings, LedgerAccount, User } from '../types';

const DEFAULT_CUSTOM_ACCOUNT_ICON = 'CreditCard';
const DEFAULT_USER_ACCOUNT_ICON = 'User';
const DEFAULT_CUSTOM_ACCOUNT_COLOR = '#10b981';
const DEFAULT_USER_ACCOUNT_COLOR = '#3b82f6';

export const LEDGER_COMPANY_ACCOUNT_ID = 'company_account';
export const LEDGER_COMPANY_ACCOUNT_NAME = 'Company Account';

const trimOrFallback = (value: unknown, fallback: string): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
};

const normalizeAllowedUserIds = (
  account: Partial<LedgerAccount>,
  users: User[]
): string[] | null => {
  if (account.type === 'USER' && account.linkedUserId) {
    return [account.linkedUserId];
  }

  if (!Array.isArray(account.allowedUserIds)) {
    return null;
  }

  const validUserIds = new Set(users.map(user => user.id));
  const selected = Array.from(new Set(account.allowedUserIds)).filter(id => validUserIds.has(id));
  return selected.length === 0 || selected.length === users.length ? null : selected;
};

const normalizeDisconnectedUserLabel = (account: LedgerAccount, users: User[]): string => {
  if (account.type !== 'USER' || !account.linkedUserId) {
    return account.name;
  }

  const userStillExists = users.some(user => user.id === account.linkedUserId);
  if (userStillExists || account.name.includes('(Disconnected)')) {
    return account.name;
  }

  return `${account.name} (Disconnected)`;
};

export const normalizeLedgerAccount = (
  account: Partial<LedgerAccount>,
  users: User[] = []
): LedgerAccount => {
  const isUserAccount = account.type === 'USER';
  const fallbackName = isUserAccount
    ? users.find(user => user.id === account.linkedUserId)?.name || 'User Account'
    : LEDGER_COMPANY_ACCOUNT_NAME;

  const normalized: LedgerAccount = {
    id: trimOrFallback(account.id, `${isUserAccount ? 'user' : 'custom'}_${Date.now()}`),
    name: trimOrFallback(account.name, fallbackName),
    type: isUserAccount ? 'USER' : 'CUSTOM',
    linkedUserId: account.linkedUserId,
    isActive: account.isActive !== false,
    color: trimOrFallback(account.color, isUserAccount ? DEFAULT_USER_ACCOUNT_COLOR : DEFAULT_CUSTOM_ACCOUNT_COLOR),
    icon: trimOrFallback(account.icon, isUserAccount ? DEFAULT_USER_ACCOUNT_ICON : DEFAULT_CUSTOM_ACCOUNT_ICON),
    allowedUserIds: normalizeAllowedUserIds(account, users),
    paymentMethod: typeof account.paymentMethod === 'string' ? account.paymentMethod.trim() || undefined : undefined,
  };

  normalized.name = normalizeDisconnectedUserLabel(normalized, users);

  if (normalized.type === 'USER' && normalized.linkedUserId && !users.some(user => user.id === normalized.linkedUserId)) {
    normalized.isActive = false;
  }

  return normalized;
};

const indexAccounts = (accounts: LedgerAccount[]) => {
  const byId = new Map<string, LedgerAccount>();

  accounts.forEach(account => {
    byId.set(account.id, account);
  });

  return { byId };
};

export const buildDefaultLedgerAccounts = (): LedgerAccount[] => [
  normalizeLedgerAccount({
    id: LEDGER_COMPANY_ACCOUNT_ID,
    name: LEDGER_COMPANY_ACCOUNT_NAME,
    type: 'CUSTOM',
    isActive: true,
    icon: 'Wallet',
    color: '#0f766e',
    allowedUserIds: null,
  }),
];

const ensureCompanyAccount = (accounts: LedgerAccount[], users: User[]): LedgerAccount[] => {
  if (accounts.some(account => account.id === LEDGER_COMPANY_ACCOUNT_ID)) {
    return accounts;
  }

  return [
    normalizeLedgerAccount({
      id: LEDGER_COMPANY_ACCOUNT_ID,
      name: LEDGER_COMPANY_ACCOUNT_NAME,
      type: 'CUSTOM',
      isActive: true,
      icon: 'Wallet',
      color: '#0f766e',
      allowedUserIds: null,
    }, users),
    ...accounts,
  ];
};

const ensureUserAccounts = (accounts: LedgerAccount[], users: User[]): LedgerAccount[] => {
  const merged = [...accounts];
  const { byId } = indexAccounts(merged);

  users.forEach(user => {
    const existing = merged.find(account => account.linkedUserId === user.id);

    if (existing) {
      existing.allowedUserIds = [user.id];
      existing.type = 'USER';
      existing.linkedUserId = user.id;
      existing.color = existing.color || DEFAULT_USER_ACCOUNT_COLOR;
      existing.icon = existing.icon || DEFAULT_USER_ACCOUNT_ICON;
      return;
    }

    const userAccount = normalizeLedgerAccount({
      id: `user_${user.id}`,
      name: user.name,
      type: 'USER',
      linkedUserId: user.id,
      isActive: true,
      allowedUserIds: [user.id],
    }, users);

    if (!byId.has(userAccount.id)) {
      merged.push(userAccount);
      byId.set(userAccount.id, userAccount);
    }
  });

  return merged.map(account => normalizeLedgerAccount(account, users));
};

export const getLedgerAccounts = (
  settings: Pick<AppSettings, 'ledger_accounts'>,
  users: User[] = []
): LedgerAccount[] => {
  const configuredAccounts = Array.isArray(settings.ledger_accounts) && settings.ledger_accounts.length > 0
    ? settings.ledger_accounts
    : buildDefaultLedgerAccounts();

  let accounts = configuredAccounts.map(account => normalizeLedgerAccount(account, users));
  accounts = ensureCompanyAccount(accounts, users);
  accounts = ensureUserAccounts(accounts, users);

  return accounts;
};
