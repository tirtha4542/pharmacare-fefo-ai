/**
 * PharmaCare Pro - Main Reactive Application Controller
 */

// Application State
const state = {
  user: null,
  cart: JSON.parse(localStorage.getItem('pharma_cart') || '[]'),
  categories: [],
  medicines: [],
  pagination: { page: 1, limit: 8, totalPages: 1 },
  activeCategory: '',
  searchQuery: '',
  requiresPrescriptionFilter: '',
  activeTab: 'storefront',
  charts: {}
};

// DOM Content Loaded Initializer
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await checkAuth();
  await loadCategories();
  await loadMedicines();
  updateCartBadge();
  initDemoAccountButtons();
});

// Toast System
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation');
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Authentication Handlers
async function checkAuth() {
  const token = API.getToken();
  if (!token) {
    state.user = null;
    renderUserUI();
    return;
  }

  try {
    const res = await API.getMe();
    state.user = res.data.user;
  } catch {
    API.setToken(null);
    state.user = null;
  }
  renderUserUI();
}

function renderUserUI() {
  const userSection = document.getElementById('navUserSection');
  const pharmacistTab = document.getElementById('tabPharmacist');
  const adminTab = document.getElementById('tabAdmin');
  const myOrdersTab = document.getElementById('tabMyOrders');
  const myRxTab = document.getElementById('tabMyRx');

  if (state.user) {
    const roleClass = `role-${state.user.role}`;
    userSection.innerHTML = `
      <div class="user-badge">
        <i class="fa-solid fa-user-circle" style="color: var(--primary); font-size: 1.1rem;"></i>
        <span>${escapeHtml(state.user.name)}</span>
        <span class="user-role-tag ${roleClass}">${state.user.role}</span>
      </div>
      <button class="btn btn-outline btn-sm" onclick="logout()" title="Logout">
        <i class="fa-solid fa-arrow-right-from-bracket"></i>
      </button>
    `;

    // Role-dependent tab display
    if (myOrdersTab) myOrdersTab.style.display = state.user.role === 'customer' ? 'flex' : 'none';
    if (myRxTab) myRxTab.style.display = state.user.role === 'customer' ? 'flex' : 'none';
    if (pharmacistTab) pharmacistTab.style.display = ['pharmacist', 'admin'].includes(state.user.role) ? 'flex' : 'none';
    if (adminTab) adminTab.style.display = state.user.role === 'admin' ? 'flex' : 'none';

  } else {
    userSection.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="openModal('loginModal')">
        <i class="fa-solid fa-right-to-bracket"></i> Login
      </button>
      <button class="btn btn-primary btn-sm" onclick="openModal('registerModal')">
        <i class="fa-solid fa-user-plus"></i> Register
      </button>
    `;
    if (myOrdersTab) myOrdersTab.style.display = 'none';
    if (myRxTab) myRxTab.style.display = 'none';
    if (pharmacistTab) pharmacistTab.style.display = 'none';
    if (adminTab) adminTab.style.display = 'none';
  }

  updateDemoPillsState();
}

function updateDemoPillsState() {
  document.querySelectorAll('.btn-demo-pill').forEach(btn => btn.classList.remove('active'));
  if (!state.user) return;
  if (state.user.role === 'customer') document.getElementById('demoCustomerBtn')?.classList.add('active');
  if (state.user.role === 'pharmacist') document.getElementById('demoPharmaBtn')?.classList.add('active');
  if (state.user.role === 'admin') document.getElementById('demoAdminBtn')?.classList.add('active');
}

// 1-Click Demo Login
async function demoLogin(email, password) {
  try {
    const res = await API.login({ email, password });
    API.setToken(res.data.token);
    state.user = res.data.user;
    renderUserUI();
    showToast(`Logged in as ${res.data.user.name} (${res.data.user.role})`, 'success');

    // Auto-switch to appropriate portal tab
    if (res.data.user.role === 'pharmacist') {
      switchTab('pharmacist');
    } else if (res.data.user.role === 'admin') {
      switchTab('admin');
    } else {
      switchTab('storefront');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function initDemoAccountButtons() {
  document.getElementById('demoCustomerBtn')?.addEventListener('click', () => {
    demoLogin('john.doe@example.com', 'CustomerPassword123!');
  });
  document.getElementById('demoPharmaBtn')?.addEventListener('click', () => {
    demoLogin('pharmacist@pharmacy.com', 'PharmaPassword123!');
  });
  document.getElementById('demoAdminBtn')?.addEventListener('click', () => {
    demoLogin('admin@pharmacy.com', 'AdminPassword123!');
  });
  document.getElementById('demoLogoutBtn')?.addEventListener('click', () => logout());
}

function logout() {
  API.setToken(null);
  state.user = null;
  renderUserUI();
  switchTab('storefront');
  showToast('Logged out successfully', 'success');
}

// Tab Switching
function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');

  const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
  if (tabBtn) tabBtn.classList.add('active');

  const pane = document.getElementById(`pane-${tabName}`);
  if (pane) pane.style.display = 'block';

  // Trigger data loads per tab
  if (tabName === 'storefront') loadMedicines();
  if (tabName === 'my-orders') loadMyOrders();
  if (tabName === 'my-rx') loadMyPrescriptions();
  if (tabName === 'pharmacist') loadPharmacistPortal();
  if (tabName === 'admin') loadAdminDashboard();
}

// Catalog: Load Categories
async function loadCategories() {
  try {
    const res = await API.getCategories();
    state.categories = res.data.categories;
    renderCategoryPills();
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

function renderCategoryPills() {
  const container = document.getElementById('categoryPills');
  if (!container) return;

  let html = `<button class="cat-pill ${state.activeCategory === '' ? 'active' : ''}" onclick="selectCategory('')">All Medicines</button>`;
  state.categories.forEach(c => {
    html += `<button class="cat-pill ${state.activeCategory === String(c.category_id) ? 'active' : ''}" onclick="selectCategory('${c.category_id}')">${escapeHtml(c.name)}</button>`;
  });
  container.innerHTML = html;
}

function selectCategory(catId) {
  state.activeCategory = catId;
  state.pagination.page = 1;
  renderCategoryPills();
  loadMedicines();
}

// Catalog: Load Medicines with live non-expired stock
async function loadMedicines() {
  const grid = document.getElementById('medicineGrid');
  if (!grid) return;

  grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i><p style="margin-top: 10px;">Loading medicines...</p></div>`;

  try {
    const res = await API.getMedicines({
      search: state.searchQuery,
      category: state.activeCategory,
      requiresPrescription: state.requiresPrescriptionFilter,
      page: state.pagination.page,
      limit: state.pagination.limit
    });

    state.medicines = res.data.medicines;
    state.pagination = res.data.pagination;

    renderMedicines(state.medicines);
    renderPagination();
  } catch (err) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--danger);"><i class="fa-solid fa-circle-exclamation" style="font-size: 2rem;"></i><p style="margin-top: 10px;">Failed to load medicines: ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderMedicines(medicines) {
  const grid = document.getElementById('medicineGrid');
  if (!grid) return;

  if (medicines.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 80px 20px;">
        <i class="fa-solid fa-prescription-bottle-medical" style="font-size: 3.5rem; color: #cbd5e1; margin-bottom: 14px;"></i>
        <h3>No Medicines Found</h3>
        <p>Try adjusting your search keywords or filter settings.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = medicines.map(m => {
    const isRx = m.requires_prescription;
    const stock = m.available_stock;
    
    // Choose dynamic category visual theme
    const themeIndex = ((m.category_id - 1) % 6) + 1;
    const catIcons = {
      1: 'fa-shield-virus', // Antibiotics
      2: 'fa-capsules',     // Analgesics & Pain Relief
      3: 'fa-heart-pulse',  // Cardiovascular
      4: 'fa-dna',          // Antidiabetic
      5: 'fa-lungs',        // Respiratory
      6: 'fa-tablets'       // Gastrointestinal
    };
    const iconClass = catIcons[m.category_id] || (isRx ? 'fa-file-prescription' : 'fa-pills');

    // Calculate stock fill percent (normalized to 50 max for visual scale)
    const stockPercent = Math.min(100, Math.max(8, Math.round((stock / 60) * 100)));
    let stockClass = 'stock-healthy';
    let stockStatusLabel = `${stock} units available`;

    if (stock <= 0) {
      stockClass = 'stock-depleted';
      stockStatusLabel = 'Out of Stock';
    } else if (stock <= 10) {
      stockClass = 'stock-warning';
      stockStatusLabel = `Low Stock (${stock} left)`;
    }

    return `
      <div class="med-card">
        <div class="med-card-header">
          <div class="med-icon-wrap cat-theme-${themeIndex}">
            <i class="fa-solid ${iconClass}"></i>
          </div>
          <span class="med-badge ${isRx ? 'badge-rx' : 'badge-otc'}">
            ${isRx ? '<i class="fa-solid fa-file-medical"></i> Rx Required' : '<i class="fa-solid fa-shield-halved"></i> OTC Approved'}
          </span>
        </div>

        <div class="med-category">${escapeHtml(m.category_name)}</div>
        <h4 class="med-name">${escapeHtml(m.name)}</h4>
        <div class="med-generic">${escapeHtml(m.generic_name || 'Standard Certified Formula')}</div>
        <div class="med-manufacturer"><i class="fa-solid fa-industry" style="margin-right: 4px; color: var(--slate-light);"></i> ${escapeHtml(m.manufacturer || 'Licensed Pharma')}</div>
        
        <!-- Interactive Stock Meter -->
        <div class="stock-meter-container">
          <div class="stock-meter-labels">
            <span style="color: var(--slate);">Inventory Status:</span>
            <span class="${stock <= 0 ? 'stock-out' : (stock <= 10 ? 'stock-low' : 'stock-in')}">
              ${stockStatusLabel}
            </span>
          </div>
          <div class="stock-bar-bg">
            <div class="stock-bar-fill ${stockClass}" style="width: ${stock <= 0 ? '100%' : stockPercent + '%'};"></div>
          </div>
        </div>

        <div class="med-footer">
          <div class="med-price">$${m.price.toFixed(2)} <span>/ unit</span></div>
          <button class="btn-add-cart" onclick="addToCart(${m.medicine_id})" ${stock <= 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-cart-plus"></i> ${stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderPagination() {
  const container = document.getElementById('paginationWrap');
  if (!container) return;

  const { page, totalPages } = state.pagination;
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <button class="btn-page" onclick="goToPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>
      <i class="fa-solid fa-chevron-left"></i> Previous
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    html += `
      <button class="btn-page ${i === page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>
    `;
  }

  html += `
    <button class="btn-page" onclick="goToPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>
      Next <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  container.innerHTML = html;
}

function goToPage(newPage) {
  if (newPage < 1 || newPage > state.pagination.totalPages) return;
  state.pagination.page = newPage;
  loadMedicines();
  window.scrollTo({ top: 350, behavior: 'smooth' });
}

// Shopping Cart Functions
function addToCart(medicineId) {
  const medicine = state.medicines.find(m => m.medicine_id === medicineId);
  if (!medicine) return;

  const existing = state.cart.find(it => it.medicine_id === medicineId);
  if (existing) {
    if (existing.quantity >= medicine.available_stock) {
      showToast(`Cannot add more. Only ${medicine.available_stock} units available in stock.`, 'warning');
      return;
    }
    existing.quantity += 1;
  } else {
    state.cart.push({
      medicine_id: medicine.medicine_id,
      name: medicine.name,
      price: medicine.price,
      requires_prescription: medicine.requires_prescription,
      available_stock: medicine.available_stock,
      quantity: 1
    });
  }

  saveCart();
  updateCartBadge();
  renderCartDrawer();
  openCartDrawer();
  showToast(`Added "${medicine.name}" to your cart.`, 'success');
}

function updateCartQty(medicineId, delta) {
  const item = state.cart.find(it => it.medicine_id === medicineId);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    removeFromCart(medicineId);
    return;
  }

  if (newQty > item.available_stock) {
    showToast(`Maximum available stock is ${item.available_stock} units.`, 'warning');
    return;
  }

  item.quantity = newQty;
  saveCart();
  renderCartDrawer();
  updateCartBadge();
}

function removeFromCart(medicineId) {
  state.cart = state.cart.filter(it => it.medicine_id !== medicineId);
  saveCart();
  renderCartDrawer();
  updateCartBadge();
}

function saveCart() {
  localStorage.setItem('pharma_cart', JSON.stringify(state.cart));
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  const count = state.cart.reduce((sum, it) => sum + it.quantity, 0);
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

function renderCartDrawer() {
  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');
  if (!body) return;

  if (state.cart.length === 0) {
    body.innerHTML = `
      <div class="cart-empty">
        <i class="fa-solid fa-basket-shopping"></i>
        <h4>Your Cart is Empty</h4>
        <p>Explore our medicine catalog and add items.</p>
      </div>
    `;
    if (footer) footer.style.display = 'none';
    return;
  }

  if (footer) footer.style.display = 'block';

  let hasRx = false;
  let total = 0;

  body.innerHTML = state.cart.map(it => {
    const subtotal = it.price * it.quantity;
    total += subtotal;
    if (it.requires_prescription) hasRx = true;

    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">
            ${escapeHtml(it.name)}
            ${it.requires_prescription ? '<span class="status-pill status-rejected" style="font-size:0.65rem; padding:1px 6px;">Rx Required</span>' : ''}
          </div>
          <div class="cart-item-price">$${it.price.toFixed(2)} × ${it.quantity} = $${subtotal.toFixed(2)}</div>
        </div>
        <div class="cart-qty-ctrl">
          <button class="btn-qty" onclick="updateCartQty(${it.medicine_id}, -1)">-</button>
          <span class="qty-val">${it.quantity}</span>
          <button class="btn-qty" onclick="updateCartQty(${it.medicine_id}, 1)">+</button>
        </div>
        <button class="btn-remove-item" onclick="removeFromCart(${it.medicine_id})" title="Remove item">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
  }).join('');

  document.getElementById('cartTotalAmount').textContent = `$${total.toFixed(2)}`;

  const rxNotice = document.getElementById('cartRxNotice');
  if (rxNotice) {
    rxNotice.style.display = hasRx ? 'flex' : 'none';
  }
}

function openCartDrawer() {
  document.getElementById('cartOverlay')?.classList.add('open');
  document.getElementById('cartDrawer')?.classList.add('open');
}

function closeCartDrawer() {
  document.getElementById('cartOverlay')?.classList.remove('open');
  document.getElementById('cartDrawer')?.classList.remove('open');
}

// Checkout Modal
async function proceedToCheckout() {
  if (!state.user) {
    closeCartDrawer();
    openModal('loginModal');
    showToast('Please login or register to complete your order.', 'warning');
    return;
  }

  if (state.cart.length === 0) {
    showToast('Your cart is empty', 'warning');
    return;
  }

  const hasRx = state.cart.some(it => it.requires_prescription);
  const rxSection = document.getElementById('checkoutRxSection');
  const rxSelect = document.getElementById('checkoutPrescriptionSelect');

  if (hasRx) {
    rxSection.style.display = 'block';
    rxSelect.innerHTML = '<option value="">Loading approved prescriptions...</option>';

    try {
      const res = await API.getMyPrescriptions();
      const approvedRx = res.data.prescriptions.filter(p => p.status === 'approved');

      if (approvedRx.length === 0) {
        rxSelect.innerHTML = '<option value="">⚠️ No approved prescriptions found!</option>';
        document.getElementById('checkoutRxWarning').style.display = 'block';
      } else {
        document.getElementById('checkoutRxWarning').style.display = 'none';
        rxSelect.innerHTML = approvedRx.map(p => `
          <option value="${p.prescription_id}">Prescription #${p.prescription_id} (Approved on ${new Date(p.uploaded_at).toLocaleDateString()})</option>
        `).join('');
      }
    } catch (err) {
      rxSelect.innerHTML = '<option value="">Failed to load prescriptions</option>';
    }
  } else {
    rxSection.style.display = 'none';
  }

  // Pre-fill delivery address with user address if saved
  const addrInput = document.getElementById('checkoutAddress');
  if (addrInput && !addrInput.value) {
    addrInput.value = state.user.address || '';
  }

  closeCartDrawer();
  openModal('checkoutModal');
}

async function submitOrder(e) {
  e.preventDefault();
  const address = document.getElementById('checkoutAddress').value.trim();
  const paymentMethod = document.getElementById('checkoutPaymentMethod').value;
  const hasRx = state.cart.some(it => it.requires_prescription);
  const rxSelect = document.getElementById('checkoutPrescriptionSelect');
  const prescriptionId = hasRx ? parseInt(rxSelect.value, 10) : null;

  if (hasRx && !prescriptionId) {
    showToast('You must select an approved prescription for prescription-only medicines.', 'error');
    return;
  }

  const items = state.cart.map(it => ({
    medicine_id: it.medicine_id,
    quantity: it.quantity
  }));

  try {
    const res = await API.createOrder({
      delivery_address: address,
      prescription_id: prescriptionId,
      payment_method: paymentMethod,
      items
    });

    state.cart = [];
    saveCart();
    updateCartBadge();
    closeModal('checkoutModal');
    showToast(`Order #${res.data.order_id} placed successfully!`, 'success');

    switchTab('my-orders');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Customer: My Orders View
async function loadMyOrders() {
  const container = document.getElementById('myOrdersContainer');
  if (!container) return;

  container.innerHTML = `<div style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>`;

  try {
    const res = await API.getMyOrders();
    const orders = res.data.orders;

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 60px 20px;">
          <i class="fa-solid fa-box-open" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 12px;"></i>
          <h3>No Orders Placed Yet</h3>
          <p>Your medicine orders will appear here.</p>
          <button class="btn btn-primary" onclick="switchTab('storefront')" style="margin-top: 14px;">Browse Store</button>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(o => `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;">
          <div>
            <h3 style="font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
              Order #${o.order_id}
              <span class="status-pill status-${o.status}">${o.status}</span>
            </h3>
            <p style="font-size: 0.85rem; margin-top: 4px;">Placed on ${new Date(o.created_at).toLocaleString()} • ${escapeHtml(o.delivery_address)}</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.35rem; font-weight: 800; color: var(--primary-dark);">$${o.total_amount.toFixed(2)}</div>
            <span class="status-pill status-${o.payment_status}">${o.payment_method.toUpperCase()} • ${o.payment_status}</span>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${o.items.map(it => `
                <tr>
                  <td><strong>${escapeHtml(it.medicine_name)}</strong></td>
                  <td>${it.quantity}</td>
                  <td>$${it.unit_price.toFixed(2)}</td>
                  <td>$${it.subtotal.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 16px; display: flex; justify-content: flex-end; gap: 10px;">
          <button class="btn btn-outline btn-sm" onclick="window.print()" title="Print receipt invoice">
            <i class="fa-solid fa-print"></i> Print Receipt
          </button>
          ${o.payment_status === 'pending' && o.status !== 'cancelled' ? `
            <button class="btn btn-primary btn-sm" onclick="openPaymentModal(${o.order_id}, ${o.total_amount})">
              <i class="fa-solid fa-credit-card"></i> Pay Now
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="card" style="color: var(--danger);">${escapeHtml(err.message)}</div>`;
  }
}

// Payment Channel Selection Handlers
function selectCheckoutPayment(method, cardElement) {
  const hiddenInput = document.getElementById('checkoutPaymentMethod');
  if (hiddenInput) hiddenInput.value = method;
  cardElement.parentElement.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
  cardElement.classList.add('selected');
}

function selectDirectPayment(method, cardElement) {
  const hiddenInput = document.getElementById('paymentMethodSelect');
  if (hiddenInput) hiddenInput.value = method;
  cardElement.parentElement.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
  cardElement.classList.add('selected');
}

// Payment Modal
function openPaymentModal(orderId, amount) {
  document.getElementById('paymentOrderId').value = orderId;
  document.getElementById('paymentAmountDisplay').textContent = `$${amount.toFixed(2)}`;
  openModal('paymentModal');
}

async function submitPayment(e) {
  e.preventDefault();
  const orderId = document.getElementById('paymentOrderId').value;
  const method = document.getElementById('paymentMethodSelect').value;

  try {
    await API.processPayment(orderId, method);
    closeModal('paymentModal');
    showToast(`Payment of order #${orderId} completed successfully!`, 'success');
    loadMyOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Customer: My Prescriptions View
async function loadMyPrescriptions() {
  const container = document.getElementById('myRxContainer');
  if (!container) return;

  container.innerHTML = `<div style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>`;

  try {
    const res = await API.getMyPrescriptions();
    const prescriptions = res.data.prescriptions;

    if (prescriptions.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 60px 20px;">
          <i class="fa-solid fa-file-prescription" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 12px;"></i>
          <h3>No Prescriptions Uploaded</h3>
          <p>Upload your doctor's prescription to order prescription medications.</p>
          <button class="btn btn-primary" onclick="openModal('uploadRxModal')" style="margin-top: 14px;">
            <i class="fa-solid fa-cloud-arrow-up"></i> Upload Prescription
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
        <button class="btn btn-primary" onclick="openModal('uploadRxModal')">
          <i class="fa-solid fa-cloud-arrow-up"></i> Upload New Prescription
        </button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
        ${prescriptions.map(p => `
          <div class="card" style="margin-bottom: 0;">
            <div style="height: 180px; border-radius: var(--radius-md); overflow: hidden; background: #f1f5f9; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; position: relative;">
              ${p.image_path.toLowerCase().endsWith('.pdf') ? `
                <div style="text-align:center;"><i class="fa-solid fa-file-pdf" style="font-size: 3rem; color: #ef4444;"></i><p style="font-size:0.8rem; margin-top:4px;">PDF Document</p></div>
              ` : `
                <img src="/${p.image_path}" alt="Prescription" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\'fa-solid fa-image\' style=\'font-size:3rem; color:#94a3b8;\'></i>'">
              `}
              <span class="status-pill status-${p.status}" style="position: absolute; top: 10px; right: 10px;">${p.status}</span>
            </div>
            <h4 style="font-size: 1.05rem; margin-bottom: 4px;">Prescription #${p.prescription_id}</h4>
            <p style="font-size: 0.82rem; color: var(--slate); margin-bottom: 6px;">Uploaded: ${new Date(p.uploaded_at).toLocaleDateString()}</p>
            ${p.reviewer_name ? `<p style="font-size: 0.82rem; color: var(--primary-dark);">Reviewed by: <strong>${escapeHtml(p.reviewer_name)}</strong></p>` : ''}
            ${p.image_path.toLowerCase().endsWith('.pdf') ? `
              <a href="/${p.image_path}" target="_blank" class="btn btn-outline btn-sm" style="margin-top: 12px; width: 100%;">
                <i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> Open PDF Document
              </a>
            ` : `
              <button type="button" class="btn btn-outline btn-sm" style="margin-top: 12px; width: 100%;" onclick="openLightbox('/${p.image_path}')">
                <i class="fa-solid fa-magnifying-glass-plus" style="color:var(--primary);"></i> Zoom Image
              </button>
            `}
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card" style="color: var(--danger);">${escapeHtml(err.message)}</div>`;
  }
}

async function submitPrescriptionUpload(e) {
  e.preventDefault();
  const fileInput = document.getElementById('rxFileInput');
  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('Please select a prescription file (JPG, PNG, or PDF).', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('prescription', fileInput.files[0]);

  try {
    await API.uploadPrescription(formData);
    closeModal('uploadRxModal');
    fileInput.value = '';
    showToast('Prescription uploaded successfully and is pending pharmacist review.', 'success');
    loadMyPrescriptions();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Pharmacist Portal View
async function loadPharmacistPortal() {
  loadPharmacistPrescriptions();
  loadPharmacistBatches();
  loadPharmacistOrders();
}

async function loadPharmacistPrescriptions() {
  const container = document.getElementById('pharmacistRxContainer');
  if (!container) return;

  try {
    const res = await API.getAllPrescriptions();
    const list = res.data.prescriptions;

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Uploaded At</th>
            <th>Document</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(p => `
            <tr>
              <td>#${p.prescription_id}</td>
              <td><strong>${escapeHtml(p.customer_name)}</strong><br><small>${escapeHtml(p.customer_email)}</small></td>
              <td>${new Date(p.uploaded_at).toLocaleString()}</td>
              <td>
                ${p.image_path.toLowerCase().endsWith('.pdf') ? `
                  <a href="/${p.image_path}" target="_blank" class="btn btn-outline btn-sm">
                    <i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> Open PDF
                  </a>
                ` : `
                  <button type="button" class="btn btn-outline btn-sm" onclick="openLightbox('/${p.image_path}')">
                    <i class="fa-solid fa-image" style="color:var(--primary);"></i> View Image
                  </button>
                `}
              </td>
              <td><span class="status-pill status-${p.status}">${p.status}</span></td>
              <td>
                ${p.status === 'pending' ? `
                  <button class="btn btn-primary btn-sm" onclick="reviewRx(${p.prescription_id}, 'approved')">Approve</button>
                  <button class="btn btn-danger btn-sm" onclick="reviewRx(${p.prescription_id}, 'rejected')">Reject</button>
                ` : `<span style="font-size:0.8rem; color:var(--slate-light);">Reviewed</span>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger);">${escapeHtml(err.message)}</p>`;
  }
}

async function reviewRx(id, status) {
  try {
    await API.reviewPrescription(id, status);
    showToast(`Prescription #${id} marked as ${status}.`, 'success');
    loadPharmacistPrescriptions();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadPharmacistBatches() {
  const expiringContainer = document.getElementById('expiringBatchesAlert');
  const tableContainer = document.getElementById('batchesTableContainer');

  try {
    // 1. Expiring batches within 30 days
    const expRes = await API.getExpiringBatches(30);
    const expiring = expRes.data.expiring_batches;

    if (expiring.length > 0 && expiringContainer) {
      expiringContainer.style.display = 'block';
      expiringContainer.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.5rem; color: #b45309;"></i>
        <div>
          <strong>${expiring.length} Batch(es) Expiring Within 30 Days!</strong>
          <p style="font-size:0.85rem; margin-top:2px;">Immediate attention required for: ${expiring.map(e => `${e.medicine_name} (${e.batch_no})`).join(', ')}</p>
        </div>
      `;
    }

    // 2. All batches
    const allRes = await API.getBatches();
    const batches = allRes.data.batches;

    if (tableContainer) {
      tableContainer.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Medicine</th>
              <th>Batch No</th>
              <th>Quantity</th>
              <th>Expiry Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${batches.map(b => `
              <tr>
                <td>#${b.batch_id}</td>
                <td><strong>${escapeHtml(b.medicine_name)}</strong></td>
                <td><code>${escapeHtml(b.batch_no)}</code></td>
                <td>${b.quantity}</td>
                <td>${new Date(b.expiry_date).toLocaleDateString()}</td>
                <td>
                  ${b.is_expired ? '<span class="status-pill status-rejected">Expired</span>' : '<span class="status-pill status-approved">Active</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    console.error('Batches load error:', err);
  }
}

async function loadPharmacistOrders() {
  const container = document.getElementById('pharmacistOrdersContainer');
  if (!container) return;

  try {
    const res = await API.getAllOrders();
    const orders = res.data.orders;

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Total Amount</th>
            <th>Payment</th>
            <th>Current Status</th>
            <th>Update Status</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td>#${o.order_id}</td>
              <td>${escapeHtml(o.customer_name)}<br><small>${escapeHtml(o.customer_email)}</small></td>
              <td><strong>$${o.total_amount.toFixed(2)}</strong></td>
              <td><span class="status-pill status-${o.payment_status}">${o.payment_method} (${o.payment_status})</span></td>
              <td><span class="status-pill status-${o.status}">${o.status}</span></td>
              <td>
                <select class="filter-select" style="padding: 6px 12px; font-size: 0.85rem;" onchange="updateOrderStatus(${o.order_id}, this.value)" ${['delivered', 'cancelled'].includes(o.status) ? 'disabled' : ''}>
                  <option value="" disabled selected>Change Status...</option>
                  ${o.status === 'pending' ? '<option value="confirmed">Confirm Order</option><option value="cancelled">Cancel (Restore Stock)</option>' : ''}
                  ${o.status === 'confirmed' ? '<option value="shipped">Mark Shipped</option><option value="cancelled">Cancel (Restore Stock)</option>' : ''}
                  ${o.status === 'shipped' ? '<option value="delivered">Mark Delivered</option>' : ''}
                </select>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger);">${escapeHtml(err.message)}</p>`;
  }
}

async function updateOrderStatus(orderId, newStatus) {
  if (!newStatus) return;
  try {
    const res = await API.updateOrderStatus(orderId, newStatus);
    showToast(res.message, 'success');
    loadPharmacistOrders();
  } catch (err) {
    showToast(err.message, 'error');
    loadPharmacistOrders();
  }
}

// Admin Dashboard View
async function loadAdminDashboard() {
  try {
    // 1. Sales Report
    const salesRes = await API.getSalesReport();
    const summary = salesRes.data.summary;
    document.getElementById('adminTotalRevenue').textContent = `$${summary.total_revenue.toFixed(2)}`;
    document.getElementById('adminTotalOrders').textContent = summary.total_orders;
    document.getElementById('adminAvgOrderValue').textContent = `$${summary.average_order_value.toFixed(2)}`;

    // 2. Low Stock Report
    const lowStockRes = await API.getLowStockReport(10);
    const lowStock = lowStockRes.data.low_stock_medicines;
    const lowStockTable = document.getElementById('adminLowStockTable');
    if (lowStockTable) {
      lowStockTable.innerHTML = lowStock.map(m => `
        <tr>
          <td><strong>${escapeHtml(m.name)}</strong></td>
          <td>${escapeHtml(m.category_name)}</td>
          <td><span class="stock-out font-bold">${m.available_stock} units left</span></td>
          <td>$${m.price.toFixed(2)}</td>
        </tr>
      `).join('');
    }

    // 3. Top Selling Chart
    const topRes = await API.getTopMedicinesReport(5);
    renderTopMedicinesChart(topRes.data.top_medicines);

    // 4. Users Table
    loadAdminUsers();

    // 5. Categories Table
    loadAdminCategories();

    // 6. Master Medicines Catalog Table
    loadAdminMedicines();
  } catch (err) {
    console.error('Admin dashboard load error:', err);
  }
}

async function loadAdminCategories() {
  const container = document.getElementById('adminCategoriesTableContainer');
  if (!container) return;
  try {
    const res = await API.getCategories();
    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Category Name</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${res.data.categories.map(c => `
            <tr>
              <td>#${c.category_id}</td>
              <td><strong>${escapeHtml(c.name)}</strong></td>
              <td>
                <button class="btn btn-danger btn-sm" onclick="deleteCategoryPrompt(${c.category_id}, '${escapeHtml(c.name)}')">
                  <i class="fa-solid fa-trash"></i> Delete
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger);">${escapeHtml(err.message)}</p>`;
  }
}

async function submitAddCategory() {
  const name = document.getElementById('catNameInput').value.trim();
  if (!name) return;
  try {
    await API.createCategory({ name });
    document.getElementById('catNameInput').value = '';
    closeModal('addCategoryModal');
    showToast('Category created successfully!', 'success');
    loadCategories();
    loadAdminCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCategoryPrompt(id, name) {
  if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
  try {
    const res = await API.deleteCategory(id);
    showToast(res.message, 'success');
    loadCategories();
    loadAdminCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadAdminMedicines() {
  const container = document.getElementById('adminMedicinesTableContainer');
  if (!container) return;
  try {
    const res = await API.getMedicines({ limit: 50 });
    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Category</th>
            <th>Price</th>
            <th>Rx</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${res.data.medicines.map(m => `
            <tr>
              <td>#${m.medicine_id}</td>
              <td><strong>${escapeHtml(m.name)}</strong><br><small>${escapeHtml(m.manufacturer || '')}</small></td>
              <td>${escapeHtml(m.category_name)}</td>
              <td>$${m.price.toFixed(2)}</td>
              <td>${m.requires_prescription ? '<span class="status-pill status-rejected">Rx</span>' : '<span class="status-pill status-approved">OTC</span>'}</td>
              <td>
                <button class="btn btn-danger btn-sm" onclick="deleteMedicinePrompt(${m.medicine_id}, '${escapeHtml(m.name)}')">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger);">${escapeHtml(err.message)}</p>`;
  }
}

function openAddMedicineModal() {
  const select = document.getElementById('medCategorySelect');
  if (select) {
    select.innerHTML = state.categories.map(c => `
      <option value="${c.category_id}">${escapeHtml(c.name)}</option>
    `).join('');
  }
  openModal('addMedicineModal');
}

async function submitAddMedicine() {
  const category_id = parseInt(document.getElementById('medCategorySelect').value, 10);
  const name = document.getElementById('medNameInput').value.trim();
  const generic_name = document.getElementById('medGenericInput').value.trim();
  const manufacturer = document.getElementById('medManufacturerInput').value.trim();
  const price = parseFloat(document.getElementById('medPriceInput').value);
  const requires_prescription = document.getElementById('medRxCheckbox').checked;

  try {
    await API.createMedicine({
      category_id,
      name,
      generic_name,
      manufacturer,
      price,
      requires_prescription
    });
    closeModal('addMedicineModal');
    document.getElementById('addMedicineForm').reset();
    showToast('Medicine created successfully!', 'success');
    loadMedicines();
    loadAdminMedicines();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteMedicinePrompt(id, name) {
  if (!confirm(`Are you sure you want to delete medicine "${name}"?`)) return;
  try {
    const res = await API.deleteMedicine(id);
    showToast(res.message, 'success');
    loadMedicines();
    loadAdminMedicines();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openLightbox(src) {
  const modal = document.getElementById('lightboxModal');
  const img = document.getElementById('lightboxImage');
  if (modal && img) {
    img.src = src;
    modal.classList.add('open');
  }
}

function closeLightbox() {
  document.getElementById('lightboxModal')?.classList.remove('open');
}

function renderTopMedicinesChart(topMedicines) {
  const ctx = document.getElementById('topMedicinesChart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (state.charts.top) {
    state.charts.top.destroy();
  }

  state.charts.top = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topMedicines.map(m => m.name),
      datasets: [{
        label: 'Units Sold',
        data: topMedicines.map(m => m.total_units_sold),
        backgroundColor: '#0d9488',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

async function loadAdminUsers() {
  const container = document.getElementById('adminUsersTableContainer');
  if (!container) return;

  try {
    const res = await API.getUsers();
    const users = res.data.users;

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Change Role</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>#${u.user_id}</td>
              <td><strong>${escapeHtml(u.name)}</strong></td>
              <td>${escapeHtml(u.email)}</td>
              <td><span class="user-role-tag role-${u.role}">${u.role}</span></td>
              <td>
                <select class="filter-select" style="padding: 4px 10px; font-size:0.8rem;" onchange="changeUserRole(${u.user_id}, this.value)">
                  <option value="customer" ${u.role === 'customer' ? 'selected' : ''}>Customer</option>
                  <option value="pharmacist" ${u.role === 'pharmacist' ? 'selected' : ''}>Pharmacist</option>
                  <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger);">${escapeHtml(err.message)}</p>`;
  }
}

async function changeUserRole(userId, newRole) {
  try {
    await API.updateUserRole(userId, newRole);
    showToast(`User role updated to ${newRole}`, 'success');
    loadAdminUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Modal Helpers
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// Event Listeners
function setupEventListeners() {
  // Search input with debounce
  let searchTimer;
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      state.pagination.page = 1;
      loadMedicines();
    }, 350);
  });

  // Rx Filter select
  document.getElementById('rxFilterSelect')?.addEventListener('change', (e) => {
    state.requiresPrescriptionFilter = e.target.value;
    state.pagination.page = 1;
    loadMedicines();
  });

  // Navigation tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.getAttribute('data-tab'));
    });
  });

  // Cart button
  document.getElementById('cartBtn')?.addEventListener('click', openCartDrawer);
  document.getElementById('closeCartBtn')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCartDrawer);

  // Modal close buttons
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) modal.classList.remove('open');
    });
  });

  // Form Submissions
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
      const res = await API.login({ email, password });
      API.setToken(res.data.token);
      state.user = res.data.user;
      closeModal('loginModal');
      renderUserUI();
      showToast(`Welcome back, ${res.data.user.name}!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const phone = document.getElementById('regPhone').value;
    const address = document.getElementById('regAddress').value;

    try {
      const res = await API.register({ name, email, password, phone, address });
      API.setToken(res.data.token);
      state.user = res.data.user;
      closeModal('registerModal');
      renderUserUI();
      showToast(`Account created! Welcome, ${res.data.user.name}.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('checkoutForm')?.addEventListener('submit', submitOrder);
  document.getElementById('paymentForm')?.addEventListener('submit', submitPayment);
  document.getElementById('uploadRxForm')?.addEventListener('submit', submitPrescriptionUpload);
}

// Utility
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

