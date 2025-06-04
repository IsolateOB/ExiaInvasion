// 本地存储管理模块

const SETTINGS_KEY  = "settings";   // 设置存储键
const ACCOUNTS_KEY  = "accounts";   // 账号存储键
const CHARACTERS_KEY = "characters"; // 角色存储键

// 获取设置数据
export const getSettings = () =>
  new Promise((res) =>
    chrome.storage.local.get(SETTINGS_KEY, (r) => res(r[SETTINGS_KEY] || {}))
  );

// 保存设置数据
export const setSettings = (obj) =>
  new Promise((res) =>
    chrome.storage.local.set({ [SETTINGS_KEY]: obj }, () => res())
  );

// 获取账号列表
export const getAccounts = () =>
  new Promise((res) =>
    chrome.storage.local.get(ACCOUNTS_KEY, (r) => res(r[ACCOUNTS_KEY] || []))
  );

// 保存账号列表
export const setAccounts = (arr) =>
  new Promise((res) =>
    chrome.storage.local.set({ [ACCOUNTS_KEY]: arr }, () => res())
  );

// 获取角色数据
export const getCharacters = () =>
  new Promise((res) =>
    chrome.storage.local.get(CHARACTERS_KEY, (r) => res(r[CHARACTERS_KEY] || {
      elements: {
        Electronic: [],
        Fire: [],
        Wind: [],
        Water: [],
        Iron: [],
        Utility: []
      }
    }))
  );

// 保存角色数据
export const setCharacters = (obj) =>
  new Promise((res) =>
    chrome.storage.local.set({ [CHARACTERS_KEY]: obj }, () => res())
  );

