/**
 * Hand Detection Module
 * 
 * Handles hand detection logic and palm validation:
 * - Hand detection results processing
 * - Palm detection validation (fingers down, palm facing camera)
 * - Hand bounds checking
 * - Palm detection timing and auto-advance
 * - Hand landmarks drawing
 */

import { addLog } from './utils.js';
import { t } from './translations.js';
import { analysisSession } from './config.js';
import {
    setHandDetected,
    setPalmUp,
    setHandLandmarks,
    palmDetectionState,
    PALM_DETECTION_REQUIRED
} from './mediapipe-state.js';
import { canvas, webcam } from './dom-elements.js';
import { showHandBoundsWarning, hideHandBoundsWarning } from './utils.js';
import { updateSessionUI } from './ui-manager.js';

// Module-level canvas context
let canvasCtx = null;

// Forward declaration for captureStep4Frame (will be provided by ocr-handler)
let captureStep4FrameCallback = null;

// Forward declaration for nextStep (will be provided by session-manager)
let nextStepCallback = null;

/**
 * Set the capture step 4 frame callback
 * @param {Function} callback - Function to capture palm frame
 */
export function setCaptureStep4FrameCallback(callback) {
    captureStep4FrameCallback = callback;
}

/**
 * Set the next step callback
 * @param {Function} callback - Function to advance to next step
 */
export function setNextStepCallback(callback) {
    nextStepCallback = callback;
}

/**
 * Get canvas context
 * @returns {CanvasRenderingContext2D|null}
 */
export function getCanvasContext() {
    return canvasCtx;
}

/**
 * Hand Detection results callback
 * Processes hand detection results and validates palm position
 * @param {Object} results - MediaPipe hands detection results
 */
export function onHandsDetectionResults(results) {
    // For Step 2 (Palm Detection), always draw the canvas to keep preview updating
    if (analysisSession.currentStep === 2) {
        // Initialize canvas context if needed
        if (!canvasCtx) {
            canvas.width = webcam.videoWidth;
            canvas.height = webcam.videoHeight;
            canvasCtx = canvas.getContext('2d');
        }
        
        // Always draw video frame to keep preview updating
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        
        // Note: Hand landmarks drawing removed for better performance
        
        canvasCtx.restore();
    }
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        setHandDetected(true);
        // Store all detected hands (array) for face rubbing step
        setHandLandmarks(results.multiHandLandmarks);
        
        // For palm detection step (step 2), only check the first hand
        const firstHand = results.multiHandLandmarks[0];
        
        // Get handedness (Left or Right) for first hand
        const handedness = results.multiHandedness && results.multiHandedness[0] 
            ? results.multiHandedness[0].label 
            : null;
        
        // Validate palm position
        const palmUp = validatePalmPosition(firstHand, handedness);
        setPalmUp(palmUp);
        
        // Check if hand is within bounds
        const handWithinBounds = checkHandBounds(firstHand);
        
        // Track palm detection duration for Step 2 (Palm Detection)
        if (analysisSession.currentStep === 2 && !palmDetectionState.completed) {
            handlePalmDetectionTracking(palmUp, handWithinBounds);
        }
        
        // Update button state in real-time for step 2 (palm detection)
        if (analysisSession.currentStep === 2) {
            updateSessionUI();
        }
    } else {
        setHandDetected(false);
        setPalmUp(false);
        setHandLandmarks([]);  // Empty array when no hands detected
        
        // Reset palm detection if hand is no longer detected (but keep completion state)
        if (analysisSession.currentStep === 2 && !palmDetectionState.completed) {
            palmDetectionState.startTime = null;
            palmDetectionState.totalTime = 0;
            palmDetectionState.detected = false;
        }
        
        // Update button state in real-time for step 2 (palm detection)
        if (analysisSession.currentStep === 2) {
            updateSessionUI();
        }
    }
}

/**
 * Validate palm position (fingers down, palm facing camera, upright)
 * @param {Array} handLandmarks - Hand landmarks array
 * @param {string} handedness - 'Left' or 'Right' from MediaPipe
 * @returns {boolean} Whether palm is in correct position
 */
function validatePalmPosition(handLandmarks, handedness) {
    // Check if palm is facing camera with fingers pointing down
    const wrist = handLandmarks[0]; // Landmark 0 is wrist
    const middleFingerTip = handLandmarks[12]; // Landmark 12 is middle finger tip
    const indexFingerTip = handLandmarks[8]; // Landmark 8 is index finger tip
    const pinkyTip = handLandmarks[20]; // Landmark 20 is pinky tip
    const ringFingerTip = handLandmarks[16]; // Landmark 16 is ring finger tip
    
    // Key landmarks for determining palm vs back of hand
    const thumbTip = handLandmarks[4]; // Landmark 4 is thumb tip
    const indexBase = handLandmarks[5]; // Landmark 5 is index finger base (MCP)
    const pinkyBase = handLandmarks[17]; // Landmark 17 is pinky base (MCP)
    
    // Fingers pointing down means finger tips Y > wrist Y (lower on screen)
    const middleFingerDown = middleFingerTip.y > wrist.y;
    const indexFingerDown = indexFingerTip.y > wrist.y;
    const pinkyFingerDown = pinkyTip.y > wrist.y;
    const ringFingerDown = ringFingerTip.y > wrist.y;
    
    // At least 3 out of 4 fingers should be pointing downward
    const fingersDown = [middleFingerDown, indexFingerDown, pinkyFingerDown, ringFingerDown].filter(x => x).length >= 3;
    
    // Check if palm is facing camera (not back of hand)
    // NOTE: Camera feed is mirrored, so handedness is flipped from user's perspective
    // When palm faces camera (in mirrored view):
    // - MediaPipe "Right" hand (user's LEFT hand): thumb should be on the RIGHT side (thumb.x > pinky.x)
    // - MediaPipe "Left" hand (user's RIGHT hand): thumb should be on the LEFT side (thumb.x < pinky.x)
    let palmFacing = false;
    
    if (handedness === 'Right') {
        // MediaPipe "Right" = user's left hand; palm faces camera when thumb is to the right of pinky
        palmFacing = thumbTip.x > pinkyBase.x;
    } else if (handedness === 'Left') {
        // MediaPipe "Left" = user's right hand; palm faces camera when thumb is to the left of pinky
        palmFacing = thumbTip.x < pinkyBase.x;
    } else {
        // If handedness detection fails, use a heuristic
        // Palm facing typically has thumb separated from other fingers
        const thumbSeparated = Math.abs(thumbTip.x - indexBase.x) > Math.abs(indexBase.x - pinkyBase.x) * 0.3;
        palmFacing = thumbSeparated;
    }
    
    // Check hand is relatively upright (not tilted too much)
    const handWidth = Math.abs(indexBase.x - pinkyBase.x);
    const handHeight = Math.abs(middleFingerTip.y - wrist.y);
    const palmUpright = handHeight > handWidth * 0.5;
    
    return fingersDown && palmFacing && palmUpright;
}

/**
 * Check if hand is within visible canvas bounds
 * @param {Array} handLandmarks - Hand landmarks array
 * @returns {boolean} Whether hand is within bounds
 */
function checkHandBounds(handLandmarks) {
    // Check if entire hand is within the canvas bounds (accounting for square crop)
    // The canvas is square (aspect-ratio: 1/1) but video may be wider
    // Calculate the visible square region in normalized coordinates
    const videoAspect = webcam.videoWidth / webcam.videoHeight;
    let visibleLeft = 0, visibleRight = 1, visibleTop = 0, visibleBottom = 1;
    
    if (videoAspect > 1) {
        // Video is wider than tall - sides are cropped
        const visibleWidth = 1 / videoAspect;
        visibleLeft = (1 - visibleWidth) / 2;
        visibleRight = visibleLeft + visibleWidth;
    } else if (videoAspect < 1) {
        // Video is taller than wide - top/bottom are cropped
        const visibleHeight = videoAspect;
        visibleTop = (1 - visibleHeight) / 2;
        visibleBottom = visibleTop + visibleHeight;
    }
    
    // Add margin within the visible square area (5% of visible dimensions)
    const margin = 0.05;
    const visibleWidthMargin = (visibleRight - visibleLeft) * margin;
    const visibleHeightMargin = (visibleBottom - visibleTop) * margin;
    
    const boundsLeft = visibleLeft + visibleWidthMargin;
    const boundsRight = visibleRight - visibleWidthMargin;
    const boundsTop = visibleTop + visibleHeightMargin;
    const boundsBottom = visibleBottom - visibleHeightMargin;
    
    // Check bounds for all landmarks
    for (const landmark of handLandmarks) {
        if (landmark.x < boundsLeft || landmark.x > boundsRight ||
            landmark.y < boundsTop || landmark.y > boundsBottom) {
            return false;
        }
    }
    
    return true;
}

/**
 * Handle palm detection tracking and timing
 * @param {boolean} palmUp - Whether palm is in correct position
 * @param {boolean} handWithinBounds - Whether hand is within bounds
 */
function handlePalmDetectionTracking(palmUp, handWithinBounds) {
    if (palmUp && handWithinBounds) {
        const currentTime = Date.now();
        
        if (!palmDetectionState.startTime) {
            palmDetectionState.startTime = currentTime;
            palmDetectionState.detected = true;
            addLog('👋 Palm detected! Hold for 2 seconds...', 'info');
            // Hide warning when hand is back in bounds
            hideHandBoundsWarning();
        }
        
        palmDetectionState.totalTime = currentTime - palmDetectionState.startTime;
        
        // Check if palm shown for required duration
        if (palmDetectionState.totalTime >= PALM_DETECTION_REQUIRED && !palmDetectionState.completed) {
            palmDetectionState.completed = true;
            addLog('✅ Palm detection complete! Auto-advancing to next step...', 'success');
            
            // Capture frame for step 2 (palm detection)
            if (captureStep4FrameCallback) {
                captureStep4FrameCallback();
            }
            // Hide warning on completion
            hideHandBoundsWarning();
            
            // Update UI to show completion
            updateSessionUI();
            
            // Auto-advance to next step after a short delay
            setTimeout(() => {
                if (nextStepCallback) {
                    nextStepCallback();
                }
            }, 1500); // 1.5 second delay to show success message
        }
    } else {
        // Reset timer if palm is no longer detected or hand is out of bounds
        if (!palmDetectionState.completed) {
            if (palmDetectionState.detected && !handWithinBounds) {
                addLog('⚠️ Keep entire hand within frame', 'warning');
                // Show visual warning popup
                showHandBoundsWarning();
            }
            palmDetectionState.startTime = null;
            palmDetectionState.totalTime = 0;
            palmDetectionState.detected = false;
        }
    }
}

/**
 * Draw hand landmarks on canvas (optional visualization)
 * @param {Object} results - MediaPipe hands detection results
 */
export function drawHandLandmarks(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;
    if (!canvasCtx) return;
    
    const landmarks = results.multiHandLandmarks[0];
    
    // Get palm up state from mediapipe-state
    const { palmUp } = require('./mediapipe-state.js');
    
    // Draw connections
    canvasCtx.strokeStyle = palmUp ? '#00ff00' : '#ff6b00';
    canvasCtx.lineWidth = 3;
    
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],  // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],  // Index
        [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
        [0, 13], [13, 14], [14, 15], [15, 16],  // Ring
        [0, 17], [17, 18], [18, 19], [19, 20],  // Pinky
        [5, 9], [9, 13], [13, 17]  // Palm
    ];
    
    connections.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        
        canvasCtx.beginPath();
        canvasCtx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
        canvasCtx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
        canvasCtx.stroke();
    });
    
    // Draw landmark points
    canvasCtx.fillStyle = palmUp ? '#00ff00' : '#ff6b00';
    landmarks.forEach((landmark) => {
        canvasCtx.beginPath();
        canvasCtx.arc(
            landmark.x * canvas.width,
            landmark.y * canvas.height,
            5,
            0,
            2 * Math.PI
        );
        canvasCtx.fill();
    });
}
