/**
 * Face Detection Module
 * 
 * Handles face detection logic and visualization:
 * - Face detection results processing
 * - Face centering validation
 * - Drawing face bounding boxes and guides
 * - OCR capture area overlay
 */

import { t } from './translations.js';
import { analysisSession } from './config.js';
import { 
    faceDetected, setFaceDetected,
    faceCentered, setFaceCentered,
    facePosition,
    OCR_CAPTURE_AREA
} from './mediapipe-state.js';
import { canvas, webcam } from './dom-elements.js';
import { showWarningToast, hideWarningToast } from './utils.js';
import { updateSessionUI } from './ui-manager.js';

// Module-level canvas context
let canvasCtx = null;

/**
 * Get canvas context
 * @returns {CanvasRenderingContext2D|null}
 */
export function getCanvasContext() {
    return canvasCtx;
}

/**
 * Face Detection results callback
 * Processes face detection results and updates visualization
 * @param {Object} results - MediaPipe face detection results
 */
export function onFaceDetectionResults(results) {
    // Skip drawing on Step 3 (face rubbing - face mesh handles it)
    if (analysisSession.currentStep === 3) {
        return;
    }
    
    // Get canvas context
    if (!canvasCtx) {
        canvas.width = webcam.videoWidth;
        canvas.height = webcam.videoHeight;
        canvasCtx = canvas.getContext('2d');
    }
    
    // Always draw the video frame to keep preview updating
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    
    if (results.detections && results.detections.length > 0) {
        setFaceDetected(true);
        
        // Get first detected face
        const detection = results.detections[0];
        const bbox = detection.boundingBox;
        
        // Calculate face center position (normalized 0-1)
        facePosition.x = bbox.xCenter;
        facePosition.y = bbox.yCenter;
        
        // Check if face is centered (within tolerance)
        const centerTolerance = 0.15; // 15% from center
        const distanceFromCenterX = Math.abs(facePosition.x - 0.5);
        const distanceFromCenterY = Math.abs(facePosition.y - 0.5);
        
        const isCentered = distanceFromCenterX < centerTolerance && distanceFromCenterY < centerTolerance;
        setFaceCentered(isCentered);
        
        // Show warning toast if face is not centered (for steps that need it, but skip step 1 OCR)
        if (analysisSession.currentStep > 0 && analysisSession.currentStep !== 1 && analysisSession.isActive && !faceCentered) {
            showWarningToast(t('warning.centerFace'));
        } else if (faceCentered || analysisSession.currentStep === 1) {
            hideWarningToast();
        }
        
        // Draw visualizations on Step 0 (preliminaries) for face centering guidance
        if (analysisSession.currentStep === 0) {
            drawFaceCenteringGuide(bbox, faceCentered);
        }
        
        // Update button state in real-time for step 0 (preliminaries)
        if (analysisSession.currentStep === 0) {
            updateSessionUI(); // Enable/disable next step button based on camera and face centering
        }
    } else {
        setFaceDetected(false);
        setFaceCentered(false);
        
        // Don't show warning for step 2 - palm detection doesn't require face tracking
        // Only show warning on step 0 (preliminaries)
        if (analysisSession.currentStep === 0 && analysisSession.isActive) {
            showWarningToast(t('warning.faceNotDetected'));
        }
        
        // Update button state in real-time for step 0 (preliminaries)
        if (analysisSession.currentStep === 0) {
            updateSessionUI(); // Disable next step button if face not centered
        }
    }
    
    // Draw OCR capture area on Step 1 (OCR Capture - always, regardless of face detection)
    if (analysisSession.currentStep === 1) {
        drawOcrCaptureArea();
    }
    
    canvasCtx.restore();
}

/**
 * Draw face centering guide on Step 0
 * @param {Object} bbox - Face bounding box
 * @param {boolean} centered - Whether face is centered
 */
function drawFaceCenteringGuide(bbox, centered) {
    // Draw bounding box
    canvasCtx.strokeStyle = centered ? '#00ff00' : '#ff6b00';
    canvasCtx.lineWidth = 4;
    canvasCtx.strokeRect(
        bbox.xCenter * canvas.width - (bbox.width * canvas.width) / 2,
        bbox.yCenter * canvas.height - (bbox.height * canvas.height) / 2,
        bbox.width * canvas.width,
        bbox.height * canvas.height
    );
    
    // Draw center indicator
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const targetRadius = 100;
    
    // Draw target circle
    canvasCtx.strokeStyle = centered ? '#00ff00' : '#ffffff';
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    canvasCtx.arc(centerX, centerY, targetRadius, 0, 2 * Math.PI);
    canvasCtx.stroke();
    
    // Draw crosshair
    canvasCtx.beginPath();
    canvasCtx.moveTo(centerX - 20, centerY);
    canvasCtx.lineTo(centerX + 20, centerY);
    canvasCtx.moveTo(centerX, centerY - 20);
    canvasCtx.lineTo(centerX, centerY + 20);
    canvasCtx.stroke();
}

/**
 * Draw OCR capture area overlay on Step 1
 */
function drawOcrCaptureArea() {
    // Calculate square dimensions based on the smaller canvas dimension
    const minDimension = Math.min(canvas.width, canvas.height);
    const squareSize = minDimension * OCR_CAPTURE_AREA.sizePercent;
    
    // Center the square
    const captureX = (canvas.width - squareSize) / 2;
    const captureY = (canvas.height - squareSize) / 2;
    const captureWidth = squareSize;
    const captureHeight = squareSize;
    
    // Draw semi-transparent overlay outside capture area (darker for better contrast)
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    // Top bar
    canvasCtx.fillRect(0, 0, canvas.width, captureY);
    // Bottom bar
    canvasCtx.fillRect(0, captureY + captureHeight, canvas.width, canvas.height - captureY - captureHeight);
    // Left bar
    canvasCtx.fillRect(0, captureY, captureX, captureHeight);
    // Right bar
    canvasCtx.fillRect(captureX + captureWidth, captureY, canvas.width - captureX - captureWidth, captureHeight);
    
    // Draw animated border around capture area
    const currentTime = Date.now() % 2000; // 2 second cycle
    const pulseOpacity = 0.7 + Math.sin(currentTime / 1000 * Math.PI) * 0.3;
    
    // Outer glow border
    canvasCtx.strokeStyle = `rgba(0, 255, 0, ${pulseOpacity * 0.3})`;
    canvasCtx.lineWidth = 10;
    canvasCtx.strokeRect(captureX - 5, captureY - 5, captureWidth + 10, captureHeight + 10);
    
    // Main capture area border (bright green)
    canvasCtx.strokeStyle = `rgba(0, 255, 0, ${pulseOpacity})`;
    canvasCtx.lineWidth = 4;
    canvasCtx.strokeRect(captureX, captureY, captureWidth, captureHeight);
    
    // Draw corner brackets with animation
    const bracketSize = 40;
    canvasCtx.lineWidth = 6;
    canvasCtx.lineCap = 'round';
    canvasCtx.strokeStyle = '#00ff00';
    
    // Top-left bracket
    canvasCtx.beginPath();
    canvasCtx.moveTo(captureX, captureY + bracketSize);
    canvasCtx.lineTo(captureX, captureY);
    canvasCtx.lineTo(captureX + bracketSize, captureY);
    canvasCtx.stroke();
    
    // Top-right bracket
    canvasCtx.beginPath();
    canvasCtx.moveTo(captureX + captureWidth - bracketSize, captureY);
    canvasCtx.lineTo(captureX + captureWidth, captureY);
    canvasCtx.lineTo(captureX + captureWidth, captureY + bracketSize);
    canvasCtx.stroke();
    
    // Bottom-left bracket
    canvasCtx.beginPath();
    canvasCtx.moveTo(captureX, captureY + captureHeight - bracketSize);
    canvasCtx.lineTo(captureX, captureY + captureHeight);
    canvasCtx.lineTo(captureX + bracketSize, captureY + captureHeight);
    canvasCtx.stroke();
    
    // Bottom-right bracket
    canvasCtx.beginPath();
    canvasCtx.moveTo(captureX + captureWidth - bracketSize, captureY + captureHeight);
    canvasCtx.lineTo(captureX + captureWidth, captureY + captureHeight);
    canvasCtx.lineTo(captureX + captureWidth, captureY + captureHeight - bracketSize);
    canvasCtx.stroke();
    
    // Draw instruction text with background
    const instructionText = t('overlay.placeLabel');
    canvasCtx.font = 'bold 22px Arial';
    canvasCtx.textAlign = 'center';
    const textMetrics = canvasCtx.measureText(instructionText);
    const textX = canvas.width / 2;
    const textY = captureY - 20;
    const padding = 10;
    
    // Save context for text flipping
    canvasCtx.save();
    
    // Flip text horizontally to counteract the canvas mirror
    canvasCtx.translate(textX, textY);
    canvasCtx.scale(-1, 1);
    
    // Text background
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    canvasCtx.fillRect(
        -textMetrics.width / 2 - padding,
        -22,
        textMetrics.width + padding * 2,
        30
    );
    
    // Text
    canvasCtx.fillStyle = '#00ff00';
    canvasCtx.fillText(instructionText, 0, 0);
    
    // Restore context
    canvasCtx.restore();
    
    // Draw scanning line animation
    const scanAnimationTime = Date.now() % 2000; // 2 second cycle
    const scanLineY = captureY + (scanAnimationTime / 2000) * captureHeight;
    canvasCtx.strokeStyle = `rgba(0, 255, 0, ${0.5 + Math.sin(scanAnimationTime / 200) * 0.3})`;
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    canvasCtx.moveTo(captureX, scanLineY);
    canvasCtx.lineTo(captureX + captureWidth, scanLineY);
    canvasCtx.stroke();
    
    // Add dimension markers (also flip this text)
    canvasCtx.save();
    canvasCtx.translate(canvas.width / 2, captureY + captureHeight + 25);
    canvasCtx.scale(-1, 1);
    canvasCtx.fillStyle = 'rgba(0, 255, 0, 0.6)';
    canvasCtx.font = 'bold 14px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText(t('overlay.autoScan'), 0, 0);
    canvasCtx.restore();
}
