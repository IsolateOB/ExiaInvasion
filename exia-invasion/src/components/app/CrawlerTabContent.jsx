// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 爬取标签页内容组件 ==========

import { memo } from "react";
import {
  Stack,
  Switch,
  Button,
  FormControlLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import SettingsIcon from "@mui/icons-material/Settings";

const CrawlerTabContent = ({
  t,
  // 设置
  saveAsZip,
  exportJson,
  collapseEquipDetails,
  activateTab,
  server,
  // 开关处理
  toggleSaveZip,
  toggleExportJson,
  toggleEquipDetail,
  toggleActivateTab,
  changeServer,
  // 爬取
  loading,
  cookieLoading,
  handleSaveCookie,
  handleStart,
}) => {
  return (
    <>
      {/* 保存当前 Cookie */}
      <Button
        variant="outlined"
        fullWidth
        onClick={handleSaveCookie}
        startIcon={<SaveIcon />}
      >
        {t("saveCookie")}
      </Button>
      <Button
        variant="text"
        fullWidth
        onClick={() => chrome.runtime.openOptionsPage()}
        startIcon={<SettingsIcon />}
      >
        {t("management")}
      </Button>
      <Stack spacing={1}>
        <FormControlLabel
          control={<Switch checked={saveAsZip} onChange={toggleSaveZip} />}
          label={t("saveAsZip")}
        />
        <FormControlLabel
          control={<Switch checked={exportJson} onChange={toggleExportJson} />}
          label={t("exportJson")}
        />
        <FormControlLabel
          control={<Switch checked={collapseEquipDetails} onChange={toggleEquipDetail} />}
          label={t("equipDetail")}
        />
        <FormControlLabel
          control={<Switch checked={activateTab} onChange={toggleActivateTab} />}
          label={t("activateTab")}
        />
      </Stack>
      
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {t("server")}
        </Typography>
        <Select
          variant="outlined"
          size="small"
          fullWidth
          value={server}
          onChange={changeServer}
          inputProps={{ "aria-label": t("server") }}
        >
          <MenuItem value="hmt">{t("hmt")}</MenuItem>
          <MenuItem value="global">{t("global")}</MenuItem>
        </Select>
      </Box>
      
      {/* 运行按钮 */}
      <Button
        variant="contained"
        fullWidth
        onClick={() => handleStart({ onlyCookie: false })}
        startIcon={
          loading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <PlayArrowIcon />
          )
        }
        disabled={loading || cookieLoading}
      >
        {t("fetchCharacters")}
      </Button>
      <Button
        variant="outlined"
        fullWidth
        onClick={() => handleStart({ onlyCookie: true })}
        startIcon={cookieLoading ? <CircularProgress size={20} color="inherit" /> : null}
        disabled={loading || cookieLoading}
      >
        {t("updateCookie")}
      </Button>
    </>
  );
};

export default memo(CrawlerTabContent);
