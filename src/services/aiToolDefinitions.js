/**
 * aiToolDefinitions.js
 * Role-Based tool definitions formatted for Groq / OpenAI Function Calling.
 * Strict RBAC: Customers, Pharmacists, and Admins only get access to their authorized toolset.
 */

// 1. Customer Tools (Storefront, Clinical Info, Own Orders)
const searchMedicinesTool = {
  type: 'function',
  function: {
    name: 'search_medicines',
    description: 'Search available medicines in the catalog by keyword, brand, or generic name to view prices, availability, and prescription requirements.',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'The search query or medicine name (e.g. "Paracetamol", "Amoxicillin", "tablet")'
        }
      },
      required: ['keyword']
    }
  }
};

const getMedicineDetailsTool = {
  type: 'function',
  function: {
    name: 'get_medicine_details',
    description: 'Retrieve detailed information about a specific medicine including therapeutic category, generic formula, and prescription requirement.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'integer',
          description: 'The numeric ID of the medicine'
        }
      },
      required: ['id']
    }
  }
};

const getMyOrdersTool = {
  type: 'function',
  function: {
    name: 'get_my_orders',
    description: 'Retrieve the current logged-in customer\'s personal orders, status (pending, confirmed, shipped, delivered), and tracking details.',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
};

// 2. Pharmacist Tools (Inventory Lots, Expiry, Queues - Zero Revenue)
const getInventoryBatchesTool = {
  type: 'function',
  function: {
    name: 'get_inventory_batches',
    description: 'Inspect warehouse inventory lots/batches including lot numbers, quantity on hand, and expiry dates.',
    parameters: {
      type: 'object',
      properties: {
        medicine_id: {
          type: 'integer',
          description: 'Optional medicine ID to filter batches for a specific product'
        }
      }
    }
  }
};

const getExpiringBatchesTool = {
  type: 'function',
  function: {
    name: 'get_expiring_batches',
    description: 'Identify near-expiry medicine batches expiring within a specified number of days (default 30 days).',
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'integer',
          description: 'Threshold in days (e.g. 30, 60, 90). Defaults to 30.'
        }
      }
    }
  }
};

const getLowStockReportTool = {
  type: 'function',
  function: {
    name: 'get_low_stock_report',
    description: 'Retrieve inventory lots and medicines whose active stock is below a critical threshold (e.g. 10 or 20 units).',
    parameters: {
      type: 'object',
      properties: {
        threshold: {
          type: 'integer',
          description: 'Unit threshold to alert on (default 20 units)'
        }
      }
    }
  }
};

const getPendingPrescriptionsTool = {
  type: 'function',
  function: {
    name: 'get_pending_prescriptions',
    description: 'View customer prescriptions currently pending clinical review and pharmacist approval.',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
};

const getFulfillmentOrdersTool = {
  type: 'function',
  function: {
    name: 'get_fulfillment_orders',
    description: 'List customer orders currently in fulfillment flow (pending, confirmed, shipped).',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by order status: "pending", "confirmed", or "shipped"'
        }
      }
    }
  }
};

// 3. Admin Tools (Financials, Sales Reports, Top Products, User Management)
const getSalesAnalyticsTool = {
  type: 'function',
  function: {
    name: 'get_sales_analytics',
    description: 'Retrieve total net revenue, total completed orders, average order value, and payment method breakdowns.',
    parameters: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (optional)'
        },
        to: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (optional)'
        }
      }
    }
  }
};


const getTopSellingMedicinesTool = {
  type: 'function',
  function: {
    name: 'get_top_selling_medicines',
    description: 'Retrieve the top best-selling medicines ranked by unit volume and generated sales revenue.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Number of top medicines to return (default 5)'
        }
      }
    }
  }
};

const getSystemUsersTool = {
  type: 'function',
  function: {
    name: 'get_system_users',
    description: 'List registered user accounts and staff role assignments.',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
};

/**
 * Returns strictly filtered tools based on user's authenticated role.
 * @param {string} role - 'customer' | 'pharmacist' | 'admin'
 */
function getToolsForRole(role) {
  const customerTools = [searchMedicinesTool, getMedicineDetailsTool, getMyOrdersTool];

  if (role === 'customer') {
    return customerTools;
  }

  const pharmacistTools = [
    ...customerTools,
    getInventoryBatchesTool,
    getExpiringBatchesTool,
    getLowStockReportTool,
    getPendingPrescriptionsTool,
    getFulfillmentOrdersTool
  ];

  if (role === 'pharmacist') {
    return pharmacistTools;
  }

  if (role === 'admin') {
    return [
      ...pharmacistTools,
      getSalesAnalyticsTool,
      getTopSellingMedicinesTool,
      getSystemUsersTool
    ];
  }

  return customerTools;
}

module.exports = {
  getToolsForRole
};
