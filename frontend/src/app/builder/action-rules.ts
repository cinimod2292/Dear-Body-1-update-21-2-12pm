export type SectionActionRules = {
  removable: boolean;
  movable: boolean;
  duplicatable: boolean;
};

export function isActionAllowed(rules: SectionActionRules, action: "remove" | "move" | "duplicate") {
  if (action === "remove") return rules.removable;
  if (action === "move") return rules.movable;
  return rules.duplicatable;
}

export function actionBlockedMessage(action: "remove" | "move" | "duplicate") {
  if (action === "remove") return "This section is required and cannot be removed.";
  if (action === "move") return "This section position is locked and cannot be moved.";
  return "This section cannot be duplicated.";
}
