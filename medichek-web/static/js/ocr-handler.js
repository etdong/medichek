/**
 * OCR Handler Module
 * 
 * Handles all OCR (Optical Character Recognition) functionality:
 * - Manual frame capture with countdown
 * - Automatic OCR scanning
 * - Tesseract OCR processing
 * - Palm frame capture (Step 2)
 * - OCR result validation
 */

import { addLog } from './utils.js';
import { t } from './translations.js';
import { analysisSession } from './config.js';
import {
    setOcrRecognized,
    setOcrSkipped,
    autoOcrInterval,
    setAutoOcrInterval,
    OCR_CAPTURE_AREA,
    handLandmarks
} from './mediapipe-state.js';
import { 
    webcam,
    captureFrameBtn,
    countdownOverlay,
    countdownNumber,
    capturedFrameArea,
    step3FrameCanvas,
    step4FrameCanvas,
    ocrStatusBadge,
    palmStatusBadge,
    ocrResultCompact,
    ocrAnalysisOverlay,
    ocrFailModal
} from './dom-elements.js';
import { getCameraEnabled } from './ui-manager.js';
import { updateSessionUI, updateFrameCaptureStatuses } from './ui-manager.js';
import { 
    setCurrentOcrStatus,
    setCurrentPalmStatus
} from './config.js';

// Module-level state
let capturedImageData = null;
let step3CapturedFrameBlob = null;
let step4CapturedFrameBlob = null;

// Forward declaration for nextStep (will be provided by session-manager)
let nextStepCallback = null;

/**
 * Set the next step callback
 * @param {Function} callback - Function to advance to next step
 */
export function setNextStepCallback(callback) {
    nextStepCallback = callback;
}

/**
 * Get captured image data
 * @returns {string|null} Base64 image data
 */
export function getCapturedImageData() {
    return capturedImageData;
}

/**
 * Get Step 3 (OCR) captured frame blob
 * @returns {Blob|null}
 */
export function getStep3CapturedFrameBlob() {
    return step3CapturedFrameBlob;
}

/**
 * Get Step 4 (Palm) captured frame blob
 * @returns {Blob|null}
 */
export function getStep4CapturedFrameBlob() {
    return step4CapturedFrameBlob;
}

/**
 * Start automatic OCR scanning
 * Scans every 1 second for product label
 */
export function startAutoOcrScanning() {
    if (autoOcrInterval) return; // Already running
    
    // Scan every 1 second
    const interval = setInterval(async () => {
        if (analysisSession.currentStep !== 1) {
            stopAutoOcrScanning();
            return;
        }
        
        // Import state to check conditions
        const { ocrRecognized, ocrSkipped } = await import('./mediapipe-state.js');
        
        if (ocrRecognized || ocrSkipped) {
            stopAutoOcrScanning();
            return;
        }
        
        await performAutoOcrScan();
    }, 1000);
    
    setAutoOcrInterval(interval);
    addLog('🔍 Auto-scanning for product label...', 'info');
}

/**
 * Stop automatic OCR scanning
 */
export function stopAutoOcrScanning() {
    if (autoOcrInterval) {
        clearInterval(autoOcrInterval);
        setAutoOcrInterval(null);
    }
}

/**
 * Perform automatic OCR scan (silent, no countdown)
 */
async function performAutoOcrScan() {
    if (!webcam || !getCameraEnabled()) return;
    
    // Calculate capture area dimensions
    const minDimension = Math.min(webcam.videoWidth, webcam.videoHeight);
    const squareSize = minDimension * OCR_CAPTURE_AREA.sizePercent;
    const captureX = (webcam.videoWidth - squareSize) / 2;
    const captureY = (webcam.videoHeight - squareSize) / 2;
    const captureWidth = squareSize;
    const captureHeight = squareSize;
    
    // Capture the OCR area silently (no countdown)
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = captureWidth;
    captureCanvas.height = captureHeight;
    const ctx = captureCanvas.getContext('2d');
    
    // Draw only the capture area from video WITHOUT mirroring
    ctx.drawImage(
        webcam,
        captureX, captureY, captureWidth, captureHeight,
        0, 0, captureWidth, captureHeight
    );
    
    // Perform OCR on the captured area (silent - no UI updates)
    try {
        const worker = await Tesseract.createWorker();
        const { data: { text } } = await worker.recognize(captureCanvas);
        await worker.terminate();
        
        // Check if "TEST" is in the recognized text
        const recognizedText = text.toUpperCase();
        const containsTest = recognizedText.includes('TEST');
        
        if (containsTest) {
            // Store the captured frame
            capturedImageData = captureCanvas.toDataURL('image/png');
            await new Promise(resolve => {
                captureCanvas.toBlob(blob => {
                    step3CapturedFrameBlob = blob;
                    resolve();
                }, 'image/png');
            });
            
            // Display the captured frame
            capturedFrameArea.classList.remove('empty');
            const displayCanvas = step3FrameCanvas;
            displayCanvas.width = captureCanvas.width;
            displayCanvas.height = captureCanvas.height;
            const displayCtx = displayCanvas.getContext('2d');
            displayCtx.drawImage(captureCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
            
            // Mark as recognized
            setOcrRecognized(true);
            setCurrentOcrStatus('recognized');
            updateFrameCaptureStatuses();
            ocrResultCompact.innerHTML = '';
            
            addLog('✅ Product label recognized!', 'success');
            
            // Stop auto-scanning
            stopAutoOcrScanning();
            
            // Update UI
            updateSessionUI();
            
            // Auto-advance after short delay
            setTimeout(() => {
                if (nextStepCallback) {
                    nextStepCallback();
                }
            }, 1500);
        }
    } catch (error) {
        console.error('Auto OCR scan error:', error);
    }
}

/**
 * Manual frame capture with countdown (Step 1)
 * User-triggered capture with 3-second countdown
 */
export async function captureFrame() {
    if (analysisSession.currentStep !== 1) {
        addLog('⚠️ Frame capture only available on Step 1 (OCR Capture)', 'warning');
        return;
    }
    
    // Disable capture button to prevent multiple clicks
    captureFrameBtn.disabled = true;
    
    addLog('📸 Capturing frame...', 'info');
    addLog('⏱️ Starting 3-second countdown...', 'info');
    
    // Show countdown overlay
    countdownOverlay.style.display = 'flex';
    
    // Countdown
    for (let i = 3; i > 0; i--) {
        countdownNumber.textContent = i;
        // Re-trigger animation
        countdownNumber.style.animation = 'none';
        setTimeout(() => {
            countdownNumber.style.animation = 'pulse 1s ease-in-out';
        }, 10);
        
        addLog(`${i}...`, 'info');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Hide countdown
    countdownOverlay.style.display = 'none';
    
    // Calculate capture area dimensions (square based on smaller dimension)
    const minDimension = Math.min(webcam.videoWidth, webcam.videoHeight);
    const squareSize = minDimension * OCR_CAPTURE_AREA.sizePercent;
    
    // Add padding to capture more area around the OCR capture zone (40% padding)
    const paddingPercent = 0.40;
    const padding = squareSize * paddingPercent;
    
    // Center the square with padding
    const captureX = Math.max(0, (webcam.videoWidth - squareSize) / 2 - padding);
    const captureY = Math.max(0, (webcam.videoHeight - squareSize) / 2 - padding);
    const captureWidth = Math.min(squareSize + (padding * 2), webcam.videoWidth - captureX);
    const captureHeight = Math.min(squareSize + (padding * 2), webcam.videoHeight - captureY);
    
    // Capture the padded area (un-mirrored for OCR)
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = captureWidth;
    captureCanvas.height = captureHeight;
    const ctx = captureCanvas.getContext('2d');
    
    // Draw the padded capture area from video WITHOUT mirroring (correct orientation for OCR)
    ctx.drawImage(
        webcam,
        captureX, captureY, captureWidth, captureHeight,  // Source rectangle
        0, 0, captureWidth, captureHeight                 // Destination rectangle
    );
    
    capturedImageData = captureCanvas.toDataURL('image/png');
    
    // Store as blob for download
    await new Promise(resolve => {
        captureCanvas.toBlob(blob => {
            step3CapturedFrameBlob = blob;
            resolve();
        }, 'image/png');
    });
    
    addLog('✅ Frame captured!', 'success');
    addLog('🔍 Analyzing with OCR...', 'info');
    
    // Show captured frame (remove empty state)
    capturedFrameArea.classList.remove('empty');
    
    // Display the un-mirrored version in the compact preview (so text is readable)
    const displayCanvas = step3FrameCanvas;
    displayCanvas.width = captureCanvas.width;
    displayCanvas.height = captureCanvas.height;
    const displayCtx = displayCanvas.getContext('2d');
    
    // Draw without mirroring so text appears correct
    displayCtx.drawImage(captureCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
    
    // Update status badge
    setCurrentOcrStatus('analyzing');
    updateFrameCaptureStatuses();
    ocrResultCompact.innerHTML = '';
    
    // Show OCR analysis overlay to prevent interaction
    ocrAnalysisOverlay.style.display = 'flex';
    
    // Perform OCR on the un-mirrored captured area
    await performOCR(captureCanvas);

    // Re-enable capture button after OCR flow completes so user can retry
    try { if (captureFrameBtn) captureFrameBtn.disabled = false; } catch (e) { /* ignore */ }
}

/**
 * Perform OCR on captured canvas
 * @param {HTMLCanvasElement} canvas - Canvas with captured image
 */
export async function performOCR(canvas) {
    try {
        const worker = await Tesseract.createWorker();
        
        const { data: { text, confidence } } = await worker.recognize(canvas);
        await worker.terminate();
        
        addLog(`📄 OCR Text: ${text.trim()}`, 'info');
        
        // Check if "TEST" is in the recognized text (case-insensitive)
        const recognizedText = text.toUpperCase();
        const containsTest = recognizedText.includes('TEST');
        
        if (containsTest) {
            setOcrRecognized(true);
            addLog('✅ Product label recognized!', 'success');
            
            // Update compact display - only show success status
            setCurrentOcrStatus('recognized');
            updateFrameCaptureStatuses();
            ocrResultCompact.innerHTML = '';  // No detailed message
            
            // Hide OCR analysis overlay
            ocrAnalysisOverlay.style.display = 'none';
            
            // Update button state
            updateSessionUI();
            
            // Auto-advance to next step after a short delay
            addLog('⏭️ Auto-advancing to next step...', 'info');
            setTimeout(() => {
                if (nextStepCallback) {
                    nextStepCallback();
                }
            }, 1500); // 1.5 second delay to show success message
        } else {
            setOcrRecognized(false);
            addLog('❌ Product label not found in image. Try again.', 'error');
            
            // Update compact display - only show failed status
            setCurrentOcrStatus('notFound');
            updateFrameCaptureStatuses();
            ocrResultCompact.innerHTML = '';  // No detailed message
            
            // Hide OCR analysis overlay
            ocrAnalysisOverlay.style.display = 'none';
            
            // Show the modal for OCR failure
            ocrFailModal.style.display = 'flex';
        }
        
    } catch (error) {
        addLog('❌ OCR failed: ' + error.message, 'error');
        
        // Update compact display - only show error status
        setCurrentOcrStatus('error');
        updateFrameCaptureStatuses();
        ocrResultCompact.innerHTML = '';  // No detailed error message
        
        // Hide OCR analysis overlay
        ocrAnalysisOverlay.style.display = 'none';
    }
}

/**
 * Capture frame for Step 2 (palm detection)
 * Automatically captures palm area when detection completes
 */
export async function captureStep4Frame() {
    if (analysisSession.currentStep !== 2) {
        return;
    }
    
    if (!handLandmarks || handLandmarks.length === 0) {
        addLog('⚠️ No hand detected for capture', 'warning');
        return;
    }
    
    addLog('📸 Capturing palm area...', 'info');
    
    // Use the first detected hand for capture
    const firstHand = handLandmarks[0];
    
    // Calculate bounding box around hand landmarks
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    
    for (const landmark of firstHand) {
        minX = Math.min(minX, landmark.x);
        minY = Math.min(minY, landmark.y);
        maxX = Math.max(maxX, landmark.x);
        maxY = Math.max(maxY, landmark.y);
    }
    
    // Add padding around hand (35% on each side for more context)
    const padding = 0.35;
    const width = maxX - minX;
    const height = maxY - minY;
    
    minX = Math.max(0, minX - width * padding);
    minY = Math.max(0, minY - height * padding);
    maxX = Math.min(1, maxX + width * padding);
    maxY = Math.min(1, maxY + height * padding);
    
    // Convert normalized coordinates to pixel coordinates
    const captureX = minX * webcam.videoWidth;
    const captureY = minY * webcam.videoHeight;
    const captureWidth = (maxX - minX) * webcam.videoWidth;
    const captureHeight = (maxY - minY) * webcam.videoHeight;
    
    // Make capture square by using the larger dimension
    const squareSize = Math.max(captureWidth, captureHeight);
    
    // Center the square around the hand
    const squareCenterX = captureX + captureWidth / 2;
    const squareCenterY = captureY + captureHeight / 2;
    const squareX = squareCenterX - squareSize / 2;
    const squareY = squareCenterY - squareSize / 2;
    
    // Create canvas for capture (square)
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = squareSize;
    captureCanvas.height = squareSize;
    const ctx = captureCanvas.getContext('2d');
    
    // Draw only the hand area from video WITHOUT mirroring (square crop)
    ctx.drawImage(
        webcam,
        squareX, squareY, squareSize, squareSize,  // Source rectangle (square)
        0, 0, squareSize, squareSize               // Destination rectangle (square)
    );
    
    // Store as blob for download
    await new Promise(resolve => {
        captureCanvas.toBlob(blob => {
            step4CapturedFrameBlob = blob;
            resolve();
        }, 'image/png');
    });
    
    // Show captured frame area if not already visible
    capturedFrameArea.classList.remove('empty');
    
    // Display in the preview
    const displayCanvas = step4FrameCanvas;
    displayCanvas.width = captureCanvas.width;
    displayCanvas.height = captureCanvas.height;
    const displayCtx = displayCanvas.getContext('2d');
    
    // Draw without mirroring so image appears correct
    displayCtx.drawImage(captureCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
    
    // Update status badge
    setCurrentPalmStatus('captured');
    updateFrameCaptureStatuses();
    
    addLog('✅ Palm area captured!', 'success');
}
