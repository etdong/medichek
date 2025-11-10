import * as DOM from './dom';
import * as utils from './utils.js';
import * as cam from './camera.js';
import * as server from './server_manager.js';
import * as ui from './ui_manager.js';
import * as mp from './mp_manager.js';

import { FaceMesh } from '@mediapipe/face_mesh';
import { FaceDetection } from '@mediapipe/face_detection';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { MedichekConfig } from './config';
import { t, updateLanguage } from './translations';
import { createWorker } from 'tesseract.js'

//#region Declarations

// Configuration - use external config if available, otherwise fallback
const SERVER_URL = (MedichekConfig && MedichekConfig.getServerUrl()) 
    || 'http://127.0.0.1:8000';

// Current server status (for re-translation when language changes)
let currentServerStatus = 'checking'; // 'checking', 'online', or 'offline'
let currentMinioStatus = 'checking';  // 'checking', 'online', or 'offline'

// Current frame capture statuses (for re-translation when language changes)
let currentOcrStatus = 'null'; // 'analyzing', 'recognized', 'notFound', 'error', 'review', or null

// Global state - Client-side only, no server sessions
let analysisSession = {
    sessionId: '',
    startTime: Date.now(),
    currentStep: 0,
    totalSteps: 3,  // Only tracking OCR, Palm Detection, and Face Rubbing
    isActive: false,
	metadata: {
		userAgent: navigator.userAgent,
		screenResolution: `${screen.width}x${screen.height}`,
		source: 'web-client',
	},
    stepTimings: {
        step1: { startTime: 0, endTime: 0, duration: 0 },  // OCR Capture (was step3)
        step2: { startTime: 0, endTime: 0, duration: 0 },  // Palm Detection (was step4)
        step3: { startTime: 0, endTime: 0, duration: 0 }   // Face Rubbing (was step5)
    }
};

let cameraEnabled = false;

// MinIO uploaded file URLs (populated after upload)
let minioFileUrls: Record<string, string> = {};

let faceDetection: FaceDetection | null = null;
let handsDetection: Hands | null = null;
let faceMesh: FaceMesh | null = null;

// Automatic OCR scanning
let autoOcrInterval: NodeJS.Timeout | null = null;

//#endregion

export function updateSessionUI() {
    DOM.sessionIdElement.textContent = analysisSession.sessionId || t('status.sessionNone');
    DOM.currentStepElement.textContent = `${analysisSession.currentStep}/${analysisSession.totalSteps}`;
    
    // Hide all buttons first
    DOM.startTrackingBtn.style.display = 'none';
    DOM.nextStepBtn.style.display = 'none';
    DOM.captureFrameBtn.style.display = 'none';
    DOM.finishSessionBtn.style.display = 'none';
    
    // Update step instruction overlay
    const stepInstruction = document.getElementById('step-instruction');
    const stepProgress = document.getElementById('step-progress');
    
    if (!analysisSession.isActive) {
        // Not started yet
        DOM.startTrackingBtn.style.display = 'block';
        DOM.startTrackingBtn.disabled = false;
        if (stepInstruction) stepInstruction.textContent = t('steps.readyToBegin');
        if (stepProgress) stepProgress.textContent = '';
    } else if (analysisSession.currentStep === 0) {
        // Step 0: Preliminaries (camera + face centering)
        DOM.nextStepBtn.style.display = 'block';
        DOM.nextStepBtn.disabled = !cameraEnabled || !mp.faceCentered;
        if (stepInstruction) stepInstruction.textContent = t('steps.preliminaries.title');
        if (stepProgress) {
            if (!cameraEnabled) {
                stepProgress.textContent = t('steps.preliminaries.activatingCamera');
            } else if (!mp.faceCentered) {
                stepProgress.textContent = t('steps.preliminaries.positionFace');
            } else {
                stepProgress.textContent = t('steps.preliminaries.ready');
            }
        }
    } else if (analysisSession.currentStep === 1) {
        // Step 1: OCR capture with auto-scanning
        DOM.captureFrameBtn.style.display = 'block';
        DOM.captureFrameBtn.disabled = !cameraEnabled;
        
        if (stepInstruction) stepInstruction.textContent = t('steps.ocr.title');
        if (stepProgress) {
            if (ocrRecognized) {
                stepProgress.textContent = t('steps.ocr.productRecognized');
            } else if (ocrSkipped) {
                stepProgress.textContent = t('steps.ocr.proceedingManual');
            } else {
                stepProgress.textContent = t('steps.ocr.showLabel');
            }
        }
    } else if (analysisSession.currentStep === 2) {
        // Step 2: Palm detection (auto-advance, no next button)
        DOM.captureFrameBtn.style.display = 'block';
        DOM.captureFrameBtn.disabled = !cameraEnabled;
        if (stepInstruction) stepInstruction.textContent = t('steps.palm.title');
        if (stepProgress) {
            if (mp.palmDetectionState.completed) {
                stepProgress.textContent = t('steps.palm.complete');
                // Auto-advance to next step after a short delay
                setTimeout(() => {
                    nextStep();
                }, 1500); // 1.5 second delay to show success message
            } else if (palmSkipped) {
                stepProgress.textContent = t('steps.ocr.proceedingManual');  // Reusing OCR's manual review text
            } else if (mp.palmDetectionState.detected && mp.palmDetectionState.totalTime > 0) {
                const progress = Math.min(100, Math.round((mp.palmDetectionState.totalTime / mp.PALM_DETECTION_REQUIRED) * 100));
                stepProgress.textContent = t('steps.palm.holdSteady', { progress: progress.toString() });
            } else {
                stepProgress.textContent = t('steps.palm.showProduct');
            }
        }
    } else if (analysisSession.currentStep === 3) {
        // Step 3: Face rubbing (time-based only, coverage is for visualization)
        const allAreasRubbed = mp.faceRubbingState.forehead.rubbed && 
                               mp.faceRubbingState.leftSide.rubbed && 
                               mp.faceRubbingState.rightSide.rubbed;
        
        DOM.finishSessionBtn.style.display = 'block';
        DOM.finishSessionBtn.disabled = !allAreasRubbed; // Only require time-based completion

        if (stepInstruction) stepInstruction.textContent = t('steps.faceRubbing.title');
        if (stepProgress) {
            const foreheadPercent = Math.min(100, Math.round((mp.faceRubbingState.forehead.totalTime / mp.RUBBING_DURATION_REQUIRED) * 100));
            const leftPercent = Math.min(100, Math.round((mp.faceRubbingState.leftSide.totalTime / mp.RUBBING_DURATION_REQUIRED) * 100));
            const rightPercent = Math.min(100, Math.round((mp.faceRubbingState.rightSide.totalTime / mp.RUBBING_DURATION_REQUIRED) * 100));
            
            // Show region progress (time-based)
            const foreheadStatus = mp.faceRubbingState.forehead.rubbed ? '✓' : foreheadPercent + '%';
            const leftStatus = mp.faceRubbingState.leftSide.rubbed ? '✓' : leftPercent + '%';
            const rightStatus = mp.faceRubbingState.rightSide.rubbed ? '✓' : rightPercent + '%';
            
            const regionProgress = t('steps.faceRubbing.progress', {
                forehead: foreheadStatus,
                left: leftStatus,
                right: rightStatus
            });
            
            // Show holistic coverage percentage on separate line (informational only)
            const coverageText = `${t('steps.faceRubbing.coverage')}: ${mp.faceRubbingState.totalCoverage}%`;
            
            stepProgress.innerHTML = `${regionProgress}<br>${coverageText}`;
        }
    }
}

// Helper function to create analysis data object (used by upload, download, and submit)
function createAnalysisData() {
    return {
        session_id: analysisSession.sessionId,
        start_time: new Date(analysisSession.startTime).toISOString(),
        end_time: new Date().toISOString(),
        session_duration_seconds: (Date.now() - analysisSession.startTime) / 1000,
        total_steps: analysisSession.totalSteps,
        // Step-by-step timing data (duration only)
        step_info: {
            step1: { 
                duration: analysisSession.stepTimings.step1.duration,
                passed: ocrRecognized,
                skipped: ocrSkipped,
            },
            step2: { 
                duration: analysisSession.stepTimings.step2.duration,
                passed: mp.palmDetectionState.completed,
                skipped: palmSkipped,
            },
            step3: { 
                duration: analysisSession.stepTimings.step3.duration,
                forehead_seconds: mp.faceRubbingState.forehead.totalTime / 1000,
                left_cheek_seconds: mp.faceRubbingState.leftSide.totalTime / 1000,
                right_cheek_seconds: mp.faceRubbingState.rightSide.totalTime / 1000,
                coverage: mp.faceRubbingState.totalCoverage,
                passed: mp.faceRubbingState.forehead.rubbed && mp.faceRubbingState.leftSide.rubbed && mp.faceRubbingState.rightSide.rubbed,
            },
        },
        
        // Session metadata
        metadata: analysisSession.metadata,
        
        // MinIO file URLs (if available)
        minio_urls: minioFileUrls || null,

		assessment: {
			completed: analysisSession.currentStep === analysisSession.totalSteps,
			quality_score: 100,
			issues_detected: [],
			recommendations: []
    	}
    };
}

function nextStep() {
    if (!analysisSession.isActive) {
        utils.addLog('⚠️ No active tracking session', 'warning');
        return;
    }
    
    if (analysisSession.currentStep >= analysisSession.totalSteps) {
        utils.addLog('⚠️ Already at final step', 'warning');
        return;
    }
    
    // Preliminary step 0 (camera + face centering) requires face to be centered
    if (analysisSession.currentStep === 0 && !mp.faceCentered) {
        utils.addLog('⚠️ Please center your face in the frame first', 'warning');
        return;
    }
    
    // Step 1 (OCR) requires OCR recognition OR manual skip
    if (analysisSession.currentStep === 1 && !ocrRecognized && !ocrSkipped) {
        utils.addLog('⚠️ Please capture a frame with the product label showing', 'warning');
        return;
    }
    
    // Step 2 (Palm Detection) requires palm detection for 2 seconds OR manual skip
    if (analysisSession.currentStep === 2 && !mp.palmDetectionState.completed && !palmSkipped) {
        utils.addLog('⚠️ Please show your palm to the camera with fingers pointing down for 1 second', 'warning');
        return;
    }
    
    // Step 3 (Face Rubbing) requires all three face areas to be rubbed
    if (analysisSession.currentStep === 3) {
        const allAreasRubbed = mp.faceRubbingState.forehead.rubbed && 
                               mp.faceRubbingState.leftSide.rubbed && 
                               mp.faceRubbingState.rightSide.rubbed;
        if (!allAreasRubbed) {
            utils.addLog('⚠️ Please rub all three face areas (forehead, left, right) for 5 seconds each', 'warning');
            return;
        }
    }
    
    // End timing for current step (only if we're past preliminaries)
        const currentTime = Date.now();
        if (analysisSession.currentStep > 0) {
            const stepKey = `step${analysisSession.currentStep}` as keyof typeof analysisSession.stepTimings;
            const stepTiming = analysisSession.stepTimings[stepKey];
            if (stepTiming) {
                stepTiming.endTime = currentTime;
                stepTiming.duration = (currentTime - stepTiming.startTime) / 1000; // in seconds
            }
        }
    
    // Stop recording for current step (only if we're past preliminaries)
    if (cam.recordingConsent && analysisSession.currentStep > 0) {
        cam.stopStepRecording();
    }
    
    // Log step completion
    if (analysisSession.currentStep === 0) {
        utils.addLog('✅ Preliminaries completed: Camera ready and face centered', 'success');
        utils.addLog('📦 Step 1: Capture a frame showing the product label', 'info');
    } else if (analysisSession.currentStep === 1) {
        utils.addLog('✅ Step 1 completed: Product label recognized', 'success');
        utils.addLog('✋ Step 2: Show your palm to the camera with fingers pointing down for 2 seconds', 'info');
    } else if (analysisSession.currentStep === 2) {
        utils.addLog('✅ Step 2 completed: Hand palm detected for 2 seconds', 'success');
        utils.addLog('💆 Step 3: Rub your forehead, left cheek, and right cheek with your hand (5 seconds each)', 'info');
    } else if (analysisSession.currentStep === 3) {
        utils.addLog('✅ Step 3 completed: All face areas rubbed', 'success');
        utils.addLog('🎉 All steps completed! Click Finish to review', 'success');
    }
    
    analysisSession.currentStep++;
    utils.addLog(`📍 Moving to step ${analysisSession.currentStep}/${analysisSession.totalSteps}`);
    
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
        mp.palmDetectionState.detected = false;
        mp.palmDetectionState.startTime = 0;
        mp.palmDetectionState.totalTime = 0;
        mp.palmDetectionState.completed = false;
    }
    
    // Start timing for next step (only if we're entering actual steps, not preliminaries)
    if (analysisSession.currentStep > 0) {
        const nextStepKey = `step${analysisSession.currentStep}` as keyof typeof analysisSession.stepTimings;
        const nextStepTiming = analysisSession.stepTimings[nextStepKey];
        if (nextStepTiming) {
            nextStepTiming.startTime = currentTime;
        }
    }
    
    // Start recording for next step (only if we're entering actual steps)
    if (cam.recordingConsent && analysisSession.currentStep > 0 && analysisSession.currentStep <= analysisSession.totalSteps) {
        // Small delay to ensure clean transition
        setTimeout(() => {
            cam.startStepRecording(analysisSession.currentStep);
        }, 100);
    }
    
    // Record tracking data with face position
    const stepData = {
        timestamp: new Date().toISOString(),
        step: analysisSession.currentStep - 1,
        faceCentered: mp.faceCentered,
        facePosition: { ...mp.facePosition }
    };
    
    updateSessionUI();
    utils.updateResponse({
        message: 'Step completed',
        currentStep: analysisSession.currentStep,
        stepData: stepData
    });
}

async function submitAnalysis() {
    if (!analysisSession.isActive) {
        utils.addLog('⚠️ No active tracking session', 'warning');
        return;
    }
    
    // Hide review screen
    DOM.reviewScreen.style.display = 'none';
    
    // Disable submit button to prevent duplicate submissions
    DOM.submitAnalysisBtn.disabled = true;

    const analysisData = createAnalysisData();

    analysisData.assessment = {
        completed: analysisSession.currentStep === analysisSession.totalSteps,
        quality_score: 0.70 + Math.random() * 0.30,
        issues_detected: [],
        recommendations: []
    };
    
    // If in offline mode, download instead of upload
    if (server.offlineMode) {
        utils.addLog('💾 Offline mode: Downloading analysis data locally...', 'info');
        server.downloadAllRecordings(analysisData);
        return;
    }
    
    // Upload to MinIO first if consent was given, to get the file URLs
    if (cam.recordingConsent) {
        utils.addLog('☁️ Uploading files to MinIO first...', 'info');
		if (!MedichekConfig.minIO.enabled) {
			utils.addLog('⚠️ MinIO upload is disabled, downloading locally instead', 'warning');
			server.downloadAllRecordings(analysisData);
			ui.showCompletionScreen(false, 'Files downloaded locally', 'MinIO upload is disabled. Your files have been downloaded to your device.');
			return;
		}
        try {
            const res = await server.uploadToMinIO(analysisData);
            if (res && server.minioFileUrls) {
                // Include MinIO URLs for all uploaded files
                analysisData.minio_urls = minioFileUrls;
                utils.addLog('✅ MinIO upload completed, URLs captured', 'success');
            }
        } catch (error) {
            utils.addLog('⚠️ MinIO upload failed, continuing with analysis submission', 'warning');
        }
    }
    
    utils.addLog('📤 Submitting analysis results to server...');
    
    try {
        const response = await fetch(`${SERVER_URL}/api/analysis/`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(analysisData)
        });
        
        if (!response.ok) {
            // If server returns error status, try to parse error message
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server responded with status ${response.status}`);
        }
        
        const data = await response.json();
        utils.addLog(`✅ Analysis submitted successfully to server!`, 'success');
        utils.updateResponse(data);
    } catch (err: any) {
        utils.addLog('❌ Failed to submit analysis: ' + err.message, 'error');
        utils.addLog('💾 Analysis saved locally (can retry later)', 'info');
        
        // Save to localStorage as backup
        try {
            const savedAnalyses = JSON.parse(localStorage.getItem('medichek_analyses') || '[]');
            savedAnalyses.push(analysisData);
            localStorage.setItem('medichek_analyses', JSON.stringify(savedAnalyses));
            utils.addLog('💾 Analysis saved to browser storage', 'info');
        } catch (storageError) {
            console.error('Failed to save to localStorage:', storageError);
        }
        
        utils.updateResponse({ 
            error: err.message,
            localData: analysisData,
            note: 'Analysis saved locally - you can retry submission later'
        });
    }
}

// Auto-scanning OCR functionality
export function startAutoOcrScanning() {
    if (autoOcrInterval) return; // Already running
    
    // Scan every 2 seconds
    autoOcrInterval = setInterval(async () => {
        if (analysisSession.currentStep !== 1 || ocrRecognized || ocrSkipped) {
            stopAutoOcrScanning();
            return;
        }
        
        const res = await cam.performAutoOcrScan();

        if (res) {
            // Mark as recognized
            setOcrRecognized(true);
            currentOcrStatus = 'recognized';
            DOM.ocrStatusBadge.textContent = t('frame.ocrRecognized');
            DOM.ocrStatusBadge.className = 'ocr-status success';
            DOM.ocrResultCompact.innerHTML = '';
            
            utils.addLog('✅ Product label recognized!', 'success');
            
            // Stop auto-scanning
            stopAutoOcrScanning();
            
            // Update UI
            updateSessionUI();
            
            // Auto-advance after short delay
            setTimeout(() => {
                nextStep();
            }, 1500);
        }
    }, 1000);
    
    utils.addLog('🔍 Auto-scanning for product label...', 'info');
}

function stopAutoOcrScanning() {
    if (autoOcrInterval) {
        clearInterval(autoOcrInterval);
        autoOcrInterval = null;
    }
}

// OCR state
export let ocrRecognized = false;
export let ocrSkipped = false;
export function setOcrRecognized(recognized: boolean) {
    ocrRecognized = recognized;
}
export function setOcrSkipped(skipped: boolean) {
    ocrSkipped = skipped;
}

// Palm detection state
export let palmSkipped = false;
export function setPalmSkipped(skipped: boolean) {
    palmSkipped = skipped;
}

export async function performOCR(canvas: any) {
    try {
        const worker = await createWorker();
        
        const { data: { text } } = await worker.recognize(canvas);
        await worker.terminate();
        
        utils.addLog(`📄 OCR Text: ${text.trim()}`, 'info');
        
        // Check if "TEST" is in the recognized text (case-insensitive)
        const recognizedText = text.toUpperCase();
        const containsTest = recognizedText.includes('TEST');
        
        if (containsTest) {
            ocrRecognized = true;
            utils.addLog('✅ Product label recognized!', 'success');
            
            // Update compact display - only show success status
            currentOcrStatus = 'recognized';
            DOM.ocrStatusBadge.textContent = t('frame.ocrRecognized');
            DOM.ocrStatusBadge.className = 'ocr-status success';
            DOM.ocrResultCompact.innerHTML = '';  // No detailed message
            
            // Hide OCR analysis overlay
            DOM.ocrAnalysisOverlay.style.display = 'none';

            // Update button state
            updateSessionUI();
            
            // Auto-advance to next step after a short delay
            utils.addLog('⏭️ Auto-advancing to next step...', 'info');
            setTimeout(() => {
                nextStep();
            }, 1500); // 1.5 second delay to show success message
        } else {
            ocrRecognized = false;
            utils.addLog('❌ Product label not found in image. Try again.', 'error');
            
            // Update compact display - only show failed status
            currentOcrStatus = 'notFound';
            DOM.ocrStatusBadge.textContent = t('frame.ocrNotFound');
            DOM.ocrStatusBadge.className = 'ocr-status failed';
            DOM.ocrResultCompact.innerHTML = '';  // No detailed message
            
            // Hide OCR analysis overlay
            DOM.ocrAnalysisOverlay.style.display = 'none';
            
            // Show the modal for OCR failure
            DOM.ocrFailModal.style.display = 'flex';
        }
        
    } catch (err: any) {
        utils.addLog('❌ OCR failed: ' + err.message, 'error');
        
        // Update compact display - only show error status
        currentOcrStatus = 'error';
        DOM.ocrStatusBadge.textContent = t('frame.ocrError');
        DOM.ocrStatusBadge.className = 'ocr-status failed';
        DOM.ocrResultCompact.innerHTML = '';  // No detailed error message
        
        // Hide OCR analysis overlay
        DOM.ocrAnalysisOverlay.style.display = 'none';
    }
}

// Restart session from review screen
function restartSession() {
    // Hide review screen
    DOM.reviewScreen.style.display = 'none';
    
    // Reset everything
    location.reload();
}

//#region Event listeners

addEventListener('load', () => {
    // Initialize language
    updateLanguage(localStorage.getItem('medichek-language') || 'en');
    
    // Initialize application
    initializeApplication();
});

// Event listeners for loading screen
DOM.continueOfflineBtn.addEventListener('click', server.continueOffline);
DOM.retryConnectionBtn.addEventListener('click', async () => {
    DOM.offlinePrompt.style.display = 'none';
    await initializeApplication();
});

// Language selector event listeners
DOM.langEnBtn.addEventListener('click', () => {
    updateLanguage('en');
    // Re-translate dynamic content after language change
    ui.updateLoadingScreenStatuses(currentServerStatus, currentMinioStatus);
    ui.updateServerStatus(currentServerStatus);
    ui.updateFrameCaptureStatuses(currentOcrStatus, cam.currentPalmStatus);
    updateSessionUI();
});

DOM.langZhBtn.addEventListener('click', () => {
    updateLanguage('zh');
    // Re-translate dynamic content after language change
    ui.updateLoadingScreenStatuses(currentServerStatus, currentMinioStatus);
    ui.updateServerStatus(currentServerStatus);
    ui.updateFrameCaptureStatuses(currentOcrStatus, cam.currentPalmStatus);
    updateSessionUI();
});

DOM.startTrackingBtn.addEventListener('click', cam.startTracking);

DOM.captureFrameBtn.addEventListener('click', async () => {
    if (analysisSession.currentStep == 1) {
        currentOcrStatus = 'analyzing';
        performOCR(await cam.captureFrame(1));
    } else if (analysisSession.currentStep == 2) {
        // Capture frame for step 2 (palm detection)
        await cam.captureFrame(2);
        if (cam.currentPalmStatus === 'captured') {
            // Show palm detection fail modal (since step 2 requires no OCR, just manual capture for backend review)
            DOM.palmFailModal.style.display = 'flex';
        }
    }
});

DOM.nextStepBtn.addEventListener('click', nextStep);
DOM.finishSessionBtn.addEventListener('click', () => {
    // End timing for step 3
    const currentTime = Date.now();
    if (analysisSession.stepTimings.step3.startTime && !analysisSession.stepTimings.step3.endTime) {
        analysisSession.stepTimings.step3.endTime = currentTime;
        analysisSession.stepTimings.step3.duration = 
            (currentTime - analysisSession.stepTimings.step3.startTime) / 1000;
    }
    ui.showReviewScreen();
});

DOM.submitAnalysisBtn.addEventListener('click', submitAnalysis);
DOM.restartSessionBtn.addEventListener('click', restartSession);

// Modal event handlers
DOM.acceptRecordingBtn.addEventListener('click', async () => {
    try {
        // Wait for the promise to resolve so analysisSession gets the actual object
        analysisSession = await cam.acceptRecordingConsent();
        updateSessionUI();
        utils.addLog(`✅ Tracking session started: ${analysisSession.sessionId}`, 'success');
        utils.addLog('📊 All tracking is performed locally on this device', 'info');
        utils.addLog('📹 Requesting camera access...', 'info');
        
        // Enable camera (preliminary step, not tracked)
        cameraEnabled = await cam.enableCamera();

		if (cameraEnabled) {
			utils.addLog('✅ Camera access granted', 'success');
			// Initialize MediaPipe Face Detection
			initializeFaceDetection();
			
			// Initialize MediaPipe Hands Detection
			initializeHandsDetection();
			
			// Initialize MediaPipe Face Mesh (for Step 3)
			initializeFaceMesh();
			
			// Start camera processing with MediaPipe
			await cam.setCameraInstance(new Camera(DOM.webcam, {
				onFrame: async () => {
					// Optimize by only running necessary models for current step
					
					// Step 0 (Preliminaries): Only need face detection
					if (analysisSession.currentStep === 0) {
						await faceDetection!.send({image: DOM.webcam});
					}
					// Step 1 (OCR): Use face detection to keep camera feed updating and draw OCR overlay
					else if (analysisSession.currentStep === 1) {
						await faceDetection!.send({image: DOM.webcam});
					}
					// Step 2 (Palm Detection): Only need hands detection (no face tracking needed)
					else if (analysisSession.currentStep === 2) {
						await handsDetection!.send({image: DOM.webcam});
					}
					// Step 3 (Face Rubbing): Need both models - run in parallel for better FPS
					else if (analysisSession.currentStep === 3) {
						// Run both models in parallel instead of sequentially
						await Promise.all([
							faceMesh!.send({image: DOM.webcam}),
							handsDetection!.send({image: DOM.webcam})
						]);
					}
				},
				width: 640,   // Reduced from 1280 for better FPS (processing resolution)
				height: 480   // Reduced from 720 for better FPS (processing resolution)
			}));

			utils.addLog('🎥 Face tracking started', 'success');
			utils.addLog('✋ Hand tracking started', 'success');
			utils.addLog('✅ Step 1: Video feed established - Click "Next Step" to continue', 'success');

			// Note: Recording starts when moving from preliminaries to step 1

			utils.updateResponse({
				message: 'Session started - tracking locally',
				session: analysisSession
			});
		}

		updateSessionUI();
    } catch (err: any) {
        utils.addLog('❌ Failed to start recording session: ' + (err && err.message ? err.message : err), 'error');
    }
});
DOM.declineRecordingBtn.addEventListener('click', cam.declineRecordingConsent);

DOM.retryOcrBtn.addEventListener('click', () => {
    // Hide the modal
    DOM.ocrFailModal.style.display = 'none';
    
    // Reset the captured frame state to allow new capture
    cam.resetCapturedFrame();
    setOcrRecognized(false);
    setOcrSkipped(false);
    
    // Re-enable capture button for retry
    DOM.captureFrameBtn.disabled = false;
    
    utils.addLog('Retry OCR - Capture a new frame', 'info');
    
    // Update UI to allow recapture
    updateSessionUI();
});

DOM.continueAnywayBtn.addEventListener('click', () => {
    // Hide the modal
    DOM.ocrFailModal.style.display = 'none';

    // Mark as manually reviewed/skipped
    setOcrSkipped(true);
    
    // Update the status badge to show manual review
    currentOcrStatus = 'review';
    DOM.ocrStatusBadge.textContent = t('frame.ocrReview');
    DOM.ocrStatusBadge.className = 'ocr-status warning';

    utils.addLog('OCR verification skipped - proceeding with manual review', 'warning');
    
    // Automatically advance to the next step
    nextStep();
});

// Palm detection modal event handlers
DOM.retryPalmBtn.addEventListener('click', () => {
    // Hide the modal
    DOM.palmFailModal.style.display = 'none';
    
    // Reset the captured frame state to allow new capture
    cam.resetCapturedFrame();
    setPalmSkipped(false);
    
    // Re-enable capture button for retry
    DOM.captureFrameBtn.disabled = false;
    
    utils.addLog('Retry palm detection - Capture a new frame', 'info');
    
    // Update UI to allow recapture
    updateSessionUI();
});

DOM.continuePalmAnywayBtn.addEventListener('click', () => {
    // Hide the modal
    DOM.palmFailModal.style.display = 'none';

    // Mark as manually reviewed/skipped
    setPalmSkipped(true);
    
    // Update the status badge to show manual review
    DOM.palmStatusBadge.textContent = t('frame.ocrReview');  // Reusing the review text
    DOM.palmStatusBadge.className = 'palm-status warning';

    utils.addLog('Palm detection skipped - proceeding with manual review', 'warning');
    
    // Automatically advance to the next step
    nextStep();
});

// Start new session button
DOM.startNewSessionBtn.addEventListener('click', () => {
    // Reload the page to start fresh
    location.reload();
});

// Download analysis button (after upload completion)
DOM.downloadAnalysisBtn.addEventListener('click', async () => {
    utils.addLog('📥 Downloading analysis data...', 'info');
    
    // Hide completion screen
    DOM.completionScreen.style.display = 'none';
    
    // Show download overlay
    DOM.downloadOverlay.style.display = 'flex';

    // Create analysis data
    const analysisData = createAnalysisData();
    
    // Call the download function
    await server.downloadAllRecordings(analysisData);
});

//#endregion

// Initialize
async function initializeApplication() {
	// Check Server
	currentServerStatus = 'Checking...';
	DOM.serverCheckStatus.textContent = t('loading.checking');
	DOM.serverCheckStatus.className = 'check-status checking';
	currentMinioStatus = 'Checking...';
	DOM.minioCheckStatus.textContent = t('loading.checking');
	DOM.minioCheckStatus.className = 'check-status checking';

    const { serverOnline, minioOnline } = await server.checkServers();

	if (serverOnline) {
		currentServerStatus = 'Connected';
		DOM.serverCheckStatus.textContent = t('loading.online');
		DOM.serverCheckStatus.className = 'check-status online';
	} else {
		currentServerStatus = 'Disconnected';
		DOM.serverCheckStatus.textContent = t('loading.offline');
		DOM.serverCheckStatus.className = 'check-status offline';
	}
	
	if (minioOnline) {
		currentMinioStatus = 'Connected';
		DOM.minioCheckStatus.textContent = t('loading.online');
		DOM.minioCheckStatus.className = 'check-status online';
	} else {
		currentMinioStatus = 'Disconnected';
		DOM.minioCheckStatus.textContent = t('loading.offline');
		DOM.minioCheckStatus.className = 'check-status offline';
	}
	
	// If both servers are online, proceed normally
	if (serverOnline && minioOnline) {
		ui.updateServerStatus('Connected');
		ui.hideLoadingScreen();
	} else {
		// Show offline prompt
		DOM.offlinePrompt.style.display = 'flex';
	}
    updateSessionUI();
}

// Initialize MediaPipe Face Detection
function initializeFaceDetection() {
    utils.addLog('🤖 Initializing MediaPipe Face Detection...', 'info');
    
    faceDetection = new FaceDetection({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
        }
    });
    
    faceDetection.setOptions({
        model: 'short',
        minDetectionConfidence: 0.5
    });
    
    faceDetection.onResults((results) => {
        // Show warning toast if face is not centered (for steps that need it, but skip step 1 OCR)
        if (analysisSession.currentStep > 0 && analysisSession.currentStep !== 1 && analysisSession.isActive && !mp.faceCentered) {
            ui.showWarningToast(t('warning.centerFace'));
        } else if (mp.faceCentered || analysisSession.currentStep === 1) {
            ui.hideWarningToast();
        }
        mp.onFaceDetectionResults(results);
        if (analysisSession.currentStep === 0) {
            mp.drawFaceBoundingBox(results);
        }
        if (analysisSession.currentStep === 1) {
            mp.drawOcrCaptureArea();
        }
        updateSessionUI();
    });
    
    utils.addLog('✅ Face detection initialized', 'success');
}

// Initialize MediaPipe Hands
function initializeHandsDetection() {
    utils.addLog('🤖 Initializing MediaPipe Hands Detection...', 'info');
    
    handsDetection = new Hands({
        locateFile: (file: any) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });
    
    handsDetection.setOptions({
        maxNumHands: 2,  // Allow detection of up to 2 hands
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    handsDetection.onResults((results) => {
        if (analysisSession.currentStep !== 2 && analysisSession.currentStep !== 3) return;
        mp.onHandsDetectionResults(results);
        updateSessionUI();
    });
    
    utils.addLog('✅ Hands detection initialized', 'success');
}

// Initialize MediaPipe Face Mesh (for Step 3)
function initializeFaceMesh() {
    utils.addLog('🤖 Initializing MediaPipe Face Mesh...', 'info');
    
    faceMesh = new FaceMesh({
        locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });
    
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,  // Disable for better performance (we don't need iris/lips detail)
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    faceMesh.onResults((results) => {
        if (analysisSession.currentStep !== 3) return;
        mp.onFaceMeshResults(results);
        updateSessionUI();
    });
    
    utils.addLog('✅ Face mesh initialized', 'success');
}


