# Dear Body — Admin Handover Guide

> **For the store owner and team.** This guide covers everything you need to get the store live and keep it running day-to-day. No technical background required.

---

## Table of Contents

1. [Before You Go Live — Launch Checklist](#1-before-you-go-live--launch-checklist)
2. [Logging In to the Admin Panel](#2-logging-in-to-the-admin-panel)
3. [Adding and Editing Products](#3-adding-and-editing-products)
4. [Managing Orders](#4-managing-orders)
5. [Managing Customers](#5-managing-customers)
6. [Configuring Shipping Methods](#6-configuring-shipping-methods)
7. [Setting Up Payments (PayFast / Stitch)](#7-setting-up-payments-payfast--stitch)
8. [Setting Up Email Notifications](#8-setting-up-email-notifications)
9. [Discount and Promo Codes](#9-discount-and-promo-codes)
10. [Managing Site Content (CMS)](#10-managing-site-content-cms)
11. [Uploading Images (Media Library)](#11-uploading-images-media-library)
12. [Customer Password Resets](#12-customer-password-resets)
13. [Common Questions and Troubleshooting](#13-common-questions-and-troubleshooting)

---

## 1. Before You Go Live — Launch Checklist

Complete every item below before accepting your first real order.

### Payments
- [ ] Log in to the admin panel and go to **Settings → Payments**
- [ ] Enter your **PayFast** or **Stitch** credentials (see Section 7)
- [ ] Test a payment end-to-end in sandbox mode using a test card
- [ ] Switch the gateway from **Sandbox** to **Live** mode only after a successful test

### Shipping
- [ ] Go to **Shipping Methods** in the admin
- [ ] Add at least one shipping method with a name and price (e.g. "Standard Delivery — R99")
- [ ] Add a free-shipping threshold if you want to offer it (e.g. "Free over R500")
- [ ] Without at least one shipping method, customers cannot complete checkout

### Email Notifications
- [ ] Go to **Settings → Email** and enter your SendGrid API key (see Section 8)
- [ ] Send a test email to yourself to confirm it arrives
- [ ] Without this configured, customers will not receive order confirmations

### Products
- [ ] Ensure every product has at least one active variant with a price and stock quantity set above 0
- [ ] Products with zero stock will show "Unavailable" to customers and cannot be added to cart
- [ ] Add product images (at least one per product — see Section 11)

### Store Content
- [ ] Go to **Settings** and update the store name
- [ ] Go to **CMS** and update the announcement bar text (the pink strip at the top of the store)
- [ ] Update the footer contact email, phone, and address to your real business details
- [ ] Review the About, Contact, Shipping, Returns, and Privacy Policy pages

### Final Check
- [ ] Browse the live store as a customer on both a phone and a desktop
- [ ] Add a product to cart, go to checkout, and confirm prices and shipping display correctly
- [ ] Complete a test order in sandbox mode end-to-end

---

## 2. Logging In to the Admin Panel

Go to: `https://yoursite.com/admin`

Enter the email address and password that were provided to you by your developer. If you do not have login credentials, contact your developer — there is no public registration for admin accounts.

**If you are locked out:** Contact your developer. Admin passwords can be reset via the server directly.

**Session:** You will be logged out automatically after 4 hours of inactivity for security. This is normal.

---

## 3. Adding and Editing Products

### To add a new product

1. In the admin sidebar, click **Products**
2. Click **Add Product** (top right)
3. Fill in the product details:

| Field | Required | Notes |
|---|---|---|
| **Name** | Yes | The product title shown in the store |
| **Status** | Yes | Set to **Active** for the product to appear in the store. Draft products are hidden. |
| **Category** | Yes | Customers use this to filter. Set up categories first under **Catalog Setup**. |
| **Short Description** | No | Used for the product tagline, ingredients, size, and how-to-use. See note below. |
| **Description** | No | The full product description shown on the product detail page. |
| **Featured** | No | Tick this to give the product a "Bestseller" badge in the store. |

> **Important — Short Description format:** The short description field stores product metadata in a specific format. Do not type free text here — contact your developer to update it or it will break the product detail page. Instead, use the regular **Description** field for any custom text you want customers to see.

### Variants and pricing

Every product needs at least one **variant** with a price set. A variant is a version of the product (e.g. different size or scent). If your product comes in only one option, add one variant with no label.

For each variant:
- Set a **Price** (the selling price in Rands)
- Set a **Stock quantity** — this is the number of units available. Set it to 0 to mark an item as out of stock.
- Optionally set a **Sale Price** (lower than the regular price) to show a crossed-out original price in the store.

### To edit an existing product

1. Click **Products** in the sidebar
2. Find the product in the list (use the search bar)
3. Click the product name or the edit button
4. Make your changes and click **Save**

### To archive/hide a product

1. Open the product
2. Change **Status** to **Archived**
3. Save — the product disappears from the store immediately

---

## 4. Managing Orders

### Viewing orders

Click **Orders** in the admin sidebar. You will see a list of all orders with their status, customer, and total amount.

Order statuses you will see:

| Status | Meaning |
|---|---|
| **Pending** | Order created, payment not yet confirmed |
| **Processing** | Payment received, order being prepared |
| **Fulfilled** | Order shipped or dispatched |
| **Cancelled** | Order cancelled |

Payment statuses:

| Status | Meaning |
|---|---|
| **Awaiting Payment** | Customer initiated checkout but has not paid yet |
| **Paid** | Payment confirmed by the payment gateway |
| **Failed** | Payment declined or not completed |
| **Refunded** | Payment returned to customer |

### Processing an order

1. Click on an order to open it
2. Review the items, shipping address, and payment status
3. Once you have packed and dispatched the order, update the status to **Fulfilled**
4. Optionally enter a tracking number and courier name

### Cancelling an order

1. Open the order
2. Click **Cancel Order**
3. If the customer has paid, you will need to process a refund separately (see below)

### Processing a refund

1. Open the order
2. Click **Refund**
3. Enter the amount to refund
4. The refund is processed via the original payment gateway

> **Note:** Refunds are processed through PayFast or Stitch. Allow 3–7 business days for the refund to appear in the customer's account, depending on their bank.

---

## 5. Managing Customers

### Finding a customer

1. Click **Customers** in the admin sidebar
2. Use the search bar to find by name or email
3. Click the customer to view their profile, order history, and contact details

### Adding a note to a customer

1. Open the customer profile
2. Scroll to the **Notes** section
3. Add a note (e.g. "VIP customer — always ships to Cape Town office")
4. Notes are internal and not visible to the customer

### Blocking a customer

1. Open the customer profile
2. Change **Status** to **Blocked**
3. The customer will not be able to log in or place orders

---

## 6. Configuring Shipping Methods

At least one shipping method must exist before customers can check out.

1. In the admin sidebar, click **Shipping Methods**
2. Click **Add Shipping Method**
3. Fill in:
   - **Name** — What the customer sees (e.g. "Standard Delivery", "Express Delivery")
   - **Price** — The shipping cost in Rands (enter `0` for free shipping)
   - **Description** — Optional. Shown to the customer at checkout (e.g. "3–5 business days")
4. Save

You can add multiple shipping methods (e.g. Standard and Express). The customer chooses one at checkout.

### Free shipping threshold

To offer free shipping above a certain order total:

1. Go to **Operations** in the admin sidebar
2. Find the **Free Shipping** settings
3. Enter the minimum order total (e.g. `500` for free shipping on orders over R500)
4. Enable the setting

---

## 7. Setting Up Payments (PayFast / Stitch)

### PayFast setup

You need a PayFast merchant account. Sign up at [payfast.co.za](https://www.payfast.co.za).

1. Go to **Settings → Payments → PayFast** in the admin
2. Choose **Sandbox** mode for testing or **Live** mode for real payments
3. Enter:
   - **Merchant ID** — Found in your PayFast dashboard
   - **Merchant Key** — Found in your PayFast dashboard
   - **Passphrase** — Set in your PayFast dashboard under Integration Settings
4. The **Return URL**, **Cancel URL**, and **Notify URL** are pre-filled automatically
5. Enable PayFast and save
6. **Important:** In your PayFast dashboard, make sure the Notify URL (also called ITN URL) matches exactly what is shown in the admin settings

### Stitch setup

You need a Stitch account. Contact Stitch at [stitch.money](https://stitch.money) to get credentials.

1. Go to **Settings → Payments → Stitch** in the admin
2. Enter your **Merchant ID** and **API Key**
3. Enable Stitch and save

### Switching between gateways

Both PayFast and Stitch can be enabled simultaneously. The customer will see both options at checkout, or you can set one as the default. Only enable the gateways you intend to use.

---

## 8. Setting Up Email Notifications

Without email configured, customers will not receive order confirmations, shipping notifications, or password reset emails.

### Using SendGrid (recommended)

1. Create a free account at [sendgrid.com](https://sendgrid.com)
2. Go to **Settings → API Keys** in SendGrid and create a new API key with "Mail Send" permission
3. In the Dear Body admin, go to **Settings → Email → SendGrid**
4. Paste the API key
5. Enter your **From Email** (the address your customers will see emails come from — must be verified in SendGrid)
6. Enter your **From Name** (e.g. "Dear Body")
7. Enable SendGrid and save
8. Send a test email to yourself to confirm everything works

### Customising email templates

1. Go to **Email Templates** in the admin sidebar
2. Click any template to edit it (e.g. "Order Confirmation", "Password Reset")
3. Edit the subject line and body text
4. Click **Preview** to see how it looks before saving
5. Click **Send Test** to receive a sample email

Do not remove `{{placeholder}}` tags — these are replaced automatically with real order data.

---

## 9. Discount and Promo Codes

### Creating a discount code

1. Go to **Operations** in the admin sidebar
2. Click **Coupons / Discounts**
3. Click **Add Coupon**
4. Fill in:
   - **Code** — What the customer types at checkout (e.g. `LAUNCH20`)
   - **Discount type** — Percentage (e.g. 20% off) or Fixed amount (e.g. R50 off)
   - **Discount value** — The percentage or Rand amount
   - **Minimum order** — Optional. Customer must spend at least this amount to use the code.
   - **Usage limit** — Optional. How many times the code can be used in total.
   - **Expiry date** — Optional. After this date the code no longer works.
5. Save

Customers enter the code in the cart before checkout.

### Checking code usage

1. Open the coupon in the **Operations → Coupons** list
2. The usage count shows how many times it has been used

---

## 10. Managing Site Content (CMS)

### Announcement bar

The pink announcement bar at the top of every page is the first thing visitors see.

1. Go to **Settings** in the admin
2. Find **Site / Header** settings
3. Update the **Announcement Text** (e.g. "🎁 Free shipping on orders over R500!")
4. Save — the change takes effect immediately

### Navigation menu

To add, remove, or reorder navigation links:

1. Go to **CMS** in the admin sidebar
2. Find the **Navigation** section
3. Add or edit menu items

### Static pages

The About, Contact, Shipping, Returns, Privacy Policy, and Terms pages are managed under **CMS → Pages**. Click any page to edit its content.

### Home page hero and featured products

1. Go to **Builder → Home** in the admin
2. Here you can update the hero image, headline, and which products appear in the featured section

---

## 11. Uploading Images (Media Library)

### Uploading a new image

1. Click **Media** in the admin sidebar
2. Click **Upload** and select your image files
3. Images are processed automatically (thumbnails are created)
4. Wait for the status to show **Ready** before using the image in a product

### Attaching an image to a product

1. Open the product
2. Scroll to the **Gallery** section
3. Click **Add Image** and select from the media library
4. The first image in the gallery is the main product image
5. Drag to reorder

### Setting a hover image

A hover image is the second image that appears when a customer moves their mouse over a product card.

1. Open the product
2. In the **Gallery** section, find the image you want to use as the hover image
3. Click the **Set as Hover Image** option

### Recommended image specifications

| Use | Size | Format |
|---|---|---|
| Product images | 800×800 px minimum | JPEG or WebP |
| Hero/banner images | 1920×800 px | JPEG or WebP |
| Logo | 400×200 px | PNG (transparent background) |

---

## 12. Customer Password Resets

Customers can now reset their own passwords via the **Forgot Password?** link on the sign-in page. The process is:

1. Customer clicks **Forgot Password?** on the login page
2. They enter their email address
3. They receive an email with a reset link (valid for 60 minutes)
4. They click the link and set a new password

**If a customer says they did not receive the email:**
- Ask them to check their spam/junk folder
- Confirm you have email notifications configured (Section 8)
- The reset link is only sent if an account with that email exists

**If a customer needs an immediate reset** and cannot wait for email:
- Go to **Customers** in the admin
- Find the customer
- Contact your developer to reset the password manually via the server

---

## 13. Common Questions and Troubleshooting

### "A customer says they can't check out"

1. Check that at least one **Shipping Method** is active (Section 6)
2. Check that a **Payment Gateway** is enabled and in the correct mode (Section 7)
3. Check that the product they want is marked as **Active** with a stock quantity above 0
4. Ask the customer what error message they see

### "Orders are coming in but customers aren't getting confirmation emails"

1. Go to **Settings → Email** and confirm SendGrid is enabled with a valid API key
2. Check that the **From Email** address is verified in SendGrid
3. SendGrid has a free tier of 100 emails/day — confirm you haven't exceeded it
4. Check the **Notification Logs** (if available) for failed emails

### "A payment was made but the order shows 'Awaiting Payment'"

This usually means the payment gateway webhook did not reach the server. This can happen if:
- The server was restarted at the moment of payment
- The webhook URL in PayFast/Stitch is incorrect

To fix:
1. Log in to your PayFast or Stitch dashboard
2. Find the transaction and manually trigger a webhook resend
3. If the order still doesn't update, contact your developer

### "A product shows 0 stock but I have stock available"

1. Go to the product in the admin
2. Open the variant
3. Update the **Quantity on Hand** to the correct amount
4. Save — the product will immediately become purchasable again

### "I accidentally deleted a product / made a mistake"

Products are permanently deleted when removed. For this reason:
- Use **Archive** instead of Delete to hide a product without losing it
- If you have made changes you want to undo, contact your developer — changes to the database can sometimes be reversed if caught quickly

### "How do I give someone else admin access?"

Contact your developer. Admin accounts are created server-side and cannot be self-registered. Your developer will create the account and provide the login credentials.

---

*Guide version: June 2026. For technical support, contact your developer.*
