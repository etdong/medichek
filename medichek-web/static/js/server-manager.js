/**
 * Server Manager
 *
 * - checkServer()
 * - checkMinIOServer()
 * - initializeApplication()
 * - hideLoadingScreen()
 * - continueOffline()
 * - retryConnection()
 *
 * Assumptions:
 * - Backend health endpoints exist at `${SERVER_URL}/api/health` and `${SERVER_URL}/api/minio/health`.
 * - These can be adjusted to match your backend.
 */

import { addLog } from './utils.js';
import { SERVER_URL, setOfflineMode, setServerOnline, setMinioOnline, setCurrentServerStatus, setCurrentMinioStatus } from './config.js';
import { loadingScreen, offlinePrompt, continueOfflineBtn, retryConnectionBtn } from './dom-elements.js';
import { updateLoadingScreenStatuses, updateServerStatus } from './ui-manager.js';

// Small fetch helper with timeout
async function fetchWithTimeout(url, opts = {}, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { signal: controller.signal, ...opts });
        clearTimeout(id);
        return res;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

/**
 * Check server health endpoint
 */
export async function checkServer() {
    setCurrentServerStatus('checking');
    updateLoadingScreenStatuses();
    updateServerStatus('Checking...');

    const endpoint = `${SERVER_URL.replace(/\/$/, '')}/api/health`;
    try {
        const resp = await fetchWithTimeout(endpoint, {}, 5000);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        setServerOnline(true);
        setCurrentServerStatus('online');
        updateLoadingScreenStatuses();
        updateServerStatus('Connected');
        addLog('✅ Server reachable');
        return { ok: true };
    } catch (err) {
        setServerOnline(false);
        setCurrentServerStatus('offline');
        updateLoadingScreenStatuses();
        updateServerStatus('Offline Mode');
        addLog('⚠️ Server not reachable: ' + (err.message || err), 'warning');
        return { ok: false, error: err && err.message ? err.message : String(err) };
    }
}

/**
 * Check MinIO health via backend endpoint
 */
export async function checkMinIOServer() {
    if (!MedichekConfig.minIO.enabled) {
        return false;
    }

    setCurrentMinioStatus('checking');
    updateLoadingScreenStatuses();
    
    try {
        // Configure AWS SDK to work with MinIO
        AWS.config.update({
            accessKeyId: MedichekConfig.minIO.accessKey,
            secretAccessKey: MedichekConfig.minIO.secretKey,
            region: MedichekConfig.minIO.region,
            s3ForcePathStyle: true
        });
        
        const s3 = new AWS.S3({
            endpoint: `${MedichekConfig.minIO.useSSL ? 'https' : 'http'}://${MedichekConfig.minIO.endPoint}:${MedichekConfig.minIO.port}`,
            s3BucketEndpoint: false
        });
        
        // Try to list buckets to test connection
        // Use callback-based approach instead of promise
        return new Promise((resolve, reject) => {
            s3.listBuckets((err, data) => {
                if (err) {
                    reject(err);
                } else {
                    setMinioOnline(true);
                    setCurrentMinioStatus('online');
                    updateLoadingScreenStatuses();
                    addLog('✅ MinIO reachable');
                    resolve({ ok: true });
                }
            });
        });
    } catch (error) {
        setMinioOnline(false);
        setCurrentMinioStatus('offline');
        updateLoadingScreenStatuses();
        addLog('⚠️ MinIO not reachable: ' + (error.message || error), 'warning');
        return { ok: false, error: error && error.message ? error.message : String(error) };
    }
    
    // Endpoint assumption; change if backend exposes a different route
    const endpoint = `${MedichekConfig.minIO.endPoint.replace(/\/$/, '')}/api/minio/health`;
    try {
        const resp = await fetchWithTimeout(endpoint, {}, 5000);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        setMinioOnline(true);
        setCurrentMinioStatus('online');
        updateLoadingScreenStatuses();
        addLog('✅ MinIO reachable');
        return { ok: true };
    } catch (err) {
        setMinioOnline(false);
        setCurrentMinioStatus('offline');
        updateLoadingScreenStatuses();
        addLog('⚠️ MinIO not reachable: ' + (err.message || err), 'warning');
        return { ok: false, error: err && err.message ? err.message : String(err) };
    }
}

/**
 * Initialize application: check server & minio and then hide loading screen or show offline prompt
 */
export async function initializeApplication() {
    addLog('🔎 Initializing application - checking server and MinIO');

    // Run both checks in parallel
    const [serverResult, minioResult] = await Promise.allSettled([checkServer(), checkMinIOServer()]);

    // If server check succeeded, hide loading screen and proceed
    const serverOk = serverResult.status === 'fulfilled' && serverResult.value && serverResult.value.ok;
    const minioOk = minioResult.status === 'fulfilled' && minioResult.value && minioResult.value.ok;

    if (serverOk) {
        // Ensure offline mode is cleared
        try { setOfflineMode(false); } catch (e) {}
        hideLoadingScreen();
        return { server: true, minio: !!minioOk };
    }

    // Server not reachable: show offline prompt
    if (offlinePrompt) offlinePrompt.style.display = 'block';

    // Attach handlers to the prompt buttons (defensive - idempotent)
    if (continueOfflineBtn) {
        continueOfflineBtn.onclick = () => continueOffline();
    }
    if (retryConnectionBtn) {
        retryConnectionBtn.onclick = () => retryConnection();
    }

    return { server: false, minio: !!minioOk };
}

/**
 * Hide the loading screen and allow app to proceed
 */
export function hideLoadingScreen() {
    try {
        if (loadingScreen) loadingScreen.style.display = 'none';
    } catch (err) {
        console.warn('hideLoadingScreen error', err);
    }
}

/**
 * Continue in offline mode (skip server checks)
 */
export function continueOffline() {
    try {
        setOfflineMode(true);
        addLog('⚠️ Continuing in offline mode');
        hideLoadingScreen();
    } catch (err) {
        console.error('continueOffline error', err);
    }
}

/**
 * Retry connection (re-run initializeApplication)
 */
export async function retryConnection() {
    addLog('🔁 Retrying server connection...');
    if (offlinePrompt) offlinePrompt.style.display = 'none';
    return initializeApplication();
}

export default {
    checkServer,
    checkMinIOServer,
    initializeApplication,
    hideLoadingScreen,
    continueOffline,
    retryConnection
};
