import ExcelJS from "exceljs";


export async function mergeWorkbooks(files, sortFlag = "1", addLog = () => {}) {
  const sorted = await sortFiles(files, sortFlag);
  
  const outWb = new ExcelJS.Workbook();
  const outWs = outWb.addWorksheet("Merged");
  
  // 冻结 D4（3 列 3 行）
  outWs.views = [{ state: "frozen", xSplit: 3, ySplit: 3 }];
  
  let writeRow = 1;           // outWs 当前写入行
  let globalIndex = 1;        // 左侧编号
  
  for (let fileIdx = 0; fileIdx < sorted.length; fileIdx++) {
    const file = sorted[fileIdx];
    addLog(`正在合并第 ${fileIdx + 1}/${sorted.length} 个文件：${file.name}`);
    
    const inWb = new ExcelJS.Workbook();
    await inWb.xlsx.load(await file.arrayBuffer());
    const inWs = inWb.worksheets[0];
    
    const copyStartIn = fileIdx === 0 ? 1 : 4;           // 源起始行（含表头或跳过）
    const copyStartOut = writeRow;                        // 目标起始行
    
    if (fileIdx === 0 && Array.isArray(inWs.columns)) {
      inWs.columns.forEach((col, i) => {
        if (col && col.width) outWs.getColumn(i + 1).width = col.width;
      });
    }
    
    for (let r = copyStartIn; r <= inWs.rowCount; r++) {
      const srcRow = inWs.getRow(r);
      if (!srcRow || (!srcRow.actualCellCount && !srcRow.height)) continue;
      
      const tgtRow = outWs.getRow(writeRow);
      if (srcRow.height) tgtRow.height = srcRow.height;
      
      srcRow.eachCell({ includeEmpty: true }, (srcCell, colNumber) => {
        const tgtCell = tgtRow.getCell(colNumber);
        cloneCell(srcCell, tgtCell);
      });
      
      // 在账户信息行写编号（首文件：第 4 行；其余文件：第 1 行）
      if (r === 4) {
        tgtRow.getCell(1).value = globalIndex++;
      }
      writeRow++;
    }
    

    const rowOffset = copyStartOut - copyStartIn; // 源 → 目标 行号偏移
    collectMergeRanges(inWs, copyStartIn).forEach(rangeStr => {
      const shifted = shiftRange(rangeStr, rowOffset);
      outWs.mergeCells(shifted);
    });
  }
  
  return outWb.xlsx.writeBuffer();
}


function cloneCell(src, tgt) {
  tgt.value = src.value;
  if (src.style && Object.keys(src.style).length) {
    tgt.style = JSON.parse(JSON.stringify(src.style));
  }
  if (src.numFmt) tgt.numFmt = src.numFmt;
  if (src.alignment) tgt.alignment = { ...src.alignment };
  if (src.font) tgt.font = { ...src.font };
  if (src.border) tgt.border = JSON.parse(JSON.stringify(src.border));
  if (src.fill) tgt.fill = JSON.parse(JSON.stringify(src.fill));
}


async function sortFiles(files, flag) {
  const list = [...files];
  switch (flag) {
    case "2":
      return list.sort((a, b) => b.name.localeCompare(a.name, "zh-CN"));
    case "3":
    case "4": {
      // 读取每个文件 C4 的值做排序
      const rows = await Promise.all(
        list.map(async f => {
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(await f.arrayBuffer());
          const ws = wb.worksheets[0];
          return { file: f, key: ws.getCell("C4").value ?? 0 };
        })
      );
      rows.sort((a, b) => (flag === "3" ? a.key - b.key : b.key - a.key));
      return rows.map(r => r.file);
    }
    default:
      return list.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }
}

/** 从工作表收集需复制的合并范围（过滤掉表头） */
function collectMergeRanges(ws, minRow) {
  const ranges = [];
  // 1) ws.model.merges —— array of strings / objects
  if (Array.isArray(ws.model?.merges)) {
    ws.model.merges.forEach(m => {
      const range = typeof m === "string" ? m : m.range;
      const { row } = decodeCell(range.split(":" )[0]);
      if (row >= minRow) ranges.push(range);
    });
  }
  // 2) ws._merges —— Map / Set / plain object（取键）
  else if (ws._merges) {
    if (typeof ws._merges.forEach === "function") {
      ws._merges.forEach((v, k) => {
        const range = typeof k === "string" ? k : v;
        const { row } = decodeCell(range.split(":" )[0]);
        if (row >= minRow) ranges.push(range);
      });
    } else {
      Object.keys(ws._merges).forEach(range => {
        const { row } = decodeCell(range.split(":" )[0]);
        if (row >= minRow) ranges.push(range);
      });
    }
  }
  return ranges;
}

/** 将合并范围整体下移 rowOffset 行 */
function shiftRange(rangeStr, rowOffset) {
  const [s, e] = rangeStr.split(":" );
  const sCell = decodeCell(s);
  const eCell = decodeCell(e);
  const newStart = encodeCell(sCell.col, sCell.row + rowOffset);
  const newEnd = encodeCell(eCell.col, eCell.row + rowOffset);
  return `${newStart}:${newEnd}`;
}


function decodeCell(addr) {
  const [, colLabel, rowStr] = addr.match(/^([A-Z]+)(\d+)$/);
  let col = 0;
  for (let i = 0; i < colLabel.length; i++) {
    col = col * 26 + (colLabel.charCodeAt(i) - 64); // A=1
  }
  return { col, row: Number(rowStr) };
}

function encodeCell(col, row) {
  let label = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    col = Math.floor((col - 1) / 26);
  }
  return `${label}${row}`;
}
