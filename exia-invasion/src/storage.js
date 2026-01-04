// SPDX-License-Identifier: GPL-3.0-or-later
// 本地存储管理模块

const SETTINGS_KEY  = "settings";   // 设置存储键
const ACCOUNTS_KEY  = "accounts";   // 账号存储键
const CHARACTERS_KEY = "characters"; // 角色存储键
const TEMPLATES_KEY = "characterTemplates"; // 角色模板存储键
const CURRENT_TEMPLATE_KEY = "currentTemplate"; // 当前选中的模板

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

// ========== 账号模板管理 ==========
const ACCOUNT_TEMPLATES_KEY = "accountTemplates"; // 账号模板存储键
const CURRENT_ACCOUNT_TEMPLATE_KEY = "currentAccountTemplate"; // 当前选中的账号模板ID

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
