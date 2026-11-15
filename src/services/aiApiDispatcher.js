/**
 * aiApiDispatcher.js
 * Dispatches AI tool calls to the backend REST API endpoints.
 * Strict Architecture Rules:
 *  1. ZERO direct database access (no SQL, no pool import).
 *  2. READ-ONLY operations ONLY (HTTP GET).
 *  3. Authenticated using the active user's JWT token to enforce route middleware.
 */

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

async function executeApiGet(endpoint, token) {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    return data;
  } catch (err) {
    return {
      success: false,
      message: `Failed to call API endpoint ${endpoint}: ${err.message}`
    };
  }
}

/**
 * Dispatches an AI tool request to the appropriate backend REST API endpoint.
 * @param {string} toolName - The function name called by LLM
 * @param {object} args - Parsed arguments for the function
 * @param {string} token - The user's active JWT Bearer token
 * @param {string} role - The user's active role ('customer' | 'pharmacist' | 'admin')
 */
async function dispatchAiTool(toolName, args, token, role) {
  switch (toolName) {
    // -------------------------------------------------------------
    // Customer Tools
    // -------------------------------------------------------------
    case 'search_medicines': {
      const q = encodeURIComponent(args.keyword || '');
      return await executeApiGet(`/medicines?search=${q}&limit=8`, token);
    }

    case 'get_medicine_details': {
      const id = parseInt(args.id, 10);
      return await executeApiGet(`/medicines/${id}`, token);
    }

    case 'get_my_orders': {
      return await executeApiGet('/orders/my', token);
    }

    // -------------------------------------------------------------
    // Pharmacist & Admin Tools (Forbidden for Customers)
    // -------------------------------------------------------------
    case 'get_inventory_batches': {
      if (role === 'customer') {
        return { success: false, message: 'Permission Denied: Inventory batch data is restricted to pharmacy staff.' };
      }
      const query = args.medicine_id ? `?medicineId=${parseInt(args.medicine_id, 10)}` : '';
      return await executeApiGet(`/batches${query}`, token);
    }

    case 'get_expiring_batches': {
      if (role === 'customer') {
        return { success: false, message: 'Permission Denied: Expiry schedules are restricted to pharmacy staff.' };
      }
      const days = parseInt(args.days || 30, 10);
      return await executeApiGet(`/batches/expiring?days=${days}`, token);
    }

    case 'get_low_stock_report': {
      if (role === 'customer') {
        return { success: false, message: 'Permission Denied: Low stock alerts are restricted to pharmacy staff.' };
      }
      const threshold = parseInt(args.threshold || 20, 10);
      return await executeApiGet(`/reports/low-stock?threshold=${threshold}`, token);
    }

    case 'get_pending_prescriptions': {
      if (role === 'customer') {
        return { success: false, message: 'Permission Denied: Prescription review queue is restricted to pharmacists.' };
      }
      return await executeApiGet('/prescriptions?status=pending', token);
    }

    case 'get_fulfillment_orders': {
      if (role === 'customer') {
        return { success: false, message: 'Permission Denied: Order fulfillment queue is restricted to pharmacy staff.' };
      }
      const statusParam = args.status ? `?status=${encodeURIComponent(args.status)}` : '';
      return await executeApiGet(`/orders${statusParam}`, token);
    }

    // -------------------------------------------------------------
    // Admin-Only Tools (Forbidden for Customers & Pharmacists)
    // -------------------------------------------------------------
    case 'get_sales_analytics': {
      if (role !== 'admin') {
        return { success: false, message: 'Permission Denied: Sales and revenue analytics are strictly restricted to admin accounts.' };
      }
      const params = new URLSearchParams();
      if (args.from) params.append('from', args.from);
      if (args.to) params.append('to', args.to);
      const q = params.toString() ? `?${params.toString()}` : '';
      return await executeApiGet(`/reports/sales${q}`, token);
    }

    case 'get_top_selling_medicines': {
      if (role !== 'admin') {
        return { success: false, message: 'Permission Denied: Top product sales performance is restricted to admin accounts.' };
      }
      const limit = parseInt(args.limit || 5, 10);
      return await executeApiGet(`/reports/top-medicines?limit=${limit}`, token);
    }

    case 'get_system_users': {
      if (role !== 'admin') {
        return { success: false, message: 'Permission Denied: User directory access is restricted to admin accounts.' };
      }
      return await executeApiGet('/users', token);
    }

    default:
      return {
        success: false,
        message: `Unknown tool name: ${toolName}`
      };
  }
}

module.exports = {
  dispatchAiTool
};

