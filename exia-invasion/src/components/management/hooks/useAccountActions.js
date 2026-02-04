// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 账号管理操作 Hook ==========

import { useState, useCallback } from "react";
import ExcelJS from "exceljs";
import { defaultRow } from "../constants.js";
import { parseGameUidFromCookie, downloadFile, selectFile, getCellString } from "../utils.js";

/**
 * 账号管理操作 Hook
 * @param {Object} options
 * @param {Function} options.t - 翻译函数
 * @param {Array} options.accounts - 账号列表
 * @param {Function} options.setAccounts - 设置账号列表
 * @param {Function} options.persist - 持久化账号数据
 * @param {Function} options.syncAccountTemplateData - 同步账号模板数据
 * @param {string} options.selectedAccountTemplateId - 当前选中的账号模板ID
 * @param {Function} options.showMessage - 显示消息提示
 * @param {boolean} options.syncAccountEmail - 是否同步账号邮箱
 * @param {boolean} options.syncAccountPassword - 是否同步账号密码
 * @param {string} options.authToken - 认证令牌
 * @param {Function} options.buildUpdatedAccountTemplates - 构建更新后的账号模板
 * @param {Function} options.syncAccountsNow - 立即同步账号
 * @param {Object} options.accountTemplatesRef - 账号模板引用
 */
export function useAccountActions({
  t,
  accounts,
  setAccounts,
  persist,
  syncAccountTemplateData,
  selectedAccountTemplateId,
  showMessage,
  syncAccountEmail,
  syncAccountPassword,
  authToken,
  buildUpdatedAccountTemplates,
  syncAccountsNow,
  accountTemplatesRef,
}) {
  const [editing, setEditing] = useState([]);
  const [showPwds, setShowPwds] = useState([]);
  const [accDragging, setAccDragging] = useState({ draggingIndex: null, overIndex: null });

  // 更新指定账号的字段值
  const updateField = useCallback((idx, field, value) =>
    setAccounts((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    }), [setAccounts]);

  // 切换单个账号启用状态
  const handleToggleAccountEnabled = useCallback(async (idx) => {
    const next = accounts.map((r, i) => (i === idx ? { ...r, enabled: !r.enabled } : r));
    setAccounts(next);
    await persist(next);
    await syncAccountTemplateData(selectedAccountTemplateId, next);
  }, [accounts, setAccounts, persist, syncAccountTemplateData, selectedAccountTemplateId]);

  // 添加新账号行
  const addRow = useCallback(() => {
    const newRow = defaultRow();
    setAccounts((prev) => [...prev, newRow]);
    setEditing((prev) => [...prev, true]);
    setShowPwds((prev) => [...prev, false]);
  }, [setAccounts]);

  // 开始编辑指定行
  const startEdit = useCallback((idx) =>
    setEditing((prev) => prev.map((e, i) => (i === idx ? true : e))), []);

  // 保存指定行的修改
  const saveRow = useCallback(async (idx) => {
    const next = accounts.map((acc, i) => {
      if (i !== idx) return acc;
      const nextGameUid = acc?.game_uid || parseGameUidFromCookie(acc?.cookie);
      if (acc?.cookie) {
        return { ...acc, game_uid: nextGameUid || "", cookieUpdatedAt: Date.now() };
      }
      return { ...acc, game_uid: nextGameUid || "", cookieUpdatedAt: acc?.cookieUpdatedAt ?? null };
    });
    setAccounts(next);
    setEditing((prev) => prev.map((e, i) => (i === idx ? false : e)));
    await persist(next);
    await syncAccountTemplateData(selectedAccountTemplateId, next);
    const shouldSyncSensitive = Boolean(syncAccountEmail) || Boolean(syncAccountPassword);
    if (shouldSyncSensitive && authToken && buildUpdatedAccountTemplates && syncAccountsNow && accountTemplatesRef) {
      const nextTemplates = buildUpdatedAccountTemplates(accountTemplatesRef.current, selectedAccountTemplateId, next);
      await syncAccountsNow(nextTemplates);
    }
  }, [accounts, setAccounts, persist, syncAccountTemplateData, selectedAccountTemplateId, syncAccountEmail, syncAccountPassword, authToken, buildUpdatedAccountTemplates, syncAccountsNow, accountTemplatesRef]);

  // 删除指定行
  const deleteRow = useCallback(async (idx) => {
    const next = accounts.filter((_, i) => i !== idx);
    setAccounts(next);
    setEditing((prev) => prev.filter((_, i) => i !== idx));
    setShowPwds((prev) => prev.filter((_, i) => i !== idx));
    await persist(next);
    await syncAccountTemplateData(selectedAccountTemplateId, next);
  }, [accounts, setAccounts, persist, syncAccountTemplateData, selectedAccountTemplateId]);

  // 全选/全不选启用状态
  const handleToggleAllEnabled = useCallback(async (isAllEnabled) => {
    const newEnabledState = !isAllEnabled;
    const updatedAccounts = accounts.map(acc => ({
      ...acc,
      enabled: newEnabledState
    }));
    setAccounts(updatedAccounts);
    await persist(updatedAccounts);
    await syncAccountTemplateData(selectedAccountTemplateId, updatedAccounts);
  }, [accounts, setAccounts, persist, syncAccountTemplateData, selectedAccountTemplateId]);

  // 清空所有账号
  const handleClearAllAccounts = useCallback(async () => {
    if (!window.confirm(t("clearAllAccountsConfirm"))) {
      return;
    }
    setAccounts([]);
    setEditing([]);
    setShowPwds([]);
    await persist([]);
    await syncAccountTemplateData(selectedAccountTemplateId, []);
  }, [t, setAccounts, persist, syncAccountTemplateData, selectedAccountTemplateId]);

  // 导出账号到Excel
  const handleExportAccounts = useCallback(async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Accounts');

      worksheet.columns = [
        { header: 'Game UID', key: 'game_uid', width: 20 },
        { header: '账号 Username', key: 'username', width: 25 },
        { header: '邮箱 Email', key: 'email', width: 30 },
        { header: '密码 Password', key: 'password', width: 25 },
        { header: 'Cookie', key: 'cookie', width: 50 },
        { header: 'Cookie 更新时间', key: 'cookie_updated_at', width: 22 },
      ];

      accounts.forEach(acc => {
        worksheet.addRow({
          game_uid: acc.game_uid || '',
          username: acc.username || '',
          email: acc.email || '',
          password: acc.password || '',
          cookie: acc.cookie || '',
          cookie_updated_at: acc.cookieUpdatedAt || ''
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const filename = `ExiaInvasion_Accounts_${new Date().toISOString().slice(0, 10)}.xlsx`;
      downloadFile(blob, filename);
      
      showMessage(t("exportSuccess"), "success");
    } catch (error) {
      console.error("导出失败:", error);
      showMessage(t("exportError"), "error");
    }
  }, [accounts, t, showMessage]);

  // 导入账号从Excel
  const handleImportAccounts = useCallback(() => {
    selectFile('.xlsx,.xls', async (file) => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
          showMessage(t("importError"), "error");
          return;
        }

        const currentAccounts = [...accounts];
        let addedCount = 0;
        let updatedCount = 0;

        const headerRow = worksheet.getRow(1);
        let gameUidCol = 1, usernameCol = 2, emailCol = 3, passwordCol = 4, cookieCol = 5, cookieUpdatedAtCol = 0;
        
        headerRow.eachCell((cell, colNumber) => {
          const cellValue = getCellString(cell).toLowerCase();
          if (cellValue.includes('game') && cellValue.includes('uid')) {
            gameUidCol = colNumber;
          } else if (cellValue.includes('账号') || cellValue.includes('username')) {
            usernameCol = colNumber;
          } else if (cellValue.includes('邮箱') || cellValue.includes('email')) {
            emailCol = colNumber;
          } else if (cellValue.includes('密码') || cellValue.includes('password')) {
            passwordCol = colNumber;
          } else if (cellValue.includes('cookie')) {
            cookieCol = colNumber;
          } else if (cellValue.includes('更新时间') || cellValue.includes('updated')) {
            cookieUpdatedAtCol = colNumber;
          }
        });

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber === 1) return;

          const gameUid = getCellString(row.getCell(gameUidCol));
          const username = getCellString(row.getCell(usernameCol));
          const email = getCellString(row.getCell(emailCol));
          const password = getCellString(row.getCell(passwordCol));
          const cookie = getCellString(row.getCell(cookieCol));
          const cookieUpdatedAtRaw = cookieUpdatedAtCol ? getCellString(row.getCell(cookieUpdatedAtCol)) : "";
          const cookieUpdatedAt = cookieUpdatedAtRaw ? Number(cookieUpdatedAtRaw) : null;

          const resolvedGameUid = gameUid || parseGameUidFromCookie(cookie);

          let existingIndex = -1;
          if (resolvedGameUid) {
            existingIndex = currentAccounts.findIndex(acc => acc.game_uid === resolvedGameUid);
          }

          if (existingIndex !== -1) {
            currentAccounts[existingIndex] = {
              ...currentAccounts[existingIndex],
              username: username || currentAccounts[existingIndex].username,
              email: email || currentAccounts[existingIndex].email,
              password: password || currentAccounts[existingIndex].password,
              cookie: cookie || currentAccounts[existingIndex].cookie,
              cookieUpdatedAt: cookieUpdatedAt || currentAccounts[existingIndex].cookieUpdatedAt || null,
              game_uid: resolvedGameUid || currentAccounts[existingIndex].game_uid,
            };
            updatedCount++;
          } else {
            currentAccounts.push({
              username: username,
              email: email,
              password: password,
              cookie: cookie,
              cookieUpdatedAt: cookieUpdatedAt || null,
              game_uid: resolvedGameUid,
              enabled: true,
            });
            addedCount++;
          }
        });

        setAccounts(currentAccounts);
        await persist(currentAccounts);
        await syncAccountTemplateData(selectedAccountTemplateId, currentAccounts);
        
        showMessage(t("importSuccess") + ` (${t("added")}: ${addedCount}, ${t("updated")}: ${updatedCount})`, "success");
      } catch (error) {
        console.error("导入失败:", error);
        showMessage(t("importError"), "error");
      }
    });
  }, [accounts, setAccounts, persist, syncAccountTemplateData, selectedAccountTemplateId, t, showMessage]);

  // 拖拽处理
  const onAccountDragStart = useCallback((e, index) => {
    setAccDragging({ draggingIndex: index, overIndex: index });
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
    e.dataTransfer.setDragImage(img, 0, 0);
  }, []);

  const onAccountDragOver = useCallback((e, index) => {
    e.preventDefault();
    setAccDragging((s) => {
      if (s.draggingIndex !== null && s.overIndex !== index) {
        return { ...s, overIndex: index };
      }
      return s;
    });
  }, []);

  const onAccountDrop = useCallback((index) => {
    const { draggingIndex } = accDragging;
    if (draggingIndex === null || draggingIndex === index) {
      setAccDragging({ draggingIndex: null, overIndex: null });
      return;
    }
    const reordered = [...accounts];
    const [dragged] = reordered.splice(draggingIndex, 1);
    reordered.splice(index, 0, dragged);
    setAccounts(reordered);
    
    setEditing((ed) => {
      const newEd = [...ed];
      const [dragEdit] = newEd.splice(draggingIndex, 1);
      newEd.splice(index, 0, dragEdit);
      return newEd;
    });
    setShowPwds((sw) => {
      const newSw = [...sw];
      const [dragShow] = newSw.splice(draggingIndex, 1);
      newSw.splice(index, 0, dragShow);
      return newSw;
    });
    
    persist(reordered);
    syncAccountTemplateData(selectedAccountTemplateId, reordered);
    setAccDragging({ draggingIndex: null, overIndex: null });
  }, [accDragging, accounts, setAccounts, persist, syncAccountTemplateData, selectedAccountTemplateId]);

  const onAccountDragEnd = useCallback(() => setAccDragging({ draggingIndex: null, overIndex: null }), []);

  // 初始化编辑状态
  const initEditingState = useCallback((length, isNew = false) => {
    setEditing(isNew ? [true] : Array(length).fill(false));
    setShowPwds(Array(length).fill(false));
  }, []);

  return {
    // 状态
    editing,
    setEditing,
    showPwds,
    setShowPwds,
    accDragging,

    // 操作
    updateField,
    handleToggleAccountEnabled,
    addRow,
    startEdit,
    saveRow,
    deleteRow,
    handleToggleAllEnabled,
    handleClearAllAccounts,
    handleExportAccounts,
    handleImportAccounts,

    // 拖拽
    onAccountDragStart,
    onAccountDragOver,
    onAccountDrop,
    onAccountDragEnd,

    // 初始化
    initEditingState,
  };
}

export default useAccountActions;
