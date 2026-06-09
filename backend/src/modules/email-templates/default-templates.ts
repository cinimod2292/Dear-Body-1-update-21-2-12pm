import { EmailTemplateCategory } from "@prisma/client";

export interface DefaultTemplate {
  key: string;
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  htmlBody: string;
  placeholderKeys: string[];
}

function brandedEmailShell(input: { preheader: string; title: string; body: string; ctaLabel?: string; ctaUrl?: string }) {
  const cta = input.ctaLabel && input.ctaUrl
    ? `<tr><td style="padding:0 32px 20px 32px;"><a href="${input.ctaUrl}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:{{buttonBg}};color:{{buttonTextColor}};text-decoration:none;font-weight:700;font-family:Arial,sans-serif;">${input.ctaLabel}</a></td></tr>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;background:{{outerBg}};font-family:Arial,sans-serif;color:{{bodyTextColor}};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${input.preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{{outerBg}};padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:620px;max-width:620px;background:{{contentBg}};border-radius:16px;overflow:hidden;border:1px solid #f1f5f9;">
            <tr>
              <td style="padding:18px 24px;background:linear-gradient(90deg,{{primaryColor}},{{accentColor}});text-align:center;">
                <div style="font-size:20px;font-weight:800;letter-spacing:.3px;color:#ffffff;">{{brandName}}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px 32px;font-size:28px;line-height:1.2;font-weight:800;color:{{headingColor}};">${input.title}</td>
            </tr>
            <tr>
              <td style="padding:8px 32px 8px 32px;font-size:16px;line-height:1.6;color:{{bodyTextColor}};">${input.body}</td>
            </tr>
            ${cta}
            <tr>
              <td style="padding:22px 32px;background:{{footerBg}};color:{{footerText}};font-size:13px;line-height:1.6;">
                Need help? Email <a href="mailto:{{supportEmail}}" style="color:{{footerText}};text-decoration:underline;">{{supportEmail}}</a><br />
                <a href="{{siteUrl}}" style="color:{{footerText}};text-decoration:none;">{{siteUrl}}</a> · © {{companyName}}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultTemplate[] = [
  {
    key: "welcome",
    name: "Welcome Email",
    category: "ACCOUNT",
    subject: "Welcome to {{storeName}}, {{firstName}}!",
    htmlBody: brandedEmailShell({
      preheader: "Welcome to Dear Body",
      title: "Welcome {{firstName}} ✨",
      body: "Thanks for joining {{storeName}}. We’re so glad you’re here.",
      ctaLabel: "Start Shopping",
      ctaUrl: "{{siteUrl}}/shop",
    }),
    placeholderKeys: ["firstName", "storeName", "siteUrl", "companyName", "supportEmail"],
  },
  {
    key: "welcome_email",
    name: "Welcome Email (System)",
    category: "ACCOUNT",
    subject: "Welcome to {{companyName}}, {{firstName}}!",
    htmlBody: brandedEmailShell({
      preheader: "Welcome to {{companyName}}",
      title: "Welcome {{firstName}} ✨",
      body: "Thanks for joining {{companyName}}. Let’s get you glowing.",
      ctaLabel: "Visit Store",
      ctaUrl: "{{siteUrl}}",
    }),
    placeholderKeys: ["firstName", "companyName", "siteUrl", "supportEmail"],
  },
  {
    key: "order_confirmation",
    name: "Order Confirmation",
    category: "ORDER",
    subject: "Order #{{orderNumber}} confirmed",
    htmlBody: brandedEmailShell({
      preheader: "Order #{{orderNumber}} confirmed",
      title: "Order #{{orderNumber}} confirmed",
      body: "Hi {{firstName}}, we received your order placed on {{orderDate}}.<br/><br/><strong>Items:</strong> {{orderItems}}<br/><strong>Total:</strong> {{orderTotal}}",
      ctaLabel: "View Order",
      ctaUrl: "{{siteUrl}}/account",
    }),
    placeholderKeys: ["firstName", "orderNumber", "orderDate", "orderItems", "orderTotal", "siteUrl", "companyName", "supportEmail"],
  },
  {
    key: "payment_confirmation",
    name: "Payment Confirmation",
    category: "PAYMENT",
    subject: "Payment received for order #{{orderNumber}}",
    htmlBody: brandedEmailShell({
      preheader: "Payment received for order #{{orderNumber}}",
      title: "Payment received ✅",
      body: "We received your payment of {{amount}} for order <strong>#{{orderNumber}}</strong>.",
      ctaLabel: "View Order",
      ctaUrl: "{{siteUrl}}/account",
    }),
    placeholderKeys: ["orderNumber", "amount", "siteUrl", "companyName", "supportEmail"],
  },
  {
    key: "shipping_confirmation",
    name: "Shipping Confirmation",
    category: "SHIPPING",
    subject: "Your order #{{orderNumber}} has shipped",
    htmlBody: brandedEmailShell({
      preheader: "Your order is on the way",
      title: "Your order has shipped 🚚",
      body: "Order <strong>#{{orderNumber}}</strong> shipped via {{carrier}}.<br/>Tracking number: {{trackingNumber}}",
      ctaLabel: "Track Package",
      ctaUrl: "{{trackingUrl}}",
    }),
    placeholderKeys: ["orderNumber", "carrier", "trackingNumber", "trackingUrl", "companyName", "supportEmail", "siteUrl"],
  },
  {
    key: "order_shipped",
    name: "Order Shipped",
    category: "SHIPPING",
    subject: "Order #{{orderNumber}} has shipped",
    htmlBody: brandedEmailShell({
      preheader: "Your order is on the way",
      title: "Order #{{orderNumber}} shipped",
      body: "Tracking number: {{trackingNumber}}",
      ctaLabel: "Track Package",
      ctaUrl: "{{trackingUrl}}",
    }),
    placeholderKeys: ["orderNumber", "trackingNumber", "trackingUrl"],
  },
  {
    key: "order_delivered",
    name: "Order Delivered",
    category: "SHIPPING",
    subject: "Order #{{orderNumber}} delivered",
    htmlBody: brandedEmailShell({
      preheader: "Delivered successfully",
      title: "Delivered 💖",
      body: "Order #{{orderNumber}} was delivered. Thanks for shopping with {{companyName}}.",
      ctaLabel: "Shop Again",
      ctaUrl: "{{siteUrl}}/shop",
    }),
    placeholderKeys: ["orderNumber", "companyName", "siteUrl", "supportEmail"],
  },
  {
    key: "password_reset",
    name: "Password Reset",
    category: "SECURITY",
    subject: "Reset your password",
    htmlBody: brandedEmailShell({
      preheader: "Password reset request",
      title: "Reset your password",
      body: "We received a password reset request. If this was you, continue below.",
      ctaLabel: "Reset Password",
      ctaUrl: "{{resetUrl}}",
    }),
    placeholderKeys: ["resetUrl", "companyName", "supportEmail", "siteUrl"],
  },
  {
    key: "email_verification",
    name: "Email Verification",
    category: "SECURITY",
    subject: "Verify your email",
    htmlBody: brandedEmailShell({
      preheader: "Verify your email",
      title: "Confirm your email",
      body: "Hi {{firstName}}, please verify your email to secure your account.",
      ctaLabel: "Verify Email",
      ctaUrl: "{{verificationUrl}}",
    }),
    placeholderKeys: ["firstName", "verificationUrl", "companyName", "supportEmail", "siteUrl"],
  },
  {
    key: "refund_cancellation",
    name: "Refund / Cancellation",
    category: "PAYMENT",
    subject: "Update for order #{{orderNumber}}",
    htmlBody: brandedEmailShell({
      preheader: "Order update",
      title: "Order #{{orderNumber}} update",
      body: "Your order was {{eventType}}. Amount: {{amount}}.",
    }),
    placeholderKeys: ["orderNumber", "eventType", "amount", "companyName", "supportEmail", "siteUrl"],
  },
  {
    key: "abandoned_cart_reminder",
    name: "Abandoned Cart Reminder",
    category: "MARKETING",
    subject: "You left something behind, {{firstName}}",
    htmlBody: brandedEmailShell({
      preheader: "Your cart is waiting",
      title: "Still thinking it over?",
      body: "Hi {{firstName}}, your cart is still waiting for you.",
      ctaLabel: "Return to Checkout",
      ctaUrl: "{{checkoutUrl}}",
    }),
    placeholderKeys: ["firstName", "checkoutUrl", "companyName", "supportEmail", "siteUrl"],
  },
  {
    key: "contact_notification",
    name: "Contact Notification",
    category: "SUPPORT",
    subject: "New contact inquiry from {{name}}",
    htmlBody: brandedEmailShell({
      preheader: "New contact inquiry",
      title: "New contact inquiry",
      body: "<strong>From:</strong> {{name}} ({{email}})<br/><br/>{{message}}",
    }),
    placeholderKeys: ["name", "email", "message", "companyName", "supportEmail", "siteUrl"],
  },
  {
    key: "contact_form_notification",
    name: "Contact Form Notification",
    category: "SUPPORT",
    subject: "New contact form submission from {{customerName}}",
    htmlBody: brandedEmailShell({
      preheader: "New contact form message",
      title: "Contact form submission",
      body: "<strong>From:</strong> {{customerName}}<br/><br/>{{message}}",
    }),
    placeholderKeys: ["customerName", "supportEmail", "message", "companyName", "siteUrl"],
  },
  {
    key: "admin_new_order_notification",
    name: "Admin New Order Notification",
    category: "SYSTEM",
    subject: "New order placed: #{{orderNumber}}",
    htmlBody: brandedEmailShell({
      preheader: "New order alert",
      title: "New order #{{orderNumber}}",
      body: "Placed on {{orderDate}} with total {{orderTotal}}.",
    }),
    placeholderKeys: ["orderNumber", "orderDate", "orderTotal", "companyName", "supportEmail", "siteUrl"],
  },
  {
    key: "pudo_tracking_update",
    name: "PUDO Tracking Update",
    category: "SHIPPING",
    subject: "Shipment update for order #{{orderNumber}}",
    htmlBody: brandedEmailShell({
      preheader: "{{trackingStatusLabel}} — order #{{orderNumber}}",
      title: "{{trackingStatusLabel}}",
      body: "Hi {{firstName}},<br/><br/>Your order <strong>#{{orderNumber}}</strong> has a new shipping update: <strong>{{trackingStatusLabel}}</strong>.<br/><br/>Waybill: <strong>{{waybillNumber}}</strong>",
      ctaLabel: "View Order",
      ctaUrl: "{{orderUrl}}",
    }),
    placeholderKeys: ["firstName", "orderNumber", "trackingStatusLabel", "waybillNumber", "orderUrl", "companyName", "supportEmail", "siteUrl"],
  },
  {
    key: "newsletter_signup_confirmation",
    name: "Newsletter Signup Confirmation",
    category: "MARKETING",
    subject: "You're subscribed to {{companyName}} updates",
    htmlBody: brandedEmailShell({
      preheader: "Subscription confirmed",
      title: "You’re subscribed 🎉",
      body: "Thanks {{firstName}} for subscribing to {{companyName}} news and updates.",
      ctaLabel: "Explore Products",
      ctaUrl: "{{siteUrl}}/shop",
    }),
    placeholderKeys: ["firstName", "companyName", "siteUrl", "supportEmail"],
  },
];
