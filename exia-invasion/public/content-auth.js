// SPDX-License-Identifier: GPL-3.0-or-later

const CHANNEL_NAME = "exia-auth";
const AUTH_STORAGE_KEY = "exia-analysis-auth";

const readAuth = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    return {
      token: parsed.token,
      username: parsed.username || "",
      avatar_url: parsed.avatar_url || null,
    };
  } catch {
    return null;
  }
};

const clearAuth = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
};

const channel = new BroadcastChannel(CHANNEL_NAME);

channel.onmessage = (event) => {
  const data = event?.data || {};
  const payload = data.type === "auth:update"
    ? { type: "auth:status", loggedIn: true }
    : data.type === "auth:clear"
      ? { type: "auth:status", loggedIn: false }
      : data;
  chrome.runtime.sendMessage({ type: "EXIA_AUTH", payload });
};

window.addEventListener("storage", (event) => {
  if (event.key !== AUTH_STORAGE_KEY) return;
  const payload = readAuth();
  chrome.runtime.sendMessage({
    type: "EXIA_AUTH",
    payload: { type: "auth:status", loggedIn: Boolean(payload?.token) },
  });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "EXIA_AUTH_REQUEST") {
    sendResponse({ auth: readAuth() });
    return true;
  }
  if (msg?.type === "EXIA_AUTH_CLEAR") {
    clearAuth();
    channel.postMessage({ type: "auth:clear" });
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
