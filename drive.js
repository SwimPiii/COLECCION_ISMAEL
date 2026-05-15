(function () {
  const cfg = window.COLECCION_CONFIG || {};
  const state = {
    gapiLoaded: false,
    clientInitialized: false,
    signedIn: false,
    folderId: cfg.driveFolderId || null,
    fileId: null,
    lastError: null
  };

  let tokenClient = null;
  let pendingAuthReject = null;

  function getClientId() {
    return (window.COLECCION_CONFIG && window.COLECCION_CONFIG.googleClientId) || "";
  }

  function getAccountHint() {
    return (window.COLECCION_CONFIG && window.COLECCION_CONFIG.googleAccountHint) || "";
  }

  async function waitForGIS(timeoutMs = 5000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      (function loop() {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          resolve(true);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error("GIS no se ha cargado a tiempo"));
          return;
        }
        setTimeout(loop, 100);
      })();
    });
  }

  async function loadGapi() {
    if (state.gapiLoaded) return;
    await new Promise((resolve) => {
      (function waitForGapi() {
        if (window.gapi && window.gapi.load) {
          resolve();
          return;
        }
        setTimeout(waitForGapi, 100);
      })();
    });
    state.gapiLoaded = true;
  }

  async function initClient() {
    if (!getClientId()) return false;
    await loadGapi();
    return new Promise((resolve, reject) => {
      window.gapi.load("client", async () => {
        try {
          await window.gapi.client.init({
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
          });
          state.clientInitialized = true;
          resolve(true);
        } catch (error) {
          state.lastError = error;
          reject(error);
        }
      });
    });
  }

  function createTokenClient() {
    const clientId = getClientId();
    if (!clientId || !(window.google && window.google.accounts && window.google.accounts.oauth2)) {
      return null;
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: cfg.googleScopes,
      callback: "",
      hint: getAccountHint(),
      error_callback: (error) => {
        state.lastError = error;
        if (pendingAuthReject) {
          const reject = pendingAuthReject;
          pendingAuthReject = null;
          reject(error);
        }
      }
    });
    return tokenClient;
  }

  async function prepare() {
    try {
      await initClient();
    } catch (error) {
      state.lastError = error;
    }
  }

  async function resolveFolderId() {
    if (state.folderId) {
      try {
        await window.gapi.client.drive.files.get({ fileId: state.folderId, fields: "id,name" });
        return state.folderId;
      } catch (error) {
        state.lastError = error;
      }
    }

    const query = `name='${cfg.driveFolderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const response = await window.gapi.client.drive.files.list({ q: query, pageSize: 1, fields: "files(id,name)" });
    if (response.result.files && response.result.files.length) {
      state.folderId = response.result.files[0].id;
      return state.folderId;
    }

    const created = await window.gapi.client.drive.files.create({
      resource: {
        name: cfg.driveFolderName,
        mimeType: "application/vnd.google-apps.folder"
      },
      fields: "id"
    });
    state.folderId = created.result.id;
    return state.folderId;
  }

  async function getOrCreateFile(folderId) {
    const query = `name='${cfg.driveFileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`;
    const response = await window.gapi.client.drive.files.list({ q: query, pageSize: 1, fields: "files(id,name)" });
    if (response.result.files && response.result.files.length) {
      state.fileId = response.result.files[0].id;
      return state.fileId;
    }

    const created = await window.gapi.client.drive.files.create({
      resource: {
        name: cfg.driveFileName,
        mimeType: "application/json",
        parents: [folderId]
      },
      fields: "id"
    });
    state.fileId = created.result.id;
    await uploadContent(state.fileId, JSON.stringify({}));
    return state.fileId;
  }

  async function ensureFolderAndFile() {
    const folderId = await resolveFolderId();
    await getOrCreateFile(folderId);
  }

  async function uploadContent(fileId, content) {
    const boundary = "coleccion_boundary";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    const metadata = { name: cfg.driveFileName, mimeType: "application/json" };
    const body =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      content +
      closeDelimiter;

    return window.gapi.client.request({
      path: `/upload/drive/v3/files/${fileId}`,
      method: "PATCH",
      params: { uploadType: "multipart" },
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body
    });
  }

  function isNotFoundError(error) {
    const code = error && (error.status || (error.result && error.result.error && error.result.error.code));
    return code === 404;
  }

  async function signIn() {
    if (!getClientId()) {
      throw new Error("Client ID no configurado");
    }
    if (!tokenClient) {
      await waitForGIS();
      createTokenClient();
    }
    if (!tokenClient) {
      throw new Error("No se ha podido crear el cliente OAuth");
    }

    return new Promise((resolve, reject) => {
      pendingAuthReject = reject;
      tokenClient.callback = async (response) => {
        try {
          pendingAuthReject = null;
          if (!response || !response.access_token) {
            throw new Error("No se obtuvo access_token");
          }
          await initClient();
          window.gapi.client.setToken({ access_token: response.access_token });
          state.signedIn = true;
          await ensureFolderAndFile();
          resolve(true);
        } catch (error) {
          state.lastError = error;
          reject(error);
        }
      };

      try {
        tokenClient.requestAccessToken({
          prompt: "consent",
          hint: getAccountHint()
        });
      } catch (error) {
        state.lastError = error;
        reject(error);
      }
    });
  }

  async function trySilentSignIn() {
    if (!getClientId()) return false;

    try {
      await initClient();
      await waitForGIS();
      if (!tokenClient) createTokenClient();
      if (!tokenClient) return false;

      return await new Promise((resolve) => {
        tokenClient.callback = async (response) => {
          if (response && response.access_token) {
            try {
              window.gapi.client.setToken({ access_token: response.access_token });
              state.signedIn = true;
              await ensureFolderAndFile();
              resolve(true);
            } catch {
              resolve(false);
            }
          } else {
            resolve(false);
          }
        };

        try {
          tokenClient.requestAccessToken({
            prompt: "none",
            hint: getAccountHint()
          });
        } catch {
          resolve(false);
        }
      });
    } catch (error) {
      state.lastError = error;
      return false;
    }
  }

  async function signOut() {
    try {
      const token = window.gapi.client.getToken();
      if (token) {
        await window.google.accounts.oauth2.revoke(token.access_token);
        window.gapi.client.setToken("");
      }
    } catch (error) {
      state.lastError = error;
    }
    state.signedIn = false;
    state.fileId = null;
  }

  async function loadFromDrive() {
    if (!state.signedIn) throw new Error("No autenticado");
    if (!state.fileId) await ensureFolderAndFile();
    try {
      const response = await window.gapi.client.drive.files.get({ fileId: state.fileId, alt: "media" });
      return response.result && Object.keys(response.result).length ? response.result : null;
    } catch (error) {
      if (isNotFoundError(error)) {
        await ensureFolderAndFile();
        return null;
      }
      throw error;
    }
  }

  async function saveToDrive(payload) {
    if (!state.signedIn) throw new Error("No autenticado");
    if (!state.fileId) await ensureFolderAndFile();

    try {
      await uploadContent(state.fileId, JSON.stringify(payload));
    } catch (error) {
      if (isNotFoundError(error)) {
        await ensureFolderAndFile();
        await uploadContent(state.fileId, JSON.stringify(payload));
      } else {
        throw error;
      }
    }
  }

  window.driveApi = {
    isReady: () => !!(state.gapiLoaded && state.clientInitialized && getClientId()),
    isSignedIn: () => state.signedIn,
    getDebugInfo: () => ({
      ready: !!(state.gapiLoaded && state.clientInitialized),
      signedIn: state.signedIn,
      folderId: state.folderId,
      fileId: state.fileId,
      lastError: state.lastError
    }),
    prepare,
    signIn,
    signOut,
    trySilentSignIn,
    loadFromDrive,
    saveToDrive
  };
})();