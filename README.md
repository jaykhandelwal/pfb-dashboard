# Pakaja Inventory & Analytics System

[**See Project Roadmap ➔**](./roadmap.md)

A comprehensive inventory management PWA (Progressive Web App) designed for Momo/Food carts. This application handles stock tracking, daily operations (check-in/check-out), wastage reporting, staff attendance, sales reconciliation, and customer loyalty.

## 🚀 Features

*   **Dashboard**: Real-time view of fridge inventory and last checkout status across branches.
*   **POS & Order Entry**: Full-featured Point of Sale interface to create orders, link customers, and track revenue directly within the app.
*   **Operations**: Streamlined interface for Staff to Check-Out (take stock to cart) and Return (bring stock back) items.
*   **Wastage Reporting**: Camera-integrated reporting system to log spoiled items. Evidence photos are stored in the `wastage/` folder on BunnyCDN.
*   **Inventory Management**: Admin interface to add restock (incoming from supplier) and perform stocktakes (adjustments).
*   **Sales Reconciliation**: Compare physical inventory usage against reported sales from POS, Zomato, and Swiggy.
*   **CRM & Loyalty**: Track customer purchase history automatically. **Coupons are auto-generated** based on order milestones.
*   **Menu Management**: Define recipes linked to raw SKUs to automate consumption calculations based on sales. Supports **Half Plates** with explicit recipe definitions.
*   **Staff Attendance**: Selfie-based check-in system for staff with location tagging context. Selfies are stored in the `attendance/` folder on BunnyCDN.
*   **Analytics**: Visual charts for consumption, category splits, variance reports, and wastage trends.
*   **AI Insights**: Integrated with **Google Gemini 2.5 Flash** to provide daily operational summaries and anomaly detection.
*   **User Management**: Role-based access control (Admin, Manager, Staff) with secure alphanumeric access codes.

## 🛠 Tech Stack

*   **Frontend**: React 19, TypeScript
*   **Styling**: Tailwind CSS
*   **Icons**: Lucide React
*   **Charts**: Recharts
*   **AI**: @google/genai SDK
*   **State Management**: React Context API + LocalStorage persistence
*   **Storage**: BunnyCDN (Separated folders: `/wastage` and `/attendance`)
*   **Database**: Supabase (PostgreSQL)

---

## 📱 Android Integration Guide (For Developers)

This section details how the Android App should interact with the Supabase Database.

### 1. Fetching Available Coupons
To show rewards to a customer (e.g., "Free Momos Available"), call this RPC function.

**Endpoint:** `POST /rest/v1/rpc/get_available_coupons`
**Body:** `{ "phone_number": "9876543210" }`

**Response Example:**
```json
[
  {
    "coupon_id": "aa-bb-cc",
    "status": "ACTIVE",
    "reward_type": "FREE_ITEM",
    "reward_value": "menu-veg-steam", // This is the Menu Item ID to add to cart for free
    "reward_variant": "FULL",         // 'FULL' or 'HALF' plate
    "min_order_value": 200,           // Cart must be > 200 to use
    "description": "Free Veg Steam on your 10th Order!"
  }
]
```

### 2. Placing an Order (Saving Data)
When a user completes checkout, the Android app must perform **two** actions if a coupon was used.

#### Step A: Insert the Order
Insert a new row into the `orders` table.

**Table:** `orders`
**Operation:** `INSERT`

**JSON Payload Format:**
```json
{
  "id": "android-timestamp-uuid",       // Generate a unique ID
  "branch_id": "branch-1",              // ID of the store
  "customer_id": "9876543210",          // Customer Phone Number
  "customer_name": "Rahul",
  "platform": "ANDROID_APP",            // Or 'POS'
  "total_amount": 450,                  // Final amount paid
  "status": "COMPLETED",
  "payment_method": "UPI",              // 'CASH', 'UPI', 'CARD'
  "date": "2024-05-20",                 // YYYY-MM-DD (Local)
  "timestamp": 1716182000000,           // Epoch ms
  "items": [                            // Array of items sold
    {
      "menuItemId": "menu-1",
      "name": "Veg Steam Momos",
      "price": 100,
      "quantity": 2,
      "variant": "FULL"
    },
    {
      "menuItemId": "menu-2",
      "name": "Chicken Momos",
      "price": 0,                       // Price 0 because it was the reward
      "quantity": 1,
      "variant": "FULL"
    }
  ]
}
```
*Note: Inserting this order will AUTOMATICALLY update the customer's spend history and progress them towards their NEXT reward via database triggers.*

#### Step B: Mark Coupon as Used (If applicable)
If the user redeemed a coupon (e.g., they got the Chicken Momos for free), you must update the coupon status so they can't use it again.

**Table:** `customer_coupons`
**Operation:** `UPDATE`
**Condition:** `id = "THE_COUPON_ID_FROM_STEP_1"`

**Update Payload:**
```json
{
  "status": "USED",
  "redeemed_order_id": "android-timestamp-uuid"  // Link to the order ID created in Step A
}
```

---

## 📦 Setup & Installation

1.  **Clone the repository**
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Environment**:
    Create a `.env` file in the root directory:
    ```env
    API_KEY=your_google_gemini_api_key
    
    # Supabase (Optional for Database)
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_key

    # BunnyCDN (For Wastage/Attendance Images)
    VITE_BUNNY_STORAGE_KEY=your_storage_password
    VITE_BUNNY_STORAGE_ZONE=pakaja
    VITE_BUNNY_PULL_ZONE=https://your-zone.b-cdn.net
    ```
4.  **Run Development Server**:
    ```bash
    npm run dev
    ```

## 🔐 Default Access

*   **User**: Admin
*   **Access Code**: `admin`
