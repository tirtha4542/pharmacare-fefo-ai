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
  lowStockMode: 'batches',
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
  initAiAssistant();
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
    // Auto-align tab with authenticated role
    if (state.user.role === 'customer' && ['pharmacist', 'admin'].includes(state.activeTab)) {
      switchTab('storefront');
    } else if (state.user.role === 'pharmacist' && ['my-orders', 'my-rx', 'admin'].includes(state.activeTab)) {
      switchTab('pharmacist');
    } else if (state.user.role === 'admin' && ['my-orders', 'my-rx', 'pharmacist'].includes(state.activeTab)) {
      switchTab('admin');
    }
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
    const avatarRoleClass = `role-avatar-${state.user.role}`;
    const initial = (state.user.name || 'U').trim().charAt(0).toUpperCase();

    userSection.innerHTML = `
      <div class="user-badge" title="Signed in as ${escapeHtml(state.user.email)}">
        <div class="user-avatar-circle ${avatarRoleClass}">${initial}</div>
        <span class="user-name-text">${escapeHtml(state.user.name)}</span>
        <span class="user-role-tag ${roleClass}">${state.user.role}</span>
      </div>
      <button class="btn-logout" onclick="logout()" title="Logout from account">
        <i class="fa-solid fa-arrow-right-from-bracket"></i>
        <span>Logout</span>
      </button>
    `;

    // Strict Role-Based Tab Isolation (Each role only sees its dedicated tabs)
    const role = state.user?.role;
    if (myOrdersTab) myOrdersTab.style.display = role === 'customer' ? 'flex' : 'none';
    if (myRxTab) myRxTab.style.display = role === 'customer' ? 'flex' : 'none';
    if (pharmacistTab) pharmacistTab.style.display = role === 'pharmacist' ? 'flex' : 'none';
    if (adminTab) adminTab.style.display = role === 'admin' ? 'flex' : 'none';

  } else {
    userSection.innerHTML = `
      <button class="btn-nav-login" onclick="openModal('loginModal')">
        <i class="fa-solid fa-right-to-bracket"></i> Login
      </button>
      <button class="btn-nav-register" onclick="openModal('registerModal')">
        <i class="fa-solid fa-user-plus"></i> Register
      </button>
    `;
    if (myOrdersTab) myOrdersTab.style.display = 'none';
    if (myRxTab) myRxTab.style.display = 'none';
    if (pharmacistTab) pharmacistTab.style.display = 'none';
    if (adminTab) adminTab.style.display = 'none';
  }

  updateDemoPillsState();
  if (typeof updateAiRoleUI === 'function') updateAiRoleUI();
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
  if (!tabName) return;

  // Strict role guard: prevent cross-portal access
  const role = state.user?.role;
  if (role === 'customer' && ['pharmacist', 'admin'].includes(tabName)) return;
  if (role === 'pharmacist' && ['my-orders', 'my-rx', 'admin'].includes(tabName)) return;
  if (role === 'admin' && ['my-orders', 'my-rx', 'pharmacist'].includes(tabName)) return;
  if (!role && ['my-orders', 'my-rx', 'pharmacist', 'admin'].includes(tabName)) return;

  state.activeTab = tabName;
  document.querySelectorAll('.navbar .nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');

  const tabBtn = document.querySelector(`.navbar [data-tab="${tabName}"]`);
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
  if (typeof setAiChatOpen === 'function') setAiChatOpen(false);
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

    if (state.user?.role === 'customer') {
      switchTab('my-orders');
    } else if (state.user?.role === 'pharmacist') {
      switchTab('pharmacist');
    } else if (state.user?.role === 'admin') {
      switchTab('admin');
    } else {
      switchTab('storefront');
    }
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
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
        ${prescriptions.map(p => `
          <div class="card" style="margin-bottom: 0;">
            <div style="height: 180px; border-radius: var(--radius-md); overflow: hidden; background: #f1f5f9; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; position: relative;">
              ${p.image_path.toLowerCase().endsWith('.pdf') ? `
                <div style="text-align:center;"><i class="fa-solid fa-file-pdf" style="font-size: 3rem; color: #ef4444;"></i><p style="font-size:0.8rem; margin-top:4px;">PDF Document</p></div>
              ` : `
                <img src="/${p.image_path}" alt="Prescription #${p.prescription_id}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'text-align:center;\\'><i class=\\'fa-solid fa-file-image\\' style=\\'font-size:3rem; color:#94a3b8;\\'></i><p style=\\'font-size:0.8rem; color:#94a3b8; margin-top:4px;\\'>Image File</p></div>'">
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
    const list = (res.data.prescriptions || []).slice().sort((a, b) => a.prescription_id - b.prescription_id);

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Customer</th>
            <th>Uploaded At</th>
            <th>Document</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((p, index) => `
            <tr>
              <td><strong>#${index + 1}</strong></td>
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
    const batches = (allRes.data.batches || []).slice().sort((a, b) => a.batch_id - b.batch_id);

    if (tableContainer) {
      tableContainer.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Medicine</th>
              <th>Batch No</th>
              <th>Quantity</th>
              <th>Expiry Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${batches.map((b, index) => `
              <tr>
                <td><strong>#${index + 1}</strong></td>
                <td><strong>${escapeHtml(b.medicine_name)}</strong></td>
                <td><code>${escapeHtml(b.batch_no)}</code></td>
                <td>${b.quantity}</td>
                <td>${new Date(b.expiry_date).toLocaleDateString()}</td>
                <td>
                  ${b.is_expired ? '<span class="status-pill status-rejected">Expired</span>' : '<span class="status-pill status-approved">Active</span>'}
                </td>
                <td>
                  <button class="btn btn-danger btn-sm" onclick="deleteBatchPrompt(${b.batch_id}, decodeURIComponent('${encodeURIComponent(b.batch_no)}'), decodeURIComponent('${encodeURIComponent(b.medicine_name)}'), ${b.is_expired})" title="${b.is_expired ? 'Dispose expired inventory lot' : 'Delete batch'}">
                    <i class="fa-solid fa-trash-can"></i> ${b.is_expired ? 'Dispose' : 'Delete'}
                  </button>
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

async function deleteBatchPrompt(id, batchNo, medicineName, isExpired) {
  const confirmed = await showConfirmDialog({
    title: isExpired ? 'Dispose Expired Batch?' : 'Delete Inventory Batch?',
    desc: isExpired
      ? 'Are you sure you want to write off and permanently remove this expired medicine batch?'
      : 'Are you sure you want to remove this supply batch from inventory?',
    itemName: `${medicineName || 'Medicine'} (Lot ${batchNo || `#${id}`})`,
    actionText: isExpired ? 'Dispose Expired Batch' : 'Delete Batch',
    note: isExpired
      ? 'Protected: Expired stock is already excluded from customer storefront sales.'
      : 'Permanent action: This batch record will be deleted from the database.',
    iconClass: isExpired ? 'fa-solid fa-trash-can' : 'fa-solid fa-trash-can'
  });

  if (!confirmed) return;

  try {
    const res = await API.deleteBatch(id);
    showToast(res.message || 'Batch removed successfully.', 'success');
    loadPharmacistBatches();
    loadMedicines();
    if (typeof loadAdminLowStock === 'function') loadAdminLowStock();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadPharmacistOrders() {
  const container = document.getElementById('pharmacistOrdersContainer');
  if (!container) return;

  try {
    const res = await API.getAllOrders();
    const orders = (res.data.orders || []).slice().sort((a, b) => a.order_id - b.order_id);

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Customer</th>
            <th>Total Amount</th>
            <th>Payment</th>
            <th>Current Status</th>
            <th>Update Status</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map((o, index) => `
            <tr>
              <td><strong>#${index + 1}</strong> <span style="font-size:0.75rem; color:var(--slate-light); font-weight:normal;">(Order #${o.order_id})</span></td>
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
    await loadAdminLowStock();

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

function switchLowStockMode(mode) {
  state.lowStockMode = mode;
  const tabBatches = document.getElementById('lowStockTabBatches');
  const tabMeds = document.getElementById('lowStockTabMeds');
  if (tabBatches && tabMeds) {
    if (mode === 'batches') {
      tabBatches.classList.add('active');
      tabMeds.classList.remove('active');
    } else {
      tabMeds.classList.add('active');
      tabBatches.classList.remove('active');
    }
  }
  loadAdminLowStock();
}

async function loadAdminLowStock() {
  const container = document.getElementById('adminLowStockContainer');
  const badge = document.getElementById('adminLowStockBadge');
  const thresholdSelect = document.getElementById('lowStockThresholdSelect');
  const threshold = parseInt(thresholdSelect?.value || 10, 10);
  const mode = state.lowStockMode || 'batches';

  if (!container) return;

  try {
    const res = await API.getLowStockReport(threshold);
    const data = res.data;
    const lowMeds = (data.low_stock_medicines || []).filter(m => m.available_stock <= threshold);
    const lowBatches = (data.low_stock_batches || []).filter(b => b.quantity <= threshold);

    const activeCount = mode === 'batches' ? lowBatches.length : lowMeds.length;

    if (badge) {
      badge.textContent = activeCount;
      badge.style.display = activeCount > 0 ? 'inline-block' : 'none';
    }

    if (mode === 'batches') {
      if (lowBatches.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: var(--slate);">
            <i class="fa-solid fa-circle-check" style="font-size: 2.2rem; color: #10b981; margin-bottom: 8px;"></i>
            <h4 style="color: var(--dark); margin-bottom: 4px;">All Batches Healthy</h4>
            <p style="font-size: 0.85rem;">No active batches found with quantity &le; ${threshold} units.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Batch / Lot</th>
              <th>Category</th>
              <th>Quantity Left</th>
              <th>Expiry Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="adminLowStockTable">
            ${lowBatches.map(b => {
              const isOut = b.quantity <= 0;
              const isCrit = b.quantity > 0 && b.quantity <= 5;
              const statusClass = isOut ? 'status-rejected' : (isCrit ? 'status-rejected' : 'status-pending');
              const statusLabel = isOut ? 'Depleted' : (isCrit ? 'Critical Low' : 'Low Stock');
              return `
                <tr>
                  <td><strong>${escapeHtml(b.medicine_name)}</strong></td>
                  <td><code>${escapeHtml(b.batch_no)}</code></td>
                  <td>${escapeHtml(b.category_name)}</td>
                  <td><span class="${isOut ? 'stock-out' : 'stock-low'} font-bold">${b.quantity} unit${b.quantity === 1 ? '' : 's'}</span></td>
                  <td>${new Date(b.expiry_date).toLocaleDateString()}</td>
                  <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } else {
      // By Medicine (Total non-expired inventory)
      if (lowMeds.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: var(--slate);">
            <i class="fa-solid fa-circle-check" style="font-size: 2.2rem; color: #10b981; margin-bottom: 8px;"></i>
            <h4 style="color: var(--dark); margin-bottom: 4px;">Optimal Stock Levels</h4>
            <p style="font-size: 0.85rem;">No medicines found with total stock &le; ${threshold} units.</p>
            <p style="font-size: 0.8rem; color: var(--slate); margin-top: 6px;">
              Tip: Switch to <strong>Low Batches</strong> above to see individual lots near exhaustion.
            </p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Category</th>
              <th>Total Stock</th>
              <th>Lowest Lot</th>
              <th>Unit Price</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="adminLowStockTable">
            ${lowMeds.map(m => {
              const isOut = m.available_stock <= 0;
              const isCrit = m.available_stock <= 10;
              const statusClass = isOut ? 'status-rejected' : (isCrit ? 'status-rejected' : 'status-pending');
              const statusLabel = isOut ? 'Depleted' : (isCrit ? 'Critical Low' : 'Low Stock');
              return `
                <tr>
                  <td><strong>${escapeHtml(m.name)}</strong><br><small style="color: var(--slate);">${escapeHtml(m.manufacturer || '')}</small></td>
                  <td>${escapeHtml(m.category_name)}</td>
                  <td><span class="${isOut ? 'stock-out' : 'stock-low'} font-bold">${m.available_stock} unit${m.available_stock === 1 ? '' : 's'}</span></td>
                  <td><span class="status-pill ${m.min_batch_qty <= 0 ? 'status-rejected' : 'status-pending'}" style="font-size:0.75rem;">Lot: ${m.min_batch_qty} left</span></td>
                  <td>$${m.price.toFixed(2)}</td>
                  <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger); padding: 20px;">Failed to load low-stock alerts: ${escapeHtml(err.message)}</p>`;
  }
}

async function loadAdminCategories() {
  const container = document.getElementById('adminCategoriesTableContainer');
  if (!container) return;
  try {
    const res = await API.getCategories();
    const categories = (res.data.categories || []).slice().sort((a, b) => a.category_id - b.category_id);
    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Category Name</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${categories.map((c, index) => `
            <tr>
              <td><strong>#${index + 1}</strong></td>
              <td><strong>${escapeHtml(c.name)}</strong></td>
              <td>
                <button class="btn btn-danger btn-sm" onclick="deleteCategoryPrompt(${c.category_id}, decodeURIComponent('${encodeURIComponent(c.name)}'))" title="Delete Category">
                  <i class="fa-solid fa-trash-can"></i> Delete
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
  const confirmed = await showConfirmDialog({
    title: 'Delete Category?',
    desc: 'Are you sure you want to remove this therapeutic category from the database?',
    itemName: name || `Category #${id}`,
    actionText: 'Delete Category',
    note: 'Protected: If any medicines are assigned to this category, deletion will be blocked by system integrity rules (409 Conflict).'
  });

  if (!confirmed) return;

  try {
    const res = await API.deleteCategory(id);
    showToast(res.message || 'Category deleted successfully.', 'success');
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
            <th>#</th>
            <th>Name</th>
            <th>Category</th>
            <th>Price</th>
            <th>Rx</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${res.data.medicines.map((m, index) => `
            <tr>
              <td><strong>#${index + 1}</strong></td>
              <td><strong>${escapeHtml(m.name)}</strong><br><small>${escapeHtml(m.manufacturer || '')}</small></td>
              <td>${escapeHtml(m.category_name)}</td>
              <td>$${m.price.toFixed(2)}</td>
              <td>${m.requires_prescription ? '<span class="status-pill status-rejected">Rx</span>' : '<span class="status-pill status-approved">OTC</span>'}</td>
              <td>
                <button class="btn btn-danger btn-sm" onclick="deleteMedicinePrompt(${m.medicine_id}, decodeURIComponent('${encodeURIComponent(m.name)}'))" title="Delete Medicine">
                  <i class="fa-solid fa-trash-can"></i>
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

async function openAddMedicineModal() {
  const select = document.getElementById('medCategorySelect');
  if (select) {
    try {
      if (!state.categories || state.categories.length === 0) {
        const res = await API.getCategories();
        state.categories = res.data.categories || [];
      }
      select.innerHTML = state.categories.map(c => `
        <option value="${c.category_id}">${escapeHtml(c.name)}</option>
      `).join('');
    } catch {
      select.innerHTML = '<option value="">Failed to load categories</option>';
    }
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
  const confirmed = await showConfirmDialog({
    title: 'Delete Medicine?',
    desc: 'Are you sure you want to permanently remove this medicine from the catalog?',
    itemName: name || `Medicine #${id}`,
    actionText: 'Delete Medicine',
    note: 'Protected: If this medicine has active inventory batches or past order history, deletion will be blocked by system integrity rules (409 Conflict).'
  });

  if (!confirmed) return;

  try {
    const res = await API.deleteMedicine(id);
    showToast(res.message || 'Medicine deleted successfully.', 'success');
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
            <th>#</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Change Role</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((u, index) => `
            <tr>
              <td><strong>#${index + 1}</strong></td>
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

// Custom Attractive Confirmation Dialog
function showConfirmDialog({
  title = 'Confirm Permanent Deletion',
  desc = 'Are you sure you want to delete this item? This action cannot be undone.',
  itemName = '',
  actionText = 'Delete',
  note = 'Protected: Active inventory batches or order history will be protected by conflict check (409 Conflict).',
  iconClass = 'fa-solid fa-trash-can'
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const descEl = document.getElementById('confirmDesc');
    const pillEl = document.getElementById('confirmItemPill');
    const noteEl = document.getElementById('confirmNote');
    const actionBtn = document.getElementById('confirmActionBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    const actionTextEl = document.getElementById('confirmActionBtnText');
    const iconEl = document.getElementById('confirmIcon');

    if (!modal) {
      resolve(window.confirm(`${title}\n${desc}`));
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;

    if (pillEl) {
      if (itemName) {
        pillEl.innerHTML = `<i class="fa-solid fa-tag"></i> <span>${escapeHtml(itemName)}</span>`;
        pillEl.style.display = 'inline-flex';
      } else {
        pillEl.style.display = 'none';
      }
    }

    if (noteEl) {
      if (note) {
        noteEl.innerHTML = `<i class="fa-solid fa-shield-halved"></i> <span>${escapeHtml(note)}</span>`;
        noteEl.style.display = 'flex';
      } else {
        noteEl.style.display = 'none';
      }
    }

    if (actionTextEl) actionTextEl.textContent = actionText;
    if (iconEl && iconClass) iconEl.className = iconClass;

    function cleanup() {
      modal.classList.remove('open');
      actionBtn?.removeEventListener('click', onConfirm);
      cancelBtn?.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      window.removeEventListener('keydown', onKeyDown);
    }

    function onConfirm() {
      cleanup();
      resolve(true);
    }

    function onCancel() {
      cleanup();
      resolve(false);
    }

    function onBackdrop(e) {
      if (e.target === modal) onCancel();
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') onCancel();
    }

    actionBtn?.addEventListener('click', onConfirm);
    cancelBtn?.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    window.addEventListener('keydown', onKeyDown);

    modal.classList.add('open');
  });
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

  // Navigation tabs (main navbar only)
  document.querySelectorAll('.navbar .nav-tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      if (tabName) switchTab(tabName);
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

  // Close modals when clicking backdrop overlay
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
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

/* ======================================================================
   ROLE-BASED AI SUBSYSTEM (GROQ API INTEGRATION)
   ====================================================================== */
const aiState = {
  isOpen: false,
  currentUserId: null,
  conversations: {},
  history: [],
  isSending: false
};

function saveCurrentAiConversation() {
  const userKey = aiState.currentUserId || (state.user ? String(state.user.user_id) : 'guest');
  const container = document.getElementById('aiChatMessages');
  if (!container) return;
  const data = {
    history: aiState.history || [],
    html: container.innerHTML
  };
  try {
    sessionStorage.setItem(`ai_chat_${userKey}`, JSON.stringify(data));
  } catch (e) {
    // fallback if sessionStorage unavailable
  }
  aiState.conversations[userKey] = data;
}

function loadAiConversation(userKey) {
  try {
    const raw = sessionStorage.getItem(`ai_chat_${userKey}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return aiState.conversations[userKey] || null;
}

function clearAiConversationStorage(userKey) {
  try {
    sessionStorage.removeItem(`ai_chat_${userKey}`);
  } catch (e) {}
  delete aiState.conversations[userKey];
}

const AI_SUGGESTIONS = {
  customer: [
    { label: '💊 Side effects of Sitagliptin', text: 'What is Sitagliptin and what are its common side effects?' },
    { label: '📋 Does Amoxicillin need Rx?', text: 'Does Amoxicillin 500mg require a doctor prescription?' },
    { label: '📦 Status of my orders', text: 'Can you check the current status of my recent orders?' },
    { label: '🔍 Pain relief medicines', text: 'Which OTC medicines are available in the catalog for fast pain relief?' }
  ],
  pharmacist: [
    { label: '⚠️ Batches expiring in 30 days', text: 'Which medicine batches are expiring within the next 30 days?' },
    { label: '📉 Check low stock lots', text: 'Which inventory lots have fallen below critical stock (< 20 units)?' },
    { label: '📋 Pending prescriptions queue', text: 'Are there any customer prescriptions currently waiting for clinical review?' },
    { label: '📦 Orders in fulfillment', text: 'List the customer orders currently waiting to be confirmed or shipped.' }
  ],
  admin: [
    { label: '📊 Total revenue & sales overview', text: 'Please provide our total net revenue, total completed orders, and average order value.' },
    { label: '🏆 Top 5 selling medicines', text: 'What are our top 5 best-selling medicines by volume and generated revenue?' },
    { label: '📉 Low stock inventory health', text: 'Give me a management summary of all medicines near exhaustion.' },
    { label: '👥 Registered users & staff', text: 'How many customer and staff accounts are currently registered in the system?' }
  ]
};

function initAiAssistant() {
  const closeBtn = document.getElementById('aiChatCloseBtn');
  const clearBtn = document.getElementById('aiChatClearBtn');
  const form = document.getElementById('aiChatForm');

  initDraggableAiButton();

  closeBtn?.addEventListener('click', () => setAiChatOpen(false));
  clearBtn?.addEventListener('click', clearAiChatHistory);
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('aiChatInput');
    const text = input ? input.value.trim() : '';
    if (text) {
      input.value = '';
      sendAiMessage(text);
    }
  });

  updateAiRoleUI();

  // Expose helpers globally for HTML inline handlers
  window.handleAiChipClick = handleAiChipClick;
  window.clearAiChatHistory = clearAiChatHistory;
  window.toggleAiChat = toggleAiChat;
  window.setAiChatOpen = setAiChatOpen;
}

function initDraggableAiButton() {
  const btn = document.getElementById('aiChatToggleBtn');
  if (!btn) return;

  // Restore saved position if present
  try {
    const saved = localStorage.getItem('ai_btn_pos');
    if (saved) {
      const pos = JSON.parse(saved);
      if (typeof pos.left === 'number' && typeof pos.top === 'number') {
        const maxLeft = Math.max(10, window.innerWidth - 180);
        const maxTop = Math.max(10, window.innerHeight - 60);
        const clampLeft = Math.min(Math.max(10, pos.left), maxLeft);
        const clampTop = Math.min(Math.max(10, pos.top), maxTop);
        btn.style.left = `${clampLeft}px`;
        btn.style.top = `${clampTop}px`;
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
      }
    }
  } catch (e) {}

  let isPointerDown = false;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;
  let hasMoved = false;

  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;

    isPointerDown = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;

    const rect = btn.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    btn.setPointerCapture(e.pointerId);
  });

  btn.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    const dist = Math.hypot(deltaX, deltaY);

    if (dist > 5) {
      if (!isDragging) {
        isDragging = true;
        btn.classList.add('is-dragging');
      }
      hasMoved = true;

      const rect = btn.getBoundingClientRect();
      const minLeft = 10;
      const maxLeft = window.innerWidth - rect.width - 10;
      const minTop = 10;
      const maxTop = window.innerHeight - rect.height - 10;

      let newLeft = initialLeft + deltaX;
      let newTop = initialTop + deltaY;

      newLeft = Math.min(Math.max(minLeft, newLeft), Math.max(minLeft, maxLeft));
      newTop = Math.min(Math.max(minTop, newTop), Math.max(minTop, maxTop));

      btn.style.left = `${newLeft}px`;
      btn.style.top = `${newTop}px`;
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';

      if (aiState.isOpen) {
        positionAiChatWindow();
      }
    }
  });

  const onPointerUp = (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;

    if (isDragging) {
      btn.classList.remove('is-dragging');
      isDragging = false;

      try {
        const rect = btn.getBoundingClientRect();
        localStorage.setItem('ai_btn_pos', JSON.stringify({ left: rect.left, top: rect.top }));
      } catch (err) {}
    }

    try {
      btn.releasePointerCapture(e.pointerId);
    } catch (err) {}
  };

  btn.addEventListener('pointerup', onPointerUp);
  btn.addEventListener('pointercancel', onPointerUp);

  // Toggle chat only if not dragged
  btn.addEventListener('click', (e) => {
    if (hasMoved) {
      e.preventDefault();
      e.stopImmediatePropagation();
      hasMoved = false;
      return;
    }
    toggleAiChat();
  });

  window.addEventListener('resize', () => {
    const rect = btn.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - 10;
    const maxTop = window.innerHeight - rect.height - 10;
    if (rect.left > maxLeft || rect.top > maxTop) {
      const clampLeft = Math.min(rect.left, Math.max(10, maxLeft));
      const clampTop = Math.min(rect.top, Math.max(10, maxTop));
      btn.style.left = `${clampLeft}px`;
      btn.style.top = `${clampTop}px`;
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }
    if (aiState.isOpen) {
      positionAiChatWindow();
    }
  });
}

function positionAiChatWindow() {
  const windowEl = document.getElementById('aiChatWindow');
  const btn = document.getElementById('aiChatToggleBtn');
  if (!windowEl || !btn) return;

  const btnRect = btn.getBoundingClientRect();
  const winWidth = Math.min(440, window.innerWidth - 32);
  const winHeight = Math.min(620, window.innerHeight - 100);

  let left = btnRect.right - winWidth;
  if (left < 16) left = btnRect.left;
  if (left < 16) left = 16;
  if (left + winWidth > window.innerWidth - 16) {
    left = window.innerWidth - winWidth - 16;
  }

  let top = btnRect.top - winHeight - 12;
  if (top < 16) {
    top = btnRect.bottom + 12;
  }
  if (top + winHeight > window.innerHeight - 16) {
    top = window.innerHeight - winHeight - 16;
  }
  if (top < 16) top = 16;

  windowEl.style.left = `${left}px`;
  windowEl.style.top = `${top}px`;
  windowEl.style.right = 'auto';
  windowEl.style.bottom = 'auto';
}

function toggleAiChat() {
  setAiChatOpen(!aiState.isOpen);
}

function setAiChatOpen(open) {
  aiState.isOpen = open;
  const windowEl = document.getElementById('aiChatWindow');
  if (windowEl) {
    windowEl.style.display = open ? 'flex' : 'none';
    if (open) {
      positionAiChatWindow();
    }
  }

  if (open) {
    updateAiRoleUI();
    const container = document.getElementById('aiChatMessages');
    if (container && container.children.length === 0) {
      renderWelcomeAiMessage();
    }
    setTimeout(() => document.getElementById('aiChatInput')?.focus(), 150);
  }
}

function updateAiRoleUI() {
  const role = state.user?.role || 'customer';
  const newUserId = state.user ? String(state.user.user_id) : 'guest';
  const roleBadge = document.getElementById('aiChatRoleBadge');
  const roleIndicator = document.getElementById('aiRoleIndicator');
  const chipsContainer = document.getElementById('aiSuggestionChips');
  const container = document.getElementById('aiChatMessages');

  const titles = {
    customer: 'Customer Health AI',
    pharmacist: 'Pharmacist Clinical AI',
    admin: 'Executive Admin AI'
  };

  const badgeLabels = {
    customer: 'Patient AI',
    pharmacist: 'Pharma AI',
    admin: 'Admin AI'
  };

  if (roleBadge) roleBadge.textContent = titles[role] || 'PharmaCare AI';
  if (roleIndicator) roleIndicator.textContent = badgeLabels[role] || 'AI';

  if (chipsContainer) {
    const suggestions = AI_SUGGESTIONS[role] || AI_SUGGESTIONS.customer;
    chipsContainer.innerHTML = suggestions.map(s => `
      <button type="button" class="ai-chip" onclick="handleAiChipClick(decodeURIComponent('${encodeURIComponent(s.text)}'))">
        ${escapeHtml(s.label)}
      </button>
    `).join('');
  }

  // Strict session and conversation isolation between users/roles
  if (aiState.currentUserId !== newUserId) {
    // 1. Save previous user's conversation if active
    if (aiState.currentUserId !== null) {
      saveCurrentAiConversation();
    }

    // 2. Switch active user ID
    aiState.currentUserId = newUserId;

    // Reset typed input
    const inputEl = document.getElementById('aiChatInput');
    if (inputEl) inputEl.value = '';

    // 3. Load conversation for the new user or start clean
    const saved = loadAiConversation(newUserId);
    if (saved && saved.html && Array.isArray(saved.history) && saved.history.length > 0) {
      aiState.history = [...saved.history];
      if (container) {
        container.innerHTML = saved.html;
        container.scrollTop = container.scrollHeight;
      }
    } else {
      aiState.history = [];
      if (container) {
        container.innerHTML = '';
        renderWelcomeAiMessage();
      }
    }
  } else {
    // Same user: ensure container has welcome message if empty
    if (container && container.children.length === 0) {
      renderWelcomeAiMessage();
    }
  }
}

function renderWelcomeAiMessage() {
  const container = document.getElementById('aiChatMessages');
  if (!container) return;

  const role = state.user?.role || 'customer';
  const name = state.user?.name || 'there';

  let greeting = '';
  if (role === 'customer') {
    greeting = `Hello <strong>${escapeHtml(name)}</strong>! 👋 I am your <strong>PharmaCare Health Assistant</strong>.<br><br>I can help you with medicine information, side effects, precautions, OTC requirements, or tracking your personal orders.<br><br><em>How can I assist your health today?</em>`;
  } else if (role === 'pharmacist') {
    greeting = `Welcome <strong>${escapeHtml(name)}</strong>! 🩺 I am your <strong>Clinical & Inventory Assistant</strong>.<br><br>I can inspect batch lot numbers, track near-expiry batches (FEFO), review low stock alerts, or check pending prescriptions and fulfillment queues.<br><br><em>What inventory or clinical task should we check?</em>`;
  } else {
    greeting = `Welcome <strong>${escapeHtml(name)}</strong>! 📊 I am your <strong>Executive Operations AI</strong>.<br><br>I have full visibility across business revenue, order fulfillment, best-selling medicines, and inventory health.<br><br><em>Ready to analyze system performance.</em>`;
  }

  container.innerHTML = `
    <div class="ai-msg ai-msg-assistant">
      <div class="ai-msg-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="ai-bubble">${greeting}</div>
    </div>
  `;
}

function handleAiChipClick(text) {
  const input = document.getElementById('aiChatInput');
  if (input) input.value = text;
  sendAiMessage(text);
}

function clearAiChatHistory() {
  aiState.history = [];
  const currentKey = aiState.currentUserId || (state.user ? String(state.user.user_id) : 'guest');
  clearAiConversationStorage(currentKey);
  const container = document.getElementById('aiChatMessages');
  if (container) container.innerHTML = '';
  renderWelcomeAiMessage();
  showToast('AI conversation reset for this account.', 'success');
}

async function sendAiMessage(userText) {
  if (aiState.isSending) return;

  if (!state.user) {
    showToast('Please log in or select a demo account to chat with AI.', 'warning');
    openModal('loginModal');
    return;
  }

  const messagesContainer = document.getElementById('aiChatMessages');
  const inputEl = document.getElementById('aiChatInput');
  const submitBtn = document.getElementById('aiChatSubmitBtn');
  if (!messagesContainer) return;

  // Append user message bubble
  const userMsgEl = document.createElement('div');
  userMsgEl.className = 'ai-msg ai-msg-user';
  userMsgEl.innerHTML = `
    <div class="ai-msg-avatar"><i class="fa-solid fa-user"></i></div>
    <div class="ai-bubble">${escapeHtml(userText)}</div>
  `;
  messagesContainer.appendChild(userMsgEl);

  // Append typing indicator
  const typingEl = document.createElement('div');
  typingEl.className = 'ai-msg ai-msg-assistant';
  typingEl.id = 'aiTypingIndicator';
  typingEl.innerHTML = `
    <div class="ai-msg-avatar"><i class="fa-solid fa-robot"></i></div>
    <div class="ai-typing-indicator">
      <div class="ai-typing-dot"></div>
      <div class="ai-typing-dot"></div>
      <div class="ai-typing-dot"></div>
    </div>
  `;
  messagesContainer.appendChild(typingEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Lock input during request
  aiState.isSending = true;
  if (inputEl) inputEl.disabled = true;
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await API.sendAiChat(userText, aiState.history);
    typingEl.remove();

    const data = res.data;
    const replyText = data?.reply || 'I received your request.';
    const toolsUsed = data?.toolsUsed || [];

    // Append to local history
    aiState.history.push({ role: 'user', content: userText });
    aiState.history.push({ role: 'assistant', content: replyText });

    // Format tool usage badges if any tool was executed
    let toolBadgeHtml = '';
    if (toolsUsed.length > 0) {
      toolBadgeHtml = `
        <div style="margin-bottom: 6px;">
          ${toolsUsed.map(t => `
            <span class="ai-tool-tag" title="Read-only API call">
              <i class="fa-solid fa-bolt" style="color: #0d9488;"></i> Executed: ${escapeHtml(t.name)}
            </span>
          `).join(' ')}
        </div>
      `;
    }

    // Append assistant bubble
    const aiMsgEl = document.createElement('div');
    aiMsgEl.className = 'ai-msg ai-msg-assistant';
    aiMsgEl.innerHTML = `
      <div class="ai-msg-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="ai-bubble">
        ${toolBadgeHtml}
        <div>${formatAiMarkdown(replyText)}</div>
      </div>
    `;
    messagesContainer.appendChild(aiMsgEl);

  } catch (err) {
    typingEl.remove();
    const errMsgEl = document.createElement('div');
    errMsgEl.className = 'ai-msg ai-msg-assistant';
    errMsgEl.innerHTML = `
      <div class="ai-msg-avatar" style="background:#fee2e2; color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div class="ai-bubble" style="border-color:#fecaca; background:#fff5f5; color:#991b1b;">
        <strong>AI Assistant Error:</strong> ${escapeHtml(err.message)}
      </div>
    `;
    messagesContainer.appendChild(errMsgEl);
  } finally {
    saveCurrentAiConversation();
    aiState.isSending = false;
    if (inputEl) {
      inputEl.disabled = false;
      inputEl.focus();
    }
    if (submitBtn) submitBtn.disabled = false;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

function formatAiMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // Markdown Tables
  html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (tableMatch) => {
    const lines = tableMatch.trim().split(/\r?\n/);
    if (lines.length < 2) return tableMatch;
    let tableHtml = '<div style="overflow-x:auto; margin: 8px 0;"><table style="border-collapse: collapse; width: 100%; font-size: 0.8rem;">';
    let isHeader = true;
    for (const line of lines) {
      if (line.match(/^\|(?:\s*[:-]+[-| :]*)\|$/)) {
        isHeader = false;
        continue;
      }
      const cells = line.split('|').slice(1, -1);
      tableHtml += '<tr>';
      for (const cell of cells) {
        tableHtml += isHeader
          ? `<th style="border: 1px solid #cbd5e1; padding: 6px 8px; background: #f8fafc; font-weight:700;">${cell.trim()}</th>`
          : `<td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${cell.trim()}</td>`;
      }
      tableHtml += '</tr>';
      isHeader = false;
    }
    tableHtml += '</table></div>';
    return tableHtml;
  });

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h5 style="margin: 8px 0 4px; font-weight:700; color:#0f172a;">$1</h5>');
  html = html.replace(/^## (.*$)/gim, '<h4 style="margin: 10px 0 6px; font-weight:700; color:#0f766e;">$1</h4>');

  // Bold & Italics
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline Code
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9; color:#0f766e; padding:2px 5px; border-radius:4px; font-size:0.8rem;">$1</code>');

  // Unordered list items
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul style="margin: 6px 0 6px 18px; padding:0;">$1</ul>');
  html = html.replace(/<\/ul>\s*<ul[^>]*>/g, '');

  // Line breaks
  html = html.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');

  return html;
}

