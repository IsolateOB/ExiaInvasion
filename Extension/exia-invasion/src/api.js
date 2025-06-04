// API接口和数据处理模块
import { getCharacters } from "./storage.js";

/* ========== 载入基础账号数据模板 ========== */
export const loadBaseAccountDict = async () => {
  // 加载魔方数据
  const listUrl = chrome.runtime.getURL("list.json");
  const listResp = await fetch(listUrl);
  const listData = await listResp.json();
  
  // 构建魔方数组，包含ID、等级和名称信息
  const cubes = listData.cubes.map(cube => ({
    cube_id: cube.cube_id,
    cube_level: 0,
    name_cn: cube.name_cn,
    name_en: cube.name_en
  }));
  
  // 从存储中获取角色数据（角色管理系统）
  const charactersData = await getCharacters();
  
  // 确保所有元素都是数组格式，如需要则进行迁移
  const migratedElements = {};
  ["Electronic", "Fire", "Wind", "Water", "Iron", "Utility"].forEach(element => {
    if (charactersData.elements && charactersData.elements[element]) {
      if (Array.isArray(charactersData.elements[element])) {
        migratedElements[element] = charactersData.elements[element];
      } else {
        // 将对象转换为数组进行迁移
        migratedElements[element] = Object.values(charactersData.elements[element]);
      }
    } else {
      migratedElements[element] = [];
    }
  });
  
  // 创建基础数据结构，统一元素名称和固定排序
  const baseDict = {
    name: "",
    synchroLevel: 0,
    cubes: cubes,
    elements: migratedElements
  };
  
  return baseDict;
};

/* ========== HTTP请求工具函数 ========== */
const buildHeader = () => ({
  "Content-Type": "application/json",
  Accept: "application/json",
});

const postJson = async (url, bodyObj) => {
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeader(),
    body: JSON.stringify(bodyObj),
    credentials: "include", // 自动携带Cookie
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
};

/* ========== 游戏API接口 ========== */
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
    // 反向遍历，确保获取最新的装备数据
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
      // 处理装备词条数据
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

