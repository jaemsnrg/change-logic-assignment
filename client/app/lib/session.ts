const STORAGE_KEY = "pulse.userId";

export const getStoredUserId = (): string | null => localStorage.getItem(STORAGE_KEY);

export const setStoredUserId = (userId: string) => localStorage.setItem(STORAGE_KEY, userId);

export const clearStoredUserId = () => localStorage.removeItem(STORAGE_KEY);
