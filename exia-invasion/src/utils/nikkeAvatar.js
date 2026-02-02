// SPDX-License-Identifier: GPL-3.0-or-later
// Nikke 头像相关工具：管理页与 Excel 导出共用

export const getNikkeResourceId = (nikke, resourceIdMap) => {
  if (!nikke) return undefined;
  const direct = nikke.resource_id ?? nikke.resourceId;
  if (direct !== undefined && direct !== null && direct !== "") return direct;

  const id = nikke.id;
  if (id === undefined || id === null) return undefined;
  return resourceIdMap?.get?.(id);
};

export const getNikkeAvatarUrl = (nikke, resourceIdMap) => {
  const rid = getNikkeResourceId(nikke, resourceIdMap);
  if (rid === undefined || rid === null || rid === "") return "";
  const ridStr = String(rid).padStart(3, "0");
  return `https://raw.githubusercontent.com/Nikke-db/Nikke-db.github.io/main/images/sprite/si_c${ridStr}_00_s.png`;
};

export const guessImageExtensionFromUrl = (url, fallback = "png") => {
  if (!url) return fallback;
  try {
    const u = new URL(url);
    const pathname = u.pathname || "";
    const lastDot = pathname.lastIndexOf(".");
    if (lastDot < 0) return fallback;
    const ext = pathname.slice(lastDot + 1).toLowerCase();
    if (!ext) return fallback;
    // ExcelJS 常见支持：png/jpeg/gif
    if (ext === "jpg") return "jpeg";
    if (ext === "jpeg" || ext === "png" || ext === "gif") return ext;
    return fallback;
  } catch {
    return fallback;
  }
};

export const fetchAsArrayBuffer = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return await res.arrayBuffer();
};

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export const arrayBufferToDataUrl = (buffer, extension = "png") => {
  const ext = (extension || "png").toLowerCase();
  const mime = ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : "image/png";
  const b64 = arrayBufferToBase64(buffer);
  return `data:${mime};base64,${b64}`;
};
