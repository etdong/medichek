import * as DOM from './dom.js';
import { countdownNumber } from './dom.js';
import * as utils from './utils.js';
import * as ocr from './ocr_handler.js';
import { t } from './translations.js';

let videoStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let currentStepRecording: number = 0;
let camera = null;

// OCR capture area (centered square for product/text placement)
export const OCR_CAPTURE_AREA = {
    sizePercent: 0.4,   // 40% of canvas (square area for better OCR)
    get widthPercent() { return this.sizePercent; },
    get heightPercent() { return this.sizePercent; },
    get x() { return (1 - this.widthPercent) / 2; },  // Centered horizontally
    get y() { return (1 - this.heightPercent) / 2; }  // Centered vertically
};

export let stepRecordings: { [key: string]: Blob | null } = {
    step1: null,
    step2: null,
    step3: null
};
export let step1CapturedFrameBlob: Blob | null = null;
export let step2CapturedFrameBlob: Blob | null = null;
export let recordingConsent = false;

export async function setCameraInstance(cameraInstance: any) {
    camera = cameraInstance;
    await camera.start();
}

export async function startTracking() {
    // Show recording consent modal
    DOM.recordingConsentModal.style.display = 'flex';
}

// Handle recording consent acceptance
export async function acceptRecordingConsent() {
    // Hide modal
    DOM.recordingConsentModal.style.display = 'none';
    
    recordingConsent = true;
    utils.addLog('✅ Video recording consent granted', 'success');
    
    // Initialize client-side session (currentStep starts at 0 for preliminaries)
    let analysisSession = {
        sessionId: utils.generateSessionId(),
        startTime: Date.now(),
        currentStep: 0,  // 0 = preliminaries (camera + face centering)
        totalSteps: 3,   // Only 3 actual steps now
        isActive: true,
        metadata: {
            userAgent: navigator.userAgent,
            screenResolution: `${screen.width}x${screen.height}`,
            source: 'web-client',
            recordingConsent: true
        },
        stepTimings: {
            step1: { startTime: 0, endTime: 0, duration: 0 },  // OCR Capture
            step2: { startTime: 0, endTime: 0, duration: 0 },  // Palm Detection
            step3: { startTime: 0, endTime: 0, duration: 0 }   // Face Rubbing
        }
    };

    return analysisSession;
}

// Handle recording consent decline
export function declineRecordingConsent() {
    // Hide modal
    DOM.recordingConsentModal.style.display = 'none';
    
    utils.addLog('❌ Video recording consent denied. Cannot proceed.', 'error');
    utils.addLog('⚠️ Video recording is required to proceed with the tracking session.', 'warning');
}

// Camera management
export async function enableCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        utils.addLog('❌ Camera not supported in this browser', 'error');
        return false;
    }
    
    try {
        utils.addLog('📹 Requesting camera access...', 'info');
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            } 
        });
        
        DOM.webcam.srcObject = stream;
        videoStream = stream;
        
        // Wait for video to be ready
        await new Promise<void>((resolve) => {
            DOM.webcam.onloadedmetadata = () => {
                DOM.webcam.play();
                resolve();
            };
        });
        
        utils.addLog('📹 Camera enabled successfully!', 'success');
        
        return true;
    } catch (err: any) {
        utils.addLog('❌ Camera access denied: ' + err.message, 'error');
        utils.addLog('⚠️ Cannot proceed without camera access', 'warning');
        return false;
        
    }
}


// Video recording functions
export function startStepRecording(stepNumber: number) {
    if (!videoStream || !recordingConsent) {
        utils.addLog('⚠️ Cannot start recording: no video stream or consent', 'warning');
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
                utils.addLog(`✅ Step ${currentStepRecording} recording saved (${(blob.size / 1024 / 1024).toFixed(2)} MB)`, 'success');
            }
        };
        
        mediaRecorder.start(100); // Collect data every 100ms
        utils.addLog(`🎥 Recording started for Step ${stepNumber}`, 'info');

    } catch (error: any) {
        utils.addLog(`❌ Failed to start recording: ${error.message}`, 'error');
        console.error('Recording error:', error);
    }
}

export function stopStepRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        utils.addLog(`⏹️ Recording stopped for Step ${currentStepRecording}`, 'info');
    }
}

// Frame capture and OCR functionality
export async function captureFrame(doOCR: boolean = false, countdown: boolean = true): Promise<string> {
    // Disable capture button to prevent multiple clicks
    DOM.captureFrameBtn.disabled = true;
    
    utils.addLog('📸 Capturing frame...', 'info');

    if (countdown) {
        utils.addLog('⏱️ Starting 3-second countdown...', 'info');
        
        // Show countdown overlay
        DOM.countdownOverlay.style.display = 'flex';
        
        // Countdown
        for (let i = 3; i > 0; i--) {
            DOM.countdownNumber.textContent = i.toString();
            // Re-trigger animation
            DOM.countdownNumber.style.animation = 'none';
            setTimeout(() => {
                countdownNumber.style.animation = 'pulse 1s ease-in-out';
            }, 10);
            
            utils.addLog(`${i}...`, 'info');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Hide countdown
        DOM.countdownOverlay.style.display = 'none';
    }
    
    // Calculate capture area dimensions (square based on smaller dimension)
    const minDimension = Math.min(DOM.webcam.videoWidth, DOM.webcam.videoHeight);
    const squareSize = minDimension * OCR_CAPTURE_AREA.sizePercent;
    
    // Add padding to capture more area around the OCR capture zone (20% padding)
    const paddingPercent = 0.40;
    const padding = squareSize * paddingPercent;
    
    // Center the square with padding
    const captureX = Math.max(0, (DOM.webcam.videoWidth - squareSize) / 2 - padding);
    const captureY = Math.max(0, (DOM.webcam.videoHeight - squareSize) / 2 - padding);
    const captureWidth = Math.min(squareSize + (padding * 2), DOM.webcam.videoWidth - captureX);
    const captureHeight = Math.min(squareSize + (padding * 2), DOM.webcam.videoHeight - captureY);
    
    // Capture the padded area (un-mirrored for OCR)
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = captureWidth;
    captureCanvas.height = captureHeight;
    const ctx: CanvasRenderingContext2D = captureCanvas.getContext('2d') as CanvasRenderingContext2D;
    
    // Draw the padded capture area from video WITHOUT mirroring (correct orientation for OCR)
    ctx.drawImage(
        DOM.webcam,
        captureX, captureY, captureWidth, captureHeight,  // Source rectangle
        0, 0, captureWidth, captureHeight                 // Destination rectangle
    );
    
    // Store as blob for download
    await new Promise<void>(resolve => {
        captureCanvas.toBlob(blob => {
            step1CapturedFrameBlob = blob;
            resolve();
        }, 'image/png');
    });
    
    // Show captured frame (remove empty state)
    DOM.capturedFrameArea.classList.remove('empty');

    // Display the un-mirrored version in the compact preview (so text is readable)
    const displayCanvas = DOM.step1FrameCanvas;
    displayCanvas.width = captureCanvas.width;
    displayCanvas.height = captureCanvas.height;
    const displayCtx: CanvasRenderingContext2D = displayCanvas.getContext('2d') as CanvasRenderingContext2D;
    
    // Draw without mirroring so text appears correct
    displayCtx.drawImage(captureCanvas, 0, 0, displayCanvas.width, displayCanvas.height);

    utils.addLog('✅ Frame captured!', 'success');

    if (doOCR) {
        utils.addLog('🔍 Performing OCR on captured frame...', 'info');
        // Update status badge
        DOM.ocrStatusBadge.textContent = t('frame.ocrAnalyzing');
        DOM.ocrStatusBadge.className = 'ocr-status analyzing';
        DOM.ocrResultCompact.innerHTML = '';
        
        // Show OCR analysis overlay to prevent interaction
        DOM.ocrAnalysisOverlay.style.display = 'flex';
        
        // Perform OCR on the un-mirrored captured area
        await ocr.performOCR(captureCanvas);
    }

    return captureCanvas.toDataURL('image/png');
}

export function resetCapturedFrame() {
    step1CapturedFrameBlob = null;
    DOM.capturedFrameArea.classList.add('empty');
}

export async function performAutoOcrScan(): Promise<boolean> {
    if (!DOM.webcam) return false;
    
    // Calculate capture area dimensions
    const minDimension = Math.min(DOM.webcam.videoWidth, DOM.webcam.videoHeight);
    const squareSize = minDimension * OCR_CAPTURE_AREA.sizePercent;
    const captureX = (DOM.webcam.videoWidth - squareSize) / 2;
    const captureY = (DOM.webcam.videoHeight - squareSize) / 2;
    const captureWidth = squareSize;
    const captureHeight = squareSize;
    
    // Capture the OCR area silently (no countdown)
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = captureWidth;
    captureCanvas.height = captureHeight;
    const ctx: CanvasRenderingContext2D = captureCanvas.getContext('2d') as CanvasRenderingContext2D;
    
    // Draw only the capture area from video WITHOUT mirroring
    ctx.drawImage(
        DOM.webcam,
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
            await new Promise<void>(resolve => {
                captureCanvas.toBlob(blob => {
                    step1CapturedFrameBlob = blob;
                    resolve();
                }, 'image/png');
            });
            
            // Display the captured frame
            DOM.capturedFrameArea.classList.remove('empty');
            const displayCanvas = DOM.step1FrameCanvas;
            displayCanvas.width = captureCanvas.width;
            displayCanvas.height = captureCanvas.height;
            const displayCtx: CanvasRenderingContext2D = displayCanvas.getContext('2d') as CanvasRenderingContext2D;
            displayCtx.drawImage(captureCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
            
            return true;
        }
        return false;
    } catch (error) {
        console.error('Auto OCR scan error:', error);
        return false;
    }
}