// src/api.js


/* ---------- 载入语言模板 ---------- */
export const loadBaseAccountDict = async (lang) => {
  const fileName = lang === "en" ? "SearchIndexEng.json" : "SearchIndexChs.json";
  const url = chrome.runtime.getURL(fileName);
  const resp = await fetch(url);
  return resp.json();
};

/* ---------- API 工具 ---------- */
const buildHeader = () => ({
  "Content-Type": "application/json",
  Accept: "application/json",
});

const postJson = async (url, bodyObj) => {
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeader(),
    body: JSON.stringify(bodyObj),
    credentials: "include", // 自动带 cookie
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
};

/* ---------- 游戏 API ---------- */
export const getRoleName = () =>
  postJson(
    "https://api.blablalink.com/api/ugc/direct/standalonesite/User/GetUserGamePlayerInfo",
    {}
  ).then((j) => j?.data?.role_name || "");

export const getPlayerNikkes = () =>
  postJson(
    "https://api.blablalink.com/api/game/proxy/Tools/GetPlayerNikkes",
    {}
  );


export const getEquipments = (characterIds) =>
  postJson(
    "https://api.blablalink.com/api/game/proxy/Tools/GetPlayerEquipContents",
    { character_ids: characterIds }
  ).then((j) => {
    const list = j?.data?.player_equip_contents || [];
    const finalSlots = [null, null, null, null];
    for (const record of [...list].reverse()) {
      record.equip_contents.forEach((slot, idx) => {
        if (
          !finalSlots[idx] &&
          (slot.equip_id !== -99 || slot.equip_effects?.length)
        )
          finalSlots[idx] = slot;
      });
    }
    const result = {};
    finalSlots.forEach((slot, idx) => {
      if (!slot) {
        result[idx] = [];
        return;
      }
      const details = [];
      slot.equip_effects.forEach((eff) => {
        eff.function_details.forEach((func) => {
          details.push({
            function_type: func.function_type,
            function_value: Math.abs(func.function_value) / 100,
            level: func.level,
          });
        });
      });
      result[idx] = details;
    });
    return result;
  });

