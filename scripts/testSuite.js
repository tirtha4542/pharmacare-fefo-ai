const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const pool = require('../src/config/db');

let server;
let baseUrl;

function logSection(title) {
  console.log('\n================================================================');
  console.log(`TEST: ${title}`);
  console.log('================================================================');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ PASSED: ${message}`);
}

async function request(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const response = await fetch(url, options);
  let body;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }
  return { status: response.status, body };
}

async function runTests() {
  // 1. Re-initialize database to ensure clean state
  console.log('Resetting and seeding database before test run...');
  const { execSync } = require('child_process');
  execSync('npm run db:init', { stdio: 'inherit' });

  // 2. Start temporary HTTP server on port 5555
  const TEST_PORT = 5555;
  baseUrl = `http://localhost:${TEST_PORT}`;
  server = app.listen(TEST_PORT);
  console.log(`Test server running at ${baseUrl}`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Health check
    // -------------------------------------------------------------------------
    logSection('1. Health Check (GET /api/health and GET /health)');
    const healthRes = await request('/api/health');
    assert(healthRes.status === 200, 'GET /api/health returns status 200');
    assert(healthRes.body.success === true, 'Response success is true');
    assert(healthRes.body.status === 'OK', 'System status is OK');
    assert(healthRes.body.tableCount === 8, 'Table count equals exactly 8');
    console.log('Tables verified:', healthRes.body.tables);

    // -------------------------------------------------------------------------
    // TEST 2: Register new user (customer role strictly forced)
    // -------------------------------------------------------------------------
    logSection('2. User Registration (POST /api/auth/register)');
    const uniqueEmail = `testuser_${Date.now()}@example.com`;
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Customer',
        email: uniqueEmail,
        password: 'Password123!',
        phone: '+8801999999999',
        address: 'Dhaka, Bangladesh',
        role: 'admin' // Attempt privilege escalation: must be ignored and forced to 'customer'
      })
    });

    assert(regRes.status === 201, 'Registration returns status 201');
    assert(regRes.body.success === true, 'Registration success is true');
    assert(regRes.body.data.user.role === 'customer', 'Role is strictly customer (cannot be chosen by client)');
    assert(!regRes.body.data.user.password_hash, 'Password hash is NEVER leaked in user response');
    assert(typeof regRes.body.data.token === 'string', 'JWT token returned on registration');

    // -------------------------------------------------------------------------
    // TEST 3: Login for Admin, Pharmacist, and Customer
    // -------------------------------------------------------------------------
    logSection('3. Authentication & Login (POST /api/auth/login)');

    // Admin login
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@pharmacy.com',
        password: 'AdminPassword123!'
      })
    });
    assert(adminLogin.status === 200, 'Admin login returns 200');
    assert(adminLogin.body.data.user.role === 'admin', 'Admin role verified');
    const adminToken = adminLogin.body.data.token;

    // Pharmacist login
    const pharmaLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'pharmacist@pharmacy.com',
        password: 'PharmaPassword123!'
      })
    });
    assert(pharmaLogin.status === 200, 'Pharmacist login returns 200');
    assert(pharmaLogin.body.data.user.role === 'pharmacist', 'Pharmacist role verified');
    const pharmaToken = pharmaLogin.body.data.token;

    // Customer login (John Doe)
    const customerLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john.doe@example.com',
        password: 'CustomerPassword123!'
      })
    });
    assert(customerLogin.status === 200, 'Customer login returns 200');
    assert(customerLogin.body.data.user.role === 'customer', 'Customer role verified');
    const customerToken = customerLogin.body.data.token;

    // GET /api/auth/me
    const meRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(meRes.status === 200, 'GET /api/auth/me returns 200');
    assert(meRes.body.data.user.email === 'john.doe@example.com', 'Current user details returned accurately');

    // -------------------------------------------------------------------------
    // TEST 4: Role-Protected Route (Success and 403 Forbidden)
    // -------------------------------------------------------------------------
    logSection('4. Role-based Authorization (GET /api/users)');

    // Customer accessing admin endpoint -> 403 Forbidden
    const customerForbidden = await request('/api/users', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(customerForbidden.status === 403, 'Customer gets 403 Forbidden on admin route');
    assert(customerForbidden.body.success === false, 'Error response has success: false');

    // Pharmacist accessing admin endpoint -> 403 Forbidden
    const pharmaForbidden = await request('/api/users', {
      headers: { Authorization: `Bearer ${pharmaToken}` }
    });
    assert(pharmaForbidden.status === 403, 'Pharmacist gets 403 Forbidden on admin route');

    // Admin accessing admin endpoint -> 200 OK
    const adminAllowed = await request('/api/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminAllowed.status === 200, 'Admin successfully accesses admin route');
    assert(Array.isArray(adminAllowed.body.data.users), 'Users array returned');

    // -------------------------------------------------------------------------
    // TEST 5: Medicine Search & Filters
    // -------------------------------------------------------------------------
    logSection('5. Medicine Catalog Search & Non-expired Stock Calculation');

    const searchRes = await request('/api/medicines?search=Paracetamol');
    assert(searchRes.status === 200, 'Medicine search returns 200');
    assert(searchRes.body.data.medicines.length > 0, 'Found Paracetamol');
    const paraMed = searchRes.body.data.medicines[0];
    assert(paraMed.available_stock > 0, 'Available non-expired stock included');
    console.log(`  Paracetamol available non-expired stock: ${paraMed.available_stock}`);

    // Filter by requiresPrescription=true
    const rxMeds = await request('/api/medicines?requiresPrescription=true');
    assert(rxMeds.status === 200, 'Prescription-only query returns 200');
    const allRx = rxMeds.body.data.medicines.every((m) => m.requires_prescription === true);
    assert(allRx, 'All filtered medicines have requires_prescription = true');

    // -------------------------------------------------------------------------
    // TEST 6: Prescription Upload & Review
    // -------------------------------------------------------------------------
    logSection('6. Prescription Upload (Customer) & Review (Pharmacist)');

    // Create a dummy image file for upload test
    const dummyFilePath = path.join(__dirname, 'test_prescription.jpg');
    fs.writeFileSync(dummyFilePath, 'DUMMY_IMAGE_BINARY_DATA_FOR_TEST');

    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync(dummyFilePath)], { type: 'image/jpeg' });
    formData.append('prescription', fileBlob, 'test_prescription.jpg');

    const uploadRes = await fetch(`${baseUrl}/api/prescriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: formData
    });
    const uploadJson = await uploadRes.json();
    assert(uploadRes.status === 201, 'Prescription upload returns 201 Created');
    assert(uploadJson.data.prescription.status === 'pending', 'Uploaded prescription status is pending');
    const uploadedRxId = uploadJson.data.prescription.prescription_id;
    console.log(`  Uploaded prescription ID: ${uploadedRxId}`);

    // Customer views own prescriptions
    const myRxRes = await request('/api/prescriptions/my', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(myRxRes.status === 200, 'GET /api/prescriptions/my returns 200');
    const hasUploadedRx = myRxRes.body.data.prescriptions.some((p) => p.prescription_id === uploadedRxId);
    assert(hasUploadedRx, 'Customer sees uploaded prescription in own list');

    // Pharmacist reviews and approves prescription
    const reviewRes = await request(`/api/prescriptions/${uploadedRxId}/review`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${pharmaToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'approved' })
    });
    assert(reviewRes.status === 200, 'Pharmacist review returns 200');
    assert(reviewRes.body.data.prescription.status === 'approved', 'Prescription status is now approved');
    assert(reviewRes.body.data.prescription.reviewed_by !== null, 'reviewed_by is recorded');

    // Clean up temporary test file
    if (fs.existsSync(dummyFilePath)) fs.unlinkSync(dummyFilePath);

    // -------------------------------------------------------------------------
    // TEST 7: Order for Over-The-Counter Medicine
    // -------------------------------------------------------------------------
    logSection('7. Order for Over-the-Counter Medicine (Paracetamol)');

    const otcOrderRes = await request('/api/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        delivery_address: 'House 55, Road 7, Dhanmondi, Dhaka',
        payment_method: 'bkash',
        items: [
          { medicine_id: 6, quantity: 2 } // Ibuprofen (OTC, $4.00 each)
        ]
      })
    });

    assert(otcOrderRes.status === 201, 'OTC order created with status 201');
    assert(otcOrderRes.body.data.total_amount === 8.00, 'Total amount server-calculated correctly ($8.00)');
    assert(otcOrderRes.body.data.status === 'pending', 'Order status is pending');
    assert(otcOrderRes.body.data.payment.status === 'pending', 'Payment status is pending');
    const otcOrderId = otcOrderRes.body.data.order_id;

    // -------------------------------------------------------------------------
    // TEST 8: Prescription Requirement on Orders (Blocked vs Allowed)
    // -------------------------------------------------------------------------
    logSection('8. Prescription Enforcement (Blocked without approval, Allowed with approval)');

    // Attempt to order Amoxicillin (Medicine ID 1, prescription-only) WITHOUT prescription_id -> 403
    const rxMissingRes = await request('/api/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        delivery_address: 'House 55, Road 7, Dhanmondi, Dhaka',
        items: [{ medicine_id: 1, quantity: 2 }]
      })
    });
    assert(rxMissingRes.status === 403, 'Order for Rx medicine without prescription returns 403');
    console.log(`  Blocked message: ${rxMissingRes.body.message}`);

    // Attempt with pending prescription (Prescription ID 2 from seed belongs to user 4, and is pending) -> 403
    const rxPendingRes = await request('/api/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        delivery_address: 'House 55, Road 7, Dhanmondi, Dhaka',
        prescription_id: 2, // pending and belongs to Jane Smith
        items: [{ medicine_id: 1, quantity: 2 }]
      })
    });
    assert(rxPendingRes.status === 403, 'Order with pending or other user prescription returns 403');
    console.log(`  Blocked message: ${rxPendingRes.body.message}`);

    // Allowed: Order with approved prescription (uploadedRxId approved in Test 6)
    const rxAllowedRes = await request('/api/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        delivery_address: 'House 55, Road 7, Dhanmondi, Dhaka',
        prescription_id: uploadedRxId,
        payment_method: 'card',
        items: [{ medicine_id: 1, quantity: 2 }]
      })
    });
    assert(rxAllowedRes.status === 201, 'Order with approved prescription returns 201');
    assert(rxAllowedRes.body.data.prescription_id === uploadedRxId, 'Prescription ID linked to order');
    const rxOrderId = rxAllowedRes.body.data.order_id;

    // -------------------------------------------------------------------------
    // TEST 9: Stock Deduction by FEFO across Two Batches
    // -------------------------------------------------------------------------
    logSection('9. FEFO Stock Deduction across Two Batches');

    // In seed:
    // Medicine 5 (Paracetamol):
    // Batch 9 (PARA-FEFO-01): expiry 2026-12-20, qty: 10
    // Batch 10 (PARA-FEFO-02): expiry 2027-08-15, qty: 100
    const [batchesBefore] = await pool.query(
      'SELECT batch_id, batch_no, quantity, expiry_date FROM batches WHERE medicine_id = 5 ORDER BY expiry_date ASC'
    );
    console.log('Paracetamol Batches BEFORE Order (15 units):');
    batchesBefore.forEach((b) => console.log(`  Batch ${b.batch_id} (${b.batch_no}): qty=${b.quantity}, expiry=${b.expiry_date}`));

    const batch9QtyBefore = batchesBefore.find((b) => b.batch_id === 9).quantity;
    const batch10QtyBefore = batchesBefore.find((b) => b.batch_id === 10).quantity;

    // Place order for 15 units of Paracetamol (must consume 10 from Batch 9, and 5 from Batch 10)
    const fefoOrderRes = await request('/api/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        delivery_address: 'House 55, Road 7, Dhanmondi, Dhaka',
        items: [{ medicine_id: 5, quantity: 15 }]
      })
    });
    assert(fefoOrderRes.status === 201, 'FEFO order for 15 units created successfully');

    const [batchesAfter] = await pool.query(
      'SELECT batch_id, batch_no, quantity, expiry_date FROM batches WHERE medicine_id = 5 ORDER BY expiry_date ASC'
    );
    console.log('Paracetamol Batches AFTER Order (15 units):');
    batchesAfter.forEach((b) => console.log(`  Batch ${b.batch_id} (${b.batch_no}): qty=${b.quantity}, expiry=${b.expiry_date}`));

    const batch9QtyAfter = batchesAfter.find((b) => b.batch_id === 9).quantity;
    const batch10QtyAfter = batchesAfter.find((b) => b.batch_id === 10).quantity;

    assert(batch9QtyAfter === batch9QtyBefore - 10, 'Batch 9 (earliest expiry) was fully consumed by 10 units');
    assert(batch10QtyAfter === batch10QtyBefore - 5, 'Batch 10 (later expiry) was consumed by remaining 5 units');

    // -------------------------------------------------------------------------
    // TEST 10: Insufficient Stock & Atomic Transaction Rollback
    // -------------------------------------------------------------------------
    logSection('10. Insufficient Stock & Atomic Transaction Rollback');

    const [ordersCountBefore] = await pool.query('SELECT COUNT(*) as count FROM orders');
    const [batchesM5Before] = await pool.query('SELECT SUM(quantity) as total FROM batches WHERE medicine_id = 5');

    const excessiveOrderRes = await request('/api/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        delivery_address: 'House 55, Road 7, Dhanmondi, Dhaka',
        items: [{ medicine_id: 5, quantity: 99999 }]
      })
    });

    assert(excessiveOrderRes.status === 400, 'Excessive order returns 400 Bad Request');
    console.log(`  Error response: ${excessiveOrderRes.body.message}`);

    const [ordersCountAfter] = await pool.query('SELECT COUNT(*) as count FROM orders');
    const [batchesM5After] = await pool.query('SELECT SUM(quantity) as total FROM batches WHERE medicine_id = 5');

    assert(ordersCountBefore[0].count === ordersCountAfter[0].count, 'No order record inserted (rolled back)');
    assert(batchesM5Before[0].total === batchesM5After[0].total, 'No stock deducted (rolled back)');

    // -------------------------------------------------------------------------
    // TEST 11: Order Cancellation Restoring Stock
    // -------------------------------------------------------------------------
    logSection('11. Order Cancellation & Stock Restoration');

    // We cancel the OTC order from Test 7 (otcOrderId, 2 units of medicine 6 Ibuprofen)
    const [ibStockBeforeCancel] = await pool.query(
      'SELECT SUM(quantity) as total FROM batches WHERE medicine_id = 6 AND expiry_date >= CURDATE()'
    );

    const cancelRes = await request(`/api/orders/${otcOrderId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${pharmaToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'cancelled' })
    });

    assert(cancelRes.status === 200, 'Order status updated to cancelled');
    assert(cancelRes.body.data.status === 'cancelled', 'Status is cancelled');

    const [ibStockAfterCancel] = await pool.query(
      'SELECT SUM(quantity) as total FROM batches WHERE medicine_id = 6 AND expiry_date >= CURDATE()'
    );

    assert(
      parseInt(ibStockAfterCancel[0].total, 10) === parseInt(ibStockBeforeCancel[0].total, 10) + 2,
      'Inventory stock was restored by 2 units upon order cancellation'
    );

    // -------------------------------------------------------------------------
    // TEST 12: Payment Processing (Paid once, reject second payment)
    // -------------------------------------------------------------------------
    logSection('12. Payment Processing (Paying sets paid_at; cannot pay twice)');

    // Pay for rxOrderId
    const payRes = await request('/api/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_id: rxOrderId,
        method: 'card'
      })
    });

    assert(payRes.status === 200, 'Payment returns 200 OK');
    assert(payRes.body.data.payment.status === 'paid', 'Payment status is marked as paid');
    assert(payRes.body.data.payment.paid_at !== null, 'paid_at timestamp is set');

    // Attempt to pay second time -> 400 Bad Request
    const secondPayRes = await request('/api/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_id: rxOrderId,
        method: 'card'
      })
    });
    assert(secondPayRes.status === 400, 'Second payment returns 400 Bad Request');
    console.log(`  Cannot pay twice message: ${secondPayRes.body.message}`);

    // Customer can view payment by order ID
    const viewPayRes = await request(`/api/payments/order/${rxOrderId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(viewPayRes.status === 200, 'GET /api/payments/order/:orderId returns 200');
    assert(viewPayRes.body.data.payment.status === 'paid', 'Payment record verified');

    // -------------------------------------------------------------------------
    // TEST 13: Conflict Handling on Deletion (Rule 9)
    // -------------------------------------------------------------------------
    logSection('13. Business Rule 9: Foreign Key Conflict Handling on Deletion');

    // Attempt to delete category 1 (Antibiotics) which has medicines -> 409 Conflict
    const delCatRes = await request('/api/categories/1', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(delCatRes.status === 409, 'Deleting referenced category returns 409 Conflict');
    console.log(`  Category conflict message: ${delCatRes.body.message}`);

    // Attempt to delete medicine 1 which has batches/orders -> 409 Conflict
    const delMedRes = await request('/api/medicines/1', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(delMedRes.status === 409, 'Deleting referenced medicine returns 409 Conflict');
    console.log(`  Medicine conflict message: ${delMedRes.body.message}`);

    // -------------------------------------------------------------------------
    // TEST 14: Reports (Admin only)
    // -------------------------------------------------------------------------
    logSection('14. Reports Endpoints (GET /api/reports/*)');

    const salesRes = await request('/api/reports/sales', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(salesRes.status === 200, 'Sales report returns 200');
    assert(typeof salesRes.body.data.summary.total_revenue === 'number', 'Total revenue calculated');

    const lowStockRes = await request('/api/reports/low-stock?threshold=10', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(lowStockRes.status === 200, 'Low-stock report returns 200');
    assert(Array.isArray(lowStockRes.body.data.low_stock_medicines), 'Low stock medicines returned');

    const topMedRes = await request('/api/reports/top-medicines?limit=5', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(topMedRes.status === 200, 'Top medicines report returns 200');
    assert(topMedRes.body.data.top_medicines.length <= 5, 'Top medicines limited to requested amount');

    console.log('\n================================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('================================================================\n');

  } finally {
    if (server) {
      server.close();
    }
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
