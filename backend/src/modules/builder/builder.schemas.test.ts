import test from "node:test";
import assert from "node:assert/strict";
import { builderPageContentSchema, updateBuilderDraftSchema } from "./builder.schemas.js";

test("builder schema accepts valid homepage sections", () => {
  const parsed = builderPageContentSchema.parse({
    sections: [
      {
        id: "hero-1",
        type: "hero_banner",
        enabled: true,
        props: {
          title: "Heading",
          subtitle: "Sub",
          primaryButtonHref: "/shop",
          layout: "image_right",
          tone: "soft",
        },
      },
    ],
  });

  assert.equal(parsed.sections.length, 1);
  assert.equal(parsed.sections[0]?.type, "hero_banner");
});

test("builder schema rejects unsafe urls", () => {
  assert.throws(() => {
    updateBuilderDraftSchema.parse({
      content: {
        sections: [
          {
            id: "promo-1",
            type: "promo_banner",
            enabled: true,
            props: {
              text: "Promo",
              buttonText: "Buy",
              buttonHref: "javascript:alert(1)",
              tone: "warm",
            },
          },
        ],
      },
    });
  });
});

test("builder schema rejects script tags in text", () => {
  assert.throws(() => {
    updateBuilderDraftSchema.parse({
      content: {
        sections: [
          {
            id: "hero-1",
            type: "hero_banner",
            enabled: true,
            props: {
              title: "<script>alert('xss')</script>",
              layout: "centered",
              tone: "clean",
            },
          },
        ],
      },
    });
  });
});

test("builder schema rejects unknown section types", () => {
  assert.throws(() => {
    builderPageContentSchema.parse({
      sections: [
        {
          id: "weird-1",
          type: "newsletter_signup",
          enabled: true,
          props: {},
        },
      ],
    });
  });
});
