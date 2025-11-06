// MediaPipe Detection State

// Face Detection
export let faceDetection = null;
export let camera = null;
export let faceDetected = false;
export let faceCentered = false;
export let facePosition = { x: 0, y: 0 };

export function setFaceDetection(detection) { faceDetection = detection; }
export function setCamera(cam) { camera = cam; }
export function setFaceDetected(value) { faceDetected = value; }
export function setFaceCentered(value) { faceCentered = value; }
export function setFacePosition(pos) { facePosition = pos; }

// Hands Detection
export let handsDetection = null;
export let handDetected = false;
export let palmUp = false;
export let handLandmarks = [];  // Array to store multiple detected hands

export function setHandsDetection(detection) { handsDetection = detection; }
export function setHandDetected(value) { handDetected = value; }
export function setPalmUp(value) { palmUp = value; }
export function setHandLandmarks(landmarks) { handLandmarks = landmarks; }

// Palm detection tracking (Step 2)
export let palmDetectionState = {
    detected: false,
    startTime: null,
    totalTime: 0,
    completed: false
};
export const PALM_DETECTION_REQUIRED = 2000; // 2 seconds in milliseconds

// Face Mesh (Step 3)
export let faceMesh = null;
export let faceMeshLandmarks = null;

export function setFaceMesh(mesh) { faceMesh = mesh; }
export function setFaceMeshLandmarks(landmarks) { faceMeshLandmarks = landmarks; }

// Face rubbing tracking (Step 3)
export let faceRubbingState = {
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
    coveredLandmarks: new Set(),
    totalCoverage: 0,
    coverageRequired: 80
};

export const RUBBING_DURATION_REQUIRED = 5000; // 5 seconds
export const RUBBING_MOTION_THRESHOLD = 0.005; // Minimum movement
export const FACE_COVERAGE_PROXIMITY = 0.02; // Distance threshold

// OCR state
export let ocrRecognized = false;
export let ocrSkipped = false;
export let autoOcrInterval = null;

export function setOcrRecognized(value) { ocrRecognized = value; }
export function setOcrSkipped(value) { ocrSkipped = value; }
export function setAutoOcrInterval(interval) { autoOcrInterval = interval; }

// OCR capture area configuration
export const OCR_CAPTURE_AREA = {
    sizePercent: 0.60  // 60% of video dimension
};
