// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 认证 Hook ==========

import { useState, useEffect, useCallback } from "react";
import { fetchProfile } from "../utils.js";
import { getAuth, setAuth, clearAuth as clearAuthStorage } from "../../../services/storage.js";

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

  // 持久化 auth 状态到 storage（仅在有 token 时保存）
  useEffect(() => {
    if (authToken) {
      setAuth({ token: authToken, username: authUsername, avatar_url: authAvatarUrl });
    }
  }, [authToken, authUsername, authAvatarUrl]);

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
    } else if (openLogin) {
      // 标签页已存在，激活并导航到登录页
      await chrome.tabs.update(tabId, { url: EXIA_WEB_LOGIN_URL, active: true });
    }

    if (tabId) {
      await waitForTabComplete(tabId);
    }

    if (!tabId) return null;

    // 如果是手动打开登录页，不需要立即读取 auth
    // 用户登录后网站会通过 EXIA_AUTH 消息通知插件
    if (openLogin) return null;

    // Try to request auth, with retries if communication fails
    let result = { success: false, auth: null };
    for (let i = 0; i < 3; i++) {
      result = await requestWebsiteAuth(tabId);
      if (result.success) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    
    const auth = result.success ? result.auth : null;

    if (auth?.token) {
      setAuthToken(auth.token);
      setAuthUsername(auth.username || null);
      setAuthAvatarUrl(auth.avatar_url || null);
      // 同时保存到 storage
      setAuth({ token: auth.token, username: auth.username, avatar_url: auth.avatar_url });
    }

    if (createdTabId) {
      chrome.tabs.remove(createdTabId);
    }

    return auth || null;
  }, [EXIA_WEB_LOGIN_URL, EXIA_WEB_ORIGIN, requestWebsiteAuth, waitForTabComplete]);

  // 启动时从持久化存储恢复登录态（不再自动打开隐藏标签页）
  useEffect(() => {
    getAuth().then((saved) => {
      if (saved?.token) {
        setAuthToken(saved.token);
        setAuthUsername(saved.username || null);
        setAuthAvatarUrl(saved.avatar_url || null);
      }
    });
  }, []);

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
        // 网站明确发出退出信号，清除本地登录态
        if (authToken) {
          setAuthToken(null);
          setAuthUsername(null);
          setAuthAvatarUrl(null);
          clearAuthStorage(); // 清除 storage
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
          // 更新 storage
          setAuth({ token: authToken, username: authUsername, avatar_url: profile.avatar_url });
        }
        if (profile?.username && !authUsername) {
          setAuthUsername(profile.username);
           // 更新 storage
          setAuth({ token: authToken, username: profile.username, avatar_url: authAvatarUrl });
        }
      })
      .catch(() => {});
  }, [authToken, authAvatarUrl, authUsername]);

  const openLoginDialog = useCallback(() => {
    // 仅打开/激活登录页面，不等待结果
    // 用户在网页上登录后，content script 会发送 EXIA_AUTH 消息自动同步
    syncAuthFromWebsite({ openLogin: true }).catch(() => {});
  }, [syncAuthFromWebsite]);

  const handleLogout = useCallback(() => {
    setAuthToken(null);
    setAuthUsername(null);
    setAuthAvatarUrl(null);
    clearAuthStorage(); // 清除 storage
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

