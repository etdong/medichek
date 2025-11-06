/**
 * Event Handlers
 *
 * Attach all DOM event listeners and delegate to modules created during migration.
 */

import {
    startTrackingBtn,
    captureFrameBtn,
    nextStepBtn,
    finishSessionBtn,
    submitAnalysisBtn,
    restartSessionBtn,
    startNewSessionBtn,
    downloadAnalysisBtn,
    acceptRecordingBtn,
    declineRecordingBtn,
    retryOcrBtn,
    continueAnywayBtn,
    ocrFailModal,
    langEnBtn,
    langZhBtn,
    recordingConsentModal,
    reviewScreen,
    completionScreen
} from './dom-elements.js';

import sessionManager from './session-manager.js';
import * as ocrHandler from './ocr-handler.js';
import uploadManager from './upload-manager.js';
import { updateSessionUI } from './ui-manager.js';
import { updateLanguage, t } from './translations.js';

/**
 * Attach event listeners to buttons and modals
 */
export function attachEventHandlers() {
    // Start tracking -- show consent modal first, start session only after user accepts
    if (startTrackingBtn) startTrackingBtn.onclick = async () => {
        // Show consent modal and wait for user action (accept/decline handlers handle the rest)
        if (recordingConsentModal) recordingConsentModal.style.display = 'flex';
        // Ensure UI reflects that we are waiting for consent
        updateSessionUI();
    };

    // Capture frame (manual OCR)
    if (captureFrameBtn) captureFrameBtn.onclick = async () => {
        await ocrHandler.captureFrame();
    };

    // Next step button
    if (nextStepBtn) nextStepBtn.onclick = () => {
        sessionManager.nextStep();
    };

    // Finish session -> show review
    if (finishSessionBtn) finishSessionBtn.onclick = () => {
        const analysis = sessionManager.showReviewScreen();
        // Show review screen UI
        if (reviewScreen) reviewScreen.style.display = 'block';
        if (completionScreen) completionScreen.style.display = 'none';
    };

    // Submit analysis (upload)
    if (submitAnalysisBtn) submitAnalysisBtn.onclick = async () => {
        await uploadManager.submitAnalysis();
    };

    // Restart session
    if (restartSessionBtn) restartSessionBtn.onclick = async () => {
        await sessionManager.restartSession({ restartCamera: true });
        updateSessionUI();
    };

    // Start new session (alias for restart)
    if (startNewSessionBtn) startNewSessionBtn.onclick = async () => {
        await sessionManager.restartSession({ restartCamera: true });
        updateSessionUI();
    };

    // Download analysis locally
    if (downloadAnalysisBtn) downloadAnalysisBtn.onclick = () => {
        uploadManager.downloadLocalAnalysis();
        uploadManager.downloadAllRecordings();
    };

    // Recording consent modal buttons
    if (acceptRecordingBtn) acceptRecordingBtn.onclick = async () => {
        // User accepted recording consent: set consent and then start the session (which enables camera)
        try {
            sessionManager.acceptRecordingConsent();
        } catch (e) {
            console.warn('acceptRecordingConsent error', e);
        }
        // Hide modal
        if (recordingConsentModal) recordingConsentModal.style.display = 'none';
        // Start the tracking session (will enable camera)
        try {
            await sessionManager.startTracking();
        } catch (e) {
            console.error('Failed to start session after consent', e);
        }
        updateSessionUI();
    };
    if (declineRecordingBtn) declineRecordingBtn.onclick = () => {
        // If user declines, do not start the camera or session
        sessionManager.declineRecordingConsent();
        if (recordingConsentModal) recordingConsentModal.style.display = 'none';
        updateSessionUI();
    };

    // Retry OCR (modal) - simply allow user to try again by hiding modal
    // Use live DOM queries here because some templates are injected after modules
    // are evaluated. Querying at attach time ensures we bind handlers to the
    // actual elements instead of any placeholders that may have been created
    // earlier by `dom-elements.js`.
    {
        const _retryBtn = document.getElementById('retry-ocr-btn') || retryOcrBtn;
        const _continueBtn = document.getElementById('continue-anyway-btn') || continueAnywayBtn;
        const _ocrFailModal = document.getElementById('ocr-fail-modal') || ocrFailModal;
        const _captureBtn = document.getElementById('capture-frame') || captureFrameBtn;

        if (_retryBtn) _retryBtn.onclick = () => {
            if (_ocrFailModal) _ocrFailModal.style.display = 'none';
            // Re-enable manual capture button so the user can retry immediately
            try { if (_captureBtn) _captureBtn.disabled = false; } catch (e) { /* ignore */ }
        };

        if (_continueBtn) _continueBtn.onclick = () => {
            // Advance to next step
            try { sessionManager.nextStep(); } catch (e) { console.warn('nextStep error', e); }
            if (_ocrFailModal) _ocrFailModal.style.display = 'none';
        };
    }

    // Continue anyway (if OCR failed but user wants to advance)
    if (continueAnywayBtn) continueAnywayBtn.onclick = () => {
        sessionManager.nextStep();
        if (ocrFailModal) ocrFailModal.style.display = 'none';
    };

    // Language switching
    if (langEnBtn) langEnBtn.onclick = () => {
        updateLanguage('en');
        updateSessionUI();
    };
    if (langZhBtn) langZhBtn.onclick = () => {
        updateLanguage('zh');
        updateSessionUI();
    };

    // Defensive: ensure UI is in correct state on attach
    updateSessionUI();
}

export default { attachEventHandlers };
