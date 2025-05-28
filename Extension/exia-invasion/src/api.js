// src/api.js
import JSZip from "jszip";
import { EXCEL_MIME, IMPORTANT_KEYS } from "./constants";
import { delay, applyCookieStr } from "./cookieUtils";
import saveDictToExcel from "./excelUtils";

/* ---------- 载入语言模板 ---------- */
export const loadBaseAccountDict = async (lang) => {
  const fileName = lang === "en" ? "SearchIndexEng.json" : "SearchIndexChs.json";
  const url = chrome.runtime.getURL(fileName);
  const resp = await fetch(url);
  return resp.json();
};

/* ---------- fetch 帮手 ---------- */
const header = { "Content-Type": "application/json", Accept: "application/json" };
const postJson = async (url, body) => {
  const r = await fetch(url, {
    method: "POST",
    headers: header,
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
};

/* ---------- 游戏 API ---------- */
export const getRoleName = () =>
  postJson(
    "https://api.blablalink.com/api/ugc/direct/standalonesite/User/GetUserGamePlayerInfo",
    {}
  ).then((j) => j?.data?.role_name ?? "");

export const getPlayerNikkes = () =>
  postJson("https://api.blablalink.com/api/game/proxy/Tools/GetPlayerNikkes", {});

export const getEquipments = (characterIds) =>
  postJson(
    "https://api.blablalink.com/api/game/proxy/Tools/GetPlayerEquipContents",
    { character_ids: characterIds }
  ).then((j) => j?.data?.player_equip_contents ?? []);

/* ---------- 自动登录并获取 Cookie ---------- */
export const loginAndGetCookie = async (acc, serverFlag) => {
  const tab = await new Promise((res) =>
    chrome.tabs.create({ url: "https://www.blablalink.com/login", active: false }, res)
  );
  
  await new Promise((res) => {
    const listener = (id, info) => {
      if (id === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        res();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
  
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: ({ email, password, server }) => {
      /* …这里复制你原先的 DOM 自动填表脚本… */
    },
    args: [{ email: acc.email, password: acc.password, server: serverFlag }],
  });
  
  // 轮询等待关键 Cookie
  let cookieStr = "";
  for (let i = 0; i < 150; i++) {
    await delay(100);
    const cookies = await new Promise((res) =>
      chrome.cookies.getAll({ domain: ".blablalink.com" }, res)
    );
    const m = Object.fromEntries(
      cookies.filter((c) => IMPORTANT_KEYS.includes(c.name)).map((c) => [c.name, c.value])
    );
    if (IMPORTANT_KEYS.every((k) => m[k])) {
      cookieStr = IMPORTANT_KEYS.map((k) => `${k}=${m[k]}`).join("; ");
      break;
    }
  }
  chrome.tabs.remove(tab.id);
  await applyCookieStr(cookieStr);
  return cookieStr;
};



