// src/excel.js
import ExcelJS from "exceljs";


const mediumSide = { style: "medium", color: { argb: "FF000000" } };
const thinSide   = { style: "thin",   color: { argb: "FF000000" } };

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

const setVerticalBorder = (ws, r1, r2, col, side = thinSide, pos = "right") => {
  for (let r = r1; r <= r2; ++r)
    ws.getCell(r, col).border = { ...ws.getCell(r, col).border, [pos]: side };
};

const setHorizontalBorder = (ws, row, c1, c2, side = thinSide, pos = "bottom") => {
  for (let c = c1; c <= c2; ++c)
    ws.getCell(row, c).border = { ...ws.getCell(row, c).border, [pos]: side };
};

/* ----- 显示字符串转换 ----- */
const getLimitBreakStr = (lb) => {
  if (lb < 0) return "";
  if (lb <= 3) return `${lb} ★`;
  if (lb < 10) return `+ ${lb - 3}`;
  return "MAX";
};
const itemRareToStr = (rare) => (rare === 3 ? "SSR" : rare === 2 ? "SR" : rare === 1 ? "R" : "");
const getItemLevelStr = (rare, lvl) => (rare === 3 ? `${lvl + 1}★` : lvl);

/* ----- 词条颜色 ----- */
const getFillByLevel = (lvl) => {
  if (lvl >= 1 && lvl <= 5)   return { type: "pattern", pattern: "solid", fgColor: { argb: "FF7777" } };  // 红
  if (lvl >= 6 && lvl <= 10)  return { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF77" } };  // 黄
  if (lvl >= 11 && lvl <= 14) return { type: "pattern", pattern: "solid", fgColor: { argb: "77AAFF" } };  // 蓝
  if (lvl === 15)             return { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } }; // 黑
  return null;
};
const getFontByLevel = (lvl) => {
  if (lvl === 15) return { color: { argb: "FFFFFF" } };  // 黑底白字
  return { color: { argb: "000000" } };                  // 其余默认黑字
};

/* =================================================================== *
 *  主函数：saveDictToExcel
 * =================================================================== */
export const saveDictToExcel = async (dict, lang = "en") => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(lang === "en" ? "Player Info" : "玩家信息");
  
  // 行高
  [1,2,3].forEach(r => ws.getRow(r).height = 25);
  
  /* ---------------------------------------------------------------
   * 基本信息区：序号 / 名称 / 同步器
   * ------------------------------------------------------------- */
  // A1:B3  &  C1:C3  -> 表头
  ws.mergeCells(1,1,3,2);
  ws.mergeCells(1,3,3,3);
  ws.getCell(1,1).value = lang === "en" ? "Name" : "名称";
  ws.getCell(1,3).value = lang === "en" ? "Synchro" : "同步器";
  ["A1","C1"].forEach(addr=>{
    const cell = ws.getCell(addr);
    cell.font = { bold:true };
    cell.alignment = { horizontal:"center", vertical:"middle" };
  });
  
  // A4:A8  B4:B8  C4:C8  -> 数据
  ws.mergeCells(4,1,8,1);  // 序号
  ws.mergeCells(4,2,8,2);  // 名称
  ws.mergeCells(4,3,8,3);  // 同步器
  ws.getCell(4,2).value = dict.name;
  ws.getCell(4,3).value = dict.synchroLevel;
  ["A4","B4","C4"].forEach(addr=>{
    ws.getCell(addr).alignment = { horizontal:"center", vertical:"middle" };
    ws.getCell(addr).font = { bold: addr!=="A4" }; // 名称加粗
  });
  
  /* 外框 */
  setOuterBorder(ws,1,1,3,3,mediumSide);
  setOuterBorder(ws,4,1,8,3,mediumSide);
  setVerticalBorder(ws, 1, 8, 3, mediumSide, "left");
  
  /* ---------------------------------------------------------------
   * 角色信息区
   * ------------------------------------------------------------- */
  const widthPerChar = 16;
  const propertyKeys = [
    "limit_break","skill1_level","skill2_level","skill_burst_level",
    "item_rare","item_level",null,
    "IncElementDmg","StatAtk","StatAmmoLoad","StatChargeTime","StatChargeDamage",
    "StatCritical","StatCriticalDamage","StatAccuracyCircle","StatDef"
  ];
  const propertyLabels = lang === "en" ?
    ["LB","Skill 1","Skill 2","Burst","Item",null,"T10","Elem","Atk","Ammo","Chg Spd","Chg DMG","Crit%","Crit DMG","Hit%","Def"] :
    ["突破","技能1","技能2","爆裂","珍藏品",null,"T10","优越","攻击","弹夹","蓄速","蓄伤","暴击","暴伤","命中","防御"];
  const equipRowLabels = lang === "en" ? ["Head","Body","Arm","Leg","Total"] : ["头","身","手","足","总和"];
  
  let startCol = 4;
  for (const [elementName, charsDict] of Object.entries(dict.elements)) {
    const totalWidth = Object.keys(charsDict).length * widthPerChar;
    
    // 元素表头
    ws.mergeCells(1,startCol,1,startCol+totalWidth-1);
    const elemCell = ws.getCell(1,startCol);
    elemCell.value = elementName;
    elemCell.alignment = { horizontal:"center", vertical:"middle" };
    elemCell.font = { bold:true };
    setOuterBorder(ws,1,startCol,1,startCol+totalWidth-1,mediumSide);
    
    let colCursor = startCol;
    for (const [charName,charInfo] of Object.entries(charsDict)) {
      /* --- 角色名行 --- */
      ws.mergeCells(2,colCursor,2,colCursor+widthPerChar-1);
      const cChar = ws.getCell(2,colCursor);
      cChar.value = charName;
      cChar.alignment = { horizontal:"center", vertical:"middle" };
      // 下方细线
      setHorizontalBorder(ws,2,colCursor,colCursor+widthPerChar-1,thinSide,"bottom");
      
      // 优先级颜色
      switch(charInfo.priority){
        case "black":
          cChar.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FF000000"}};
          cChar.font = { color:{argb:"FFFFFF"}, bold:true };
          break;
        case "red":
          cChar.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FF7777"}};
          cChar.font = { color:{argb:"FFFFFF"}, bold:true };
          break;
        case "blue":
          cChar.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"99CCFF"}};
          cChar.font = { bold:true };
          break;
        case "yellow":
          cChar.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FFFF88"}};
          cChar.font = { bold:true };
          break;
      }
      
      /* --- 属性列标签行 --- */
      propertyLabels.forEach((lbl,i)=>{
        if(lbl===null) return;
        const colIdx = colCursor + i;
        if(i===4){
          ws.mergeCells(3,colIdx,3,colIdx+1);
        }
        const headCell = ws.getCell(3,colIdx);
        headCell.value = lbl;
        headCell.alignment = { horizontal:"center", vertical:"middle" };
      });
      
      /* --- 角色基础值 (row4) --- */
      const {
        limit_break = 0,
        skill1_level = 0,
        skill2_level = 0,
        skill_burst_level = 0,
        item_rare = 0,
        item_level = 0,
        equipments = {}
      } = charInfo;
      
      ws.getCell(4,colCursor).value = getLimitBreakStr(limit_break);
      ws.getCell(4,colCursor+1).value = skill1_level;
      ws.getCell(4,colCursor+2).value = skill2_level;
      ws.getCell(4,colCursor+3).value = skill_burst_level;
      ws.getCell(4,colCursor+4).value = itemRareToStr(item_rare);
      ws.getCell(4,colCursor+5).value = getItemLevelStr(item_rare,item_level);
      
      // 居中
      for(let i=0;i<6;i++){
        ws.getCell(4,colCursor+i).alignment = { horizontal:"center", vertical:"middle" };
      }
      
      // 合并 LB~T10 纵向 4-8
      for(let i=0;i<6;i++){
        ws.mergeCells(4,colCursor+i,8,colCursor+i);
      }
      
      /* --- 装备词条 (row4-7 per slot) & 汇总 (row8) --- */
      const sumStats = {
        IncElementDmg:0,StatAtk:0,StatAmmoLoad:0,StatChargeTime:0,StatChargeDamage:0,
        StatCritical:0,StatCriticalDamage:0,StatAccuracyCircle:0,StatDef:0
      };
      
      // 行标题 & 清空
      equipRowLabels.forEach((lbl,rowIdx)=>{
        ws.getCell(4+rowIdx,colCursor+6).value = lbl;
        ws.getCell(4+rowIdx,colCursor+6).alignment = { horizontal:"center", vertical:"middle" };
      });
      
      const pctFmt = "0.00%";
      
      for(let slot=0;slot<4;slot++){
        const rowIdx = 4+slot;
        const eqList = (equipments?.[slot] ?? []);
        // 先清空
        propertyKeys.slice(7).forEach((prop,iProp)=>{
          ws.getCell(rowIdx,colCursor+7+iProp).value = "";
          ws.getCell(rowIdx,colCursor+7+iProp).alignment = { horizontal:"center", vertical:"middle" };
        });
        
        
        eqList.forEach(({ function_type, function_value, level }) => {
          if (function_type in sumStats) {
            sumStats[function_type] += function_value / 100;
          }
          const iProp = propertyKeys.indexOf(function_type);
          if (iProp >= 7) {
            const cell = ws.getCell(rowIdx, colCursor + iProp);
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
      
      // Total 行 row8
      Object.entries(sumStats).forEach(([k, v]) => {
        const idx = propertyKeys.indexOf(k);
        const cell = ws.getCell(8, colCursor + idx);
        cell.value = v;
        cell.numFmt = pctFmt;             // ← 统一百分数格式
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      
      /* --- 边框 --- */
      setOuterBorder(ws,2,colCursor,3,colCursor+widthPerChar-1,mediumSide); // 角色头
      setOuterBorder(ws,4,colCursor,8,colCursor+widthPerChar-1,mediumSide); // 内容
      setVerticalBorder(ws,3,8,colCursor,thinSide,"right");
      setVerticalBorder(ws,3,8,colCursor+4,thinSide,"left");
      setVerticalBorder(ws,3,8,colCursor+5,thinSide,"right");
      setVerticalBorder(ws,3,8,colCursor+6,thinSide,"right");
      setHorizontalBorder(ws,8,colCursor+6,colCursor+15,thinSide,"top");
      
      colCursor += widthPerChar;
    }
    
    startCol += totalWidth;
  }
  
  /* ---------------------------------------------------------------
   * 魔方区
   * ------------------------------------------------------------- */
  const cubeStartCol = startCol;
  const cubeNames = Object.keys(dict.cubes);
  
  ws.mergeCells(1,cubeStartCol,1,cubeStartCol+cubeNames.length-1);
  const cubeHeader = ws.getCell(1,cubeStartCol);
  cubeHeader.value = lang === "en" ? "Cube" : "魔方";
  cubeHeader.alignment = { horizontal:"center", vertical:"middle" };
  cubeHeader.font = { bold:true };
  setOuterBorder(ws,1,cubeStartCol,1,cubeStartCol+cubeNames.length-1,mediumSide);
  
  cubeNames.forEach((name,idx)=>{
    const col = cubeStartCol+idx;
    ws.mergeCells(2,col,3,col);
    const nameCell = ws.getCell(2,col);
    nameCell.value = name;
    nameCell.alignment = { horizontal:"center", vertical:"middle" };
    nameCell.font = { bold:true };
    if(idx < cubeNames.length-1)
      setVerticalBorder(ws,2,8,col,thinSide,"right");
    
    ws.mergeCells(4,col,8,col);
    let lvl = dict.cubes[name].cube_level;
    if(lvl===0) lvl = lang==="en"?"Not found":"未找到";
    const lvlCell = ws.getCell(4,col);
    lvlCell.value = lvl;
    lvlCell.alignment = { horizontal:"center", vertical:"middle" };
  });
  setOuterBorder(ws,2,cubeStartCol,3,cubeStartCol+cubeNames.length-1,mediumSide);
  setOuterBorder(ws,4,cubeStartCol,8,cubeStartCol+cubeNames.length-1,mediumSide);
  
  /* 列宽 */
  if(lang === "en"){
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 20;
    ws.getColumn(3).width = 11;
  }else{
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 20;
    ws.getColumn(3).width = 8;
  }
  for(let col=4; col<cubeStartCol; ++col){
    const offset = (col-4)%widthPerChar;
    if(lang === "en"){
      ws.getColumn(col).width = offset<7 ? 6 : 10;
    }else{
      if(offset<6) ws.getColumn(col).width = 6;
      else if(offset===6) ws.getColumn(col).width = 5;
      else ws.getColumn(col).width = 10;
    }
  }
  const cubeWidth = lang === "en" ? 19 : 14;
  for(let col=cubeStartCol; col<cubeStartCol+cubeNames.length; ++col){
    ws.getColumn(col).width = cubeWidth;
  }
  
  const defaultFontName = "Microsoft YaHei";
  ws.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { ...(cell.font || {}), name: defaultFontName };
    });
  });
  
  return wb.xlsx.writeBuffer();
};

export default saveDictToExcel;