// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback, useId, useMemo, useState } from "react";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { Box, ButtonBase, ClickAwayListener, Paper, Popper } from "@mui/material";

const resolveChildren = (children, args) =>
  typeof children === "function" ? children(args) : children;

const InteractiveSelector = ({
  value,
  width,
  minWidth,
  menuMinWidth,
  menuMaxHeight = 320,
  disabled = false,
  ariaLabel,
  triggerSx,
  menuSx,
  children,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const listboxId = useId();
  const isOpen = Boolean(anchorEl);

  const handleOpen = useCallback(
    (event) => {
      if (disabled) return;
      setAnchorEl((currentAnchor) =>
        currentAnchor === event.currentTarget ? null : event.currentTarget,
      );
    },
    [disabled],
  );

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const resolvedMenuMinWidth = useMemo(
    () => menuMinWidth ?? minWidth ?? width,
    [menuMinWidth, minWidth, width],
  );

  return (
    <>
      <ButtonBase
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onClick={handleOpen}
        disabled={disabled}
        sx={{
          width,
          minWidth,
          px: 1.5,
          py: 0.875,
          borderRadius: 1,
          border: "1px solid",
          borderColor: isOpen ? "primary.main" : "rgba(0, 0, 0, 0.23)",
          bgcolor: "background.paper",
          color: "text.primary",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          textAlign: "left",
          transition: (theme) =>
            theme.transitions.create(["border-color", "box-shadow"]),
          "&:hover": {
            borderColor: isOpen ? "primary.main" : "text.primary",
          },
          "&.Mui-disabled": {
            opacity: 0.7,
            bgcolor: "action.disabledBackground",
          },
          ...triggerSx,
        }}
      >
        <Box
          sx={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center" }}
        >
          {value}
        </Box>
        <ArrowDropDownIcon
          sx={{
            flexShrink: 0,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
      </ButtonBase>

      <Popper
        open={isOpen}
        anchorEl={anchorEl}
        placement="bottom-start"
        sx={{
          zIndex: (theme) => theme.zIndex.modal + 1,
        }}
      >
        <ClickAwayListener onClickAway={handleClose}>
          <Paper
            sx={{
              mt: 0.5,
              minWidth: resolvedMenuMinWidth,
              maxWidth: "min(92vw, 420px)",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <Box
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  handleClose();
                }
              }}
              sx={{
                maxHeight: menuMaxHeight,
                overflowY: "auto",
                py: 0.5,
                ...menuSx,
              }}
            >
              {resolveChildren(children, { close: handleClose, isOpen })}
            </Box>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  );
};

export default InteractiveSelector;
