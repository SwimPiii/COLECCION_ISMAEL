function normalizeNumber(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeCategory(item) {
  if (item.category && String(item.category).trim()) {
    return String(item.category).trim();
  }

  if (item.categoryType === "Otros" && item.customCategory) {
    return String(item.customCategory).trim() || "Otros";
  }

  return "Otros";
}

function normalizeStatus(value) {
  const status = String(value || "coleccion").trim().toLowerCase();
  if (status === "venta" || status === "vendido") return status;
  return "coleccion";
}

function normalizeItem(item) {
  const category = normalizeCategory(item);
  const askingPrice = normalizeNumber(item.askingPrice);
  const soldPrice = normalizeNumber(item.soldPrice);
  const soldAt = String(item.soldAt || "").trim();
  let status = normalizeStatus(item.status);

  // Compatibilidad con datos antiguos: si ya hay venta guardada, inferimos el estado.
  if (status === "coleccion" && soldPrice > 0) {
    status = "vendido";
  } else if (status === "coleccion" && soldAt) {
    status = "vendido";
  } else if (status === "coleccion" && askingPrice > 0) {
    status = "venta";
  }

  return {
    id: String(item.id || ""),
    name: String(item.name || "").trim(),
    category,
    categoryType: item.categoryType === "Otros" ? "Otros" : category,
    customCategory: item.categoryType === "Otros" ? category : String(item.customCategory || "").trim(),
    purchaseDate: String(item.purchaseDate || item.date || "").trim(),
    purchasePrice: normalizeNumber(item.purchasePrice),
    notes: String(item.notes || "").trim(),
    status,
    askingPrice,
    soldPrice,
    soldAt,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

export function getDefaultState() {
  return {
    items: [],
    lastUpdated: new Date().toISOString()
  };
}

export function normalizeState(rawState) {
  if (!rawState || typeof rawState !== "object") {
    return getDefaultState();
  }

  return {
    items: Array.isArray(rawState.items) ? rawState.items.map(normalizeItem) : [],
    lastUpdated: rawState.lastUpdated || new Date().toISOString()
  };
}

export async function loadState(preferDrive) {
  if (preferDrive && window.driveApi && window.driveApi.isReady() && window.driveApi.isSignedIn()) {
    try {
      const remoteState = await window.driveApi.loadFromDrive();
      if (remoteState) {
        return normalizeState(remoteState);
      }
    } catch (error) {
      console.warn("No se pudo cargar desde Drive", error);
    }
  }

  return getDefaultState();
}

export async function saveState(state, preferDrive) {
  if (!preferDrive || !window.driveApi || !window.driveApi.isReady() || !window.driveApi.isSignedIn()) {
    return false;
  }

  const normalized = normalizeState({ ...state, lastUpdated: new Date().toISOString() });
  await window.driveApi.saveToDrive(normalized);
  return true;
}
