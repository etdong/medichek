// Configuration - use external config if available, otherwise fallback
export const SERVER_URL = (window.MedichekConfig && window.MedichekConfig.getServerUrl()) 
    || 'http://127.0.0.1:8000';

// Offline mode flag
export let offlineMode = false;
export let serverOnline = false;
export let minioOnline = false;

// Current server status (for re-translation when language changes)
export let currentServerStatus = 'checking'; // 'checking', 'online', or 'offline'
export let currentMinioStatus = 'checking';  // 'checking', 'online', or 'offline'

// Current frame capture statuses (for re-translation when language changes)
export let currentOcrStatus = null; // 'analyzing', 'recognized', 'notFound', 'error', 'review', or null
export let currentPalmStatus = null; // 'captured' or null

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
    forehead: { 
        rubbed: false, 
        startTime: null, 
        totalTime: 0, 
        lastHandPos: null, 
        lastUpdateTime: null
    },
    leftSide: { 
        rubbed: false, 
        startTime: null, 
        totalTime: 0, 
        lastHandPos: null, 
        lastUpdateTime: null
    },
    rightSide: { 
        rubbed: false, 
        startTime: null, 
        totalTime: 0, 
        lastHandPos: null, 
        lastUpdateTime: null
    },
    // Holistic coverage tracking
    coveredLandmarks: new Set(), // Track all covered landmarks across entire face
    totalCoverage: 0, // Overall percentage of face covered (0-100)
    coverageRequired: 80 // Target coverage percentage (informational only)
};
const RUBBING_DURATION_REQUIRED = 5000; // 5 seconds in milliseconds
const RUBBING_MOTION_THRESHOLD = 0.005; // Minimum movement to count as rubbing (lowered for better sensitivity)
const FACE_COVERAGE_PROXIMITY = 0.02; // Distance threshold for marking a landmark as "covered" (stricter detection)

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
    step3: null
};
let recordingConsent = false;