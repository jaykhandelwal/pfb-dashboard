
import { MenuItem, OrderItem, SKU, User } from "../types";

export interface WebhookItem {
  id: string;
  name: string;
  code_name: string;
  tag: string;
  quantity: number;
  variant: string;
  price: number;
  isModal?: boolean;
  plate: {
    price: number;
    quantity: number;
    skuId?: string;
  };
  consumed?: {
    skuId: string;
    quantity: number;
  } | null;
}

export interface WebhookPayload {
  status: string;
  orderID: string;
  username: string;
  items: WebhookItem[];
  total_amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  custom_amount: { amount: string; reason: string } | null;
  custom_pieces: {
    reason: string;
    items: { skuId: string; quantity: number; category: string }[];
  } | null;
  payment_method: string;
  branch_id: string;
  customer_id: null; // Legacy field
  platform: string;
  created_at: string;
  date: string;
  timestamp: number;
}

export interface WebhookContext {
  orderId: string;
  orderDate: string;
  cart: OrderItem[];
  cartTotal: number;
  menuItems: MenuItem[];
  skus: SKU[];
  currentUser?: User | null;
  linkedCustomer?: { name: string; phone: string } | null;
  customAmount?: { amount: number; reason: string } | null;
  customSku?: { items: { skuId: string; qty: number }[]; reason: string } | null;
  paymentMethod: string;
  branchId: string;
  platform: string;
}

export const constructWebhookPayload = (context: WebhookContext): WebhookPayload => {
    const {
      orderId,
      orderDate,
      cart,
      cartTotal,
      menuItems,
      skus,
      currentUser,
      linkedCustomer,
      customAmount,
      customSku,
      paymentMethod,
      branchId,
      platform,
    } = context;

    // 1. Map Cart Items to Webhook Format
    const webhookItems: WebhookItem[] = cart.map((cartItem) => {
      const originalMenu = menuItems.find((m) => m.id === cartItem.menuItemId);
      
      let plateConfig: WebhookItem['plate'] = { price: 0, quantity: 0, skuId: '' };
      let consumedConfig: WebhookItem['consumed'] = null;

      if (originalMenu) {
        // Determine ingredients based on variant (HALF vs FULL)
        let ingredientsList = [];
        if (cartItem.variant === 'HALF') {
          if (originalMenu.halfIngredients && originalMenu.halfIngredients.length > 0) {
            ingredientsList = originalMenu.halfIngredients;
          } else {
            // Fallback 0.5x calculation
            ingredientsList = (originalMenu.ingredients || []).map((i) => ({
              ...i,
              quantity: i.quantity * 0.5,
            }));
          }
        } else {
          ingredientsList = originalMenu.ingredients || [];
        }

        // Construct Plate Info (Main Ingredient)
        if (ingredientsList.length > 0) {
          const mainIng = ingredientsList[0];
          // E.g. 8 for Steam, 6 for Kurkure (Full Plate Base Qty)
          const perPlateQty = mainIng.quantity; 
          
          plateConfig = {
            price: cartItem.price,
            quantity: perPlateQty,
            skuId: mainIng.skuId,
          };
          
          // Consumed Info (Total for this line item)
          consumedConfig = {
            skuId: mainIng.skuId,
            quantity: perPlateQty * cartItem.quantity,
          };
        }
      }

      return {
        id: cartItem.id,
        name: cartItem.name,
        code_name: originalMenu?.id || 'custom',
        tag: originalMenu?.category || 'Addons',
        quantity: cartItem.quantity,
        variant: cartItem.variant || 'FULL',
        price: cartItem.price,
        plate: plateConfig,
        consumed: consumedConfig,
      };
    });

    // 2. Inject Custom Amount as Pseudo-Item
    if (customAmount) {
      webhookItems.push({
        id: `temp-${Date.now()}-amt`,
        name: "Custom Amount",
        code_name: "custom_amount",
        tag: "Addons",
        quantity: 1,
        variant: "FULL",
        price: 0, // Logic dictates 0 price here, total handled in total_amount
        isModal: true,
        plate: { price: 0, quantity: 0 },
        consumed: null,
      });
    }

    // 3. Inject Custom Pieces as Pseudo-Item
    if (customSku) {
      webhookItems.push({
        id: `temp-${Date.now()}-pcs`,
        name: "Custom Pieces",
        code_name: "custom_pieces",
        tag: "Addons",
        quantity: 1,
        variant: "FULL",
        price: 0,
        isModal: true,
        plate: { price: 0, quantity: 0 },
        consumed: null,
      });
    }

    // 4. Construct Final Payload
    return {
      status: "completed",
      orderID: orderId,
      username: currentUser?.name || "Unknown",
      items: webhookItems,
      total_amount: cartTotal,
      customer_name: linkedCustomer?.name || null,
      customer_phone: linkedCustomer?.phone || null,
      custom_amount: customAmount
        ? {
            amount: customAmount.amount.toString(),
            reason: customAmount.reason,
          }
        : null,
      custom_pieces: customSku
        ? {
            reason: customSku.reason,
            items: customSku.items.map((i) => {
              const sku = skus.find((s) => s.id === i.skuId);
              return {
                skuId: i.skuId,
                quantity: i.qty,
                category: sku?.category || 'Unknown',
              };
            }),
          }
        : null,
      payment_method: paymentMethod.toLowerCase(),
      branch_id: branchId,
      customer_id: null,
      platform: platform,
      created_at: new Date().toISOString(),
      date: orderDate,
      timestamp: Date.now(),
    };
};

export const sendWebhookRequest = async (url: string, payload: WebhookPayload) => {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
};

export const sendWhatsAppInvoice = async (
  webhookUrl: string,
  context: WebhookContext
) => {
  try {
    const payload = constructWebhookPayload(context);
    // Fire & Forget in default mode
    sendWebhookRequest(webhookUrl, payload).catch((err) => console.error("WhatsApp Webhook Failed:", err));
  } catch (error) {
    console.error("Error constructing webhook payload:", error);
  }
};
