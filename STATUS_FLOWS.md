# Dear Body — Status Flow Diagrams

## 1. Order Lifecycle (status + paymentStatus + fulfillmentStatus)

```mermaid
flowchart TD
    subgraph CUSTOMER ["🛒 Customer Journey"]
        CART_ACTIVE["CartStatus: ACTIVE"]
        CART_CHECKED_OUT["CartStatus: CHECKED_OUT"]
        CART_ABANDONED["CartStatus: ABANDONED"]
    end

    subgraph ORDER_STATUS ["📦 Order Status"]
        OS_AWAIT["AWAITING_PAYMENT"]
        OS_PROC["PROCESSING"]
        OS_PICK["PICKED"]
        OS_PACK["PACKING"]
        OS_PACKED["PACKED"]
        OS_SHIPPED["SHIPPED"]
        OS_DELIVERED["DELIVERED"]
        OS_RFC["READY_FOR_COLLECTION"]
        OS_CANCELLED["CANCELLED"]
        OS_FAILED["PAYMENT_FAILED"]
    end

    subgraph PAYMENT_STATUS ["💳 Payment Status"]
        PS_AWAIT["AWAITING_PAYMENT"]
        PS_PAID["PAID"]
        PS_FAILED["FAILED"]
        PS_CANCELLED["CANCELLED"]
        PS_REFUND_DUE["REFUND_DUE"]
    end

    subgraph FULFILLMENT_STATUS ["🚚 Fulfillment Status"]
        FS_UNFULFILLED["UNFULFILLED"]
        FS_PACKED["PACKED"]
        FS_PARTIAL["PARTIALLY_FULFILLED"]
        FS_FULFILLED["FULFILLED"]
        FS_RETURNED["RETURNED"]
        FS_CANCELLED["CANCELLED"]
    end

    CART_ACTIVE -->|"checkout()"| CART_CHECKED_OUT
    CART_ACTIVE -->|"danger zone delete"| CART_ABANDONED
    CART_ABANDONED -->|"touch/recover"| CART_ACTIVE

    CART_CHECKED_OUT -->|"Order created"| OS_AWAIT
    CART_CHECKED_OUT -->|"Order created"| PS_AWAIT
    CART_CHECKED_OUT -->|"Order created"| FS_UNFULFILLED

    %% Payment gateway callbacks
    PS_AWAIT -->|"webhook: PAID\napplyPaymentStatus()"| PS_PAID
    PS_AWAIT -->|"webhook: FAILED\napplyPaymentStatus()"| PS_FAILED
    OS_AWAIT -->|"webhook: PAID"| OS_PROC
    OS_AWAIT -->|"webhook: FAILED"| OS_FAILED

    %% Payment drives downstream
    PS_PAID -->|"✉ order_confirmation email\n✉ payment_success email\n→ initWarehouseOnPayment()\n→ autoCreatePudoShipment()"| OS_PROC

    %% Manual admin transitions
    OS_PROC -->|"admin update"| OS_PICK
    OS_PICK -->|"admin update"| OS_PACK
    OS_PACK -->|"admin update"| OS_PACKED
    OS_PACKED -->|"admin update"| OS_SHIPPED
    OS_SHIPPED -->|"PUDO webhook/sync\nor admin update"| OS_DELIVERED

    OS_PACKED -->|"admin update\n✉ ready_for_collection email"| OS_RFC

    %% Fulfillment transitions
    FS_UNFULFILLED -->|"admin update\n✉ shipping_confirmation email"| FS_PARTIAL
    FS_UNFULFILLED -->|"admin update\n✉ shipping_confirmation email"| FS_FULFILLED
    FS_UNFULFILLED -->|"PUDO webhook: return_to_sender"| FS_RETURNED
    FS_PARTIAL -->|"admin update"| FS_FULFILLED

    FS_PACKED -->|"warehouse collection + PACKED\n✉ warehouse_collection_ready email"| FS_FULFILLED

    %% Cancellation
    OS_AWAIT -->|"cancelOrder()\n[unpaid]"| OS_CANCELLED
    OS_PROC -->|"cancelOrder()\n[paid → REFUND_DUE]"| OS_CANCELLED
    OS_AWAIT -->|"cancelOrder()\n[unpaid]"| PS_CANCELLED
    OS_PROC -->|"cancelOrder()\n[paid]"| PS_REFUND_DUE
    OS_CANCELLED -->|"fulfillment"| FS_CANCELLED

    %% Refund
    PS_REFUND_DUE -->|"createRefund()\n✉ refund_cancellation email"| PS_PAID
    PS_REFUND_DUE -->|"createRefund() full refund\n→ order.status: CANCELLED"| PS_FAILED
```

---

## 2. Warehouse / Pick-Pack Flow (warehouseStatus)

```mermaid
flowchart TD
    subgraph WAREHOUSE ["🏭 Warehouse Status"]
        WS_PEND["PENDING_PICK"]
        WS_PICK["PICKING"]
        WS_PICKED["PICKED"]
        WS_PACK["PACKING"]
        WS_PACKED["PACKED"]
        WS_AWAIT_COL["AWAITING_COLLECTION"]
        WS_EXCEPTION["EXCEPTION"]
    end

    subgraph PICK_ITEM ["📋 Pick Item Status"]
        PI_PENDING["PENDING"]
        PI_PICKED["PICKED"]
        PI_ISSUE["ISSUE"]
    end

    subgraph STOCK_ISSUE ["⚠️ Stock Issue Status"]
        SI_NONE["NONE"]
        SI_PARTIAL["PARTIAL_STOCK"]
        SI_OUT["OUT_OF_STOCK"]
        SI_DAMAGED["DAMAGED"]
    end

    PAYMENT_PAID["paymentStatus: PAID"] -->|"initWarehouseOnPayment()\n✉ notify warehouse staff\n→ create PickTaskItems: PENDING"| WS_PEND

    WS_PEND -->|"startPicking(actorId)"| WS_PICK
    WS_EXCEPTION -->|"startPicking(actorId)"| WS_PICK

    WS_PICK -->|"updatePickItem() × N items"| PI_PENDING
    PI_PENDING -->|"item picked OK"| PI_PICKED
    PI_PENDING -->|"item has issue"| PI_ISSUE

    PI_ISSUE -->|"issueType set"| SI_PARTIAL
    PI_ISSUE -->|"issueType set"| SI_OUT
    PI_ISSUE -->|"issueType set"| SI_DAMAGED
    PI_PICKED -->|"all issues resolved"| SI_NONE

    WS_PICK -->|"completePicking()\nall items done"| WS_PICKED
    WS_PICKED -->|"completePicking() WITH issues\n✉ notifyAdminStockIssue()"| WS_PICKED

    WS_PICKED -->|"startPacking(actorId)"| WS_PACK
    WS_PACK -->|"completePacking()"| WS_PACKED

    WS_PACKED -->|"markAwaitingCollection()"| WS_AWAIT_COL

    WS_PICK -->|"flagWarehouseException()"| WS_EXCEPTION
    WS_PICKED -->|"flagWarehouseException()"| WS_EXCEPTION
    WS_PACK -->|"flagWarehouseException()"| WS_EXCEPTION
```

---

## 3. PUDO Delivery Flow

```mermaid
flowchart TD
    PAY_PAID["paymentStatus: PAID"] -->|"autoCreatePudoShipment()\nif pudoDeliveryType set"| PUDO_CREATED

    PUDO_CREATED["PUDO Shipment Created\n→ order.trackingNumber set\n→ order.courier = 'PUDO - The Courier Guy'\n✉ shipping_confirmation email"] -->|"cron: syncPudoTrackingStatuses()\nor PUDO webhook"| PUDO_TRACKING

    subgraph PUDO_TRACKING ["📍 PUDO Tracking Status → Internal Mapping"]
        P1["collected\nin_transit\nout_for_delivery\nfailed_delivery"] -->|"→ order.status: SHIPPED\n✉ tracking update email"| OS_SHIPPED["OrderStatus: SHIPPED"]
        P2["ready_for_collection"] -->|"→ order.status: SHIPPED\n✉ tracking update email"| OS_SHIPPED
        P3["delivered"] -->|"→ order.status: DELIVERED\n→ fulfillmentStatus: FULFILLED\n→ deliveredAt: now\n✉ tracking update email"| OS_DELIVERED["OrderStatus: DELIVERED"]
        P4["return_to_sender"] -->|"→ fulfillmentStatus: RETURNED\n✉ tracking update email"| FS_RETURNED["FulfillmentStatus: RETURNED"]
    end
```

---

## 4. Refund Flow

```mermaid
flowchart TD
    subgraph REFUND_STATUS ["💸 Refund Status"]
        RS_REQ["REQUESTED"]
        RS_APP["APPROVED"]
        RS_REJ["REJECTED"]
        RS_PROC["PROCESSED"]
    end

    ADMIN["Admin creates refund\ncreateRefund()"] -->|"refund.status set directly"| RS_PROC

    RS_PROC -->|"partialRefund\n(refunded < order total)"| PAY_PAID["paymentStatus: PAID\n(remains)"]
    RS_PROC -->|"fullRefund\n(refunded >= order total)\n✉ refund_cancellation email"| ORDER_CANCELLED["order.status: CANCELLED\npaymentStatus: FAILED\nrefundedAt: now"]

    NOTE["⚠️ Note: REQUESTED → APPROVED → REJECTED\nstates exist in schema but are NOT\ncurrently used in service logic.\nRefunds go straight to PROCESSED."]
```

---

## 5. Email Triggers Summary

```mermaid
flowchart LR
    subgraph EMAILS ["✉️ Email Triggers"]
        E1["order_confirmation\n+ admin_new_order_notification"] 
        E2["payment_success"]
        E3["ready_for_collection"]
        E4["shipping_confirmation\n(standard courier)"]
        E5["warehouse_collection_ready\n(warehouse pickup)"]
        E6["refund_cancellation"]
        E7["PUDO shipping_confirmation"]
        E8["PUDO tracking update\n(per status change)"]
        E9["warehouse staff: new order"]
        E10["admin: stock issue"]
        E11["warehouse staff: SLA warning"]
    end

    PAY_PAID["paymentStatus → PAID"] --> E1
    PAY_PAID --> E2
    PAY_PAID --> E7
    PAY_PAID --> E9

    OS_RFC["status → READY_FOR_COLLECTION"] --> E3

    FS_SHIP["fulfillmentStatus → FULFILLED\nor PARTIALLY_FULFILLED\n(non-warehouse collection)"] --> E4
    FS_WAR["fulfillmentStatus → PACKED\n(warehouse collection order)"] --> E5

    REFUND["refund created (full)"] --> E6

    PUDO_WEBHOOK["PUDO webhook/sync\n(status changed)"] --> E8

    PICK_DONE["completePicking()\nwith stock issues"] --> E10

    SLA["slaDeadline approaching"] --> E11
```

---

## Known Gaps / Potential Bugs

| Issue | Detail |
|---|---|
| **Refund states unused** | `REQUESTED`, `APPROVED`, `REJECTED` exist in schema but refunds go straight to `PROCESSED` — no approval workflow implemented |
| **PUDO shipment timing** | `autoCreatePudoShipment()` is called async and can silently fail — order status won't reflect failure |
| **Warehouse init async** | `initWarehouseOnPayment()` is also fire-and-forget — if it fails, `warehouseStatus` never gets set |
| **No guard on manual status updates** | Admin `updateOrderStatus()` / `updatePaymentStatus()` / `updateFulfillmentStatus()` accept arbitrary values with no valid-transition validation |
| **PUDO tracking vs fulfillmentStatus** | PUDO sync sets `order.status = SHIPPED` but doesn't always update `fulfillmentStatus` — they can drift |
| **ready_for_collection PUDO → SHIPPED** | PUDO `ready_for_collection` maps to `OrderStatus: SHIPPED` which is misleading for locker pickup orders |
