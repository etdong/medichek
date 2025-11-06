/**
 * Face Mesh Module
 * 
 * Handles face mesh detection and face rubbing tracking:
 * - Face mesh results processing
 * - Face rubbing validation for 3 regions (forehead, left, right)
 * - Time-based rubbing tracking with motion detection
 * - Holistic face coverage tracking
 * - Face mesh visualization overlay
 */

import { addLog } from './utils.js';
import { t } from './translations.js';
import { analysisSession } from './config.js';
import {
    setFaceMeshLandmarks,
    handLandmarks,
    faceRubbingState,
    RUBBING_DURATION_REQUIRED,
    RUBBING_MOTION_THRESHOLD,
    FACE_COVERAGE_PROXIMITY
} from './mediapipe-state.js';
import { canvas, webcam } from './dom-elements.js';
import { showWarningToast, hideWarningToast } from './utils.js';
import { updateFaceRubbingUI } from './ui-manager.js';

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
 * Face Mesh results callback
 * Processes face mesh results and tracks face rubbing
 * @param {Object} results - MediaPipe face mesh results
 */
export function onFaceMeshResults(results) {
    // Only process for Step 3 (Face Rubbing)
    if (analysisSession.currentStep === 3) {
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
        
        // Process face landmarks if detected
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const faceMeshLandmarks = results.multiFaceLandmarks[0];
            setFaceMeshLandmarks(faceMeshLandmarks);
            
            // Check if face is within canvas bounds
            checkFaceInBounds(faceMeshLandmarks);
            
            // Check face rubbing with all detected hands
            if (handLandmarks && handLandmarks.length > 0) {
                checkFaceRubbing(faceMeshLandmarks, handLandmarks);
            }
            
            // Draw overlay on canvas
            drawFaceMeshOverlay(faceMeshLandmarks, handLandmarks);
        } else {
            // No face detected - still draw hand landmarks if available
            setFaceMeshLandmarks(null);
            if (handLandmarks && handLandmarks.length > 0) {
                drawFaceMeshOverlay(null, handLandmarks);
            }
        }
        
        canvasCtx.restore();
    }
}

/**
 * Check if face is within canvas bounds
 * @param {Array} faceLandmarks - Face mesh landmarks
 */
function checkFaceInBounds(faceLandmarks) {
    // Get face bounding box from landmarks
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    
    // Calculate bounding box from all face landmarks
    for (const landmark of faceLandmarks) {
        minX = Math.min(minX, landmark.x);
        minY = Math.min(minY, landmark.y);
        maxX = Math.max(maxX, landmark.x);
        maxY = Math.max(maxY, landmark.y);
    }
    
    // Define boundary thresholds (face should stay within these bounds)
    const marginThreshold = 0.05; // 5% margin from edges
    
    // Check if face is too close to any edge
    const tooCloseToLeft = minX < marginThreshold;
    const tooCloseToRight = maxX > (1 - marginThreshold);
    const tooCloseToTop = minY < marginThreshold;
    const tooCloseToBottom = maxY > (1 - marginThreshold);
    
    if (tooCloseToLeft || tooCloseToRight || tooCloseToTop || tooCloseToBottom) {
        // Show warning toast
        showWarningToast(t('warning.centerFace'));
    } else {
        // Face is properly centered, hide warning
        hideWarningToast();
    }
}

/**
 * Check if hand is rubbing face areas
 * @param {Array} faceLandmarks - Face mesh landmarks
 * @param {Array} allHandLandmarks - Array of hand landmarks (multiple hands)
 */
export function checkFaceRubbing(faceLandmarks, allHandLandmarks) {
    // Define face regions using key landmarks for time-based tracking
    // Face mesh has 468 landmarks
    
    // Shift detection areas down by 5% to better cover bottom of face
    const yOffset = 0.05;
    
    // Forehead region: landmarks around 10 (top of face), shifted down
    const foreheadCenter = {
        x: faceLandmarks[10].x,
        y: faceLandmarks[10].y + yOffset
    };
    
    // IMPORTANT: Camera is mirrored, so landmarks are flipped from user's perspective
    // Landmark 50 is on user's right cheek (appears left in mirror)
    // Landmark 280 is on user's left cheek (appears right in mirror)
    // We swap them so the naming matches what the user sees in the mirror
    
    // Left cheek (as user sees it in mirror): landmark 280, shifted down
    const leftCheek = {
        x: faceLandmarks[280].x,
        y: faceLandmarks[280].y + yOffset
    };
    
    // Right cheek (as user sees it in mirror): landmark 50, shifted down
    const rightCheek = {
        x: faceLandmarks[50].x,
        y: faceLandmarks[50].y + yOffset
    };
    
    const proximityThreshold = 0.10; // Threshold for cheek regions
    const foreheadProximityThreshold = 0.15; // Wider threshold for forehead region
    const currentTime = Date.now();
    
    // Track which areas are being touched by any hand
    const areasBeingTouched = {
        forehead: false,
        leftSide: false,
        rightSide: false
    };
    
    // Define landmarks to exclude (lips, eyes, nose) from coverage tracking
    const excludedLandmarks = new Set([
        // Lips
        0, 13, 14, 17, 37, 39, 40, 61, 78, 80, 81, 82, 84, 87, 88, 91, 95, 146, 178, 181, 185, 191, 267, 269, 270, 291, 308, 310, 311, 312, 314, 317, 318, 321, 324, 375, 402, 405, 409, 415,
        // Left Eye
        249, 263, 362, 373, 374, 380, 381, 382, 384, 385, 386, 387, 388, 390, 398, 466,
        // Right Eye
        7, 33, 133, 144, 145, 153, 154, 155, 157, 158, 159, 160, 161, 163, 173, 246,
        // Left Iris
        474, 475, 476, 477,
        // Right Iris
        469, 470, 471, 472,
        // Nose
        1, 2, 4, 5, 6, 19, 44, 45, 48, 64, 94, 97, 98, 115, 168, 195, 197, 220, 275, 278, 294, 326, 327, 344, 440
    ]);
    
    // Track holistic face mesh coverage - check all landmarks except excluded ones
    for (const handLandmarks of allHandLandmarks) {
        // Calculate multiple hand points for better coverage detection
        const handPoints = [
            // Fingertips
            handLandmarks[4], handLandmarks[8], handLandmarks[12], handLandmarks[16], handLandmarks[20],
            // Palm points
            handLandmarks[0], handLandmarks[1], handLandmarks[5], handLandmarks[9], handLandmarks[13], handLandmarks[17],
            // Middle knuckles for better coverage
            handLandmarks[2], handLandmarks[6], handLandmarks[10], handLandmarks[14], handLandmarks[18]
        ];
        
        // Check each face landmark to see if it's covered by any hand point
        for (let i = 0; i < faceLandmarks.length; i++) {
            // Skip excluded landmarks (lips, eyes, nose)
            if (excludedLandmarks.has(i)) {
                continue;
            }
            
            const faceLandmark = faceLandmarks[i];
            
            // Check distance to each hand point
            for (const handPoint of handPoints) {
                const distance = Math.sqrt(
                    Math.pow(handPoint.x - faceLandmark.x, 2) +
                    Math.pow(handPoint.y - faceLandmark.y, 2)
                );
                
                if (distance < FACE_COVERAGE_PROXIMITY) {
                    faceRubbingState.coveredLandmarks.add(i);
                    break; // No need to check other hand points for this landmark
                }
            }
        }
    }
    
    // Calculate overall coverage percentage (excluding lips, eyes, nose)
    const totalTrackableLandmarks = faceLandmarks.length - excludedLandmarks.size;
    const coveredCount = faceRubbingState.coveredLandmarks.size;
    faceRubbingState.totalCoverage = Math.round((coveredCount / totalTrackableLandmarks) * 100);
    
    // Check each detected hand for region-based time tracking
    for (const handLandmarks of allHandLandmarks) {
        // Use TWO detection points for better accuracy:
        // 1. Fingertips center - for when rubbing with fingers
        // 2. Palm center - for when rubbing with palm
        
        const fingertipsCenter = {
            x: (handLandmarks[4].x + handLandmarks[8].x + handLandmarks[12].x + handLandmarks[16].x + handLandmarks[20].x) / 5,
            y: (handLandmarks[4].y + handLandmarks[8].y + handLandmarks[12].y + handLandmarks[16].y + handLandmarks[20].y) / 5
        };
        
        const palmCenter = {
            x: (handLandmarks[0].x + handLandmarks[1].x + handLandmarks[5].x + handLandmarks[9].x + handLandmarks[13].x + handLandmarks[17].x) / 6,
            y: (handLandmarks[0].y + handLandmarks[1].y + handLandmarks[5].y + handLandmarks[9].y + handLandmarks[13].y + handLandmarks[17].y) / 6
        };
        
        // Check distance to each face region using BOTH fingertips and palm
        const distanceToForehead = Math.min(
            Math.sqrt(Math.pow(fingertipsCenter.x - foreheadCenter.x, 2) + Math.pow(fingertipsCenter.y - foreheadCenter.y, 2)),
            Math.sqrt(Math.pow(palmCenter.x - foreheadCenter.x, 2) + Math.pow(palmCenter.y - foreheadCenter.y, 2))
        );
        const foreheadContactPoint = 
            Math.sqrt(Math.pow(fingertipsCenter.x - foreheadCenter.x, 2) + Math.pow(fingertipsCenter.y - foreheadCenter.y, 2)) <
            Math.sqrt(Math.pow(palmCenter.x - foreheadCenter.x, 2) + Math.pow(palmCenter.y - foreheadCenter.y, 2))
            ? fingertipsCenter : palmCenter;
        
        const distanceToLeftCheek = Math.min(
            Math.sqrt(Math.pow(fingertipsCenter.x - leftCheek.x, 2) + Math.pow(fingertipsCenter.y - leftCheek.y, 2)),
            Math.sqrt(Math.pow(palmCenter.x - leftCheek.x, 2) + Math.pow(palmCenter.y - leftCheek.y, 2))
        );
        const leftCheekContactPoint =
            Math.sqrt(Math.pow(fingertipsCenter.x - leftCheek.x, 2) + Math.pow(fingertipsCenter.y - leftCheek.y, 2)) <
            Math.sqrt(Math.pow(palmCenter.x - leftCheek.x, 2) + Math.pow(palmCenter.y - leftCheek.y, 2))
            ? fingertipsCenter : palmCenter;
        
        const distanceToRightCheek = Math.min(
            Math.sqrt(Math.pow(fingertipsCenter.x - rightCheek.x, 2) + Math.pow(fingertipsCenter.y - rightCheek.y, 2)),
            Math.sqrt(Math.pow(palmCenter.x - rightCheek.x, 2) + Math.pow(palmCenter.y - rightCheek.y, 2))
        );
        const rightCheekContactPoint =
            Math.sqrt(Math.pow(fingertipsCenter.x - rightCheek.x, 2) + Math.pow(fingertipsCenter.y - rightCheek.y, 2)) <
            Math.sqrt(Math.pow(palmCenter.x - rightCheek.x, 2) + Math.pow(palmCenter.y - rightCheek.y, 2))
            ? fingertipsCenter : palmCenter;
        
        // Mark areas being touched by this hand
        if (distanceToForehead < foreheadProximityThreshold) {
            areasBeingTouched.forehead = true;
            trackRubbingMotion('forehead', foreheadContactPoint, currentTime);
        }
        
        if (distanceToLeftCheek < proximityThreshold) {
            areasBeingTouched.leftSide = true;
            trackRubbingMotion('leftSide', leftCheekContactPoint, currentTime);
        }
        
        if (distanceToRightCheek < proximityThreshold) {
            areasBeingTouched.rightSide = true;
            trackRubbingMotion('rightSide', rightCheekContactPoint, currentTime);
        }
    }
    
    // Reset timers for areas not being touched by any hand
    if (!areasBeingTouched.forehead) {
        resetRubbingTimer('forehead', currentTime);
    }
    if (!areasBeingTouched.leftSide) {
        resetRubbingTimer('leftSide', currentTime);
    }
    if (!areasBeingTouched.rightSide) {
        resetRubbingTimer('rightSide', currentTime);
    }
    
    // Update UI
    updateFaceRubbingUI();
}

/**
 * Track rubbing motion for a face area
 * @param {string} area - Area name ('forehead', 'leftSide', 'rightSide')
 * @param {Object} handPos - Hand position {x, y}
 * @param {number} currentTime - Current timestamp
 */
export function trackRubbingMotion(area, handPos, currentTime) {
    const state = faceRubbingState[area];
    
    // Check if hand is moving (rubbing motion)
    let isRubbing = false;
    if (state.lastHandPos) {
        const movement = Math.sqrt(
            Math.pow(handPos.x - state.lastHandPos.x, 2) +
            Math.pow(handPos.y - state.lastHandPos.y, 2)
        );
        isRubbing = movement > RUBBING_MOTION_THRESHOLD;
    } else {
        // First frame with hand in position - start tracking immediately
        isRubbing = true;
    }
    
    // If rubbing motion detected, accumulate time
    if (isRubbing) {
        // Add elapsed time since last update (only when actively rubbing)
        if (state.lastUpdateTime) {
            const elapsed = currentTime - state.lastUpdateTime;
            state.totalTime += elapsed;
        }
        state.lastUpdateTime = currentTime;
        
        // Check if rubbed long enough
        if (state.totalTime >= RUBBING_DURATION_REQUIRED && !state.rubbed) {
            state.rubbed = true;
            addLog(`✅ ${area} rubbed for 5 seconds!`, 'success');
        }
    } else {
        // Hand is near but not moving - pause timer
        state.lastUpdateTime = null;
    }
    
    state.lastHandPos = { x: handPos.x, y: handPos.y };
}

/**
 * Reset rubbing timer when hand moves away
 * @param {string} area - Area name ('forehead', 'leftSide', 'rightSide')
 * @param {number} currentTime - Current timestamp
 */
export function resetRubbingTimer(area, currentTime) {
    const state = faceRubbingState[area];
    // Only reset lastUpdateTime to pause timer, keep totalTime accumulated
    state.lastUpdateTime = null;
    state.lastHandPos = null;
}

/**
 * Draw face mesh overlay with rubbing zones and coverage
 * @param {Array} faceLandmarks - Face mesh landmarks
 * @param {Array} handLandmarks - Hand landmarks array (unused, for signature compatibility)
 */
export function drawFaceMeshOverlay(faceLandmarks, handLandmarks) {
    if (!canvasCtx || !faceLandmarks) return;
    
    // Get key facial landmarks for positioning
    const foreheadTop = faceLandmarks[10];  // Top of forehead
    const leftTemple = faceLandmarks[234];  // Left temple
    const rightTemple = faceLandmarks[454]; // Right temple
    const chin = faceLandmarks[152];        // Chin
    
    // Calculate face dimensions
    const faceWidth = Math.abs(leftTemple.x - rightTemple.x) * canvas.width;
    const faceHeight = (chin.y - foreheadTop.y) * canvas.height;
    
    // Define landmarks to exclude (lips, eyes, nose) from visualization
    const excludedLandmarks = new Set([
        // Lips
        0, 13, 14, 17, 37, 39, 40, 61, 78, 80, 81, 82, 84, 87, 88, 91, 95, 146, 178, 181, 185, 191, 267, 269, 270, 291, 308, 310, 311, 312, 314, 317, 318, 321, 324, 375, 402, 405, 409, 415,
        // Left Eye
        249, 263, 362, 373, 374, 380, 381, 382, 384, 385, 386, 387, 388, 390, 398, 466,
        // Right Eye
        7, 33, 133, 144, 145, 153, 154, 155, 157, 158, 159, 160, 161, 163, 173, 246,
        // Left Iris
        474, 475, 476, 477,
        // Right Iris
        469, 470, 471, 472,
        // Nose
        1, 2, 4, 5, 6, 19, 44, 45, 48, 64, 94, 97, 98, 115, 168, 195, 197, 220, 275, 278, 294, 326, 327, 344, 440
    ]);
    
    // Draw all face mesh landmarks as gray dots (uncovered state), except excluded ones
    canvasCtx.fillStyle = 'rgba(150, 150, 150, 0.15)';
    for (let i = 0; i < faceLandmarks.length; i++) {
        // Skip excluded landmarks
        if (excludedLandmarks.has(i)) {
            continue;
        }
        
        const landmark = faceLandmarks[i];
        canvasCtx.beginPath();
        canvasCtx.arc(
            landmark.x * canvas.width,
            landmark.y * canvas.height,
            2, 0, 2 * Math.PI
        );
        canvasCtx.fill();
    }
    
    // Draw covered landmarks on top with bright color, except excluded ones
    canvasCtx.fillStyle = 'rgba(0, 255, 100, 0.25)';
    for (const landmarkIdx of faceRubbingState.coveredLandmarks) {
        // Skip excluded landmarks
        if (landmarkIdx < faceLandmarks.length && !excludedLandmarks.has(landmarkIdx)) {
            const landmark = faceLandmarks[landmarkIdx];
            canvasCtx.beginPath();
            canvasCtx.arc(
                landmark.x * canvas.width,
                landmark.y * canvas.height,
                2.5, 0, 2 * Math.PI
            );
            canvasCtx.fill();
        }
    }
    
    // Draw elliptical rubbing time tracking zones
    const yOffset = 0.05; // Shift detection areas down by 5%
    
    // Forehead ellipse (horizontal orientation, shifted down, wider)
    const foreheadCenter = faceLandmarks[10];
    const foreheadX = foreheadCenter.x * canvas.width;
    const foreheadY = (foreheadCenter.y + yOffset) * canvas.height;
    const foreheadRadiusX = faceWidth * 0.38;
    const foreheadRadiusY = faceHeight * 0.12;
    
    canvasCtx.strokeStyle = faceRubbingState.forehead.rubbed ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 255, 255, 0.5)';
    canvasCtx.lineWidth = 3;
    canvasCtx.beginPath();
    canvasCtx.ellipse(foreheadX, foreheadY, foreheadRadiusX, foreheadRadiusY, 0, 0, 2 * Math.PI);
    canvasCtx.stroke();
    
    // Left cheek ellipse (vertical orientation, shifted down)
    const leftCheek = faceLandmarks[280];
    const leftX = leftCheek.x * canvas.width;
    const leftY = (leftCheek.y + yOffset) * canvas.height;
    const leftRadiusX = faceWidth * 0.15;
    const leftRadiusY = faceHeight * 0.20;
    
    canvasCtx.strokeStyle = faceRubbingState.leftSide.rubbed ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 255, 255, 0.5)';
    canvasCtx.beginPath();
    canvasCtx.ellipse(leftX, leftY, leftRadiusX, leftRadiusY, 0, 0, 2 * Math.PI);
    canvasCtx.stroke();
    
    // Right cheek ellipse (vertical orientation, shifted down)
    const rightCheek = faceLandmarks[50];
    const rightX = rightCheek.x * canvas.width;
    const rightY = (rightCheek.y + yOffset) * canvas.height;
    const rightRadiusX = faceWidth * 0.15;
    const rightRadiusY = faceHeight * 0.20;
    
    canvasCtx.strokeStyle = faceRubbingState.rightSide.rubbed ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 255, 255, 0.5)';
    canvasCtx.beginPath();
    canvasCtx.ellipse(rightX, rightY, rightRadiusX, rightRadiusY, 0, 0, 2 * Math.PI);
    canvasCtx.stroke();
}
