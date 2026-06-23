import { getDefaultState, loadState, saveState } from "./storage.js";

const cfg = window.COLECCION_CONFIG || {};

const UI = {
  metricsGrid: document.getElementById("metrics-grid"),
  purchaseForm: document.getElementById("purchase-form"),
  purchaseName: document.getElementById("purchase-name"),
  purchaseDate: document.getElementById("purchase-date"),
  purchaseCategory: document.getElementById("purchase-category"),
  customCategoryField: document.getElementById("custom-category-field"),
  purchaseCustomCategory: document.getElementById("purchase-custom-category"),
  purchasePrice: document.getElementById("purchase-price"),
  purchaseNotes: document.getElementById("purchase-notes"),
  importKind: document.getElementById("import-kind"),
  importHelp: document.getElementById("import-help"),
  importCategory: document.getElementById("import-category"),
  importDate: document.getElementById("import-date"),
  importText: document.getElementById("import-text"),
  btnImportPurchases: document.getElementById("btn-import-purchases"),
  searchName: document.getElementById("search-name"),
  searchMode: document.getElementById("search-mode"),
  searchCategory: document.getElementById("search-category"),
  searchStatus: document.getElementById("search-status"),
  btnRunSearch: document.getElementById("btn-run-search"),
  btnClearSearch: document.getElementById("btn-clear-search"),
  resultsSummary: document.getElementById("results-summary"),
  resultsEmpty: document.getElementById("results-empty"),
  resultsPurchasesGroup: document.getElementById("results-purchases-group"),
  resultsPurchasesCount: document.getElementById("results-purchases-count"),
  resultsPurchasesBody: document.getElementById("results-purchases-body"),
  resultsSalesGroup: document.getElementById("results-sales-group"),
  resultsSalesCount: document.getElementById("results-sales-count"),
  resultsSalesBody: document.getElementById("results-sales-body"),
  detailBadge: document.getElementById("detail-badge"),
  detailEmpty: document.getElementById("detail-empty"),
  detailContent: document.getElementById("detail-content"),
  detailName: document.getElementById("detail-name"),
  detailCategory: document.getElementById("detail-category"),
  detailDate: document.getElementById("detail-date"),
  detailPurchasePrice: document.getElementById("detail-purchase-price"),
  detailAskingPrice: document.getElementById("detail-asking-price"),
  detailSoldPrice: document.getElementById("detail-sold-price"),
  detailNotes: document.getElementById("detail-notes"),
  purchasePriceInput: document.getElementById("purchase-price-input"),
  askingPriceInput: document.getElementById("asking-price-input"),
  soldPriceInput: document.getElementById("sold-price-input"),
  btnUpdatePurchasePrice: document.getElementById("btn-update-purchase-price"),
  btnMarkForSale: document.getElementById("btn-mark-for-sale"),
  btnMarkSold: document.getElementById("btn-mark-sold"),
  btnRevertSale: document.getElementById("btn-revert-sale"),
  btnDeleteItem: document.getElementById("btn-delete-item"),
  version: document.getElementById("version"),
  driveStatus: document.getElementById("drive-status"),
  saveStatus: document.getElementById("save-status"),
  driveClientId: document.getElementById("drive-client-id"),
  btnSaveClientId: document.getElementById("btn-save-clientid"),
  driveSignin: document.getElementById("btn-drive-signin"),
  driveSignout: document.getElementById("btn-drive-signout")
};

let appState = getDefaultState();
let selectedItemId = null;
let visibleItems = [];

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

function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-ES");
}

function newId(prefix) {
  if (window.crypto && window.crypto.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toAmount(value) {
  const parsedValue = parseAmountToken(value);
  return parsedValue === null ? 0 : parsedValue;
}

function parseAmountToken(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function resolveCategoryFields(category) {
  const normalizedCategory = String(category || "").trim() || "Otros";
  const knownCategories = new Set(["Cartucho", "Manual", "Caja", "Completo", "Consola", "Figura", "Merchandising"]);
  if (knownCategories.has(normalizedCategory)) {
    return {
      category: normalizedCategory,
      categoryType: normalizedCategory,
      customCategory: ""
    };
  }
  return {
    category: normalizedCategory,
    categoryType: "Otros",
    customCategory: normalizedCategory
  };
}

function normalizeComparableName(value) {
  return String(value || "").trim().toLowerCase();
}

function parsePurchaseImportBlock(rawText, defaultCategory, defaultDate) {
  const categoryFields = resolveCategoryFields(defaultCategory);
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const importedItems = [];
  const skippedLines = [];

  for (const line of lines) {
    const separatorIndex = line.lastIndexOf(";");
    if (separatorIndex <= 0) {
      skippedLines.push(line);
      continue;
    }

    const name = line.slice(0, separatorIndex).trim();
    const purchasePrice = parseAmountToken(line.slice(separatorIndex + 1));

    if (!name || purchasePrice === null) {
      skippedLines.push(line);
      continue;
    }

    importedItems.push({
      id: newId("item"),
      name,
      purchaseDate: defaultDate,
      purchasePrice,
      notes: "",
      status: "coleccion",
      askingPrice: 0,
      soldPrice: 0,
      soldAt: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...categoryFields
    });
  }

  return { importedItems, skippedLines };
}

function parseSaleImportBlock(rawText, defaultCategory, defaultDate) {
  const categoryFields = resolveCategoryFields(defaultCategory);
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const createdItems = [];
  const skippedLines = [];

  for (const line of lines) {
    const parts = line.split(";").map((part) => part.trim());
    while (parts.length && !parts[parts.length - 1]) {
      parts.pop();
    }

    if (parts.length < 3) {
      skippedLines.push(line);
      continue;
    }

    const [name, purchasePriceRaw, soldPriceRaw] = parts;
    const purchasePrice = parseAmountToken(purchasePriceRaw);
    const soldPrice = parseAmountToken(soldPriceRaw);

    if (!name || purchasePrice === null || soldPrice === null) {
      skippedLines.push(line);
      continue;
    }

    const soldAt = defaultDate || new Date().toISOString();
    const updatedAt = new Date().toISOString();

    const createdItem = {
      id: newId("item"),
      name,
      purchaseDate: defaultDate,
      purchasePrice,
      notes: "",
      status: "vendido",
      askingPrice: 0,
      soldPrice,
      soldAt,
      createdAt: updatedAt,
      updatedAt,
      ...categoryFields
    };

    createdItems.push(createdItem);
  }

  return { createdItems, skippedLines };
}

function refreshImportHelp() {
  const isSaleImport = UI.importKind.value === "sale";
  UI.importHelp.textContent = isSaleImport
    ? "Pega una linea por articulo con formato nombre;precio_compra;precio_venta;"
    : "Pega una linea por articulo con formato nombre;precio.";
  UI.importText.placeholder = isSaleImport
    ? "Adventures of lolo completo;174;220;\nBatman esp returns completo;200;260;"
    : "Adventures of lolo completo;174\nBatman esp returns completo;200";
}

function getSelectedItem() {
  return appState.items.find((item) => item.id === selectedItemId) || null;
}

function getItemStatusLabel(status) {
  if (status === "venta") return "Puesto a la venta";
  if (status === "vendido") return "Vendido";
  return "En coleccion";
}

function getStatusChipClass(status) {
  if (status === "venta") return "warning";
  if (status === "vendido") return "danger";
  return "success";
}

function updateCustomCategoryVisibility() {
  const showCustom = UI.purchaseCategory.value === "Otros";
  UI.customCategoryField.classList.toggle("hidden", !showCustom);
  UI.purchaseCustomCategory.required = showCustom;
}

function computeMetrics() {
  const totalPurchases = appState.items.reduce((total, item) => total + item.purchasePrice, 0);
  const totalSales = appState.items.reduce((total, item) => total + item.soldPrice, 0);
  return {
    purchases: totalPurchases,
    sales: totalSales,
    balance: totalSales - totalPurchases,
    items: appState.items.length
  };
}

function renderMetrics() {
  const metrics = computeMetrics();
  const cards = [
    {
      label: "Articulos",
      value: String(metrics.items),
      note: "Piezas registradas en la base de datos"
    },
    {
      label: "Compras",
      value: formatCurrency(metrics.purchases),
      note: "Coste total acumulado"
    },
    {
      label: "Ventas",
      value: formatCurrency(metrics.sales),
      note: "Importe total vendido"
    },
    {
      label: "Balance global",
      value: formatCurrency(metrics.balance),
      note: "Ventas menos compras"
    }
  ];

  UI.metricsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card">
          <div class="metric-label">${escapeHtml(card.label)}</div>
          <div class="metric-value">${escapeHtml(card.value)}</div>
          <div class="metric-note">${escapeHtml(card.note)}</div>
        </article>
      `
    )
    .join("");
}

function populateCategoryFilter() {
  const categories = Array.from(new Set(appState.items.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const currentValue = UI.searchCategory.value;
  UI.searchCategory.innerHTML = '<option value="">Todas</option>';

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    UI.searchCategory.appendChild(option);
  }

  UI.searchCategory.value = categories.includes(currentValue) ? currentValue : "";
}

function matchesSearch(name, query, mode) {
  if (!query) return true;
  const normalizedName = name.toLowerCase();
  if (mode === "starts") return normalizedName.startsWith(query);
  if (mode === "ends") return normalizedName.endsWith(query);
  return normalizedName.includes(query);
}

function getFilteredItems() {
  const query = UI.searchName.value.trim().toLowerCase();
  const mode = UI.searchMode.value;
  const category = UI.searchCategory.value;

  return [...appState.items]
    .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }))
    .filter((item) => {
      if (category && item.category !== category) return false;
      return matchesSearch(item.name, query, mode);
    });
}

function renderPurchasesTable(items) {
  UI.resultsPurchasesCount.textContent = `${items.length} articulo(s)`;
  UI.resultsPurchasesGroup.classList.toggle("hidden", items.length === 0);
  UI.resultsPurchasesBody.innerHTML = items
    .map((item) => {
      const statusLabel = getItemStatusLabel(item.status);
      const statusClass = item.status === "venta" ? "status-venta" : "status-coleccion";
      const selectedClass = item.id === selectedItemId ? "selected" : "";
      return `
        <tr class="result-row ${statusClass} ${selectedClass}" data-item-id="${escapeHtml(item.id)}">
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.category)}</td>
          <td>${escapeHtml(formatCurrency(item.purchasePrice))}</td>
          <td>${escapeHtml(statusLabel)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderSalesTable(items) {
  UI.resultsSalesCount.textContent = `${items.length} articulo(s)`;
  UI.resultsSalesGroup.classList.toggle("hidden", items.length === 0);
  UI.resultsSalesBody.innerHTML = items
    .map((item) => {
      const selectedClass = item.id === selectedItemId ? "selected" : "";
      const benefit = item.soldPrice - item.purchasePrice;
      const benefitClass = benefit >= 0 ? "amount-positive" : "amount-negative";
      return `
        <tr class="result-row status-vendido ${selectedClass}" data-item-id="${escapeHtml(item.id)}">
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.category)}</td>
          <td>${escapeHtml(formatCurrency(item.purchasePrice))}</td>
          <td>${escapeHtml(formatCurrency(item.soldPrice))}</td>
          <td class="${benefitClass}">${escapeHtml(formatCurrency(benefit))}</td>
        </tr>
      `;
    })
    .join("");
}

function renderResults() {
  const filteredItems = getFilteredItems();
  const purchaseItems = filteredItems.filter((item) => item.status !== "vendido");
  const salesItems = filteredItems.filter((item) => item.status === "vendido");
  const statusFilter = UI.searchStatus.value;
  const showPurchases = statusFilter !== "sales";
  const showSales = statusFilter !== "purchases";

  visibleItems = filteredItems.filter((item) => {
    if (statusFilter === "purchases") return item.status !== "vendido";
    if (statusFilter === "sales") return item.status === "vendido";
    return true;
  });

  const hasFilters = Boolean(UI.searchName.value.trim() || UI.searchCategory.value || statusFilter !== "all");
  if (statusFilter === "purchases") {
    UI.resultsSummary.textContent = hasFilters
      ? `${purchaseItems.length} compra(s)`
      : `Coleccion completa · ${purchaseItems.length} compra(s)`;
  } else if (statusFilter === "sales") {
    UI.resultsSummary.textContent = hasFilters
      ? `${salesItems.length} venta(s)`
      : `Coleccion completa · ${salesItems.length} venta(s)`;
  } else {
    UI.resultsSummary.textContent = hasFilters
      ? `${purchaseItems.length} compra(s) · ${salesItems.length} venta(s)`
      : `Coleccion completa · ${purchaseItems.length} compra(s) · ${salesItems.length} venta(s)`;
  }

  UI.resultsEmpty.classList.toggle("hidden", visibleItems.length > 0);
  UI.resultsPurchasesGroup.classList.toggle("hidden", !showPurchases || purchaseItems.length === 0);
  UI.resultsSalesGroup.classList.toggle("hidden", !showSales || salesItems.length === 0);

  if (!visibleItems.length) {
    UI.resultsPurchasesBody.innerHTML = "";
    UI.resultsSalesBody.innerHTML = "";
    if (!getSelectedItem()) {
      renderDetail(null);
    }
    return;
  }

  if (!visibleItems.some((item) => item.id === selectedItemId)) {
    selectedItemId = visibleItems[0].id;
  }

  renderPurchasesTable(purchaseItems);
  renderSalesTable(salesItems);

  UI.resultsPurchasesGroup.classList.toggle("hidden", !showPurchases || purchaseItems.length === 0);
  UI.resultsSalesGroup.classList.toggle("hidden", !showSales || salesItems.length === 0);

  renderDetail(getSelectedItem());
}

function renderDetail(item) {
  const selected = item || null;
  UI.detailEmpty.classList.toggle("hidden", Boolean(selected));
  UI.detailContent.classList.toggle("hidden", !selected);

  if (!selected) {
    UI.detailBadge.textContent = "Sin seleccionar";
    UI.detailBadge.className = "status-chip muted";
    UI.purchasePriceInput.value = "";
    UI.askingPriceInput.value = "";
    UI.soldPriceInput.value = "";
    UI.btnRevertSale.disabled = true;
    UI.btnRevertSale.textContent = "Revertir venta";
    return;
  }

  UI.detailBadge.textContent = getItemStatusLabel(selected.status);
  UI.detailBadge.className = `status-chip ${getStatusChipClass(selected.status)}`;
  UI.detailName.textContent = selected.name;
  UI.detailCategory.textContent = selected.category;
  UI.detailDate.textContent = formatDate(selected.purchaseDate);
  UI.detailPurchasePrice.textContent = formatCurrency(selected.purchasePrice);
  UI.detailAskingPrice.textContent = selected.askingPrice > 0 ? formatCurrency(selected.askingPrice) : "No indicado";
  UI.detailSoldPrice.textContent = selected.soldPrice > 0 ? formatCurrency(selected.soldPrice) : "No indicado";
  UI.detailNotes.textContent = selected.notes || "Sin notas";
  UI.purchasePriceInput.value = selected.purchasePrice > 0 ? String(selected.purchasePrice) : "";
  UI.askingPriceInput.value = selected.askingPrice > 0 ? String(selected.askingPrice) : "";
  UI.soldPriceInput.value = selected.soldPrice > 0 ? String(selected.soldPrice) : "";
  UI.btnRevertSale.disabled = selected.status === "coleccion";
  UI.btnRevertSale.textContent = selected.status === "venta" ? "Retirar de la venta" : "Revertir venta";
}

async function persistState() {
  appState.lastUpdated = new Date().toISOString();
  const saved = await saveState(appState, true);
  if (!saved) {
    UI.saveStatus.textContent = "No se ha podido guardar. Conecta Google Drive para tener persistencia real.";
    return false;
  }
  UI.saveStatus.textContent = `Base de datos sincronizada en Drive: ${cfg.driveFolderName}/${cfg.driveFileName}`;
  return true;
}

async function refreshDriveUI() {
  const hasClientId = Boolean((window.COLECCION_CONFIG.googleClientId || "").trim());
  const signed = window.driveApi && window.driveApi.isSignedIn && window.driveApi.isSignedIn();
  UI.driveStatus.textContent = signed ? "Conectado" : hasClientId ? "Listo para conectar" : "Sin conectar";
  UI.driveStatus.className = `status-chip ${signed ? "success" : hasClientId ? "warning" : "muted"}`;

  if (signed) {
    UI.saveStatus.textContent = `Base de datos sincronizada en Drive: ${cfg.driveFolderName}/${cfg.driveFileName}`;
  } else if (hasClientId) {
    UI.saveStatus.textContent = "La base de datos solo se guardara cuando conectes Google Drive.";
  } else {
    UI.saveStatus.textContent = "Introduce tu OAuth Client ID y conecta tu cuenta para usar la base de datos en Google Drive.";
  }
}

function collectPurchaseForm() {
  const categoryType = UI.purchaseCategory.value;
  const customCategory = UI.purchaseCustomCategory.value.trim();
  return {
    id: newId("item"),
    name: UI.purchaseName.value.trim(),
    purchaseDate: UI.purchaseDate.value,
    category: categoryType === "Otros" ? customCategory || "Otros" : categoryType,
    categoryType,
    customCategory,
    purchasePrice: toAmount(UI.purchasePrice.value),
    notes: UI.purchaseNotes.value.trim(),
    status: "coleccion",
    askingPrice: 0,
    soldPrice: 0,
    soldAt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function resetPurchaseForm() {
  UI.purchaseForm.reset();
  UI.purchaseCategory.value = "Cartucho";
  UI.purchaseDate.value = "";
  updateCustomCategoryVisibility();
}

function resetImportForm() {
  UI.importText.value = "";
  UI.importDate.value = "";
}

function renderAll() {
  renderMetrics();
  populateCategoryFilter();
  renderResults();
}

async function connectAndLoadFromDrive() {
  const loadedState = await loadState(true);
  appState = loadedState;
  if (!selectedItemId && appState.items.length) {
    selectedItemId = appState.items[0].id;
  }
  renderAll();
}

async function init() {
  UI.version.textContent = cfg.version || "";
  UI.driveClientId.value = window.COLECCION_CONFIG.googleClientId || "";
  updateCustomCategoryVisibility();
  refreshImportHelp();
  renderAll();
  await refreshDriveUI();

  try {
    if (window.driveApi && window.driveApi.prepare) {
      window.driveApi.prepare();
    }
  } catch {}

  UI.purchaseCategory.addEventListener("change", updateCustomCategoryVisibility);
  UI.importKind.addEventListener("change", refreshImportHelp);

  UI.purchaseForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const item = collectPurchaseForm();
    if (!item.name || item.purchasePrice <= 0) return;
    appState.items.push(item);
    selectedItemId = item.id;
    renderAll();
    resetPurchaseForm();
    await persistState();
  });

  UI.btnRunSearch.addEventListener("click", renderResults);

  UI.btnClearSearch.addEventListener("click", () => {
    UI.searchName.value = "";
    UI.searchMode.value = "contains";
    UI.searchCategory.value = "";
    UI.searchStatus.value = "all";
    renderResults();
  });

  UI.btnImportPurchases.addEventListener("click", async () => {
    const isSaleImport = UI.importKind.value === "sale";
    let skippedLines = [];
    let importedCount = 0;

    if (isSaleImport) {
      const { createdItems, skippedLines: saleSkippedLines } = parseSaleImportBlock(
        UI.importText.value,
        UI.importCategory.value,
        UI.importDate.value
      );
      skippedLines = saleSkippedLines;
      importedCount = createdItems.length;

      if (!importedCount) {
        alert("No se ha podido interpretar ninguna linea. Usa el formato nombre;precio_compra;precio_venta;");
        return;
      }

      if (createdItems.length) {
        appState.items.push(...createdItems);
      }

      const selectedId = createdItems[createdItems.length - 1].id;
      selectedItemId = selectedId || selectedItemId;
    } else {
      const { importedItems, skippedLines: purchaseSkippedLines } = parsePurchaseImportBlock(
        UI.importText.value,
        UI.importCategory.value,
        UI.importDate.value
      );
      skippedLines = purchaseSkippedLines;
      importedCount = importedItems.length;

      if (!importedItems.length) {
        alert("No se ha podido interpretar ninguna linea. Usa el formato nombre;precio.");
        return;
      }

      appState.items.push(...importedItems);
      selectedItemId = importedItems[importedItems.length - 1].id;
    }

    renderAll();
    await persistState();
    resetImportForm();

    const skippedMessage = skippedLines.length ? `\nLineas omitidas: ${skippedLines.length}` : "";
    const actionLabel = isSaleImport ? "venta(s)" : "compra(s)";
    alert(`Importadas ${importedCount} ${actionLabel}.${skippedMessage}`);
  });

  UI.searchName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      renderResults();
    }
  });

  UI.searchStatus.addEventListener("change", renderResults);

  document.querySelector(".results-block").addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-item-id]");
    if (!row) return;
    selectedItemId = row.dataset.itemId;
    renderResults();
  });

  UI.btnUpdatePurchasePrice.addEventListener("click", async () => {
    const item = getSelectedItem();
    if (!item) return;

    const purchasePrice = toAmount(UI.purchasePriceInput.value);
    if (purchasePrice <= 0) {
      alert("Introduce un precio de compra mayor que 0.");
      return;
    }

    item.purchasePrice = purchasePrice;
    item.updatedAt = new Date().toISOString();
    renderAll();
    await persistState();
  });

  UI.btnMarkForSale.addEventListener("click", async () => {
    const item = getSelectedItem();
    if (!item) return;
    item.askingPrice = toAmount(UI.askingPriceInput.value);
    item.status = "venta";
    item.updatedAt = new Date().toISOString();
    renderAll();
    await persistState();
  });

  UI.btnMarkSold.addEventListener("click", async () => {
    const item = getSelectedItem();
    if (!item) return;
    item.soldPrice = toAmount(UI.soldPriceInput.value);
    item.status = "vendido";
    item.soldAt = new Date().toISOString();
    item.updatedAt = item.soldAt;
    renderAll();
    await persistState();
  });

  UI.btnRevertSale.addEventListener("click", async () => {
    const item = getSelectedItem();
    if (!item || item.status === "coleccion") return;

    item.status = "coleccion";
    item.askingPrice = 0;
    item.soldPrice = 0;
    item.soldAt = "";
    item.updatedAt = new Date().toISOString();
    renderAll();
    await persistState();
  });

  UI.btnDeleteItem.addEventListener("click", async () => {
    const item = getSelectedItem();
    if (!item) return;
    if (!confirm(`Vas a eliminar "${item.name}" del inventario. Esta accion no se puede deshacer.`)) {
      return;
    }

    appState.items = appState.items.filter((candidate) => candidate.id !== item.id);
    selectedItemId = appState.items.length ? appState.items[0].id : null;
    renderAll();
    await persistState();
  });

  UI.btnSaveClientId.addEventListener("click", async () => {
    window.COLECCION_CONFIG.googleClientId = UI.driveClientId.value.trim();
    try {
      if (window.driveApi && window.driveApi.prepare) {
        await window.driveApi.prepare();
      }
    } catch {}
    await refreshDriveUI();
  });

  UI.driveSignin.addEventListener("click", async () => {
    window.COLECCION_CONFIG.googleClientId = UI.driveClientId.value.trim();
    if (!window.COLECCION_CONFIG.googleClientId) {
      alert("Introduce antes el OAuth Client ID de Google.");
      return;
    }
    try {
      await window.driveApi.signIn();
      await connectAndLoadFromDrive();
      await refreshDriveUI();
    } catch (error) {
      console.error("No se pudo conectar a Google Drive", error);
      alert("No se pudo conectar a Google Drive. Revisa el Client ID y los origenes autorizados.");
    }
  });

  UI.driveSignout.addEventListener("click", async () => {
    try {
      await window.driveApi.signOut();
    } catch {}
    appState = getDefaultState();
    selectedItemId = null;
    renderAll();
    await refreshDriveUI();
  });
}

init();
