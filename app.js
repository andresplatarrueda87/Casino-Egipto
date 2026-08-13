/* ==========================================================================
   CASINO EGIPTO - Core Application Logic
   ========================================================================== */

// --- 1. Database Initialization (Dexie.js) ---
const db = new Dexie('casino_egipto_db');
db.version(1).stores({
  menuItems: '++id, name, category, price',
  accounts: 'id, clientName, dateStart, dateEnd, total',
  settings: 'key, value'
});

// Seed Data for Initial Menu Items
const DEFAULT_MENU_ITEMS = [
  { name: "Almuerzo", price: 16000, category: "Almuerzos", img: "img/almuerzo.jpg" },
  { name: "Almuerzo con Sopa", price: 17000, category: "Almuerzos", img: "img/almuerzo_sopa.jpg" },
  { name: "Desayuno", price: 9000, category: "Desayunos", img: "img/desayuno.jpg" },
  { name: "Agua botella 600 ml", price: 2000, category: "Bebidas", img: "img/agua_botella.jpg" }
];

const DEFAULT_USER_NAME = "Andres Platarrueda";
const DEFAULT_BANCOLOMBIA_NUM = "838-567083-43";
const DEFAULT_BANCOLOMBIA_TYPE = "Cuenta Corriente";
const DEFAULT_NEQUI_NUM = "3001234567";

// --- 2. Application State ---
const STATE = {
  activeAccountId: null,
  cart: {}, // Maps itemId -> { id, name, price, qty, img, category }
  currentCategory: 'todos',
  userName: DEFAULT_USER_NAME,
  bancolombiaNum: DEFAULT_BANCOLOMBIA_NUM,
  bancolombiaType: DEFAULT_BANCOLOMBIA_TYPE,
  nequiNum: DEFAULT_NEQUI_NUM,
  isAccountStarted: false,
  dateStart: new Date(),
  dateEnd: new Date()
};

// --- 3. Toast Notification Helper ---
function showToast(message, type = 'info', duration = 1800) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠️',
    info: 'ℹ'
  };
  const icon = icons[type] || '✓';
  
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 350);
  }, duration);
}

// Format Currency COP (e.g. $ 16.000)
function formatCurrency(amount) {
  const formatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
  return formatted.replace('COP', '$').trim();
}

function formatDateTimeISO(date) {
  if (!date) return '';
  const d = new Date(date);
  const pad = num => String(num).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTimeShort(date) {
  if (!date) return '';
  const d = new Date(date);
  const pad = num => String(num).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// --- 4. DOM Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  registerServiceWorker();
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  await initializeMenuSeedData();
  await loadUserSettings();
  setupNavigation();
  setupEventListeners();
  
  initNewAccountState();
  await renderMenuGrid();
  await renderCartView();
});

async function initializeMenuSeedData() {
  const count = await db.menuItems.count();
  if (count === 0) {
    for (const item of DEFAULT_MENU_ITEMS) {
      await db.menuItems.add(item);
    }
  }
}

async function loadUserSettings() {
  const setting = await db.settings.get('userName');
  if (setting && setting.value) {
    STATE.userName = setting.value;
  } else {
    STATE.userName = DEFAULT_USER_NAME;
    await db.settings.put({ key: 'userName', value: DEFAULT_USER_NAME });
  }
  
  const bNum = await db.settings.get('bancolombiaNum');
  STATE.bancolombiaNum = bNum ? bNum.value : DEFAULT_BANCOLOMBIA_NUM;
  if (!bNum) await db.settings.put({ key: 'bancolombiaNum', value: DEFAULT_BANCOLOMBIA_NUM });

  const bType = await db.settings.get('bancolombiaType');
  STATE.bancolombiaType = bType ? bType.value : DEFAULT_BANCOLOMBIA_TYPE;
  if (!bType) await db.settings.put({ key: 'bancolombiaType', value: DEFAULT_BANCOLOMBIA_TYPE });

  const nNum = await db.settings.get('nequiNum');
  STATE.nequiNum = nNum ? nNum.value : DEFAULT_NEQUI_NUM;
  if (!nNum) await db.settings.put({ key: 'nequiNum', value: DEFAULT_NEQUI_NUM });

  const displayEl = document.getElementById('cuenta-user-display');
  if (displayEl) displayEl.innerText = STATE.userName;
  
  const inputEl = document.getElementById('user-name-input');
  if (inputEl) inputEl.value = STATE.userName;

  const bNumInput = document.getElementById('bancolombia-num-input');
  if (bNumInput) bNumInput.value = STATE.bancolombiaNum;

  const bTypeInput = document.getElementById('bancolombia-type-input');
  if (bTypeInput) bTypeInput.value = STATE.bancolombiaType;

  const nNumInput = document.getElementById('nequi-num-input');
  if (nNumInput) nNumInput.value = STATE.nequiNum;
}

function updateAccountStatusUI() {
  const badgeEl = document.getElementById('cuenta-status-badge');
  const iconEl = document.getElementById('btn-save-icon');
  const textEl = document.getElementById('btn-save-text');
  
  const hasCartItems = Object.keys(STATE.cart).length > 0;
  const isStarted = STATE.isAccountStarted || hasCartItems;
  
  if (isStarted) {
    if (badgeEl) {
      badgeEl.innerText = "Cuenta Abierta";
      badgeEl.className = "account-status-badge open";
    }
    if (iconEl) iconEl.innerText = "💾";
    if (textEl) textEl.innerText = "Guardar Cuenta";
  } else {
    if (badgeEl) {
      badgeEl.innerText = "Nueva Cuenta";
      badgeEl.className = "account-status-badge new";
    }
    if (iconEl) iconEl.innerText = "🚀";
    if (textEl) textEl.innerText = "Iniciar Cuenta";
  }
}

function initNewAccountState() {
  const now = new Date();
  STATE.activeAccountId = `CUENTA-${now.getTime()}`;
  STATE.cart = {};
  STATE.isAccountStarted = false;
  STATE.dateStart = now;
  STATE.dateEnd = now;
  
  const startEl = document.getElementById('cuenta-fecha-inicio');
  const finEl = document.getElementById('cuenta-fecha-fin');
  if (startEl) startEl.value = formatDateTimeISO(STATE.dateStart);
  if (finEl) finEl.value = formatDateTimeISO(STATE.dateEnd);
  
  updateAccountStatusUI();
  updateCartNavBadge();
}

// --- 5. Navigation ---
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const panels = document.querySelectorAll('.view-panel');
  
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPanelId = btn.getAttribute('data-target');
      
      navButtons.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const targetPanel = document.getElementById(targetPanelId);
      targetPanel.classList.add('active');
      
      if (targetPanelId === 'panel-historico') {
        renderHistoryList();
      } else if (targetPanelId === 'panel-ajustes') {
        renderSettingsMenuList();
      } else if (targetPanelId === 'panel-cuenta') {
        renderCartView();
      }
    });
  });
}

// --- 6. Menu Grid Rendering ---
async function renderMenuGrid() {
  const grid = document.getElementById('menu-grid');
  grid.innerHTML = '';
  
  const searchVal = document.getElementById('search-menu').value.trim().toLowerCase();
  let items = await db.menuItems.toArray();
  
  if (STATE.currentCategory !== 'todos') {
    items = items.filter(i => i.category.toLowerCase() === STATE.currentCategory.toLowerCase());
  }
  
  if (searchVal) {
    items = items.filter(i => i.name.toLowerCase().includes(searchVal) || (i.category && i.category.toLowerCase().includes(searchVal)));
  }
  
  if (items.length === 0) {
    grid.innerHTML = `
      <div class="card margin-top-12" style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 30px;">
        <p>No se encontraron productos en el menú.</p>
      </div>
    `;
    return;
  }
  
  items.forEach(item => {
    const activeQty = STATE.cart[item.id] ? STATE.cart[item.id].qty : 0;
    const card = document.createElement('div');
    card.className = 'menu-card';
    card.innerHTML = `
      <div class="menu-card-img-wrapper">
        <img src="${item.img || 'img/almuerzo.jpg'}" alt="${item.name}" class="menu-card-img" onerror="this.src='img/almuerzo.jpg'">
        <span class="menu-card-badge">${item.category || 'General'}</span>
      </div>
      <div class="menu-card-body">
        <h4 class="menu-card-title">${item.name}</h4>
        <div class="menu-card-price">${formatCurrency(item.price)}</div>
        <button class="btn btn-primary btn-sm btn-block btn-add-to-cart" data-id="${item.id}">
          <span class="btn-icon">${activeQty > 0 ? '✓' : '+'}</span>
          <span>${activeQty > 0 ? `Agregado (${activeQty})` : 'Agregar a Cuenta'}</span>
        </button>
      </div>
    `;
    
    card.querySelector('.btn-add-to-cart').addEventListener('click', () => {
      addToCart(item);
    });
    
    grid.appendChild(card);
  });
}

function addToCart(item) {
  STATE.isAccountStarted = true;
  
  if (STATE.cart[item.id]) {
    STATE.cart[item.id].qty += 1;
  } else {
    // Snapshot current item price and data
    STATE.cart[item.id] = {
      id: item.id,
      name: item.name,
      price: item.price,
      qty: 1,
      img: item.img,
      category: item.category
    };
  }
  
  showToast(`+1 ${item.name} agregado`, 'success', 1200);
  updateAccountStatusUI();
  updateCartNavBadge();
  renderMenuGrid();
}

function updateCartNavBadge() {
  const badge = document.getElementById('cart-nav-badge');
  const totalQty = Object.values(STATE.cart).reduce((sum, item) => sum + item.qty, 0);
  
  if (totalQty > 0) {
    badge.innerText = totalQty;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

// --- 7. Cart & Order View Rendering ---
function renderCartView() {
  const container = document.getElementById('cart-items-container');
  container.innerHTML = '';
  
  const cartList = Object.values(STATE.cart);
  let grandTotal = 0;
  let totalQty = 0;
  
  updateAccountStatusUI();
  
  if (cartList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary); padding: 25px 10px;">
        <p style="font-size: 32px; margin-bottom: 8px;">🛒</p>
        <p>No hay productos agregados a la cuenta actual.</p>
        <p style="font-size: 12px; margin-top: 4px;">Ve a la pestaña "Menú" para agregar consumos.</p>
      </div>
    `;
    document.getElementById('cart-grand-total').innerText = formatCurrency(0);
    document.getElementById('cart-items-summary').innerText = '0 productos en total';
    return;
  }
  
  cartList.forEach(item => {
    const subtotal = item.price * item.qty;
    grandTotal += subtotal;
    totalQty += item.qty;
    
    const row = document.createElement('div');
    row.className = 'cart-item-row';
    row.innerHTML = `
      <div class="cart-item-info">
        <img src="${item.img || 'img/almuerzo.jpg'}" class="cart-item-thumb" onerror="this.src='img/almuerzo.jpg'">
        <div>
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-unit-price">${formatCurrency(item.price)} c/u</div>
        </div>
      </div>
      <div class="cart-item-qty-controls">
        <button class="qty-btn btn-qty-minus" data-id="${item.id}">-</button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn btn-qty-plus" data-id="${item.id}">+</button>
      </div>
      <div class="cart-item-subtotal">${formatCurrency(subtotal)}</div>
      <button class="btn btn-text btn-remove-item" data-id="${item.id}" style="color: #ef4444; font-size: 16px; padding: 4px;">✕</button>
    `;
    
    row.querySelector('.btn-qty-minus').addEventListener('click', () => {
      if (STATE.cart[item.id].qty > 1) {
        STATE.cart[item.id].qty -= 1;
      } else {
        delete STATE.cart[item.id];
      }
      updateCartNavBadge();
      renderCartView();
      renderMenuGrid();
    });
    
    row.querySelector('.btn-qty-plus').addEventListener('click', () => {
      STATE.cart[item.id].qty += 1;
      updateCartNavBadge();
      renderCartView();
      renderMenuGrid();
    });
    
    row.querySelector('.btn-remove-item').addEventListener('click', () => {
      delete STATE.cart[item.id];
      updateCartNavBadge();
      renderCartView();
      renderMenuGrid();
    });
    
    container.appendChild(row);
  });
  
  document.getElementById('cart-grand-total').innerText = formatCurrency(grandTotal);
  document.getElementById('cart-items-summary').innerText = `${totalQty} producto(s) consumido(s)`;
}

// --- 8. Event Listeners Setup ---
function setupEventListeners() {
  const catBtns = document.querySelectorAll('.cat-btn');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.currentCategory = btn.getAttribute('data-cat');
      renderMenuGrid();
    });
  });
  
  document.getElementById('search-menu').addEventListener('input', renderMenuGrid);
  
  // Save / Start Account Listener
  document.getElementById('btn-save-account').addEventListener('click', async () => {
    const isStarted = STATE.isAccountStarted || Object.keys(STATE.cart).length > 0;
    if (!isStarted) {
      STATE.isAccountStarted = true;
      updateAccountStatusUI();
      showToast("Cuenta iniciada. Agrega tus consumos desde el Menú.", "info", 2000);
      document.querySelector('.nav-btn[data-target="panel-menu"]').click();
      return;
    }
    
    await saveAccountFromUI(true);
  });
  
  // Generate Ticket PDF
  document.getElementById('btn-generate-pdf-main').addEventListener('click', async () => {
    const accountData = getAccountDataFromUI();
    if (!accountData || accountData.items.length === 0) {
      showToast("Debe agregar al menos un producto a la cuenta", "warning", 2000);
      return;
    }
    await saveAccountFromUI(false);
    await generateTicketPdf(accountData);
  });
  
  // Send Email Listener
  document.getElementById('btn-send-email-main').addEventListener('click', async () => {
    const accountData = getAccountDataFromUI();
    if (!accountData || accountData.items.length === 0) {
      showToast("Debe agregar al menos un producto a la cuenta", "warning", 2000);
      return;
    }
    await saveAccountFromUI(false);
    await sendAccountByEmail(accountData);
  });
  
  // Finalize Account Listener ("Limpiar" -> "Finalizar Cuenta")
  document.getElementById('btn-clear-account').addEventListener('click', async () => {
    const cartItemsCount = Object.keys(STATE.cart).length;
    if (cartItemsCount === 0 && !STATE.isAccountStarted) {
      showToast("No hay una cuenta activa para finalizar", "info", 1500);
      return;
    }
    
    if (confirm("¿Desea finalizar y cerrar la cuenta actual? Se guardará el consumo final en el histórico y el botón volverá a Iniciar Cuenta.")) {
      if (cartItemsCount > 0) {
        await saveAccountFromUI(false);
      }
      initNewAccountState();
      renderCartView();
      renderMenuGrid();
      showToast("Cuenta finalizada y guardada en el histórico. Listo para Iniciar Cuenta nueva.", "success", 2500);
    }
  });
  
  // User Config Save
  document.getElementById('btn-save-user-config').addEventListener('click', async () => {
    const newName = document.getElementById('user-name-input').value.trim();
    if (!newName) {
      showToast("Ingrese un nombre de usuario válido", "warning", 2000);
      return;
    }
    
    STATE.userName = newName;
    await db.settings.put({ key: 'userName', value: newName });
    document.getElementById('cuenta-user-display').innerText = newName;
    showToast("Configuración de usuario guardada", "success", 1800);
  });

  // Payment Config Save
  document.getElementById('btn-save-payment-config').addEventListener('click', async () => {
    const bNum = document.getElementById('bancolombia-num-input').value.trim();
    const bType = document.getElementById('bancolombia-type-input').value;
    const nNum = document.getElementById('nequi-num-input').value.trim();

    if (!bNum) {
      showToast("Ingrese el número de cuenta Bancolombia", "warning", 2000);
      return;
    }

    STATE.bancolombiaNum = bNum;
    STATE.bancolombiaType = bType;
    STATE.nequiNum = nNum || DEFAULT_NEQUI_NUM;

    await db.settings.put({ key: 'bancolombiaNum', value: STATE.bancolombiaNum });
    await db.settings.put({ key: 'bancolombiaType', value: STATE.bancolombiaType });
    await db.settings.put({ key: 'nequiNum', value: STATE.nequiNum });

    showToast("Métodos de pago guardados con éxito", "success", 1800);
  });

  // Payment Modal Trigger
  document.getElementById('btn-pay-modal').addEventListener('click', () => {
    openPaymentModal();
  });

  // Payment Modal Close
  document.getElementById('btn-close-payment-modal').addEventListener('click', () => {
    document.getElementById('payment-modal').style.display = 'none';
  });

  // Payment Modal Tabs
  const payTabs = document.querySelectorAll('.pay-tab-btn');
  payTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      payTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetTab = tab.getAttribute('data-tab');
      document.getElementById('tab-content-bancolombia').classList.remove('active');
      document.getElementById('tab-content-nequi').classList.remove('active');
      
      const activeContent = document.getElementById(`tab-content-${targetTab}`);
      if (activeContent) activeContent.classList.add('active');
    });
  });

  // Copy Buttons
  document.getElementById('btn-copy-bancolombia').addEventListener('click', () => {
    const grandTotal = Object.values(STATE.cart).reduce((sum, i) => sum + (i.price * i.qty), 0);
    const textToCopy = `Bancolombia ${STATE.bancolombiaType}: ${STATE.bancolombiaNum}\nTotal a Pagar: ${formatCurrency(grandTotal)}`;
    navigator.clipboard.writeText(textToCopy);
    showToast("Datos de Bancolombia copiados al portapapeles", "success", 1800);
  });

  document.getElementById('btn-copy-nequi').addEventListener('click', () => {
    const grandTotal = Object.values(STATE.cart).reduce((sum, i) => sum + (i.price * i.qty), 0);
    const textToCopy = `Nequi: ${STATE.nequiNum}\nTotal a Pagar: ${formatCurrency(grandTotal)}`;
    navigator.clipboard.writeText(textToCopy);
    showToast("Datos de Nequi copiados al portapapeles", "success", 1800);
  });
  
  // Add / Edit Menu Item in Settings
  document.getElementById('btn-save-menu-item').addEventListener('click', async () => {
    const editingId = document.getElementById('editing-item-id').value;
    const name = document.getElementById('new-item-name').value.trim();
    const price = parseFloat(document.getElementById('new-item-price').value);
    const category = document.getElementById('new-item-cat').value;
    const img = document.getElementById('new-item-img').value.trim();
    
    if (!name || isNaN(price) || price <= 0) {
      showToast("Debe ingresar el nombre y un precio válido del producto", "warning", 2000);
      return;
    }
    
    const itemData = {
      name: name,
      price: price,
      category: category,
      img: img || 'img/almuerzo.jpg'
    };
    
    if (editingId) {
      itemData.id = parseInt(editingId, 10);
      await db.menuItems.put(itemData);
      showToast(`Producto "${name}" actualizado en el menú`, "success", 1800);
    } else {
      await db.menuItems.add(itemData);
      showToast(`Producto "${name}" guardado en el menú`, "success", 1800);
    }
    
    resetMenuItemForm();
    renderSettingsMenuList();
    renderMenuGrid();
  });
  
  document.getElementById('btn-cancel-menu-edit').addEventListener('click', () => {
    resetMenuItemForm();
  });
  
  setupBackupHandlers();
}

function resetMenuItemForm() {
  document.getElementById('editing-item-id').value = '';
  document.getElementById('new-item-name').value = '';
  document.getElementById('new-item-price').value = '';
  document.getElementById('new-item-img').value = '';
  document.getElementById('form-menu-item-title').innerText = 'Agregar / Editar Producto al Menú';
  document.getElementById('btn-menu-item-icon').innerText = '➕';
  document.getElementById('btn-menu-item-text').innerText = 'Guardar Producto en Menú';
  document.getElementById('btn-cancel-menu-edit').style.display = 'none';
}

function openPaymentModal() {
  const items = Object.values(STATE.cart);
  const grandTotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);

  if (items.length === 0 || grandTotal <= 0) {
    showToast("Debe agregar consumos a la cuenta antes de abrir el pago", "warning", 2000);
    return;
  }

  const formattedAmount = formatCurrency(grandTotal);

  document.getElementById('payment-modal-amount-subtitle').innerText = `Total a Pagar: ${formattedAmount}`;
  document.getElementById('pay-bancolombia-amount').innerText = formattedAmount;
  document.getElementById('pay-nequi-amount').innerText = formattedAmount;

  document.getElementById('pay-bancolombia-type').innerText = STATE.bancolombiaType;
  document.getElementById('pay-bancolombia-num').innerText = STATE.bancolombiaNum;
  document.getElementById('pay-nequi-num').innerText = STATE.nequiNum || "No configurado";

  // Render QR Codes using lib/qrcode.min.js
  const qrBancolombiaBox = document.getElementById('qr-bancolombia-box');
  qrBancolombiaBox.innerHTML = '';
  const bancolombiaPayload = `BANCOLOMBIA|${STATE.bancolombiaType}|${STATE.bancolombiaNum}|VALOR:${grandTotal}`;
  if (window.QRCode) {
    new QRCode(qrBancolombiaBox, { text: bancolombiaPayload, width: 180, height: 180 });
  }

  const qrNequiBox = document.getElementById('qr-nequi-box');
  qrNequiBox.innerHTML = '';
  const nequiPayload = `NEQUI|${STATE.nequiNum}|VALOR:${grandTotal}`;
  if (window.QRCode) {
    new QRCode(qrNequiBox, { text: nequiPayload, width: 180, height: 180 });
  }

  document.getElementById('payment-modal').style.display = 'flex';
}

function getAccountDataFromUI() {
  const clientName = STATE.userName || 'Usuario Casino';
  const dateStart = document.getElementById('cuenta-fecha-inicio').value;
  const dateEnd = document.getElementById('cuenta-fecha-fin').value;
  
  // Clone items with exact price snapshot at this time
  const items = Object.values(STATE.cart).map(i => ({
    id: i.id,
    name: i.name,
    price: i.price,
    qty: i.qty,
    category: i.category,
    img: i.img
  }));
  
  const total = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
  
  const now = new Date();
  
  return {
    id: STATE.activeAccountId || `CUENTA-${now.getTime()}`,
    clientName: clientName,
    notes: '',
    dateStart: dateStart || formatDateTimeISO(now),
    dateEnd: dateEnd || formatDateTimeISO(now),
    items: items,
    total: total,
    totalQty: totalQty,
    updatedAt: now.toISOString()
  };
}

async function saveAccountFromUI(showNotification = true) {
  const accountData = getAccountDataFromUI();
  if (!accountData.items || accountData.items.length === 0) {
    showToast("Debe agregar productos a la cuenta para poder guardar", "warning", 2000);
    return false;
  }
  
  try {
    await db.accounts.put(accountData);
    STATE.isAccountStarted = true;
    updateAccountStatusUI();
    if (showNotification) {
      showToast("Cuenta del Casino guardada con éxito", "success", 2000);
    }
    return true;
  } catch (e) {
    console.error(e);
    showToast("Error al guardar la cuenta: " + e.message, "error", 2500);
    return false;
  }
}

// --- 9. History View & Accordion Rendering ---
async function renderHistoryList() {
  const container = document.getElementById('history-list');
  container.innerHTML = '';
  
  const searchVal = document.getElementById('search-history').value.trim().toLowerCase();
  let accountsArray = await db.accounts.toArray();
  
  if (searchVal) {
    accountsArray = accountsArray.filter(a => 
      a.clientName.toLowerCase().includes(searchVal) ||
      a.id.toLowerCase().includes(searchVal)
    );
  }
  
  accountsArray.sort((a, b) => b.updatedAt ? b.updatedAt.localeCompare(a.updatedAt) : b.id.localeCompare(a.id));
  
  const grandSum = accountsArray.reduce((sum, a) => sum + (a.total || 0), 0);
  document.getElementById('history-total-sum').innerText = `Total Recaudado: ${formatCurrency(grandSum)}`;
  document.getElementById('history-count-badge').innerText = `${accountsArray.length} Cuentas`;
  
  if (accountsArray.length === 0) {
    container.innerHTML = `
      <div class="empty-state card">
        <div class="empty-icon" style="font-size: 36px; margin-bottom: 8px;">📜</div>
        <p>No se encontraron registros de cuentas guardadas.</p>
      </div>
    `;
    return;
  }
  
  accountsArray.forEach((account, index) => {
    const isExpandedDefault = (index === 0);
    const card = document.createElement('div');
    card.className = `card history-card ${isExpandedDefault ? 'expanded' : 'collapsed'}`;
    
    // items summary with exact historical price stored
    const itemsSummaryText = account.items ? account.items.map(i => `${i.qty}x ${i.name} (${formatCurrency(i.price)})`).join(', ') : 'Sin productos';
    
    const dateStartFormatted = formatDateTimeShort(account.dateStart);
    const dateEndFormatted = account.dateEnd ? formatDateTimeShort(account.dateEnd) : dateStartFormatted;
    const dateRangeHeader = `${dateStartFormatted} - ${dateEndFormatted}`;

    card.innerHTML = `
      <div class="history-header">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span class="history-client">${account.clientName || 'Usuario Casino'}</span>
          <span class="history-dates">${dateRangeHeader}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="history-total-badge">${formatCurrency(account.total)}</span>
          <button type="button" class="btn btn-text btn-sm btn-toggle-card" style="color: var(--color-primary); font-size: 14px; font-weight: 700; padding: 2px 6px;">
            <span class="toggle-text">${isExpandedDefault ? '▲' : '▼'}</span>
          </button>
        </div>
      </div>
      
      <div class="history-body" style="${isExpandedDefault ? 'display: block;' : 'display: none;'}">
        <div class="history-details margin-top-12">
          <span class="detail-badge">Inicio: ${formatDateTimeShort(account.dateStart)}</span>
          <span class="detail-badge">Último Consumo: ${formatDateTimeShort(account.dateEnd)}</span>
          <span class="detail-badge">Productos (${account.totalQty || 0}): ${itemsSummaryText}</span>
          <span class="detail-badge" style="border-color: rgba(59, 174, 42, 0.4); color: var(--color-primary);">🕒 Guardado: ${formatDateTimeShort(account.updatedAt)}</span>
        </div>
        <div class="history-actions margin-top-12">
          <button class="btn btn-secondary btn-sm btn-edit-account" data-id="${account.id}">Cargar / Editar</button>
          <button class="btn btn-accent btn-sm btn-pdf-account" data-id="${account.id}">Generar Ticket</button>
          <button class="btn btn-sm btn-email-account" data-id="${account.id}" style="background-color: #ea4335; color: #ffffff; border: none; font-weight: 500;">✉️ Correo</button>
          <button class="btn btn-danger btn-sm btn-delete-account" data-id="${account.id}">Eliminar</button>
        </div>
      </div>
    `;
    
    const headerEl = card.querySelector('.history-header');
    const bodyEl = card.querySelector('.history-body');
    const toggleTextEl = card.querySelector('.toggle-text');
    
    headerEl.addEventListener('click', () => {
      const isExpanded = card.classList.contains('expanded');
      if (isExpanded) {
        card.classList.remove('expanded');
        card.classList.add('collapsed');
        bodyEl.style.display = 'none';
        toggleTextEl.innerText = '▼';
      } else {
        card.classList.remove('collapsed');
        card.classList.add('expanded');
        bodyEl.style.display = 'block';
        toggleTextEl.innerText = '▲';
      }
    });
    
    card.querySelector('.btn-edit-account').addEventListener('click', () => {
      STATE.activeAccountId = account.id;
      STATE.cart = {};
      STATE.isAccountStarted = true;
      if (account.items) {
        account.items.forEach(i => {
          // Keep historical price when loading
          STATE.cart[i.id] = { ...i };
        });
      }
      
      const startEl = document.getElementById('cuenta-fecha-inicio');
      const finEl = document.getElementById('cuenta-fecha-fin');
      if (startEl) startEl.value = account.dateStart || '';
      if (finEl) finEl.value = account.dateEnd || '';
      
      updateAccountStatusUI();
      updateCartNavBadge();
      renderCartView();
      
      document.querySelector('.nav-btn[data-target="panel-cuenta"]').click();
      showToast("Cuenta cargada para edición", "info", 1800);
    });
    
    card.querySelector('.btn-pdf-account').addEventListener('click', () => {
      generateTicketPdf(account);
    });
    
    card.querySelector('.btn-email-account').addEventListener('click', () => {
      sendAccountByEmail(account);
    });
    
    card.querySelector('.btn-delete-account').addEventListener('click', async () => {
      if (confirm(`¿Eliminar la cuenta de ${account.clientName}?`)) {
        await db.accounts.delete(account.id);
        showToast("Cuenta eliminada", "info", 1500);
        renderHistoryList();
      }
    });
    
    container.appendChild(card);
  });
}

document.getElementById('search-history').addEventListener('input', renderHistoryList);

// --- 10. Settings Menu Items List Rendering ---
async function renderSettingsMenuList() {
  const container = document.getElementById('settings-menu-list');
  container.innerHTML = '';
  
  const items = await db.menuItems.toArray();
  if (items.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 10px;">No hay productos guardados.</p>';
    return;
  }
  
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'settings-menu-item-row';
    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <img src="${item.img || 'img/almuerzo.jpg'}" style="width: 36px; height: 36px; border-radius: 6px; object-fit: cover;" onerror="this.src='img/almuerzo.jpg'">
        <div>
          <div style="font-size: 13.5px; font-weight: 700; color: #ffffff;">${item.name}</div>
          <div style="font-size: 11.5px; color: var(--text-secondary);">${item.category} - ${formatCurrency(item.price)}</div>
        </div>
      </div>
      <div style="display: flex; gap: 6px;">
        <button class="btn btn-secondary btn-sm btn-edit-item" data-id="${item.id}" style="padding: 4px 8px; font-size: 12px;">Editar</button>
        <button class="btn btn-danger btn-sm btn-delete-item" data-id="${item.id}" style="padding: 4px 8px; font-size: 12px;">Eliminar</button>
      </div>
    `;
    
    row.querySelector('.btn-edit-item').addEventListener('click', () => {
      document.getElementById('editing-item-id').value = item.id;
      document.getElementById('new-item-name').value = item.name;
      document.getElementById('new-item-price').value = item.price;
      document.getElementById('new-item-cat').value = item.category || 'Almuerzos';
      document.getElementById('new-item-img').value = item.img || '';
      
      document.getElementById('form-menu-item-title').innerText = 'Editar Producto del Menú';
      document.getElementById('btn-menu-item-icon').innerText = '💾';
      document.getElementById('btn-menu-item-text').innerText = 'Actualizar Producto';
      document.getElementById('btn-cancel-menu-edit').style.display = 'inline-block';
      
      document.getElementById('form-menu-item-title').scrollIntoView({ behavior: 'smooth' });
    });
    
    row.querySelector('.btn-delete-item').addEventListener('click', async () => {
      if (confirm(`¿Eliminar ${item.name} del menú?`)) {
        await db.menuItems.delete(item.id);
        renderSettingsMenuList();
        renderMenuGrid();
        showToast("Producto eliminado del menú", "info", 1500);
      }
    });
    
    container.appendChild(row);
  });
}

// --- 11. Ticket PDF Generation (`pdf-lib.js`) ---
async function generateTicketPdfBytes(accountData) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  
  const pageHeight = Math.max(450, 220 + (accountData.items ? accountData.items.length * 25 : 50));
  const page = pdfDoc.addPage([300, pageHeight]);
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  let y = pageHeight - 30;
  
  // Header
  page.drawText("CASINO EGIPTO", { x: 85, y: y, size: 16, font: fontBold, color: rgb(0.23, 0.68, 0.16) });
  y -= 16;
  page.drawText("Control Personal de Consumo", { x: 75, y: y, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  y -= 20;
  
  // Separator Line
  page.drawLine({ start: { x: 15, y: y }, end: { x: 285, y: y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 18;
  
  // Meta Info
  page.drawText(`Titular: ${accountData.clientName || 'Usuario Casino'}`, { x: 15, y: y, size: 10, font: fontBold });
  y -= 14;
  page.drawText(`Fecha Inicio: ${formatDateTimeShort(accountData.dateStart)}`, { x: 15, y: y, size: 9, font: fontRegular });
  y -= 14;
  page.drawText(`Último Consumo: ${formatDateTimeShort(accountData.dateEnd)}`, { x: 15, y: y, size: 9, font: fontRegular });
  y -= 16;
  
  // Table Header
  page.drawLine({ start: { x: 15, y: y }, end: { x: 285, y: y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 14;
  page.drawText("Producto", { x: 15, y: y, size: 9, font: fontBold });
  page.drawText("Cant.", { x: 150, y: y, size: 9, font: fontBold });
  page.drawText("P. Unit", { x: 190, y: y, size: 9, font: fontBold });
  page.drawText("Subtotal", { x: 240, y: y, size: 9, font: fontBold });
  y -= 8;
  page.drawLine({ start: { x: 15, y: y }, end: { x: 285, y: y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 14;
  
  // Items Rows (using stored historical price)
  if (accountData.items) {
    accountData.items.forEach(item => {
      const subtotal = item.price * item.qty;
      page.drawText(item.name.substring(0, 20), { x: 15, y: y, size: 9, font: fontRegular });
      page.drawText(`${item.qty}`, { x: 155, y: y, size: 9, font: fontRegular });
      page.drawText(`$${item.price}`, { x: 190, y: y, size: 9, font: fontRegular });
      page.drawText(`$${subtotal}`, { x: 240, y: y, size: 9, font: fontBold });
      y -= 16;
    });
  }
  
  y -= 6;
  page.drawLine({ start: { x: 15, y: y }, end: { x: 285, y: y }, thickness: 1.5, color: rgb(0.23, 0.68, 0.16) });
  y -= 22;
  
  // Total
  page.drawText("TOTAL A PAGAR:", { x: 80, y: y, size: 12, font: fontBold });
  page.drawText(formatCurrency(accountData.total), { x: 190, y: y, size: 14, font: fontBold, color: rgb(0.23, 0.68, 0.16) });
  
  y -= 30;
  page.drawText("¡Gracias por su consumo en Casino Egipto!", { x: 50, y: y, size: 9, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
  
  return await pdfDoc.save();
}

async function generateTicketPdf(accountData) {
  try {
    const pdfBytes = await generateTicketPdfBytes(accountData);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const fileName = `Ticket_CasinoEgipto_${(accountData.clientName || 'Usuario').replace(/\s+/g, '_')}.pdf`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast("Ticket PDF generado y descargado con éxito", "success", 2000);
  } catch (err) {
    console.error(err);
    showToast("Error al generar Ticket PDF: " + err.message, "error", 2500);
  }
}

// --- 12. Email Sharing with PDF Attachment ---
async function sendAccountByEmail(accountData) {
  try {
    const pdfBytes = await generateTicketPdfBytes(accountData);
    const fileName = `Ticket_CasinoEgipto_${(accountData.clientName || 'Usuario').replace(/\s+/g, '_')}.pdf`;
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    
    const subject = `Cuenta Casino Egipto - ${accountData.clientName || 'Usuario'}`;
    const bodyText = `Cordial saludo,\n\nAdjunto el consumo detallado en Casino Egipto para ${accountData.clientName}.\nTotal: ${formatCurrency(accountData.total)}\n\nAtentamente,\nCasino Egipto`;
    
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (isMobile && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        title: subject,
        text: bodyText,
        files: [pdfFile]
      });
      return;
    }
    
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText + '\n\n(Nota: El ticket PDF ha sido descargado a tu computador. Adjúntalo con un clic en Gmail).')}`;
    window.open(gmailUrl, '_blank');
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(err);
      showToast("Error al enviar correo: " + err.message, "error", 2500);
    }
  }
}

// --- 13. Backup Export / Import ---
function setupBackupHandlers() {
  document.getElementById('btn-export-db').addEventListener('click', async () => {
    const dbData = {
      menuItems: await db.menuItems.toArray(),
      accounts: await db.accounts.toArray(),
      settings: await db.settings.toArray()
    };
    
    const blob = new Blob([JSON.stringify(dbData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CasinoEgipto_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  
  document.getElementById('btn-import-db').addEventListener('click', () => {
    document.getElementById('import-db-file').click();
  });
  
  document.getElementById('import-db-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (confirm("¿Desea restaurar esta copia de seguridad del Casino?")) {
          if (data.menuItems) {
            for (const item of data.menuItems) await db.menuItems.put(item);
          }
          if (data.accounts) {
            for (const item of data.accounts) await db.accounts.put(item);
          }
          if (data.settings) {
            for (const item of data.settings) await db.settings.put(item);
          }
          
          showToast("Copia de seguridad restaurada con éxito", "success", 2000);
          await loadUserSettings();
          await renderMenuGrid();
          await renderSettingsMenuList();
          await renderHistoryList();
        }
      } catch (err) {
        showToast("Error al importar: formato JSON no válido", "error", 2500);
      }
    };
    reader.readAsText(file);
  });
  
  document.getElementById('btn-clear-db').addEventListener('click', async () => {
    if (confirm("¡CUIDADO! Se borrarán todas las cuentas registradas y productos del menú. ¿Está seguro?")) {
      await db.menuItems.clear();
      await db.accounts.clear();
      await db.settings.clear();
      await initializeMenuSeedData();
      
      showToast("Base de datos reiniciada con éxito", "info", 1800);
      setTimeout(() => window.location.reload(), 1200);
    }
  });
}

// --- 14. PWA Service Worker & Status ---
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('Service Worker Casino Egipto registrado', reg);
        reg.update();
      })
      .catch(err => console.warn('Error SW:', err));
  }
}

function updateOnlineStatus() {
  const badge = document.getElementById('offline-badge');
  if (navigator.onLine) {
    badge.style.display = 'none';
  } else {
    badge.style.display = 'inline-block';
  }
}
