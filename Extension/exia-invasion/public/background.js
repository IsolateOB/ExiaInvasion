chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    enabled: true,      // 侧栏可用
    path: "index.html"  // 跟 manifest 里的保持一致
  });
});

/* 把点击工具栏图标 → 打开侧栏 */
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});