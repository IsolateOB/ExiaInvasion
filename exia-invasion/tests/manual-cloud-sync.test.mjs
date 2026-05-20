import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { getManualCloudConfirmationKind } from "../src/utils/manualCloudSync.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("manual upload asks for confirmation when cloud was updated after the local baseline", () => {
  assert.equal(
    getManualCloudConfirmationKind({
      action: "upload",
      remoteUpdatedAt: 2000,
      localUpdatedAt: 1000,
    }),
    "cloud-newer",
  );
});

test("manual upload asks for confirmation when cloud already has data but no local baseline exists", () => {
  assert.equal(
    getManualCloudConfirmationKind({
      action: "upload",
      remoteUpdatedAt: 2000,
      localUpdatedAt: null,
    }),
    "cloud-newer",
  );
});

test("manual download asks for confirmation when cloud is older than the local baseline", () => {
  assert.equal(
    getManualCloudConfirmationKind({
      action: "download",
      remoteUpdatedAt: 1000,
      localUpdatedAt: 2000,
    }),
    "cloud-older",
  );
});

test("manual cloud actions skip confirmation when the timestamp direction is safe", () => {
  assert.equal(
    getManualCloudConfirmationKind({
      action: "upload",
      remoteUpdatedAt: 1000,
      localUpdatedAt: 2000,
    }),
    null,
  );
  assert.equal(
    getManualCloudConfirmationKind({
      action: "download",
      remoteUpdatedAt: 2000,
      localUpdatedAt: 1000,
    }),
    null,
  );
  assert.equal(
    getManualCloudConfirmationKind({
      action: "download",
      remoteUpdatedAt: null,
      localUpdatedAt: 2000,
    }),
    null,
  );
});

test("manual cloud sync observers run after signature builders are initialized", () => {
  const source = readFileSync(
    resolve(__dirname, "../src/components/management/hooks/useCloudSync.js"),
    "utf8",
  );

  const accountsBuilder = source.indexOf("const buildAccountListsSignature");
  const charactersBuilder = source.indexOf("const buildCharacterListsSignature");
  const accountsObserver = source.indexOf("observedAccountsReadyRef.current");
  const charactersObserver = source.indexOf("observedCharactersReadyRef.current");

  assert.ok(accountsBuilder >= 0, "accounts signature builder should exist");
  assert.ok(charactersBuilder >= 0, "characters signature builder should exist");
  assert.ok(accountsObserver > accountsBuilder, "accounts observer must not read the builder before initialization");
  assert.ok(charactersObserver > charactersBuilder, "characters observer must not read the builder before initialization");
});
