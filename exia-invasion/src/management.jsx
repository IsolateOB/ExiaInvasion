// SPDX-License-Identifier: GPL-3.0-or-later
// ========== ExiaInvasion 管理页面组件 ==========
// 主要功能：账户管理、角色数据管理、装备统计配置等

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Container,
  Tabs,
  Tab,
  Snackbar,
  Alert,
} from "@mui/material";
import TRANSLATIONS from "./i18n/translations.js";
import { fetchAndCacheNikkeDirectory, getCachedNikkeDirectory } from "./services/api.js";
import { getAccounts, getCharacters, getSettings, setSettings, setSyncMeta } from "./services/storage.js";
import { buildAccountsSignature, normalizeAccountsFromRemote } from "./utils/cloudCompare.js";
import { getNikkeAvatarUrl as buildNikkeAvatarUrl } from "./utils/nikkeAvatar.js";
import ManagementHeader from "./components/management/ManagementHeader.jsx";
import AccountTabContent from "./components/management/AccountTabContent.jsx";
import CharacterTabContent from "./components/management/CharacterTabContent.jsx";
import CharacterFilterDialog from "./components/management/CharacterFilterDialog.jsx";
import SyncConflictDialog from "./components/management/SyncConflictDialog.jsx";
import {
  API_BASE_URL,
  defaultRow,
  equipStatKeys,
  basicStatKeys,
  NIKKE_TOGGLE_COL_COUNT,
  NIKKE_NAME_MIN_WIDTH_PX,
  NIKKE_PRIORITY_WIDTH_PX,
  NIKKE_DRAG_HANDLE_WIDTH_PX,
  NIKKE_TOGGLE_MIN_WIDTH_PX,
  SHOW_STATS_CONFIG_MARKER,
  elementTranslationKeys,
  classTranslationKeys,
  corporationTranslationKeys,
} from "./components/management/constants.js";
import {
  parseGameUidFromCookie,
  normalizeTimestamp,
  getPriorityColor,
} from "./components/management/utils.js";
import { useCloudSync } from "./components/management/hooks/useCloudSync.js";
import { useAccountActions } from "./components/management/hooks/useAccountActions.js";
import { useCharacterActions } from "./components/management/hooks/useCharacterActions.js";
import { useTemplateManagement } from "./components/management/hooks/useTemplateManagement.js";

// ========== 管理页面主组件 ==========

const ManagementPage = () => {
  /* ========== 语言设置同步 ========== */
  const [lang, setLang] = useState("zh");
  const [syncAccountEmail, setSyncAccountEmail] = useState(false);
  const [syncAccountPassword, setSyncAccountPassword] = useState(false);
  const t = useCallback((k) => TRANSLATIONS[lang][k] || k, [lang]);

  // ========== 核心状态管理 ==========
  const [accounts, setAccounts] = useState([]);
  const [tab, setTab] = useState(0);
  const [characters, setCharactersData] = useState({ 
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
  });
  const [nikkeList, setNikkeList] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // 显示提示消息
  const showMessage = useCallback((message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // 持久化账号数据到存储
  const persist = useCallback((data) =>
    new Promise((ok) => chrome.storage.local.set({ accounts: data }, ok)), []);

  // ========== 使用自定义 Hooks ==========
  const templateManagement = useTemplateManagement({
    t,
    characters,
    setCharactersData,
    accounts,
    setAccounts,
    persist,
    showMessage,
  });

  const cloudSync = useCloudSync({
    t,
    syncAccountEmail,
    syncAccountPassword,
    accountTemplates: templateManagement.accountTemplates,
    templates: templateManagement.templates,
    selectedAccountTemplateId: templateManagement.selectedAccountTemplateId,
    selectedTemplateId: templateManagement.selectedTemplateId,
    setAccounts,
    applyAccountTemplatesWithDefault: templateManagement.applyAccountTemplatesWithDefault,
    applyTemplatesWithDefault: templateManagement.applyTemplatesWithDefault,
    persist,
    showMessage,
  });

  const accountActions = useAccountActions({
    t,
    accounts,
    setAccounts,
    persist,
    syncAccountTemplateData: templateManagement.syncAccountTemplateData,
    selectedAccountTemplateId: templateManagement.selectedAccountTemplateId,
    showMessage,
    syncAccountEmail,
    syncAccountPassword,
    authToken: cloudSync.authToken,
    buildUpdatedAccountTemplates: templateManagement.buildUpdatedAccountTemplates,
    syncAccountsNow: cloudSync.syncAccountsNow,
    accountTemplatesRef: templateManagement.accountTemplatesRef,
  });

  const characterActions = useCharacterActions({
    t,
    characters,
    setCharactersData,
    nikkeList,
    showMessage,
  });

  // ========== 派生值 ==========
  const isAllEnabled = useMemo(() => accounts.every(acc => acc.enabled !== false), [accounts]);

  const nikkeResourceIdMap = useMemo(() => {
    const map = new Map();
    (nikkeList || []).forEach((n) => {
      if (!n) return;
      if (n.id === undefined || n.id === null) return;
      if (n.resource_id === undefined || n.resource_id === null || n.resource_id === "") return;
      map.set(n.id, n.resource_id);
    });
    return map;
  }, [nikkeList]);

  // 妮姬页开关列样式
  const toggleCellSx = useMemo(
    () => ({
      textAlign: 'center',
      padding: '4px',
      minWidth: NIKKE_TOGGLE_MIN_WIDTH_PX,
      width: `max(${NIKKE_TOGGLE_MIN_WIDTH_PX}px, calc((100% - ${NIKKE_DRAG_HANDLE_WIDTH_PX}px - ${NIKKE_NAME_MIN_WIDTH_PX}px - ${NIKKE_PRIORITY_WIDTH_PX}px) / ${NIKKE_TOGGLE_COL_COUNT}))`,
    }),
    []
  );
  const toggleHeaderCellSx = useMemo(
    () => ({
      ...toggleCellSx,
      fontSize: '0.75rem'
    }),
    [toggleCellSx]
  );

  const iconUrl = useMemo(() => chrome.runtime.getURL("images/icon-128.png"), []);

  // ========== 工具函数 ==========
  const equipStatLabels = [
    t("elementAdvantage"),
    t("attack"),
    t("ammo"),
    t("chargeSpeed"),
    t("chargeDamage"),
    t("critical"),
    t("criticalDamage"),
    t("hit"),
    t("defense")
  ];

  const getElementName = useCallback((element) => {
    const key = elementTranslationKeys[element];
    return key ? t(key) : element;
  }, [t]);

  const getClassName = useCallback((className) => {
    const key = classTranslationKeys[className];
    return key ? t(key) : className;
  }, [t]);

  const getCorporationName = useCallback((corporation) => {
    const key = corporationTranslationKeys[corporation];
    return key ? t(key) : corporation;
  }, [t]);

  const getBurstStageName = useCallback((stage) => {
    switch (stage) {
      case "Step1":
        return t("burstStage1");
      case "Step2":
        return t("burstStage2");
      case "Step3":
        return t("burstStage3");
      case "AllStep":
        return t("burstStageAll");
      default:
        return stage || "—";
    }
  }, [t]);

  const getDisplayName = useCallback((nikke) => {
    if (!nikke) return "";
    const zhName = nikke.name_cn || nikke.name_en || nikke.name_code || nikke.name;
    const enName = nikke.name_en || nikke.name_cn || nikke.name_code || nikke.name;
    return lang === "zh" ? zhName : enName;
  }, [lang]);

  const getNikkeAvatarUrl = useCallback((nikke) => {
    return buildNikkeAvatarUrl(nikke, nikkeResourceIdMap);
  }, [nikkeResourceIdMap]);

  const renderText = useCallback((txt) => (txt ? txt : "—"), []);

  const formatSyncAge = useCallback((timestampMs) => {
    if (!timestampMs) return "";
    const diff = Math.max(0, Date.now() - timestampMs);
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
      return (t("sync.minutes") || "{count}分钟").replace("{count}", String(minutes));
    }
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.max(1, Math.floor(diff / (60 * 60 * 1000)));
      return (t("sync.hours") || "{count}小时").replace("{count}", String(hours));
    }
    const days = Math.max(1, Math.floor(diff / (24 * 60 * 60 * 1000)));
    return (t("sync.days") || "{count}天").replace("{count}", String(days));
  }, [t]);

  const buildSyncLabel = useCallback((timestampMs) => {
    if (!cloudSync.authToken || !timestampMs) return null;
    const prefix = t("sync.status") || "已同步，最后更新时间：";
    return `${prefix}${formatSyncAge(timestampMs)}`;
  }, [cloudSync.authToken, formatSyncAge, t]);

  const formatCookieRemaining = useCallback((timestampMs) => {
    if (!timestampMs) return null;
    const expireAt = timestampMs + 30 * 24 * 60 * 60 * 1000;
    const remainingMs = expireAt - Date.now();
    if (remainingMs <= 0) return { label: t("cookieExpired") || "已过期", color: "error.main" };
    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    if (remainingDays >= 1) {
      const label = (t("cookieValidForDays") || "可用 {count} 天").replace("{count}", String(remainingDays));
      return { label, color: "success.main" };
    }
    const label = (t("cookieValidForHours") || "可用 {count} 小时").replace("{count}", String(remainingHours));
    return { label, color: "success.main" };
  }, [t]);

  const getCookieStatus = useCallback((account) => {
    if (!account?.cookie) return null;
    const ts = normalizeTimestamp(account.cookieUpdatedAt ?? account.cookie_updated_at);
    if (!ts) {
      return { label: t("cookieUnknown") || "未知", color: "text.secondary" };
    }
    return formatCookieRemaining(ts);
  }, [formatCookieRemaining, t]);

  const toggleLang = useCallback(async (e) => {
    const newLang = e.target.checked ? "en" : "zh";
    setLang(newLang);
    const current = await getSettings();
    await setSettings({
      ...current,
      lang: newLang
    });
  }, []);

  // ========== 初始化 Effects ==========
  // 管理页 Tab 持久化
  useEffect(() => {
    chrome.storage.local.get("managementTab", (r) => {
      const saved = Number(r.managementTab);
      if (saved === 0 || saved === 1) setTab(saved);
    });
  }, []);

  const handleManagementTabChange = useCallback((e, newTab) => {
    if (newTab === 0 || newTab === 1) {
      setTab(newTab);
      chrome.storage.local.set({ managementTab: newTab });
    }
  }, []);

  // 语言和同步设置初始化
  useEffect(() => {
    chrome.storage.local.get("settings", (r) => {
      const nextLang = r.settings?.lang || "zh";
      const legacySensitive = Boolean(r.settings?.syncAccountSensitive);
      const nextEmail = r.settings?.syncAccountEmail ?? legacySensitive;
      const nextPassword = r.settings?.syncAccountPassword ?? legacySensitive;
      setLang(nextLang);
      setSyncAccountEmail(Boolean(nextEmail));
      setSyncAccountPassword(Boolean(nextPassword));
        // 传入当前敏感设置值，确保 prevSyncSensitiveRef 正确初始化
        cloudSync.setSyncSensitiveInit(true, { email: Boolean(nextEmail), password: Boolean(nextPassword) });
    });
    const handler = (c, area) => {
      if (area === "local" && c.settings) {
        const nextLang = c.settings.newValue?.lang || "zh";
          const legacySensitive = Boolean(c.settings.newValue?.syncAccountSensitive);
          const nextEmail = c.settings.newValue?.syncAccountEmail ?? legacySensitive;
          const nextPassword = c.settings.newValue?.syncAccountPassword ?? legacySensitive;
        setLang(nextLang);
          setSyncAccountEmail(Boolean(nextEmail));
          setSyncAccountPassword(Boolean(nextPassword));
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistSyncSettings = useCallback(async (nextEmail, nextPassword) => {
    const current = await getSettings();
    await setSettings({
      ...current,
      syncAccountEmail: Boolean(nextEmail),
      syncAccountPassword: Boolean(nextPassword),
      syncAccountSensitive: Boolean(nextEmail) || Boolean(nextPassword),
    });
  }, []);

  const toggleSyncAccountEmail = useCallback((e) => {
    const next = e.target.checked;
    setSyncAccountEmail(next);
    persistSyncSettings(next, syncAccountPassword);
  }, [persistSyncSettings, syncAccountPassword]);

  const toggleSyncAccountPassword = useCallback((e) => {
    const next = e.target.checked;
    setSyncAccountPassword(next);
    persistSyncSettings(syncAccountEmail, next);
  }, [persistSyncSettings, syncAccountEmail]);

  // 角色数据初始化
  useEffect(() => {
    getCharacters().then(data => {
      const fallback = {
        elements: {
          Electronic: [], Fire: [], Wind: [], Water: [], Iron: [], Utility: []
        },
        options: {
          showEquipDetails: true
        }
      };
      const valid = (data && data.elements && typeof data.elements === 'object') ? data : fallback;
      const merged = {
        ...fallback,
        ...valid,
        options: {
          showEquipDetails: valid?.options?.showEquipDetails !== false
        }
      };
      setCharactersData(merged);
    });

    (async () => {
      const online = await fetchAndCacheNikkeDirectory();
      if (Array.isArray(online) && online.length) {
        setNikkeList(online);
      } else {
        const cached = await getCachedNikkeDirectory();
        setNikkeList(cached || []);
      }
    })();
  }, []);

  // 账号数据初始化（只在首次渲染时执行）
  useEffect(() => {
    chrome.storage.local.get("accounts", async (r) => {
      let list = r.accounts || [];
      const updated = list.map((acc) => {
        const nextGameUid = acc?.game_uid || acc?.gameUid || parseGameUidFromCookie(acc?.cookie);
        const { ...rest } = acc || {};
        return {
          ...rest,
          game_uid: nextGameUid || "",
          cookieUpdatedAt: acc?.cookieUpdatedAt ?? acc?.cookie_updated_at ?? null,
        };
      });
      if (JSON.stringify(updated) !== JSON.stringify(list)) {
        await new Promise(res => chrome.storage.local.set({ accounts: updated }, res));
      }
      list = updated;

      if (list.length === 0) {
        setAccounts([defaultRow()]);
        accountActions.initEditingState(1, true);
      } else {
        setAccounts(list);
        accountActions.initEditingState(list.length, false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听存储变化并同步状态（不重置editing状态，避免编辑中断）
  useEffect(() => {
    const handler = (changes, area) => {
      if (area === "local" && changes.accounts) {
        const prev = changes.accounts.oldValue || [];
        const next = changes.accounts.newValue || [];
        setAccounts(next);
        // 注意：不调用 initEditingState，避免用户正在编辑时被重置

        if (templateManagement.selectedAccountTemplateId) {
          const prevSig = buildAccountsSignature(cloudSync.sanitizeAccountsForCloud(prev));
          const nextSig = buildAccountsSignature(cloudSync.sanitizeAccountsForCloud(next));
          if (prevSig !== nextSig) {
            templateManagement.syncAccountTemplateData(templateManagement.selectedAccountTemplateId, next);
          }
        }
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 云同步初始化（仅在 authToken 变化时触发）
  useEffect(() => {
    const authToken = cloudSync.authToken;
    if (!authToken) return;
    if (cloudSync.cloudInitTokenRef.current === authToken) return;
    cloudSync.cloudInitTokenRef.current = authToken;
    let cancelled = false;

    cloudSync.setSyncConflict((prev) => ({ ...prev, open: false }));

    (async () => {
      try {
        const [
          localAccountTemplates,
          localCharacterTemplates,
          storedAccountTemplateId,
          storedTemplateId,
          localAccounts,
          remoteAccountsResp,
          remoteCharactersResp,
        ] = await Promise.all([
          Promise.resolve(templateManagement.accountTemplates),
          Promise.resolve(templateManagement.templates),
          Promise.resolve(templateManagement.selectedAccountTemplateId),
          Promise.resolve(templateManagement.selectedTemplateId),
          getAccounts(),
          cloudSync.fetchCloudData("/accounts", authToken).catch(() => null),
          cloudSync.fetchCloudData("/characters", authToken).catch(() => null),
        ]);

        if (cancelled) return;

        const remoteAccounts = normalizeAccountsFromRemote(remoteAccountsResp?.lists);
        const remoteAccountsUpdatedAt = normalizeTimestamp(remoteAccountsResp?.updated_at) || null;
        const remoteCharacters = remoteCharactersResp?.lists || null;
        const remoteCharactersUpdatedAt = normalizeTimestamp(remoteCharactersResp?.updated_at) || null;

        const localAccountLists = localAccountTemplates || [];
        const localCharacterLists = localCharacterTemplates || [];
        const remoteAccountLists = cloudSync.normalizeAccountLists(remoteAccounts);
        const remoteCharacterLists = cloudSync.normalizeCharacterLists(remoteCharacters);

        const localAccountsList = Array.isArray(localAccounts) ? localAccounts : [];
        const hasLocalAccounts = localAccountsList.length > 0;
        const fallbackAccountListId = storedAccountTemplateId || remoteAccountLists[0]?.id || "1";
        const fallbackAccountListName = `${t("accountTemplate")}${1}`;
        const effectiveLocalAccountLists = localAccountLists.length
          ? localAccountLists
          : (hasLocalAccounts
            ? [{ id: String(fallbackAccountListId), name: fallbackAccountListName, data: localAccountsList }]
            : []);

        const localAccountsEmpty = !effectiveLocalAccountLists.length;
        const remoteAccountsEmpty = !remoteAccountLists.length;
        const localCharactersEmpty = !localCharacterLists.length;
        const remoteCharactersEmpty = !remoteCharacterLists.length;

        let nextConflict = {
          open: false,
          hasAccounts: false,
          localAccounts: null,
          remoteAccounts: null,
          remoteAccountsUpdatedAt: null,
          hasCharacters: false,
          localCharacters: null,
          remoteCharacters: null,
          remoteCharactersUpdatedAt: null,
        };

        // Accounts sync
        if (!localAccountsEmpty && remoteAccountsEmpty) {
          const uploadResp = await cloudSync.uploadCloudData("/accounts", authToken, { lists: cloudSync.buildCloudAccountLists(effectiveLocalAccountLists) });
          const updatedAt = normalizeTimestamp(uploadResp?.updated_at) || Date.now();
          await setSyncMeta({ accountsLastSyncAt: updatedAt });
        } else if (localAccountLists.length === 0 && hasLocalAccounts && !remoteAccountsEmpty) {
          const mergedAccountLists = cloudSync.mergeAccountLists(effectiveLocalAccountLists, remoteAccountLists);
          await templateManagement.applyAccountTemplatesWithDefault(mergedAccountLists, storedAccountTemplateId || "");
          const appliedId = storedAccountTemplateId || mergedAccountLists[0]?.id || "";
          const applied = mergedAccountLists.find((item) => item.id === appliedId) || mergedAccountLists[0];
          if (applied?.data) {
            setAccounts(applied.data);
            await persist(applied.data);
          }
          if (remoteAccountsUpdatedAt) {
            await setSyncMeta({ accountsLastSyncAt: remoteAccountsUpdatedAt });
          }
        } else if (localAccountsEmpty && !remoteAccountsEmpty) {
          const mergedAccountLists = cloudSync.mergeAccountLists(effectiveLocalAccountLists, remoteAccountLists);
          await templateManagement.applyAccountTemplatesWithDefault(mergedAccountLists, storedAccountTemplateId || "");
          const appliedId = storedAccountTemplateId || mergedAccountLists[0]?.id || "";
          const applied = mergedAccountLists.find((item) => item.id === appliedId) || mergedAccountLists[0];
          if (applied?.data) {
            setAccounts(applied.data);
            await persist(applied.data);
          }
          if (remoteAccountsUpdatedAt) {
            await setSyncMeta({ accountsLastSyncAt: remoteAccountsUpdatedAt });
          }
        } else if (!localAccountsEmpty && !remoteAccountsEmpty) {
          const localSig = cloudSync.buildAccountListsSignature(effectiveLocalAccountLists);
          const remoteSig = cloudSync.buildAccountListsSignature(remoteAccountLists);
          if (localSig !== remoteSig) {
            nextConflict = {
              ...nextConflict,
              open: true,
              hasAccounts: true,
              localAccounts: effectiveLocalAccountLists,
              remoteAccounts: remoteAccountLists,
              remoteAccountsUpdatedAt,
            };
          } else if (remoteAccountsUpdatedAt) {
            await setSyncMeta({ accountsLastSyncAt: remoteAccountsUpdatedAt });
          }
        }

        // Characters sync
        if (!localCharactersEmpty && remoteCharactersEmpty) {
          const uploadResp = await cloudSync.uploadCloudData("/characters", authToken, { lists: cloudSync.normalizeCharacterLists(localCharacterLists) });
          const updatedAt = normalizeTimestamp(uploadResp?.updated_at) || Date.now();
          await setSyncMeta({ charactersLastSyncAt: updatedAt });
        } else if (localCharactersEmpty && !remoteCharactersEmpty) {
          await templateManagement.applyTemplatesWithDefault(remoteCharacterLists, storedTemplateId || "");
          if (remoteCharactersUpdatedAt) {
            await setSyncMeta({ charactersLastSyncAt: remoteCharactersUpdatedAt });
          }
        } else if (!localCharactersEmpty && !remoteCharactersEmpty) {
          const localSig = cloudSync.buildCharacterListsSignature(localCharacterLists);
          const remoteSig = cloudSync.buildCharacterListsSignature(remoteCharacterLists);
          if (localSig !== remoteSig) {
            nextConflict = {
              ...nextConflict,
              open: true,
              hasCharacters: true,
              localCharacters: localCharacterLists,
              remoteCharacters: remoteCharacterLists,
              remoteCharactersUpdatedAt,
            };
          } else if (remoteCharactersUpdatedAt) {
            await setSyncMeta({ charactersLastSyncAt: remoteCharactersUpdatedAt });
          }
        }

        if (nextConflict.open) {
          cloudSync.setSyncConflict((prev) => ({ ...prev, ...nextConflict, open: true }));
        }

        if (!cloudSync.lastSyncedAccountsSigRef.current) {
          cloudSync.lastSyncedAccountsSigRef.current = cloudSync.buildAccountListsSignature(effectiveLocalAccountLists);
        }
        if (!cloudSync.lastSyncedCharactersSigRef.current) {
          cloudSync.lastSyncedCharactersSigRef.current = cloudSync.buildCharacterListsSignature(localCharacterLists);
        }

        cloudSync.setAccountsSyncing(false);
        cloudSync.setCharactersSyncing(false);

        cloudSync.isInitializedRef.current = true;
      } catch (error) {
        console.error("cloud sync failed", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudSync.authToken]);

  // ========== 计算标签 ==========
  const selectionLabelTemplate = t("selectedCharactersLabel") || "Selected {count}";
  const selectionLabel = selectionLabelTemplate.replace("{count}", String(characterActions.totalSelectionCount));
  const accountsSyncLabel = buildSyncLabel(cloudSync.accountsSyncAt);
  const charactersSyncLabel = buildSyncLabel(cloudSync.charactersSyncAt);

  /* ---------- 渲染 ---------- */
  return (
    <>
      <ManagementHeader iconUrl={iconUrl} lang={lang} onToggleLang={toggleLang} />
      
      <Container maxWidth="xl" sx={{ mt: 4, pb: 8 }}>
        <Tabs value={tab} onChange={handleManagementTabChange} sx={{ mb: 3 }} aria-label={t("management")}>
          <Tab label={t("accountTable")} />
          <Tab label={t("characterManagement")} />
        </Tabs>
        {tab === 0 && (
          <AccountTabContent
            t={t}
            syncLabel={accountsSyncLabel}
            isSyncing={cloudSync.accountsSyncing}
            accountTemplates={templateManagement.accountTemplates}
            defaultAccountTemplateId={templateManagement.defaultAccountTemplateId}
            selectedAccountTemplateId={templateManagement.selectedAccountTemplateId}
            handleAccountTemplateChange={templateManagement.handleAccountTemplateChange}
            isAccountRenaming={templateManagement.isAccountRenaming}
            accountRenameId={templateManagement.accountRenameId}
            accountRenameValue={templateManagement.accountRenameValue}
            setAccountRenameValue={templateManagement.setAccountRenameValue}
            confirmAccountRename={templateManagement.confirmAccountRename}
            setIsAccountRenaming={templateManagement.setIsAccountRenaming}
            setAccountRenameId={templateManagement.setAccountRenameId}
            startRenameAccountTemplate={templateManagement.startRenameAccountTemplate}
            handleDuplicateAccountTemplate={templateManagement.handleDuplicateAccountTemplate}
            handleDeleteAccountTemplate={templateManagement.handleDeleteAccountTemplate}
            handleCreateAccountTemplate={templateManagement.handleCreateAccountTemplate}
            syncAccountEmail={syncAccountEmail}
            syncAccountPassword={syncAccountPassword}
            toggleSyncAccountEmail={toggleSyncAccountEmail}
            toggleSyncAccountPassword={toggleSyncAccountPassword}
            isAllEnabled={isAllEnabled}
            handleToggleAllEnabled={() => accountActions.handleToggleAllEnabled(isAllEnabled)}
            handleImportAccounts={accountActions.handleImportAccounts}
            handleExportAccounts={accountActions.handleExportAccounts}
            handleClearAllAccounts={accountActions.handleClearAllAccounts}
            accounts={accounts}
            editing={accountActions.editing}
            showPwds={accountActions.showPwds}
            accDragging={accountActions.accDragging}
            onAccountDragStart={accountActions.onAccountDragStart}
            onAccountDragOver={accountActions.onAccountDragOver}
            onAccountDrop={accountActions.onAccountDrop}
            onAccountDragEnd={accountActions.onAccountDragEnd}
            updateField={accountActions.updateField}
            handleToggleAccountEnabled={accountActions.handleToggleAccountEnabled}
            setShowPwds={accountActions.setShowPwds}
            saveRow={accountActions.saveRow}
            startEdit={accountActions.startEdit}
            deleteRow={accountActions.deleteRow}
            addRow={accountActions.addRow}
            renderText={renderText}
            getCookieStatus={getCookieStatus}
          />
        )}
        {tab === 1 && (
          <CharacterTabContent
            t={t}
            lang={lang}
            syncLabel={charactersSyncLabel}
            isSyncing={cloudSync.charactersSyncing}
            templates={templateManagement.templates}
            defaultTemplateId={templateManagement.defaultTemplateId}
            selectedTemplateId={templateManagement.selectedTemplateId}
            handleTemplateChange={templateManagement.handleTemplateChange}
            isRenaming={templateManagement.isRenaming}
            renameId={templateManagement.renameId}
            renameValue={templateManagement.renameValue}
            setRenameValue={templateManagement.setRenameValue}
            confirmRename={templateManagement.confirmRename}
            setIsRenaming={templateManagement.setIsRenaming}
            setRenameId={templateManagement.setRenameId}
            startRenameTemplate={templateManagement.startRenameTemplate}
            handleDuplicateTemplate={templateManagement.handleDuplicateTemplate}
            handleDeleteTemplate={templateManagement.handleDeleteTemplate}
            handleCreateTemplate={templateManagement.handleCreateTemplate}
            triggerCharacterImport={characterActions.triggerCharacterImport}
            handleExportCharacters={characterActions.handleExportCharacters}
            handleClearAllCharacters={characterActions.handleClearAllCharacters}
            characters={characters}
            getElementName={getElementName}
            openFilterDialog={characterActions.openFilterDialog}
            equipStatKeys={equipStatKeys}
            equipStatLabels={equipStatLabels}
            toggleHeaderCellSx={toggleHeaderCellSx}
            toggleCellSx={toggleCellSx}
            getNikkeAvatarUrl={getNikkeAvatarUrl}
            getDisplayName={getDisplayName}
            updateCharacterPriority={characterActions.updateCharacterPriority}
            getPriorityColor={getPriorityColor}
            updateCharacterShowStats={characterActions.updateCharacterShowStats}
            basicStatKeys={basicStatKeys}
            showStatsConfigMarker={SHOW_STATS_CONFIG_MARKER}
            nikkeNameMinWidthPx={NIKKE_NAME_MIN_WIDTH_PX}
            nikkePriorityWidthPx={NIKKE_PRIORITY_WIDTH_PX}
            nikkeDragHandleWidthPx={NIKKE_DRAG_HANDLE_WIDTH_PX}
            nikkeToggleMinWidthPx={NIKKE_TOGGLE_MIN_WIDTH_PX}
            charDragging={characterActions.charDragging}
            onCharDragStart={characterActions.onCharDragStart}
            onCharDragOver={characterActions.onCharDragOver}
            onCharDrop={characterActions.onCharDrop}
            onCharDragEnd={characterActions.onCharDragEnd}
          />
        )}
      </Container>
      
      <CharacterFilterDialog
        t={t}
        open={characterActions.filterDialogOpen}
        onClose={characterActions.handleCloseFilterDialog}
        filters={characterActions.filters}
        setFilters={characterActions.setFilters}
        filteredNikkes={characterActions.filteredNikkes}
        selectedNikkes={characterActions.selectedNikkes}
        effectiveExistingElementIds={characterActions.effectiveExistingElementIds}
        getDisplayName={getDisplayName}
        getNikkeAvatarUrl={getNikkeAvatarUrl}
        getElementName={getElementName}
        getBurstStageName={getBurstStageName}
        getClassName={getClassName}
        getCorporationName={getCorporationName}
        handleSelectNikke={characterActions.handleSelectNikke}
        selectionLabel={selectionLabel}
        totalSelectionCount={characterActions.totalSelectionCount}
        effectiveExistingElementCharacters={characterActions.effectiveExistingElementCharacters}
        handleRemoveExistingNikke={characterActions.handleRemoveExistingNikke}
        handleRemoveSelectedNikke={characterActions.handleRemoveSelectedNikke}
        pendingSelectionCount={characterActions.pendingSelectionCount}
        removedExistingIds={characterActions.removedExistingIds}
        handleConfirmSelection={characterActions.handleConfirmSelection}
      />

      <SyncConflictDialog
        t={t}
        open={cloudSync.syncConflict.open}
        hasAccounts={cloudSync.syncConflict.hasAccounts}
        hasCharacters={cloudSync.syncConflict.hasCharacters}
        onUseLocal={cloudSync.handleConflictUseLocal}
        onUseCloud={cloudSync.handleConflictUseCloud}
        onLogout={cloudSync.handleConflictLogout}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ManagementPage;
