// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 云同步检查 Hook ==========

import { useEffect } from "react";
import { getAccounts, getCharacters } from "../../../services/storage.js";
import { isAccountsEmpty, isCharactersEmpty, normalizeAccountsFromRemote, buildAccountsSignature, buildCharactersSignature } from "../../../utils/cloudCompare.js";
import { API_BASE_URL } from "../constants.js";

/**
 * 启动时检查本地与云端数据是否一致
 * @param {Object} options
 * @param {string|null} options.authToken - 认证令牌
 * @param {Function} options.t - 翻译函数
 * @param {Function} options.showMessage - 显示消息提示
 */
export function useCloudCheck({ authToken, t, showMessage }) {
  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;

    (async () => {
      try {
        const [localAccounts, localCharacters, remoteAccountsResp, remoteCharactersResp] = await Promise.all([
          getAccounts(),
          getCharacters(),
          fetch(`${API_BASE_URL}/accounts`, { headers: { Authorization: `Bearer ${authToken}` } }).then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch(`${API_BASE_URL}/characters`, { headers: { Authorization: `Bearer ${authToken}` } }).then((r) => r.ok ? r.json() : null).catch(() => null),
        ]);

        if (cancelled) return;

        const remoteAccounts = normalizeAccountsFromRemote(remoteAccountsResp?.account_data);
        const remoteCharacters = remoteCharactersResp?.character_data || null;

        const localAccountsEmpty = isAccountsEmpty(localAccounts);
        const remoteAccountsEmpty = isAccountsEmpty(remoteAccounts);
        const localCharactersEmpty = isCharactersEmpty(localCharacters);
        const remoteCharactersEmpty = isCharactersEmpty(remoteCharacters);

        let mismatch = false;

        if (!localAccountsEmpty && !remoteAccountsEmpty) {
          const localSig = buildAccountsSignature(localAccounts);
          const remoteSig = buildAccountsSignature(remoteAccounts);
          if (localSig !== remoteSig) mismatch = true;
        }

        if (!localCharactersEmpty && !remoteCharactersEmpty) {
          const localSig = buildCharactersSignature(localCharacters || {});
          const remoteSig = buildCharactersSignature(remoteCharacters || {});
          if (localSig !== remoteSig) mismatch = true;
        }
        if (mismatch) {
          showMessage(t("sync.conflictDesc") || "本地数据与云端数据不一致，请前往管理页处理。", "warning");
        }
      } catch (err) {
        console.error("cloud compare failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authToken, t, showMessage]);
}

export default useCloudCheck;
