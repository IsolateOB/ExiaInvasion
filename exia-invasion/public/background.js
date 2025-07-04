// ========== ExiaInvasion Chrome 扩展后台脚本 ==========
// 管理扩展的生命周期和用户交互事件

// 扩展安装时初始化侧栏
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    enabled: true,      // 启用侧栏功能
    path: "index.html"  // 侧栏页面路径（与 manifest 保持一致）
  });
});

/* 处理工具栏图标点击事件 → 打开侧栏 */
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});