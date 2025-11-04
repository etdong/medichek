// Configuration - use external config if available, otherwise fallback
const DJANGO_SERVER_URL = (window.MedichekConfig && window.MedichekConfig.getDjangoUrl()) 
    || 'http://127.0.0.1:8000';

// Global state - Client-side only, no server sessions
let analysisSession = {
    sessionId: null,
    patientId: null,
    startTime: null,
    trackingData: [],
    currentStep: 0,
    totalSteps: 5,
    isActive: false,
    stepTimings: {
        step1: { startTime: null, endTime: null, duration: 0 },
        step2: { startTime: null, endTime: null, duration: 0 },
        step3: { startTime: null, endTime: null, duration: 0 },
        step4: { startTime: null, endTime: null, duration: 0 },
        step5: { startTime: null, endTime: null, duration: 0 }
    }
};

let cameraEnabled = false;
let videoStream = null;

// MediaPipe Face Detection
let faceDetection = null;
let camera = null;
let faceDetected = false;
let faceCentered = false;
let facePosition = { x: 0, y: 0 };

// MediaPipe Hands
let handsDetection = null;
let handDetected = false;
let palmUp = false;
let handLandmarks = null;

// MediaPipe Face Mesh (for Step 5)
let faceMesh = null;
let faceMeshLandmarks = null;

// Step 5: Face rubbing tracking
let faceRubbingState = {
    forehead: { rubbed: false, startTime: null, totalTime: 0, lastHandPos: null, lastUpdateTime: null },
    leftSide: { rubbed: false, startTime: null, totalTime: 0, lastHandPos: null, lastUpdateTime: null },
    rightSide: { rubbed: false, startTime: null, totalTime: 0, lastHandPos: null, lastUpdateTime: null }
};
const RUBBING_DURATION_REQUIRED = 5000; // 5 seconds in milliseconds
const RUBBING_MOTION_THRESHOLD = 0.005; // Minimum movement to count as rubbing (lowered for better sensitivity)

// Canvas context
let canvasCtx = null;

// OCR state
let ocrRecognized = false;
let capturedImageData = null;

// DOM elements
const serverStatus = document.getElementById('server-status');
const sessionIdElement = document.getElementById('session-id');
const currentStepElement = document.getElementById('current-step');

// Buttons
const startTrackingBtn = document.getElementById('start-tracking');
const captureFrameBtn = document.getElementById('capture-frame');
const nextStepBtn = document.getElementById('next-step');
const submitAnalysisBtn = document.getElementById('submit-analysis');

// Capture preview elements
const capturePreview = document.getElementById('capture-preview');
const previewCanvas = document.getElementById('preview-canvas');
const ocrResultElement = document.getElementById('ocr-result');
const closePreviewBtn = document.getElementById('close-preview');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');

// Utility functions
// Utility functions (no-op stubs for removed UI elements)
function addLog(message, type = 'info') {
    // Logs removed from UI - console only
    console.log(`[${type}] ${message}`);
}

function updateResponse(data) {
    // Response panel removed from UI
    console.log('Response:', data);
}

function updateServerStatus(status) {
    serverStatus.textContent = status;
    serverStatus.className = 'status-badge ' + 
        (status === 'Connected' ? 'connected' : 
         status === 'Checking...' ? 'checking' : 'disconnected');
}

function generateSessionId() {
    return 'client-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

function updateSessionUI() {
    sessionIdElement.textContent = analysisSession.sessionId || 'None';
    currentStepElement.textContent = `${analysisSession.currentStep}/${analysisSession.totalSteps}`;
    
    // Hide all buttons first
    startTrackingBtn.style.display = 'none';
    nextStepBtn.style.display = 'none';
    captureFrameBtn.style.display = 'none';
    submitAnalysisBtn.style.display = 'none';
    
    // Update step instruction overlay
    const stepInstruction = document.getElementById('step-instruction');
    const stepProgress = document.getElementById('step-progress');
    
    if (!analysisSession.isActive) {
        // Step 0: Not started
        startTrackingBtn.style.display = 'block';
        startTrackingBtn.disabled = false;
        if (stepInstruction) stepInstruction.textContent = 'Ready to begin';
        if (stepProgress) stepProgress.textContent = '';
    } else if (analysisSession.currentStep === 1) {
        // Step 1: Camera enabled
        nextStepBtn.style.display = 'block';
        nextStepBtn.disabled = !cameraEnabled;
        if (stepInstruction) stepInstruction.textContent = 'Camera Active';
        if (stepProgress) stepProgress.textContent = 'Click Next Step when ready';
    } else if (analysisSession.currentStep === 2) {
        // Step 2: Face centering
        nextStepBtn.style.display = 'block';
        nextStepBtn.disabled = !faceCentered;
        if (stepInstruction) stepInstruction.textContent = 'Center Your Face';
        if (stepProgress) stepProgress.textContent = faceCentered ? 'Face centered ✓' : 'Position your face in the center';
    } else if (analysisSession.currentStep === 3) {
        // Step 3: OCR capture
        captureFrameBtn.style.display = 'block';
        captureFrameBtn.disabled = !cameraEnabled;
        nextStepBtn.style.display = ocrRecognized ? 'block' : 'none';
        nextStepBtn.disabled = !ocrRecognized;
        if (stepInstruction) stepInstruction.textContent = 'Capture Product Label';
        if (stepProgress) stepProgress.textContent = ocrRecognized ? 'Product recognized ✓' : 'Show "TEST" label to camera';
    } else if (analysisSession.currentStep === 4) {
        // Step 4: Hand palm detection
        nextStepBtn.style.display = 'block';
        nextStepBtn.disabled = !palmUp;
        if (stepInstruction) stepInstruction.textContent = 'Show Palm';
        if (stepProgress) stepProgress.textContent = palmUp ? 'Palm detected ✓' : 'Show your palm with fingers down';
    } else if (analysisSession.currentStep === 5) {
        // Step 5: Face rubbing
        const allAreasRubbed = faceRubbingState.forehead.rubbed && 
                               faceRubbingState.leftSide.rubbed && 
                               faceRubbingState.rightSide.rubbed;
        submitAnalysisBtn.style.display = 'block';
        submitAnalysisBtn.disabled = !allAreasRubbed;
        if (stepInstruction) stepInstruction.textContent = 'Rub Face Areas';
        if (stepProgress) {
            const foreheadPercent = Math.min(100, Math.round((faceRubbingState.forehead.totalTime / RUBBING_DURATION_REQUIRED) * 100));
            const leftPercent = Math.min(100, Math.round((faceRubbingState.leftSide.totalTime / RUBBING_DURATION_REQUIRED) * 100));
            const rightPercent = Math.min(100, Math.round((faceRubbingState.rightSide.totalTime / RUBBING_DURATION_REQUIRED) * 100));
            stepProgress.textContent = `Forehead: ${faceRubbingState.forehead.rubbed ? '✓' : foreheadPercent + '%'} | Left: ${faceRubbingState.leftSide.rubbed ? '✓' : leftPercent + '%'} | Right: ${faceRubbingState.rightSide.rubbed ? '✓' : rightPercent + '%'}`;
        }
    }
}

// Client-side tracking simulation
function simulateTracking() {
    // Simulate detection results (in production, this would come from MediaPipe/YOLO)
    return {
        timestamp: new Date().toISOString(),
        step: analysisSession.currentStep,
        detections: {
            face: {
                detected: Math.random() > 0.2,
                confidence: 0.85 + Math.random() * 0.15,
                landmarks: Math.random() > 0.5 ? 68 : null
            },
            hands: {
                detected: Math.random() > 0.3,
                confidence: 0.80 + Math.random() * 0.20,
                count: Math.random() > 0.5 ? 2 : 1
            },
            product: {
                detected: Math.random() > 0.4,
                confidence: 0.75 + Math.random() * 0.25,
                position: {
                    x: Math.random(),
                    y: Math.random()
                }
            }
        },
        metrics: {
            application_duration: (Date.now() - analysisSession.startTime) / 1000,
            hand_face_distance: Math.random() * 100,
            application_accuracy: 0.70 + Math.random() * 0.30
        }
    };
}

// API functions
async function checkServer() {
    addLog('Checking Django server connection...');
    updateServerStatus('Checking...');
    
    try {
        const response = await fetch(`${DJANGO_SERVER_URL}/api/health/`, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }
        
        const data = await response.json();
        updateServerStatus('Connected');
        addLog('✅ Django server is online', 'success');
        updateResponse(data);
    } catch (error) {
        updateServerStatus('Disconnected');
        addLog('⚠️ Django server offline (can still track locally)', 'warning');
        updateResponse({ error: error.message, note: 'Client can operate offline' });
    }
}

async function startTracking() {
    // Initialize client-side session
    analysisSession = {
        sessionId: generateSessionId(),
        patientId: 'patient-' + Date.now(),
        startTime: Date.now(),
        trackingData: [],
        currentStep: 1,
        totalSteps: 5,
        isActive: true,
        metadata: {
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            source: 'web-client'
        },
        stepTimings: {
            step1: { startTime: Date.now(), endTime: null, duration: 0 },
            step2: { startTime: null, endTime: null, duration: 0 },
            step3: { startTime: null, endTime: null, duration: 0 },
            step4: { startTime: null, endTime: null, duration: 0 },
            step5: { startTime: null, endTime: null, duration: 0 }
        }
    };
    
    updateSessionUI();
    addLog(`✅ Tracking session started: ${analysisSession.sessionId}`, 'success');
    addLog('📊 All tracking is performed locally on this device', 'info');
    addLog('📹 Requesting camera access...', 'info');
    
    // Enable camera
    await enableCamera();
    
    updateResponse({
        message: 'Session started - tracking locally',
        session: analysisSession
    });
}

function nextStep() {
    if (!analysisSession.isActive) {
        addLog('⚠️ No active tracking session', 'warning');
        return;
    }
    
    if (analysisSession.currentStep >= analysisSession.totalSteps) {
        addLog('⚠️ Already at final step', 'warning');
        return;
    }
    
    // Step 2 requires face to be centered
    if (analysisSession.currentStep === 2 && !faceCentered) {
        addLog('⚠️ Please center your face in the frame first', 'warning');
        return;
    }
    
    // Step 3 requires OCR recognition
    if (analysisSession.currentStep === 3 && !ocrRecognized) {
        addLog('⚠️ Please capture a frame with product label showing "TEST"', 'warning');
        return;
    }
    
    // Step 4 requires hand palm detection
    if (analysisSession.currentStep === 4 && !palmUp) {
        addLog('⚠️ Please show your palm to the camera with fingers pointing down', 'warning');
        return;
    }
    
    // Step 5 requires all three face areas to be rubbed
    if (analysisSession.currentStep === 5) {
        const allAreasRubbed = faceRubbingState.forehead.rubbed && 
                               faceRubbingState.leftSide.rubbed && 
                               faceRubbingState.rightSide.rubbed;
        if (!allAreasRubbed) {
            addLog('⚠️ Please rub all three face areas (forehead, left, right) for 5 seconds each', 'warning');
            return;
        }
    }
    
    // End timing for current step
    const currentTime = Date.now();
    const stepKey = `step${analysisSession.currentStep}`;
    if (analysisSession.stepTimings[stepKey]) {
        analysisSession.stepTimings[stepKey].endTime = currentTime;
        analysisSession.stepTimings[stepKey].duration = 
            (currentTime - analysisSession.stepTimings[stepKey].startTime) / 1000; // in seconds
    }
    
    // Log step completion
    if (analysisSession.currentStep === 1) {
        addLog('✅ Step 1 completed: Camera feed established', 'success');
        addLog('👤 Step 2: Position your face in the center of the frame', 'info');
    } else if (analysisSession.currentStep === 2) {
        addLog('✅ Step 2 completed: Face centered in frame', 'success');
        addLog('📦 Step 3: Capture a frame showing product label with "TEST"', 'info');
    } else if (analysisSession.currentStep === 3) {
        addLog('✅ Step 3 completed: Product label recognized', 'success');
        addLog('✋ Step 4: Show your palm to the camera with fingers pointing down', 'info');
    } else if (analysisSession.currentStep === 4) {
        addLog('✅ Step 4 completed: Hand palm detected', 'success');
        addLog('💆 Step 5: Rub your forehead, left cheek, and right cheek with your hand (5 seconds each)', 'info');
    } else if (analysisSession.currentStep === 5) {
        addLog('✅ Step 5 completed: All face areas rubbed', 'success');
        addLog('🎉 All steps completed! You can now submit your analysis', 'success');
    }
    
    analysisSession.currentStep++;
    addLog(`📍 Moving to step ${analysisSession.currentStep}/${analysisSession.totalSteps}`);
    
    // Start timing for next step
    const nextStepKey = `step${analysisSession.currentStep}`;
    if (analysisSession.stepTimings[nextStepKey]) {
        analysisSession.stepTimings[nextStepKey].startTime = currentTime;
    }
    
    // Record tracking data with face position
    const stepData = {
        timestamp: new Date().toISOString(),
        step: analysisSession.currentStep - 1,
        faceDetected: faceDetected,
        faceCentered: faceCentered,
        facePosition: { ...facePosition },
        ...simulateTracking()
    };
    analysisSession.trackingData.push(stepData);
    
    updateSessionUI();
    updateResponse({
        message: 'Step completed',
        currentStep: analysisSession.currentStep,
        stepData: stepData
    });
}

async function submitAnalysis() {
    if (!analysisSession.isActive) {
        addLog('⚠️ No active tracking session', 'warning');
        return;
    }
    
    // End timing for step 5
    const currentTime = Date.now();
    if (analysisSession.stepTimings.step5.startTime && !analysisSession.stepTimings.step5.endTime) {
        analysisSession.stepTimings.step5.endTime = currentTime;
        analysisSession.stepTimings.step5.duration = 
            (currentTime - analysisSession.stepTimings.step5.startTime) / 1000; // in seconds
    }
    
    // Prepare final analysis results
    const analysisResults = {
        session_id: analysisSession.sessionId,
        patient_id: analysisSession.patientId,
        analysis_timestamp: new Date().toISOString(),
        session_duration_seconds: (Date.now() - analysisSession.startTime) / 1000,
        total_steps: analysisSession.totalSteps,
        completed_steps: analysisSession.currentStep,
        
        // Step-by-step timing data
        step_timings: {
            step1_camera_activation: {
                duration_seconds: analysisSession.stepTimings.step1.duration,
                start_time: new Date(analysisSession.stepTimings.step1.startTime).toISOString(),
                end_time: analysisSession.stepTimings.step1.endTime ? new Date(analysisSession.stepTimings.step1.endTime).toISOString() : null
            },
            step2_face_centering: {
                duration_seconds: analysisSession.stepTimings.step2.duration,
                start_time: analysisSession.stepTimings.step2.startTime ? new Date(analysisSession.stepTimings.step2.startTime).toISOString() : null,
                end_time: analysisSession.stepTimings.step2.endTime ? new Date(analysisSession.stepTimings.step2.endTime).toISOString() : null
            },
            step3_ocr_capture: {
                duration_seconds: analysisSession.stepTimings.step3.duration,
                start_time: analysisSession.stepTimings.step3.startTime ? new Date(analysisSession.stepTimings.step3.startTime).toISOString() : null,
                end_time: analysisSession.stepTimings.step3.endTime ? new Date(analysisSession.stepTimings.step3.endTime).toISOString() : null
            },
            step4_palm_detection: {
                duration_seconds: analysisSession.stepTimings.step4.duration,
                start_time: analysisSession.stepTimings.step4.startTime ? new Date(analysisSession.stepTimings.step4.startTime).toISOString() : null,
                end_time: analysisSession.stepTimings.step4.endTime ? new Date(analysisSession.stepTimings.step4.endTime).toISOString() : null
            },
            step5_face_rubbing: {
                duration_seconds: analysisSession.stepTimings.step5.duration,
                start_time: analysisSession.stepTimings.step5.startTime ? new Date(analysisSession.stepTimings.step5.startTime).toISOString() : null,
                end_time: analysisSession.stepTimings.step5.endTime ? new Date(analysisSession.stepTimings.step5.endTime).toISOString() : null,
                // Detailed face rubbing data
                rubbing_details: {
                    forehead: {
                        time_spent_seconds: faceRubbingState.forehead.totalTime / 1000,
                        completed: faceRubbingState.forehead.rubbed
                    },
                    left_cheek: {
                        time_spent_seconds: faceRubbingState.leftSide.totalTime / 1000,
                        completed: faceRubbingState.leftSide.rubbed
                    },
                    right_cheek: {
                        time_spent_seconds: faceRubbingState.rightSide.totalTime / 1000,
                        completed: faceRubbingState.rightSide.rubbed
                    },
                    total_rubbing_time_seconds: (faceRubbingState.forehead.totalTime + 
                                                 faceRubbingState.leftSide.totalTime + 
                                                 faceRubbingState.rightSide.totalTime) / 1000,
                    all_areas_completed: faceRubbingState.forehead.rubbed && 
                                       faceRubbingState.leftSide.rubbed && 
                                       faceRubbingState.rightSide.rubbed
                }
            }
        },
        
        // Aggregate metrics from all tracking data
        summary: {
            total_frames_analyzed: analysisSession.trackingData.length,
            face_detection_rate: analysisSession.trackingData.filter(d => d.detections.face.detected).length / analysisSession.trackingData.length,
            hand_detection_rate: analysisSession.trackingData.filter(d => d.detections.hands.detected).length / analysisSession.trackingData.length,
            product_detection_rate: analysisSession.trackingData.filter(d => d.detections.product.detected).length / analysisSession.trackingData.length,
            average_application_accuracy: analysisSession.trackingData.reduce((sum, d) => sum + d.metrics.application_accuracy, 0) / analysisSession.trackingData.length
        },
        
        // Detailed step-by-step data
        step_data: analysisSession.trackingData,
        
        // Session metadata
        metadata: analysisSession.metadata,
        
        // Overall assessment
        assessment: {
            completed: analysisSession.currentStep === analysisSession.totalSteps,
            quality_score: 0.70 + Math.random() * 0.30,
            issues_detected: [],
            recommendations: []
        }
    };
    
    addLog('📤 Submitting analysis results to Django server...');
    
    // Add client-side timestamp
    analysisResults.client_submitted_at = new Date().toISOString();
    
    try {
        const response = await fetch(`${DJANGO_SERVER_URL}/api/analysis/submit/`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(analysisResults)
        });
        
        if (!response.ok) {
            // If server returns error status, try to parse error message
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server responded with status ${response.status}`);
        }
        
        const data = await response.json();
        addLog(`✅ Analysis submitted successfully to Django server!`, 'success');
        updateResponse(data);
    } catch (error) {
        addLog('❌ Failed to submit analysis: ' + error.message, 'error');
        addLog('💾 Analysis saved locally (can retry later)', 'info');
        
        // Save to localStorage as backup
        try {
            const savedAnalyses = JSON.parse(localStorage.getItem('medichek_analyses') || '[]');
            savedAnalyses.push(analysisResults);
            localStorage.setItem('medichek_analyses', JSON.stringify(savedAnalyses));
            addLog('💾 Analysis saved to browser storage', 'info');
        } catch (storageError) {
            console.error('Failed to save to localStorage:', storageError);
        }
        
        updateResponse({ 
            error: error.message,
            localData: analysisResults,
            note: 'Analysis saved locally - you can retry submission later'
        });
    }
}

// Frame capture and OCR functionality
async function captureFrame() {
    if (analysisSession.currentStep !== 3) {
        addLog('⚠️ Frame capture only available on Step 3', 'warning');
        return;
    }
    
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
    
    // Capture the current frame (un-mirrored for OCR)
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = webcam.videoWidth;
    captureCanvas.height = webcam.videoHeight;
    const ctx = captureCanvas.getContext('2d');
    
    // Draw video frame WITHOUT mirroring (correct orientation for OCR)
    ctx.drawImage(webcam, 0, 0, captureCanvas.width, captureCanvas.height);
    
    capturedImageData = captureCanvas.toDataURL('image/png');
    
    addLog('✅ Frame captured!', 'success');
    addLog('🔍 Analyzing with OCR...', 'info');
    
    // Show preview (mirror it for display to match what user saw)
    capturePreview.style.display = 'block';
    const previewCtx = previewCanvas.getContext('2d');
    previewCanvas.width = captureCanvas.width;
    previewCanvas.height = captureCanvas.height;
    
    // Mirror the preview to match what user saw on screen
    previewCtx.save();
    previewCtx.scale(-1, 1);
    previewCtx.drawImage(captureCanvas, -previewCanvas.width, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.restore();
    
    ocrResultElement.innerHTML = '<div style="color: #b0b0b0;">⏳ Analyzing image with OCR...</div>';
    
    // Perform OCR on the un-mirrored image
    await performOCR(captureCanvas);
}

async function performOCR(canvas) {
    try {
        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        
        const { data: { text, confidence } } = await worker.recognize(canvas);
        await worker.terminate();
        
        addLog(`📄 OCR Text: ${text.trim()}`, 'info');
        
        // Check if "TEST" is in the recognized text (case-insensitive)
        const recognizedText = text.toUpperCase();
        const containsTest = recognizedText.includes('TEST');
        
        if (containsTest) {
            ocrRecognized = true;
            addLog('✅ Product label "TEST" recognized!', 'success');
            ocrResultElement.innerHTML = `
                <div style="color: #00ff00; margin-bottom: 10px;">✅ <strong>RECOGNIZED: "TEST"</strong></div>
                <div style="color: #b0b0b0; font-size: 0.85em;">
                    <strong>Full Text:</strong><br>${text.trim() || '(empty)'}
                </div>
                <div style="color: #888; font-size: 0.8em; margin-top: 8px;">
                    Confidence: ${confidence.toFixed(1)}%
                </div>
            `;
            
            // Update button state
            updateSessionUI();
        } else {
            ocrRecognized = false;
            addLog('❌ "TEST" not found in image. Try again.', 'error');
            ocrResultElement.innerHTML = `
                <div style="color: #ff6b00; margin-bottom: 10px;">❌ <strong>"TEST" not found</strong></div>
                <div style="color: #b0b0b0; font-size: 0.85em;">
                    <strong>Recognized Text:</strong><br>${text.trim() || '(no text detected)'}
                </div>
                <div style="color: #888; font-size: 0.8em; margin-top: 8px;">
                    Confidence: ${confidence.toFixed(1)}%
                </div>
                <div style="color: #b0b0b0; font-size: 0.85em; margin-top: 10px;">
                    💡 Make sure "TEST" is clearly visible in the frame
                </div>
            `;
        }
        
        // Store OCR result in tracking data
        analysisSession.trackingData.push({
            timestamp: new Date().toISOString(),
            step: 3,
            type: 'ocr_capture',
            recognized: containsTest,
            text: text.trim(),
            confidence: confidence,
            imageData: capturedImageData
        });
        
    } catch (error) {
        addLog('❌ OCR failed: ' + error.message, 'error');
        ocrResultElement.innerHTML = `
            <div style="color: #ff0000;">❌ <strong>OCR Error</strong></div>
            <div style="color: #b0b0b0; font-size: 0.85em; margin-top: 5px;">
                ${error.message}
            </div>
        `;
    }
}

function closePreview() {
    capturePreview.style.display = 'none';
}

// Debug functions to skip to specific steps
// Event listeners
startTrackingBtn.addEventListener('click', startTracking);
captureFrameBtn.addEventListener('click', captureFrame);
nextStepBtn.addEventListener('click', nextStep);
submitAnalysisBtn.addEventListener('click', submitAnalysis);
closePreviewBtn.addEventListener('click', closePreview);

// Initialize
window.addEventListener('load', () => {
    updateSessionUI();
    checkServer();
});

// Webcam and canvas elements
const webcam = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');

// Initialize MediaPipe Face Detection
function initializeFaceDetection() {
    addLog('🤖 Initializing MediaPipe Face Detection...', 'info');
    
    faceDetection = new FaceDetection({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
        }
    });
    
    faceDetection.setOptions({
        model: 'short',
        minDetectionConfidence: 0.5
    });
    
    faceDetection.onResults(onFaceDetectionResults);
    
    addLog('✅ Face detection initialized', 'success');
}

// Initialize MediaPipe Hands
function initializeHandsDetection() {
    addLog('🤖 Initializing MediaPipe Hands Detection...', 'info');
    
    handsDetection = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });
    
    handsDetection.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    handsDetection.onResults(onHandsDetectionResults);
    
    addLog('✅ Hands detection initialized', 'success');
}

// Initialize MediaPipe Face Mesh (for Step 5)
function initializeFaceMesh() {
    addLog('🤖 Initializing MediaPipe Face Mesh...', 'info');
    
    faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });
    
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    faceMesh.onResults(onFaceMeshResults);
    
    addLog('✅ Face mesh initialized', 'success');
}

// Face Mesh results callback
function onFaceMeshResults(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        faceMeshLandmarks = results.multiFaceLandmarks[0];
        
        // Only process for Step 5
        if (analysisSession.currentStep === 5) {
            // Initialize canvas context if needed
            if (!canvasCtx) {
                canvas.width = webcam.videoWidth;
                canvas.height = webcam.videoHeight;
                canvasCtx = canvas.getContext('2d');
            }
            
            // Clear and draw video frame
            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
            
            // Check face rubbing if hand is detected
            if (handLandmarks) {
                checkFaceRubbing(faceMeshLandmarks, handLandmarks);
            }
            
            // Draw overlay on canvas
            drawFaceMeshOverlay(faceMeshLandmarks, handLandmarks);
            
            canvasCtx.restore();
        }
    }
}

// Check if hand is rubbing face areas
function checkFaceRubbing(faceLandmarks, handLandmarks) {
    // Define face regions using key landmarks
    // Face mesh has 468 landmarks
    
    // Forehead region: landmarks around 10 (top of face)
    const foreheadCenter = faceLandmarks[10];
    
    // Left cheek: landmark 50 (mid-left cheek area)
    const leftCheek = faceLandmarks[50];
    
    // Right cheek: landmark 280 (mid-right cheek area)
    const rightCheek = faceLandmarks[280];
    
    // Get hand center position (average of fingertips)
    const handCenter = {
        x: (handLandmarks[4].x + handLandmarks[8].x + handLandmarks[12].x + handLandmarks[16].x + handLandmarks[20].x) / 5,
        y: (handLandmarks[4].y + handLandmarks[8].y + handLandmarks[12].y + handLandmarks[16].y + handLandmarks[20].y) / 5
    };
    
    // Check distance to each face region
    const distanceToForehead = Math.sqrt(
        Math.pow(handCenter.x - foreheadCenter.x, 2) + 
        Math.pow(handCenter.y - foreheadCenter.y, 2)
    );
    
    const distanceToLeftCheek = Math.sqrt(
        Math.pow(handCenter.x - leftCheek.x, 2) + 
        Math.pow(handCenter.y - leftCheek.y, 2)
    );
    
    const distanceToRightCheek = Math.sqrt(
        Math.pow(handCenter.x - rightCheek.x, 2) + 
        Math.pow(handCenter.y - rightCheek.y, 2)
    );
    
    const proximityThreshold = 0.10; // Reduced threshold to prevent overlap between regions
    const currentTime = Date.now();
    
    // Check forehead
    if (distanceToForehead < proximityThreshold) {
        trackRubbingMotion('forehead', handCenter, currentTime);
    } else {
        resetRubbingTimer('forehead', currentTime);
    }
    
    // Check left cheek
    if (distanceToLeftCheek < proximityThreshold) {
        trackRubbingMotion('leftSide', handCenter, currentTime);
    } else {
        resetRubbingTimer('leftSide', currentTime);
    }
    
    // Check right cheek
    if (distanceToRightCheek < proximityThreshold) {
        trackRubbingMotion('rightSide', handCenter, currentTime);
    } else {
        resetRubbingTimer('rightSide', currentTime);
    }
    
    // Update UI
    updateFaceRubbingUI();
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

// Reset rubbing timer when hand moves away
// Reset rubbing timer when hand moves away
function resetRubbingTimer(area, currentTime) {
    const state = faceRubbingState[area];
    // Only reset lastUpdateTime to pause timer, keep totalTime accumulated
    state.lastUpdateTime = null;
    state.lastHandPos = null;
}

// Update face rubbing UI
// Update face rubbing UI
function updateFaceRubbingUI() {
    // Update through the main UI update function which now handles step 5 display
    if (analysisSession.currentStep === 5) {
        updateSessionUI();
    }
}

// Hands detection results callback
function onHandsDetectionResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handDetected = true;
        handLandmarks = results.multiHandLandmarks[0];
        
        // Get handedness (Left or Right)
        const handedness = results.multiHandedness && results.multiHandedness[0] 
            ? results.multiHandedness[0].label 
            : null;
        
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
        
        palmUp = fingersDown && palmFacing && palmUpright;
        
        // Draw hand landmarks on Step 4
        if (analysisSession.currentStep === 4 && canvasCtx) {
            drawHandLandmarks(results);
        }
        
        // Update button state in real-time for step 4
        if (analysisSession.currentStep === 4) {
            updateSessionUI();
        }
    } else {
        handDetected = false;
        palmUp = false;
        handLandmarks = null;
        
        // Update button state in real-time for step 4
        if (analysisSession.currentStep === 4) {
            updateSessionUI();
        }
    }
}

// Draw hand landmarks on canvas
function drawHandLandmarks(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;
    
    const landmarks = results.multiHandLandmarks[0];
    
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

// Draw face mesh landmarks and rubbing zones on canvas (Step 5)
function drawFaceMeshOverlay(faceLandmarks, handLandmarks) {
    if (!canvasCtx || !faceLandmarks) return;
    
    // Define face region centers (mid-cheek landmarks for good separation)
    const foreheadCenter = faceLandmarks[10];
    const leftCheek = faceLandmarks[50];  // Mid-left cheek
    const rightCheek = faceLandmarks[280]; // Mid-right cheek
    
    const regions = [
        { name: 'forehead', center: foreheadCenter, state: faceRubbingState.forehead },
        { name: 'leftSide', center: leftCheek, state: faceRubbingState.leftSide },
        { name: 'rightSide', center: rightCheek, state: faceRubbingState.rightSide }
    ];
    
    // Draw region circles
    regions.forEach(region => {
        const x = region.center.x * canvas.width;
        const y = region.center.y * canvas.height;
        const radius = 50;
        
        // Set color based on rubbing state
        if (region.state.rubbed) {
            canvasCtx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            canvasCtx.strokeStyle = '#00ff00';
        } else if (region.state.totalTime > 0) {
            const progress = region.state.totalTime / RUBBING_DURATION_REQUIRED;
            canvasCtx.fillStyle = `rgba(255, 165, 0, ${0.3 * progress})`;
            canvasCtx.strokeStyle = '#ff6b00';
        } else {
            canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            canvasCtx.strokeStyle = '#ffffff';
        }
        
        // Draw circle
        canvasCtx.lineWidth = 3;
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, radius, 0, 2 * Math.PI);
        canvasCtx.fill();
        canvasCtx.stroke();
        
        // Draw progress arc
        if (region.state.totalTime > 0 && !region.state.rubbed) {
            const progress = region.state.totalTime / RUBBING_DURATION_REQUIRED;
            canvasCtx.strokeStyle = '#00ff00';
            canvasCtx.lineWidth = 5;
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, radius + 10, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * progress));
            canvasCtx.stroke();
        }
    });
    
    // Draw hand landmarks
    if (handLandmarks) {
        canvasCtx.strokeStyle = '#00ffff';
        canvasCtx.lineWidth = 2;
        canvasCtx.fillStyle = '#00ffff';
        
        handLandmarks.forEach((landmark) => {
            canvasCtx.beginPath();
            canvasCtx.arc(
                landmark.x * canvas.width,
                landmark.y * canvas.height,
                4,
                0,
                2 * Math.PI
            );
            canvasCtx.fill();
        });
    }
}

// Face detection results callback
function onFaceDetectionResults(results) {
    // Skip drawing on Step 5 (face mesh handles it)
    if (analysisSession.currentStep === 5) {
        return;
    }
    
    // Get canvas context
    if (!canvasCtx) {
        canvas.width = webcam.videoWidth;
        canvas.height = webcam.videoHeight;
        canvasCtx = canvas.getContext('2d');
    }
    
    // Clear canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the video frame
    canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    
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
        
        // Only draw visualizations on Step 2
        if (analysisSession.currentStep === 2) {
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
        
        // Update button state in real-time for step 2
        if (analysisSession.currentStep === 2) {
            updateSessionUI(); // Enable/disable next step button based on face centering
        }
    } else {
        faceDetected = false;
        faceCentered = false;
        
        // Update button state in real-time for step 2
        if (analysisSession.currentStep === 2) {
            updateSessionUI(); // Disable next step button if face not detected
        }
    }
    
    canvasCtx.restore();
}

// Camera management
async function enableCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addLog('❌ Camera not supported in this browser', 'error');
        return false;
    }
    
    try {
        addLog('📹 Requesting camera access...', 'info');
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            } 
        });
        
        webcam.srcObject = stream;
        videoStream = stream;
        cameraEnabled = true;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            webcam.onloadedmetadata = () => {
                webcam.play();
                resolve();
            };
        });
        
        addLog('📹 Camera enabled successfully!', 'success');
        
        // Initialize MediaPipe Face Detection
        initializeFaceDetection();
        
        // Initialize MediaPipe Hands Detection
        initializeHandsDetection();
        
        // Initialize MediaPipe Face Mesh (for Step 5)
        initializeFaceMesh();
        
        // Start camera processing with MediaPipe
        camera = new Camera(webcam, {
            onFrame: async () => {
                // Process face detection (for Step 2)
                await faceDetection.send({image: webcam});
                
                // Process hands detection (for Step 4 and 5)
                await handsDetection.send({image: webcam});
                
                // Process face mesh (for Step 5)
                if (analysisSession.currentStep === 5) {
                    await faceMesh.send({image: webcam});
                }
            },
            width: 1280,
            height: 720
        });
        
        await camera.start();
        addLog('🎥 Face tracking started', 'success');
        addLog('✋ Hand tracking started', 'success');
        addLog('✅ Step 1: Video feed established - Click "Next Step" to continue', 'success');
        
        // Update UI
        updateSessionUI();
        
        return true;
    } catch (err) {
        addLog('❌ Camera access denied: ' + err.message, 'error');
        addLog('⚠️ Cannot proceed without camera access', 'warning');
        cameraEnabled = false;
        updateSessionUI();
        
        updateResponse({
            error: 'Camera access required',
            message: err.message,
            help: 'Please grant camera permissions and try again'
        });
        
        return false;
    }
}

