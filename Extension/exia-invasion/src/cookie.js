// src/cookie.js
import { IMPORTANT_KEYS } from "./constants";

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export const filterCookieStr = (raw) => {
  const obj = Object.fromEntries(
    raw.split(/;\s*/).map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    })
  );
  return IMPORTANT_KEYS.filter((k) => obj[k])
    .map((k) => `${k}=${obj[k]}`)
    .join("; ");
};

export const applyCookieStr = async (cookieStr) => {
  if (!cookieStr) return;
  const parts = cookieStr.split(/;\s*/);
  for (const part of parts) {
    const [name, value] = part.split("=");
    if (!name) continue;
    await chrome.cookies.set({
      url: "https://www.blablalink.com/",
      name,
      value,
      path: "/",
    });
  }
};

export const clearSiteCookies = async () => {
  // 1. 取出 .blablalink.com 及所有子域的 cookie
  const cookies = await chrome.cookies.getAll({
    domain: "blablalink.com",
  });
  
  // 2. 逐个删除
  await Promise.all(
    cookies.map((c) => {
      // cookies.remove 需要完整 URL
      const url =
        (c.secure ? "https://" : "http://") +
        // cookies.getAll 返回的 c.domain 可能带前导点，要去掉
        c.domain.replace(/^\./, "") +
        c.path;
      
      return chrome.cookies.remove({ url, name: c.name });
    })
  );
};