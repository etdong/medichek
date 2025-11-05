// Configuration - use external config if available, otherwise fallback
const DJANGO_SERVER_URL = (window.MedichekConfig && window.MedichekConfig.getDjangoUrl()) 
    || 'http://127.0.0.1:8000';

// Global state - Client-side only, no server sessions
let analysisSession = {
    sessionId: null,
    startTime: null,
    currentStep: 0,
    totalSteps: 3,  // Only tracking OCR, Palm Detection, and Face Rubbing
    isActive: false,
    stepTimings: {
        step1: { startTime: null, endTime: null, duration: 0 },  // OCR Capture (was step3)
        step2: { startTime: null, endTime: null, duration: 0 },  // Palm Detection (was step4)
        step3: { startTime: null, endTime: null, duration: 0 }   // Face Rubbing (was step5)
    }
};

let cameraEnabled = false;
let videoStream = null;

// MinIO uploaded file URLs (populated after upload)
let uploadedFileUrls = null;

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
let handLandmarks = [];  // Array to store multiple detected hands

// Step 2: Palm detection tracking
let palmDetectionState = {
    detected: false,
    startTime: null,
    totalTime: 0,
    completed: false
};
const PALM_DETECTION_REQUIRED = 2000; // 2 seconds in milliseconds

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
let ocrSkipped = false;
let capturedImageData = null;

// Automatic OCR scanning
let autoOcrInterval = null;

// Store captured frames for download
let step3CapturedFrameBlob = null;
let step4CapturedFrameBlob = null;

// OCR capture area (centered square for product/text placement)
const OCR_CAPTURE_AREA = {
    sizePercent: 0.4,   // 40% of canvas (square area for better OCR)
    get widthPercent() { return this.sizePercent; },
    get heightPercent() { return this.sizePercent; },
    get x() { return (1 - this.widthPercent) / 2; },  // Centered horizontally
    get y() { return (1 - this.heightPercent) / 2; }  // Centered vertically
};

// Video recording state
let mediaRecorder = null;
let recordedChunks = [];
let currentStepRecording = null;
let stepRecordings = {
    step1: null,
    step2: null,
    step3: null,
    step4: null,
    step5: null
};
let recordingConsent = false;

// DOM elements
const serverStatus = document.getElementById('server-status');
const sessionIdElement = document.getElementById('session-id');
const currentStepElement = document.getElementById('current-step');

// Buttons
const startTrackingBtn = document.getElementById('start-tracking');
const captureFrameBtn = document.getElementById('capture-frame');
const nextStepBtn = document.getElementById('next-step');
const submitAnalysisBtn = document.getElementById('submit-analysis');

// Modal elements
const ocrFailModal = document.getElementById('ocr-fail-modal');
const retryOcrBtn = document.getElementById('retry-ocr');
const continueAnywayBtn = document.getElementById('continue-anyway');

// Captured frame elements (split display for step 3 and step 4)
const capturedFrameArea = document.getElementById('captured-frame-area');
const step3FrameCanvas = document.getElementById('step3-frame-canvas');
const step4FrameCanvas = document.getElementById('step4-frame-canvas');
const step3FrameSlot = document.getElementById('step3-frame-slot');
const step4FrameSlot = document.getElementById('step4-frame-slot');
const ocrResultCompact = document.getElementById('ocr-result-compact');
const ocrStatusBadge = document.getElementById('ocr-status');
const palmStatusBadge = document.getElementById('palm-status');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');

// Warning toast
const warningToast = document.getElementById('warning-toast');
let toastTimeout = null;

// Hand bounds warning
const handBoundsWarning = document.getElementById('hand-bounds-warning');
let handBoundsWarningTimeout = null;

// OCR analysis overlay
const ocrAnalysisOverlay = document.getElementById('ocr-analysis-overlay');

// Upload overlay and completion screen
const uploadOverlay = document.getElementById('upload-overlay');
const downloadOverlay = document.getElementById('download-overlay');
const completionScreen = document.getElementById('completion-screen');
const completionIcon = document.getElementById('completion-icon');
const completionTitle = document.getElementById('completion-title');
const completionMessage = document.getElementById('completion-message');
const completionDetails = document.getElementById('completion-details');
const startNewSessionBtn = document.getElementById('start-new-session-btn');

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

function showWarningToast(message, duration = 3000) {
    // Update message if provided
    if (message) {
        const toastMessage = warningToast.querySelector('.toast-message');
        if (toastMessage) {
            toastMessage.textContent = message;
        }
    }
    
    // Clear any existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    // Show toast
    warningToast.classList.add('show');
    
    // Auto-hide after duration
    toastTimeout = setTimeout(() => {
        warningToast.classList.remove('show');
    }, duration);
}

function hideWarningToast() {
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    warningToast.classList.remove('show');
}

function showHandBoundsWarning() {
    // Clear any existing timeout
    if (handBoundsWarningTimeout) {
        clearTimeout(handBoundsWarningTimeout);
    }
    
    // Show warning
    handBoundsWarning.classList.add('show');
    
    // Auto-hide after 2 seconds
    handBoundsWarningTimeout = setTimeout(() => {
        handBoundsWarning.classList.remove('show');
    }, 2000);
}

function hideHandBoundsWarning() {
    if (handBoundsWarningTimeout) {
        clearTimeout(handBoundsWarningTimeout);
        handBoundsWarningTimeout = null;
    }
    handBoundsWarning.classList.remove('show');
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
        // Not started yet
        startTrackingBtn.style.display = 'block';
        startTrackingBtn.disabled = false;
        if (stepInstruction) stepInstruction.textContent = 'Ready to begin';
        if (stepProgress) stepProgress.textContent = '';
    } else if (analysisSession.currentStep === 0) {
        // Step 0: Preliminaries (camera + face centering)
        nextStepBtn.style.display = 'block';
        nextStepBtn.disabled = !cameraEnabled || !faceCentered;
        if (stepInstruction) stepInstruction.textContent = 'Preliminaries: Camera & Face Centering';
        if (stepProgress) {
            if (!cameraEnabled) {
                stepProgress.textContent = 'Activating camera...';
            } else if (!faceCentered) {
                stepProgress.textContent = 'Position your face in the center';
            } else {
                stepProgress.textContent = 'Camera ready ✓ Face centered ✓ - Ready to begin';
            }
        }
    } else if (analysisSession.currentStep === 1) {
        // Step 1: OCR capture with auto-scanning
        captureFrameBtn.style.display = 'block';
        captureFrameBtn.disabled = !cameraEnabled;
        
        if (stepInstruction) stepInstruction.textContent = 'Step 1: Capture Product Label';
        if (stepProgress) {
            if (ocrRecognized) {
                stepProgress.textContent = 'Product recognized ✓ - Advancing...';
            } else if (ocrSkipped) {
                stepProgress.textContent = 'Proceeding with manual review - Advancing...';
            } else {
                stepProgress.textContent = 'Show product label to camera (auto-scanning active)';
            }
        }
    } else if (analysisSession.currentStep === 2) {
        // Step 2: Palm detection (auto-advance, no next button)
        // Hide next step button - will auto-advance when palm detection completes
        if (stepInstruction) stepInstruction.textContent = 'Step 2: Show product in hand';
        if (stepProgress) {
            if (palmDetectionState.completed) {
                stepProgress.textContent = 'Detection complete ✓ - Advancing...';
            } else if (palmDetectionState.detected && palmDetectionState.totalTime > 0) {
                const progress = Math.min(100, Math.round((palmDetectionState.totalTime / PALM_DETECTION_REQUIRED) * 100));
                stepProgress.textContent = `Hold hand steady: ${progress}%`;
            } else {
                stepProgress.textContent = 'Show the product clearly in your hand';
            }
        }
    } else if (analysisSession.currentStep === 3) {
        // Step 3: Face rubbing
        const allAreasRubbed = faceRubbingState.forehead.rubbed && 
                               faceRubbingState.leftSide.rubbed && 
                               faceRubbingState.rightSide.rubbed;
        submitAnalysisBtn.style.display = 'block';
        submitAnalysisBtn.disabled = !allAreasRubbed;
        if (stepInstruction) stepInstruction.textContent = 'Step 3: Rub Face Areas';
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

// Video recording functions
function startStepRecording(stepNumber) {
    if (!videoStream || !recordingConsent) {
        addLog('⚠️ Cannot start recording: no video stream or consent', 'warning');
        return;
    }
    
    try {
        // Stop any existing recording
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopStepRecording();
        }
        
        // Reset chunks
        recordedChunks = [];
        currentStepRecording = stepNumber;
        
        // Create MediaRecorder with the video stream
        const options = { mimeType: 'video/webm;codecs=vp9' };
        
        // Fallback to vp8 if vp9 not supported
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm;codecs=vp8';
        }
        
        // Fallback to default if webm not supported
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm';
        }
        
        mediaRecorder = new MediaRecorder(videoStream, options);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            if (recordedChunks.length > 0) {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                stepRecordings[`step${currentStepRecording}`] = blob;
                addLog(`✅ Step ${currentStepRecording} recording saved (${(blob.size / 1024 / 1024).toFixed(2)} MB)`, 'success');
            }
        };
        
        mediaRecorder.start(100); // Collect data every 100ms
        addLog(`🎥 Recording started for Step ${stepNumber}`, 'info');
        
    } catch (error) {
        addLog(`❌ Failed to start recording: ${error.message}`, 'error');
        console.error('Recording error:', error);
    }
}

function stopStepRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        addLog(`⏹️ Recording stopped for Step ${currentStepRecording}`, 'info');
    }
}

// MinIO Upload Function
async function uploadToMinIO(analysisData) {
    if (!MedichekConfig.minIO.enabled) {
        addLog('⚠️ MinIO upload is disabled, downloading locally instead', 'warning');
        downloadAllRecordings();
        showCompletionScreen(false, 'Files downloaded locally', 'MinIO upload is disabled. Your files have been downloaded to your device.');
        return;
    }
    
    // Show upload overlay
    uploadOverlay.style.display = 'flex';
    
    addLog('☁️ Uploading all recordings and data to MinIO...', 'info');
    
    try {
        // Configure AWS SDK to work with MinIO
        AWS.config.update({
            accessKeyId: MedichekConfig.minIO.accessKey,
            secretAccessKey: MedichekConfig.minIO.secretKey,
            region: MedichekConfig.minIO.region,
            s3ForcePathStyle: true, // Required for MinIO
            signatureVersion: 'v4'
        });
        
        // Create S3 client pointing to MinIO endpoint
        const s3 = new AWS.S3({
            endpoint: `${MedichekConfig.minIO.useSSL ? 'https' : 'http'}://${MedichekConfig.minIO.endPoint}:${MedichekConfig.minIO.port}`,
            s3ForcePathStyle: true,
            signatureVersion: 'v4'
        });
        
        const videosBucketName = MedichekConfig.minIO.videosBucketName;
        const imagesBucketName = MedichekConfig.minIO.imagesBucketName;
        const sessionId = analysisSession.sessionId;
        let uploadCount = 0;
        
        // Storage for MinIO file URLs (organized by step/file)
        const minioFileUrls = {
            step1_video: null,   // OCR Capture (was step3)
            step1_image: null,   // Product label image (was step3_image)
            step2_video: null,   // Palm Detection (was step4)
            step2_image: null,   // Palm detection image (was step4_image)
            step3_video: null    // Face Rubbing (was step5)
        };
        
        // Helper function to generate MinIO URL
        const getMinioUrl = (bucketName, objectKey) => {
            const protocol = MedichekConfig.minIO.useSSL ? 'https' : 'http';
            return `${protocol}://${MedichekConfig.minIO.endPoint}:${MedichekConfig.minIO.port}/${bucketName}/${objectKey}`;
        };
        
        // Check if videos bucket exists, create if needed
        try {
            await new Promise((resolve, reject) => {
                s3.headBucket({ Bucket: videosBucketName }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
        } catch (error) {
            if (error.statusCode === 404 || error.code === 'NotFound') {
                await new Promise((resolve, reject) => {
                    s3.createBucket({ Bucket: videosBucketName }, (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });
                addLog(`✅ Created bucket: ${videosBucketName}`, 'success');
            } else {
                throw error;
            }
        }
        
        // Check if images bucket exists, create if needed
        try {
            await new Promise((resolve, reject) => {
                s3.headBucket({ Bucket: imagesBucketName }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
        } catch (error) {
            if (error.statusCode === 404 || error.code === 'NotFound') {
                await new Promise((resolve, reject) => {
                    s3.createBucket({ Bucket: imagesBucketName }, (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });
                addLog(`✅ Created bucket: ${imagesBucketName}`, 'success');
            } else {
                throw error;
            }
        }
        
        // Upload video recordings to videos bucket (only steps 1-3 now)
        for (let i = 1; i <= 3; i++) {
            const stepKey = `step${i}`;
            const blob = stepRecordings[stepKey];
            
            if (blob) {
                const filename = `step${i}.webm`;
                const objectKey = MedichekConfig.minIO.getObjectKey(sessionId, filename);
                
                await new Promise((resolve, reject) => {
                    s3.putObject({
                        Bucket: videosBucketName,
                        Key: objectKey,
                        Body: blob,
                        ContentType: 'video/webm'
                    }, (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });
                
                // Store the MinIO URL for this step's video
                const videoUrl = getMinioUrl(videosBucketName, objectKey);
                minioFileUrls[`step${i}_video`] = {
                    filename: filename,
                    url: videoUrl,
                    uploaded_at: new Date().toISOString()
                };
                
                addLog(`✅ Uploaded ${filename} to videos bucket`, 'success');
                uploadCount++;
            }
        }
        
        // Upload step 1 (OCR) captured frame to images bucket
        if (step3CapturedFrameBlob) {
            const filename = 'step1_product_label.png';
            const objectKey = MedichekConfig.minIO.getObjectKey(sessionId, filename);
            
            await new Promise((resolve, reject) => {
                s3.putObject({
                    Bucket: imagesBucketName,
                    Key: objectKey,
                    Body: step3CapturedFrameBlob,
                    ContentType: 'image/png'
                }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
            
            // Store the MinIO URL for step 1 (OCR) image
            const imageUrl = getMinioUrl(imagesBucketName, objectKey);
            minioFileUrls.step1_image = {
                filename: filename,
                url: imageUrl,
                type: 'product_label',
                uploaded_at: new Date().toISOString()
            };
            
            addLog(`✅ Uploaded ${filename} to images bucket`, 'success');
            uploadCount++;
        }
        
        // Upload step 2 (Palm Detection) captured frame to images bucket
        if (step4CapturedFrameBlob) {
            const filename = 'step2_palm_detection.png';
            const objectKey = MedichekConfig.minIO.getObjectKey(sessionId, filename);
            
            await new Promise((resolve, reject) => {
                s3.putObject({
                    Bucket: imagesBucketName,
                    Key: objectKey,
                    Body: step4CapturedFrameBlob,
                    ContentType: 'image/png'
                }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
            
            // Store the MinIO URL for step 2 (Palm Detection) image
            const imageUrl = getMinioUrl(imagesBucketName, objectKey);
            minioFileUrls.step2_image = {
                filename: filename,
                url: imageUrl,
                type: 'palm_detection',
                uploaded_at: new Date().toISOString()
            };
            
            addLog(`✅ Uploaded ${filename} to images bucket`, 'success');
            uploadCount++;
        }
        
        // Include MinIO URLs for all uploaded files
        analysisData.minio_urls = minioFileUrls;
        
        // Get current date in YYYYMMDD format for display
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        
        addLog(`🎉 Successfully uploaded ${uploadCount} files to MinIO`, 'success');
        addLog(`📂 Videos bucket: ${videosBucketName}/${dateStr}/${sessionId}/`, 'info');
        addLog(`📂 Images bucket: ${imagesBucketName}/${dateStr}/${sessionId}/`, 'info');
        
        // Store URLs in global variable
        uploadedFileUrls = minioFileUrls;
        
        // Hide upload overlay
        uploadOverlay.style.display = 'none';
        
        // Show completion screen
        const details = `
            <div>Session ID: ${sessionId}</div>
            <div>Date: ${dateStr}</div>
            <div>Total files: ${uploadCount}</div>
        `;
        showCompletionScreen(true, 'Upload Successful!', 'All session data has been uploaded to MinIO.', details);
        
        // Return the URLs for use by other functions
        return minioFileUrls;
        
    } catch (error) {
        addLog(`❌ MinIO upload failed: ${error.message}`, 'error');
        console.error('MinIO upload error:', error);
        
        // Hide upload overlay
        uploadOverlay.style.display = 'none';
        
        // Fallback to local download
        addLog('⚠️ Falling back to local download...', 'warning');
        downloadAllRecordings();
        
        // Return null on error
        return null;
    }
}

function showCompletionScreen(success, title, message, details = '') {
    // Update completion screen content
    completionIcon.className = `completion-icon ${success ? 'success' : 'error'}`;
    completionTitle.textContent = title;
    completionMessage.textContent = message;
    completionDetails.innerHTML = details;
    
    // Show completion screen
    completionScreen.style.display = 'flex';
}

// Helper function to create analysis data object (used by upload, download, and submit)
function createAnalysisData() {
    return {
        session_id: analysisSession.sessionId,
        start_time: new Date(analysisSession.startTime).toISOString(),
        end_time: new Date().toISOString(),
        session_duration_seconds: (Date.now() - analysisSession.startTime) / 1000,
        total_steps: analysisSession.totalSteps,
        completed_steps: analysisSession.currentStep,
        ocrPassed: ocrRecognized,
        // Step-by-step timing data (duration only)
        step_timings: {
            step1_ocr_capture_seconds: analysisSession.stepTimings.step1.duration,
            step2_palm_detection_seconds: analysisSession.stepTimings.step2.duration,
            step3_face_rubbing_seconds: analysisSession.stepTimings.step3.duration,
            // Detailed face rubbing data for step 3
            step3_rubbing_details: {
                forehead_seconds: faceRubbingState.forehead.totalTime / 1000,
                left_cheek_seconds: faceRubbingState.leftSide.totalTime / 1000,
                right_cheek_seconds: faceRubbingState.rightSide.totalTime / 1000,
                total_rubbing_time_seconds: (faceRubbingState.forehead.totalTime + 
                                             faceRubbingState.leftSide.totalTime + 
                                             faceRubbingState.rightSide.totalTime) / 1000,
                all_areas_completed: faceRubbingState.forehead.rubbed && 
                                   faceRubbingState.leftSide.rubbed && 
                                   faceRubbingState.rightSide.rubbed
            }
        },
        
        // Session metadata
        metadata: analysisSession.metadata,
        
        // MinIO file URLs (if available)
        minio_urls: uploadedFileUrls || null
    };
}

function downloadAllRecordings() {
    addLog('📥 Creating zip file with all recordings and captured frames...', 'info');
    
    // Show download overlay
    downloadOverlay.style.display = 'flex';
    
    const zip = new JSZip();
    let fileCount = 0;
    
    // Add video recordings to zip (only steps 1-3 now)
    for (let i = 1; i <= 3; i++) {
        const stepKey = `step${i}`;
        const blob = stepRecordings[stepKey];
        
        if (blob) {
            zip.file(`step${i}.webm`, blob);
            fileCount++;
        }
    }
    
    // Add captured frame from step 1 (OCR - product label, if exists)
    if (step3CapturedFrameBlob) {
        zip.file('step1_product_label.png', step3CapturedFrameBlob);
        fileCount++;
    }
    
    // Add captured frame from step 2 (Palm Detection, if exists)
    if (step4CapturedFrameBlob) {
        zip.file('step2_palm_detection.png', step4CapturedFrameBlob);
        fileCount++;
    }
    
    // Add analysis metadata JSON
    const analysisData = createAnalysisData();
    
    // Add assessment data specific to download context
    analysisData.assessment = {
        completed: analysisSession.currentStep === analysisSession.totalSteps,
        quality_score: 0.70 + Math.random() * 0.30,
        issues_detected: [],
        recommendations: []
    };
    
    zip.file('analysis.json', JSON.stringify(analysisData, null, 2));
    fileCount++;
    
    if (fileCount > 1) { // More than just analysis.json
        // Generate zip file
        zip.generateAsync({ type: 'blob' }).then(function(zipBlob) {
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${analysisSession.sessionId}_${new Date().toISOString().replace(/:/g, '-')}.zip`;
            
            // Trigger download immediately
            document.body.appendChild(a);
            
            // Use requestAnimationFrame to ensure the element is rendered before clicking
            requestAnimationFrame(() => {
                a.click();
                
                // Give the browser time to start the download before cleanup
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    const videoCount = Object.values(stepRecordings).filter(Boolean).length;
                    const frameCount = (step3CapturedFrameBlob ? 1 : 0) + (step4CapturedFrameBlob ? 1 : 0);
                    addLog(`✅ Downloaded zip file with ${fileCount} files (${videoCount} videos + ${frameCount} frames + metadata)`, 'success');
                    
                    // Hide download overlay
                    downloadOverlay.style.display = 'none';
                    
                    // Show completion screen
                    const details = `
                        <div>Session ID: ${analysisSession.sessionId}</div>
                        <div>Total files: ${fileCount}</div>
                        <div>Videos: ${videoCount}, Images: ${frameCount}</div>
                    `;
                    showCompletionScreen(true, 'Download Successful!', 'All session data has been downloaded to your device.', details);
                }, 1000); // 1 second delay to ensure download starts
            });
        }).catch(function(error) {
            addLog(`❌ Failed to create zip file: ${error.message}`, 'error');
            console.error('Zip creation error:', error);
            
            // Hide download overlay
            downloadOverlay.style.display = 'none';
            
            // Show completion screen with error
            showCompletionScreen(false, 'Download Failed', `Failed to create zip file: ${error.message}`);
        });
    } else {
        addLog('⚠️ No recordings found to download', 'warning');
        
        // Hide download overlay
        downloadOverlay.style.display = 'none';
        
        // Show completion screen with warning
        showCompletionScreen(false, 'No Data to Download', 'No recordings were found to include in the download.');
    }
}

async function startTracking() {
    // Ask for recording consent
    const consent = confirm(
        'This application will record video of each step for quality assurance.\n\n' +
        'The videos will be saved to your device at the end of the session.\n\n' +
        'Do you consent to video recording?'
    );
    
    if (!consent) {
        addLog('❌ Video recording consent denied. Cannot proceed.', 'error');
        alert('Video recording is required to proceed with the tracking session.');
        return;
    }
    
    recordingConsent = true;
    addLog('✅ Video recording consent granted', 'success');
    
    // Initialize client-side session (currentStep starts at 0 for preliminaries)
    analysisSession = {
        sessionId: generateSessionId(),
        startTime: Date.now(),
        currentStep: 0,  // 0 = preliminaries (camera + face centering)
        totalSteps: 3,   // Only 3 actual steps now
        isActive: true,
        metadata: {
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            source: 'web-client',
            recordingConsent: true
        },
        stepTimings: {
            step1: { startTime: null, endTime: null, duration: 0 },  // OCR Capture
            step2: { startTime: null, endTime: null, duration: 0 },  // Palm Detection
            step3: { startTime: null, endTime: null, duration: 0 }   // Face Rubbing
        }
    };
    
    updateSessionUI();
    addLog(`✅ Tracking session started: ${analysisSession.sessionId}`, 'success');
    addLog('📊 All tracking is performed locally on this device', 'info');
    addLog('📹 Requesting camera access...', 'info');
    
    // Enable camera (preliminary step, not tracked)
    await enableCamera();
    
    // Note: Recording starts when moving from preliminaries to step 1
    
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
    
    // Preliminary step 0 (camera + face centering) requires face to be centered
    if (analysisSession.currentStep === 0 && !faceCentered) {
        addLog('⚠️ Please center your face in the frame first', 'warning');
        return;
    }
    
    // Step 1 (OCR) requires OCR recognition OR manual skip
    if (analysisSession.currentStep === 1 && !ocrRecognized && !ocrSkipped) {
        addLog('⚠️ Please capture a frame with the product label showing', 'warning');
        return;
    }
    
    // Step 2 (Palm Detection) requires palm detection for 2 seconds
    if (analysisSession.currentStep === 2 && !palmDetectionState.completed) {
        addLog('⚠️ Please show your palm to the camera with fingers pointing down for 2 seconds', 'warning');
        return;
    }
    
    // Step 3 (Face Rubbing) requires all three face areas to be rubbed
    if (analysisSession.currentStep === 3) {
        const allAreasRubbed = faceRubbingState.forehead.rubbed && 
                               faceRubbingState.leftSide.rubbed && 
                               faceRubbingState.rightSide.rubbed;
        if (!allAreasRubbed) {
            addLog('⚠️ Please rub all three face areas (forehead, left, right) for 5 seconds each', 'warning');
            return;
        }
    }
    
    // End timing for current step (only if we're past preliminaries)
    const currentTime = Date.now();
    if (analysisSession.currentStep > 0) {
        const stepKey = `step${analysisSession.currentStep}`;
        if (analysisSession.stepTimings[stepKey]) {
            analysisSession.stepTimings[stepKey].endTime = currentTime;
            analysisSession.stepTimings[stepKey].duration = 
                (currentTime - analysisSession.stepTimings[stepKey].startTime) / 1000; // in seconds
        }
    }
    
    // Stop recording for current step (only if we're past preliminaries)
    if (recordingConsent && analysisSession.currentStep > 0) {
        stopStepRecording();
    }
    
    // Log step completion
    if (analysisSession.currentStep === 0) {
        addLog('✅ Preliminaries completed: Camera ready and face centered', 'success');
        addLog('📦 Step 1: Capture a frame showing the product label', 'info');
    } else if (analysisSession.currentStep === 1) {
        addLog('✅ Step 1 completed: Product label recognized', 'success');
        addLog('✋ Step 2: Show your palm to the camera with fingers pointing down for 2 seconds', 'info');
    } else if (analysisSession.currentStep === 2) {
        addLog('✅ Step 2 completed: Hand palm detected for 2 seconds', 'success');
        addLog('💆 Step 3: Rub your forehead, left cheek, and right cheek with your hand (5 seconds each)', 'info');
    } else if (analysisSession.currentStep === 3) {
        addLog('✅ Step 3 completed: All face areas rubbed', 'success');
        addLog('🎉 All steps completed! You can now submit your analysis', 'success');
    }
    
    analysisSession.currentStep++;
    addLog(`📍 Moving to step ${analysisSession.currentStep}/${analysisSession.totalSteps}`);
    
    // Start auto-scanning when entering step 1 (OCR)
    if (analysisSession.currentStep === 1) {
        startAutoOcrScanning();
    } else {
        // Stop auto-scanning if leaving step 1
        stopAutoOcrScanning();
    }
    
    // Reset step-specific states when entering a new step
    if (analysisSession.currentStep === 2) {
        // Reset palm detection state when entering step 2 (palm detection)
        palmDetectionState.detected = false;
        palmDetectionState.startTime = null;
        palmDetectionState.totalTime = 0;
        palmDetectionState.completed = false;
    }
    
    // Start timing for next step (only if we're entering actual steps, not preliminaries)
    if (analysisSession.currentStep > 0) {
        const nextStepKey = `step${analysisSession.currentStep}`;
        if (analysisSession.stepTimings[nextStepKey]) {
            analysisSession.stepTimings[nextStepKey].startTime = currentTime;
        }
    }
    
    // Start recording for next step (only if we're entering actual steps)
    if (recordingConsent && analysisSession.currentStep > 0 && analysisSession.currentStep <= analysisSession.totalSteps) {
        // Small delay to ensure clean transition
        setTimeout(() => {
            startStepRecording(analysisSession.currentStep);
        }, 100);
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
    
    // Disable submit button to prevent duplicate submissions
    submitAnalysisBtn.disabled = true;
    
    // Stop recording step 3 (face rubbing)
    if (recordingConsent) {
        stopStepRecording();
        addLog('🎥 All recordings completed', 'success');
    }
    
    // End timing for step 3
    const currentTime = Date.now();
    if (analysisSession.stepTimings.step3.startTime && !analysisSession.stepTimings.step3.endTime) {
        analysisSession.stepTimings.step3.endTime = currentTime;
        analysisSession.stepTimings.step3.duration = 
            (currentTime - analysisSession.stepTimings.step3.startTime) / 1000; // in seconds
    }

    const analysisResults = createAnalysisData();

    analysisResults.assessment = {
        completed: analysisSession.currentStep === analysisSession.totalSteps,
        quality_score: 0.70 + Math.random() * 0.30,
        issues_detected: [],
        recommendations: []
    };
    
    // Upload to MinIO first if consent was given, to get the file URLs
    if (recordingConsent) {
        addLog('☁️ Uploading files to MinIO first...', 'info');
        try {
            const minioUrls = await uploadToMinIO(analysisResults);
            if (minioUrls) {
                addLog('✅ MinIO upload completed, URLs captured', 'success');
            }
        } catch (error) {
            addLog('⚠️ MinIO upload failed, continuing with Django submission', 'warning');
        }
    }
    
    addLog('📤 Submitting analysis results to Django server...');
    
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

// Auto-scanning OCR functionality
function startAutoOcrScanning() {
    if (autoOcrInterval) return; // Already running
    
    // Scan every 2 seconds
    autoOcrInterval = setInterval(async () => {
        if (analysisSession.currentStep !== 1 || ocrRecognized || ocrSkipped) {
            stopAutoOcrScanning();
            return;
        }
        
        await performAutoOcrScan();
    }, 1000);
    
    addLog('🔍 Auto-scanning for product label...', 'info');
}

function stopAutoOcrScanning() {
    if (autoOcrInterval) {
        clearInterval(autoOcrInterval);
        autoOcrInterval = null;
    }
}

async function performAutoOcrScan() {
    if (!webcam || !cameraEnabled) return;
    
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
        const { data: { text, confidence } } = await worker.recognize(captureCanvas);
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
            ocrRecognized = true;
            ocrStatusBadge.textContent = '✅ Recognized';
            ocrStatusBadge.className = 'ocr-status success';
            ocrResultCompact.innerHTML = '';
            
            addLog('✅ Product label recognized!', 'success');
            
            // Stop auto-scanning
            stopAutoOcrScanning();
            
            // Update UI
            updateSessionUI();
            
            // Auto-advance after short delay
            setTimeout(() => {
                nextStep();
            }, 1500);
        }
    } catch (error) {
        console.error('Auto OCR scan error:', error);
    }
}

// Frame capture and OCR functionality
async function captureFrame() {
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
    
    // Center the square
    const captureX = (webcam.videoWidth - squareSize) / 2;
    const captureY = (webcam.videoHeight - squareSize) / 2;
    const captureWidth = squareSize;
    const captureHeight = squareSize;
    
    // Capture only the designated area (un-mirrored for OCR)
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = captureWidth;
    captureCanvas.height = captureHeight;
    const ctx = captureCanvas.getContext('2d');
    
    // Draw only the capture area from video WITHOUT mirroring (correct orientation for OCR)
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
    ocrStatusBadge.textContent = '⏳ Analyzing...';
    ocrStatusBadge.className = 'ocr-status analyzing';
    ocrResultCompact.innerHTML = '';
    
    // Show OCR analysis overlay to prevent interaction
    ocrAnalysisOverlay.style.display = 'flex';
    
    // Perform OCR on the un-mirrored captured area
    await performOCR(captureCanvas);
}

async function performOCR(canvas) {
    try {
        const worker = await Tesseract.createWorker();
        
        const { data: { text, confidence } } = await worker.recognize(canvas);
        await worker.terminate();
        
        addLog(`📄 OCR Text: ${text.trim()}`, 'info');
        
        // Check if "TEST" is in the recognized text (case-insensitive)
        const recognizedText = text.toUpperCase();
        const containsTest = recognizedText.includes('TEST');
        
        if (containsTest) {
            ocrRecognized = true;
            addLog('✅ Product label recognized!', 'success');
            
            // Update compact display - only show success status
            ocrStatusBadge.textContent = '✅ Recognized';
            ocrStatusBadge.className = 'ocr-status success';
            ocrResultCompact.innerHTML = '';  // No detailed message
            
            // Hide OCR analysis overlay
            ocrAnalysisOverlay.style.display = 'none';
            
            // Update button state
            updateSessionUI();
            
            // Auto-advance to next step after a short delay
            addLog('⏭️ Auto-advancing to next step...', 'info');
            setTimeout(() => {
                nextStep();
            }, 1500); // 1.5 second delay to show success message
        } else {
            ocrRecognized = false;
            addLog('❌ Product label not found in image. Try again.', 'error');
            
            // Update compact display - only show failed status
            ocrStatusBadge.textContent = '❌ Not Found';
            ocrStatusBadge.className = 'ocr-status failed';
            ocrResultCompact.innerHTML = '';  // No detailed message
            
            // Hide OCR analysis overlay
            ocrAnalysisOverlay.style.display = 'none';
            
            // Show the modal for OCR failure
            ocrFailModal.style.display = 'flex';
        }
        
    } catch (error) {
        addLog('❌ OCR failed: ' + error.message, 'error');
        
        // Update compact display - only show error status
        ocrStatusBadge.textContent = '❌ Error';
        ocrStatusBadge.className = 'ocr-status failed';
        ocrResultCompact.innerHTML = '';  // No detailed error message
        
        // Hide OCR analysis overlay
        ocrAnalysisOverlay.style.display = 'none';
    }
}

// Capture frame for Step 2 (palm detection)
async function captureStep4Frame() {
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
    
    // Display the mirrored version in the preview
    const displayCanvas = step4FrameCanvas;
    displayCanvas.width = captureCanvas.width;
    displayCanvas.height = captureCanvas.height;
    const displayCtx = displayCanvas.getContext('2d');
    
    // Draw without mirroring so image appears correct
    displayCtx.drawImage(captureCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
    
    // Update status badge
    palmStatusBadge.textContent = '✅ Captured';
    palmStatusBadge.className = 'palm-status success';
    
    addLog('✅ Palm area captured!', 'success');
}

// Event listeners
startTrackingBtn.addEventListener('click', startTracking);
captureFrameBtn.addEventListener('click', captureFrame);
nextStepBtn.addEventListener('click', nextStep);
submitAnalysisBtn.addEventListener('click', submitAnalysis);

// Modal event handlers
retryOcrBtn.addEventListener('click', () => {
    // Hide the modal
    ocrFailModal.style.display = 'none';
    
    // Reset the captured frame state to allow new capture
    step3CapturedFrameBlob = null;
    ocrRecognized = false;
    ocrSkipped = false;
    
    // Re-enable capture button for retry
    captureFrameBtn.disabled = false;
    
    addLog('Retry OCR - Capture a new frame', 'info');
    
    // Update UI to allow recapture
    updateSessionUI();
});

continueAnywayBtn.addEventListener('click', () => {
    // Hide the modal
    ocrFailModal.style.display = 'none';
    
    // Mark as manually reviewed/skipped
    ocrSkipped = true;
    
    // Update the status badge to show manual review
    ocrStatusBadge.textContent = '⚠️ Review';
    ocrStatusBadge.className = 'ocr-status warning';
    
    addLog('OCR verification skipped - proceeding with manual review', 'warning');
    
    // Automatically advance to the next step
    nextStep();
});

// Start new session button
startNewSessionBtn.addEventListener('click', () => {
    // Reload the page to start fresh
    window.location.reload();
});

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
        maxNumHands: 2,  // Allow detection of up to 2 hands
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
        refineLandmarks: false,  // Disable for better performance (we don't need iris/lips detail)
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
        
        // Only process for Step 3 (Face Rubbing)
        if (analysisSession.currentStep === 3) {
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
            
            // Check face rubbing with all detected hands
            if (handLandmarks && handLandmarks.length > 0) {
                checkFaceRubbing(faceMeshLandmarks, handLandmarks);
            }
            
            // Draw overlay on canvas
            drawFaceMeshOverlay(faceMeshLandmarks, handLandmarks);
            
            canvasCtx.restore();
        }
    }
}

// Check if hand is rubbing face areas
function checkFaceRubbing(faceLandmarks, allHandLandmarks) {
    // Define face regions using key landmarks
    // Face mesh has 468 landmarks
    
    // Forehead region: landmarks around 10 (top of face)
    const foreheadCenter = faceLandmarks[10];
    
    // IMPORTANT: Camera is mirrored, so landmarks are flipped from user's perspective
    // Landmark 50 is on user's right cheek (appears left in mirror)
    // Landmark 280 is on user's left cheek (appears right in mirror)
    // We swap them so the naming matches what the user sees in the mirror
    
    // Left cheek (as user sees it in mirror): landmark 280
    const leftCheek = faceLandmarks[280];
    
    // Right cheek (as user sees it in mirror): landmark 50
    const rightCheek = faceLandmarks[50];
    
    const proximityThreshold = 0.10; // Reduced threshold to prevent overlap between regions
    const currentTime = Date.now();
    
    // Track which areas are being touched by any hand
    const areasBeingTouched = {
        forehead: false,
        leftSide: false,
        rightSide: false
    };
    
    // Check each detected hand
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
        if (distanceToForehead < proximityThreshold) {
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
    // Update through the main UI update function which now handles step 3 (face rubbing) display
    if (analysisSession.currentStep === 3) {
        updateSessionUI();
    }
}

// Hands detection results callback
function onHandsDetectionResults(results) {
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
    // IMPORTANT: Camera is mirrored, so landmarks are flipped from user's perspective
    // Landmark 50 is on user's right cheek (appears left in mirror)
    // Landmark 280 is on user's left cheek (appears right in mirror)
    const foreheadCenter = faceLandmarks[10];
    const leftCheek = faceLandmarks[280];  // Left cheek as user sees it in mirror
    const rightCheek = faceLandmarks[50];  // Right cheek as user sees it in mirror
    
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
}

// Face detection results callback
function onFaceDetectionResults(results) {
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
    
    // Clear canvas and draw the video frame
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
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
        
        // Show warning toast if face is not centered (for steps that need it, but skip step 1 OCR)
        if (analysisSession.currentStep > 0 && analysisSession.currentStep !== 1 && analysisSession.isActive && !faceCentered) {
            showWarningToast('Please keep your face in the center frame');
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
        
        // Show warning if face not detected and we're past step 2 (but skip step 3)
        if (analysisSession.currentStep > 2 && analysisSession.currentStep !== 3 && analysisSession.isActive) {
            showWarningToast('Face not detected - please stay in frame');
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
        const instructionText = 'Place product label in this area';
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
        canvasCtx.fillText('▼ AUTO SCAN ▼', 0, 0);
        canvasCtx.restore();
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
                // Optimize by only running necessary models for current step
                
                // Step 0 (Preliminaries): Only need face detection
                if (analysisSession.currentStep === 0) {
                    await faceDetection.send({image: webcam});
                }
                // Step 1 (OCR): Use face detection to keep camera feed updating and draw OCR overlay
                else if (analysisSession.currentStep === 1) {
                    await faceDetection.send({image: webcam});
                }
                // Step 2 (Palm Detection): Need hands detection + face detection to ensure subject stays in frame
                else if (analysisSession.currentStep === 2) {
                    await Promise.all([
                        faceDetection.send({image: webcam}),
                        handsDetection.send({image: webcam})
                    ]);
                }
                // Step 3 (Face Rubbing): Need both hands and face mesh
                else if (analysisSession.currentStep === 3) {
                    // Run hands and face mesh in parallel for better performance
                    await Promise.all([
                        handsDetection.send({image: webcam}),
                        faceMesh.send({image: webcam})
                    ]);
                }
            },
            width: 640,   // Reduced from 1280 for better FPS (processing resolution)
            height: 480   // Reduced from 720 for better FPS (processing resolution)
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

