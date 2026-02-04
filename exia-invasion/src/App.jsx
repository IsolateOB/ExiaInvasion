// SPDX-License-Identifier: GPL-3.0-or-later
// ========== Exia Invasion 主应用组件 ==========
// 主要功能：账户管理、数据爬取、Excel导出、文件合并等

import { useState, useCallback } from "react";
import {
  Container,
  Stack,
  Paper,
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Button
} from "@mui/material";
import TRANSLATIONS from "./i18n/translations.js";
import {
  useAuth,
  useSettings,
  useNotification,
  useCloudCheck,
  useCrawler,
  useMerge,
  useUpdateCheck,
  AppHeader,
  CrawlerTabContent,
  MergeTabContent,
} from "./components/app";

// ========== React 主组件 ==========
export default function App() {
  // ========== 标签页状态 ==========
  const [tab, setTab] = useState("crawler");
  
  const handleTabChange = useCallback((event, newTab) => {
    if (newTab !== null) {
      setTab(newTab);
    }
  }, []);

  // ========== 通知 ==========
  const { notification, showMessage, handleCloseNotification } = useNotification();

  // ========== 设置 ==========
  const settings = useSettings();
  
  // 翻译函数
  const t = useCallback((k) => TRANSLATIONS[settings.lang][k] || k, [settings.lang]);

  // ========== 认证 ==========
  const auth = useAuth({ t, showMessage });

  // ========== 云同步检查 ==========
  useCloudCheck({ authToken: auth.authToken, t, showMessage });

  // ========== 自动更新检查 ==========
  const { updateAvailable, latestVersion, releaseUrl } = useUpdateCheck();

  // ========== 数据爬取 ==========
  const crawler = useCrawler({
    t,
    lang: settings.lang,
    saveAsZip: settings.saveAsZip,
    exportJson: settings.exportJson,
    activateTab: settings.activateTab,
    server: settings.server,
  });

  // ========== 文件合并 ==========
  const merge = useMerge({
    t,
    sortFlag: settings.sortFlag,
  });

  // 合并日志显示
  const displayLogs = tab === "crawler" ? crawler.logs : merge.logs;

  /* ========== UI 界面渲染 ========== */
  return (
    <>
      <AppHeader
        t={t}
        authUsername={auth.authUsername}
        authAvatarUrl={auth.authAvatarUrl}
        authAnchorEl={auth.authAnchorEl}
        menuOpen={auth.menuOpen}
        handleAvatarClick={auth.handleAvatarClick}
        handleMenuClose={auth.handleMenuClose}
        handleLogoutClick={auth.handleLogoutClick}
        openLoginDialog={auth.openLoginDialog}
      />
      
      <Container sx={{ mt: 2, width: 340, pb: 1 }}>
        <ToggleButtonGroup
          value={tab}
          exclusive
          fullWidth
          onChange={handleTabChange}
          aria-label={t("crawlerTab")}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="crawler">{t("crawlerTab")}</ToggleButton>
          <ToggleButton value="merge">{t("mergeTab")}</ToggleButton>
        </ToggleButtonGroup>
        
        <Stack spacing={2}>
          {tab === "crawler" && (
            <CrawlerTabContent
              t={t}
              saveAsZip={settings.saveAsZip}
              exportJson={settings.exportJson}
              collapseEquipDetails={settings.collapseEquipDetails}
              activateTab={settings.activateTab}
              server={settings.server}
              toggleSaveZip={settings.toggleSaveZip}
              toggleExportJson={settings.toggleExportJson}
              toggleEquipDetail={settings.toggleEquipDetail}
              toggleActivateTab={settings.toggleActivateTab}
              changeServer={settings.changeServer}
              loading={crawler.loading}
              cookieLoading={crawler.cookieLoading}
              handleSaveCookie={crawler.handleSaveCookie}
              handleStart={crawler.handleStart}
            />
          )}
          
          {tab === "merge" && (
            <MergeTabContent
              t={t}
              excelFilesToMerge={merge.excelFilesToMerge}
              jsonFilesToMerge={merge.jsonFilesToMerge}
              sortFlag={settings.sortFlag}
              loading={merge.loading}
              handleExcelFileSelect={merge.handleExcelFileSelect}
              handleJsonFileSelect={merge.handleJsonFileSelect}
              handleSortChange={settings.handleSortChange}
              handleMerge={merge.handleMerge}
            />
          )}
          
          <Paper
            variant="outlined"
            sx={{
              p: 1,
              height: 400,
              overflowY: "auto",
              whiteSpace: "pre-line",
              fontSize: 12,
            }}
          >
            {displayLogs.join("\n")}
          </Paper>

          {updateAvailable && (
            <Alert
              severity="error"
              sx={{ bgcolor: 'rgba(211, 47, 47, 0.2)' }}
              action={
                <Button color="inherit" size="small" href={releaseUrl} target="_blank">
                  {t("update")}
                </Button>
              }
            >
              {t("updateAvailable").replace("{version}", latestVersion)}
            </Alert>
          )}
        </Stack>
      </Container>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

    </>
  );
}
