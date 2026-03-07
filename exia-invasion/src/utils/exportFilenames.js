// SPDX-License-Identifier: GPL-3.0-or-later

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g;

function replaceControlCharacters(value) {
  return Array.from(value, (char) => (
    char.charCodeAt(0) <= 0x1f ? "_" : char
  )).join("");
}

function sanitizeSegment(value, fallback) {
  const normalized = replaceControlCharacters(String(value ?? ""))
    .replace(INVALID_FILENAME_CHARS, "_")
    .trim();
  return normalized || fallback;
}

export function createUniqueExportFileName({
  accountName,
  gameUid,
  extension,
  usedNames,
}) {
  const safeExtension = String(extension ?? "").replace(/^\./, "").trim();
  const safeAccountName = sanitizeSegment(accountName, "account");
  const safeUid = sanitizeSegment(gameUid, "");
  const baseName = safeUid ? `${safeAccountName}_${safeUid}` : safeAccountName;

  let nextName = safeExtension ? `${baseName}.${safeExtension}` : baseName;
  let suffix = 2;
  while (usedNames.has(nextName)) {
    nextName = safeExtension
      ? `${baseName} (${suffix}).${safeExtension}`
      : `${baseName} (${suffix})`;
    suffix += 1;
  }

  usedNames.add(nextName);
  return nextName;
}
