import test from "node:test";
import assert from "node:assert/strict";
import { actionBlockedMessage, isActionAllowed } from "./action-rules";

test("action rule helper returns booleans for allowed actions", () => {
  const rules = { removable: false, movable: true, duplicatable: false };
  assert.equal(isActionAllowed(rules, "remove"), false);
  assert.equal(isActionAllowed(rules, "move"), true);
  assert.equal(isActionAllowed(rules, "duplicate"), false);
});

test("blocked message helper returns helpful text", () => {
  assert.equal(actionBlockedMessage("remove").includes("required"), true);
  assert.equal(actionBlockedMessage("move").includes("locked"), true);
  assert.equal(actionBlockedMessage("duplicate").includes("cannot"), true);
});
