// DOM elements
// Language selector
export const langEnBtn: HTMLButtonElement = document.getElementById('lang-en') as HTMLButtonElement;
export const langZhBtn: HTMLButtonElement = document.getElementById('lang-zh') as HTMLButtonElement;

export const loadingScreen: HTMLElement = document.getElementById('loading-screen') as HTMLElement;
export const serverCheckStatus: HTMLElement = document.getElementById('server-check') as HTMLElement;
export const minioCheckStatus: HTMLElement = document.getElementById('minio-check') as HTMLElement;
export const offlinePrompt: HTMLElement = document.getElementById('offline-prompt') as HTMLElement;
export const continueOfflineBtn: HTMLButtonElement = document.getElementById('continue-offline-btn') as HTMLButtonElement;
export const retryConnectionBtn: HTMLButtonElement = document.getElementById('retry-connection-btn') as HTMLButtonElement;

export const serverStatus: HTMLElement = document.getElementById('server-status') as HTMLElement;
export const sessionIdElement: HTMLElement = document.getElementById('session-id') as HTMLElement;
export const currentStepElement: HTMLElement = document.getElementById('current-step') as HTMLElement;

// Buttons
export const startTrackingBtn: HTMLButtonElement = document.getElementById('start-tracking') as HTMLButtonElement;
export const captureFrameBtn: HTMLButtonElement = document.getElementById('capture-frame') as HTMLButtonElement;
export const nextStepBtn: HTMLButtonElement = document.getElementById('next-step') as HTMLButtonElement;
export const finishSessionBtn: HTMLButtonElement = document.getElementById('finish-session') as HTMLButtonElement;

// Review/Finish screen elements
export const reviewScreen: HTMLElement = document.getElementById('review-screen') as HTMLElement;
export const submitAnalysisBtn: HTMLButtonElement = document.getElementById('submit-analysis-btn') as HTMLButtonElement;
export const restartSessionBtn: HTMLButtonElement = document.getElementById('restart-session-btn') as HTMLButtonElement;

// Modal elements
export const ocrFailModal: HTMLElement = document.getElementById('ocr-fail-modal') as HTMLElement;
export const retryOcrBtn: HTMLButtonElement = document.getElementById('retry-ocr') as HTMLButtonElement;
export const continueAnywayBtn: HTMLButtonElement = document.getElementById('continue-anyway') as HTMLButtonElement;

export const recordingConsentModal: HTMLElement = document.getElementById('recording-consent-modal') as HTMLElement;
export const acceptRecordingBtn: HTMLButtonElement = document.getElementById('accept-recording-btn') as HTMLButtonElement;
export const declineRecordingBtn: HTMLButtonElement = document.getElementById('decline-recording-btn') as HTMLButtonElement;

// Captured frame elements (split display for step 3 and step 4)
export const capturedFrameArea: HTMLElement = document.getElementById('captured-frame-area') as HTMLElement;
export const step1FrameCanvas: HTMLCanvasElement = document.getElementById('step3-frame-canvas') as HTMLCanvasElement;
export const step4FrameCanvas: HTMLCanvasElement = document.getElementById('step4-frame-canvas') as HTMLCanvasElement;
export const step3FrameSlot: HTMLElement = document.getElementById('step3-frame-slot') as HTMLElement;
export const step4FrameSlot: HTMLElement = document.getElementById('step4-frame-slot') as HTMLElement;
export const ocrResultCompact: HTMLElement = document.getElementById('ocr-result-compact') as HTMLElement;
export const ocrStatusBadge: HTMLElement = document.getElementById('ocr-status') as HTMLElement;
export const palmStatusBadge: HTMLElement = document.getElementById('palm-status') as HTMLElement;
export const countdownOverlay: HTMLElement = document.getElementById('countdown-overlay') as HTMLElement;
export const countdownNumber: HTMLElement = document.getElementById('countdown-number') as HTMLElement;

// Warning toast
export const warningToast: HTMLElement = document.getElementById('warning-toast') as HTMLElement;

// Hand bounds warning
export const handBoundsWarning: HTMLElement = document.getElementById('hand-bounds-warning') as HTMLElement;

// OCR analysis overlay
export const ocrAnalysisOverlay: HTMLElement = document.getElementById('ocr-analysis-overlay') as HTMLElement;

// Upload overlay and completion screen
export const uploadOverlay: HTMLElement = document.getElementById('upload-overlay') as HTMLElement;
export const downloadOverlay: HTMLElement = document.getElementById('download-overlay') as HTMLElement;
export const completionScreen: HTMLElement = document.getElementById('completion-screen') as HTMLElement;
export const completionIcon: HTMLElement = document.getElementById('completion-icon') as HTMLElement;
export const completionTitle: HTMLElement = document.getElementById('completion-title') as HTMLElement;
export const completionMessage: HTMLElement = document.getElementById('completion-message') as HTMLElement;
export const completionDetails: HTMLElement = document.getElementById('completion-details') as HTMLElement;
export const startNewSessionBtn: HTMLButtonElement = document.getElementById('start-new-session-btn') as HTMLButtonElement;
export const downloadAnalysisBtn: HTMLButtonElement = document.getElementById('download-analysis-btn') as HTMLButtonElement;


// Webcam and canvas elements
export const webcam: HTMLVideoElement = document.getElementById('webcam') as HTMLVideoElement;
export const canvas: HTMLCanvasElement = document.getElementById('output-canvas') as HTMLCanvasElement;

export const reviewOcrStatus: HTMLElement = document.getElementById('review-ocr-status') as HTMLElement;
export const reviewPalmStatus: HTMLElement = document.getElementById('review-palm-status') as HTMLElement;
export const reviewFaceStatus: HTMLElement = document.getElementById('review-face-status') as HTMLElement;