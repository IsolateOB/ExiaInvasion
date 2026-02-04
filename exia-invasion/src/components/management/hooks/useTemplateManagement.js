// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 模板管理 Hook ==========

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { 
  getTemplates, 
  setTemplates as setStoredTemplates, 
  saveTemplate, 
  deleteTemplate, 
  getCurrentTemplateId, 
  setCurrentTemplateId, 
  getNextTemplateId,
  getAccountTemplates, 
  setAccountTemplates as setStoredAccountTemplates, 
  saveAccountTemplate, 
  deleteAccountTemplate, 
  getCurrentAccountTemplateId, 
  setCurrentAccountTemplateId, 
  getNextAccountTemplateId,
  setCharacters as persistCharacters,
} from "../../../services/storage.js";
import { buildCharactersSignature } from "../../../utils/cloudCompare.js";

/**
 * 模板管理 Hook
 * @param {Object} options
 * @param {Function} options.t - 翻译函数
 * @param {Object} options.characters - 角色数据
 * @param {Function} options.setCharactersData - 设置角色数据
 * @param {Array} options.accounts - 账号列表
 * @param {Function} options.setAccounts - 设置账号列表
 * @param {Function} options.persist - 持久化账号数据
 * @param {Function} options.showMessage - 显示消息提示
 */
export function useTemplateManagement({
  t,
  characters,
  setCharactersData,
  accounts,
  setAccounts,
  persist,
  showMessage,
}) {
  // 角色模板状态
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameId, setRenameId] = useState("");
  const [renameValue, setRenameValue] = useState("");

  // 账号模板状态
  const [accountTemplates, setAccountTemplates] = useState([]);
  const [selectedAccountTemplateId, setSelectedAccountTemplateId] = useState("");
  const [isAccountRenaming, setIsAccountRenaming] = useState(false);
  const [accountRenameId, setAccountRenameId] = useState("");
  const [accountRenameValue, setAccountRenameValue] = useState("");

  // Refs
  const characterTemplateSaveTimerRef = useRef(null);
  const accountTemplatesInitRef = useRef(false);
  const templatesInitRef = useRef(false);
  const accountTemplatesRef = useRef([]);
  const templatesRef = useRef([]);

  // Keep refs in sync with state
  useEffect(() => { accountTemplatesRef.current = accountTemplates; }, [accountTemplates]);
  useEffect(() => { templatesRef.current = templates; }, [templates]);

  // 默认模板 ID
  const defaultAccountTemplateId = useMemo(
    () => accountTemplates.find((tpl) => tpl?.isDefault)?.id || accountTemplates[0]?.id || "",
    [accountTemplates]
  );

  const defaultTemplateId = useMemo(
    () => templates.find((tpl) => tpl?.isDefault)?.id || templates[0]?.id || "",
    [templates]
  );

  // ========== 角色模板管理 ==========
  const buildDefaultCharacterTemplate = useCallback(async () => {
    const id = await getNextTemplateId();
    return {
      id,
      name: `${t("template")}${1}`,
      data: characters,
      createdAt: Date.now(),
      isDefault: true,
    };
  }, [characters, t]);

  const applyTemplatesWithDefault = useCallback(async (list, preferredId) => {
    let nextList = Array.isArray(list) ? list : [];
    if (!nextList.length) {
      const template = await buildDefaultCharacterTemplate();
      nextList = [template];
    } else if (!nextList.some((tpl) => tpl?.isDefault)) {
      const sorted = [...nextList].sort((a, b) => String(a?.id || "").localeCompare(String(b?.id || "")));
      const targetId = sorted[0]?.id;
      if (targetId) {
        nextList = nextList.map((tpl) => (tpl.id === targetId ? { ...tpl, isDefault: true } : tpl));
      }
    }
    await setStoredTemplates(nextList);
    setTemplates(nextList);
    const defaultId = nextList.find((tpl) => tpl?.isDefault)?.id || nextList[0]?.id || "";
    const nextId = preferredId && nextList.some((tpl) => tpl.id === preferredId) ? preferredId : defaultId;
    setSelectedTemplateId(nextId);
    await setCurrentTemplateId(nextId);
    return { list: nextList, defaultId: defaultId || nextId };
  }, [buildDefaultCharacterTemplate]);

  // 刷新模板列表
  const refreshTemplates = useCallback(async () => {
    const list = await getTemplates();
    await applyTemplatesWithDefault(list || [], selectedTemplateId || "");
  }, [applyTemplatesWithDefault, selectedTemplateId]);

  // 生成下一个默认模板名称
  const generateNextDefaultName = useCallback(() => {
    const existing = templates.map(tpl => tpl.name);
    let n = 1;
    while (existing.includes(`${t("template")}${n}`)) n++;
    return `${t("template")}${n}`;
  }, [templates, t]);

  const buildEmptyCharactersData = useCallback(() => ({
    elements: {
      Electronic: [],
      Fire: [],
      Wind: [],
      Water: [],
      Iron: [],
      Utility: []
    },
    options: {
      showEquipDetails: characters?.options?.showEquipDetails !== false
    }
  }), [characters]);

  const syncCharacterTemplateData = useCallback(async (templateId, data) => {
    if (!templateId) return;
    const currentTemplates = templatesRef.current;
    const tpl = currentTemplates.find((item) => item.id === templateId);
    if (!tpl) return;
    const currentSig = buildCharactersSignature(tpl.data || {});
    const nextSig = buildCharactersSignature(data || {});
    if (currentSig === nextSig) return;
    const updated = { ...tpl, data: data || {} };
    setTemplates((prev) => prev.map((item) => (item.id === templateId ? updated : item)));
    await saveTemplate(updated);
  }, []);

  // 应用模板
  const applyTemplate = useCallback(async (tpl) => {
    if (!tpl || !tpl.data) return;
    setCharactersData(tpl.data);
    persistCharacters(tpl.data);
  }, [setCharactersData]);

  // 保存当前配置为模板
  const handleCreateTemplate = useCallback(async () => {
    const id = await getNextTemplateId();
    const emptyData = buildEmptyCharactersData();
    const template = {
      id,
      name: generateNextDefaultName(),
      data: emptyData,
      createdAt: Date.now()
    };
    await saveTemplate(template);
    await refreshTemplates();
    setSelectedTemplateId(id);
    await setCurrentTemplateId(id);
    setCharactersData(emptyData);
    await persistCharacters(emptyData);
    showMessage(t("templateSaved"), "success");
  }, [buildEmptyCharactersData, generateNextDefaultName, refreshTemplates, setCharactersData, showMessage, t]);

  const handleDuplicateTemplate = useCallback(async (id) => {
    if (!id) return;
    const source = templates.find((item) => item.id === id);
    if (!source) return;
    const copyLabel = t("copy") || "复制";
    const newId = await getNextTemplateId();
    const copy = {
      ...source,
      id: newId,
      name: `${source.name} ${copyLabel}`,
      createdAt: Date.now(),
      data: JSON.parse(JSON.stringify(source.data || {}))
    };
    await saveTemplate(copy);
    await refreshTemplates();
    setSelectedTemplateId(newId);
    await setCurrentTemplateId(newId);
    setCharactersData(copy.data);
    await persistCharacters(copy.data);
    showMessage(t("templateLoaded"), "success");
  }, [templates, refreshTemplates, setCharactersData, showMessage, t]);

  // 删除模板
  const handleDeleteTemplate = useCallback(async (id) => {
    if (!id) return;
    if (id === defaultTemplateId) {
      showMessage(t("templateDefaultLocked") || "默认妮姬列表不可删除", "warning");
      return;
    }
    await deleteTemplate(id);
    await refreshTemplates();
    if (selectedTemplateId === id) {
      const fallbackId = defaultTemplateId && defaultTemplateId !== id ? defaultTemplateId : "";
      setSelectedTemplateId(fallbackId);
      await setCurrentTemplateId(fallbackId);
    }
    showMessage(t("templateDeleted"), "success");
  }, [defaultTemplateId, refreshTemplates, selectedTemplateId, showMessage, t]);

  // 重命名模板
  const startRenameTemplate = useCallback((id) => {
    setIsRenaming(true);
    setRenameId(id);
    const tpl = templates.find(item => item.id === id);
    setRenameValue(tpl?.name || "");
  }, [templates]);

  const confirmRename = useCallback(async () => {
    const id = renameId;
    const name = renameValue.trim();
    if (!id || !name) return;
    
    const tpl = templates.find(item => item.id === id);
    if (!tpl) return;
    
    tpl.name = name;
    await saveTemplate(tpl);
    await refreshTemplates();
    setSelectedTemplateId(id);
    setIsRenaming(false);
    setRenameId("");
    setRenameValue("");
    showMessage(t("templateRenamed"), "success");
  }, [renameId, renameValue, templates, refreshTemplates, showMessage, t]);

  // 模板选择变化
  const handleTemplateChange = useCallback(async (id) => {
    if (selectedTemplateId && selectedTemplateId !== id) {
      await syncCharacterTemplateData(selectedTemplateId, characters);
    }
    setSelectedTemplateId(id);
    await setCurrentTemplateId(id);
    if (id) {
      const tpl = templates.find(item => item.id === id);
      if (tpl) {
        await applyTemplate(tpl);
        showMessage(t("templateLoaded"), "success");
      }
    }
  }, [selectedTemplateId, characters, templates, syncCharacterTemplateData, applyTemplate, showMessage, t]);

  // ========== 账号模板管理 ==========
  const buildDefaultAccountTemplate = useCallback(async () => {
    const id = await getNextAccountTemplateId();
    return {
      id,
      name: `${t("accountTemplate")}${1}`,
      data: Array.isArray(accounts) ? accounts : [],
      createdAt: Date.now(),
      isDefault: true,
    };
  }, [accounts, t]);

  const applyAccountTemplatesWithDefault = useCallback(async (list, preferredId) => {
    let nextList = Array.isArray(list) ? list : [];
    if (!nextList.length) {
      const template = await buildDefaultAccountTemplate();
      nextList = [template];
    } else if (!nextList.some((tpl) => tpl?.isDefault)) {
      const sorted = [...nextList].sort((a, b) => String(a?.id || "").localeCompare(String(b?.id || "")));
      const targetId = sorted[0]?.id;
      if (targetId) {
        nextList = nextList.map((tpl) => (tpl.id === targetId ? { ...tpl, isDefault: true } : tpl));
      }
    }
    await setStoredAccountTemplates(nextList);
    setAccountTemplates(nextList);
    const defaultId = nextList.find((tpl) => tpl?.isDefault)?.id || nextList[0]?.id || "";
    const nextId = preferredId && nextList.some((tpl) => tpl.id === preferredId) ? preferredId : defaultId;
    setSelectedAccountTemplateId(nextId);
    await setCurrentAccountTemplateId(nextId);
    return { list: nextList, defaultId: defaultId || nextId };
  }, [buildDefaultAccountTemplate]);

  // 刷新账号模板列表
  const refreshAccountTemplates = useCallback(async () => {
    const list = await getAccountTemplates();
    await applyAccountTemplatesWithDefault(list || [], selectedAccountTemplateId || "");
  }, [applyAccountTemplatesWithDefault, selectedAccountTemplateId]);

  // 生成下一个默认账号模板名称
  const generateNextAccountDefaultName = useCallback(() => {
    const existing = accountTemplates.map(tpl => tpl.name);
    let n = 1;
    while (existing.includes(`${t("accountTemplate")}${n}`)) n++;
    return `${t("accountTemplate")}${n}`;
  }, [accountTemplates, t]);

  const syncAccountTemplateData = useCallback(async (templateId, data) => {
    if (!templateId) return;
    const currentTemplates = accountTemplatesRef.current;
    const tpl = currentTemplates.find((item) => item.id === templateId);
    if (!tpl) return;
    const nextData = Array.isArray(data) ? data : [];
    const updated = { ...tpl, data: nextData };
    setAccountTemplates((prev) => prev.map((item) => (item.id === templateId ? updated : item)));
    await saveAccountTemplate(updated);
  }, []);

  // 应用账号模板
  const applyAccountTemplate = useCallback(async (tpl) => {
    if (!tpl || !tpl.data) return;
    const data = tpl.data;
    setAccounts(data);
    await persist(data);
  }, [setAccounts, persist]);

  // 保存当前账号为模板
  const handleCreateAccountTemplate = useCallback(async () => {
    const id = await getNextAccountTemplateId();
    const template = {
      id,
      name: generateNextAccountDefaultName(),
      data: [],
      createdAt: Date.now()
    };
    await saveAccountTemplate(template);
    await refreshAccountTemplates();
    setSelectedAccountTemplateId(id);
    await setCurrentAccountTemplateId(id);
    setAccounts([]);
    await persist([]);
    showMessage(t("accountTemplateSaved"), "success");
  }, [generateNextAccountDefaultName, persist, refreshAccountTemplates, setAccounts, showMessage, t]);

  const handleDuplicateAccountTemplate = useCallback(async (id) => {
    if (!id) return;
    const source = accountTemplates.find((item) => item.id === id);
    if (!source) return;
    const copyLabel = t("copy") || "复制";
    const newId = await getNextAccountTemplateId();
    const dataCopy = Array.isArray(source.data) ? JSON.parse(JSON.stringify(source.data)) : [];
    const copy = {
      ...source,
      id: newId,
      name: `${source.name} ${copyLabel}`,
      createdAt: Date.now(),
      data: dataCopy
    };
    await saveAccountTemplate(copy);
    await refreshAccountTemplates();
    setSelectedAccountTemplateId(newId);
    await setCurrentAccountTemplateId(newId);
    setAccounts(dataCopy);
    await persist(dataCopy);
    showMessage(t("accountTemplateLoaded"), "success");
  }, [accountTemplates, persist, refreshAccountTemplates, setAccounts, showMessage, t]);

  // 删除账号模板
  const handleDeleteAccountTemplate = useCallback(async (id) => {
    if (!id) return;
    if (id === defaultAccountTemplateId) {
      showMessage(t("accountTemplateDefaultLocked") || "默认账号列表不可删除", "warning");
      return;
    }
    await deleteAccountTemplate(id);
    const list = await getAccountTemplates();
    const preferredId = selectedAccountTemplateId === id ? "" : selectedAccountTemplateId;
    const { list: nextList, defaultId } = await applyAccountTemplatesWithDefault(list || [], preferredId || "");
    if (selectedAccountTemplateId === id) {
      const nextId = defaultId || nextList[0]?.id || "";
      setSelectedAccountTemplateId(nextId);
      await setCurrentAccountTemplateId(nextId);
      const tpl = nextList.find((item) => item.id === nextId) || nextList[0];
      if (tpl) {
        await applyAccountTemplate(tpl);
      }
    }
    showMessage(t("accountTemplateDeleted"), "success");
  }, [defaultAccountTemplateId, selectedAccountTemplateId, showMessage, t, applyAccountTemplatesWithDefault, applyAccountTemplate]);

  // 重命名账号模板
  const startRenameAccountTemplate = useCallback((id) => {
    setIsAccountRenaming(true);
    setAccountRenameId(id);
    const tpl = accountTemplates.find(item => item.id === id);
    setAccountRenameValue(tpl?.name || "");
  }, [accountTemplates]);

  const confirmAccountRename = useCallback(async () => {
    const id = accountRenameId;
    const name = accountRenameValue.trim();
    if (!id || !name) return;
    
    const tpl = accountTemplates.find(item => item.id === id);
    if (!tpl) return;
    
    tpl.name = name;
    await saveAccountTemplate(tpl);
    await refreshAccountTemplates();
    setSelectedAccountTemplateId(id);
    setIsAccountRenaming(false);
    setAccountRenameId("");
    setAccountRenameValue("");
    showMessage(t("accountTemplateRenamed"), "success");
  }, [accountRenameId, accountRenameValue, accountTemplates, refreshAccountTemplates, showMessage, t]);

  // 账号模板选择变化
  const handleAccountTemplateChange = useCallback(async (id) => {
    if (selectedAccountTemplateId && selectedAccountTemplateId !== id) {
      await syncAccountTemplateData(selectedAccountTemplateId, accounts);
    }
    setSelectedAccountTemplateId(id);
    await setCurrentAccountTemplateId(id);
    if (id) {
      const tpl = accountTemplates.find(item => item.id === id);
      if (tpl) {
        await applyAccountTemplate(tpl);
        showMessage(t("accountTemplateLoaded"), "success");
      }
    }
  }, [selectedAccountTemplateId, accounts, accountTemplates, syncAccountTemplateData, applyAccountTemplate, showMessage, t]);

  // 构建更新后的账号模板
  const buildUpdatedAccountTemplates = useCallback((templatesList, templateId, data) => {
    if (!templateId) return Array.isArray(templatesList) ? templatesList : [];
    const source = Array.isArray(templatesList) ? templatesList : [];
    let found = false;
    const next = source.map((item) => {
      if (item.id !== templateId) return item;
      found = true;
      return { ...item, data };
    });
    return found ? next : source;
  }, []);

  // ========== 初始化 ==========
  useEffect(() => {
    if (templatesInitRef.current) return;
    templatesInitRef.current = true;
    (async () => {
      const list = await getTemplates();
      const currentId = await getCurrentTemplateId();
      await applyTemplatesWithDefault(list || [], currentId || "");
    })();
  }, [applyTemplatesWithDefault]);

  useEffect(() => {
    if (accountTemplatesInitRef.current) return;
    accountTemplatesInitRef.current = true;
    (async () => {
      const list = await getAccountTemplates();
      const currentId = await getCurrentAccountTemplateId();
      await applyAccountTemplatesWithDefault(list || [], currentId || "");
    })();
  }, [applyAccountTemplatesWithDefault]);

  // 监听 accountTemplates storage 变化（来自 popup 的更新）
  useEffect(() => {
    const handler = (changes, area) => {
      if (area === "local" && changes.accountTemplates) {
        const next = changes.accountTemplates.newValue || [];
        // 更新状态
        setAccountTemplates(next);
        // 如果当前选中的模板被更新了，也更新 accounts
        if (selectedAccountTemplateId) {
          const updated = next.find((tpl) => tpl.id === selectedAccountTemplateId);
          if (updated?.data) {
            setAccounts(updated.data);
          }
        }
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, [selectedAccountTemplateId, setAccounts]);

  // 角色数据变化时自动保存模板
  useEffect(() => {
    if (!selectedTemplateId || !templates.length) return;
    if (characterTemplateSaveTimerRef.current) {
      clearTimeout(characterTemplateSaveTimerRef.current);
    }
    characterTemplateSaveTimerRef.current = setTimeout(() => {
      syncCharacterTemplateData(selectedTemplateId, characters);
    }, 200);
    return () => {
      if (characterTemplateSaveTimerRef.current) {
        clearTimeout(characterTemplateSaveTimerRef.current);
      }
    };
  }, [characters, selectedTemplateId, templates.length, syncCharacterTemplateData]);

  return {
    // 角色模板状态
    templates,
    setTemplates,
    selectedTemplateId,
    setSelectedTemplateId,
    isRenaming,
    setIsRenaming,
    renameId,
    setRenameId,
    renameValue,
    setRenameValue,
    defaultTemplateId,
    templatesRef,

    // 账号模板状态
    accountTemplates,
    setAccountTemplates,
    selectedAccountTemplateId,
    setSelectedAccountTemplateId,
    isAccountRenaming,
    setIsAccountRenaming,
    accountRenameId,
    setAccountRenameId,
    accountRenameValue,
    setAccountRenameValue,
    defaultAccountTemplateId,
    accountTemplatesRef,

    // 角色模板操作
    applyTemplatesWithDefault,
    refreshTemplates,
    syncCharacterTemplateData,
    handleCreateTemplate,
    handleDuplicateTemplate,
    handleDeleteTemplate,
    startRenameTemplate,
    confirmRename,
    handleTemplateChange,

    // 账号模板操作
    applyAccountTemplatesWithDefault,
    refreshAccountTemplates,
    syncAccountTemplateData,
    handleCreateAccountTemplate,
    handleDuplicateAccountTemplate,
    handleDeleteAccountTemplate,
    startRenameAccountTemplate,
    confirmAccountRename,
    handleAccountTemplateChange,
    buildUpdatedAccountTemplates,
  };
}

export default useTemplateManagement;
