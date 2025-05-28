// src/processor.js
import JSZip from "jszip";
import {
  getAccounts,
  setAccounts,
} from "./storage";
import {
  loadBaseAccountDict,
  getRoleName,
  getPlayerNikkes,
  getEquipments,
  loginAndGetCookie,
} from "./api";
import {
  filterCookieStr,
  applyCookieStr,
} from "./cookieUtils";
import { EXCEL_MIME } from "./constants";
import saveDictToExcel from "./excel";

/**
 * 运行主流程
 * @param {Object} opts       - lang / server / saveAsZip / exportJson / cacheCookie
 * @param {Object} callbacks  - addLog(msg) / setSnack(str) / onDone()
 */
export const processAccounts = async (opts, callbacks) => {
  const { addLog, setSnack, onDone } = callbacks;
  const {
    lang,
    server,
    saveAsZip,
    exportJson,
    cacheCookie,
    t,          // 翻译函数
  } = opts;
  
  const accounts = await getAccounts();
  if (!accounts.length) {
    setSnack(t("emptyAccounts"));
    return;
  }
  
  const zip = new JSZip();
  let cacheDirty = false;
  
  for (let i = 0; i < accounts.length; ++i) {
    const acc = { ...accounts[i] };
    addLog(`----------------------------`);
    addLog(`${t("processAccount")}${acc.name || acc.username || t("noName")}`);
    
    /* 1. Cookie 处理 */
    let cookieStr = acc.cookie?.trim() ? filterCookieStr(acc.cookie) : "";
    let usedSavedCookie = false;
    
    if (cookieStr) {
      addLog(t("loginWithCookie"));
      await applyCookieStr(cookieStr);
      usedSavedCookie = true;
    }
    
    if (!cookieStr) {
      if (!acc.password) {
        addLog(t("noPwd"));
        continue;
      }
      addLog(t("loginWithPwd"));
      try {
        cookieStr = await loginAndGetCookie(acc, server);
        await applyCookieStr(cookieStr);
      } catch (e) {
        addLog(`${t("loginFail")}${e}`);
        continue;
      }
    }
    
    /* 2. 校验 + 角色名 */
    let roleName = "";
    try {
      roleName = await getRoleName();
    } catch (err) {
      if (usedSavedCookie && acc.password) {
        addLog(t("cookieExpired"));
        try {
          cookieStr = await loginAndGetCookie(acc, server);
          await applyCookieStr(cookieStr);
          roleName = await getRoleName();
        } catch (err2) {
          addLog(`${t("reloginFail")}${err2}`);
          continue;
        }
      } else {
        addLog(`${t("getRoleNameFail")}${err}`);
        continue;
      }
    }
    addLog(`${t("roleOk")}${roleName}`);
    
    if (cacheCookie && cookieStr && cookieStr !== acc.cookie) {
      acc.cookie = cookieStr;
      accounts[i] = acc;
      cacheDirty = true;
    }
    
    /* 3. 组装 dict */
    let dict;
    try {
      dict = await loadBaseAccountDict(lang);
      dict.name = roleName;
      
      // Nikke / 装备
      const playerNikkes = await getPlayerNikkes();
      addNikkesDetailsToDict(dict, playerNikkes);
      
      await addEquipmentsToDict(dict);
    } catch (err) {
      addLog(`${t("dictFail")}${err}`);
      continue;
    }
    
    /* 4. Excel 导出 */
    let excelBuffer;
    try {
      excelBuffer = await saveDictToExcel(dict, lang);
    } catch (err) {
      addLog(`${t("excelFail")}${err}`);
      continue;
    }
    
    /* 5. 文件输出 */
    const fileBase = `${roleName || acc.name || acc.username}`;
    if (exportJson) {
      const jsonBlob = new Blob(
        [JSON.stringify(dict, null, 4)],
        { type: "application/json" }
      );
      if (saveAsZip) {
        zip.file(`${fileBase}.json`, jsonBlob);
      } else {
        const url = URL.createObjectURL(jsonBlob);
        chrome.downloads.download({ url, filename: `${fileBase}.json` },
          () => URL.revokeObjectURL(url)
        );
      }
    }
    
    if (saveAsZip) {
      zip.file(`${fileBase}.xlsx`, excelBuffer);
    } else {
      const url = URL.createObjectURL(new Blob([excelBuffer], { type: EXCEL_MIME }));
      chrome.downloads.download({ url, filename: `${fileBase}.xlsx` },
        () => URL.revokeObjectURL(url)
      );
    }
  } // for loop
  
  if (saveAsZip) {
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    chrome.downloads.download({ url, filename: "accounts.zip" },
      () => URL.revokeObjectURL(url)
    );
  }
  
  if (cacheDirty) {
    await setAccounts(accounts);
    addLog(t("cacheUpdated"));
  }
  
  addLog(t("done"));
  setSnack(t("allDone"));
  onDone?.();
};

/* ======= 辅助函数：填充 Nikke 详情 ======= */
const addNikkesDetailsToDict = (dict, playerNikkes) => {
  // 接口返回的完整角色列表
  const list = playerNikkes?.data?.player_nikkes || [];
  
  // 把同步器的最高等级记到 dict 根节点，后续制表时要用
  if (typeof dict.synchroLevel !== "number") dict.synchroLevel = 0;
  
  // dict.elements 结构：{ 火: { id1: {...}, id2: {...} }, 水: {...}, ... }
  for (const chars of Object.values(dict.elements)) {
    for (const details of Object.values(chars)) {
      const nikke = list.find((n) => n.name_code === details.name_code);
      if (!nikke) continue;
      
      // 技能 / 装备 / 突破等基础字段
      details.skill1_level      = nikke.skill1_level;
      details.skill2_level      = nikke.skill2_level;
      details.skill_burst_level = nikke.skill_burst_level;
      details.item_rare         = nikke.item_rare;
      details.item_level        = nikke.item_level;
      details.limit_break       = nikke.limit_break;
      
      /* ---------- 同步器 ---------- */
      // 记录本账号同步器的最高等级（表头要展示）
      if (nikke.level > dict.synchroLevel) {
        dict.synchroLevel = nikke.level;
      }
      
      /* ---------- 魔方 ---------- */
      if (nikke.cube_id && nikke.cube_level) {
        // dict.cubes 里放着所有魔方的当前最佳等级
        for (const cube of Object.values(dict.cubes)) {
          if (cube.cube_id === nikke.cube_id &&
            nikke.cube_level > cube.cube_level) {
            cube.cube_level = nikke.cube_level;
          }
        }
      }
    }
  }
};

/* ======= 辅助函数：填充装备 ======= */
const addEquipmentsToDict = async (dict) => {
  for (const chars of Object.values(dict.elements)) {
    for (const details of Object.values(chars)) {
      // 一个角色 ID 连续 +0 ~ +10 是同一角色的所有部位
      const characterIds = Array.from({ length: 11 }, (_, i) => details.id + i);
      // 把装备列表直接挂到 details.equipments，后面制表要用
      details.equipments = await getEquipments(characterIds);
    }
  }
};

