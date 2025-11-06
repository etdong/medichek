/**
 * Session Manager
 *
 * Orchestrates the multi-step analysis session:
 * - startTracking()
 * - acceptRecordingConsent()/declineRecordingConsent()
 * - nextStep(), showReviewScreen(), restartSession()
 * - createAnalysisData()
 */

import { addLog, generateSessionId } from './utils.js';
import { analysisSession, setAnalysisSession, setStep3CapturedFrameBlob, setStep4CapturedFrameBlob, setCapturedImageData } from './config.js';
import { enableCamera, startStepRecording, stopStepRecording, stopCamera, setRecordingConsent, getStepRecordings, getRecordingConsent, setCamera as setLocalCamera } from './camera.js';
import { faceDetection, handsDetection, faceMesh, setCamera as setMediapipeCamera } from './mediapipe-state.js';
import { webcam } from './dom-elements.js';
import { onFaceDetectionResults } from './face-detection.js';
import { onHandsDetectionResults } from './hand-detection.js';
import { onFaceMeshResults } from './face-mesh.js';
import { startAutoOcrScanning, stopAutoOcrScanning, captureFrame, getStep3CapturedFrameBlob, getStep4CapturedFrameBlob, setNextStepCallback as setOcrNextStepCallback } from './ocr-handler.js';
import { setNextStepCallback as setHandNextStepCallback, setCaptureStep4FrameCallback as setHandCaptureCallback } from './hand-detection.js';
import { updateSessionUI } from './ui-manager.js';

// Forward-declared callback reference (if external code wants to listen to step changes)
let externalStepChangeCallback = null;

/**
 * Internal helper: initialize callback wiring between modules
 */
function wireCallbacks() {
    // Ensure ocr-handler and hand-detection will call our nextStep
    setOcrNextStepCallback(nextStep);
    setHandNextStepCallback(nextStep);
    // Hand-detection will call this to capture the palm frame when palm detection completes
    setHandCaptureCallback(async () => {
        // delegate to ocr-handler's captureStep4Frame (available there)
        const { captureStep4Frame } = await import('./ocr-handler.js');
        if (captureStep4Frame) await captureStep4Frame();
    });
}

/**
 * Start tracking session (initializes session state and enables camera)
 */
export async function startTracking() {
    // Create a fresh session object
    const sessionId = generateSessionId();
    const now = Date.now();

    const session = {
        sessionId,
        startTime: now,
        currentStep: 0,
        totalSteps: 3,
        isActive: true,
        stepTimings: {
            step1: { startTime: null, endTime: null, duration: 0 },
            step2: { startTime: null, endTime: null, duration: 0 },
            step3: { startTime: null, endTime: null, duration: 0 }
        }
    };

    setAnalysisSession(session);
    addLog(`🟢 Session started: ${sessionId}`);

    // Wire callbacks once
    try {
        wireCallbacks();
    } catch (err) {
        console.warn('Callback wiring error:', err);
    }

    // Enable camera (MediaPipe setup is expected to be handled elsewhere)
    const enabled = await enableCamera();
    if (!enabled) {
        addLog('⚠️ Camera failed to start during session start', 'warning');
    }

    // If camera enabled, wire MediaPipe callbacks and start the Camera processor
    if (enabled) {
        try {
            // Attach onResults handlers if models are initialized
            if (faceDetection && typeof faceDetection.onResults === 'function') {
                faceDetection.onResults(onFaceDetectionResults);
            }
            if (handsDetection && typeof handsDetection.onResults === 'function') {
                handsDetection.onResults(onHandsDetectionResults);
            }
            if (faceMesh && typeof faceMesh.onResults === 'function') {
                faceMesh.onResults(onFaceMeshResults);
            }
        } catch (e) {
            console.warn('Error attaching MediaPipe onResults handlers', e);
        }

        // Start the MediaPipe Camera processing loop (if Camera util is available)
        try {
            if (typeof Camera !== 'undefined' && webcam) {
                const camInstance = new Camera(webcam, {
                    onFrame: async () => {
                        try {
                            if (faceDetection) await faceDetection.send({ image: webcam });
                            if (handsDetection) await handsDetection.send({ image: webcam });
                            if (faceMesh) await faceMesh.send({ image: webcam });
                        } catch (err) {
                            // ignore per-frame errors
                        }
                    },
                    width: webcam.videoWidth || 1280,
                    height: webcam.videoHeight || 720
                });
                // Start camera loop
                camInstance.start();
                // Store instance in camera and mediapipe-state modules
                try { setLocalCamera(camInstance); } catch (e) {}
                try { setMediapipeCamera(camInstance); } catch (e) {}
            }
        } catch (e) {
            console.warn('Failed to start MediaPipe Camera loop', e);
        }
    }

    // Update UI
    updateSessionUI();

    return session;
}

/**
 * Accept recording consent and enable step recordings
 */
export function acceptRecordingConsent() {
    setRecordingConsent(true);
    addLog('🔒 Recording consent accepted');

    // If we are in a recording step, start recording for that step
    if (analysisSession && analysisSession.isActive) {
        const step = analysisSession.currentStep;
        if (step >= 1 && step <= 3) {
            startStepRecording(step);
        }
    }
}

/**
 * Decline recording consent and stop any ongoing recordings
 */
export function declineRecordingConsent() {
    setRecordingConsent(false);
    stopStepRecording();
    addLog('🔒 Recording consent declined');
}

/**
 * Advance to the next step in the session flow
 */
export function nextStep() {
    if (!analysisSession || !analysisSession.isActive) return;

    const next = analysisSession.currentStep + 1;

    // If advancing beyond totalSteps show review instead
    if (next > analysisSession.totalSteps) {
        // finalize last step end times
        finalizeCurrentStepTiming(analysisSession.currentStep);
        showReviewScreen();
        return;
    }

    // finalize current step timing
    finalizeCurrentStepTiming(analysisSession.currentStep);

    // Move to next
    analysisSession.currentStep = next;

    // mark start time for the new step
    const now = Date.now();
    if (next === 1) analysisSession.stepTimings.step1.startTime = now;
    if (next === 2) analysisSession.stepTimings.step2.startTime = now;
    if (next === 3) analysisSession.stepTimings.step3.startTime = now;

    addLog(`⏭️ Advancing to step ${next}`);

    // Step-specific actions
    if (next === 1) {
        // Start OCR auto-scanning
        startAutoOcrScanning();
        // Start recording for step1 if consented
        if (getRecordingConsent()) startStepRecording(1);
    } else if (next === 2) {
        // Stop OCR scanning
        stopAutoOcrScanning();
        // Start recording for step2 if consented
        if (getRecordingConsent()) startStepRecording(2);
    } else if (next === 3) {
        // Step 3: face rubbing - start recording if consented
        if (getRecordingConsent()) startStepRecording(3);
    }

    // Notify external listeners
    if (externalStepChangeCallback) externalStepChangeCallback(analysisSession.currentStep);

    // Update UI
    updateSessionUI();
}

/**
 * Finalize timing for the current step (record end time and duration)
 */
function finalizeCurrentStepTiming(step) {
    if (!analysisSession || !analysisSession.isActive) return;

    const now = Date.now();
    if (step === 1 && analysisSession.stepTimings.step1.startTime) {
        analysisSession.stepTimings.step1.endTime = now;
        analysisSession.stepTimings.step1.duration = now - analysisSession.stepTimings.step1.startTime;
    } else if (step === 2 && analysisSession.stepTimings.step2.startTime) {
        analysisSession.stepTimings.step2.endTime = now;
        analysisSession.stepTimings.step2.duration = now - analysisSession.stepTimings.step2.startTime;
    } else if (step === 3 && analysisSession.stepTimings.step3.startTime) {
        analysisSession.stepTimings.step3.endTime = now;
        analysisSession.stepTimings.step3.duration = now - analysisSession.stepTimings.step3.startTime;
    }

    // Stop any ongoing recording for the step we just finished
    stopStepRecording();
}

/**
 * Show the review screen (finalize session and prepare analysis data)
 */
export function showReviewScreen() {
    if (!analysisSession) return;

    // Finalize any running timings
    finalizeCurrentStepTiming(analysisSession.currentStep);

    // Mark session inactive
    analysisSession.isActive = false;
    analysisSession.endTime = Date.now();

    addLog('📋 Preparing review screen and analysis data');

    // Build analysis object
    const analysis = createAnalysisData();

    // Stop camera but keep recordings available for review/download
    try {
        stopCamera();
    } catch (err) {
        console.warn('Error stopping camera:', err);
    }

    // Update UI one last time
    updateSessionUI();

    return analysis;
}

/**
 * Restart the entire session (resets state and optionally restarts camera)
 */
export async function restartSession(options = { restartCamera: true }) {
    // Stop recordings and camera
    try {
        stopStepRecording();
    } catch (e) {
        /* ignore */
    }

    if (options.restartCamera) {
        try {
            stopCamera();
        } catch (e) {}
    }

    // Reset analysisSession
    const reset = {
        sessionId: null,
        startTime: null,
        currentStep: 0,
        totalSteps: 3,
        isActive: false,
        stepTimings: {
            step1: { startTime: null, endTime: null, duration: 0 },
            step2: { startTime: null, endTime: null, duration: 0 },
            step3: { startTime: null, endTime: null, duration: 0 }
        }
    };

    setAnalysisSession(reset);

    // Clear captured blobs in config (also keep copies in modules if needed)
    try {
        setStep3CapturedFrameBlob(null);
        setStep4CapturedFrameBlob(null);
        setCapturedImageData(null);
    } catch (err) {
        // ignore if setters not available
    }

    // Update UI
    updateSessionUI();

    addLog('🔁 Session reset');

    return reset;
}

/**
 * Create an analysis payload summarizing the session (blobs, timings, recordings)
 */
export function createAnalysisData() {
    const recordings = getStepRecordings ? getStepRecordings() : null;
    const step3Blob = getStep3CapturedFrameBlob ? getStep3CapturedFrameBlob() : null;
    const step4Blob = getStep4CapturedFrameBlob ? getStep4CapturedFrameBlob() : null;

    const analysis = {
        sessionId: analysisSession.sessionId,
        startTime: analysisSession.startTime,
        endTime: analysisSession.endTime || Date.now(),
        stepTimings: analysisSession.stepTimings,
        recordings: recordings,
        step3Captured: step3Blob,
        step4Captured: step4Blob
    };

    return analysis;
}

/**
 * Allow external listeners to be notified when step changes
 */
export function setExternalStepChangeCallback(cb) {
    externalStepChangeCallback = cb;
}

// Exported API summary
export default {
    startTracking,
    acceptRecordingConsent,
    declineRecordingConsent,
    nextStep,
    showReviewScreen,
    restartSession,
    createAnalysisData,
    setExternalStepChangeCallback
};
