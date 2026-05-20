// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 云同步 Hook ==========

import { useState, useEffect, useCallback, useRef } from "react";
import { getSyncMeta, setSyncMeta, getAuth, setAuth as persistAuth, clearAuth as clearAuthStorage } from "../../../services/storage.js";
import { buildAccountsSignature, buildCharactersSignature } from "../../../utils/cloudCompare.js";
import { getManualCloudConfirmationKind } from "../../../utils/manualCloudSync.js";
import { API_BASE_URL } from "../constants.js";
import { normalizeTimestamp } from "../utils.js";

/**
 * 云同步 Hook
 * @param {Object} options
 * @param {Function} options.t - 翻译函数
 * @param {boolean} options.syncAccountEmail - 是否同步账号邮箱
 * @param {boolean} options.syncAccountPassword - 是否同步账号密码
 * @param {Array} options.accountTemplates - 账号模板列表
 * @param {Array} options.templates - 角色模板列表
 * @param {string} options.selectedAccountTemplateId - 当前选中的账号模板ID
 * @param {string} options.selectedTemplateId - 当前选中的角色模板ID
 * @param {Function} options.setAccounts - 设置账号列表
 * @param {Function} options.setAccountTemplates - 设置账号模板列表
 * @param {Function} options.setTemplates - 设置角色模板列表
 * @param {Function} options.applyAccountTemplatesWithDefault - 应用账号模板并设置默认值
 * @param {Function} options.applyTemplatesWithDefault - 应用角色模板并设置默认值
 * @param {Function} options.persist - 持久化账号数据
 * @param {Function} options.setCharactersData - 设置角色数据
 * @param {Function} options.persistCharacters - 持久化角色数据
 * @param {Function} options.showMessage - 显示消息提示
 */
export function useCloudSync({
  t,
  syncAccountEmail,
  syncAccountPassword,
  accountTemplates,
  templates,
  selectedAccountTemplateId,
  selectedTemplateId,
  setAccounts,
  setCharactersData,
  applyAccountTemplatesWithDefault,
  applyTemplatesWithDefault,
  persist,
  persistCharacters,
  showMessage,
  onAccountsOverridden,
}) {
  const [authToken, setAuthToken] = useState(null);
  const [accountsSyncAt, setAccountsSyncAt] = useState(null);
  const [charactersSyncAt, setCharactersSyncAt] = useState(null);
  const [accountsLocalUpdatedAt, setAccountsLocalUpdatedAt] = useState(null);
  const [charactersLocalUpdatedAt, setCharactersLocalUpdatedAt] = useState(null);
  const [accountsSyncing, setAccountsSyncing] = useState(false);
  const [charactersSyncing, setCharactersSyncing] = useState(false);
  const [syncConflict, setSyncConflict] = useState({
    open: false,
    hasAccounts: false,
    localAccounts: null,
    remoteAccounts: null,
    remoteAccountsUpdatedAt: null,
    hasCharacters: false,
    localCharacters: null,
    remoteCharacters: null,
    remoteCharactersUpdatedAt: null,
  });

  const lastSyncedAccountsSigRef = useRef(null);
  const lastSyncedCharactersSigRef = useRef(null);
  const observedAccountsSigRef = useRef(null);
  const observedCharactersSigRef = useRef(null);
  const observedAccountsReadyRef = useRef(false);
  const observedCharactersReadyRef = useRef(false);
  const suppressNextAccountsLocalChangeRef = useRef(false);
  const suppressNextCharactersLocalChangeRef = useRef(false);
  const accountTemplatesRef = useRef([]);
  const templatesRef = useRef([]);
  const EXIA_WEB_ORIGIN = "https://exia.nikke.cc";
  const EXIA_WEB_LOGIN_URL = `${EXIA_WEB_ORIGIN}/login`;

  // Keep refs in sync with state
  useEffect(() => { accountTemplatesRef.current = accountTemplates; }, [accountTemplates]);
  useEffect(() => { templatesRef.current = templates; }, [templates]);

  const waitForTabComplete = useCallback((tabId) => new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  }), []);

  const requestWebsiteAuth = useCallback(async (tabId) => {
    try {
      const resp = await chrome.tabs.sendMessage(tabId, { type: "EXIA_AUTH_REQUEST" });
      return resp?.auth || null;
    } catch {
      return null;
    }
  }, []);

  const syncAuthFromWebsite = useCallback(async () => {
    const tabs = await chrome.tabs.query({ url: `${EXIA_WEB_ORIGIN}/*` });
    let tabId = tabs?.[0]?.id;
    let createdTabId;
    if (!tabId) {
      const tab = await chrome.tabs.create({ url: EXIA_WEB_ORIGIN, active: false });
      tabId = tab.id;
      createdTabId = tab.id;
      if (tabId) await waitForTabComplete(tabId);
    }
    if (!tabId) return null;
    const auth = await requestWebsiteAuth(tabId);
    if (createdTabId) {
      chrome.tabs.remove(createdTabId);
    }
    if (auth?.token) {
      setAuthToken(auth.token);
      return auth;
    }
    return null;
  }, [EXIA_WEB_ORIGIN, requestWebsiteAuth, waitForTabComplete]);

  const clearWebsiteAuth = useCallback(async () => {
    const tabs = await chrome.tabs.query({ url: `${EXIA_WEB_ORIGIN}/*` });
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
      await chrome.tabs.sendMessage(tabId, { type: "EXIA_AUTH_CLEAR" });
    } finally {
      if (createdTabId) chrome.tabs.remove(createdTabId);
    }
  }, [EXIA_WEB_LOGIN_URL, EXIA_WEB_ORIGIN, waitForTabComplete]);

  // ========== 辅助函数 ==========
  const normalizeListId = useCallback((id) => (id === undefined || id === null ? "" : String(id)), []);

  const sanitizeAccountsForCloud = useCallback((list) => {
    if (!Array.isArray(list)) return [];
    return list
      .map((acc) => ({
        game_uid: acc?.game_uid || acc?.gameUid || "",
        game_openid: acc?.game_openid || acc?.gameOpenId || "",
        username: acc?.username || "",
        cookie: acc?.cookie || "",
        cookieUpdatedAt: acc?.cookieUpdatedAt ?? acc?.cookie_updated_at ?? null,
        ...(syncAccountEmail ? { email: acc?.email || "" } : {}),
        ...(syncAccountPassword ? { password: acc?.password || "" } : {}),
      }))
      .filter((acc) => acc.game_uid || acc.cookie);
  }, [syncAccountEmail, syncAccountPassword]);

  const mergeCloudAccounts = useCallback((localList, remoteList) => {
    const local = Array.isArray(localList) ? [...localList] : [];
    const remote = Array.isArray(remoteList) ? remoteList : [];

    const findKey = (acc) => acc?.game_uid || acc?.gameUid || acc?.cookie;

    remote.forEach((remoteAcc) => {
      const key = findKey(remoteAcc);
      if (!key) {
        local.push({ ...remoteAcc });
        return;
      }
      const idx = local.findIndex((acc) => findKey(acc) === key);
      const cookieUpdatedAt = remoteAcc?.cookieUpdatedAt ?? remoteAcc?.cookie_updated_at ?? null;
      if (idx >= 0) {
        local[idx] = {
          ...local[idx],
          username: remoteAcc?.username || local[idx]?.username || "",
          email: syncAccountEmail ? (remoteAcc?.email ?? local[idx]?.email ?? "") : (local[idx]?.email ?? ""),
          password: syncAccountPassword ? (remoteAcc?.password ?? local[idx]?.password ?? "") : (local[idx]?.password ?? ""),
          cookie: remoteAcc?.cookie || local[idx]?.cookie || "",
          cookieUpdatedAt: cookieUpdatedAt ?? local[idx]?.cookieUpdatedAt ?? null,
          game_uid: remoteAcc?.game_uid || remoteAcc?.gameUid || local[idx]?.game_uid || local[idx]?.gameUid || "",
          game_openid: remoteAcc?.game_openid || remoteAcc?.gameOpenId || local[idx]?.game_openid || local[idx]?.gameOpenId || "",
          enabled: remoteAcc?.enabled ?? local[idx]?.enabled,
        };
      } else {
        local.push({ ...remoteAcc, cookieUpdatedAt });
      }
    });

    return local;
  }, [syncAccountEmail, syncAccountPassword]);

  const normalizeAccountLists = useCallback((lists) => {
    if (!Array.isArray(lists)) return [];
    return lists
      .map((item) => ({
        id: normalizeListId(item?.id),
        name: item?.name || "",
        data: Array.isArray(item?.data) ? item.data : (Array.isArray(item?.accounts) ? item.accounts : []),
      }))
      .filter((item) => item.id || item.name)
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [normalizeListId]);

  const buildCloudAccountLists = useCallback((lists) => {
    return normalizeAccountLists(lists).map((item) => ({
      id: item.id,
      name: item.name,
      data: sanitizeAccountsForCloud(item.data || []),
    }));
  }, [normalizeAccountLists, sanitizeAccountsForCloud]);

  const mergeAccountLists = useCallback((localLists, remoteLists) => {
    const localNormalized = normalizeAccountLists(localLists);
    const remoteNormalized = normalizeAccountLists(remoteLists);
    const localMap = new Map(localNormalized.map((item) => [item.id, item]));
    return remoteNormalized.map((remoteItem) => {
      const localItem = localMap.get(remoteItem.id);
      if (!localItem) return remoteItem;
      return {
        ...remoteItem,
        name: remoteItem.name || localItem.name || "",
        data: mergeCloudAccounts(localItem.data || [], remoteItem.data || []),
      };
    });
  }, [normalizeAccountLists, mergeCloudAccounts]);

  const normalizeCharacterLists = useCallback((lists) => {
    if (!Array.isArray(lists)) return [];
    return lists
      .map((item) => ({
        id: normalizeListId(item?.id),
        name: item?.name || "",
        data: item?.data || item?.characters || null,
      }))
      .filter((item) => item.id || item.name)
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [normalizeListId]);

  const buildAccountListsSignature = useCallback((lists) => {
    const normalized = buildCloudAccountLists(lists).map((item) => ({
      id: item.id,
      name: item.name,
      dataSig: buildAccountsSignature(item.data || []),
    }));
    return JSON.stringify(normalized);
  }, [buildCloudAccountLists]);

  const buildCharacterListsSignature = useCallback((lists) => {
    const normalized = normalizeCharacterLists(lists).map((item) => ({
      id: item.id,
      name: item.name,
      dataSig: buildCharactersSignature(item.data || {}),
    }));
    return JSON.stringify(normalized);
  }, [normalizeCharacterLists]);

  useEffect(() => {
    if (!Array.isArray(accountTemplates) || !accountTemplates.length) return;
    const signature = buildAccountListsSignature(accountTemplates);
    if (!observedAccountsReadyRef.current) {
      observedAccountsReadyRef.current = true;
      observedAccountsSigRef.current = signature;
      return;
    }
    if (signature === observedAccountsSigRef.current) return;
    observedAccountsSigRef.current = signature;
    if (suppressNextAccountsLocalChangeRef.current) {
      suppressNextAccountsLocalChangeRef.current = false;
      return;
    }
    const changedAt = Date.now();
    setAccountsLocalUpdatedAt(changedAt);
    setSyncMeta({ accountsLocalUpdatedAt: changedAt }).catch(() => {});
  }, [accountTemplates, buildAccountListsSignature]);

  useEffect(() => {
    if (!Array.isArray(templates) || !templates.length) return;
    const signature = buildCharacterListsSignature(templates);
    if (!observedCharactersReadyRef.current) {
      observedCharactersReadyRef.current = true;
      observedCharactersSigRef.current = signature;
      return;
    }
    if (signature === observedCharactersSigRef.current) return;
    observedCharactersSigRef.current = signature;
    if (suppressNextCharactersLocalChangeRef.current) {
      suppressNextCharactersLocalChangeRef.current = false;
      return;
    }
    const changedAt = Date.now();
    setCharactersLocalUpdatedAt(changedAt);
    setSyncMeta({ charactersLocalUpdatedAt: changedAt }).catch(() => {});
  }, [templates, buildCharacterListsSignature]);

  // ========== API 调用 ==========
  const fetchCloudData = useCallback(async (path, token) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Cloud fetch failed: ${path}`);
    return res.json();
  }, []);

  const uploadCloudData = useCallback(async (path, token, payload) => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Cloud upload failed: ${path}`);
    return res.json();
  }, []);

  // ========== 同步操作 ==========
  const syncAccountsToCloud = useCallback(async (lists) => {
    if (!authToken) return;
    const payload = buildCloudAccountLists(lists);
    const uploadResp = await uploadCloudData("/accounts", authToken, { lists: payload });
    const updatedAt = normalizeTimestamp(uploadResp?.updated_at) || Date.now();
    await setSyncMeta({ accountsLastSyncAt: updatedAt, accountsLocalUpdatedAt: updatedAt });
    setAccountsSyncAt(updatedAt);
    setAccountsLocalUpdatedAt(updatedAt);
  }, [authToken, buildCloudAccountLists, uploadCloudData]);

  const syncCharactersToCloud = useCallback(async (lists) => {
    if (!authToken) return;
    const payload = normalizeCharacterLists(lists).map((item) => ({
      id: item.id,
      name: item.name,
      data: item.data,
    }));
    const uploadResp = await uploadCloudData("/characters", authToken, { lists: payload });
    const updatedAt = normalizeTimestamp(uploadResp?.updated_at) || Date.now();
    await setSyncMeta({ charactersLastSyncAt: updatedAt, charactersLocalUpdatedAt: updatedAt });
    setCharactersSyncAt(updatedAt);
    setCharactersLocalUpdatedAt(updatedAt);
  }, [authToken, normalizeCharacterLists, uploadCloudData]);

  const syncAccountsNow = useCallback(async (lists) => {
    if (!authToken) return;
    const payloadLists = Array.isArray(lists) ? lists : accountTemplatesRef.current;
    setAccountsSyncing(true);
    try {
      await syncAccountsToCloud(payloadLists);
      lastSyncedAccountsSigRef.current = buildAccountListsSignature(payloadLists);
    } finally {
      setAccountsSyncing(false);
    }
  }, [authToken, buildAccountListsSignature, syncAccountsToCloud]);

  const tr = useCallback((key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  }, [t]);

  const confirmManualCloudAction = useCallback((action, remoteUpdatedAt, localUpdatedAt) => {
    const kind = getManualCloudConfirmationKind({ action, remoteUpdatedAt, localUpdatedAt });
    if (!kind) return true;
    const message = kind === "cloud-newer"
      ? tr("sync.confirmCloudNewer", "云端数据比本地记录更新，继续上传会覆盖云端。是否继续？")
      : tr("sync.confirmCloudOlder", "云端数据比本地记录更旧，继续下载会覆盖本地较新的记录。是否继续？");
    return window.confirm(message);
  }, [tr]);

  const handleManualUploadAccounts = useCallback(async () => {
    if (!authToken) {
      showMessage(tr("sync.notLoggedIn", "未登录，跳过云同步"), "warning");
      return;
    }

    setAccountsSyncing(true);
    try {
      const remoteResp = await fetchCloudData("/accounts", authToken);
      const remoteUpdatedAt = normalizeTimestamp(remoteResp?.updated_at);
      if (!confirmManualCloudAction("upload", remoteUpdatedAt, accountsLocalUpdatedAt || accountsSyncAt)) return;

      const currentLists = accountTemplatesRef.current;
      await syncAccountsToCloud(currentLists);
      lastSyncedAccountsSigRef.current = buildAccountListsSignature(currentLists);
      showMessage(tr("sync.uploadSuccess", "已上传到云端"), "success");
    } catch (error) {
      console.error(error);
      showMessage(tr("sync.failed", "云同步失败"), "error");
    } finally {
      setAccountsSyncing(false);
    }
  }, [authToken, accountsLocalUpdatedAt, accountsSyncAt, fetchCloudData, confirmManualCloudAction, syncAccountsToCloud, buildAccountListsSignature, showMessage, tr]);

  const handleManualUploadCharacters = useCallback(async () => {
    if (!authToken) {
      showMessage(tr("sync.notLoggedIn", "未登录，跳过云同步"), "warning");
      return;
    }

    setCharactersSyncing(true);
    try {
      const remoteResp = await fetchCloudData("/characters", authToken);
      const remoteUpdatedAt = normalizeTimestamp(remoteResp?.updated_at);
      if (!confirmManualCloudAction("upload", remoteUpdatedAt, charactersLocalUpdatedAt || charactersSyncAt)) return;

      const currentLists = templatesRef.current;
      await syncCharactersToCloud(currentLists);
      lastSyncedCharactersSigRef.current = buildCharacterListsSignature(currentLists);
      showMessage(tr("sync.uploadSuccess", "已上传到云端"), "success");
    } catch (error) {
      console.error(error);
      showMessage(tr("sync.failed", "云同步失败"), "error");
    } finally {
      setCharactersSyncing(false);
    }
  }, [authToken, charactersLocalUpdatedAt, charactersSyncAt, fetchCloudData, confirmManualCloudAction, syncCharactersToCloud, buildCharacterListsSignature, showMessage, tr]);

  const handleManualDownloadAccounts = useCallback(async () => {
    if (!authToken) {
      showMessage(tr("sync.notLoggedIn", "未登录，跳过云同步"), "warning");
      return;
    }

    setAccountsSyncing(true);
    try {
      const remoteResp = await fetchCloudData("/accounts", authToken);
      const remoteUpdatedAt = normalizeTimestamp(remoteResp?.updated_at);
      const remoteLists = normalizeAccountLists(remoteResp?.lists);
      if (!remoteLists.length) {
        showMessage(tr("sync.noCloudData", "云端暂无数据"), "warning");
        return;
      }
      if (!confirmManualCloudAction("download", remoteUpdatedAt, accountsLocalUpdatedAt || accountsSyncAt)) return;

      const mergedLists = mergeAccountLists(accountTemplatesRef.current, remoteLists);
      suppressNextAccountsLocalChangeRef.current = true;
      const { list: appliedLists, defaultId } = await applyAccountTemplatesWithDefault(mergedLists, selectedAccountTemplateId || "");
      const appliedId = selectedAccountTemplateId || defaultId || "";
      const applied = appliedLists.find((item) => item.id === appliedId) || appliedLists[0];
      if (applied?.data) {
        setAccounts(applied.data);
        await persist(applied.data);
        if (onAccountsOverridden) onAccountsOverridden(applied.data.length);
      }
      const updatedAt = remoteUpdatedAt || Date.now();
      await setSyncMeta({ accountsLastSyncAt: updatedAt, accountsLocalUpdatedAt: updatedAt });
      setAccountsSyncAt(updatedAt);
      setAccountsLocalUpdatedAt(updatedAt);
      lastSyncedAccountsSigRef.current = buildAccountListsSignature(appliedLists);
      showMessage(tr("sync.downloadSuccess", "已从云端下载"), "success");
    } catch (error) {
      console.error(error);
      showMessage(tr("sync.failed", "云同步失败"), "error");
    } finally {
      setAccountsSyncing(false);
    }
  }, [authToken, accountsLocalUpdatedAt, accountsSyncAt, fetchCloudData, normalizeAccountLists, confirmManualCloudAction, mergeAccountLists, selectedAccountTemplateId, applyAccountTemplatesWithDefault, setAccounts, persist, onAccountsOverridden, buildAccountListsSignature, showMessage, tr]);

  const handleManualDownloadCharacters = useCallback(async () => {
    if (!authToken) {
      showMessage(tr("sync.notLoggedIn", "未登录，跳过云同步"), "warning");
      return;
    }

    setCharactersSyncing(true);
    try {
      const remoteResp = await fetchCloudData("/characters", authToken);
      const remoteUpdatedAt = normalizeTimestamp(remoteResp?.updated_at);
      const remoteLists = normalizeCharacterLists(remoteResp?.lists);
      if (!remoteLists.length) {
        showMessage(tr("sync.noCloudData", "云端暂无数据"), "warning");
        return;
      }
      if (!confirmManualCloudAction("download", remoteUpdatedAt, charactersLocalUpdatedAt || charactersSyncAt)) return;

      suppressNextCharactersLocalChangeRef.current = true;
      const { list: appliedTemplates, defaultId } = await applyTemplatesWithDefault(remoteLists, selectedTemplateId || "");
      const appliedId = selectedTemplateId || defaultId || "";
      const applied = appliedTemplates.find((item) => item.id === appliedId) || appliedTemplates[0];
      if (applied?.data) {
        setCharactersData(applied.data);
        if (persistCharacters) {
          await persistCharacters(applied.data);
        }
      }
      const updatedAt = remoteUpdatedAt || Date.now();
      await setSyncMeta({ charactersLastSyncAt: updatedAt, charactersLocalUpdatedAt: updatedAt });
      setCharactersSyncAt(updatedAt);
      setCharactersLocalUpdatedAt(updatedAt);
      lastSyncedCharactersSigRef.current = buildCharacterListsSignature(appliedTemplates);
      showMessage(tr("sync.downloadSuccess", "已从云端下载"), "success");
    } catch (error) {
      console.error(error);
      showMessage(tr("sync.failed", "云同步失败"), "error");
    } finally {
      setCharactersSyncing(false);
    }
  }, [authToken, charactersLocalUpdatedAt, charactersSyncAt, fetchCloudData, normalizeCharacterLists, confirmManualCloudAction, selectedTemplateId, applyTemplatesWithDefault, setCharactersData, persistCharacters, buildCharacterListsSignature, showMessage, tr]);

  // ========== 冲突处理 ==========
  const handleConflictUseLocal = useCallback(async () => {
    if (!authToken) return;
    try {
      if (syncConflict.hasAccounts && syncConflict.localAccounts) {
        const uploadResp = await uploadCloudData("/accounts", authToken, { lists: buildCloudAccountLists(syncConflict.localAccounts) });
        const updatedAt = normalizeTimestamp(uploadResp?.updated_at) || Date.now();
        await setSyncMeta({ accountsLastSyncAt: updatedAt, accountsLocalUpdatedAt: updatedAt });
        setAccountsSyncAt(updatedAt);
        setAccountsLocalUpdatedAt(updatedAt);
      }
      if (syncConflict.hasCharacters && syncConflict.localCharacters) {
        const uploadResp = await uploadCloudData("/characters", authToken, { lists: normalizeCharacterLists(syncConflict.localCharacters) });
        const updatedAt = normalizeTimestamp(uploadResp?.updated_at) || Date.now();
        await setSyncMeta({ charactersLastSyncAt: updatedAt, charactersLocalUpdatedAt: updatedAt });
        setCharactersSyncAt(updatedAt);
        setCharactersLocalUpdatedAt(updatedAt);
      }
      setSyncConflict((prev) => ({ ...prev, open: false }));
      showMessage(t("sync.useLocal") || "本地上传到云", "success");
    } catch (error) {
      console.error(error);
      showMessage(t("exportError") || "导出失败", "error");
    }
  }, [authToken, syncConflict, buildCloudAccountLists, normalizeCharacterLists, uploadCloudData, showMessage, t]);

  const handleConflictUseCloud = useCallback(async () => {
    try {
      if (syncConflict.hasAccounts && syncConflict.remoteAccounts) {
        const remoteLists = normalizeAccountLists(syncConflict.remoteAccounts);
        const mergedLists = mergeAccountLists(accountTemplates, remoteLists);
        await applyAccountTemplatesWithDefault(mergedLists, selectedAccountTemplateId || "");
        const appliedId = selectedAccountTemplateId || mergedLists[0]?.id || "";
        const applied = mergedLists.find((item) => item.id === appliedId) || mergedLists[0];
        if (applied?.data) {
          setAccounts(applied.data);
          await persist(applied.data);
          if (onAccountsOverridden) onAccountsOverridden(applied.data.length);
        }
        if (syncConflict.remoteAccountsUpdatedAt) {
          await setSyncMeta({ accountsLastSyncAt: syncConflict.remoteAccountsUpdatedAt, accountsLocalUpdatedAt: syncConflict.remoteAccountsUpdatedAt });
          setAccountsSyncAt(syncConflict.remoteAccountsUpdatedAt);
          setAccountsLocalUpdatedAt(syncConflict.remoteAccountsUpdatedAt);
        }
      }
      if (syncConflict.hasCharacters && syncConflict.remoteCharacters) {
        const remoteLists = normalizeCharacterLists(syncConflict.remoteCharacters);
        const { list: appliedTemplates, defaultId } = await applyTemplatesWithDefault(remoteLists, selectedTemplateId || "");
        
        const appliedId = selectedTemplateId || defaultId || "";
        const applied = appliedTemplates.find((item) => item.id === appliedId) || appliedTemplates[0];
        if (applied?.data) {
          setCharactersData(applied.data);
          if (persistCharacters) {
            await persistCharacters(applied.data);
          }
        }
        
        if (syncConflict.remoteCharactersUpdatedAt) {
          await setSyncMeta({ charactersLastSyncAt: syncConflict.remoteCharactersUpdatedAt, charactersLocalUpdatedAt: syncConflict.remoteCharactersUpdatedAt });
          setCharactersSyncAt(syncConflict.remoteCharactersUpdatedAt);
          setCharactersLocalUpdatedAt(syncConflict.remoteCharactersUpdatedAt);
        }
      }
      setSyncConflict((prev) => ({ ...prev, open: false }));
      showMessage(t("sync.useCloud") || "云覆盖本地", "success");
    } catch (error) {
      console.error(error);
      showMessage(t("importError") || "导入失败", "error");
    }
  }, [syncConflict, normalizeAccountLists, normalizeCharacterLists, mergeAccountLists, accountTemplates, selectedAccountTemplateId, selectedTemplateId, applyAccountTemplatesWithDefault, applyTemplatesWithDefault, setAccounts, setCharactersData, persist, persistCharacters, showMessage, t, onAccountsOverridden]);

  const handleConflictLogout = useCallback(async () => {
    await clearWebsiteAuth();
    await clearAuthStorage();
    setAuthToken(null);
    setSyncConflict((prev) => ({ ...prev, open: false }));
    showMessage(t("sync.logout") || "退出登录", "info");
  }, [showMessage, t, clearWebsiteAuth]);

  // 持久化 authToken 到 storage（有 token 时保存，清空由显式登出处理）
  useEffect(() => {
    if (authToken) {
      persistAuth({ token: authToken });
    }
  }, [authToken]);

  // ========== 初始化和监听 ==========
  useEffect(() => {
    // 从持久化存储恢复登录态（不再自动打开隐藏标签页）
    getAuth().then((saved) => {
      if (saved?.token) {
        setAuthToken(saved.token);
      }
    });
    getSyncMeta().then((meta) => {
      setAccountsSyncAt(normalizeTimestamp(meta?.accountsLastSyncAt));
      setCharactersSyncAt(normalizeTimestamp(meta?.charactersLastSyncAt));
      setAccountsLocalUpdatedAt(normalizeTimestamp(meta?.accountsLocalUpdatedAt));
      setCharactersLocalUpdatedAt(normalizeTimestamp(meta?.charactersLocalUpdatedAt));
    });
    const storageHandler = (changes, area) => {
      if (area === "local") {
        if (changes.syncMeta) {
          const next = changes.syncMeta.newValue || {};
          setAccountsSyncAt(normalizeTimestamp(next?.accountsLastSyncAt));
          setCharactersSyncAt(normalizeTimestamp(next?.charactersLastSyncAt));
          setAccountsLocalUpdatedAt(normalizeTimestamp(next?.accountsLocalUpdatedAt));
          setCharactersLocalUpdatedAt(normalizeTimestamp(next?.charactersLocalUpdatedAt));
          if (next?.accountsSyncing !== undefined) {
            setAccountsSyncing(next.accountsSyncing);
          }
          if (next?.charactersSyncing !== undefined) {
            setCharactersSyncing(next.charactersSyncing);
          }
        }
        if (changes.auth) {
          const authData = changes.auth.newValue;
          if (authData?.token) {
            setAuthToken(authData.token);
          } else {
            setAuthToken(null);
          }
        }
      }
    };
    chrome.storage.onChanged.addListener(storageHandler);
    return () => chrome.storage.onChanged.removeListener(storageHandler);
  }, []);

  useEffect(() => {
    const handler = (msg) => {
      if (msg?.type !== "EXIA_AUTH") return;
      const payload = msg.payload || {};
      if (payload.type === "auth:status") {
        if (payload.loggedIn) {
          // 网站发出登录信号，同步 token
          syncAuthFromWebsite().catch(() => {
            // ignore sync errors
          });
          return;
        }
        // 网站明确发出退出信号，清除本地登录态
        setAuthToken(null);
        clearAuthStorage();
        setSyncConflict((prev) => ({ ...prev, open: false }));
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [syncAuthFromWebsite]);

  return {
    // 状态
    authToken,
    accountsSyncAt,
    charactersSyncAt,
    accountsSyncing,
    charactersSyncing,
    syncConflict,
    lastSyncedAccountsSigRef,
    lastSyncedCharactersSigRef,

    // 辅助函数
    sanitizeAccountsForCloud,
    normalizeAccountLists,
    normalizeCharacterLists,
    buildCloudAccountLists,
    buildAccountListsSignature,
    buildCharacterListsSignature,
    mergeAccountLists,

    // 同步操作
    fetchCloudData,
    uploadCloudData,
    syncAccountsToCloud,
    syncCharactersToCloud,
    syncAccountsNow,
    handleManualUploadAccounts,
    handleManualDownloadAccounts,
    handleManualUploadCharacters,
    handleManualDownloadCharacters,

    // 冲突处理
    setSyncConflict,
    handleConflictUseLocal,
    handleConflictUseCloud,
    handleConflictLogout,

    // 初始化
    setAuthToken,
    setAccountsSyncing,
    setCharactersSyncing,
  };
}

export default useCloudSync;
