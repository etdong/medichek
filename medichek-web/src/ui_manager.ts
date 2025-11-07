import { t } from './translations.js';
import * as DOM from './dom.js';
import * as utils from './utils.js';
import * as cam from './camera.js';
import * as server from './server_manager.js';
import * as ocr from './ocr_handler.js';

let toastTimeout: NodeJS.Timeout | null = null;
let handBoundsWarningTimeout: NodeJS.Timeout | null = null;

export function updateServerStatus(newStatus: string) {
    // Translate the status text
    let translatedStatus = newStatus;
    if (newStatus === 'Connected') translatedStatus = t('status.connected');
    else if (newStatus === 'Checking...') translatedStatus = t('status.checking');
    else if (newStatus === 'Offline Mode') translatedStatus = t('status.offlineMode');
    else if (newStatus === 'Disconnected') translatedStatus = t('status.disconnected');

    DOM.serverStatus.textContent = translatedStatus;
    DOM.serverStatus.className = 'status-badge ' + 
        (newStatus === 'Connected' ? 'connected' : 
        newStatus === 'Checking...' ? 'checking' : 'disconnected');
    
    return newStatus;
}

// Update loading screen status checks with current language
export function updateLoadingScreenStatuses(currentServerStatus: string, currentMinioStatus: string) {
    // Update Status
    if (currentServerStatus === 'checking') {
        DOM.serverCheckStatus.textContent = t('loading.checking');
    } else if (currentServerStatus === 'online') {
        DOM.serverCheckStatus.textContent = t('loading.online');
    } else if (currentServerStatus === 'offline') {
        DOM.serverCheckStatus.textContent = t('loading.offline');
    }

    // Update MinIO status
    if (currentMinioStatus === 'checking') {
        DOM.minioCheckStatus.textContent = t('loading.checking');
    } else if (currentMinioStatus === 'online') {
        DOM.minioCheckStatus.textContent = t('loading.online');
    } else if (currentMinioStatus === 'offline') {
        DOM.minioCheckStatus.textContent = t('loading.offline');
    }
}

// Update frame capture statuses with current language
export function updateFrameCaptureStatuses(currentOcrStatus: string, currentPalmStatus: string) {
    // Update OCR status badge
    if (currentOcrStatus === 'analyzing') {
        DOM.ocrStatusBadge.textContent = t('frame.ocrAnalyzing');
        DOM.ocrStatusBadge.className = 'ocr-status analyzing';
    } else if (currentOcrStatus === 'recognized') {
        DOM.ocrStatusBadge.textContent = t('frame.ocrRecognized');
        DOM.ocrStatusBadge.className = 'ocr-status success';
    } else if (currentOcrStatus === 'notFound') {
        DOM.ocrStatusBadge.textContent = t('frame.ocrNotFound');
        DOM.ocrStatusBadge.className = 'ocr-status failed';
    } else if (currentOcrStatus === 'error') {
        DOM.ocrStatusBadge.textContent = t('frame.ocrError');
        DOM.ocrStatusBadge.className = 'ocr-status failed';
    } else if (currentOcrStatus === 'review') {
        DOM.ocrStatusBadge.textContent = t('frame.ocrReview');
        DOM.ocrStatusBadge.className = 'ocr-status warning';
    }
    
    // Update Palm status badge
    if (currentPalmStatus === 'captured') {
        DOM.palmStatusBadge.textContent = t('frame.palmCaptured');
        DOM.palmStatusBadge.className = 'palm-status success';
    }
}

export function showWarningToast(message: string, duration = 3000) {
    // Update message if provided
    if (message) {
        const toastMessage = DOM.warningToast.querySelector('.toast-message');
        if (toastMessage) {
            toastMessage.textContent = message;
        }
    }
    
    // Clear any existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    // Show toast
    DOM.warningToast.classList.add('show');
    
    // Auto-hide after duration
    toastTimeout = setTimeout(() => {
        DOM.warningToast.classList.remove('show');
    }, duration);
}

export function hideWarningToast() {
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    DOM.warningToast.classList.remove('show');
}

export function showHandBoundsWarning() {
    // Clear any existing timeout
    if (handBoundsWarningTimeout) {
        clearTimeout(handBoundsWarningTimeout);
    }
    
    // Show warning
    if (!DOM.handBoundsWarning) {
        utils.addLog('Hand bounds warning element not found in DOM', 'error');
        return;
    }
    DOM.handBoundsWarning.classList.add('show');
    
    // Auto-hide after 2 seconds
    handBoundsWarningTimeout = setTimeout(() => {
        DOM.handBoundsWarning.classList.remove('show');
    }, 2000);
}

export function hideHandBoundsWarning(handBoundsWarningTimeout: number | null) {
    if (handBoundsWarningTimeout) {
        clearTimeout(handBoundsWarningTimeout);
        handBoundsWarningTimeout = null;
    }
    DOM.handBoundsWarning.classList.remove('show');
}

export function showCompletionScreen(success: boolean, title: string, message: string, details = '', showDownload = false) {
    // Update completion screen content
    DOM.completionIcon.className = `completion-icon ${success ? 'success' : 'error'}`;
    DOM.completionTitle.textContent = title;
    DOM.completionMessage.textContent = message;
    DOM.completionDetails.innerHTML = details;
    
    // Show/hide download button based on parameter
    if (showDownload) {
        DOM.downloadAnalysisBtn.style.display = 'inline-block';
    } else {
        DOM.downloadAnalysisBtn.style.display = 'none';
    }
    
    // Show completion screen
    DOM.completionScreen.style.display = 'flex';
}

// Show review/finish screen
export function showReviewScreen() {
    // Stop recording if still active
    if (cam.recordingConsent) {
        cam.stopStepRecording();
        utils.addLog('🎥 All recordings completed', 'success');
    }
    
    // Update review screen status
    DOM.reviewOcrStatus.textContent = ocr.ocrRecognized ? t('review.recognized') : t('review.manualReview');
    DOM.reviewPalmStatus.textContent = t('review.completed');
    DOM.reviewFaceStatus.textContent = t('review.completed');
    
    // Update submit button text based on offline mode
    if (server.offlineMode) {
        DOM.submitAnalysisBtn.textContent = t('review.download');
        DOM.submitAnalysisBtn.className = 'btn btn-primary';
    } else {
        DOM.submitAnalysisBtn.textContent = t('review.submit');
        DOM.submitAnalysisBtn.className = 'btn btn-success';
    }
    
    // Show review screen
    DOM.reviewScreen.style.display = 'flex';
    
    utils.addLog('🎉 All steps completed! Review your session', 'success');
}

// Hide loading screen and start application
export function hideLoadingScreen() {
    DOM.loadingScreen.style.display = 'none';
    if (!server.offlineMode) {
        server.checkServers();
    }
}



