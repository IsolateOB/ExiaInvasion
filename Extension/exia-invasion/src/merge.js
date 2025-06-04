import ExcelJS from "exceljs";

// ========== Excel 工作簿合并模块 ==========

/**
 * 合并多个 Excel 工作簿文件
 * @param {Array} files - 要合并的文件数组
 * @param {string} sortFlag - 排序方式标识 (1:名称升序, 2:名称降序, 3:C4值升序, 4:C4值降序)
 * @param {Function} addLog - 日志记录函数
 * @returns {Promise<Buffer>} 合并后的工作簿二进制数据
 */
export async function mergeWorkbooks(files, sortFlag = "1", addLog = () => {}) {  const sorted = await sortFiles(files, sortFlag);
  
  const outWb = new ExcelJS.Workbook();
  const outWs = outWb.addWorksheet("Merged");
  
  // 冻结窗格：D4 位置（前3列3行）
  outWs.views = [{ state: "frozen", xSplit: 3, ySplit: 3 }];
  
  let writeRow = 1;           // 输出工作表当前写入行号
  let globalIndex = 1;        // 全局序号（左侧编号列）  
  // 遍历每个已排序的文件进行合并
  for (let fileIdx = 0; fileIdx < sorted.length; fileIdx++) {
    const file = sorted[fileIdx];
    addLog(`正在合并第 ${fileIdx + 1}/${sorted.length} 个文件：${file.name}`);
    
    const inWb = new ExcelJS.Workbook();
    await inWb.xlsx.load(await file.arrayBuffer());
    const inWs = inWb.worksheets[0];
    
    const copyStartIn = fileIdx === 0 ? 1 : 4;           // 源文件起始行（首个文件包含表头，其余跳过表头）
    const copyStartOut = writeRow;                        // 目标文件起始行
    
    // 只有第一个文件需要复制列宽和隐藏设置
    if (fileIdx === 0 && Array.isArray(inWs.columns)) {
      inWs.columns.forEach((col, i) => {
        if (col && col.width) outWs.getColumn(i + 1).width = col.width;
        if (col && col.hidden) outWs.getColumn(i + 1).hidden = col.hidden;
      });
    }    
    // 逐行复制数据
    for (let r = copyStartIn; r <= inWs.rowCount; r++) {
      const srcRow = inWs.getRow(r);
      if (!srcRow || (!srcRow.actualCellCount && !srcRow.height)) continue;
      
      const tgtRow = outWs.getRow(writeRow);
      if (srcRow.height) tgtRow.height = srcRow.height;
      
      // 复制行中每个单元格的内容和样式
      srcRow.eachCell({ includeEmpty: true }, (srcCell, colNumber) => {
        const tgtCell = tgtRow.getCell(colNumber);
        cloneCell(srcCell, tgtCell);
      });
      
      // 在账户信息行（第4行）添加全局序号编号
      if (r === 4) {
        tgtRow.getCell(1).value = globalIndex++;
      }
      writeRow++;
    }    

    // 处理合并单元格：计算行号偏移并应用到合并范围
    const rowOffset = copyStartOut - copyStartIn; // 源文件到目标文件的行号偏移量
    collectMergeRanges(inWs, copyStartIn).forEach(rangeStr => {
      const shifted = shiftRange(rangeStr, rowOffset);
      outWs.mergeCells(shifted);
    });
  }
  
  return outWb.xlsx.writeBuffer();
}

// ========== 单元格克隆函数 ==========

/**
 * 克隆单元格的所有属性（值、样式、格式等）
 * @param {Object} src - 源单元格
 * @param {Object} tgt - 目标单元格
 */
function cloneCell(src, tgt) {
  tgt.value = src.value;
  // 复制样式对象（深拷贝避免引用问题）
  if (src.style && Object.keys(src.style).length) {
    tgt.style = JSON.parse(JSON.stringify(src.style));
  }
  // 复制数字格式
  if (src.numFmt) tgt.numFmt = src.numFmt;
  // 复制对齐方式
  if (src.alignment) tgt.alignment = { ...src.alignment };
  // 复制字体设置
  if (src.font) tgt.font = { ...src.font };
  // 复制边框设置（深拷贝）
  if (src.border) tgt.border = JSON.parse(JSON.stringify(src.border));
  // 复制填充设置（深拷贝）
  if (src.fill) tgt.fill = JSON.parse(JSON.stringify(src.fill));
}

// ========== 文件排序函数 ==========

/**
 * 根据指定方式对文件进行排序
 * @param {Array} files - 文件数组
 * @param {string} flag - 排序标识 (1:名称升序, 2:名称降序, 3:C4值升序, 4:C4值降序)
 * @returns {Promise<Array>} 排序后的文件数组
 */
async function sortFiles(files, flag) {
  const list = [...files];
  switch (flag) {
    case "2":
      // 按文件名降序排列
      return list.sort((a, b) => b.name.localeCompare(a.name, "zh-CN"));
    case "3":
    case "4": {
      // 根据每个文件 C4 单元格的值进行排序
      const rows = await Promise.all(
        list.map(async f => {
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(await f.arrayBuffer());
          const ws = wb.worksheets[0];
          return { file: f, key: ws.getCell("C4").value ?? 0 };
        })
      );
      // case "3": C4值升序, case "4": C4值降序
      rows.sort((a, b) => (flag === "3" ? a.key - b.key : b.key - a.key));
      return rows.map(r => r.file);
    }
    default:
      // 默认按文件名升序排列
      return list.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }
}

// ========== 合并单元格处理函数 ==========

// ========== 合并单元格处理函数 ==========

/**
 * 从工作表收集需要复制的合并单元格范围（过滤掉表头部分）
 * @param {Object} ws - 工作表对象
 * @param {number} minRow - 最小行号（用于过滤表头）
 * @returns {Array} 合并范围字符串数组
 */
function collectMergeRanges(ws, minRow) {
  const ranges = [];
  // 方式1: 通过 ws.model.merges 获取（数组形式的字符串或对象）
  if (Array.isArray(ws.model?.merges)) {
    ws.model.merges.forEach(m => {
      const range = typeof m === "string" ? m : m.range;
      const { row } = decodeCell(range.split(":" )[0]);
      if (row >= minRow) ranges.push(range);
    });
  }
  // 方式2: 通过 ws._merges 获取（Map/Set/普通对象，取键值）
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

/**
 * 将合并单元格范围整体向下偏移指定行数
 * @param {string} rangeStr - 合并范围字符串 (如 "A1:B2")
 * @param {number} rowOffset - 行偏移量
 * @returns {string} 偏移后的范围字符串
 */
function shiftRange(rangeStr, rowOffset) {
  const [s, e] = rangeStr.split(":" );
  const sCell = decodeCell(s);
  const eCell = decodeCell(e);
  const newStart = encodeCell(sCell.col, sCell.row + rowOffset);
  const newEnd = encodeCell(eCell.col, eCell.row + rowOffset);
  return `${newStart}:${newEnd}`;
}

// ========== 单元格地址编解码函数 ==========

/**
 * 解码单元格地址为列号和行号
 * @param {string} addr - 单元格地址 (如 "A1", "BC123")
 * @returns {Object} {col: 列号, row: 行号}
 */
function decodeCell(addr) {
  const [, colLabel, rowStr] = addr.match(/^([A-Z]+)(\d+)$/);
  let col = 0;
  // 将字母转换为数字 (A=1, B=2, ..., Z=26, AA=27, ...)
  for (let i = 0; i < colLabel.length; i++) {
    col = col * 26 + (colLabel.charCodeAt(i) - 64); // A=1
  }
  return { col, row: Number(rowStr) };
}

/**
 * 将列号和行号编码为单元格地址
 * @param {number} col - 列号
 * @param {number} row - 行号
 * @returns {string} 单元格地址 (如 "A1", "BC123")
 */
function encodeCell(col, row) {
  let label = "";
  // 将数字转换为字母 (1=A, 2=B, ..., 26=Z, 27=AA, ...)
  while (col > 0) {
    const rem = (col - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    col = Math.floor((col - 1) / 26);
  }
  return `${label}${row}`;
}
