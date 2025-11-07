// DOM elements
// Language selector
export const langEnBtn = document.getElementById('lang-en');
export const langZhBtn = document.getElementById('lang-zh');

export const loadingScreen = document.getElementById('loading-screen');
export const serverCheckStatus = document.getElementById('server-check');
export const minioCheckStatus = document.getElementById('minio-check');
export const offlinePrompt = document.getElementById('offline-prompt');
export const continueOfflineBtn = document.getElementById('continue-offline-btn');
export const retryConnectionBtn = document.getElementById('retry-connection-btn');

export const serverStatus = document.getElementById('server-status');
export const sessionIdElement = document.getElementById('session-id');
export const currentStepElement = document.getElementById('current-step');

// Buttons
export const startTrackingBtn = document.getElementById('start-tracking');
export const captureFrameBtn = document.getElementById('capture-frame');
export const nextStepBtn = document.getElementById('next-step');
export const finishSessionBtn = document.getElementById('finish-session');

// Review/Finish screen elements
export const reviewScreen = document.getElementById('review-screen');
export const submitAnalysisBtn = document.getElementById('submit-analysis-btn');
export const restartSessionBtn = document.getElementById('restart-session-btn');

// Modal elements
export const ocrFailModal = document.getElementById('ocr-fail-modal');
export const retryOcrBtn = document.getElementById('retry-ocr');
export const continueAnywayBtn = document.getElementById('continue-anyway');

export const recordingConsentModal = document.getElementById('recording-consent-modal');
export const acceptRecordingBtn = document.getElementById('accept-recording-btn');
export const declineRecordingBtn = document.getElementById('decline-recording-btn');

// Captured frame elements (split display for step 3 and step 4)
export const capturedFrameArea = document.getElementById('captured-frame-area');
export const step3FrameCanvas = document.getElementById('step3-frame-canvas');
export const step4FrameCanvas = document.getElementById('step4-frame-canvas');
export const step3FrameSlot = document.getElementById('step3-frame-slot');
export const step4FrameSlot = document.getElementById('step4-frame-slot');
export const ocrResultCompact = document.getElementById('ocr-result-compact');
export const ocrStatusBadge = document.getElementById('ocr-status');
export const palmStatusBadge = document.getElementById('palm-status');
export const countdownOverlay = document.getElementById('countdown-overlay');
export const countdownNumber = document.getElementById('countdown-number');

// Warning toast
export const warningToast = document.getElementById('warning-toast');
export let toastTimeout = null;

// Hand bounds warning
export const handBoundsWarning = document.getElementById('hand-bounds-warning');
export let handBoundsWarningTimeout = null;

// OCR analysis overlay
export const ocrAnalysisOverlay = document.getElementById('ocr-analysis-overlay');

// Upload overlay and completion screen
export const uploadOverlay = document.getElementById('upload-overlay');
export const downloadOverlay = document.getElementById('download-overlay');
export const completionScreen = document.getElementById('completion-screen');
export const completionIcon = document.getElementById('completion-icon');
export const completionTitle = document.getElementById('completion-title');
export const completionMessage = document.getElementById('completion-message');
export const completionDetails = document.getElementById('completion-details');
export const startNewSessionBtn = document.getElementById('start-new-session-btn');
export const downloadAnalysisBtn = document.getElementById('download-analysis-btn');