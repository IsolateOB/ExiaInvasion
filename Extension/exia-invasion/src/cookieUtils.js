// src/cookieUtils.js
import { IMPORTANT_KEYS } from "./constants";

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export const filterCookieStr = (raw) => {
  const obj = Object.fromEntries(
    raw.split(/;\s*/).map((kv) => kv.split("=").map((s) => s.trim()))
  );
  return IMPORTANT_KEYS.filter((k) => obj[k])
    .map((k) => `${k}=${obj[k]}`)
    .join("; ");
};

export const applyCookieStr = async (cookieStr) => {
  if (!cookieStr) return;
  for (const part of cookieStr.split(/;\s*/)) {
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
