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

// 从Cookie中获取intl_open_id
const getIntlOpenId = async () => {
  // 使用Chrome API获取cookie，而不是document.cookie
  const cookies = await chrome.cookies.getAll({ domain: ".blablalink.com" });
  const gameOpenIdCookie = cookies.find(cookie => cookie.name === 'game_openid');
  
  if (gameOpenIdCookie) {
    return gameOpenIdCookie.value;
  }
  
  throw new Error("未找到 game_openid cookie");
};

// 获取角色名和area_id
export const getRoleName = () =>
  postJson(
    "https://api.blablalink.com/api/ugc/direct/standalonesite/User/GetUserGamePlayerInfo",
    {}
  ).then((j) => ({
    role_name: j?.data?.role_name || "",
    area_id: j?.data?.area_id || ""
  }));

// 获取同步器等级
export const getSyncroLevel = () =>
  postJson(
    "https://api.blablalink.com/api/game/proxy/Tools/GetPlayerBattleInfo",
    {}
  ).then((j) => j?.data?.outpost_detail?.sychro_level || 0);

// 获取角色详情和装备信息（逐个获取以避免API错误）
export const getCharacterDetails = async (areaId, nameCodes) => {
  const intlOpenId = await getIntlOpenId();
  const allCharacterDetails = [];
  const allStateEffects = [];
  
  // 逐个获取角色信息，避免因包含不存在的角色而导致整个请求失败
  for (const nameCode of nameCodes) {
    try {
      const response = await postJson(
        "https://api.blablalink.com/api/game/proxy/Game/GetUserCharacterDetails",
        {
          intl_open_id: intlOpenId,
          nikke_area_id: parseInt(areaId),
          name_codes: [nameCode] // 单个角色请求
        }
      );
      
      if (response?.data?.character_details) {
        allCharacterDetails.push(...response.data.character_details);
      }
      if (response?.data?.state_effects) {
        allStateEffects.push(...response.data.state_effects);
      }
    } catch (error) {
      // 如果单个角色获取失败，记录但继续处理其他角色
      console.warn(`获取角色 ${nameCode} 详情失败:`, error.message);
    }
  }
  
  // 创建state_effects的映射表，便于查找
  const effectsMap = {};
  allStateEffects.forEach(effect => {
    effectsMap[effect.id] = effect;
  });
  
  return allCharacterDetails.map(char => {
    // 处理突破信息（新格式：grade + core）
    const limitBreak = {
      grade: char.grade || 0,
      core: char.core || 0
    };
    
    // 处理装备词条
    const equipments = {};
    const equipSlots = ['head', 'torso', 'arm', 'leg'];
    
    equipSlots.forEach((slot, idx) => {
      const details = [];
      for (let i = 1; i <= 3; i++) {
        const optionKey = `${slot}_equip_option${i}_id`;
        const optionId = char[optionKey];
        if (optionId && optionId !== 0) {
          const effect = effectsMap[optionId.toString()];
          if (effect && effect.function_details) {
            effect.function_details.forEach(func => {
              details.push({
                function_type: func.function_type,
                function_value: Math.abs(func.function_value) / 100,
                level: func.level,
              });
            });
          }
        }
      }
      equipments[idx] = details;
    });
    
    return {
      name_code: char.name_code,
      lv: char.lv || 1,
      skill1_lv: char.skill1_lv || 1,
      skill2_lv: char.skill2_lv || 1,
      ulti_skill_lv: char.ulti_skill_lv || 1,
      favorite_item_lv: char.favorite_item_lv || 0,
      favorite_item_tid: char.favorite_item_tid || 0,
      combat: char.combat || 0,
      limitBreak: limitBreak,
      equipments: equipments,
      // 魔方信息
      cube_id: char.harmony_cube_tid || 0,
      cube_level: char.harmony_cube_lv || 0
    };
  });
};

// 获取用户所有角色的基础信息（包含core和grade）
export const getUserCharacters = async (areaId) => {
  const intlOpenId = await getIntlOpenId();
  
  try {
    const response = await postJson(
      "https://api.blablalink.com/api/game/proxy/Game/GetUserCharacters",
      {
        intl_open_id: intlOpenId,
        nikke_area_id: parseInt(areaId)
      }
    );
    
    if (response?.data?.characters) {
      return response.data.characters.map(char => ({
        name_code: char.name_code,
        lv: char.lv || 1,
        combat: char.combat || 0,
        core: char.core || 0,
        grade: char.grade || 0,
        costume_id: char.costume_id || 0
      }));
    }
    
    return [];
  } catch (error) {
    console.error("获取用户角色列表失败:", error);
    throw error;
  }
};

// 保持兼容性的旧接口（已废弃，但保留以防其他地方调用）
export const getPlayerNikkes = () => {
  console.warn("getPlayerNikkes 接口已废弃，请使用 getCharacterDetails");
  return Promise.resolve({ data: { nikkes: [] } });
};

export const getEquipments = () => {
  console.warn("getEquipments 接口已废弃，请使用 getCharacterDetails");
  return Promise.resolve({});
};

