import { PayfastGateway } from "../modules/payments/payfast.gateway.js";

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const [key, inlineValue] = token.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i += 1;
      continue;
    }
    args.set(key, "true");
  }
  return args;
}

function buildPayload(rawBody: string) {
  const payload: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(rawBody).entries()) {
    payload[key] = value;
  }
  return payload;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawBody = args.get("raw-body");
  if (!rawBody) {
    throw new Error("Missing --raw-body");
  }

  const passphrase = args.get("passphrase");
  const mode = args.get("mode") === "production" ? "production" : "sandbox";
  const payload = buildPayload(rawBody);
  const gateway = new PayfastGateway();
  const result = await gateway.verifyWebhook({
    mode,
    merchantId: args.get("merchant-id") ?? payload.merchant_id ?? "unknown",
    apiKey: args.get("merchant-key") ?? payload.merchant_key ?? "unknown",
    webhookSecret: passphrase,
  }, {
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ":method": "POST",
      ":path": "/payments/payfast/webhook",
    },
    payload,
    rawBody,
  });

  console.info("[payfast-itn-replay] verification result", JSON.stringify(result, null, 2));
  if (!result.isValid) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[payfast-itn-replay] failed", error);
  process.exit(1);
});
