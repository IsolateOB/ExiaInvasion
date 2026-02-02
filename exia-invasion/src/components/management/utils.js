// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 管理页面工具函数 ==========

import { elementTranslationKeys, classTranslationKeys, corporationTranslationKeys } from "./constants.js";

/**
 * 从 Cookie 字符串中解析 game_uid
 */
export const parseGameUidFromCookie = (cookieStr) => {
  if (!cookieStr) return "";
  const match = cookieStr.match(/(?:^|;\s*)game_uid=([^;]*)/);
  return match ? match[1] : "";
};

/**
 * 标准化时间戳（转为毫秒）
 */
export const normalizeTimestamp = (value) => {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num > 1e12 ? num : Math.round(num * 1000);
};

/**
 * 格式化同步时间差
 */
export const formatSyncAge = (timestampMs, t) => {
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
};

/**
 * 构建同步标签
 */
export const buildSyncLabel = (timestampMs, authToken, t) => {
  if (!authToken || !timestampMs) return null;
  const prefix = t("sync.status") || "已同步，最后更新时间：";
  return `${prefix}${formatSyncAge(timestampMs, t)}`;
};

/**
 * 获取元素名称
 */
export const getElementName = (element, t) => {
  const key = elementTranslationKeys[element];
  return key ? t(key) : element;
};

/**
 * 获取职业名称
 */
export const getClassName = (className, t) => {
  const key = classTranslationKeys[className];
  return key ? t(key) : className;
};

/**
 * 获取企业名称
 */
export const getCorporationName = (corporation, t) => {
  const key = corporationTranslationKeys[corporation];
  return key ? t(key) : corporation;
};

/**
 * 获取爆发阶段名称
 */
export const getBurstStageName = (stage, t) => {
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
};

/**
 * 获取显示名称（中/英文）
 */
export const getDisplayName = (nikke, lang) => {
  if (!nikke) return "";
  const zhName = nikke.name_cn || nikke.name_en || nikke.name_code || nikke.name;
  const enName = nikke.name_en || nikke.name_cn || nikke.name_code || nikke.name;
  return lang === "zh" ? zhName : enName;
};

/**
 * 获取优先级颜色
 */
export const getPriorityColor = (priority) => {
  // 与 excel.js 保持一致：
  // black: #000000 + 白字；blue: #99CCFF + 黑字；yellow: #FFFF88 + 黑字；red: #FF7777 + 白字
  switch (priority) {
    case "black": return { backgroundColor: "#000000", color: "#FFFFFF" };
    case "blue":  return { backgroundColor: "#99CCFF", color: "#000000" };
    case "yellow": return { backgroundColor: "#FFFF88", color: "#000000" };
    case "red":   return { backgroundColor: "#FF7777", color: "#FFFFFF" };
    default:      return { backgroundColor: "#e0e0e0", color: "#000000" };
  }
};

/**
 * 渲染文本内容（空值显示占位符）
 */
export const renderText = (txt) => (txt ? txt : "—");

/**
 * 通用文件下载函数
 */
export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

/**
 * 通用文件选择函数
 */
export const selectFile = (accept, onFileSelected) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileSelected(file);
    }
  };
  input.click();
};

/**
 * 获取单元格字符串值（处理富文本/公式等情况）
 */
export const getCellString = (cell) => {
  if (!cell) return "";
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object") {
    // 富文本 { richText: [...] }
    if (Array.isArray(v.richText)) {
      return v.richText.map(r => r.text || "").join("").trim();
    }
    // 公式 { formula, result }
    if (v.result != null) return String(v.result).trim();
    // 直接文本 { text: 'xxx' }
    if (v.text != null) return String(v.text).trim();
  }
  return String(v).trim();
};
