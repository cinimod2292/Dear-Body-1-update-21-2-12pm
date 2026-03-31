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
    key: "welcome_email",
    name: "Welcome Email (System)",
    category: "ACCOUNT",
    subject: "Welcome to {{companyName}}, {{firstName}}!",
    htmlBody: "<h1>Welcome {{firstName}}</h1><p>Thanks for joining {{companyName}}.</p>",
    placeholderKeys: ["firstName", "companyName"],
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
    key: "order_shipped",
    name: "Order Shipped",
    category: "SHIPPING",
    subject: "Order #{{orderNumber}} has shipped",
    htmlBody: "<p>Your order #{{orderNumber}} has shipped. Tracking number: {{trackingNumber}}. Track here: {{trackingUrl}}</p>",
    placeholderKeys: ["orderNumber", "trackingNumber", "trackingUrl"],
  },
  {
    key: "order_delivered",
    name: "Order Delivered",
    category: "SHIPPING",
    subject: "Order #{{orderNumber}} delivered",
    htmlBody: "<p>Your order #{{orderNumber}} was delivered. Thanks for shopping with {{companyName}}.</p>",
    placeholderKeys: ["orderNumber", "companyName"],
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
    key: "email_verification",
    name: "Email Verification",
    category: "SECURITY",
    subject: "Verify your email",
    htmlBody: "<p>Hi {{firstName}}, verify your email here: <a href=\"{{verificationUrl}}\">Verify Email</a></p>",
    placeholderKeys: ["firstName", "verificationUrl"],
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
    key: "abandoned_cart_reminder",
    name: "Abandoned Cart Reminder",
    category: "MARKETING",
    subject: "You left something behind, {{firstName}}",
    htmlBody: `<p>Your cart is waiting for you. Complete your order here: <a href="{{checkoutUrl}}">Checkout</a></p>`, 
    placeholderKeys: ["firstName", "checkoutUrl"],
  },
  {
    key: "contact_notification",
    name: "Contact Notification",
    category: "SUPPORT",
    subject: "New contact inquiry from {{name}}",
    htmlBody: "<p>New inquiry received from {{name}} ({{email}}): {{message}}</p>",
    placeholderKeys: ["name", "email", "message"],
  },
  {
    key: "contact_form_notification",
    name: "Contact Form Notification",
    category: "SUPPORT",
    subject: "New contact form submission from {{customerName}}",
    htmlBody: "<p>New message from {{customerName}} ({{supportEmail}}): {{message}}</p>",
    placeholderKeys: ["customerName", "supportEmail", "message"],
  },
  {
    key: "admin_new_order_notification",
    name: "Admin New Order Notification",
    category: "SYSTEM",
    subject: "New order placed: #{{orderNumber}}",
    htmlBody: "<p>A new order #{{orderNumber}} was placed on {{orderDate}}. Total: {{orderTotal}}.</p>",
    placeholderKeys: ["orderNumber", "orderDate", "orderTotal"],
  },
  {
    key: "newsletter_signup_confirmation",
    name: "Newsletter Signup Confirmation",
    category: "MARKETING",
    subject: "You're subscribed to {{companyName}} updates",
    htmlBody: "<p>Thanks {{firstName}} for subscribing to {{companyName}} newsletters.</p>",
    placeholderKeys: ["firstName", "companyName"],
  },
];
