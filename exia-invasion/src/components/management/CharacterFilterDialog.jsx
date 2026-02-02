// SPDX-License-Identifier: GPL-3.0-or-later
import { memo, useMemo, forwardRef, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Button,
  Divider,
  Stack,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { Virtuoso } from "react-virtuoso";

// 抽取列表项组件，避免每次渲染父组件都重新创建
const NikkeListItem = memo(function NikkeListItem({
  nikke,
  isSelected,
  alreadyAdded,
  displayName,
  avatarUrl,
  secondaryText,
  onSelect,
  selectedLabel,
  chooseLabel,
}) {
  return (
    <ListItem
      alignItems="stretch"
      sx={{ py: 0.5 }}
      secondaryAction={
        <Button
          variant="contained"
          size="small"
          onClick={() => onSelect(nikke)}
          color={isSelected || alreadyAdded ? "success" : "primary"}
          disabled={alreadyAdded}
          sx={{ minWidth: 84 }}
        >
          {isSelected || alreadyAdded ? selectedLabel : chooseLabel}
        </Button>
      }
    >
      <ListItemAvatar sx={{ minWidth: 68, width: 68, alignSelf: "stretch", display: "flex", alignItems: "stretch" }}>
        {avatarUrl ? (
          <Box
            component="img"
            src={avatarUrl}
            alt={displayName}
            loading="lazy"
            width={56}
            height={56}
            sx={{
              height: "100%",
              maxHeight: 56,
              aspectRatio: "1 / 1",
              borderRadius: "8px",
              objectFit: "cover",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <Box
            sx={{
              height: "100%",
              maxHeight: 56,
              aspectRatio: "1 / 1",
              borderRadius: "8px",
              backgroundColor: "action.disabledBackground",
            }}
            title={displayName}
          />
        )}
      </ListItemAvatar>
      <ListItemText
        primary={displayName}
        secondary={secondaryText}
        primaryTypographyProps={{ noWrap: true, variant: "body1" }}
        secondaryTypographyProps={{ noWrap: true, variant: "caption" }}
        sx={{ my: 0 }}
      />
    </ListItem>
  );
});

// 选中/已有妮姬的头像缩略图
const NikkeThumbnail = memo(function NikkeThumbnail({ nikke, name, avatarUrl, onRemove, removeLabel }) {
  return (
    <Box
      sx={{
        position: "relative",
        width: 56,
        height: 56,
        borderRadius: "8px",
        overflow: "hidden",
        backgroundColor: "action.disabledBackground",
      }}
      title={name}
    >
      {avatarUrl ? (
        <Box
          component="img"
          src={avatarUrl}
          alt={name}
          loading="lazy"
          width={56}
          height={56}
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <IconButton
        size="small"
        aria-label={removeLabel}
        onClick={() => onRemove(nikke.id)}
        sx={{
          position: "absolute",
          top: 2,
          right: 2,
          width: 18,
          height: 18,
          p: 0,
          backgroundColor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          "&:hover": {
            backgroundColor: "background.paper",
          },
        }}
      >
        <CloseIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
});

const CharacterFilterDialog = ({
  t,
  open,
  onClose,
  filters,
  setFilters,
  filteredNikkes,
  selectedNikkes,
  effectiveExistingElementIds,
  getDisplayName,
  getNikkeAvatarUrl,
  getElementName,
  getBurstStageName,
  getClassName,
  getCorporationName,
  handleSelectNikke,
  selectionLabel,
  totalSelectionCount,
  effectiveExistingElementCharacters,
  handleRemoveExistingNikke,
  handleRemoveSelectedNikke,
  pendingSelectionCount,
  removedExistingIds,
  handleConfirmSelection,
}) => {
  const listComponents = useMemo(
    () => ({
      List: forwardRef((props, ref) => <List {...props} ref={ref} dense />),
      Item: forwardRef((props, ref) => <div {...props} ref={ref} />),
    }),
    []
  );

  // 预计算选中ID集合，避免在 itemContent 中每次调用 .some()
  const selectedNikkeIds = useMemo(
    () => new Set(selectedNikkes.map((n) => n.id)),
    [selectedNikkes]
  );

  // 缓存翻译字符串
  const selectedLabel = t("selectedTag");
  const chooseLabel = t("choose");
  const removeLabel = t("remove") || "remove";

  // 使用 useCallback 稳定 renderItem 函数引用
  const renderItem = useCallback(
    (index, nikke) => {
      const isSelected = selectedNikkeIds.has(nikke.id);
      const alreadyAdded = effectiveExistingElementIds.has(nikke.id);
      const displayName = getDisplayName(nikke);
      const avatarUrl = getNikkeAvatarUrl(nikke);
      const secondaryText = `${getElementName(nikke.element)} | ${getBurstStageName(nikke.use_burst_skill)} | ${getClassName(nikke.class)} | ${getCorporationName(nikke.corporation)} | ${nikke.weapon_type}`;
      return (
        <NikkeListItem
          nikke={nikke}
          isSelected={isSelected}
          alreadyAdded={alreadyAdded}
          displayName={displayName}
          avatarUrl={avatarUrl}
          secondaryText={secondaryText}
          onSelect={handleSelectNikke}
          selectedLabel={selectedLabel}
          chooseLabel={chooseLabel}
        />
      );
    },
    [
      selectedNikkeIds,
      effectiveExistingElementIds,
      getDisplayName,
      getNikkeAvatarUrl,
      getElementName,
      getBurstStageName,
      getClassName,
      getCorporationName,
      handleSelectNikke,
      selectedLabel,
      chooseLabel,
    ]
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: "8px" } }}>
    <DialogTitle>{t("characterFilter")}</DialogTitle>
    <DialogContent>
      <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
        <TextField
          size="small"
          label={t("characterName")}
          value={filters.name}
          onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={t("searchPlaceholder")}
          fullWidth
          inputProps={{ name: "characterName", autoComplete: "off" }}
        />

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: "repeat(5, 1fr)",
          }}
        >
          <FormControl size="small" fullWidth sx={{ minWidth: 0 }}>
            <InputLabel>{t("element")}</InputLabel>
            <Select
              value={filters.element}
              onChange={(e) => setFilters((prev) => ({ ...prev, element: e.target.value }))}
              label={t("element")}
              MenuProps={{
                PaperProps: {
                  style: { maxHeight: 200, width: "auto" },
                },
                anchorOrigin: { vertical: "bottom", horizontal: "left" },
                transformOrigin: { vertical: "top", horizontal: "left" },
              }}
            >
              <MenuItem value="">{t("all")}</MenuItem>
              <MenuItem value="Iron">{t("iron")}</MenuItem>
              <MenuItem value="Fire">{t("fire")}</MenuItem>
              <MenuItem value="Water">{t("water")}</MenuItem>
              <MenuItem value="Wind">{t("wind")}</MenuItem>
              <MenuItem value="Electronic">{t("electronic")}</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth sx={{ minWidth: 0 }}>
            <InputLabel>{t("burstSkill")}</InputLabel>
            <Select
              value={filters.use_burst_skill}
              onChange={(e) => setFilters((prev) => ({ ...prev, use_burst_skill: e.target.value }))}
              label={t("burstSkill")}
              MenuProps={{
                PaperProps: {
                  style: { maxHeight: 200, width: "auto" },
                },
                anchorOrigin: { vertical: "bottom", horizontal: "left" },
                transformOrigin: { vertical: "top", horizontal: "left" },
              }}
            >
              <MenuItem value="">{t("all")}</MenuItem>
              <MenuItem value="Step1">{t("burstStage1")}</MenuItem>
              <MenuItem value="Step2">{t("burstStage2")}</MenuItem>
              <MenuItem value="Step3">{t("burstStage3")}</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth sx={{ minWidth: 0 }}>
            <InputLabel>{t("class")}</InputLabel>
            <Select
              value={filters.class}
              onChange={(e) => setFilters((prev) => ({ ...prev, class: e.target.value }))}
              label={t("class")}
              MenuProps={{
                PaperProps: {
                  style: { maxHeight: 200, width: "auto" },
                },
                anchorOrigin: { vertical: "bottom", horizontal: "left" },
                transformOrigin: { vertical: "top", horizontal: "left" },
              }}
            >
              <MenuItem value="">{t("all")}</MenuItem>
              <MenuItem value="Attacker">{t("attacker")}</MenuItem>
              <MenuItem value="Defender">{t("defender")}</MenuItem>
              <MenuItem value="Supporter">{t("supporter")}</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth sx={{ minWidth: 0 }}>
            <InputLabel>{t("corporation")}</InputLabel>
            <Select
              value={filters.corporation}
              onChange={(e) => setFilters((prev) => ({ ...prev, corporation: e.target.value }))}
              label={t("corporation")}
              MenuProps={{
                PaperProps: {
                  style: { maxHeight: 200, width: "auto" },
                },
                anchorOrigin: { vertical: "bottom", horizontal: "left" },
                transformOrigin: { vertical: "top", horizontal: "left" },
              }}
            >
              <MenuItem value="">{t("all")}</MenuItem>
              <MenuItem value="ELYSION">{t("elysion")}</MenuItem>
              <MenuItem value="MISSILIS">{t("missilis")}</MenuItem>
              <MenuItem value="TETRA">{t("tetra")}</MenuItem>
              <MenuItem value="PILGRIM">{t("pilgrim")}</MenuItem>
              <MenuItem value="ABNORMAL">{t("abnormal")}</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth sx={{ minWidth: 0 }}>
            <InputLabel>{t("weaponType")}</InputLabel>
            <Select
              value={filters.weapon_type}
              onChange={(e) => setFilters((prev) => ({ ...prev, weapon_type: e.target.value }))}
              label={t("weaponType")}
              MenuProps={{
                PaperProps: {
                  style: { maxHeight: 200, width: "auto" },
                },
                anchorOrigin: { vertical: "bottom", horizontal: "left" },
                transformOrigin: { vertical: "top", horizontal: "left" },
              }}
            >
              <MenuItem value="">{t("all")}</MenuItem>
              <MenuItem value="AR">AR</MenuItem>
              <MenuItem value="SMG">SMG</MenuItem>
              <MenuItem value="SG">SG</MenuItem>
              <MenuItem value="SR">SR</MenuItem>
              <MenuItem value="MG">MG</MenuItem>
              <MenuItem value="RL">RL</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Typography variant="subtitle2">
          {t("filterResults")} ({filteredNikkes.length})
        </Typography>

        <Box sx={{ height: 400 }}>
          {filteredNikkes.length > 0 ? (
            <Virtuoso
              data={filteredNikkes}
              components={listComponents}
              itemKey={(index, item) => item.id ?? index}
              itemContent={renderItem}
            />
          ) : (
            <Typography color="textSecondary">{t("notFound")}</Typography>
          )}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {selectionLabel}
          </Typography>
          {totalSelectionCount === 0 ? (
            <Typography color="textSecondary">{t("selectedEmpty")}</Typography>
          ) : (
            <Stack direction="row" spacing={0.75} flexWrap="wrap">
              {effectiveExistingElementCharacters.map((nikke) => (
                <NikkeThumbnail
                  key={`existing-${nikke.id}`}
                  nikke={nikke}
                  name={getDisplayName(nikke)}
                  avatarUrl={getNikkeAvatarUrl(nikke)}
                  onRemove={handleRemoveExistingNikke}
                  removeLabel={removeLabel}
                />
              ))}
              {selectedNikkes.map((nikke) => (
                <NikkeThumbnail
                  key={`pending-${nikke.id}`}
                  nikke={nikke}
                  name={getDisplayName(nikke)}
                  avatarUrl={getNikkeAvatarUrl(nikke)}
                  onRemove={handleRemoveSelectedNikke}
                  removeLabel={removeLabel}
                />
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2, pt: 1.5 }}>
      <Button variant="outlined" onClick={onClose} sx={{ minWidth: 96, px: 2, py: 0.75, borderRadius: "8px" }}>
        {t("cancel")}
      </Button>
      <Button
        variant="contained"
        onClick={handleConfirmSelection}
        disabled={pendingSelectionCount === 0 && removedExistingIds.length === 0}
        sx={{ minWidth: 120, px: 2.5, py: 0.75, borderRadius: "8px" }}
      >
        {t("confirmSelection")}
      </Button>
    </DialogActions>
  </Dialog>
  );
};

export default memo(CharacterFilterDialog);
