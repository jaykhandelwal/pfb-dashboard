
# Pakaja Inventory & Analytics System

A comprehensive inventory management PWA (Progressive Web App) designed for Momo/Food carts. This application handles stock tracking, daily operations (check-in/check-out), wastage reporting, and provides AI-powered analytics.

## 🚀 Features

*   **Dashboard**: Real-time view of fridge inventory and last checkout status across branches.
*   **Operations**: Streamlined interface for Staff to Check-Out (take stock to cart) and Return (bring stock back) items.
*   **Wastage Reporting**: Camera-integrated reporting system to log spoiled items with photo evidence (stored on BunnyCDN).
*   **Inventory Management**: Admin interface to add restock (incoming from supplier) and perform stocktakes (adjustments).
*   **Sales Reconciliation**: Compare physical inventory usage against reported sales from POS, Zomato, and Swiggy.
*   **CRM & Loyalty**: Track customer purchase history automatically and manage membership rewards (Discounts/Freebies).
*   **Menu Management**: specific recipes linked to raw SKUs to automate consumption calculations.
*   **Staff Attendance**: Geolocation and Selfie-based check-in system for staff.
*   **Analytics**: Visual charts for consumption, category splits, and wastage trends.
*   **AI Insights**: Integrated with **Google Gemini 2.5 Flash** to provide daily operational summaries and anomaly detection.
*   **User Management**: Role-based access control (Admin, Manager, Staff) with secure alphanumeric access codes.

## 🛠 Tech Stack

*   **Frontend**: React 19, TypeScript
*   **Styling**: Tailwind CSS
*   **Icons**: Lucide React
*   **Charts**: Recharts
*   **AI**: @google/genai SDK
*   **State Management**: React Context API + LocalStorage persistence
*   **Storage**: BunnyCDN (for Wastage/Attendance Images)
*   **Database**: Supabase (PostgreSQL)

---

## 🔌 POS / External Data Integration (Window Bridge)

To automate sales entry and populate the CRM/Loyalty system, your POS system or Android Wrapper can inject sales data directly into the app using the `window.postMessage` API.

### Finding IDs
1.  **Branch IDs**: Go to "Branches" page. The ID is listed (e.g., `branch-171092...`).
2.  **SKU/Menu IDs**: Go to "SKU Management" or "Menu Management". The ID is listed next to each item. Click the ID to copy.

### How to send data
Run this JavaScript code from your POS system or WebView when you want to sync sales. 
**Note:** Including the `customer` object is essential for the Loyalty Program to track total spend and order counts.

```javascript
window.postMessage({
  type: 'PAKAJA_IMPORT_SALES',
  payload: {
    // Required Fields
    date: '2024-03-20',       // Date YYYY-MM-DD
    branchId: 'branch-1',     // Must match the ID in Pakaja > Branches
    platform: 'POS',          // Options: 'POS', 'ZOMATO', 'SWIGGY'
    
    // Optional Fields
    timestamp: 1710933300000, // Unix Timestamp (ms). Orders with same timestamp are grouped in History.
    totalAmount: 450,         // Total Order Value (₹). Used for CRM stats. If omitted, system sums up menu item prices.
    
    // CRM / Customer Data (Optional but Recommended)
    customer: {
        name: "Rahul Sharma",
        phoneNumber: "9876543210" // REQUIRED if sending customer. Used as Unique ID for loyalty tracking.
    },

    // Order Items
    items: [
      { 
        skuId: 'menu-1',      // Match ID from "Menu Management" (Preferred) OR "SKU Management"
        quantity: 2           // Quantity sold
      }, 
      { 
        skuId: 'sku-12', 
        quantity: 1 
      }
    ]
  }
}, '*');
```

**Behavior:**
*   The app listens for this message continuously.
*   **Customer Logic**: If `customer.phoneNumber` is provided, the system checks if they exist. If yes, it updates their `totalSpend` and `orderCount`. If no, it creates a new Customer record.
*   **Timestamp Logic**: If you send multiple items with the same `timestamp`, they will be grouped into a single "Order Ticket" on the Orders page.
*   The Dashboard and Reconciliation Variance reports update instantly.
*   **IMPORTANT**: Orders sent via this API do **not** deduct from the main Fridge Inventory automatically. They are used for Reconciliation (comparing Sales vs. Staff Usage).

---

## 📱 Android / Mobile App Integration (Secure Auth)

This web application is designed to be embedded within a native Android wrapper (WebView). To ensure seamless and secure user experience, we use a **Bridge Mechanism** for authentication instead of passing credentials via URLs.

### Security Note
**Do not** pass access codes via URL parameters (e.g., `?code=123`). URLs are logged in history and proxy servers. Use the methods below.

### Method 1: Global Variable Injection (Recommended for Initial Load)
When the Android app loads the WebView, it should inject the user's access code into a global JavaScript variable **before** the page finishes loading. The web app checks for this variable on mount, logs the user in, and immediately clears the variable.

**Android (Kotlin) Example:**
```kotlin
webView.settings.javaScriptEnabled = true
webView.webViewClient = object : WebViewClient() {
    override fun onPageFinished(view: WebView?, url: String?) {
        // Inject the code securely
        val userCode = "manager123" // Retrieve this from Android secure storage
        val js = "window.PAKAJA_AUTH_CODE = '$userCode';"
        view?.evaluateJavascript(js, null)
    }
}
webView.loadUrl("https://your-app-url.com")
```

### Method 2: PostMessage (Async / Event Driven)
If the web app is already loaded and you need to trigger a login (e.g., after a biometric scan on the native side), use `postMessage`.

**Android (Kotlin) Example:**
```kotlin
// Trigger login event
val userCode = "admin456"
val js = "window.postMessage({ type: 'PAKAJA_LOGIN', code: '$userCode' }, '*');"
webView.evaluateJavascript(js, null)
```

**Web App Implementation Details (`AuthContext.tsx`):**
1.  On mount, the app checks `window.PAKAJA_AUTH_CODE`.
2.  The app listens for `window.onmessage` events with `{ type: 'PAKAJA_LOGIN' }`.

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
    # Optional: Override host if not using default
    # VITE_BUNNY_STORAGE_HOST=sg.storage.bunnycdn.com
    ```
4.  **Run Development Server**:
    ```bash
    npm run dev
    ```

## 🔐 Default Access

When launching the app for the first time, use the default admin credentials:

*   **User**: Admin
*   **Access Code**: `admin`

*Go to "User Management" to change this immediately after setup.*

## 📂 Project Structure

*   `/components`: Reusable UI components (Layout, ProtectedRoute, StatCard).
*   `/context`: Global state (AuthContext, StoreContext).
*   `/pages`: Main application views.
    *   `Operations.tsx`: Main staff interface for daily logging.
    *   `Wastage.tsx`: Camera interface for reporting loss.
    *   `Dashboard.tsx`: Analytics and AI summaries.
    *   `Attendance.tsx`: Staff check-in with selfie.
    *   `Reconciliation.tsx`: Sales vs Inventory checks.
*   `/types`: TypeScript interfaces for Data Models (User, Transaction, SKU).
*   `/services`: API integrations (Gemini AI, BunnyCDN, Supabase).

## 🤖 AI Features

The **Gemini Analyst** (found in Dashboard) and **Vision Tools** (Reconciliation) help with:
1.  **Consumption Data**: Compares sales vs. returns.
2.  **Vision Analysis**: Parses screenshots of Zomato/Swiggy reports into data.
3.  **Trends**: Highlights top-selling categories (Steam vs. Fry etc).

Ensure `process.env.API_KEY` is set to enable these features.
