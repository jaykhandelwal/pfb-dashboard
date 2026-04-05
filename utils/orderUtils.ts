import { Order, OrderItem } from '../types';

const parseArrayValue = <T = any>(value: unknown): T[] => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const toFiniteNumber = (value: unknown, fallback = 0): number => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string' && value.trim() === '') return fallback;

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalFiniteNumber = (value: unknown): number | undefined => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeConsumed = (value: unknown): OrderItem['consumed'] => {
    const rawEntries = Array.isArray(value)
        ? value
        : value && typeof value === 'object'
            ? [value]
            : [];

    const normalized = rawEntries
        .map((entry: any) => {
            const skuId = entry?.skuId ?? entry?.sku_id;
            if (!skuId) return null;

            return {
                skuId,
                quantity: toFiniteNumber(entry?.quantity)
            };
        })
        .filter((entry): entry is NonNullable<OrderItem['consumed']>[number] => entry !== null);

    return normalized.length > 0 ? normalized : null;
};

export const normalizeOrderItem = (item: any, index = 0): OrderItem => {
    const quantity = item?.quantity === undefined || item?.quantity === null
        ? 1
        : toFiniteNumber(item.quantity);

    const plate = item?.plate && typeof item.plate === 'object'
        ? {
            ...item.plate,
            price: toFiniteNumber(item.plate.price),
            quantity: toFiniteNumber(item.plate.quantity),
            skuId: item.plate.skuId ?? item.plate.sku_id
        }
        : undefined;

    return {
        ...item,
        id: item?.id ?? `item-${index}`,
        menuItemId: item?.menuItemId ?? item?.menu_item_id ?? item?.code_name ?? `item-${index}`,
        name: item?.name ?? 'Unnamed Item',
        price: toFiniteNumber(item?.price),
        quantity,
        variant: item?.variant === 'HALF' ? 'HALF' : 'FULL',
        consumed: normalizeConsumed(item?.consumed),
        tag: item?.tag,
        code_name: item?.code_name ?? item?.codeName,
        isModal: item?.isModal ?? item?.is_modal ?? false,
        plate
    };
};

export const getOrderItemLineTotal = (item: Partial<OrderItem>): number => {
    const price = toFiniteNumber(item.price);
    const quantity = item.quantity === undefined || item.quantity === null
        ? 1
        : toFiniteNumber(item.quantity);

    return price * quantity;
};

export const getOrderItemsSubtotal = (items: unknown): number => {
    return parseArrayValue(items).reduce((sum, item, index) => (
        sum + getOrderItemLineTotal(normalizeOrderItem(item, index))
    ), 0);
};

const normalizeCustomSkuItems = (value: unknown): Order['customSkuItems'] => {
    const items = parseArrayValue(value)
        .map((entry: any) => {
            const skuId = entry?.skuId ?? entry?.sku_id;
            if (!skuId) return null;

            return {
                skuId,
                quantity: toFiniteNumber(entry?.quantity)
            };
        })
        .filter((entry): entry is NonNullable<Order['customSkuItems']>[number] => entry !== null);

    return items.length > 0 ? items : undefined;
};

const normalizePaymentSplit = (value: unknown): Order['paymentSplit'] => {
    const splits = parseArrayValue(value)
        .map((entry: any) => {
            const method = entry?.method;
            if (method !== 'CASH' && method !== 'UPI' && method !== 'CARD') return null;

            return {
                method,
                amount: toFiniteNumber(entry?.amount)
            };
        })
        .filter((entry): entry is NonNullable<Order['paymentSplit']>[number] => entry !== null);

    return splits.length > 0 ? splits : undefined;
};

export const getOrderTotalAmount = (order: Partial<Order>): number => {
    const explicitTotal = toOptionalFiniteNumber(order.totalAmount);
    if (explicitTotal !== undefined) return explicitTotal;

    return getOrderItemsSubtotal(order.items) + toFiniteNumber(order.customAmount);
};

export const normalizeOrderRecord = (data: any): Order => {
    const items = parseArrayValue(data?.items).map((item, index) => normalizeOrderItem(item, index));
    const customAmount = toOptionalFiniteNumber(data?.custom_amount ?? data?.customAmount);
    const paymentSplit = normalizePaymentSplit(data?.payment_split ?? data?.paymentSplit);

    return {
        ...data,
        id: data?.id,
        branchId: data?.branch_id ?? data?.branchId,
        customerId: data?.customer_id ?? data?.customerId,
        customerName: data?.customer_name ?? data?.customerName,
        platform: data?.platform ?? 'POS',
        totalAmount: getOrderTotalAmount({
            totalAmount: data?.total_amount ?? data?.totalAmount,
            items,
            customAmount
        }),
        status: data?.status ?? 'COMPLETED',
        paymentMethod: (data?.payment_method ?? data?.paymentMethod ?? (paymentSplit ? 'SPLIT' : 'CASH')) as Order['paymentMethod'],
        paymentSplit,
        date: data?.date ?? '',
        timestamp: toFiniteNumber(data?.timestamp, Date.now()),
        items,
        customAmount,
        customAmountReason: data?.custom_amount_reason ?? data?.customAmountReason,
        customSkuItems: normalizeCustomSkuItems(data?.custom_sku_items ?? data?.customSkuItems),
        customSkuReason: data?.custom_sku_reason ?? data?.customSkuReason
    };
};
