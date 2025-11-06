/**
 * UI Manager Module
 * 
 * Handles all UI updates and display logic:
 * - Session UI updates
 * - Server status display
 * - Loading screen statuses
 * - Frame capture statuses
 * - Face rubbing UI
 */

import { t } from './translations.js';
import { 
    analysisSession,
    currentServerStatus, setCurrentServerStatus,
    currentMinioStatus,
    currentOcrStatus,
    currentPalmStatus
} from './config.js';
import {
    faceDetected, faceCentered,
    palmDetectionState, PALM_DETECTION_REQUIRED,
    ocrRecognized, ocrSkipped,
    faceRubbingState, RUBBING_DURATION_REQUIRED
} from './mediapipe-state.js';
import {
    serverStatus,
    sessionIdElement,
    currentStepElement,
    startTrackingBtn,
    nextStepBtn,
    captureFrameBtn,
    finishSessionBtn,
    serverCheckStatus,
    minioCheckStatus,
    ocrStatusBadge,
    palmStatusBadge
} from './dom-elements.js';

// Module-level variable to track camera state
let cameraEnabled = false;

/**
 * Set camera enabled state
 * @param {boolean} enabled - Whether camera is enabled
 */
export function setCameraEnabled(enabled) {
    cameraEnabled = enabled;
}

/**
 * Get camera enabled state
 * @returns {boolean} Whether camera is enabled
 */
export function getCameraEnabled() {
    return cameraEnabled;
}

/**
 * Update server status display
 * @param {string} status - Status to display ('Connected', 'Checking...', 'Offline Mode', 'Disconnected')
 */
export function updateServerStatus(status) {
    // Store the current status for re-translation
    setCurrentServerStatus(status);
    
    // Translate the status text
    let translatedStatus = status;
    if (status === 'Connected') translatedStatus = t('status.connected');
    else if (status === 'Checking...') translatedStatus = t('status.checking');
    else if (status === 'Offline Mode') translatedStatus = t('status.offlineMode');
    else if (status === 'Disconnected') translatedStatus = t('status.disconnected');
    
    serverStatus.textContent = translatedStatus;
    serverStatus.className = 'status-badge ' + 
        (status === 'Connected' ? 'connected' : 
         status === 'Checking...' ? 'checking' : 'disconnected');
}

/**
 * Update loading screen status checks with current language
 */
export function updateLoadingScreenStatuses() {
    // Update Server Status
    if (currentServerStatus === 'checking') {
        serverCheckStatus.textContent = t('loading.checking');
    } else if (currentServerStatus === 'online') {
        serverCheckStatus.textContent = t('loading.online');
    } else if (currentServerStatus === 'offline') {
        serverCheckStatus.textContent = t('loading.offline');
    }
    
    // Update MinIO status
    if (currentMinioStatus === 'checking') {
        minioCheckStatus.textContent = t('loading.checking');
    } else if (currentMinioStatus === 'online') {
        minioCheckStatus.textContent = t('loading.online');
    } else if (currentMinioStatus === 'offline') {
        minioCheckStatus.textContent = t('loading.offline');
    }
}

/**
 * Update frame capture statuses with current language
 */
export function updateFrameCaptureStatuses() {
    // Update OCR status badge
    if (currentOcrStatus === 'analyzing') {
        ocrStatusBadge.textContent = t('frame.ocrAnalyzing');
        ocrStatusBadge.className = 'ocr-status analyzing';
    } else if (currentOcrStatus === 'recognized') {
        ocrStatusBadge.textContent = t('frame.ocrRecognized');
        ocrStatusBadge.className = 'ocr-status success';
    } else if (currentOcrStatus === 'notFound') {
        ocrStatusBadge.textContent = t('frame.ocrNotFound');
        ocrStatusBadge.className = 'ocr-status failed';
    } else if (currentOcrStatus === 'error') {
        ocrStatusBadge.textContent = t('frame.ocrError');
        ocrStatusBadge.className = 'ocr-status failed';
    } else if (currentOcrStatus === 'review') {
        ocrStatusBadge.textContent = t('frame.ocrReview');
        ocrStatusBadge.className = 'ocr-status warning';
    }
    
    // Update Palm status badge
    if (currentPalmStatus === 'captured') {
        palmStatusBadge.textContent = t('frame.palmCaptured');
        palmStatusBadge.className = 'palm-status success';
    }
}

/**
 * Update the main session UI based on current step
 */
export function updateSessionUI() {
    sessionIdElement.textContent = analysisSession.sessionId || t('status.sessionNone');
    currentStepElement.textContent = `${analysisSession.currentStep}/${analysisSession.totalSteps}`;
    
    // Hide all buttons first
    startTrackingBtn.style.display = 'none';
    nextStepBtn.style.display = 'none';
    captureFrameBtn.style.display = 'none';
    finishSessionBtn.style.display = 'none';
    
    // Update step instruction overlay
    const stepInstruction = document.getElementById('step-instruction');
    const stepProgress = document.getElementById('step-progress');
    
    if (!analysisSession.isActive) {
        // Not started yet
        startTrackingBtn.style.display = 'block';
        startTrackingBtn.disabled = false;
        if (stepInstruction) stepInstruction.textContent = t('steps.readyToBegin');
        if (stepProgress) stepProgress.textContent = '';
    } else if (analysisSession.currentStep === 0) {
        // Step 0: Preliminaries (camera + face centering)
        nextStepBtn.style.display = 'block';
        nextStepBtn.disabled = !cameraEnabled || !faceCentered;
        if (stepInstruction) stepInstruction.textContent = t('steps.preliminaries.title');
        if (stepProgress) {
            if (!cameraEnabled) {
                stepProgress.textContent = t('steps.preliminaries.activatingCamera');
            } else if (!faceCentered) {
                stepProgress.textContent = t('steps.preliminaries.positionFace');
            } else {
                stepProgress.textContent = t('steps.preliminaries.ready');
            }
        }
    } else if (analysisSession.currentStep === 1) {
        // Step 1: OCR capture with auto-scanning
        captureFrameBtn.style.display = 'block';
        captureFrameBtn.disabled = !cameraEnabled;
        
        if (stepInstruction) stepInstruction.textContent = t('steps.ocr.title');
        if (stepProgress) {
            if (ocrRecognized) {
                stepProgress.textContent = t('steps.ocr.productRecognized');
            } else if (ocrSkipped) {
                stepProgress.textContent = t('steps.ocr.proceedingManual');
            } else {
                stepProgress.textContent = t('steps.ocr.showLabel');
            }
        }
    } else if (analysisSession.currentStep === 2) {
        // Step 2: Palm detection (auto-advance, no next button)
        // Hide next step button - will auto-advance when palm detection completes
        if (stepInstruction) stepInstruction.textContent = t('steps.palm.title');
        if (stepProgress) {
            if (palmDetectionState.completed) {
                stepProgress.textContent = t('steps.palm.complete');
            } else if (palmDetectionState.detected && palmDetectionState.totalTime > 0) {
                const progress = Math.min(100, Math.round((palmDetectionState.totalTime / PALM_DETECTION_REQUIRED) * 100));
                stepProgress.textContent = t('steps.palm.holdSteady', { progress });
            } else {
                stepProgress.textContent = t('steps.palm.showProduct');
            }
        }
    } else if (analysisSession.currentStep === 3) {
        // Step 3: Face rubbing (time-based only, coverage is for visualization)
        const allAreasRubbed = faceRubbingState.forehead.rubbed && 
                               faceRubbingState.leftSide.rubbed && 
                               faceRubbingState.rightSide.rubbed;
        
        finishSessionBtn.style.display = 'block';
        finishSessionBtn.disabled = !allAreasRubbed; // Only require time-based completion
        
        if (stepInstruction) stepInstruction.textContent = t('steps.faceRubbing.title');
        if (stepProgress) {
            const foreheadPercent = Math.min(100, Math.round((faceRubbingState.forehead.totalTime / RUBBING_DURATION_REQUIRED) * 100));
            const leftPercent = Math.min(100, Math.round((faceRubbingState.leftSide.totalTime / RUBBING_DURATION_REQUIRED) * 100));
            const rightPercent = Math.min(100, Math.round((faceRubbingState.rightSide.totalTime / RUBBING_DURATION_REQUIRED) * 100));
            
            // Show region progress (time-based)
            const foreheadStatus = faceRubbingState.forehead.rubbed ? '✓' : foreheadPercent + '%';
            const leftStatus = faceRubbingState.leftSide.rubbed ? '✓' : leftPercent + '%';
            const rightStatus = faceRubbingState.rightSide.rubbed ? '✓' : rightPercent + '%';
            
            const regionProgress = t('steps.faceRubbing.progress', {
                forehead: foreheadStatus,
                left: leftStatus,
                right: rightStatus
            });
            
            // Show holistic coverage percentage on separate line (informational only)
            const coverageText = `${t('steps.faceRubbing.coverage')}: ${faceRubbingState.totalCoverage}%`;
            
            stepProgress.innerHTML = `${regionProgress}<br>${coverageText}`;
        }
    }
}

/**
 * Update face rubbing UI (delegates to updateSessionUI)
 */
export function updateFaceRubbingUI() {
    // Update through the main UI update function which now handles step 3 (face rubbing) display
    if (analysisSession.currentStep === 3) {
        updateSessionUI();
    }
}
