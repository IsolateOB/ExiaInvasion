// SPDX-License-Identifier: GPL-3.0-or-later

export const getManualCloudConfirmationKind = ({
  action,
  remoteUpdatedAt,
  localUpdatedAt,
}) => {
  const remoteMs = Number(remoteUpdatedAt);
  const localMs = Number(localUpdatedAt);
  const hasRemote = Number.isFinite(remoteMs) && remoteMs > 0;
  const hasLocal = Number.isFinite(localMs) && localMs > 0;

  if (action === "upload") {
    if (hasRemote && (!hasLocal || remoteMs > localMs)) {
      return "cloud-newer";
    }
    return null;
  }

  if (action === "download") {
    if (hasRemote && hasLocal && remoteMs < localMs) {
      return "cloud-older";
    }
    return null;
  }

  return null;
};
