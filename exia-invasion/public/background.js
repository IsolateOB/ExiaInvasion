// SPDX-License-Identifier: GPL-3.0-or-later
// ========== ExiaInvasion Chrome 扩展后台脚本 ==========
// 管理扩展的生命周期和用户交互事件

// 扩展安装/启动时初始化侧栏
const ensureSidePanelEnabled = async () => {
  await chrome.sidePanel.setOptions({
    enabled: true,      // 启用侧栏功能
    path: "index.html"  // 侧栏页面路径（与 manifest 保持一致）
  });
  // 让工具栏图标点击自动打开侧栏
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
};

chrome.runtime.onInstalled.addListener(() => {
  ensureSidePanelEnabled().catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  ensureSidePanelEnabled().catch(() => undefined);
});

/* 处理工具栏图标点击事件 → 打开侧栏 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  await chrome.sidePanel.open({ tabId: tab.id });
});