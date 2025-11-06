// Configuration and Global State
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

// Setters for statuses
export function setOfflineMode(value) { offlineMode = value; }
export function setServerOnline(value) { serverOnline = value; }
export function setMinioOnline(value) { minioOnline = value; }
export function setCurrentServerStatus(value) { currentServerStatus = value; }
export function setCurrentMinioStatus(value) { currentMinioStatus = value; }
export function setCurrentOcrStatus(value) { currentOcrStatus = value; }
export function setCurrentPalmStatus(value) { currentPalmStatus = value; }

// Global state - Client-side only, no server sessions
export let analysisSession = {
    sessionId: null,
    startTime: null,
    currentStep: 0,
    totalSteps: 3,  // Only tracking OCR, Palm Detection, and Face Rubbing
    isActive: false,
    stepTimings: {
        step1: { startTime: null, endTime: null, duration: 0 },  // OCR Capture
        step2: { startTime: null, endTime: null, duration: 0 },  // Palm Detection
        step3: { startTime: null, endTime: null, duration: 0 }   // Face Rubbing
    }
};

export function setAnalysisSession(session) {
    analysisSession = session;
}

// Camera and recording state
export let cameraEnabled = false;
export let videoStream = null;
export let recordingConsent = false;

export function setCameraEnabled(value) { cameraEnabled = value; }
export function setVideoStream(stream) { videoStream = stream; }
export function setRecordingConsent(value) { recordingConsent = value; }

// MinIO uploaded file URLs
export let uploadedFileUrls = null;
export function setUploadedFileUrls(urls) { uploadedFileUrls = urls; }

// Captured frame blobs
export let step3CapturedFrameBlob = null;
export let step4CapturedFrameBlob = null;
export let capturedImageData = null;

export function setStep3CapturedFrameBlob(blob) { step3CapturedFrameBlob = blob; }
export function setStep4CapturedFrameBlob(blob) { step4CapturedFrameBlob = blob; }
export function setCapturedImageData(data) { capturedImageData = data; }
