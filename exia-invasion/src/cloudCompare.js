// SPDX-License-Identifier: GPL-3.0-or-later
// 云端/本地数据对比工具

export const isAccountsEmpty = (data) => !Array.isArray(data) || data.length === 0;

export const isCharactersEmpty = (data) => {
  if (!data || typeof data !== "object") return true;
  const elements = data.elements || {};
  const total = ["Electronic", "Fire", "Wind", "Water", "Iron", "Utility"]
    .map((key) => Array.isArray(elements[key]) ? elements[key].length : 0)
    .reduce((sum, n) => sum + n, 0);
  return total === 0;
};

export const normalizeAccountsFromRemote = (data) => {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
};

const normalizeForCompare = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForCompare(item));
  }
  if (value && typeof value === "object") {
    const sortedKeys = Object.keys(value).sort();
    const normalized = {};
    sortedKeys.forEach((key) => {
      normalized[key] = normalizeForCompare(value[key]);
    });
    return normalized;
  }
  return value;
};

const normalizeAccountsForCompare = (list) => {
  if (!Array.isArray(list)) return [];
  const sanitized = list
    .map((acc) => ({
      game_uid: acc?.game_uid || acc?.gameUid || "",
      username: acc?.username || "",
      cookie: acc?.cookie || "",
      cookieUpdatedAt: acc?.cookieUpdatedAt ?? acc?.cookie_updated_at ?? null,
    }))
    .filter((acc) => acc.game_uid || acc.cookie || acc.username);
  const keyOf = (acc) => acc?.game_uid || acc?.cookie || acc?.username || "";
  sanitized.sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  return sanitized;
};

const normalizeCharacterEntryForCompare = (entry) => {
  const normalized = normalizeForCompare(entry || {});
  if (Array.isArray(normalized.showStats)) {
    normalized.showStats = [...normalized.showStats].sort();
  }
  return normalized;
};

const normalizeCharactersForCompare = (data) => {
  const elements = data?.elements || {};
  const elementKeys = ["Electronic", "Fire", "Wind", "Water", "Iron", "Utility"];
  const normalizedElements = {};
  elementKeys.forEach((key) => {
    const list = Array.isArray(elements[key]) ? elements[key] : [];
    // Only include non-empty arrays to ignore empty array differences
    if (list.length > 0) {
      const normalizedList = list
        .map(normalizeCharacterEntryForCompare)
        .sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
      normalizedElements[key] = normalizedList;
    }
  });

  // Only include showEquipDetails if it's explicitly false
  const options = {};
  if (data?.options?.showEquipDetails === false) {
    options.showEquipDetails = false;
  }

  return normalizeForCompare({ elements: normalizedElements, options });
};

export const buildAccountsSignature = (list) => JSON.stringify(normalizeAccountsForCompare(list));

export const buildCharactersSignature = (data) => JSON.stringify(normalizeCharactersForCompare(data || {}));
