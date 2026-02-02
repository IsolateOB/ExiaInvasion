// SPDX-License-Identifier: GPL-3.0-or-later
// Excel表格生成模块
import ExcelJS from "exceljs";
import { computeAELScore, isUnowned, getEquipSumStats } from './ael.js';
import TRANSLATIONS from '../i18n/translations.js';
import { getNikkeAvatarUrl } from './nikkeAvatar.js';
import { fetchAndCacheNikkeDirectory, getCachedNikkeDirectory } from '../services/api.js';

// 边框样式定义
const mediumSide = { style: "medium", color: { argb: "FF000000" } };
const thinSide   = { style: "thin",   color: { argb: "FF000000" } };

/**
 * 设置外边框
 * @param {*} ws 工作表
 * @param {*} r1 起始行
 * @param {*} c1 起始列
 * @param {*} r2 结束行
 * @param {*} c2 结束列
 * @param {*} side 边框样式
 */
const setOuterBorder = (ws, r1, c1, r2, c2, side = mediumSide) => {
  for (let c = c1; c <= c2; ++c) {
    ws.getCell(r1, c).border = { ...ws.getCell(r1, c).border, top: side };
    ws.getCell(r2, c).border = { ...ws.getCell(r2, c).border, bottom: side };
  }
  for (let r = r1; r <= r2; ++r) {
    ws.getCell(r, c1).border = { ...ws.getCell(r, c1).border, left: side };
    ws.getCell(r, c2).border = { ...ws.getCell(r, c2).border, right: side };
  }
};

/**
 * 设置垂直边框
 */
const setVerticalBorder = (ws, r1, r2, col, side = thinSide, pos = "right") => {
  for (let r = r1; r <= r2; ++r)
    ws.getCell(r, col).border = { ...ws.getCell(r, col).border, [pos]: side };
};

/**
 * 设置水平边框
 */
const setHorizontalBorder = (ws, row, c1, c2, side = thinSide, pos = "bottom") => {
  for (let c = c1; c <= c2; ++c)
    ws.getCell(row, c).border = { ...ws.getCell(row, c).border, [pos]: side };
};

const getAvatarFillByElement = (elementName) => {
  // 颜色：
  // 电击(Electronic) #FF00FF
  // 风压(Wind)       #00FF16
  // 燃烧(Fire)       #FF0000
  // 水冷(Water)      #007EFF
  // 铁甲(Iron)       #FF9201
  const map = {
    Electronic: "FFFF00FF",
    Wind: "FF00FF16",
    Fire: "FFFF0000",
    Water: "FF007EFF",
    Iron: "FFFF9201",
  };
  const argb = map[elementName];
  if (!argb) return null;
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
};

/* ========== 数据格式化函数 ========== */
const getLimitBreakStr = (lb) => {
  // 新格式：lb是一个对象 {grade: number, core: number}
  if (typeof lb === 'object' && lb !== null) {
    const { grade = 0, core = 0 } = lb;
    if (grade < 0) return "";
    
    // grade未满3时，显示grade ★
    if (grade < 3) return `${grade} ★`;
    
    // grade满3时，如果core > 0，显示 + core，否则显示 3 ★
    if (grade === 3) {
      if (core > 0) {
        if (core >= 7) return "MAX";
        return `+ ${core}`;
      } else {
        return `${grade} ★`;
      }
    }
    
    // grade > 3的情况（理论上不应该发生，但保险起见）
    return "MAX";
  }
  
  // 兼容旧格式
  if (typeof lb === 'number') {
    if (lb < 0) return "";
    if (lb <= 3) return `${lb} ★`;
    if (lb < 10) return `+ ${lb - 3}`;
    return "MAX";
  }
  
  return "";
};


const getItemLevelStr = (rare, lvl) => {
  // 支持字符串和数字两种格式
  if (rare === "SSR") {
    return `${lvl + 1}★`;
  }
  return lvl;
};

/* ========== 装备词条颜色配置 ========== */
const getFillByLevel = (lvl) => {
  if (lvl >= 1 && lvl <= 5)   return { type: "pattern", pattern: "solid", fgColor: { argb: "FF7777" } };  // 红色
  if (lvl >= 6 && lvl <= 10)  return { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF77" } };  // 黄色
  if (lvl >= 11 && lvl <= 14) return { type: "pattern", pattern: "solid", fgColor: { argb: "77AAFF" } };  // 蓝色
  if (lvl === 15)             return { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } }; // 黑色
  return null;
};

const getFontByLevel = (lvl) => {
  if (lvl === 15) return { color: { argb: "FFFFFF" } };  // 黑底白字
  return { color: { argb: "000000" } };                  // 默认黑字
};

/* ========== 主函数：生成Excel表格 ========== */
export const saveDictToExcel = async (dict, lang = "en") => {  const t = (key) => TRANSLATIONS[lang][key] || key;
  const wb = new ExcelJS.Workbook();
  // 确保打开文件时强制重算，避免新函数/外部数据导致初始缓存结果（如 #NAME?）
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet(t("playerInfo"));

  // 词条细节：折叠时隐藏 4 行装备细节，仅显示“总和”
  const showEquipDetails = dict?.options?.showEquipDetails !== false;

  // 角色头像需要 resource_id：优先读缓存目录，缺失则在线拉取一次
  let nikkeDir = [];
  try {
    nikkeDir = await getCachedNikkeDirectory();
  } catch {
    nikkeDir = [];
  }
  if (!Array.isArray(nikkeDir) || nikkeDir.length === 0) {
    try {
      nikkeDir = await fetchAndCacheNikkeDirectory();
    } catch {
      nikkeDir = [];
    }
  }
  const resourceIdMap = new Map();
  if (Array.isArray(nikkeDir)) {
    for (const n of nikkeDir) {
      if (!n) continue;
      if (n.id === undefined || n.id === null) continue;
      if (n.resource_id === undefined || n.resource_id === null || n.resource_id === "") continue;
      resourceIdMap.set(n.id, n.resource_id);
    }
  }
  
  // 设置行高（第1行头像更高；第2行名称；第3行表头）
  ws.getRow(1).height = 60;
  ws.getRow(2).height = 25;
  ws.getRow(3).height = 25;

  // 装备细节行：5-8（4 行）。折叠细节时隐藏它们，等价于“折叠 4 行”
  for (let r = 5; r <= 8; r++) {
    ws.getRow(r).hidden = !showEquipDetails;
  }
  
  /* ========== 基本信息区：序号/名称/同步器 ========== */
  // 表头合并单元格：A1:B3 和 C1:C3
  ws.mergeCells(1,1,3,2);
  ws.mergeCells(1,3,3,3);
  ws.getCell(1,1).value = t("playerName");
  ws.getCell(1,3).value = t("synchro");
  ["A1","C1"].forEach(addr=>{
    const cell = ws.getCell(addr);
    cell.font = { bold:true };
    cell.alignment = { horizontal:"center", vertical:"middle" };
  });
  
  // 数据区：A4:A8 B4:B8 C4:C8
  ws.mergeCells(4,1,8,1);  // 序号
  ws.mergeCells(4,2,8,2);  // 名称
  ws.mergeCells(4,3,8,3);  // 同步器
  ws.getCell(4,2).value = dict.name;
  ws.getCell(4,3).value = dict.synchroLevel;
  ["A4","B4","C4"].forEach(addr=>{
    ws.getCell(addr).alignment = { horizontal:"center", vertical:"middle" };
    ws.getCell(addr).font = { bold: addr!=="A4" }; // 名称加粗
  });
  
  // 设置外边框
  setOuterBorder(ws,1,1,3,3,mediumSide);
  setOuterBorder(ws,4,1,8,3,mediumSide);
  setVerticalBorder(ws, 1, 8, 3, mediumSide, "left");
    /* ========== 角色信息区 ========== */
  // 角色块宽度：与属性列一一对应（第1行=名称合并；第2行=头像合并）
  const widthPerChar = 17;
  // 将 AEL 列移至人物块最右侧
  const propertyKeys = [
    "limit_break","skill1_level","skill2_level","skill_burst_level",
    "item_rare","item_level",null,
    "IncElementDmg","StatAtk","StatAmmoLoad","StatChargeTime","StatChargeDamage",
    "StatCritical","StatCriticalDamage","StatAccuracyCircle","StatDef",
    "AtkElemLbScore"
  ];

  const propertyLabels = [
    t("limitBreak"), t("skill1"), t("skill2"), t("burst"), t("item"), null, t("t10"),
    t("elementAdvantage"), t("attack"), t("ammo"), t("chargeSpeed"), t("chargeDamage"),
    t("critical"), t("criticalDamage"), t("hit"), t("defense"),
    t("atkElemLbScore")
  ];

  // 动态索引，避免硬编码
  const statsStartIdx = propertyKeys.indexOf("IncElementDmg"); // 词条统计列起始索引
  const itemIdx = propertyLabels.findIndex(lbl => lbl === t("item"));
  const t10Idx = propertyLabels.findIndex(lbl => lbl === t("t10"));
  const itemLevelIdx = propertyKeys.indexOf("item_level");

  // 将“总和”放在第 4 行（首行），避免隐藏细节行后看不到突破/技能等合并单元格内容
  const equipRowLabels = [t("total"), t("head"), t("torso"), t("arm"), t("leg")];

  // 固定的元素顺序（仍按元素顺序拼接，但不再输出“元素分类”表头行）
  const elementOrder = ["Electronic", "Fire", "Wind", "Water", "Iron", "Utility"];    let startCol = 4;
  for (const elementName of elementOrder) {
    const charsArray = Array.isArray(dict.elements[elementName]) ? dict.elements[elementName] : [];
    const totalWidth = charsArray.length * widthPerChar;
    
    if (charsArray.length === 0) continue; // 跳过空元素
    
    let colCursor = startCol;
    for (const charInfo of charsArray) {
      // 第1行：头像（整块合并，占用所有合并单元格）
      ws.mergeCells(1, colCursor, 1, colCursor + widthPerChar - 1);
      const avatarCell = ws.getCell(1, colCursor);
      avatarCell.value = "";
      avatarCell.alignment = { horizontal: "center", vertical: "middle" };

      // 按元素给头像区域填充底色（整个合并区域都填充，避免仅左上角生效）
      const avatarFill = getAvatarFillByElement(elementName);
      if (avatarFill) {
        for (let c = colCursor; c <= colCursor + widthPerChar - 1; c++) {
          ws.getCell(1, c).fill = avatarFill;
        }
      }

      // 第2行：人物名称（整块合并）
      ws.mergeCells(2, colCursor, 2, colCursor + widthPerChar - 1);
      const nameCell = ws.getCell(2, colCursor);
      const characterName = lang === "en" ? charInfo.name_en : charInfo.name_cn;
      nameCell.value = characterName || charInfo.id;
      nameCell.alignment = { horizontal: "center", vertical: "middle" };

      // 下方细线：头像行下方（第1行）
      setHorizontalBorder(ws,1,colCursor,colCursor+widthPerChar-1,thinSide,"bottom");

      // 属性列起始（与人物块起始列一致；头像仅占用第2行）
      const baseCol = colCursor;

      // 使用 Excel IMAGE() 公式：支持 IMAGE 的 Excel 会把图片作为“单元格内图片”渲染
      // 不支持 IMAGE 的版本会显示 #NAME?（这是预期行为）
      const avatarUrl = getNikkeAvatarUrl(charInfo, resourceIdMap);
      if (avatarUrl) {
        const safeUrl = String(avatarUrl).replace(/"/g, '""');
        // 使用 _xlfn 前缀写入新函数，Excel 365 打开时更稳定识别；旧版依旧会显示 #NAME?
        avatarCell.value = { formula: `_xlfn.IMAGE("${safeUrl}")`, result: "" };
      }
      
      // 优先级颜色设置
      switch(charInfo.priority){
        case "black":
          nameCell.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FF000000"}};
          nameCell.font = { color:{argb:"FFFFFF"}, bold:true };
          break;
        case "red":
          nameCell.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FF7777"}};
          nameCell.font = { color:{argb:"FFFFFF"}, bold:true };
          break;
        case "blue":
          nameCell.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"99CCFF"}};
          nameCell.font = { bold:true };
          break;
        case "yellow":
          nameCell.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FFFF88"}};
          nameCell.font = { bold:true };
          break;
      }
      
      // 属性列标签行
      propertyLabels.forEach((lbl,i)=>{
        if(lbl===null) return;
        const colIdx = baseCol + i;
        // "道具"表头覆盖两列（稀有度+等级）
        if(lbl === t("item")) ws.mergeCells(3,colIdx,3,colIdx+1);
        const headCell = ws.getCell(3,colIdx);
        headCell.value = lbl;
        headCell.alignment = { horizontal:"center", vertical:"middle" };
      });
      
      // 角色基础数据 (第4行)
      const {
        limit_break,
        skill1_level,
        skill2_level,
        skill_burst_level,
        item_rare = "",
        item_level,
        equipments = {}      
      } = charInfo;

      // 统一复用公共判定逻辑
      const unowned = isUnowned(charInfo);
      
      // 填入基础数据（AEL 已移至最右侧，基础从首列开始）
      let baseOffset = 0;
      // AEL列保持合并但不写占位值；仅在有数据时回填分数
      if (!unowned) {
        ws.getCell(4,baseCol+baseOffset).value = getLimitBreakStr(limit_break);
        if (typeof skill1_level !== 'undefined') ws.getCell(4,baseCol+baseOffset+1).value = skill1_level;
        if (typeof skill2_level !== 'undefined') ws.getCell(4,baseCol+baseOffset+2).value = skill2_level;
        if (typeof skill_burst_level !== 'undefined') ws.getCell(4,baseCol+baseOffset+3).value = skill_burst_level;
        // 仅当存在珍藏品时填写稀有度与等级，避免无珍藏品时出现等级0
        if (item_rare) {
          ws.getCell(4,baseCol+baseOffset+4).value = item_rare;
          if (typeof item_level !== 'undefined') {
            ws.getCell(4,baseCol+baseOffset+5).value = getItemLevelStr(item_rare,item_level);
          }
        }
      }
      
      // 设置居中对齐（含可选的攻优突破分列、LB与装备稀有度/等级）
      for(let i=0;i<=itemLevelIdx;i++){
        ws.getCell(4,baseCol+i).alignment = { horizontal:"center", vertical:"middle" };
      }
      
      // 合并基础区纵向单元格 (第4-8行)（不含 AEL）
      for(let i=0;i<=itemLevelIdx;i++){
        ws.mergeCells(4,baseCol+i,8,baseCol+i);
      }
      
      // 装备词条处理 (第4-7行每个装备槽) 和 汇总 (第8行)
      const sumStats = {
        IncElementDmg:0,StatAtk:0,StatAmmoLoad:0,StatChargeTime:0,StatChargeDamage:0,
        StatCritical:0,StatCriticalDamage:0,StatAccuracyCircle:0,StatDef:0
      };
      
      // 设置行标题
      equipRowLabels.forEach((lbl,rowIdx)=>{
        ws.getCell(4+rowIdx,baseCol+t10Idx).value = lbl;
        ws.getCell(4+rowIdx,baseCol+t10Idx).alignment = { horizontal:"center", vertical:"middle" };
      });
      
      const pctFmt = "0.00%"; // 百分比格式
      
      // 处理4个装备槽位
      for(let slot=0;slot<4;slot++){
        // 装备槽位行：5-8（总和在第4行）
        const rowIdx = 5+slot;
        const eqList = (equipments?.[slot] ?? []);
        // 先清空单元格
        propertyKeys.slice(statsStartIdx).forEach((prop,iProp)=>{
          ws.getCell(rowIdx,baseCol+statsStartIdx+iProp).value = "";
          ws.getCell(rowIdx,baseCol+statsStartIdx+iProp).alignment = { horizontal:"center", vertical:"middle" };
        });
        
        // 填入装备词条数据
        eqList.forEach(({ function_type, function_value, level }) => {
          if (function_type in sumStats) {
            sumStats[function_type] += function_value / 100;
          }
          const iProp = propertyKeys.indexOf(function_type);
          if (iProp >= statsStartIdx) {
            const cell = ws.getCell(rowIdx, baseCol + iProp);
            cell.value = function_value / 100;
            cell.numFmt = pctFmt;
            cell.alignment = { horizontal: "center", vertical: "middle" };
            const fill = getFillByLevel(level);
            const font = getFontByLevel(level);
            if(fill) cell.fill = fill;
            if(font) cell.font = font;
          }
        });
      }
      
      // 汇总行（改为第4行）
      if (!unowned) {
        Object.entries(sumStats).forEach(([k, v]) => {
          const idx = propertyKeys.indexOf(k);
          const cell = ws.getCell(4, baseCol + idx);
          cell.value = v;
          cell.numFmt = pctFmt;             // 统一百分数格式
          cell.alignment = { horizontal: "center", vertical: "middle" };
        });
      }

      // 回填攻优突破分（AEL）
      if (!unowned) {
        const grade = typeof limit_break === 'object' ? (limit_break.grade || 0) : 0;
        const core  = typeof limit_break === 'object' ? (limit_break.core  || 0) : 0;
        const { StatAtk: atk = 0, IncElementDmg: elem = 0 } = getEquipSumStats(equipments);
        const score = computeAELScore({ grade, core, atk, elem });
        const aelIdx = propertyKeys.indexOf("AtkElemLbScore");
        const scoreCell = ws.getCell(4, baseCol + aelIdx);
        scoreCell.value = score;
        scoreCell.numFmt = "0.00";
        scoreCell.alignment = { horizontal:"center", vertical:"middle" };
        // 合并 AEL 列（第4-8行）并设置居中
        ws.mergeCells(4, baseCol + aelIdx, 8, baseCol + aelIdx);
        ws.getCell(5, baseCol + aelIdx).alignment = { horizontal:"center", vertical:"middle" };
        ws.getCell(6, baseCol + aelIdx).alignment = { horizontal:"center", vertical:"middle" };
        ws.getCell(7, baseCol + aelIdx).alignment = { horizontal:"center", vertical:"middle" };
        // 按阈值上色（与词条颜色一致）：
      // >=3.2 黑底白字；<3.2且>=2.7 蓝；<2.7且>=2.2 黄；>0且<2.2 红
        let aelFill = null;
        let aelFont = null;
        if (typeof score === 'number') {
          if (score >= 3.2) {
            aelFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
            aelFont = { color: { argb: "FFFFFF" } };
          } else if (score >= 2.7) {
            aelFill = { type: "pattern", pattern: "solid", fgColor: { argb: "77AAFF" } };
          } else if (score >= 2.2) {
            aelFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF77" } };
          } else if (score > 0) {
            aelFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7777" } };
          }
        }
        if (aelFill || aelFont) {
          for (let r = 4; r <= 8; r++) {
            const mCell = ws.getCell(r, baseCol + aelIdx);
            if (aelFill) mCell.fill = aelFill;
            if (aelFont) mCell.font = { ...(mCell.font || {}), ...aelFont };
          }
        }
      }
      
        // 设置边框
      setOuterBorder(ws,1,colCursor,3,colCursor+widthPerChar-1,mediumSide); // 标题区（名称+头像+表头）
      setOuterBorder(ws,4,colCursor,8,colCursor+widthPerChar-1,mediumSide); // 数据内容区
      // 将分隔细线移动到 AEL 列左侧
      {
        const aelIdx = propertyKeys.indexOf("AtkElemLbScore");
        setVerticalBorder(ws,3,8,baseCol + aelIdx,thinSide,"left");
      }
      if (itemIdx >= 0) setVerticalBorder(ws,3,8,baseCol+itemIdx,thinSide,"left");
      if (itemIdx >= 0) setVerticalBorder(ws,3,8,baseCol+itemIdx+1,thinSide,"right");
      if (t10Idx  >= 0) setVerticalBorder(ws,3,8,baseCol+t10Idx,thinSide,"right");
  // 总和在第4行：用底线分隔总和与细节（细节在 5-8 行）
  setHorizontalBorder(ws,4,baseCol+t10Idx,baseCol+propertyKeys.length-1,thinSide,"bottom");

      // ===== 按角色配置隐藏列（showStats） =====
      // 兼容旧数据：若 showStats 缺失则全部显示
      if (Array.isArray(charInfo.showStats)) {
        const rawShowStats = charInfo.showStats;
        const configured = rawShowStats.includes("__showStatsConfigured");
        const showStats = rawShowStats.filter(
          (k) => typeof k === "string" && !k.startsWith("__")
        );

        // 旧数据（未配置）默认基础列全显示
        const effectiveStats = configured
          ? showStats
          : [...showStats, "limit_break", "skill1_level", "skill2_level", "skill_burst_level"];

        // 若一个勾也没打：整个人物块完全折叠
        // 仅当“用户已配置且确实全不勾”时才折叠；否则视为旧数据默认不折叠
        if (configured && showStats.length === 0) {
          for (let i = 0; i < widthPerChar; i++) {
            ws.getColumn(colCursor + i).hidden = true;
          }
        } else {
          // 基础列（突破/技能）：兼容旧数据（若未出现任何基础 key，则默认全显示）
          const basicKeys = ["limit_break", "skill1_level", "skill2_level", "skill_burst_level"];
          const hasAnyBasic = basicKeys.some((k) => effectiveStats.includes(k));
          for (let i = 0; i < basicKeys.length; i++) {
            ws.getColumn(baseCol + i).hidden = hasAnyBasic ? !effectiveStats.includes(basicKeys[i]) : false;
          }

          const aelIdx = propertyKeys.indexOf("AtkElemLbScore");
          const equipOnlyKeys = propertyKeys
            .slice(statsStartIdx, aelIdx)
            .filter((k) => typeof k === "string" && k);
          const hasAnyEquipStat = equipOnlyKeys.some((k) => effectiveStats.includes(k));

          // 如果一个装备词条都没勾：T10 装备列也隐藏
          if (t10Idx >= 0) {
            ws.getColumn(baseCol + t10Idx).hidden = !hasAnyEquipStat;
          }

          // 装备词条列（不包含 AEL）
          for (let i = statsStartIdx; i < aelIdx; i++) {
            const key = propertyKeys[i];
            if (!key) continue;
            ws.getColumn(baseCol + i).hidden = !effectiveStats.includes(key);
          }

          // AEL 列
          ws.getColumn(baseCol + aelIdx).hidden = !effectiveStats.includes("AtkElemLbScore");
        }
      }
      colCursor += widthPerChar;
    }
    
    startCol += totalWidth;
  }

  /* ========== 魔方区 ========== */
  const cubeStartCol = startCol;
  const cubes = Array.isArray(dict.cubes) ? dict.cubes : [];
  
  if (cubes.length > 0) {
    ws.mergeCells(1,cubeStartCol,1,cubeStartCol+cubes.length-1);
    const cubeHeader = ws.getCell(1,cubeStartCol);
    cubeHeader.value = t("cube");
    cubeHeader.alignment = { horizontal:"center", vertical:"middle" };
    cubeHeader.font = { bold:true };
    setOuterBorder(ws,1,cubeStartCol,1,cubeStartCol+cubes.length-1,mediumSide);
    
    cubes.forEach((cubeData,idx)=>{
      const col = cubeStartCol+idx;
      ws.mergeCells(2,col,3,col);
      const nameCell = ws.getCell(2,col);
      // 使用对应语言的魔方名称
      const cubeName = lang === "en" ? cubeData.name_en : cubeData.name_cn;
      nameCell.value = cubeName || cubeData.cube_id;
      nameCell.alignment = { horizontal:"center", vertical:"middle" };
      nameCell.font = { bold:true };
      if(idx < cubes.length-1)
        setVerticalBorder(ws,2,8,col,thinSide,"right");
      
      ws.mergeCells(4,col,8,col);
      let lvl = cubeData.cube_level;
      if(lvl===0) lvl = t("notFound");
      const lvlCell = ws.getCell(4,col);
      lvlCell.value = lvl;
      lvlCell.alignment = { horizontal:"center", vertical:"middle" };
    });
    
    setOuterBorder(ws,2,cubeStartCol,3,cubeStartCol+cubes.length-1,mediumSide);
    setOuterBorder(ws,4,cubeStartCol,8,cubeStartCol+cubes.length-1,mediumSide);
  }

  /* ========== 前哨基地等级列（放在魔方区右侧） ========== */
  const outpostCol = cubeStartCol + (cubes.length > 0 ? cubes.length : 0);

  ws.mergeCells(2,outpostCol,3,outpostCol);
  const outLabel = ws.getCell(2,outpostCol);
  outLabel.value = t("outpostLevel");
  outLabel.alignment = { horizontal:"center", vertical:"middle" };
  outLabel.font = { bold:true };
  setOuterBorder(ws,2,outpostCol,3,outpostCol,mediumSide);

  ws.mergeCells(4,outpostCol,8,outpostCol);
  const outVal = ws.getCell(4,outpostCol);
  outVal.value = dict.outpostLevel ?? 0;
  outVal.alignment = { horizontal:"center", vertical:"middle" };
  setOuterBorder(ws,4,outpostCol,8,outpostCol,mediumSide);

  /* ========== 主线进度列（Normal / Hard） ========== */
  const normalCol = outpostCol + 1;
  const hardCol = outpostCol + 2;

  ws.mergeCells(2,normalCol,3,normalCol);
  const nLabel = ws.getCell(2,normalCol);
  nLabel.value = t("normalProgress");
  nLabel.alignment = { horizontal:"center", vertical:"middle" };
  nLabel.font = { bold:true };
  setOuterBorder(ws,2,normalCol,3,normalCol,mediumSide);

  ws.mergeCells(4,normalCol,8,normalCol);
  const nVal = ws.getCell(4,normalCol);
  nVal.value = dict.normalProgress || "";
  nVal.alignment = { horizontal:"center", vertical:"middle" };
  setOuterBorder(ws,4,normalCol,8,normalCol,mediumSide);

  // 合并顶层表头：其它（覆盖 Outpost/Normal/Hard 三列）
  ws.mergeCells(1, outpostCol, 1, hardCol);
  const othersHead = ws.getCell(1, outpostCol);
  othersHead.value = t("others");
  othersHead.alignment = { horizontal: "center", vertical: "middle" };
  othersHead.font = { bold: true };
  setOuterBorder(ws, 1, outpostCol, 1, hardCol, mediumSide);

  ws.mergeCells(2,hardCol,3,hardCol);
  const hLabel = ws.getCell(2,hardCol);
  hLabel.value = t("hardProgress");
  hLabel.alignment = { horizontal:"center", vertical:"middle" };
  hLabel.font = { bold:true };
  setOuterBorder(ws,2,hardCol,3,hardCol,mediumSide);

  ws.mergeCells(4,hardCol,8,hardCol);
  const hVal = ws.getCell(4,hardCol);
  hVal.value = dict.hardProgress || "";
  hVal.alignment = { horizontal:"center", vertical:"middle" };
  setOuterBorder(ws,4,hardCol,8,hardCol,mediumSide);

  /* ========== 设置列宽 ========== */
  if(lang === "en"){
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 20;
    ws.getColumn(3).width = 11;
  }else{
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 20;
    ws.getColumn(3).width = 8;
  }
  
  // 角色列的宽度设置（AEL 固定为 6）
  const aelOffset = propertyKeys.indexOf("AtkElemLbScore");
  for(let col=4; col<cubeStartCol; ++col){
    const offset = (col-4)%widthPerChar;
    if (offset === aelOffset) {
      ws.getColumn(col).width = 6;
      continue;
    }
    if(lang === "en"){
      ws.getColumn(col).width = offset < statsStartIdx ? 6 : 10;
    } else {
      if(offset < t10Idx) ws.getColumn(col).width = 6;
      else if(offset === t10Idx) ws.getColumn(col).width = 5;
      else ws.getColumn(col).width = 10;
    }
  }

  // 第1行头像为整块合并单元格：行高已在上方设置

  // 魔方列的宽度设置
  const cubeWidth = lang === "en" ? 19 : 14;
  const cubeCount = Array.isArray(dict.cubes) ? dict.cubes.length : 0;
  for(let col=cubeStartCol; col<cubeStartCol+cubeCount; ++col){
    ws.getColumn(col).width = cubeWidth;
  }
  // Outpost/Normal/Hard 列宽
  ws.getColumn(outpostCol).width = cubeWidth;
  ws.getColumn(normalCol).width = cubeWidth;
  ws.getColumn(hardCol).width = cubeWidth;
  
  // 设置默认字体
  const defaultFontName = "Microsoft YaHei";
  ws.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { ...(cell.font || {}), name: defaultFontName };
    });
  });
  
  return wb.xlsx.writeBuffer();
};

export default saveDictToExcel;
