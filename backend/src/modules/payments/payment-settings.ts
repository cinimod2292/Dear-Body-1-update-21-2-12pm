import { AppError } from "../../lib/errors.js";

export const PAYMENT_GATEWAY_NAMES = ["stitch", "payfast"] as const;
export type PaymentGatewayName = typeof PAYMENT_GATEWAY_NAMES[number];

export type EnabledGatewayState = Record<PaymentGatewayName, boolean>;

export function assertAtLeastOneGatewayEnabled(state: EnabledGatewayState) {
  if (!state.stitch && !state.payfast) {
    throw new AppError(400, "At least one payment gateway must remain enabled", "PAYMENT_GATEWAY_MIN_ONE_REQUIRED");
  }
}

export function resolveGatewayForRequest(state: EnabledGatewayState, requested?: string): PaymentGatewayName {
  if (requested) {
    if (!PAYMENT_GATEWAY_NAMES.includes(requested as PaymentGatewayName)) {
      throw new AppError(400, `Unsupported gateway: ${requested}`, "PAYMENT_GATEWAY_UNSUPPORTED");
    }

    const typed = requested as PaymentGatewayName;
    if (state[typed]) return typed;

    const fallback = PAYMENT_GATEWAY_NAMES.find((name) => state[name]);
    if (fallback) return fallback;
    assertAtLeastOneGatewayEnabled(state);
  }

  const defaultGateway = PAYMENT_GATEWAY_NAMES.find((name) => state[name]);
  if (!defaultGateway) {
    throw new AppError(400, "No enabled payment gateway is configured", "PAYMENT_GATEWAY_NONE_ENABLED");
  }
  return defaultGateway;
}

export function toStorefrontGatewayLabel(gateway: PaymentGatewayName) {
  if (gateway === "stitch") return "Stitch";
  if (gateway === "payfast") return "PayFast";
  return gateway;
}
