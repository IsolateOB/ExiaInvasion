// SPDX-License-Identifier: GPL-3.0-or-later
// 本地存储管理模块

const SETTINGS_KEY  = "settings";   // 设置存储键
const ACCOUNTS_KEY  = "accounts";   // 账号存储键
const CHARACTERS_KEY = "characters"; // 角色存储键
const TEMPLATES_KEY = "characterTemplates"; // 角色模板存储键
const CURRENT_TEMPLATE_KEY = "currentTemplate"; // 当前选中的模板
const TEMPLATE_ID_SEQ_KEY = "characterTemplatesSeq";
const AUTH_KEY = "auth"; // 登录态存储键
const SYNC_META_KEY = "syncMeta"; // 云同步元数据

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

// 获取登录态
export const getAuth = () =>
  new Promise((res) =>
    chrome.storage.local.get(AUTH_KEY, (r) => res(r[AUTH_KEY] || null))
  );

// 保存登录态
export const setAuth = (obj) =>
  new Promise((res) =>
    chrome.storage.local.set({ [AUTH_KEY]: obj }, () => res())
  );

// 清除登录态
export const clearAuth = () =>
  new Promise((res) =>
    chrome.storage.local.remove(AUTH_KEY, () => res())
  );

// 获取云同步元数据
export const getSyncMeta = () =>
  new Promise((res) =>
    chrome.storage.local.get(SYNC_META_KEY, (r) => res(r[SYNC_META_KEY] || {}))
  );

// 保存云同步元数据（合并更新）
export const setSyncMeta = (obj) =>
  new Promise((res) =>
    chrome.storage.local.get(SYNC_META_KEY, (r) => {
      const current = r[SYNC_META_KEY] || {};
      chrome.storage.local.set({ [SYNC_META_KEY]: { ...current, ...obj } }, () => res());
    })
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
    chrome.storage.local.get(CHARACTERS_KEY, (r) => {
      const fallback = {
        elements: {
          Electronic: [],
          Fire: [],
          Wind: [],
          Water: [],
          Iron: [],
          Utility: []
        },
        options: {
          showEquipDetails: true
        }
      };
      const data = r[CHARACTERS_KEY] || {};
      const elements = (data && data.elements && typeof data.elements === "object") ? data.elements : fallback.elements;
      const options = {
        showEquipDetails: data?.options?.showEquipDetails !== false
      };
      res({
        ...fallback,
        ...data,
        elements: {
          ...fallback.elements,
          ...elements
        },
        options
      });
    })
  );

// 保存角色数据
export const setCharacters = (obj) =>
  new Promise((res) =>
    chrome.storage.local.set({ [CHARACTERS_KEY]: obj }, () => res())
  );

// 获取角色模板列表
export const getTemplates = () =>
  new Promise((res) =>
    chrome.storage.local.get(TEMPLATES_KEY, (r) => res(r[TEMPLATES_KEY] || []))
  );

// 保存单个模板（合并到列表）
export const saveTemplate = (template) =>
  new Promise((res) => {
    chrome.storage.local.get(TEMPLATES_KEY, (r) => {
      const list = r[TEMPLATES_KEY] || [];
      const idx = list.findIndex(t => t.id === template.id);
      if (idx !== -1) {
        list[idx] = template;
      } else {
        list.push(template);
      }
      chrome.storage.local.set({ [TEMPLATES_KEY]: list }, () => res());
    });
  });

// 批量保存模板列表
export const setTemplates = (list) =>
  new Promise((res) =>
    chrome.storage.local.set({ [TEMPLATES_KEY]: list || [] }, () => res())
  );

// 删除模板
export const deleteTemplate = (templateId) =>
  new Promise((res) => {
    chrome.storage.local.get(TEMPLATES_KEY, (r) => {
      const list = (r[TEMPLATES_KEY] || []).filter(t => t.id !== templateId);
      chrome.storage.local.set({ [TEMPLATES_KEY]: list }, () => res());
    });
  });

// 获取当前选中的模板ID
export const getCurrentTemplateId = () =>
  new Promise((res) =>
    chrome.storage.local.get(CURRENT_TEMPLATE_KEY, (r) => res(r[CURRENT_TEMPLATE_KEY] || ""))
  );

// 设置当前选中的模板ID
export const setCurrentTemplateId = (templateId) =>
  new Promise((res) =>
    chrome.storage.local.set({ [CURRENT_TEMPLATE_KEY]: templateId }, () => res())
  );

// 获取下一个角色模板自增ID（字符串）
export const getNextTemplateId = () =>
  new Promise((res) =>
    chrome.storage.local.get([TEMPLATE_ID_SEQ_KEY, TEMPLATES_KEY], (r) => {
      const current = Number(r[TEMPLATE_ID_SEQ_KEY] || 0);
      const list = r[TEMPLATES_KEY] || [];
      const maxInList = list.reduce((max, item) => {
        const n = Number(item?.id);
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0);
      const next = Math.max(current, maxInList) + 1;
      chrome.storage.local.set({ [TEMPLATE_ID_SEQ_KEY]: next }, () => res(String(next)));
    })
  );

// ========== 账号模板管理 ==========
const ACCOUNT_TEMPLATES_KEY = "accountTemplates"; // 账号模板存储键
const CURRENT_ACCOUNT_TEMPLATE_KEY = "currentAccountTemplate"; // 当前选中的账号模板ID
const ACCOUNT_TEMPLATE_ID_SEQ_KEY = "accountTemplatesSeq";

// 获取账号模板列表
export const getAccountTemplates = () =>
  new Promise((res) =>
    chrome.storage.local.get(ACCOUNT_TEMPLATES_KEY, (r) => res(r[ACCOUNT_TEMPLATES_KEY] || []))
  );

// 保存单个账号模板（合并到列表）
export const saveAccountTemplate = (template) =>
  new Promise((res) => {
    chrome.storage.local.get(ACCOUNT_TEMPLATES_KEY, (r) => {
      const list = r[ACCOUNT_TEMPLATES_KEY] || [];
      const idx = list.findIndex(t => t.id === template.id);
      if (idx !== -1) {
        list[idx] = template;
      } else {
        list.push(template);
      }
      chrome.storage.local.set({ [ACCOUNT_TEMPLATES_KEY]: list }, () => res());
    });
  });

// 批量保存账号模板列表
export const setAccountTemplates = (list) =>
  new Promise((res) =>
    chrome.storage.local.set({ [ACCOUNT_TEMPLATES_KEY]: list || [] }, () => res())
  );

// 删除账号模板
export const deleteAccountTemplate = (templateId) =>
  new Promise((res) => {
    chrome.storage.local.get(ACCOUNT_TEMPLATES_KEY, (r) => {
      const list = (r[ACCOUNT_TEMPLATES_KEY] || []).filter(t => t.id !== templateId);
      chrome.storage.local.set({ [ACCOUNT_TEMPLATES_KEY]: list }, () => res());
    });
  });

// 获取当前选中的账号模板ID
export const getCurrentAccountTemplateId = () =>
  new Promise((res) =>
    chrome.storage.local.get(CURRENT_ACCOUNT_TEMPLATE_KEY, (r) => res(r[CURRENT_ACCOUNT_TEMPLATE_KEY] || ""))
  );

// 设置当前选中的账号模板ID
export const setCurrentAccountTemplateId = (templateId) =>
  new Promise((res) =>
    chrome.storage.local.set({ [CURRENT_ACCOUNT_TEMPLATE_KEY]: templateId }, () => res())
  );

// 获取下一个账号模板自增ID（字符串）
export const getNextAccountTemplateId = () =>
  new Promise((res) =>
    chrome.storage.local.get([ACCOUNT_TEMPLATE_ID_SEQ_KEY, ACCOUNT_TEMPLATES_KEY], (r) => {
      const current = Number(r[ACCOUNT_TEMPLATE_ID_SEQ_KEY] || 0);
      const list = r[ACCOUNT_TEMPLATES_KEY] || [];
      const maxInList = list.reduce((max, item) => {
        const n = Number(item?.id);
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0);
      const next = Math.max(current, maxInList) + 1;
      chrome.storage.local.set({ [ACCOUNT_TEMPLATE_ID_SEQ_KEY]: next }, () => res(String(next)));
    })
  );
