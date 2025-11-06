// DOM Element References

// Language selector
export let langEnBtn = document.getElementById('lang-en');
export let langZhBtn = document.getElementById('lang-zh');

// Loading screen
export let loadingScreen = document.getElementById('loading-screen');
export let serverCheckStatus = document.getElementById('server-check');
export let minioCheckStatus = document.getElementById('minio-check');
export let offlinePrompt = document.getElementById('offline-prompt');
export let continueOfflineBtn = document.getElementById('continue-offline-btn');
export let retryConnectionBtn = document.getElementById('retry-connection-btn');

// Status elements
export let serverStatus = document.getElementById('server-status');
export let sessionIdElement = document.getElementById('session-id');
export let currentStepElement = document.getElementById('current-step');

// Buttons
export let startTrackingBtn = document.getElementById('start-tracking');
export let captureFrameBtn = document.getElementById('capture-frame');
export let nextStepBtn = document.getElementById('next-step');
export let finishSessionBtn = document.getElementById('finish-session');
export let submitAnalysisBtn = document.getElementById('submit-analysis');
export let restartSessionBtn = document.getElementById('restart-session');
export let startNewSessionBtn = document.getElementById('start-new-session');
export let downloadAnalysisBtn = document.getElementById('download-analysis');

// Modal buttons
export let acceptRecordingBtn = document.getElementById('accept-recording-btn');
export let declineRecordingBtn = document.getElementById('decline-recording-btn');
export let retryOcrBtn = document.getElementById('retry-ocr-btn');
export let continueAnywayBtn = document.getElementById('continue-anyway-btn');

// Screens and overlays
export let reviewScreen = document.getElementById('review-screen');
export let completionScreen = document.getElementById('completion-screen');
export let recordingConsentModal = document.getElementById('recording-consent-modal');
export let ocrFailModal = document.getElementById('ocr-fail-modal');
export let countdownOverlay = document.getElementById('countdown-overlay');
export let countdownNumber = document.getElementById('countdown-number');
export let ocrAnalysisOverlay = document.getElementById('ocr-analysis-overlay');
export let downloadOverlay = document.getElementById('download-overlay');

// Frame capture elements
export let capturedFrameArea = document.getElementById('captured-frame-area');
export let step3FrameCanvas = document.getElementById('step3-frame-canvas');
export let step4FrameCanvas = document.getElementById('step4-frame-canvas');
export let ocrStatusBadge = document.getElementById('ocr-status-badge');
export let ocrResultCompact = document.getElementById('ocr-result-compact');
export let palmStatusBadge = document.getElementById('palm-status-badge');

// Step progress
export let stepProgress = document.getElementById('step-progress');

// Webcam and canvas
export let webcam = document.getElementById('webcam');
export let canvas = document.getElementById('output-canvas');

// Canvas context
export let canvasCtx = null;
export function setCanvasCtx(ctx) { canvasCtx = ctx; }

// Warning toast
export let warningToast = document.getElementById('warning-toast');
export let warningMessage = document.getElementById('warning-message');
// Hand bounds warning (shown when user's hand is out of visible crop area)
export let handBoundsWarning = document.getElementById('hand-bounds-warning');

// If the hosting HTML is missing some of the expected elements (migration artifacts
// or simplified templates), create hidden placeholders so modules can safely set
// properties like textContent or className without throwing. When the real
// elements are present, these placeholders are not used.
function ensurePresent(id, ref) {
	if (ref) return ref;
	const placeholder = document.createElement('div');
	placeholder.id = id;
	placeholder.style.display = 'none';
	// Append to body if possible; otherwise skip (server-side rendering cases)
	try { document.body.appendChild(placeholder); } catch (e) { /* ignore */ }
	return placeholder;
}

// Ensure critical elements exist to avoid runtime null errors when code tries
// to update textContent/className. This keeps behavior identical when the
// real elements exist and avoids crashes when they don't.
serverStatus = ensurePresent('server-status', serverStatus);
sessionIdElement = ensurePresent('session-id', sessionIdElement);
currentStepElement = ensurePresent('current-step', currentStepElement);

startTrackingBtn = ensurePresent('start-tracking', startTrackingBtn);
nextStepBtn = ensurePresent('next-step', nextStepBtn);
captureFrameBtn = ensurePresent('capture-frame', captureFrameBtn);
finishSessionBtn = ensurePresent('finish-session', finishSessionBtn);

serverCheckStatus = ensurePresent('server-check', serverCheckStatus);
minioCheckStatus = ensurePresent('minio-check', minioCheckStatus);

ocrStatusBadge = ensurePresent('ocr-status-badge', ocrStatusBadge);
palmStatusBadge = ensurePresent('palm-status-badge', palmStatusBadge);

capturedFrameArea = ensurePresent('captured-frame-area', capturedFrameArea);
step3FrameCanvas = ensurePresent('step3-frame-canvas', step3FrameCanvas);
step4FrameCanvas = ensurePresent('step4-frame-canvas', step4FrameCanvas);
ocrResultCompact = ensurePresent('ocr-result-compact', ocrResultCompact);
ocrAnalysisOverlay = ensurePresent('ocr-analysis-overlay', ocrAnalysisOverlay);
ocrFailModal = ensurePresent('ocr-fail-modal', ocrFailModal);
countdownOverlay = ensurePresent('countdown-overlay', countdownOverlay);
countdownNumber = ensurePresent('countdown-number', countdownNumber);

warningToast = ensurePresent('warning-toast', warningToast);
warningMessage = ensurePresent('warning-message', warningMessage);
handBoundsWarning = ensurePresent('hand-bounds-warning', handBoundsWarning);
