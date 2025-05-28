import { SETTINGS_KEY, ACCOUNTS_KEY } from "./constants";

export const getSettings = () =>
  new Promise((res) =>
    chrome.storage.local.get(SETTINGS_KEY, (r) => res(r[SETTINGS_KEY] || {}))
  );

export const setSettings = (obj) =>
  new Promise((res) =>
    chrome.storage.local.set({ [SETTINGS_KEY]: obj }, () => res())
  );

export const getAccounts = () =>
  new Promise((res) =>
    chrome.storage.local.get(ACCOUNTS_KEY, (r) => res(r[ACCOUNTS_KEY] || []))
  );

export const setAccounts = (arr) =>
  new Promise((res) =>
    chrome.storage.local.set({ [ACCOUNTS_KEY]: arr }, () => res())
  );

