// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 认证 Hook ==========

import { useState, useEffect, useCallback } from "react";
import { fetchProfile } from "../utils.js";

/**
 * 认证状态管理 Hook
 * @param {Object} options
 * @param {Function} options.t - 翻译函数
 * @param {Function} options.showMessage - 显示消息提示
 */
const WEB_URL_PATTERNS = ["*://exia.nikke.cc/*", "*://*.exia.nikke.cc/*"];

export function useAuth({ t, showMessage }) {
  const EXIA_WEB_ORIGIN = "https://exia.nikke.cc";
  const EXIA_WEB_LOGIN_URL = `${EXIA_WEB_ORIGIN}/login`;
  const EXIA_WEB_AUTH_KEY = "exia-analysis-auth";
  const [authToken, setAuthToken] = useState(null);
  const [authUsername, setAuthUsername] = useState(null);
  const [authAvatarUrl, setAuthAvatarUrl] = useState(null);
  const [authAnchorEl, setAuthAnchorEl] = useState(null);

  const requestWebsiteAuth = useCallback(async (tabId) => {
    try {
      const resp = await chrome.tabs.sendMessage(tabId, { type: "EXIA_AUTH_REQUEST" });
      return { success: true, auth: resp?.auth || null };
    } catch {
      return { success: false, auth: null };
    }
  }, []);

  const waitForTabComplete = useCallback((tabId) => new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        resolve(); // Tab might be closed
        return;
      }
      if (tab.status === "complete") {
        resolve();
      } else {
        const listener = (id, info) => {
          if (id === tabId && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      }
    });
  }), []);

  const clearWebsiteAuth = useCallback(async () => {
    const tabs = await chrome.tabs.query({ url: WEB_URL_PATTERNS });
    let tabId = tabs?.[0]?.id;
    let createdTabId;
    if (!tabId) {
      const tab = await chrome.tabs.create({ url: EXIA_WEB_LOGIN_URL, active: false });
      tabId = tab.id;
      createdTabId = tab.id;
      if (tabId) await waitForTabComplete(tabId);
    }
    if (!tabId) return;
    try {
      try {
        await chrome.tabs.sendMessage(tabId, { type: "EXIA_AUTH_CLEAR" });
      } catch {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (storageKey) => {
            localStorage.removeItem(storageKey);
            sessionStorage.removeItem(storageKey);
          },
          args: [EXIA_WEB_AUTH_KEY],
        });
      }
    } finally {
      if (createdTabId) {
        chrome.tabs.remove(createdTabId);
      }
    }
  }, [EXIA_WEB_LOGIN_URL, EXIA_WEB_AUTH_KEY, waitForTabComplete]);

  const syncAuthFromWebsite = useCallback(async ({ openLogin = false } = {}) => {
    const tabs = await chrome.tabs.query({ url: WEB_URL_PATTERNS });
    let tabId = tabs?.[0]?.id;
    let createdTabId;

    if (!tabId) {
      const tab = await chrome.tabs.create({
        url: openLogin ? EXIA_WEB_LOGIN_URL : EXIA_WEB_ORIGIN,
        active: Boolean(openLogin),
      });
      tabId = tab.id;
      createdTabId = tab.id;
    }

    if (tabId) {
      await waitForTabComplete(tabId);
    }

    if (!tabId) return null;

    // Try to request auth, with retries if communication fails
    let result = { success: false, auth: null };
    for (let i = 0; i < 3; i++) {
      result = await requestWebsiteAuth(tabId);
      if (result.success) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    
    // If we created a tab and still failed, maybe it needs more time? 
    // But we already waited for complete.
    
    const auth = result.success ? result.auth : null;

    if (auth?.token) {
      setAuthToken(auth.token);
      setAuthUsername(auth.username || null);
      setAuthAvatarUrl(auth.avatar_url || null);
    }

    if (createdTabId && !openLogin) {
      chrome.tabs.remove(createdTabId);
    }

    return auth || null;
  }, [EXIA_WEB_LOGIN_URL, EXIA_WEB_ORIGIN, requestWebsiteAuth, waitForTabComplete]);

  // 启动时尝试从网站读取登录态
  useEffect(() => {
    syncAuthFromWebsite().catch(() => {
      // ignore sync errors
    });
  }, [syncAuthFromWebsite]);

  // 网站与插件登录态双向同步（事件驱动，仅同步登录状态）
  useEffect(() => {
    const handler = (msg) => {
      if (msg?.type !== "EXIA_AUTH") return;
      const payload = msg.payload || {};
      if (payload.type === "auth:status") {
        if (payload.loggedIn) {
          syncAuthFromWebsite().catch(() => {
            // ignore sync errors
          });
          return;
        }
        if (authToken) {
          setAuthToken(null);
          setAuthUsername(null);
          setAuthAvatarUrl(null);
          showMessage(t("auth.logoutSuccess") || "已退出", "info");
        }
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [authToken, showMessage, syncAuthFromWebsite, t]);

  // 获取用户头像
  useEffect(() => {
    if (!authToken || authAvatarUrl) return;
    fetchProfile(authToken)
      .then((profile) => {
        if (profile?.avatar_url) {
          setAuthAvatarUrl(profile.avatar_url);
        }
        if (profile?.username && !authUsername) {
          setAuthUsername(profile.username);
        }
      })
      .catch(() => {});
  }, [authToken, authAvatarUrl, authUsername]);

  const openLoginDialog = useCallback(async () => {
    await syncAuthFromWebsite({ openLogin: true });
    showMessage(t("auth.login") || "登录", "info");
  }, [showMessage, syncAuthFromWebsite, t]);

  const handleLogout = useCallback(() => {
    setAuthToken(null);
    setAuthUsername(null);
    setAuthAvatarUrl(null);
    clearWebsiteAuth().catch(() => {});
    showMessage(t("auth.logoutSuccess") || "已退出", "success");
  }, [t, showMessage, clearWebsiteAuth]);

  const handleAvatarClick = useCallback((event) => {
    setAuthAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAuthAnchorEl(null);
  }, []);

  const handleLogoutClick = useCallback(() => {
    handleMenuClose();
    handleLogout();
  }, [handleMenuClose, handleLogout]);

  return {
    // 状态
    authToken,
    authUsername,
    authAvatarUrl,
    authAnchorEl,
    menuOpen: Boolean(authAnchorEl),

    // 操作
    openLoginDialog,
    handleLogout,
    handleAvatarClick,
    handleMenuClose,
    handleLogoutClick,
  };
}

export default useAuth;
