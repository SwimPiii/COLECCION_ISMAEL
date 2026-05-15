const LOCAL_KEY = "coleccion_tracker_state_v1";

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeItem(item) {
  return {
    id: String(item.id || ""),
    name: String(item.name || "").trim(),
    category: String(item.category || "Otro").trim() || "Otro",
    platform: String(item.platform || "").trim(),
    format: String(item.format || "").trim(),
    location: String(item.location || "").trim(),
    status: String(item.status || "disponible").trim() || "disponible",
    purchasePrice: normalizeNumber(item.purchasePrice),
    estimatedValue: normalizeNumber(item.estimatedValue),
    notes: String(item.notes || "").trim(),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function normalizeTransaction(transaction) {
  return {
    id: String(transaction.id || ""),
    itemId: String(transaction.itemId || ""),
    type: transaction.type === "sale" ? "sale" : "purchase",
    amount: normalizeNumber(transaction.amount),
    date: String(transaction.date || "").trim(),
    place: String(transaction.place || "").trim(),
    notes: String(transaction.notes || "").trim(),
    createdAt: transaction.createdAt || new Date().toISOString()
  };
}

export function getDefaultState() {
  return {
    items: [],
    transactions: [],
    lastUpdated: new Date().toISOString()
  };
}

export function normalizeState(rawState) {
  if (!rawState || typeof rawState !== "object") {
    return getDefaultState();
  }

  return {
    items: Array.isArray(rawState.items) ? rawState.items.map(normalizeItem) : [],
    transactions: Array.isArray(rawState.transactions)
      ? rawState.transactions.map(normalizeTransaction)
      : [],
    lastUpdated: rawState.lastUpdated || new Date().toISOString()
  };
}

export function loadLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn("No se pudo cargar el estado local", error);
    return null;
  }
}

export function saveLocalState(state) {
  try {
    const payload = { ...normalizeState(state), lastUpdated: new Date().toISOString() };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn("No se pudo guardar el estado local", error);
    return false;
  }
}

export async function loadState(preferDrive) {
  if (preferDrive && window.driveApi && window.driveApi.isReady()) {
    try {
      const remoteState = await window.driveApi.loadFromDrive();
      if (remoteState) {
        const normalized = normalizeState(remoteState);
        saveLocalState(normalized);
        return normalized;
      }
    } catch (error) {
      console.warn("No se pudo cargar desde Drive, usando almacenamiento local", error);
    }
  }

  return loadLocalState() || getDefaultState();
}

export async function saveState(state, preferDrive) {
  const normalized = normalizeState(state);
  saveLocalState(normalized);

  if (preferDrive && window.driveApi && window.driveApi.isReady()) {
    try {
      await window.driveApi.saveToDrive(normalized);
      return true;
    } catch (error) {
      console.warn("No se pudo guardar en Drive; se mantiene el almacenamiento local", error);
    }
  }

  return false;
}