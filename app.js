import { getDefaultState, loadState, saveState } from "./storage.js";

const cfg = window.COLECCION_CONFIG || {};

const UI = {
  metricsGrid: document.getElementById("metrics-grid"),
  inventoryList: document.getElementById("inventory-list"),
  transactionsList: document.getElementById("transactions-list"),
  filterSearch: document.getElementById("filter-search"),
  filterCategory: document.getElementById("filter-category"),
  filterStatus: document.getElementById("filter-status"),
  version: document.getElementById("version"),
  driveStatus: document.getElementById("drive-status"),
  saveStatus: document.getElementById("save-status"),
  toggleDrive: document.getElementById("toggle-drive"),
  driveSignin: document.getElementById("btn-drive-signin"),
  driveSignout: document.getElementById("btn-drive-signout"),
  driveClientId: document.getElementById("drive-client-id"),
  btnSaveClientId: document.getElementById("btn-save-clientid"),
  btnClearClientId: document.getElementById("btn-clear-clientid"),
  itemForm: document.getElementById("item-form"),
  itemId: document.getElementById("item-id"),
  itemName: document.getElementById("item-name"),
  itemCategory: document.getElementById("item-category"),
  itemPlatform: document.getElementById("item-platform"),
  itemFormat: document.getElementById("item-format"),
  itemStatus: document.getElementById("item-status"),
  itemLocation: document.getElementById("item-location"),
  itemPurchasePrice: document.getElementById("item-purchase-price"),
  itemEstimatedValue: document.getElementById("item-estimated-value"),
  itemNotes: document.getElementById("item-notes"),
  btnResetItem: document.getElementById("btn-reset-item"),
  btnDeleteItem: document.getElementById("btn-delete-item"),
  transactionForm: document.getElementById("transaction-form"),
  transactionItem: document.getElementById("transaction-item"),
  transactionType: document.getElementById("transaction-type"),
  transactionAmount: document.getElementById("transaction-amount"),
  transactionDate: document.getElementById("transaction-date"),
  transactionPlace: document.getElementById("transaction-place"),
  transactionNotes: document.getElementById("transaction-notes"),
  transactionMarkSold: document.getElementById("transaction-mark-sold")
};

let appState = getDefaultState();

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(Number(amount || 0));
}

function newId(prefix) {
  if (window.crypto && window.crypto.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function savePreferencesClientId() {
  const value = UI.driveClientId.value.trim();
  window.COLECCION_CONFIG.googleClientId = value;
  try {
    if (value) {
      localStorage.setItem("coleccion_google_client_id", value);
    } else {
      localStorage.removeItem("coleccion_google_client_id");
    }
  } catch {}
}

function setTodayOnTransactionForm() {
  if (!UI.transactionDate.value) {
    UI.transactionDate.value = new Date().toISOString().slice(0, 10);
  }
}

function getItemById(itemId) {
  return appState.items.find((item) => item.id === itemId) || null;
}

function computeMetrics() {
  const purchases = appState.transactions
    .filter((transaction) => transaction.type === "purchase")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const sales = appState.transactions
    .filter((transaction) => transaction.type === "sale")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const activeItems = appState.items.filter((item) => item.status !== "vendido");
  const activeIds = new Set(activeItems.map((item) => item.id));

  const activeInvestment = appState.transactions.reduce((total, transaction) => {
    if (!activeIds.has(transaction.itemId)) return total;
    return total + (transaction.type === "purchase" ? transaction.amount : -transaction.amount);
  }, 0);

  const activeEstimatedValue = activeItems.reduce((total, item) => total + item.estimatedValue, 0);

  return {
    purchases,
    sales,
    balance: sales - purchases,
    activeInvestment,
    activeEstimatedValue,
    itemCount: appState.items.length,
    activeCount: activeItems.length
  };
}

function renderMetrics() {
  const metrics = computeMetrics();
  const cards = [
    {
      label: "Objetos activos",
      value: `${metrics.activeCount}`,
      note: `${metrics.itemCount} registrados en total`
    },
    {
      label: "Compras",
      value: formatCurrency(metrics.purchases),
      note: "Todo lo invertido en adquisiciones"
    },
    {
      label: "Ventas",
      value: formatCurrency(metrics.sales),
      note: "Ingresos obtenidos por ventas"
    },
    {
      label: "Balance global",
      value: formatCurrency(metrics.balance),
      note: metrics.balance >= 0 ? "Ventas menos compras" : "Coste neto acumulado"
    },
    {
      label: "Coste coleccion activa",
      value: formatCurrency(metrics.activeInvestment),
      note: "Lo que sigues teniendo invertido"
    },
    {
      label: "Valor estimado",
      value: formatCurrency(metrics.activeEstimatedValue),
      note: "Suma del valor estimado de lo activo"
    }
  ];

  UI.metricsGrid.innerHTML = cards
    .map(
      (metric) => `
        <article class="metric-card">
          <div class="metric-label">${escapeHtml(metric.label)}</div>
          <div class="metric-value">${escapeHtml(metric.value)}</div>
          <div class="metric-note">${escapeHtml(metric.note)}</div>
        </article>
      `
    )
    .join("");
}

function populateCategoryFilter() {
  const categories = Array.from(new Set(appState.items.map((item) => item.category).filter(Boolean))).sort();
  const current = UI.filterCategory.value;
  UI.filterCategory.innerHTML = '<option value="">Todas</option>';
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    UI.filterCategory.appendChild(option);
  }
  UI.filterCategory.value = categories.includes(current) ? current : "";
}

function getFilteredItems() {
  const search = UI.filterSearch.value.trim().toLowerCase();
  const category = UI.filterCategory.value;
  const status = UI.filterStatus.value;

  return [...appState.items]
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .filter((item) => {
      if (category && item.category !== category) return false;
      if (status && item.status !== status) return false;
      if (!search) return true;

      const haystack = [
        item.name,
        item.category,
        item.platform,
        item.format,
        item.location,
        item.notes,
        item.status
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
}

function renderInventory() {
  const items = getFilteredItems();
  if (!items.length) {
    UI.inventoryList.innerHTML = '<div class="transaction-card muted">No hay objetos que coincidan con el filtro.</div>';
    return;
  }

  UI.inventoryList.innerHTML = items
    .map(
      (item) => `
        <article class="inventory-card" data-item-id="${escapeHtml(item.id)}">
          <header>
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <div class="muted small-text">${escapeHtml(item.category)}${item.platform ? ` · ${escapeHtml(item.platform)}` : ""}</div>
            </div>
            <span class="status-chip ${item.status === "vendido" ? "warning" : item.status === "reservado" ? "muted" : "success"}">${escapeHtml(item.status)}</span>
          </header>

          <div class="inventory-meta">
            <div><strong>Formato:</strong> ${escapeHtml(item.format || "No indicado")}</div>
            <div><strong>Ubicacion:</strong> ${escapeHtml(item.location || "No indicada")}</div>
            <div><strong>Compra:</strong> ${formatCurrency(item.purchasePrice)}</div>
            <div><strong>Valor estimado:</strong> ${formatCurrency(item.estimatedValue)}</div>
          </div>

          ${item.notes ? `<div class="inventory-notes">${escapeHtml(item.notes)}</div>` : ""}

          <div class="card-actions">
            <button class="btn" data-action="edit" data-item-id="${escapeHtml(item.id)}">Editar</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderTransactions() {
  const itemsById = new Map(appState.items.map((item) => [item.id, item]));
  const transactions = [...appState.transactions].sort((left, right) => {
    const rightKey = `${right.date}|${right.createdAt}`;
    const leftKey = `${left.date}|${left.createdAt}`;
    return rightKey.localeCompare(leftKey);
  });

  if (!transactions.length) {
    UI.transactionsList.innerHTML = '<div class="transaction-card muted">Aun no hay compras ni ventas registradas.</div>';
    return;
  }

  UI.transactionsList.innerHTML = transactions
    .slice(0, 12)
    .map((transaction) => {
      const item = itemsById.get(transaction.itemId);
      const typeLabel = transaction.type === "sale" ? "Venta" : "Compra";
      return `
        <article class="transaction-card">
          <header>
            <div>
              <h3>${escapeHtml(item ? item.name : "Objeto eliminado")}</h3>
              <div class="muted small-text">${escapeHtml(typeLabel)} · ${escapeHtml(transaction.date || "Sin fecha")}</div>
            </div>
            <span class="status-chip ${transaction.type === "sale" ? "success" : "warning"}">${escapeHtml(formatCurrency(transaction.amount))}</span>
          </header>
          <div class="transaction-meta">
            <div><strong>Lugar:</strong> ${escapeHtml(transaction.place || "No indicado")}</div>
            <div><strong>Notas:</strong> ${escapeHtml(transaction.notes || "Sin notas")}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function refreshTransactionItems() {
  const currentValue = UI.transactionItem.value;
  const type = UI.transactionType.value;
  const items = [...appState.items].filter((item) => (type === "sale" ? item.status !== "vendido" : true));

  UI.transactionItem.innerHTML = "";

  if (!items.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Primero registra un objeto en el inventario";
    UI.transactionItem.appendChild(option);
    return;
  }

  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.name} · ${item.category}${item.platform ? ` · ${item.platform}` : ""}`;
    UI.transactionItem.appendChild(option);
  }

  UI.transactionItem.value = items.some((item) => item.id === currentValue) ? currentValue : items[0].id;
}

function resetItemForm() {
  UI.itemForm.reset();
  UI.itemId.value = "";
  UI.itemCategory.value = "Videojuego";
  UI.itemStatus.value = "disponible";
}

function loadItemIntoForm(itemId) {
  const item = getItemById(itemId);
  if (!item) return;

  UI.itemId.value = item.id;
  UI.itemName.value = item.name;
  UI.itemCategory.value = item.category;
  UI.itemPlatform.value = item.platform;
  UI.itemFormat.value = item.format;
  UI.itemStatus.value = item.status;
  UI.itemLocation.value = item.location;
  UI.itemPurchasePrice.value = item.purchasePrice || "";
  UI.itemEstimatedValue.value = item.estimatedValue || "";
  UI.itemNotes.value = item.notes;
  UI.itemName.focus();
}

async function persistState() {
  appState.lastUpdated = new Date().toISOString();
  await saveState(appState, UI.toggleDrive.checked && !!window.COLECCION_CONFIG.googleClientId);
  await refreshPersistenceUI();
}

async function refreshPersistenceUI() {
  const hasClientId = !!(window.COLECCION_CONFIG.googleClientId || "").trim();
  const useDrive = UI.toggleDrive.checked && hasClientId;
  const signed = window.driveApi && window.driveApi.isSignedIn && window.driveApi.isSignedIn();

  UI.driveStatus.textContent = useDrive ? (signed ? "Drive activo" : "Drive pendiente") : "Local";
  UI.driveStatus.className = `status-chip ${signed ? "success" : useDrive ? "warning" : "muted"}`;

  if (!hasClientId) {
    UI.saveStatus.textContent = "Configura tu Google OAuth Client ID para guardar el JSON dentro de la carpeta PROGRAMA_WEB_GASTOS de tu Drive.";
    return;
  }

  if (useDrive && signed) {
    UI.saveStatus.textContent = `Sincronizando en Drive: ${cfg.driveFolderName}/${cfg.driveFileName}`;
  } else if (useDrive && !signed) {
    UI.saveStatus.textContent = "Drive activado, pero falta conectar tu cuenta. Mientras tanto se usa LocalStorage.";
  } else {
    UI.saveStatus.textContent = "Guardando solo en este navegador mediante LocalStorage.";
  }
}

function renderAll() {
  renderMetrics();
  populateCategoryFilter();
  renderInventory();
  renderTransactions();
  refreshTransactionItems();
}

function collectItemForm() {
  return {
    id: UI.itemId.value || newId("item"),
    name: UI.itemName.value.trim(),
    category: UI.itemCategory.value,
    platform: UI.itemPlatform.value.trim(),
    format: UI.itemFormat.value.trim(),
    status: UI.itemStatus.value,
    location: UI.itemLocation.value.trim(),
    purchasePrice: asNumber(UI.itemPurchasePrice.value),
    estimatedValue: asNumber(UI.itemEstimatedValue.value),
    notes: UI.itemNotes.value.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function upsertItem(item) {
  const index = appState.items.findIndex((current) => current.id === item.id);
  if (index >= 0) {
    item.createdAt = appState.items[index].createdAt;
    appState.items[index] = { ...appState.items[index], ...item, updatedAt: new Date().toISOString() };
    return;
  }
  appState.items.push(item);
}

function deleteItem(itemId) {
  appState.items = appState.items.filter((item) => item.id !== itemId);
  appState.transactions = appState.transactions.filter((transaction) => transaction.itemId !== itemId);
}

function createTransactionFromForm() {
  return {
    id: newId("tx"),
    itemId: UI.transactionItem.value,
    type: UI.transactionType.value,
    amount: asNumber(UI.transactionAmount.value),
    date: UI.transactionDate.value,
    place: UI.transactionPlace.value.trim(),
    notes: UI.transactionNotes.value.trim(),
    createdAt: new Date().toISOString()
  };
}

async function init() {
  UI.version.textContent = cfg.version || "";
  setTodayOnTransactionForm();
  resetItemForm();

  try {
    const savedId = localStorage.getItem("coleccion_google_client_id");
    if (savedId && !cfg.googleClientId) {
      window.COLECCION_CONFIG.googleClientId = savedId;
    }
  } catch {}

  UI.driveClientId.value = window.COLECCION_CONFIG.googleClientId || "";
  UI.toggleDrive.checked = !!window.COLECCION_CONFIG.googleClientId;

  appState = await loadState(UI.toggleDrive.checked && !!window.COLECCION_CONFIG.googleClientId);
  renderAll();
  await refreshPersistenceUI();

  try {
    if (window.driveApi && window.driveApi.prepare) {
      window.driveApi.prepare();
    }
  } catch {}

  if (UI.toggleDrive.checked && window.COLECCION_CONFIG.googleClientId && window.driveApi && window.driveApi.trySilentSignIn) {
    const connected = await window.driveApi.trySilentSignIn();
    if (connected) {
      const remoteState = await loadState(true);
      appState = remoteState;
      renderAll();
      await refreshPersistenceUI();
    }
  }

  UI.itemForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = collectItemForm();
    if (!item.name) return;
    upsertItem(item);
    renderAll();
    resetItemForm();
    await persistState();
  });

  UI.btnResetItem.addEventListener("click", () => {
    resetItemForm();
  });

  UI.btnDeleteItem.addEventListener("click", async () => {
    const itemId = UI.itemId.value;
    if (!itemId) return;
    deleteItem(itemId);
    resetItemForm();
    renderAll();
    await persistState();
  });

  UI.inventoryList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='edit']");
    if (!button) return;
    loadItemIntoForm(button.dataset.itemId);
  });

  UI.transactionType.addEventListener("change", () => {
    refreshTransactionItems();
    UI.transactionMarkSold.checked = UI.transactionType.value === "sale";
  });

  UI.transactionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const transaction = createTransactionFromForm();
    if (!transaction.itemId || !transaction.date || transaction.amount <= 0) return;

    appState.transactions.push(transaction);
    if (transaction.type === "sale" && UI.transactionMarkSold.checked) {
      const item = getItemById(transaction.itemId);
      if (item) {
        item.status = "vendido";
        item.updatedAt = new Date().toISOString();
      }
    }

    const item = getItemById(transaction.itemId);
    if (item && transaction.type === "purchase" && !item.purchasePrice) {
      item.purchasePrice = transaction.amount;
      item.updatedAt = new Date().toISOString();
    }

    UI.transactionForm.reset();
    setTodayOnTransactionForm();
    UI.transactionType.value = "purchase";
    UI.transactionMarkSold.checked = true;
    renderAll();
    await persistState();
  });

  UI.filterSearch.addEventListener("input", renderInventory);
  UI.filterCategory.addEventListener("change", renderInventory);
  UI.filterStatus.addEventListener("change", renderInventory);

  UI.toggleDrive.addEventListener("change", async () => {
    await refreshPersistenceUI();
  });

  UI.btnSaveClientId.addEventListener("click", async () => {
    savePreferencesClientId();
    try {
      if (window.driveApi && window.driveApi.prepare) {
        await window.driveApi.prepare();
      }
    } catch {}
    await refreshPersistenceUI();
  });

  UI.btnClearClientId.addEventListener("click", async () => {
    UI.driveClientId.value = "";
    savePreferencesClientId();
    UI.toggleDrive.checked = false;
    await refreshPersistenceUI();
  });

  UI.driveSignin.addEventListener("click", async () => {
    savePreferencesClientId();
    if (!window.COLECCION_CONFIG.googleClientId) {
      alert("Antes de conectar, pega tu Google OAuth Client ID.");
      return;
    }

    try {
      await window.driveApi.signIn();
      UI.toggleDrive.checked = true;
      const remoteState = await loadState(true);
      appState = remoteState;
      renderAll();
      await refreshPersistenceUI();
    } catch (error) {
      const debug = window.driveApi && window.driveApi.getDebugInfo ? window.driveApi.getDebugInfo() : null;
      console.error("No se pudo conectar a Drive", error, debug);
      alert("No se pudo conectar a Google Drive. Revisa el Client ID y los dominios autorizados en Google Cloud.");
    }
  });

  UI.driveSignout.addEventListener("click", async () => {
    try {
      await window.driveApi.signOut();
    } catch {}
    await refreshPersistenceUI();
  });
}

init();