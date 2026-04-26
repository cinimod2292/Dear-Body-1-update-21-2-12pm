import test from "node:test";
import assert from "node:assert/strict";
import { inferInspectorGroup } from "./inspector";

test("inferInspectorGroup places image and media fields correctly", () => {
  assert.equal(inferInspectorGroup("imageUrl", { type: "image", label: "Image" }), "Media");
  assert.equal(inferInspectorGroup("imageAlt", { type: "text", label: "Alt" }), "Media");
});

test("inferInspectorGroup places button/url fields correctly", () => {
  assert.equal(inferInspectorGroup("primaryButtonText", { type: "text", label: "Button" }), "Buttons/Links");
  assert.equal(inferInspectorGroup("buttonHref", { type: "url", label: "Link" }), "Buttons/Links");
});

test("inferInspectorGroup places layout/style/content fields correctly", () => {
  assert.equal(inferInspectorGroup("layout", { type: "select", label: "Layout" }), "Layout");
  assert.equal(inferInspectorGroup("tone", { type: "select", label: "Style" }), "Style");
  assert.equal(inferInspectorGroup("title", { type: "text", label: "Title" }), "Content");
});
