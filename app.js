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
db.version(2).stores({
  menuItems: '++id, name, category, price',
  accounts: 'id, clientName, dateStart, dateEnd, total',
  settings: 'key, value'
});

// Seed Data for Initial Menu Items
const DEFAULT_MENU_ITEMS = [
  { name: "Almuerzo", price: 16000, category: "Almuerzos", img: "img/almuerzo.jpg" },
  { name: "Almuerzo con Sopa", price: 17000, category: "Almuerzos", img: "img/almuerzo_sopa.jpg" },
  { name: "Desayuno", price: 7000, category: "Desayunos", img: "img/desayuno.jpg" },
  { name: "Agua botella 600 ml", price: 2000, category: "Bebidas", img: "img/agua_botella.jpg" },
  { name: "Sopa", price: 1000, category: "Almuerzos", img: "img/almuerzo_sopa.jpg" },
  { name: "CocaCola 400 ml", price: 3000, category: "Bebidas", img: "img/coca-cola-original-400-ml.jpg" },
  { name: "CocaCola Zero 400 ml", price: 3000, category: "Bebidas", img: "img/cocacola-zero-400ml.jpg" },
  { name: "Galleta Festival x6", price: 1500, category: "Galletas", img: "img/galletas-festival-x6.jpg" },
  { name: "Palomitas Caramelo Yupi", price: 2000, category: "Paquetes", img: "img/palomitasyupi.png" },
  { name: "Cheetos", price: 3000, category: "Paquetes", img: "img/Cheetos.jpg" },
  { name: "Choclitos", price: 2000, category: "Paquetes", img: "img/Choclitos.jpg" },
  { name: "Natuchips", price: 2500, category: "Paquetes", img: "img/Natuchips.jpg" },
  { name: "TostiEmpanada", price: 1500, category: "Paquetes", img: "img/TostiEmpanadas.jpg" },
  { name: "Cheestres", price: 3000, category: "Paquetes", img: "img/Cheestres.jpg" },
  { name: "Doritos", price: 3000, category: "Paquetes", img: "img/Doritos.jpg" },
  { name: "Margarita", price: 2000, category: "Paquetes", img: "img/Margarita.jpg" },
  { name: "Rizadas", price: 3000, category: "Paquetes", img: "img/Rizadas.jpg" },
  { name: "Doritos Dinamita", price: 2000, category: "Paquetes", img: "img/Doritos Dinamita.jpg" },
  { name: "ClubSocial", price: 1000, category: "Galletas", img: "img/ClubSocial.jpg" },
  { name: "Chocolatina Jet 11 g", price: 1000, category: "Chocolatinas", img: "img/Chocolatina-Jet-11g.webp" },
  { name: "BomBomBum", price: 1000, category: "Dulces", img: "img/BomBomBum.jpg" }
];

const DEFAULT_CATEGORIES = ["Almuerzos", "Desayunos", "Bebidas", "Sopas", "Galletas", "Paquetes", "Chocolatinas", "Dulces", "Otros"];

const DEFAULT_USER_NAME = "Andres Platarrueda";
const DEFAULT_BANCOLOMBIA_NUM = "838-567083-43";
const DEFAULT_BANCOLOMBIA_TYPE = "Corriente";
const DEFAULT_NEQUI_NUM = "3001234567";

// --- 2. Application State ---
const STATE = {
  activeAccountId: null,
  cart: {}, // Maps itemId -> { id, name, price, qty, img, category }
  bitacora: [], // Array of action logs: { id, timestamp, timeFormatted, action, itemName, qtyChange, currentQty, description }
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

function parseLocalDate(val) {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const matchYMD = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchYMD) {
      return new Date(Number(matchYMD[1]), Number(matchYMD[2]) - 1, Number(matchYMD[3]), 12, 0, 0);
    }
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatDateTimeISO(date) {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const d = parseLocalDate(date);
  const pad = num => String(num).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateTimeShort(date) {
  if (!date) return '';
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }
  const d = parseLocalDate(date);
  const pad = num => String(num).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Formato legible con fecha y hora para la bitácora
function formatActionDateTime(date) {
  const d = date ? (date instanceof Date ? date : new Date(date)) : new Date();
  const pad = num => String(num).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day}/${month}/${year} ${pad(hours)}:${minutes}:${seconds} ${ampm}`;
}

// Registro de movimientos en la Bitácora de la Cuenta
function addBitacoraEntry(action, itemName = '', qtyChange = 0, currentQty = 0, customNote = '') {
  if (!STATE.bitacora) STATE.bitacora = [];
  const now = new Date();
  
  let desc = '';
  if (action === 'AGREGAR') {
    desc = `Agregó ${qtyChange > 0 ? '+' : ''}${qtyChange} ${itemName}`;
  } else if (action === 'SUMAR') {
    desc = `Aumentó a ${currentQty}x ${itemName} (+${qtyChange})`;
  } else if (action === 'RESTAR') {
    desc = currentQty > 0 ? `Disminuyó a ${currentQty}x ${itemName} (${qtyChange})` : `Restó último ${itemName}`;
  } else if (action === 'ELIMINAR') {
    desc = `Eliminó ${itemName} de la cuenta`;
  } else if (action === 'INICIO') {
    desc = customNote || 'Cuenta iniciada';
  } else if (action === 'CIERRE') {
    desc = customNote || 'Cuenta finalizada y guardada como cerrada';
  } else {
    desc = customNote || `${action}: ${itemName || ''}`;
  }

  const entry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: now.getTime(),
    timeFormatted: formatActionDateTime(now),
    action: action,
    itemName: itemName || '',
    qtyChange: qtyChange,
    currentQty: currentQty,
    description: desc
  };

  STATE.bitacora.unshift(entry);
  renderCartBitacoraUI();
  autoPersistActiveAccount();
  return entry;
}

// Renderizado de la lista de bitácora en la pestaña Cuenta
function renderCartBitacoraUI() {
  const container = document.getElementById('cart-bitacora-container');
  const countBadge = document.getElementById('bitacora-count-badge');
  if (!container) return;
  
  const list = STATE.bitacora || [];
  if (countBadge) {
    countBadge.innerText = `${list.length} movimiento${list.length === 1 ? '' : 's'}`;
  }
  
  if (list.length === 0) {
    container.innerHTML = `
      <div class="bitacora-empty">
        <p>No hay movimientos registrados en esta cuenta aún.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  list.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'bitacora-entry';
    
    let badgeClass = 'badge-add';
    let badgeText = '+1';
    
    if (entry.action === 'AGREGAR' || (entry.qtyChange > 0 && entry.action !== 'SUMAR')) {
      badgeClass = 'badge-add';
      badgeText = `+${entry.qtyChange || 1}`;
    } else if (entry.action === 'SUMAR') {
      badgeClass = 'badge-add';
      badgeText = `+${entry.qtyChange || 1}`;
    } else if (entry.action === 'RESTAR') {
      badgeClass = 'badge-sub';
      badgeText = `${entry.qtyChange}`;
    } else if (entry.action === 'ELIMINAR') {
      badgeClass = 'badge-del';
      badgeText = '✕ Borró';
    } else if (entry.action === 'INICIO') {
      badgeClass = 'badge-init';
      badgeText = '🚀 Inicio';
    } else if (entry.action === 'CIERRE') {
      badgeClass = 'badge-close';
      badgeText = '🏁 Cierre';
    }

    row.innerHTML = `
      <div class="bitacora-left">
        <span class="bitacora-badge ${badgeClass}">${badgeText}</span>
        <span class="bitacora-desc" title="${entry.description}">${entry.description}</span>
      </div>
      <span class="bitacora-time">${entry.timeFormatted}</span>
    `;
    container.appendChild(row);
  });
}

// Auto-persistencia en tiempo real de la cuenta activa
async function autoPersistActiveAccount() {
  const hasCart = Object.keys(STATE.cart).length > 0;
  if (!STATE.isAccountStarted && !hasCart) return;
  
  const accountData = getAccountDataFromUI('abierta');
  accountData.bitacora = STATE.bitacora || [];
  
  try {
    await db.accounts.put(accountData);
  } catch (e) {
    console.warn("Auto-persist Dexie failed:", e);
  }
  
  try {
    const existing = JSON.parse(localStorage.getItem('casino_egipto_accounts') || '{}');
    existing[accountData.id] = accountData;
    localStorage.setItem('casino_egipto_accounts', JSON.stringify(existing));
  } catch (e) {}
}

// Carga una cuenta en el estado activo
function loadAccountIntoState(account) {
  STATE.activeAccountId = account.id || `CUENTA-${Date.now()}`;
  STATE.cart = {};
  STATE.isAccountStarted = true;
  STATE.bitacora = Array.isArray(account.bitacora) ? [...account.bitacora] : [];
  
  if (account.items && Array.isArray(account.items)) {
    account.items.forEach(i => {
      STATE.cart[i.id] = { ...i };
    });
  }
  
  STATE.dateStart = account.dateStart ? parseLocalDate(account.dateStart) : new Date();
  STATE.dateEnd = account.dateEnd ? parseLocalDate(account.dateEnd) : new Date();
  
  const startEl = document.getElementById('cuenta-fecha-inicio');
  const finEl = document.getElementById('cuenta-fecha-fin');
  if (startEl) startEl.value = formatDateTimeISO(STATE.dateStart);
  if (finEl) finEl.value = formatDateTimeISO(STATE.dateEnd);
  
  updateAccountStatusUI();
  updateCartNavBadge();
  renderCartView();
  renderCartBitacoraUI();
}

// Carga automática de cuenta activa al iniciar la aplicación
async function loadActiveAccountOnStartup() {
  let openAccount = null;
  
  try {
    const accounts = await db.accounts.toArray();
    const openAccounts = accounts.filter(a => a.status === 'abierta');
    if (openAccounts.length > 0) {
      openAccounts.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.dateEnd || 0).getTime();
        const timeB = new Date(b.updatedAt || b.dateEnd || 0).getTime();
        return timeB - timeA;
      });
      openAccount = openAccounts[0];
    }
  } catch (e) {
    console.warn("Error leyendo cuentas en startup desde Dexie:", e);
  }
  
  if (!openAccount) {
    try {
      const localAccounts = JSON.parse(localStorage.getItem('casino_egipto_accounts') || '{}');
      const openLocals = Object.values(localAccounts).filter(a => a && a.status === 'abierta');
      if (openLocals.length > 0) {
        openLocals.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.dateEnd || 0).getTime();
          const timeB = new Date(b.updatedAt || b.dateEnd || 0).getTime();
          return timeB - timeA;
        });
        openAccount = openLocals[0];
      }
    } catch (e) {}
  }
  
  if (openAccount) {
    loadAccountIntoState(openAccount);
    console.log("✅ Cuenta activa cargada automáticamente:", openAccount.id);
  } else {
    initNewAccountState();
  }
}

// --- 4. DOM Initialization ---
async function initApp() {
  registerServiceWorker();
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  try {
    await db.open();
  } catch (err) {
    console.warn("Dexie open failed, recreando base de datos:", err);
    try {
      await Dexie.delete('casino_egipto_db');
      await db.open();
    } catch (err2) {
      console.error("Dexie delete/open failed:", err2);
    }
  }

  try {
    await initializeMenuSeedData();
  } catch (e) {
    console.error("Error inicializando datos:", e);
  }

  try {
    await loadUserSettings();
  } catch (e) {
    console.error("Error cargando configuración:", e);
  }

  setupNavigation();
  setupEventListeners();

  try {
    await renderCategoryTabs();
    await populateCategorySelect();
    await renderCategoriesSettings();
  } catch (e) {
    console.error("Error preparando categorías:", e);
  }
  
  // Cargar cuenta activa si existe en la base de datos o iniciar nueva
  try {
    await loadActiveAccountOnStartup();
  } catch (e) {
    console.error("Error cargando cuenta activa:", e);
    initNewAccountState();
  }

  try {
    await renderMenuGrid();
    await renderCartView();
    renderCartBitacoraUI();
  } catch (e) {
    console.error("Error renderizando menú/carrito:", e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

async function initializeMenuSeedData() {
  try {
    const currentItems = await db.menuItems.toArray();
    for (const item of DEFAULT_MENU_ITEMS) {
      const existing = currentItems.find(i => i.name && i.name.trim().toLowerCase() === item.name.trim().toLowerCase());
      if (!existing) {
        await db.menuItems.add(item);
      } else {
        let changed = false;
        if (item.name.trim().toLowerCase() === 'desayuno' && existing.price === 9000) {
          existing.price = 7000;
          changed = true;
        }
        if (item.name.trim().toLowerCase() === 'clubsocial' && existing.category !== 'Galletas') {
          existing.category = 'Galletas';
          changed = true;
        }
        if (changed) {
          await db.menuItems.put(existing);
        }
      }
    }
  } catch (e) {
    console.error("Error en initializeMenuSeedData items:", e);
  }

  // Inicializar/actualizar categorias en settings
  try {
    const cats = await db.settings.get('categories');
    let currentCats = [];
    if (cats && cats.value) {
      currentCats = typeof cats.value === 'string' ? JSON.parse(cats.value) : cats.value;
      if (!Array.isArray(currentCats)) currentCats = [];
    }
    const merged = [...new Set([...currentCats, ...DEFAULT_CATEGORIES])];
    await db.settings.put({ key: 'categories', value: JSON.stringify(merged) });
  } catch (e) {
    console.error("Error en initializeMenuSeedData categories:", e);
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
  let loadedType = bType ? bType.value : DEFAULT_BANCOLOMBIA_TYPE;
  loadedType = loadedType.replace(/cuenta\s+(de\s+)?/i, '').trim() || 'Corriente';
  STATE.bancolombiaType = loadedType;
  if (!bType) await db.settings.put({ key: 'bancolombiaType', value: STATE.bancolombiaType });

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
  STATE.bitacora = [];
  STATE.isAccountStarted = false;
  STATE.dateStart = now;
  STATE.dateEnd = now;
  
  const startEl = document.getElementById('cuenta-fecha-inicio');
  const finEl = document.getElementById('cuenta-fecha-fin');
  if (startEl) startEl.value = formatDateTimeISO(STATE.dateStart);
  if (finEl) finEl.value = formatDateTimeISO(STATE.dateEnd);
  
  updateAccountStatusUI();
  updateCartNavBadge();
  renderCartBitacoraUI();
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
        renderCategoriesSettings();
        populateCategorySelect();
      } else if (targetPanelId === 'panel-cuenta') {
        renderCartView();
      }
    });
  });
}

// --- 6. Menu Grid Rendering ---
async function renderMenuGrid() {
  const grid = document.getElementById('menu-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const searchVal = (document.getElementById('search-menu')?.value || '').trim().toLowerCase();
  let items = [];
  
  try {
    items = await db.menuItems.toArray();
  } catch (e) {
    console.warn("Error leyendo de db.menuItems, usando datos por defecto:", e);
  }
  
  // Fallback garantizado: si items está vacío, poblar con DEFAULT_MENU_ITEMS
  if (!items || items.length === 0) {
    items = DEFAULT_MENU_ITEMS.map((item, idx) => ({ ...item, id: idx + 1 }));
    // Reintentar guardado en background
    initializeMenuSeedData();
  }
  
  if (STATE.currentCategory !== 'todos') {
    items = items.filter(i => (i.category || '').toLowerCase() === STATE.currentCategory.toLowerCase());
  }
  
  if (searchVal) {
    items = items.filter(i => (i.name && i.name.toLowerCase().includes(searchVal)) || (i.category && i.category.toLowerCase().includes(searchVal)));
  }
  
  if (items.length === 0) {
    grid.innerHTML = `
      <div class="card margin-top-12" style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 30px;">
        <p>No se encontraron productos en esta categoría.</p>
      </div>
    `;
    return;
  }
  
  const createItemCard = (item) => {
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
    return card;
  };

  if (STATE.currentCategory === 'todos') {
    const grouped = {};
    items.forEach(item => {
      const cat = item.category || 'Otros';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    
    const cats = await getCategories();
    const orderedCats = cats.filter(c => grouped[c]);
    Object.keys(grouped).forEach(c => {
      if (!orderedCats.includes(c)) orderedCats.push(c);
    });

    orderedCats.forEach(cat => {
      const header = document.createElement('div');
      header.style.gridColumn = '1 / -1';
      header.style.marginTop = '12px';
      header.style.marginBottom = '4px';
      header.innerHTML = `<h3 style="color: #fff; font-size: 16px; border-bottom: 2px solid var(--accent-primary); padding-bottom: 4px; display: inline-block;">🏷️ ${cat}</h3>`;
      grid.appendChild(header);
      
      grouped[cat].forEach(item => {
        grid.appendChild(createItemCard(item));
      });
    });
  } else {
    items.forEach(item => {
      grid.appendChild(createItemCard(item));
    });
  }
}

function addToCart(item) {
  const wasStarted = STATE.isAccountStarted || Object.keys(STATE.cart).length > 0;
  STATE.isAccountStarted = true;
  
  const now = new Date();
  STATE.dateEnd = now;
  const finEl = document.getElementById('cuenta-fecha-fin');
  if (finEl) finEl.value = formatDateTimeISO(now);

  if (!wasStarted && (!STATE.bitacora || STATE.bitacora.length === 0)) {
    addBitacoraEntry('INICIO', null, 0, 0, 'Cuenta iniciada');
  }
  
  if (STATE.cart[item.id]) {
    STATE.cart[item.id].qty += 1;
    addBitacoraEntry('SUMAR', item.name, 1, STATE.cart[item.id].qty);
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
    addBitacoraEntry('AGREGAR', item.name, 1, 1);
  }
  
  const currentQty = STATE.cart[item.id].qty;
  showToast(`+1 ${item.name} agregado (${currentQty})`, 'success', 1200);
  updateAccountStatusUI();
  updateCartNavBadge();
  renderCartBitacoraUI();
  autoPersistActiveAccount();
  
  // Actualizar solo el botón de la tarjeta correspondiente sin recrear el DOM ni mover el scroll
  document.querySelectorAll(`.btn-add-to-cart[data-id="${item.id}"]`).forEach(btn => {
    btn.innerHTML = `<span class="btn-icon">✓</span><span>Agregado (${currentQty})</span>`;
  });
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
    
    const displayName = (item.name || '').slice(0, 12);
    
    const row = document.createElement('div');
    row.className = 'cart-item-row';
    row.innerHTML = `
      <div class="cart-item-info">
        <img src="${item.img || 'img/almuerzo.jpg'}" class="cart-item-thumb" onerror="this.src='img/almuerzo.jpg'">
        <div>
          <div class="cart-item-name" title="${item.name}">${displayName}</div>
          <div class="cart-item-unit-price">${formatCurrency(item.price)} c/u</div>
        </div>
      </div>
      <div class="cart-item-qty-controls">
        <button class="qty-btn btn-qty-minus" data-id="${item.id}">-</button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn btn-qty-plus" data-id="${item.id}">+</button>
      </div>
      <div class="cart-item-right-box">
        <div class="cart-item-subtotal">${formatCurrency(subtotal)}</div>
        <button type="button" class="btn btn-remove-item" data-id="${item.id}" title="Eliminar producto">
          <span>✕</span>
        </button>
      </div>
    `;
    
    row.querySelector('.btn-qty-minus').addEventListener('click', () => {
      if (STATE.cart[item.id].qty > 1) {
        STATE.cart[item.id].qty -= 1;
        addBitacoraEntry('RESTAR', item.name, -1, STATE.cart[item.id].qty);
      } else {
        delete STATE.cart[item.id];
        addBitacoraEntry('ELIMINAR', item.name, -1, 0);
      }
      updateCartNavBadge();
      renderCartView();
      renderMenuGrid();
      renderCartBitacoraUI();
      autoPersistActiveAccount();
    });
    
    row.querySelector('.btn-qty-plus').addEventListener('click', () => {
      STATE.cart[item.id].qty += 1;
      addBitacoraEntry('SUMAR', item.name, 1, STATE.cart[item.id].qty);
      updateCartNavBadge();
      renderCartView();
      renderMenuGrid();
      renderCartBitacoraUI();
      autoPersistActiveAccount();
    });
    
    row.querySelector('.btn-remove-item').addEventListener('click', () => {
      const prevQty = STATE.cart[item.id].qty;
      delete STATE.cart[item.id];
      addBitacoraEntry('ELIMINAR', item.name, -prevQty, 0);
      updateCartNavBadge();
      renderCartView();
      renderMenuGrid();
      renderCartBitacoraUI();
      autoPersistActiveAccount();
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
      addBitacoraEntry('INICIO', null, 0, 0, 'Cuenta iniciada');
      updateAccountStatusUI();
      showToast("Cuenta iniciada. Agrega tus consumos desde el Menú.", "info", 2000);
      document.querySelector('.nav-btn[data-target="panel-menu"]').click();
      return;
    }
    
    await saveAccountFromUI(true);
  });

  // Toggle collapse/expand bitácora in Cuenta
  const bitacoraToggle = document.getElementById('btn-toggle-bitacora');
  if (bitacoraToggle) {
    bitacoraToggle.addEventListener('click', () => {
      const content = document.getElementById('bitacora-content');
      const icon = document.getElementById('bitacora-toggle-icon');
      if (content) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        if (icon) icon.innerText = isHidden ? '▼' : '▲';
      }
    });
  }

  // Toggle collapse/expand bottom actions in Cuenta
  const toggleBtn = document.getElementById('btn-toggle-bottom-actions');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const content = document.getElementById('bottom-actions-content');
      const icon = document.getElementById('bottom-actions-toggle-icon');
      const text = document.getElementById('bottom-actions-toggle-text');
      if (content) {
        const isCollapsed = content.classList.contains('collapsed');
        if (isCollapsed) {
          content.classList.remove('collapsed');
          if (icon) icon.innerText = '▼';
          if (text) text.innerText = 'Ocultar';
        } else {
          content.classList.add('collapsed');
          if (icon) icon.innerText = '▲';
          if (text) text.innerText = 'Mostrar';
        }
      }
    });
  }
  
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
    
    if (confirm("¿Desea finalizar y cerrar la cuenta actual? Se guardará como CERRADA en el histórico y el botón volverá a Iniciar Cuenta.")) {
      addBitacoraEntry('CIERRE', null, 0, 0, 'Cuenta finalizada y guardada como cerrada');
      if (cartItemsCount > 0 || (STATE.bitacora && STATE.bitacora.length > 0)) {
        await saveAccountFromUI(false, 'cerrada');
      }
      initNewAccountState();
      renderCartView();
      renderMenuGrid();
      showToast("Cuenta finalizada y cerrada en el histórico.", "success", 2500);
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
    const bTypeRaw = document.getElementById('bancolombia-type-input').value;
    const bType = bTypeRaw.replace(/cuenta\s+(de\s+)?/i, '').trim() || 'Corriente';
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
    // Copiar número limpio sin guiones para pegar directamente en la app
    const numLimpio = (STATE.bancolombiaNum || '838-567083-43').replace(/[^0-9]/g, '');
    navigator.clipboard.writeText(numLimpio);
    showToast(`✅ Número copiado: ${numLimpio}`, "success", 2200);
  });

  document.getElementById('btn-copy-bancolombia-valor').addEventListener('click', () => {
    const grandTotal = Object.values(STATE.cart).reduce((sum, i) => sum + (i.price * i.qty), 0);
    navigator.clipboard.writeText(String(grandTotal));
    showToast(`✅ Valor copiado: ${formatCurrency(grandTotal)}`, "success", 2200);
  });

  document.getElementById('btn-copy-nequi').addEventListener('click', () => {
    const numLimpio = (STATE.nequiNum || '').replace(/[^0-9]/g, '').slice(0, 10);
    navigator.clipboard.writeText(numLimpio);
    showToast(`✅ Número copiado: ${numLimpio}`, "success", 2200);
  });

  document.getElementById('btn-copy-nequi-valor').addEventListener('click', () => {
    const grandTotal = Object.values(STATE.cart).reduce((sum, i) => sum + (i.price * i.qty), 0);
    navigator.clipboard.writeText(String(grandTotal));
    showToast(`✅ Valor copiado: ${formatCurrency(grandTotal)}`, "success", 2200);
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
    populateCategorySelect();
    renderMenuGrid();
  });
  
  document.getElementById('btn-cancel-menu-edit').addEventListener('click', () => {
    resetMenuItemForm();
  });

  // Agregar nueva categoría
  document.getElementById('btn-add-category').addEventListener('click', async () => {
    const input = document.getElementById('new-category-input');
    const name = input.value.trim();
    if (!name) {
      showToast('Ingrese el nombre de la categoría', 'warning', 1800);
      return;
    }
    const cats = await getCategories();
    if (cats.some(c => c.toLowerCase() === name.toLowerCase())) {
      showToast(`La categoría "${name}" ya existe`, 'warning', 1800);
      return;
    }
    cats.push(name);
    await saveCategories(cats);
    input.value = '';
    renderCategoriesSettings();
    populateCategorySelect();
    showToast(`✅ Categoría "${name}" agregada`, 'success', 1800);
  });

  // Enter en el input de categoría
  document.getElementById('new-category-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-add-category').click();
  });

  // Tomar Foto / Subir Imagen handlers
  document.getElementById('btn-camera-capture').addEventListener('click', () => {
    document.getElementById('input-item-camera').click();
  });

  document.getElementById('btn-file-upload').addEventListener('click', () => {
    document.getElementById('input-item-file').click();
  });

  const handleImageInput = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const prodName = document.getElementById('new-item-name').value.trim();
      processAndUploadProductImage(file, prodName);
    }
  };

  document.getElementById('input-item-camera').addEventListener('change', handleImageInput);
  document.getElementById('input-item-file').addEventListener('change', handleImageInput);
  
  setupBackupHandlers();
}

function resetMenuItemForm() {
  document.getElementById('editing-item-id').value = '';
  document.getElementById('new-item-name').value = '';
  document.getElementById('new-item-price').value = '';
  document.getElementById('new-item-img').value = '';
  const camInput = document.getElementById('input-item-camera');
  if (camInput) camInput.value = '';
  const fileInput = document.getElementById('input-item-file');
  if (fileInput) fileInput.value = '';
  const previewContainer = document.getElementById('image-preview-container');
  if (previewContainer) previewContainer.style.display = 'none';
  const previewEl = document.getElementById('image-preview');
  if (previewEl) previewEl.src = '';
  document.getElementById('form-menu-item-title').innerText = 'Agregar / Editar Producto al Menú';
  document.getElementById('btn-menu-item-icon').innerText = '➕';
  document.getElementById('btn-menu-item-text').innerText = 'Guardar Producto en Menú';
  document.getElementById('btn-cancel-menu-edit').style.display = 'none';
}

// Image compression and upload helper
async function processAndUploadProductImage(file, productName) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        // Redimensionar a max 800px para optimizar rendimiento y almacenamiento
        const maxDimension = 800;
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        
        // Mostrar vista previa inmediatamente
        const previewEl = document.getElementById('image-preview');
        const previewContainer = document.getElementById('image-preview-container');
        const previewStatus = document.getElementById('image-preview-status');
        if (previewEl && previewContainer) {
          previewEl.src = dataUrl;
          previewContainer.style.display = 'block';
          if (previewStatus) previewStatus.innerText = '⏳ Guardando imagen en \\img...';
        }

        // Generar nombre de archivo limpio
        const baseName = (productName || file.name.replace(/\.[^/.]+$/, '') || 'producto')
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
          .slice(0, 30);
        const fileName = `${baseName}_${Date.now()}.jpg`;

        // Enviar al backend para guardar en la carpeta \img
        try {
          const resp = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: fileName, image: dataUrl })
          });
          const result = await resp.json();
          if (result.success && result.path) {
            document.getElementById('new-item-img').value = result.path;
            if (previewStatus) previewStatus.innerText = `✅ Guardada en \\${result.path}`;
            showToast(`✅ Foto guardada en \\${result.path}`, 'success', 2000);
            resolve(result.path);
            return;
          }
        } catch (uploadErr) {
          console.warn("Backend upload falló, usando DataURL local:", uploadErr);
        }

        // Respaldo offline: usar dataURL
        document.getElementById('new-item-img').value = dataUrl;
        if (previewStatus) previewStatus.innerText = '✅ Imagen cargada localmente';
        showToast("✅ Imagen lista para el producto", "success", 1800);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

window.closePaymentModal = function() {
  const modal = document.getElementById('payment-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.style.setProperty('display', 'none', 'important');
  }
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePaymentModal();
  }
});

// ── Helpers para generar QR bancarios colombianos ──────────────────────────

function crc16CCITT(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(tag, value) {
  return `${tag}${String(value.length).padStart(2, '0')}${value}`;
}

/**
 * Genera QR EMVCo estándar (Asobancaria Colombia) para transferencias Bancolombia.
 * https://www.emvco.com/emv-technologies/qrcodes/
 */
function buildBancolombiaEMVCo(accountNumber, accountType, merchantName, amountCOP) {
  const acctClean = accountNumber.replace(/[^0-9]/g, '');

  // Merchant Account Information (tag 26) para Bancolombia
  let mai = '';
  mai += tlv('00', 'bancolombia.com.co');
  mai += tlv('01', acctClean);
  mai += tlv('02', accountType === 'Cuenta de Ahorros' ? 'SAVINGS' : 'CHECKING');

  let payload = '';
  payload += tlv('00', '01');             // Payload Format Indicator
  payload += tlv('01', '12');             // Dynamic QR
  payload += tlv('26', mai);             // Merchant Account Info
  payload += tlv('52', '6011');          // MCC - Restaurantes/Alimentación
  payload += tlv('53', '170');           // COP = 170
  if (amountCOP > 0) {
    payload += tlv('54', String(amountCOP));
  }
  payload += tlv('58', 'CO');            // País
  payload += tlv('59', (merchantName || 'CASINO EGIPTO').substring(0, 25).toUpperCase());
  payload += tlv('60', 'MEDELLIN');      // Ciudad
  payload += '6304';                     // CRC placeholder

  return payload + crc16CCITT(payload);
}

/**
 * Para Nequi: el QR solo debe contener el número de celular de 10 dígitos.
 * La app Nequi reconoce automáticamente este formato.
 */
function buildNequiQR(phoneNumber) {
  return phoneNumber.replace(/[^0-9]/g, '').slice(0, 10);
}

// ── Modal de Pago ──────────────────────────────────────────────────────────

function openPaymentModal(customAmount = null) {
  const modal = document.getElementById('payment-modal');
  if (modal) {
    modal.classList.add('open');
    modal.style.setProperty('display', 'flex', 'important');
  }

  let grandTotal = 0;
  if (customAmount !== null && !isNaN(customAmount)) {
    grandTotal = Number(customAmount);
  } else {
    const items = Object.values(STATE.cart);
    grandTotal = items.reduce((sum, i) => sum + (i.price * i.qty), 0);
  }
  
  const formattedAmount = formatCurrency(grandTotal);

  document.getElementById('payment-modal-amount-subtitle').innerText = `Total a Pagar: ${formattedAmount}`;
  document.getElementById('pay-bancolombia-amount').innerText = formattedAmount;
  document.getElementById('pay-nequi-amount').innerText = formattedAmount;

  const cleanType = (STATE.bancolombiaType || 'Corriente').replace(/cuenta\s+(de\s+)?/i, '').trim() || 'Corriente';
  document.getElementById('pay-bancolombia-type').innerText = cleanType;
  document.getElementById('pay-bancolombia-num').innerText = STATE.bancolombiaNum;
  document.getElementById('pay-nequi-num').innerText = STATE.nequiNum || "No configurado";

  // QR Bancolombia — solo número de cuenta limpio (sin guiones)
  try {
    const qrBancolombiaBox = document.getElementById('qr-bancolombia-box');
    if (qrBancolombiaBox && window.QRCode) {
      qrBancolombiaBox.innerHTML = '';
      const acctClean = (STATE.bancolombiaNum || '83856708343').replace(/[^0-9]/g, '');
      new QRCode(qrBancolombiaBox, {
        text: acctClean,
        width: 220,
        height: 220,
        correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 0
      });
    }
  } catch (err) {
    console.warn("Bancolombia QR render warning:", err);
  }

  // QR Nequi (solo número de celular — reconocido por la app Nequi)
  try {
    const qrNequiBox = document.getElementById('qr-nequi-box');
    if (qrNequiBox && window.QRCode) {
      qrNequiBox.innerHTML = '';
      const nequiPayload = buildNequiQR(STATE.nequiNum || '3001234567');
      new QRCode(qrNequiBox, {
        text: nequiPayload,
        width: 220,
        height: 220,
        correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 0
      });
    }
  } catch (err) {
    console.warn("Nequi QR render warning:", err);
  }
}
window.triggerOpenPaymentModal = openPaymentModal;

function getAccountDataFromUI(status = 'abierta') {
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
    status: status, // 'abierta' o 'cerrada'
    notes: '',
    dateStart: dateStart || formatDateTimeISO(now),
    dateEnd: dateEnd || formatDateTimeISO(now),
    items: items,
    bitacora: Array.isArray(STATE.bitacora) ? [...STATE.bitacora] : [],
    total: total,
    totalQty: totalQty,
    updatedAt: now.toISOString()
  };
}

async function saveAccountFromUI(showNotification = true, status = 'abierta') {
  const accountData = getAccountDataFromUI(status);
  if (!accountData.items || accountData.items.length === 0) {
    showToast("Debe agregar productos a la cuenta para poder guardar", "warning", 2000);
    return false;
  }
  
  // Guardar en Dexie y en localStorage como respaldo
  let saved = false;
  try {
    await db.accounts.put(accountData);
    saved = true;
  } catch (e) {
    console.warn("Dexie put account failed, guardando en localStorage:", e);
  }

  try {
    const existing = JSON.parse(localStorage.getItem('casino_egipto_accounts') || '{}');
    existing[accountData.id] = accountData;
    localStorage.setItem('casino_egipto_accounts', JSON.stringify(existing));
    saved = true;
  } catch (errLocal) {
    console.error("LocalStorage save failed:", errLocal);
  }

  if (saved) {
    if (status === 'abierta') {
      STATE.isAccountStarted = true;
    }
    updateAccountStatusUI();
    if (showNotification) {
      showToast("Cuenta del Casino guardada con éxito", "success", 2000);
    }
    return true;
  } else {
    showToast("Error al guardar la cuenta", "error", 2500);
    return false;
  }
}

// --- 9. History View & Accordion Rendering ---
async function renderHistoryList() {
  const container = document.getElementById('history-list');
  if (!container) return;
  container.innerHTML = '';
  
  const searchVal = (document.getElementById('search-history')?.value || '').trim().toLowerCase();
  let accountsArray = [];
  
  try {
    accountsArray = await db.accounts.toArray();
  } catch (e) {
    console.warn("Error leyendo cuentas de Dexie:", e);
  }

  // Integrar cuentas respaldadas en localStorage
  try {
    const localAccounts = JSON.parse(localStorage.getItem('casino_egipto_accounts') || '{}');
    Object.values(localAccounts).forEach(localAcc => {
      if (!accountsArray.some(a => a.id === localAcc.id)) {
        accountsArray.push(localAcc);
      }
    });
  } catch (e) {}
  
  if (searchVal) {
    accountsArray = accountsArray.filter(a => 
      (a.clientName && a.clientName.toLowerCase().includes(searchVal)) ||
      (a.id && a.id.toLowerCase().includes(searchVal))
    );
  }
  
  // Ordenar primero por estado (Abiertas primero) y luego por fecha descendente (más reciente primero)
  accountsArray.sort((a, b) => {
    const isAOpen = (a.status === 'abierta') ? 1 : 0;
    const isBOpen = (b.status === 'abierta') ? 1 : 0;
    
    if (isAOpen !== isBOpen) {
      return isBOpen - isAOpen; // Cuentas abiertas (1) arriba de cerradas (0)
    }
    
    const dateA = a.dateEnd || a.dateStart || a.updatedAt || a.id || '';
    const dateB = b.dateEnd || b.dateStart || b.updatedAt || b.id || '';
    return dateB.localeCompare(dateA);
  });
  
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
    const isExpandedDefault = false;
    const card = document.createElement('div');
    card.className = `card history-card ${isExpandedDefault ? 'expanded' : 'collapsed'}`;
    
    // items summary with exact historical price stored
    const itemsSummaryText = account.items ? account.items.map(i => `${i.qty}x ${i.name} (${formatCurrency(i.price)})`).join(', ') : 'Sin productos';
    
    const dateStartFormatted = formatDateTimeShort(account.dateStart);
    const dateEndFormatted = account.dateEnd ? formatDateTimeShort(account.dateEnd) : dateStartFormatted;
    const dateRangeHeader = (dateStartFormatted === dateEndFormatted || !account.dateEnd)
      ? dateStartFormatted
      : `${dateStartFormatted} - ${dateEndFormatted}`;

    const isOpen = (account.status === 'abierta');
    const statusBadgeHtml = isOpen
      ? `<span class="account-status-badge open" style="font-size: 11px; padding: 2px 8px;">🟢 Abierta</span>`
      : `<span class="account-status-badge closed" style="font-size: 11px; padding: 2px 8px;">🔴 Cerrada</span>`;

    const payButtonHtml = isOpen
      ? `<button class="btn btn-pay-style btn-sm btn-pay-account" data-id="${account.id}" style="padding: 4px 10px; font-size: 12px;">💳 Pagar</button>`
      : '';

    const bitacoraList = Array.isArray(account.bitacora) ? account.bitacora : [];
    const bitacoraHtml = bitacoraList.length > 0
      ? `
        <div class="history-bitacora-section">
          <div class="history-bitacora-toggle-bar" style="margin-bottom: 6px;">
            <span style="font-size: 11.5px; font-weight: 700; color: var(--color-primary); text-transform: uppercase;">📋 Bitácora (${bitacoraList.length} registros)</span>
          </div>
          <div class="bitacora-list" style="max-height: 160px;">
            ${bitacoraList.map(entry => {
              let bClass = 'badge-add';
              let bText = '+1';
              if (entry.action === 'AGREGAR' || (entry.qtyChange > 0 && entry.action !== 'SUMAR')) {
                bClass = 'badge-add'; bText = `+${entry.qtyChange || 1}`;
              } else if (entry.action === 'SUMAR') {
                bClass = 'badge-add'; bText = `+${entry.qtyChange || 1}`;
              } else if (entry.action === 'RESTAR') {
                bClass = 'badge-sub'; bText = `${entry.qtyChange}`;
              } else if (entry.action === 'ELIMINAR') {
                bClass = 'badge-del'; bText = '✕ Borró';
              } else if (entry.action === 'INICIO') {
                bClass = 'badge-init'; bText = '🚀 Inicio';
              } else if (entry.action === 'CIERRE') {
                bClass = 'badge-close'; bText = '🏁 Cierre';
              }
              return `
                <div class="bitacora-entry" style="padding: 5px 8px; font-size: 11.5px;">
                  <div class="bitacora-left">
                    <span class="bitacora-badge ${bClass}" style="font-size: 9.5px; padding: 1px 5px;">${bText}</span>
                    <span class="bitacora-desc" style="font-size: 11.5px;">${entry.description}</span>
                  </div>
                  <span class="bitacora-time" style="font-size: 9.5px;">${entry.timeFormatted}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `
      : '';

    card.innerHTML = `
      <div class="history-header">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span class="history-client">${account.clientName || 'Usuario Casino'}</span>
          ${statusBadgeHtml}
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
          <span class="detail-badge">Estado: ${isOpen ? '🟢 Abierta (En consumo)' : '🔴 Cerrada (Finalizada)'}</span>
          <span class="detail-badge">Inicio: ${formatDateTimeShort(account.dateStart)}</span>
          <span class="detail-badge">Último Consumo: ${formatDateTimeShort(account.dateEnd)}</span>
          <span class="detail-badge">Productos (${account.totalQty || 0}): ${itemsSummaryText}</span>
          <span class="detail-badge" style="border-color: rgba(59, 174, 42, 0.4); color: var(--color-primary);">🕒 Guardado: ${formatDateTimeShort(account.updatedAt)}</span>
        </div>
        ${bitacoraHtml}
        <div class="history-actions margin-top-12">
          ${payButtonHtml}
          <button class="btn btn-secondary btn-sm btn-edit-account" data-id="${account.id}">Cargar / Editar</button>
          <button class="btn btn-accent btn-sm btn-pdf-account" data-id="${account.id}">Generar Ticket</button>
          <button class="btn btn-sm btn-email-account" data-id="${account.id}" style="background-color: #1877f2; color: #ffffff; border: none; font-weight: 600;">📊 Compartir</button>
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
      loadAccountIntoState(account);
      document.querySelector('.nav-btn[data-target="panel-cuenta"]').click();
      showToast("Cuenta cargada para edición", "info", 1800);
    });
    
    if (isOpen) {
      const payBtn = card.querySelector('.btn-pay-account');
      if (payBtn) {
        payBtn.addEventListener('click', () => {
          openPaymentModal(account.total);
        });
      }
    }

    card.querySelector('.btn-pdf-account').addEventListener('click', () => {
      generateTicketPdf(account);
    });
    
    card.querySelector('.btn-email-account').addEventListener('click', () => {
      sendAccountByEmail(account);
    });
    
    card.querySelector('.btn-delete-account').addEventListener('click', async () => {
      if (confirm(`¿Eliminar la cuenta de ${account.clientName}?`)) {
        try {
          await db.accounts.delete(account.id);
        } catch (e) {}
        try {
          const localAccounts = JSON.parse(localStorage.getItem('casino_egipto_accounts') || '{}');
          delete localAccounts[account.id];
          localStorage.setItem('casino_egipto_accounts', JSON.stringify(localAccounts));
        } catch (e) {}
        showToast("Cuenta eliminada", "info", 1500);
        renderHistoryList();
      }
    });
    
    container.appendChild(card);
  });
}

document.getElementById('search-history').addEventListener('input', renderHistoryList);

// --- 10b. Dynamic Categories ---

async function getCategories() {
  try {
    const setting = await db.settings.get('categories');
    if (!setting || !setting.value) return DEFAULT_CATEGORIES;
    const parsed = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
    return Array.isArray(parsed) ? parsed : DEFAULT_CATEGORIES;
  } catch (e) {
    console.error("Error obteniendo categorías:", e);
    return DEFAULT_CATEGORIES;
  }
}

async function saveCategories(cats) {
  await db.settings.put({ key: 'categories', value: JSON.stringify(cats) });
}

async function renderCategoryTabs() {
  const container = document.getElementById('category-tabs');
  if (!container) return;
  const cats = await getCategories();
  
  let html = `<button class="cat-btn ${STATE.currentCategory === 'todos' ? 'active' : ''}" data-cat="todos">Todos</button>`;
  cats.forEach(cat => {
    const isAct = STATE.currentCategory.toLowerCase() === cat.toLowerCase();
    html += `<button class="cat-btn ${isAct ? 'active' : ''}" data-cat="${cat}">${cat}</button>`;
  });
  container.innerHTML = html;
  
  container.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.currentCategory = btn.getAttribute('data-cat');
      renderMenuGrid();
    });
  });
}

async function populateCategorySelect() {
  const sel = document.getElementById('new-item-cat');
  if (!sel) return;
  const cats = await getCategories();
  const current = sel.value;
  sel.innerHTML = cats.map(c => `<option value="${c}"${c === current ? ' selected' : ''}>${c}</option>`).join('');
}

async function renderCategoriesSettings() {
  const container = document.getElementById('settings-categories-list');
  if (!container) return;
  const cats = await getCategories();
  container.innerHTML = '';
  cats.forEach((cat, idx) => {
    const row = document.createElement('div');
    row.className = 'settings-menu-item-row';
    row.innerHTML = `
      <span style="font-size:13px;color:#fff;font-weight:600;">🏷️ ${cat}</span>
      <button class="btn btn-danger btn-sm btn-delete-cat" data-idx="${idx}" style="padding:4px 10px;font-size:12px;">Eliminar</button>
    `;
    row.querySelector('.btn-delete-cat').addEventListener('click', async () => {
      // Verificar si hay items con esta categoría sin usar indices de BD
      const allItems = await db.menuItems.toArray();
      const count = allItems.filter(i => (i.category || '').toLowerCase() === cat.toLowerCase()).length;
      if (count > 0) {
        showToast(`⚠️ Hay ${count} producto(s) en "${cat}". Primero elimínalos o cámbialos.`, 'warning', 3000);
        return;
      }
      const updated = cats.filter((_, i) => i !== idx);
      await saveCategories(updated);
      renderCategoriesSettings();
      populateCategorySelect();
      renderCategoryTabs();
      renderMenuGrid();
      showToast(`Categoría "${cat}" eliminada`, 'info', 1500);
    });
    container.appendChild(row);
  });
}

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
      
      const previewContainer = document.getElementById('image-preview-container');
      const previewEl = document.getElementById('image-preview');
      const previewStatus = document.getElementById('image-preview-status');
      if (item.img && previewEl && previewContainer) {
        previewEl.src = item.img;
        previewContainer.style.display = 'block';
        if (previewStatus) previewStatus.innerText = `Imagen actual: ${item.img}`;
      }

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
    
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Descarga directa
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
    }, 1000);

    // En Android / Móvil abrir pestaña para visualización inmediata
    if (isMobile) {
      window.open(url, '_blank');
    }

    // Mantener la URL del blob activa por 2 minutos para permitir que Android complete la descarga y apertura
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 120000);
    
    showToast("✅ Ticket PDF generado y listo", "success", 2000);
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

// --- 13. Separated Backup Handlers (Menu vs Accounts) ---

// Convierte cualquier ruta de imagen o URL a Base64 DataURL para que sea 100% autónoma en el JSON
async function imageToDataUrl(url) {
  if (!url) return 'img/almuerzo.jpg';
  if (url.startsWith('data:image/')) return url;
  
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let w = img.naturalWidth || img.width || 300;
        let h = img.naturalHeight || img.height || 300;
        
        // Optimizar tamaño máximo a 600px para mantener el JSON ágil
        const maxDim = 600;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl);
      } catch (err) {
        console.warn("No se pudo convertir imagen a Base64, manteniendo URL original:", err);
        resolve(url);
      }
    };
    img.onerror = () => {
      resolve(url);
    };
    img.src = url;
  });
}

async function exportMenuCatalog() {
  try {
    showToast("⏳ Preparando e incrustando fotos en el catálogo...", "info", 1500);
    const rawItems = await db.menuItems.toArray();
    const categories = await getCategories();

    // Incrustar todas las imágenes en Base64 para que el JSON sea 100% portable
    const embeddedItems = await Promise.all(rawItems.map(async (item) => {
      const cloned = { ...item };
      if (cloned.img) {
        cloned.img = await imageToDataUrl(cloned.img);
      }
      return cloned;
    }));

    const catalogData = {
      type: 'casino_egipto_menu_catalog',
      version: 1,
      exportDate: new Date().toISOString(),
      categories: categories,
      menuItems: embeddedItems
    };
    const blob = new Blob([JSON.stringify(catalogData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CasinoEgipto_Catalogo_Menu_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("📤 Catálogo exportado con fotos 100% incrustadas", "success", 2500);
  } catch (err) {
    console.error(err);
    showToast("Error al exportar menú: " + err.message, "error", 2500);
  }
}

async function importMenuCatalog(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      let itemsToImport = [];
      let catsToImport = [];
      
      if (Array.isArray(data)) {
        itemsToImport = data;
      } else if (data && data.menuItems && Array.isArray(data.menuItems)) {
        itemsToImport = data.menuItems;
        if (data.categories && Array.isArray(data.categories)) {
          catsToImport = data.categories;
        }
      } else {
        showToast("El archivo no contiene un catálogo de menú válido", "warning", 2500);
        return;
      }

      if (confirm(`¿Desea importar ${itemsToImport.length} productos al catálogo del menú? (Sus cuentas no se modificarán).`)) {
        await db.menuItems.clear();
        for (const item of itemsToImport) {
          const cleanItem = { ...item };
          await db.menuItems.put(cleanItem);
        }
        
        if (catsToImport.length > 0) {
          await saveCategories(catsToImport);
        } else {
          const extractedCats = [...new Set(itemsToImport.map(i => i.category).filter(Boolean))];
          if (extractedCats.length > 0) {
            const current = await getCategories();
            const merged = [...new Set([...current, ...extractedCats])];
            await saveCategories(merged);
          }
        }

        showToast("✅ Catálogo del menú importado con éxito", "success", 2000);
        await renderMenuGrid();
        await renderSettingsMenuList();
        await renderCategoryTabs();
        await renderCategoriesSettings();
        await populateCategorySelect();
      }
    } catch (err) {
      console.error(err);
      showToast("Error al importar: formato JSON no válido", "error", 2500);
    }
  };
  reader.readAsText(file);
}

async function restoreDefaultMenu() {
  if (confirm("¿Desea restaurar el catálogo del menú a sus valores iniciales? (No afectará las cuentas registradas).")) {
    await db.menuItems.clear();
    for (const item of DEFAULT_MENU_ITEMS) {
      await db.menuItems.add(item);
    }
    await saveCategories(DEFAULT_CATEGORIES);
    showToast("Menú restaurado a valores por defecto", "info", 1800);
    await renderMenuGrid();
    await renderSettingsMenuList();
    await renderCategoryTabs();
    await renderCategoriesSettings();
    await populateCategorySelect();
  }
}

async function exportAccountsData() {
  try {
    await autoPersistActiveAccount();
    
    let accounts = await db.accounts.toArray();
    try {
      const localAccounts = JSON.parse(localStorage.getItem('casino_egipto_accounts') || '{}');
      Object.values(localAccounts).forEach(localAcc => {
        if (!accounts.some(a => a.id === localAcc.id)) {
          accounts.push(localAcc);
        }
      });
    } catch (e) {}

    const accountsData = {
      type: 'casino_egipto_accounts',
      version: 1,
      exportDate: new Date().toISOString(),
      accounts: accounts
    };

    const blob = new Blob([JSON.stringify(accountsData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CasinoEgipto_Cuentas_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`📤 ${accounts.length} cuentas exportadas con éxito`, "success", 2000);
  } catch (err) {
    console.error(err);
    showToast("Error al exportar cuentas: " + err.message, "error", 2500);
  }
}

async function importAccountsData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      let accountsToImport = [];

      if (Array.isArray(data)) {
        accountsToImport = data;
      } else if (data && data.accounts && Array.isArray(data.accounts)) {
        accountsToImport = data.accounts;
      } else {
        showToast("El archivo no contiene un respaldo de cuentas válido", "warning", 2500);
        return;
      }

      if (confirm(`¿Desea importar ${accountsToImport.length} cuentas? (El catálogo de menú no se modificará).`)) {
        const localStore = JSON.parse(localStorage.getItem('casino_egipto_accounts') || '{}');
        for (const acc of accountsToImport) {
          if (acc && acc.id) {
            await db.accounts.put(acc);
            localStore[acc.id] = acc;
          }
        }
        localStorage.setItem('casino_egipto_accounts', JSON.stringify(localStore));
        
        showToast(`✅ ${accountsToImport.length} cuentas importadas con éxito`, "success", 2000);
        await renderHistoryList();
        
        // Si hay una cuenta activa importada y no hay cuenta en edición, cargarla
        const openAcc = accountsToImport.find(a => a.status === 'abierta');
        if (openAcc && (!STATE.isAccountStarted || Object.keys(STATE.cart).length === 0)) {
          loadAccountIntoState(openAcc);
        }
      }
    } catch (err) {
      console.error(err);
      showToast("Error al importar cuentas: formato JSON no válido", "error", 2500);
    }
  };
  reader.readAsText(file);
}

function setupBackupHandlers() {
  // --- Menú Backup Handlers ---
  const btnExportMenu = document.getElementById('btn-export-db');
  if (btnExportMenu) {
    btnExportMenu.addEventListener('click', exportMenuCatalog);
  }
  
  const btnImportMenu = document.getElementById('btn-import-db');
  const inputImportMenu = document.getElementById('import-db-file');
  if (btnImportMenu && inputImportMenu) {
    btnImportMenu.addEventListener('click', () => inputImportMenu.click());
    inputImportMenu.addEventListener('change', (e) => {
      importMenuCatalog(e.target.files[0]);
      inputImportMenu.value = '';
    });
  }
  
  const btnClearMenu = document.getElementById('btn-clear-db');
  if (btnClearMenu) {
    btnClearMenu.addEventListener('click', restoreDefaultMenu);
  }

  // --- Cuentas Backup Handlers (Cuenta & Histórico) ---
  const fileInputAccounts = document.getElementById('import-accounts-file');
  if (fileInputAccounts) {
    fileInputAccounts.addEventListener('change', (e) => {
      importAccountsData(e.target.files[0]);
      fileInputAccounts.value = '';
    });
  }

  const btnExportAcc = document.getElementById('btn-export-accounts');
  if (btnExportAcc) {
    btnExportAcc.addEventListener('click', exportAccountsData);
  }

  const btnImportAcc = document.getElementById('btn-import-accounts');
  if (btnImportAcc && fileInputAccounts) {
    btnImportAcc.addEventListener('click', () => fileInputAccounts.click());
  }

  const btnExportAccHist = document.getElementById('btn-export-accounts-hist');
  if (btnExportAccHist) {
    btnExportAccHist.addEventListener('click', exportAccountsData);
  }

  const btnImportAccHist = document.getElementById('btn-import-accounts-hist');
  if (btnImportAccHist && fileInputAccounts) {
    btnImportAccHist.addEventListener('click', () => fileInputAccounts.click());
  }
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
