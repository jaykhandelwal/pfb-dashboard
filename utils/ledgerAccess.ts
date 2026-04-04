import { User } from '../types';

type LedgerScopedOption = {
  allowedUserIds?: string[] | null;
};

export const hasLedgerOptionUserRestrictions = (option?: LedgerScopedOption | null): boolean =>
  Array.isArray(option?.allowedUserIds) && option.allowedUserIds.length > 0;

export const isLedgerOptionAvailableToUser = (
  option: LedgerScopedOption | undefined | null,
  userId?: string | null
): boolean => {
  if (!option) return false;
  if (!userId) return true;
  if (!hasLedgerOptionUserRestrictions(option)) return true;
  return option.allowedUserIds!.includes(userId);
};

export const sanitizeLedgerAllowedUserIds = (
  selectedUserIds: string[],
  users: User[]
): string[] | null => {
  const validUserIds = new Set(users.map(user => user.id));
  const uniqueSelected = Array.from(new Set(selectedUserIds)).filter(id => validUserIds.has(id));

  if (uniqueSelected.length === 0) {
    return [];
  }

  if (uniqueSelected.length === users.length) {
    return null;
  }

  return uniqueSelected;
};

export const getLedgerOptionAllowedUsers = <T extends LedgerScopedOption>(
  option: T,
  users: User[]
): User[] => {
  if (!hasLedgerOptionUserRestrictions(option)) {
    return users;
  }

  const allowedUserIds = new Set(option.allowedUserIds);
  return users.filter(user => allowedUserIds.has(user.id));
};
