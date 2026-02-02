// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 认证 Hook ==========

import { useState, useEffect, useCallback, useMemo } from "react";
import { getAuth, setAuth, clearAuth } from "../../../services/storage.js";
import { API_BASE_URL } from "../constants.js";
import { fetchProfile } from "../utils.js";

/**
 * 认证状态管理 Hook
 * @param {Object} options
 * @param {Function} options.t - 翻译函数
 * @param {Function} options.showMessage - 显示消息提示
 */
export function useAuth({ t, showMessage }) {
  const [authToken, setAuthToken] = useState(null);
  const [authUsername, setAuthUsername] = useState(null);
  const [authAvatarUrl, setAuthAvatarUrl] = useState(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authAnchorEl, setAuthAnchorEl] = useState(null);

  // 初始化：从存储加载认证信息
  useEffect(() => {
    getAuth().then((auth) => {
      if (auth?.token && auth?.username) {
        setAuthToken(auth.token);
        setAuthUsername(auth.username);
        setAuthAvatarUrl(auth.avatar_url || null);
      }
    });
  }, []);

  // 持久化认证信息
  useEffect(() => {
    if (authToken && authUsername) {
      setAuth({ token: authToken, username: authUsername, avatar_url: authAvatarUrl });
      return;
    }
    clearAuth();
  }, [authToken, authUsername, authAvatarUrl]);

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

  // 对话框标题
  const authTitle = useMemo(() => {
    return authMode === "login"
      ? (t("auth.titleLogin") || "登录")
      : (t("auth.titleRegister") || "注册");
  }, [authMode, t]);

  const openLoginDialog = useCallback(() => {
    setAuthMode("login");
    setAuthForm({ username: "", password: "" });
    setAuthDialogOpen(true);
  }, []);

  const openRegisterDialog = useCallback(() => {
    setAuthMode("register");
    setAuthForm({ username: "", password: "" });
    setAuthDialogOpen(true);
  }, []);

  const closeAuthDialog = useCallback(() => {
    if (authSubmitting) return;
    setAuthDialogOpen(false);
  }, [authSubmitting]);

  const handleAuthSubmit = useCallback(async () => {
    if (!authForm.username.trim() || !authForm.password.trim()) {
      showMessage(t("auth.required") || "请填写用户名和密码", "warning");
      return;
    }
    setAuthSubmitting(true);
    try {
      const endpoint = authMode === "login" ? "/login" : "/register";
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: authForm.username.trim(),
          password: authForm.password,
        }),
      });

      if (!res.ok) {
        const msg = authMode === "login"
          ? (t("auth.failedLogin") || "登录失败")
          : (t("auth.failedRegister") || "注册失败");
        showMessage(msg, "error");
        return;
      }

      if (authMode === "register") {
        showMessage(t("auth.successRegister") || "注册成功，请登录", "success");
        setAuthMode("login");
        setAuthForm((prev) => ({ ...prev, password: "" }));
        return;
      }

      const data = await res.json();
      if (data?.token) {
        setAuthToken(data.token);
        setAuthUsername(data?.username || authForm.username.trim());
        setAuthAvatarUrl(data?.avatar_url || null);
        setAuthDialogOpen(false);
        showMessage(t("auth.successLogin") || "登录成功", "success");
      } else {
        showMessage(t("auth.failedLogin") || "登录失败", "error");
      }
    } catch {
      const msg = authMode === "login"
        ? (t("auth.failedLogin") || "登录失败")
        : (t("auth.failedRegister") || "注册失败");
      showMessage(msg, "error");
    } finally {
      setAuthSubmitting(false);
    }
  }, [authForm, authMode, t, showMessage]);

  const handleLogout = useCallback(() => {
    setAuthToken(null);
    setAuthUsername(null);
    setAuthAvatarUrl(null);
    showMessage(t("auth.logoutSuccess") || "已退出", "success");
  }, [t, showMessage]);

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
    authDialogOpen,
    authMode,
    authForm,
    authSubmitting,
    authAnchorEl,
    authTitle,
    menuOpen: Boolean(authAnchorEl),

    // 更新表单
    setAuthForm,

    // 操作
    openLoginDialog,
    openRegisterDialog,
    closeAuthDialog,
    handleAuthSubmit,
    handleLogout,
    handleAvatarClick,
    handleMenuClose,
    handleLogoutClick,
  };
}

export default useAuth;
