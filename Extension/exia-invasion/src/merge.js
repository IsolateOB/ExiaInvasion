// src/merge.js
import ExcelJS from "exceljs";

export async function mergeWorkbooks(files, sortFlag, addLog = () => {}) {
  if (!files.length) throw new Error("no files");
  
  /* ---------- 1. 预加载所有工作簿、取同步器等级 ---------- */
  const books = [];
  for (const f of files) {
    if (f.name.includes("merged")) continue;          // 跳过已合并文件
    const buf = await f.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    const syncLvl = ws.getCell("C4").value ?? 0;      // C4 = 同步器等级
    books.push({ file: f, wb, ws, syncLvl });
  }
  if (!books.length) throw new Error("no usable files");
  
  /* ---------- 2. 排序 ---------- */
  books.sort((a, b) => {
    switch (sortFlag) {
      case "1": return a.file.name.localeCompare(b.file.name);
      case "2": return b.file.name.localeCompare(a.file.name);
      case "3": return (a.syncLvl || 0) - (b.syncLvl || 0);
      case "4": return (b.syncLvl || 0) - (a.syncLvl || 0);
      default:  return 0;
    }
  });
  
  /* ---------- 3. 复制到新表 ---------- */
  const mergedWb = new ExcelJS.Workbook();
  const mergedWs = mergedWb.addWorksheet("Sheet1");
  let currentRow = 1;
  
  const copyRow = (srcRow, tgtRow) => {
    tgtRow.height = srcRow.height;
    srcRow.eachCell({ includeEmpty: true }, (cell, col) => {
      const tCell = tgtRow.getCell(col);
      tCell.value = cell.value;
      tCell.style = { ...cell.style };
    });
  };
  
  for (let i = 0; i < books.length; i++) {
    const { file, ws } = books[i];
    addLog(`正在合并第 ${i + 1}/${books.length} 个文件：${file.name}`);
    
    const minRow = i === 0 ? 1 : 4;
    for (let r = minRow; r <= ws.rowCount; r++) {
      copyRow(ws.getRow(r), mergedWs.getRow(currentRow++));
    }
    // 在账号信息行最左边写编号
    const accountInfoRow = (i === 0 ? 4 : 1) + (currentRow - (ws.rowCount - minRow + 1));
    mergedWs.getCell(accountInfoRow, 1).value = i + 1;
  }
  
  /* ---------- 4. 冻结窗格 ---------- */
  mergedWs.views = [{ state: "frozen", xSplit: 3, ySplit: 3 }];
  
  /* ---------- 5. 导出 ---------- */
  return await mergedWb.xlsx.writeBuffer();
}
