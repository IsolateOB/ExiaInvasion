// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 文件合并 Hook ==========

import { useState, useCallback } from "react";
import { mergeWorkbooks, mergeJsons } from "../../../utils/merge.js";

/**
 * 文件合并 Hook
 * @param {Object} options
 * @param {Function} options.t - 翻译函数
 * @param {string} options.sortFlag - 排序标志
 */
export function useMerge({ t, sortFlag }) {
  const [excelFilesToMerge, setExcelFilesToMerge] = useState([]);
  const [jsonFilesToMerge, setJsonFilesToMerge] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = useCallback((msg) => setLogs((prev) => [...prev, msg]), []);
  const clearLogs = useCallback(() => setLogs([]), []);

  const handleExcelFileSelect = useCallback((e) => {
    setExcelFilesToMerge(Array.from(e.target.files));
  }, []);

  const handleJsonFileSelect = useCallback((e) => {
    setJsonFilesToMerge(Array.from(e.target.files));
  }, []);

  const handleMerge = useCallback(async () => {
    if (!excelFilesToMerge.length && !jsonFilesToMerge.length) {
      addLog(t("upload"));
      return;
    }
    clearLogs();
    setLoading(true);
    try {
      addLog(t("starting"));
      const tasks = [];
      
      // 合并 Excel
      if (excelFilesToMerge.length) {
        tasks.push((async () => {
          addLog(`开始合并 Excel (${excelFilesToMerge.length} 个)`);
          const mergedBuffer = await mergeWorkbooks(excelFilesToMerge, sortFlag, addLog);
          const blob = new Blob([mergedBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          const url = URL.createObjectURL(blob);
          chrome.downloads.download({ url, filename: "merged.xlsx" }, () =>
            URL.revokeObjectURL(url)
          );
          addLog("Excel 合并完成");
        })());
      }

      // 合并 JSON
      if (jsonFilesToMerge.length) {
        tasks.push((async () => {
          addLog(`开始合并 JSON (${jsonFilesToMerge.length} 个)`);
          const mergedJsonStr = await mergeJsons(jsonFilesToMerge, sortFlag, addLog);
          const blob = new Blob([mergedJsonStr], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          chrome.downloads.download({ url, filename: "merged.json" }, () =>
            URL.revokeObjectURL(url)
          );
          addLog("JSON 合并完成");
        })());
      }
      
      if (tasks.length) {
        await Promise.all(tasks);
      }
      addLog(t("done"));
    } catch (e) {
      addLog(`${t("fail")} ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [t, sortFlag, excelFilesToMerge, jsonFilesToMerge, addLog, clearLogs]);

  return {
    excelFilesToMerge,
    jsonFilesToMerge,
    loading,
    logs,
    handleExcelFileSelect,
    handleJsonFileSelect,
    handleMerge,
  };
}

export default useMerge;
