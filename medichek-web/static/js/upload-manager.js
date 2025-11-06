/**
 * Upload Manager
 *
 * Responsibilities:
 * - uploadToMinIO(analysis)
 * - submitAnalysis()
 * - downloadLocalAnalysis()
 * - downloadAllRecordings()
 * - showCompletionScreen()
 *
 * Notes / assumptions:
 * - Assumes a backend upload endpoint at `${SERVER_URL}/api/upload` that accepts multipart/form-data
 *   with fields: analysis (JSON), files (video/image blobs).
 * - If `offlineMode` is true or upload fails, falls back to a local download of the analysis JSON and recordings.
 */

import { addLog } from './utils.js';
import { SERVER_URL, offlineMode, setUploadedFileUrls } from './config.js';
import { createAnalysisData } from './session-manager.js';
import { getStepRecordings } from './camera.js';
import { getStep3CapturedFrameBlob, getStep4CapturedFrameBlob } from './ocr-handler.js';
import {
    completionScreen,
    reviewScreen,
    downloadAnalysisBtn,
    downloadOverlay
} from './dom-elements.js';

/**
 * Internal helper to trigger a browser download for a blob
 */
function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 5000);
}

/**
 * Upload analysis and captured files to the server/MinIO via backend endpoint.
 * If upload fails or offlineMode is active, returns a fallback object with local file info.
 *
 * Returns: { success: boolean, urls?: object, error?: string }
 */
export async function uploadToMinIO(analysis) {
    // Respect offline mode
    if (offlineMode) {
        addLog('⚠️ Offline mode enabled, skipping upload and returning local payload', 'warning');
        return { success: false, error: 'offline' };
    }

    try {
        const form = new FormData();

        // Attach analysis JSON
        const analysisBlob = new Blob([JSON.stringify(analysis)], { type: 'application/json' });
        form.append('analysis', analysisBlob, `${analysis.sessionId || 'analysis'}.json`);

        // Attach step recordings (if present)
        const recordings = getStepRecordings ? getStepRecordings() : null;
        if (recordings) {
            Object.keys(recordings).forEach((key) => {
                const blob = recordings[key];
                if (blob instanceof Blob) {
                    form.append('files', blob, `${analysis.sessionId || 'session'}_${key}.webm`);
                }
            });
        }

        // Attach OCR/palm captured images
        const step3Blob = getStep3CapturedFrameBlob ? getStep3CapturedFrameBlob() : null;
        const step4Blob = getStep4CapturedFrameBlob ? getStep4CapturedFrameBlob() : null;
        if (step3Blob instanceof Blob) form.append('files', step3Blob, `${analysis.sessionId || 'session'}_step3.png`);
        if (step4Blob instanceof Blob) form.append('files', step4Blob, `${analysis.sessionId || 'session'}_step4.png`);

        const endpoint = `${SERVER_URL.replace(/\/$/, '')}/api/upload`;

        addLog(`📤 Uploading analysis to ${endpoint}`);

        const resp = await fetch(endpoint, {
            method: 'POST',
            body: form
        });

        if (!resp.ok) {
            const text = await resp.text();
            addLog(`❌ Upload failed: ${resp.status} ${text}`, 'error');
            return { success: false, error: `http ${resp.status}` };
        }

        const data = await resp.json();

        // Expect data.urls mapping or similar
        if (data && data.urls) {
            try {
                setUploadedFileUrls(data.urls);
            } catch (e) { /* ignore setter failures */ }
        }

        addLog('✅ Upload successful', 'success');
        return { success: true, urls: data.urls || null };
    } catch (error) {
        console.error('Upload error:', error);
        addLog('❌ Upload error: ' + (error && error.message ? error.message : String(error)), 'error');
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

/**
 * Download analysis as a local JSON file
 */
export function downloadLocalAnalysis() {
    try {
        const analysis = createAnalysisData();
        const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
        const filename = `${analysis.sessionId || 'analysis'}_analysis.json`;
        triggerDownload(blob, filename);
        addLog('📥 Local analysis download started', 'info');
    } catch (err) {
        console.error('Download analysis error:', err);
        addLog('❌ Failed to download analysis locally', 'error');
    }
}

/**
 * Download all recorded files (step recordings + captured frames)
 */
export function downloadAllRecordings() {
    try {
        const recordings = getStepRecordings ? getStepRecordings() : null;
        const analysis = createAnalysisData();

        if (recordings) {
            Object.keys(recordings).forEach((key) => {
                const blob = recordings[key];
                if (blob instanceof Blob) {
                    const filename = `${analysis.sessionId || 'session'}_${key}.webm`;
                    triggerDownload(blob, filename);
                }
            });
        }

        const step3Blob = getStep3CapturedFrameBlob ? getStep3CapturedFrameBlob() : null;
        const step4Blob = getStep4CapturedFrameBlob ? getStep4CapturedFrameBlob() : null;
        if (step3Blob instanceof Blob) triggerDownload(step3Blob, `${analysis.sessionId || 'session'}_step3.png`);
        if (step4Blob instanceof Blob) triggerDownload(step4Blob, `${analysis.sessionId || 'session'}_step4.png`);

        addLog('📥 Downloading all recordings...', 'info');
    } catch (err) {
        console.error('Download recordings error:', err);
        addLog('❌ Failed to download recordings', 'error');
    }
}

/**
 * Submit analysis: upload and then present completion UI
 */
export async function submitAnalysis() {
    const analysis = createAnalysisData();

    // Show a lightweight overlay to indicate download/upload
    if (downloadOverlay) downloadOverlay.style.display = 'flex';

    const result = await uploadToMinIO(analysis);

    if (downloadOverlay) downloadOverlay.style.display = 'none';

    if (result && result.success) {
        addLog('🎉 Analysis submitted successfully');
        showCompletionScreen(result.urls || null);
        return { success: true, urls: result.urls || null };
    }

    addLog('⚠️ Submission failed, falling back to local downloads', 'warning');

    // Fallback: prompt user to download everything locally
    downloadLocalAnalysis();
    downloadAllRecordings();

    // Show completion screen even when offline to let user finish flow
    showCompletionScreen(null, { offline: true });

    return { success: false, error: result && result.error ? result.error : 'unknown' };
}

/**
 * Show completion screen and populate links if upload URLs are available
 */
export function showCompletionScreen(urls = null, opts = { offline: false }) {
    try {
        // Hide review screen if present
        if (reviewScreen) reviewScreen.style.display = 'none';

        if (completionScreen) {
            completionScreen.style.display = 'block';

            // If we have uploaded URLs, add them as clickable links inside completion screen
            if (urls) {
                const container = completionScreen.querySelector('.uploaded-links');
                if (container) {
                    container.innerHTML = '';
                    Object.keys(urls).forEach((k) => {
                        const a = document.createElement('a');
                        a.href = urls[k];
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        a.textContent = k;
                        container.appendChild(a);
                        container.appendChild(document.createElement('br'));
                    });
                }
            } else if (opts.offline) {
                const note = completionScreen.querySelector('.offline-note');
                if (note) note.style.display = 'block';
            }
        }
    } catch (err) {
        console.error('Show completion error:', err);
    }
}

// Default export convenience
export default {
    uploadToMinIO,
    submitAnalysis,
    downloadLocalAnalysis,
    downloadAllRecordings,
    showCompletionScreen
};
