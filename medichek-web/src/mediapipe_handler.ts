// Canvas context
let canvasCtx: CanvasRenderingContext2D | null = null;

// Face Mesh results callback
function onFaceMeshResults(results) {
    // Only process for Step 3 (Face Rubbing)
    if (analysisSession.currentStep === 3) {
        // Initialize canvas context if needed
        if (!canvasCtx) {
            DOM.canvas.width = DOM.webcam.videoWidth;
            DOM.canvas.height = DOM.webcam.videoHeight;
            canvasCtx = DOM.canvas.getContext('2d');
        } else {
            // Always draw video frame to keep preview updating
            canvasCtx.save();
            canvasCtx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
            canvasCtx.drawImage(results.image, 0, 0, DOM.canvas.width, DOM.canvas.height);
        }
        
        // Process face landmarks if detected
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            faceMeshLandmarks = results.multiFaceLandmarks[0];
            
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
            faceMeshLandmarks = null;
            if (handLandmarks && handLandmarks.length > 0) {
                drawFaceMeshOverlay(null, handLandmarks);
            }
        }
        
        canvasCtx!.restore();
    }
}

// Check if face is within canvas bounds (for Step 3)
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

// Check if hand is rubbing face areas
function checkFaceRubbing(faceLandmarks, allHandLandmarks) {
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
    // Based on MediaPipe face mesh connections
    const excludedLandmarks = new Set([
        // Lips (FACEMESH_LIPS)
        0, 13, 14, 17, 37, 39, 40, 61, 78, 80, 81, 82, 84, 87, 88, 91, 95, 146, 178, 181, 185, 191, 267, 269, 270, 291, 308, 310, 311, 312, 314, 317, 318, 321, 324, 375, 402, 405, 409, 415,
        // Left Eye (FACEMESH_LEFT_EYE)
        249, 263, 362, 373, 374, 380, 381, 382, 384, 385, 386, 387, 388, 390, 398, 466,
        // Right Eye (FACEMESH_RIGHT_EYE)
        7, 33, 133, 144, 145, 153, 154, 155, 157, 158, 159, 160, 161, 163, 173, 246,
        // Left Iris (FACEMESH_LEFT_IRIS)
        474, 475, 476, 477,
        // Right Iris (FACEMESH_RIGHT_IRIS)
        469, 470, 471, 472,
        // Nose (FACEMESH_NOSE)
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
        // Key landmarks:
        // 0 = wrist
        // 1, 5, 9, 13, 17 = finger bases (palm area)
        // 4, 8, 12, 16, 20 = fingertips
        
        const fingertipsCenter = {
            x: (handLandmarks[4].x + handLandmarks[8].x + handLandmarks[12].x + handLandmarks[16].x + handLandmarks[20].x) / 5,
            y: (handLandmarks[4].y + handLandmarks[8].y + handLandmarks[12].y + handLandmarks[16].y + handLandmarks[20].y) / 5
        };
        
        const palmCenter = {
            x: (handLandmarks[0].x + handLandmarks[1].x + handLandmarks[5].x + handLandmarks[9].x + handLandmarks[13].x + handLandmarks[17].x) / 6,
            y: (handLandmarks[0].y + handLandmarks[1].y + handLandmarks[5].y + handLandmarks[9].y + handLandmarks[13].y + handLandmarks[17].y) / 6
        };
        
        // Check distance to each face region using BOTH fingertips and palm
        // Use the closer of the two points for better detection
        const fingertipsDistanceToForehead = Math.sqrt(
            Math.pow(fingertipsCenter.x - foreheadCenter.x, 2) + 
            Math.pow(fingertipsCenter.y - foreheadCenter.y, 2)
        );
        const palmDistanceToForehead = Math.sqrt(
            Math.pow(palmCenter.x - foreheadCenter.x, 2) + 
            Math.pow(palmCenter.y - foreheadCenter.y, 2)
        );
        const distanceToForehead = Math.min(fingertipsDistanceToForehead, palmDistanceToForehead);
        const foreheadContactPoint = fingertipsDistanceToForehead < palmDistanceToForehead ? fingertipsCenter : palmCenter;
        
        const fingertipsDistanceToLeftCheek = Math.sqrt(
            Math.pow(fingertipsCenter.x - leftCheek.x, 2) + 
            Math.pow(fingertipsCenter.y - leftCheek.y, 2)
        );
        const palmDistanceToLeftCheek = Math.sqrt(
            Math.pow(palmCenter.x - leftCheek.x, 2) + 
            Math.pow(palmCenter.y - leftCheek.y, 2)
        );
        const distanceToLeftCheek = Math.min(fingertipsDistanceToLeftCheek, palmDistanceToLeftCheek);
        const leftCheekContactPoint = fingertipsDistanceToLeftCheek < palmDistanceToLeftCheek ? fingertipsCenter : palmCenter;
        
        const fingertipsDistanceToRightCheek = Math.sqrt(
            Math.pow(fingertipsCenter.x - rightCheek.x, 2) + 
            Math.pow(fingertipsCenter.y - rightCheek.y, 2)
        );
        const palmDistanceToRightCheek = Math.sqrt(
            Math.pow(palmCenter.x - rightCheek.x, 2) + 
            Math.pow(palmCenter.y - rightCheek.y, 2)
        );
        const distanceToRightCheek = Math.min(fingertipsDistanceToRightCheek, palmDistanceToRightCheek);
        const rightCheekContactPoint = fingertipsDistanceToRightCheek < palmDistanceToRightCheek ? fingertipsCenter : palmCenter;
        
        // Mark areas being touched by this hand (using whichever point is closer)
        // Use wider threshold for forehead
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
    if (analysisSession.currentStep === 3) {
        updateSessionUI();
    }
}

// Track rubbing motion for a face area
function trackRubbingMotion(area, handPos, currentTime) {
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
            utils.addLog(`✅ ${area} rubbed for 5 seconds!`, 'success');
        }
    } else {
        // Hand is near but not moving - pause timer
        state.lastUpdateTime = null;
    }
    
    state.lastHandPos = { x: handPos.x, y: handPos.y };
}

// Reset rubbing timer when hand moves away
function resetRubbingTimer(area, currentTime) {
    const state = faceRubbingState[area];
    // Only reset lastUpdateTime to pause timer, keep totalTime accumulated
    state.lastUpdateTime = null;
    state.lastHandPos = null;
}

// Hands detection results callback
function onHandsDetectionResults(results) {
    // For Step 2 (Palm Detection), always draw the canvas to keep preview updating
    if (analysisSession.currentStep === 2) {
        // Initialize canvas context if needed
        if (!canvasCtx) {
            canvas.width = DOM.webcam.videoWidth;
            canvas.height = DOM.webcam.videoHeight;
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
        handDetected = true;
        // Store all detected hands (array) for face rubbing step
        handLandmarks = results.multiHandLandmarks;
        
        // For palm detection step (step 2), only check the first hand
        const firstHand = results.multiHandLandmarks[0];
        
        // Get handedness (Left or Right) for first hand
        const handedness = results.multiHandedness && results.multiHandedness[0] 
            ? results.multiHandedness[0].label 
            : null;
        
        // Check if palm is facing camera with fingers pointing down (first hand only for step 2)
        const wrist = firstHand[0]; // Landmark 0 is wrist
        const middleFingerTip = firstHand[12]; // Landmark 12 is middle finger tip
        const indexFingerTip = firstHand[8]; // Landmark 8 is index finger tip
        const pinkyTip = firstHand[20]; // Landmark 20 is pinky tip
        const ringFingerTip = firstHand[16]; // Landmark 16 is ring finger tip
        
        // Key landmarks for determining palm vs back of hand
        const thumbTip = firstHand[4]; // Landmark 4 is thumb tip
        const indexBase = firstHand[5]; // Landmark 5 is index finger base (MCP)
        const pinkyBase = firstHand[17]; // Landmark 17 is pinky base (MCP)
        
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
        
        palmUp = fingersDown && palmFacing && palmUpright;
        
        // Check if entire hand is within the canvas bounds (accounting for square crop)
        // The canvas is square (aspect-ratio: 1/1) but video may be wider
        // Calculate the visible square region in normalized coordinates
        const videoAspect = DOM.webcam.videoWidth / DOM.webcam.videoHeight;
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
        
        let handWithinBounds = true;
        
        // Check bounds for first hand only (for palm detection step)
        for (const landmark of firstHand) {
            if (landmark.x < boundsLeft || landmark.x > boundsRight ||
                landmark.y < boundsTop || landmark.y > boundsBottom) {
                handWithinBounds = false;
                break;
            }
        }
        
        // Track palm detection duration for Step 2 (Palm Detection)
        if (analysisSession.currentStep === 2 && !palmDetectionState.completed) {
            if (palmUp && handWithinBounds) {
                const currentTime = Date.now();
                
                if (!palmDetectionState.startTime) {
                    palmDetectionState.startTime = currentTime;
                    palmDetectionState.detected = true;
                    utils.addLog('👋 Palm detected! Hold for 2 seconds...', 'info');
                    // Hide warning when hand is back in bounds
                    hideHandBoundsWarning();
                }
                
                palmDetectionState.totalTime = currentTime - palmDetectionState.startTime;
                
                // Check if palm shown for required duration
                if (palmDetectionState.totalTime >= PALM_DETECTION_REQUIRED && !palmDetectionState.completed) {
                    palmDetectionState.completed = true;
                    utils.addLog('✅ Palm detection complete! Auto-advancing to next step...', 'success');
                    
                    // Capture frame for step 2 (palm detection)
                    captureStep4Frame();
                    // Hide warning on completion
                    hideHandBoundsWarning();
                    
                    // Update UI to show completion
                    updateSessionUI();
                    
                    // Auto-advance to next step after a short delay
                    setTimeout(() => {
                        nextStep();
                    }, 1500); // 1.5 second delay to show success message
                }
            } else {
                // Reset timer if palm is no longer detected or hand is out of bounds
                if (!palmDetectionState.completed) {
                    if (palmDetectionState.detected && !handWithinBounds) {
                        utils.addLog('⚠️ Keep entire hand within frame', 'warning');
                        // Show visual warning popup
                        showHandBoundsWarning();
                    }
                    palmDetectionState.startTime = null;
                    palmDetectionState.totalTime = 0;
                    palmDetectionState.detected = false;
                }
            }
        }
        
        // Update button state in real-time for step 2 (palm detection)
        if (analysisSession.currentStep === 2) {
            updateSessionUI();
        }
    } else {
        handDetected = false;
        palmUp = false;
        handLandmarks = [];  // Empty array when no hands detected
        
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

// Draw face mesh landmarks and rubbing zones on canvas (Step 5)
function drawFaceMeshOverlay(faceLandmarks, handLandmarks) {
    if (!canvasCtx || !faceLandmarks) return;
    
    // Get key facial landmarks for positioning
    const noseBridge = faceLandmarks[168];  // Center nose bridge
    const foreheadTop = faceLandmarks[10];  // Top of forehead
    const leftTemple = faceLandmarks[234];  // Left temple
    const rightTemple = faceLandmarks[454]; // Right temple
    const leftJaw = faceLandmarks[172];     // Left jaw
    const rightJaw = faceLandmarks[397];    // Right jaw
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
    
    // Forehead ellipse (horizontal orientation, shifted down, wider to match increased detection threshold)
    const foreheadCenter = faceLandmarks[10];
    const foreheadX = foreheadCenter.x * DOM.canvas.width;
    const foreheadY = (foreheadCenter.y + yOffset) * DOM.canvas.height;
    const foreheadRadiusX = faceWidth * 0.38; // Increased from 0.25 to match 0.15 threshold (50% wider)
    const foreheadRadiusY = faceHeight * 0.12; // Reverted to original height
    
    canvasCtx.strokeStyle = faceRubbingState.forehead.rubbed ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 255, 255, 0.5)';
    canvasCtx.lineWidth = 3;
    canvasCtx.beginPath();
    canvasCtx.ellipse(foreheadX, foreheadY, foreheadRadiusX, foreheadRadiusY, 0, 0, 2 * Math.PI);
    canvasCtx.stroke();
    
    // Left cheek ellipse (vertical orientation, shifted down)
    const leftCheek = faceLandmarks[280];
    const leftX = leftCheek.x * DOM.canvas.width;
    const leftY = (leftCheek.y + yOffset) * DOM.canvas.height;
    const leftRadiusX = faceWidth * 0.15;
    const leftRadiusY = faceHeight * 0.20;
    
    canvasCtx.strokeStyle = faceRubbingState.leftSide.rubbed ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 255, 255, 0.5)';
    canvasCtx.beginPath();
    canvasCtx.ellipse(leftX, leftY, leftRadiusX, leftRadiusY, 0, 0, 2 * Math.PI);
    canvasCtx.stroke();
    
    // Right cheek ellipse (vertical orientation, shifted down)
    const rightCheek = faceLandmarks[50];
    const rightX = rightCheek.x * DOM.canvas.width;
    const rightY = (rightCheek.y + yOffset) * DOM.canvas.height;
    const rightRadiusX = faceWidth * 0.15;
    const rightRadiusY = faceHeight * 0.20;
    
    canvasCtx.strokeStyle = faceRubbingState.rightSide.rubbed ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 255, 255, 0.5)';
    canvasCtx.beginPath();
    canvasCtx.ellipse(rightX, rightY, rightRadiusX, rightRadiusY, 0, 0, 2 * Math.PI);
    canvasCtx.stroke();
}

// Face detection results callback
function onFaceDetectionResults(results) {
    // Skip drawing on Step 3 (face rubbing - face mesh handles it)
    if (analysisSession.currentStep === 3) {
        return;
    }
    
    // Get canvas context
    if (!canvasCtx) {
        canvas.width = DOM.webcam.videoWidth;
        canvas.height = DOM.webcam.videoHeight;
        canvasCtx = canvas.getContext('2d');
    } else {
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    }
    
    if (results.detections && results.detections.length > 0) {
        faceDetected = true;
        
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
        
        faceCentered = distanceFromCenterX < centerTolerance && distanceFromCenterY < centerTolerance;
        
        // Show warning toast if face is not centered (for steps that need it, but skip step 1 OCR)
        if (analysisSession.currentStep > 0 && analysisSession.currentStep !== 1 && analysisSession.isActive && !faceCentered) {
            showWarningToast(t('warning.centerFace'));
        } else if (faceCentered || analysisSession.currentStep === 1) {
            hideWarningToast();
        }
        
        // Draw visualizations on Step 0 (preliminaries) for face centering guidance
        if (analysisSession.currentStep === 0) {
            // Draw bounding box
            canvasCtx.strokeStyle = faceCentered ? '#00ff00' : '#ff6b00';
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
            canvasCtx.strokeStyle = faceCentered ? '#00ff00' : '#ffffff';
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
        
        // Update button state in real-time for step 0 (preliminaries)
        if (analysisSession.currentStep === 0) {
            updateSessionUI(); // Enable/disable next step button based on camera and face centering
        }
    } else {
        faceDetected = false;
        faceCentered = false;
        
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
        const animationTime = Date.now() % 2000; // 2 second cycle
        const pulseOpacity = 0.7 + Math.sin(animationTime / 1000 * Math.PI) * 0.3;
        
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
        const scanLineY = captureY + (animationTime / 2000) * captureHeight;
        canvasCtx.strokeStyle = `rgba(0, 255, 0, ${0.5 + Math.sin(animationTime / 200) * 0.3})`;
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
    
    canvasCtx.restore();
}