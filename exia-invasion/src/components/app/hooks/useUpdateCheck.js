// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 自动更新检查 Hook ==========

import { useState, useEffect } from "react";

const GITHUB_REPO = "IsolateOB/ExiaInvasion";
const UPDATE_CHECK_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;


function compareVersions(v1, v2) {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

export function useUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState(null);
  const [releaseUrl, setReleaseUrl] = useState(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const currentVersion = chrome.runtime.getManifest().version;
        // 避免频繁请求，可以使用缓存或简单的内存 Checks
        const res = await fetch(UPDATE_CHECK_API);
        if (!res.ok) return;

        const data = await res.json();
        const startVersion = data.tag_name;
        
        if (startVersion && compareVersions(currentVersion, startVersion) < 0) {
          setUpdateAvailable(true);
          setLatestVersion(startVersion);
          
          // 优先寻找 zip 文件的下载链接
          const zipAsset = data.assets?.find(asset => asset.name && asset.name.endsWith('.zip'));
          const targetUrl = zipAsset ? zipAsset.browser_download_url : data.html_url;
          
          setReleaseUrl(targetUrl);
        }
      } catch (error) {
        console.error("Update check failed:", error);
      }
    };

    checkUpdate();
  }, []);

  return {
    updateAvailable,
    latestVersion,
    releaseUrl
  };
}
