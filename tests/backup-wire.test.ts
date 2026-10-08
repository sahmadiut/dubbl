import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { backupEntities, backupRowDto, parseBackupSnapshot } from "../lib/api/backup-wire";
import { contact } from "../lib/db/schema";

const organizationId = randomUUID();
function snapshot(version = 2) {
  return { version, organizationId, createdAt: "2024-02-29T00:00:00Z", entities: {
    ...Object.fromEntries(Object.keys(backupEntities).map(key => [key, []])),
    contacts: [{ id: randomUUID(), organizationId, name: "Legacy", creditLimit: 1250, ...(version === 2 ? { creditLimitMinor: "1250" } : {}) }],
  } };
}
test("backup v1 numeric and v2 aliases keep persisted units and dates", () => {
  for (const version of [1, 2]) {
    const input = snapshot(version);
    const parsed = parseBackupSnapshot(JSON.stringify(input), organizationId);
    assert.equal(parsed.entities.contacts[0].creditLimit, 1250);
    assert.equal(parsed.version, version);
  }
  assert.deepEqual(backupRowDto(contact, { creditLimit: -1250n }), { creditLimit: -1250, creditLimitMinor: "-1250" });
  assert.deepEqual(backupRowDto(contact, { creditLimit: null }), { creditLimit: null, creditLimitMinor: null });
});
test("backup rejects malformed, mismatched and unsupported money before conversion", () => {
  for (const fields of [{ creditLimitMinor: "1251" }, { creditLimit: 12.5 }, { creditLimitMinor: "01" },
    { creditLimitMinor: "9007199254740992", creditLimit: undefined }, { creditLimitMinor: "9223372036854775808", creditLimit: undefined },
    { creditLimit: Number.MAX_SAFE_INTEGER + 1 }, { creditLimitMinor: undefined }, { creditLimitMinor: null },
    { creditLimit: null, creditLimitMinor: "1250" }, { unexpectedMinor: "1" }, { organizationId: randomUUID() }]) {
    const input = snapshot(); Object.assign(input.entities.contacts[0], fields);
    assert.throws(() => parseBackupSnapshot(JSON.stringify(input), organizationId));
  }
  for (const input of [null, [], {}, { ...snapshot(), version: 3 }, { ...snapshot(), organizationId: randomUUID() },
    { ...snapshot(), entities: {} }, { ...snapshot(), entities: { ...snapshot().entities, unknown: [] } }])
    assert.throws(() => parseBackupSnapshot(JSON.stringify(input), organizationId));
  assert.throws(() => backupRowDto(contact, { creditLimit: 9007199254740992n }), /safely/);
  // Test raw token loss, not merely an already-rounded JavaScript number.
  assert.throws(() => parseBackupSnapshot(JSON.stringify(snapshot(1)).replace('"creditLimit":1250', '"creditLimit":9007199254740991.1'), organizationId), /losslessly/);
  assert.throws(() => parseBackupSnapshot(JSON.stringify(snapshot(1)).replace('"creditLimit":1250', '"creditLimit":1.0000000000000001'), organizationId), /losslessly/);
});
