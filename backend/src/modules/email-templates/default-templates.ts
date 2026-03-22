import { EmailTemplateCategory } from "@prisma/client";

export interface DefaultTemplate {
  key: string;
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  htmlBody: string;
  placeholderKeys: string[];
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultTemplate[] = [
  {
    key: "welcome",
    name: "Welcome Email",
    category: "ACCOUNT",
    subject: "Welcome to {{storeName}}, {{firstName}}!",
    htmlBody: "<h1>Welcome {{firstName}}</h1><p>Thanks for joining {{storeName}}.</p>",
    placeholderKeys: ["firstName", "storeName"],
  },
  {
    key: "order_confirmation",
    name: "Order Confirmation",
    category: "ORDER",
    subject: "Order #{{orderNumber}} confirmed",
    htmlBody: "<p>Hi {{firstName}}, your order <strong>#{{orderNumber}}</strong> was received. Total: {{totalAmount}}.</p>",
    placeholderKeys: ["firstName", "orderNumber", "totalAmount"],
  },
  {
    key: "payment_confirmation",
    name: "Payment Confirmation",
    category: "PAYMENT",
    subject: "Payment received for order #{{orderNumber}}",
    htmlBody: "<p>We received your payment of {{amount}} for order #{{orderNumber}}.</p>",
    placeholderKeys: ["orderNumber", "amount"],
  },
  {
    key: "shipping_confirmation",
    name: "Shipping Confirmation",
    category: "SHIPPING",
    subject: "Your order #{{orderNumber}} has shipped",
    htmlBody: "<p>Your order #{{orderNumber}} has shipped via {{carrier}}. Tracking: {{trackingNumber}}</p>",
    placeholderKeys: ["orderNumber", "carrier", "trackingNumber"],
  },
  {
    key: "password_reset",
    name: "Password Reset",
    category: "SECURITY",
    subject: "Reset your password",
    htmlBody: "<p>Click <a href=\"{{resetUrl}}\">here</a> to reset your password.</p>",
    placeholderKeys: ["resetUrl"],
  },
  {
    key: "refund_cancellation",
    name: "Refund / Cancellation",
    category: "PAYMENT",
    subject: "Update for order #{{orderNumber}}",
    htmlBody: "<p>Your order #{{orderNumber}} has been {{eventType}}. Amount: {{amount}}</p>",
    placeholderKeys: ["orderNumber", "eventType", "amount"],
  },
  {
    key: "contact_notification",
    name: "Contact Notification",
    category: "SUPPORT",
    subject: "New contact inquiry from {{name}}",
    htmlBody: "<p>New inquiry received from {{name}} ({{email}}): {{message}}</p>",
    placeholderKeys: ["name", "email", "message"],
  },
];
