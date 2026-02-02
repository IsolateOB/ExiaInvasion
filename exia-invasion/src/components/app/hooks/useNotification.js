// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 通知 Hook ==========

import { useState, useCallback } from "react";

/**
 * 通知/消息提示 Hook
 */
export function useNotification() {
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const showMessage = useCallback((message, severity = "info") => {
    setNotification({
      open: true,
      message,
      severity,
    });
  }, []);

  const handleCloseNotification = useCallback(() => {
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    notification,
    showMessage,
    handleCloseNotification,
  };
}

export default useNotification;
