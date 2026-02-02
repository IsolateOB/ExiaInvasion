// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 合并标签页内容组件 ==========

import { memo } from "react";
import {
  Button,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import MergeIcon from "@mui/icons-material/Merge";

const MergeTabContent = ({
  t,
  excelFilesToMerge,
  jsonFilesToMerge,
  sortFlag,
  loading,
  handleExcelFileSelect,
  handleJsonFileSelect,
  handleSortChange,
  handleMerge,
}) => {
  return (
    <>
      <Button
        component="label"
        variant="outlined"
        fullWidth
        startIcon={<UploadFileIcon />}
      >
        {t("upload")} Excel ({excelFilesToMerge.length})
        <input
          type="file"
          multiple
          hidden
          onChange={handleExcelFileSelect}
          accept=".xlsx"
        />
      </Button>
      <Button
        component="label"
        variant="outlined"
        fullWidth
        startIcon={<UploadFileIcon />}
      >
        {t("upload")} JSON ({jsonFilesToMerge.length})
        <input
          type="file"
          multiple
          hidden
          onChange={handleJsonFileSelect}
          accept=".json"
        />
      </Button>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {t("mergeOption")}
        </Typography>
        <Select
          variant="outlined"
          size="small"
          fullWidth
          value={sortFlag}
          onChange={handleSortChange}
          inputProps={{ "aria-label": t("mergeOption") }}
        >
          <MenuItem value="1">{t("nameAsc")}</MenuItem>
          <MenuItem value="2">{t("nameDesc")}</MenuItem>
          <MenuItem value="3">{t("syncAsc")}</MenuItem>
          <MenuItem value="4">{t("syncDesc")}</MenuItem>
        </Select>
      </Box>
      <Button
        variant="contained"
        fullWidth
        onClick={handleMerge}
        startIcon={
          loading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <MergeIcon />
          )
        }
        disabled={loading || (!excelFilesToMerge.length && !jsonFilesToMerge.length)}
      >
        {t("merge")}
      </Button>
    </>
  );
};

export default memo(MergeTabContent);
