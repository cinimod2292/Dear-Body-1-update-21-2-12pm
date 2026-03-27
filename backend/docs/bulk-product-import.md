# Bulk Product Upload (Admin)

## 1) Overview

The **Bulk Upload** feature lets admins create or update products in one CSV import.

- Access path: **Admin → Products → Bulk Upload**
- File type: **CSV only (v1)**
- Import mode: **Upsert by SKU**
  - Existing SKU → update
  - New SKU → create

---

## 2) How It Works

1. Download the CSV template from the Bulk Upload modal.
2. Fill in product rows in the template.
3. Upload the CSV file.
4. Review the **Preview** results.
5. Import once preview is valid.

### Important
- Preview runs validation before writing any data.
- If preview shows errors, fix the CSV and upload again.
- Import is disabled when preview contains fatal row errors.

---

## 3) CSV Template Format

### Required columns
- `sku`
- `product_name`
- `price`

### Optional columns
- `sale_price`
- `cost_price`
- `barcode`
- `brand_name`
- `parent_category_name`
- `category_name`
- `quantity_on_hand`
- `description`
- `short_description`
- `status` (`DRAFT` | `ACTIVE` | `ARCHIVED`)
- `visibility` (`PUBLIC` | `HIDDEN` | `PRIVATE`)
- `featured` (`true`/`false`)

### Format rules
- Use **snake_case** headers exactly.
- Unknown columns are ignored.
- Values are trimmed automatically.

### Template download options
- **Full template**: includes required + common optional columns.
- **Simple template**: `sku,product_name,price,brand_name,parent_category_name,category_name,quantity_on_hand,description,status,visibility,featured`

---

## 4) Behavior Rules

### SKU
- SKU is the unique identifier for import.
- Existing SKU = update product + variant.
- New SKU = create product + variant.

### Slug
- Slug is generated from `product_name` during import.
- Duplicate slugs are handled automatically (for example: `slug`, `slug-2`, `slug-3`).

### Category and Brand
- Matching is by name (case-insensitive, trimmed).
- If not found, category/brand is auto-created.
- If `parent_category_name` is provided, `category_name` is resolved under that parent.
- If `parent_category_name` is blank, `category_name` is treated as a top-level category.
- If a child category name exists under a different parent, that row fails with an error to prevent incorrect assignment.

### Inventory
- `quantity_on_hand` overwrites current quantity for that SKU.

### Variants
- **v1 limitation:** one row = one product + one variant.

### Images
- **Not supported in CSV import (v1).**

---

## 5) Validation Rules

### Required fields
- `sku`
- `product_name`
- `price`

### Numeric validation
- `price` must be `>= 0`
- `quantity_on_hand` must be an integer (if provided)

### Duplicate handling
- Duplicate SKUs in the same CSV are rejected in preview.

### Enum validation
- `status` must be one of: `DRAFT`, `ACTIVE`, `ARCHIVED`
- `visibility` must be one of: `PUBLIC`, `HIDDEN`, `PRIVATE`

### Preview enforcement
- Errors are shown per row in preview.
- Errors must be fixed before import.

---

## 6) Limitations (Important)

- CSV only (no Excel/XLSX yet)
- No multi-variant products in one import
- No image upload/import in CSV
- No attribute matrix support

---

## 7) Example Row

```csv
sku,product_name,price,brand_name,category_name,quantity_on_hand
DB-SERUM-001,Vitamin C Serum,29.99,Dear Body,Serums,100
```

---

## 8) Troubleshooting

- **“SKU already exists”**
  - Expected behavior: that row updates existing product/variant.

- **“Import disabled”**
  - Fix all preview errors first.

- **“Duplicate SKU”**
  - Remove or merge duplicate rows in the same CSV file.

- **“Invalid enum”**
  - Check `status` and `visibility` values match allowed options exactly.
