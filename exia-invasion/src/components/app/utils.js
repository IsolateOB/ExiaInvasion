// SPDX-License-Identifier: GPL-3.0-or-later
// ========== App 工具函数 ==========

import { API_BASE_URL } from "./constants.js";

/**
 * 获取用户资料
 */
export const fetchProfile = async (token) => {
  const res = await fetch(`${API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
};

/**
 * 从 Cookie 字符串中解析 game_uid
 */
export const parseGameUidFromCookie = (cookieStr) => {
  if (!cookieStr) return "";
  const match = cookieStr.match(/(?:^|;\s*)game_uid=([^;]*)/);
  return match ? match[1] : "";
};

/**
 * Cookie 数组转字符串
 */
export const cookieArrToStr = (cks) => {
  const map = new Map();
  
  // 后出现的同名 cookie 会覆盖前面的，优先保留根路径
  cks.forEach((c) => {
    if (!map.has(c.name) || c.path === "/") {
      map.set(c.name, c.value);
    }
  });
  
  return [...map.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
};
