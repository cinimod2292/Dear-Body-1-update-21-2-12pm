export interface GatewayConfig {
  mode: "sandbox" | "production";
  apiBaseUrl?: string;
  merchantId: string;
  apiKey: string;
  webhookSecret?: string;
  redirectUrl?: string;
  callbackUrl?: string;
}

export interface InitiatePaymentInput {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  returnUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
}

export interface InitiatePaymentResult {
  referenceId: string;
  checkoutUrl?: string;
  status: "PENDING" | "AUTHORIZED" | "PAID" | "FAILED";
  raw: Record<string, unknown>;
}

export interface VerifyPaymentResult {
  referenceId: string;
  status: "PENDING" | "AUTHORIZED" | "PAID" | "FAILED";
  raw: Record<string, unknown>;
  externalEventId?: string;
}

export interface VerifyWebhookInput {
  headers: Record<string, string | undefined>;
  rawBody: string;
  payload: Record<string, unknown>;
}

export interface VerifyWebhookResult {
  isValid: boolean;
  referenceId?: string;
  externalEventId?: string;
  status: "PENDING" | "AUTHORIZED" | "PAID" | "FAILED";
  raw: Record<string, unknown>;
  reason?: string;
}

export interface PaymentGatewayProvider {
  readonly name: string;
  initiatePayment(config: GatewayConfig, input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  verifyPayment(config: GatewayConfig, referenceId: string): Promise<VerifyPaymentResult>;
  verifyWebhook(config: GatewayConfig, input: VerifyWebhookInput): Promise<VerifyWebhookResult>;
}
