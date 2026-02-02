// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 云同步 Hook ==========

import { useState, useEffect, useCallback, useRef } from "react";
import { getAuth, clearAuth, getSyncMeta, setSyncMeta } from "../../../services/storage.js";
import { buildAccountsSignature, buildCharactersSignature } from "../../../utils/cloudCompare.js";
import { API_BASE_URL } from "../constants.js";
import { normalizeTimestamp } from "../utils.js";

/**
 * 云同步 Hook
 * @param {Object} options
 * @param {Function} options.t - 翻译函数
 * @param {boolean} options.syncAccountSensitive - 是否同步敏感账号信息
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
 * @param {Function} options.showMessage - 显示消息提示
 */
export function useCloudSync({
  t,
  syncAccountSensitive,
  accountTemplates,
  templates,
  selectedAccountTemplateId,
  selectedTemplateId,
  setAccounts,
  applyAccountTemplatesWithDefault,
  applyTemplatesWithDefault,
  persist,
  showMessage,
}) {
  const [authToken, setAuthToken] = useState(null);
  const [accountsSyncAt, setAccountsSyncAt] = useState(null);
  const [charactersSyncAt, setCharactersSyncAt] = useState(null);
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

  const syncTimerRef = useRef(null);
  const sensitiveSyncTimerRef = useRef(null);
  const forceAccountsSyncingRef = useRef(false);
  const syncSensitiveInitRef = useRef(false);
  const prevSyncSensitiveRef = useRef(null);
  const lastSyncedAccountsSigRef = useRef(null);
  const lastSyncedCharactersSigRef = useRef(null);
  const isInitializedRef = useRef(false);
  const cloudInitTokenRef = useRef(null);
  const accountTemplatesRef = useRef([]);
  const templatesRef = useRef([]);

  // Keep refs in sync with state
  useEffect(() => { accountTemplatesRef.current = accountTemplates; }, [accountTemplates]);
  useEffect(() => { templatesRef.current = templates; }, [templates]);

  // ========== 辅助函数 ==========
  const normalizeListId = useCallback((id) => (id === undefined || id === null ? "" : String(id)), []);

  const sanitizeAccountsForCloud = useCallback((list) => {
    if (!Array.isArray(list)) return [];
    return list
      .map((acc) => ({
        game_uid: acc?.game_uid || acc?.gameUid || "",
        username: acc?.username || "",
        cookie: acc?.cookie || "",
        cookieUpdatedAt: acc?.cookieUpdatedAt ?? acc?.cookie_updated_at ?? null,
        ...(syncAccountSensitive
          ? {
              email: acc?.email || "",
              password: acc?.password || "",
            }
          : {}),
      }))
      .filter((acc) => acc.game_uid || acc.cookie || acc.username);
  }, [syncAccountSensitive]);

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
          email: remoteAcc?.email ?? local[idx]?.email ?? "",
          password: remoteAcc?.password ?? local[idx]?.password ?? "",
          cookie: remoteAcc?.cookie || local[idx]?.cookie || "",
          cookieUpdatedAt: cookieUpdatedAt ?? local[idx]?.cookieUpdatedAt ?? null,
          game_uid: remoteAcc?.game_uid || remoteAcc?.gameUid || local[idx]?.game_uid || local[idx]?.gameUid || "",
          enabled: remoteAcc?.enabled ?? local[idx]?.enabled,
        };
      } else {
        local.push({ ...remoteAcc, cookieUpdatedAt });
      }
    });

    return local;
  }, []);

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
    await setSyncMeta({ accountsLastSyncAt: updatedAt });
    setAccountsSyncAt(updatedAt);
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
    await setSyncMeta({ charactersLastSyncAt: updatedAt });
    setCharactersSyncAt(updatedAt);
  }, [authToken, normalizeCharacterLists, uploadCloudData]);

  const syncAccountsNow = useCallback(async (lists) => {
    if (!authToken) return;
    const payloadLists = Array.isArray(lists) ? lists : accountTemplatesRef.current;
    setAccountsSyncing(true);
    try {
      await syncAccountsToCloud(payloadLists);
      lastSyncedAccountsSigRef.current = buildAccountListsSignature(payloadLists);
    } finally {
      forceAccountsSyncingRef.current = false;
      setAccountsSyncing(false);
    }
  }, [authToken, buildAccountListsSignature, syncAccountsToCloud]);

  const flushPendingSync = useCallback(async ({ useKeepalive = false } = {}) => {
    if (!authToken) return;

    const currentAccountTemplates = accountTemplatesRef.current;
    const currentTemplates = templatesRef.current;

    const accountsSig = buildAccountListsSignature(currentAccountTemplates);
    const charactersSig = buildCharacterListsSignature(currentTemplates);

    const shouldSyncAccounts = accountsSig !== lastSyncedAccountsSigRef.current;
    const shouldSyncCharacters = charactersSig !== lastSyncedCharactersSigRef.current;

    if (!shouldSyncAccounts && !shouldSyncCharacters) return;

    try {
      if (shouldSyncAccounts) {
        if (useKeepalive) {
          fetch(`${API_BASE_URL}/accounts`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ lists: normalizeAccountLists(currentAccountTemplates).map((item) => ({
              id: item.id,
              name: item.name,
              data: sanitizeAccountsForCloud(item.data || []),
            })) }),
            keepalive: true,
          }).catch(() => {});
        } else {
          await syncAccountsToCloud(currentAccountTemplates);
        }
        lastSyncedAccountsSigRef.current = accountsSig;
      }

      if (shouldSyncCharacters) {
        if (useKeepalive) {
          fetch(`${API_BASE_URL}/characters`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ lists: normalizeCharacterLists(currentTemplates).map((item) => ({
              id: item.id,
              name: item.name,
              data: item.data,
            })) }),
            keepalive: true,
          }).catch(() => {});
        } else {
          await syncCharactersToCloud(currentTemplates);
        }
        lastSyncedCharactersSigRef.current = charactersSig;
      }
    } catch (error) {
      console.error("Cloud auto-sync failed:", error);
    } finally {
      setAccountsSyncing(buildAccountListsSignature(currentAccountTemplates) !== lastSyncedAccountsSigRef.current);
      setCharactersSyncing(buildCharacterListsSignature(currentTemplates) !== lastSyncedCharactersSigRef.current);
    }
  }, [authToken, syncAccountsToCloud, syncCharactersToCloud, normalizeAccountLists, normalizeCharacterLists, buildAccountListsSignature, buildCharacterListsSignature, sanitizeAccountsForCloud]);

  // ========== 冲突处理 ==========
  const handleConflictUseLocal = useCallback(async () => {
    if (!authToken) return;
    try {
      if (syncConflict.hasAccounts && syncConflict.localAccounts) {
        const uploadResp = await uploadCloudData("/accounts", authToken, { lists: buildCloudAccountLists(syncConflict.localAccounts) });
        const updatedAt = normalizeTimestamp(uploadResp?.updated_at) || Date.now();
        await setSyncMeta({ accountsLastSyncAt: updatedAt });
      }
      if (syncConflict.hasCharacters && syncConflict.localCharacters) {
        const uploadResp = await uploadCloudData("/characters", authToken, { lists: normalizeCharacterLists(syncConflict.localCharacters) });
        const updatedAt = normalizeTimestamp(uploadResp?.updated_at) || Date.now();
        await setSyncMeta({ charactersLastSyncAt: updatedAt });
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
        }
        if (syncConflict.remoteAccountsUpdatedAt) {
          await setSyncMeta({ accountsLastSyncAt: syncConflict.remoteAccountsUpdatedAt });
        }
      }
      if (syncConflict.hasCharacters && syncConflict.remoteCharacters) {
        const remoteLists = normalizeCharacterLists(syncConflict.remoteCharacters);
        await applyTemplatesWithDefault(remoteLists, selectedTemplateId || "");
        if (syncConflict.remoteCharactersUpdatedAt) {
          await setSyncMeta({ charactersLastSyncAt: syncConflict.remoteCharactersUpdatedAt });
        }
      }
      setSyncConflict((prev) => ({ ...prev, open: false }));
      showMessage(t("sync.useCloud") || "云覆盖本地", "success");
    } catch (error) {
      console.error(error);
      showMessage(t("importError") || "导入失败", "error");
    }
  }, [syncConflict, normalizeAccountLists, normalizeCharacterLists, mergeAccountLists, accountTemplates, selectedAccountTemplateId, selectedTemplateId, applyAccountTemplatesWithDefault, applyTemplatesWithDefault, setAccounts, persist, showMessage, t]);

  const handleConflictLogout = useCallback(async () => {
    await clearAuth();
    setAuthToken(null);
    setSyncConflict((prev) => ({ ...prev, open: false }));
    showMessage(t("sync.logout") || "退出登录", "info");
  }, [showMessage, t]);

  // ========== 初始化和监听 ==========
  useEffect(() => {
    getAuth().then((auth) => {
      if (auth?.token && auth?.username) {
        setAuthToken(auth.token);
      }
    });
    getSyncMeta().then((meta) => {
      setAccountsSyncAt(normalizeTimestamp(meta?.accountsLastSyncAt));
      setCharactersSyncAt(normalizeTimestamp(meta?.charactersLastSyncAt));
    });
    const authHandler = (changes, area) => {
      if (area === "local" && changes.auth) {
        const next = changes.auth.newValue;
        if (next?.token && next?.username) {
          setAuthToken(next.token);
        } else {
          setAuthToken(null);
          cloudInitTokenRef.current = null;
          setSyncConflict((prev) => ({ ...prev, open: false }));
        }
      }
      if (area === "local" && changes.syncMeta) {
        const next = changes.syncMeta.newValue || {};
        setAccountsSyncAt(normalizeTimestamp(next?.accountsLastSyncAt));
        setCharactersSyncAt(normalizeTimestamp(next?.charactersLastSyncAt));
        // 监听来自 popup 的同步状态
        if (next?.accountsSyncing !== undefined) {
          setAccountsSyncing(next.accountsSyncing);
        }
        if (next?.charactersSyncing !== undefined) {
          setCharactersSyncing(next.charactersSyncing);
        }
      }
    };
    chrome.storage.onChanged.addListener(authHandler);
    return () => chrome.storage.onChanged.removeListener(authHandler);
  }, []);

  // 敏感信息同步变化时触发同步
  useEffect(() => {
    if (!authToken || !isInitializedRef.current) return;
    if (!accountTemplatesRef.current.length) return;
    if (!syncSensitiveInitRef.current) return;
    if (prevSyncSensitiveRef.current === syncAccountSensitive) return;
    prevSyncSensitiveRef.current = syncAccountSensitive;
    if (sensitiveSyncTimerRef.current) {
      clearTimeout(sensitiveSyncTimerRef.current);
    }
    forceAccountsSyncingRef.current = true;
    setAccountsSyncing(true);
    sensitiveSyncTimerRef.current = setTimeout(() => {
      syncAccountsNow(accountTemplatesRef.current);
    }, 3000);
    return () => {
      if (sensitiveSyncTimerRef.current) {
        clearTimeout(sensitiveSyncTimerRef.current);
      }
      if (!forceAccountsSyncingRef.current) {
        setAccountsSyncing(false);
      }
    };
  }, [authToken, syncAccountSensitive, syncAccountsNow]);

  // 自动同步
  useEffect(() => {
    if (!authToken || !isInitializedRef.current) return;

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    const accountsDirty = buildAccountListsSignature(accountTemplates) !== lastSyncedAccountsSigRef.current;
    const charactersDirty = buildCharacterListsSignature(templates) !== lastSyncedCharactersSigRef.current;
    setAccountsSyncing(forceAccountsSyncingRef.current || accountsDirty);
    setCharactersSyncing(charactersDirty);

    if (!accountsDirty && !charactersDirty) return;

    syncTimerRef.current = setTimeout(() => {
      flushPendingSync().catch(() => {});
    }, 3000);

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, [accountTemplates, templates, authToken, flushPendingSync, buildAccountListsSignature, buildCharacterListsSignature]);

  // 页面卸载时同步
  useEffect(() => {
    if (!authToken) return;
    const handleBeforeUnload = () => {
      flushPendingSync({ useKeepalive: true }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [authToken, flushPendingSync]);

  // 标记敏感信息设置已初始化（传入当前设置值以正确记录初始状态）
  const setSyncSensitiveInit = useCallback((value, currentSensitiveValue) => {
    syncSensitiveInitRef.current = value;
    // 使用传入的当前值，避免闭包问题
    prevSyncSensitiveRef.current = currentSensitiveValue !== undefined ? currentSensitiveValue : syncAccountSensitive;
  }, [syncAccountSensitive]);

  return {
    // 状态
    authToken,
    accountsSyncAt,
    charactersSyncAt,
    accountsSyncing,
    charactersSyncing,
    syncConflict,
    isInitializedRef,
    cloudInitTokenRef,
    lastSyncedAccountsSigRef,
    lastSyncedCharactersSigRef,
    forceAccountsSyncingRef,

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
    flushPendingSync,

    // 冲突处理
    setSyncConflict,
    handleConflictUseLocal,
    handleConflictUseCloud,
    handleConflictLogout,

    // 初始化
    setAuthToken,
    setAccountsSyncing,
    setCharactersSyncing,
    setSyncSensitiveInit,
  };
}

export default useCloudSync;
