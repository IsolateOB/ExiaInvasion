import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeStoredAccounts,
  parseGameUidFromCookie,
  parseGameOpenIdFromCookie,
} from "../src/components/management/utils.js";

test("normalizeStoredAccounts returns an empty array for malformed storage payloads", () => {
  assert.deepEqual(normalizeStoredAccounts(null), []);
  assert.deepEqual(normalizeStoredAccounts({ broken: true }), []);
  assert.deepEqual(normalizeStoredAccounts("oops"), []);
});

test("normalizeStoredAccounts backfills account identifiers from cookie fields", () => {
  const [account] = normalizeStoredAccounts([
    {
      username: "alice",
      cookie: "foo=1; game_uid=12345; game_openid=openid-9; bar=2",
    },
  ]);

  assert.equal(account.username, "alice");
  assert.equal(account.email, "");
  assert.equal(account.password, "");
  assert.equal(account.game_uid, "12345");
  assert.equal(account.game_openid, "openid-9");
  assert.equal(account.cookieUpdatedAt, null);
});

test("cookie parsers ignore unrelated fields", () => {
  const cookie = "foo=1; bar=2";
  assert.equal(parseGameUidFromCookie(cookie), "");
  assert.equal(parseGameOpenIdFromCookie(cookie), "");
});
