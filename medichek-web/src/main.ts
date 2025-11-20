import * as DOM from './dom';
import * as utils from './utils.js';
import * as cam from './camera.js';
import * as server from './server_manager.js';
import * as ui from './ui_manager.js';
import * as mp from './mp_manager.js';

import { FilesetResolver, FaceDetector, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';
import { Camera } from '@mediapipe/camera_utils';
import { t, updateLanguage } from './translations';
import Tesseract from 'tesseract.js';

//#region Declarations

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

// Global state - Client-side only, no server sessions
let analysisSession = {
    sessionId: urlParams.get('process_id') || '00000000',
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

let faceDetector: FaceDetector | null = null;
let handLandmarker: HandLandmarker | null = null;
let faceLandmarker: FaceLandmarker | null = null;

// Automatic OCR scanning
let autoOcrInterval: NodeJS.Timeout | null = null;
const ocrTargetString = urlParams.get('product_number') || '1234567890';


const vision = await FilesetResolver.forVisionTasks(".");

//#endregion

function updateSessionUI() {
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
            // const coverageText = `${t('steps.faceRubbing.coverage')}: ${mp.faceRubbingState.totalCoverage}%`;
            
            stepProgress.innerHTML = `${regionProgress}`;
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
                passed: !ocrSkipped,
            },
            step2: { 
                duration: analysisSession.stepTimings.step2.duration,
                passed: !palmSkipped,
            },
            step3: { 
                duration: analysisSession.stepTimings.step3.duration,
                forehead_seconds: mp.faceRubbingState.forehead.totalTime / 1000,
                left_cheek_seconds: mp.faceRubbingState.leftSide.totalTime / 1000,
                right_cheek_seconds: mp.faceRubbingState.rightSide.totalTime / 1000,
                coverage_percentage: mp.faceRubbingState.totalCoverage,
                passed: mp.faceRubbingState.forehead.rubbed && mp.faceRubbingState.leftSide.rubbed && mp.faceRubbingState.rightSide.rubbed,
            },
        },
        
        // Session metadata
        metadata: analysisSession.metadata,
        
        // MinIO file URLs (if available)
        minio_urls: minioFileUrls || null,

		assessment: {
			completed: analysisSession.currentStep === analysisSession.totalSteps,
			quality_score: 0,
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
        DOM.captureFrameBtn.disabled = false;
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
    
    // If in offline mode, download instead of upload
    if (server.offlineMode) {
        utils.addLog('💾 Offline mode: Downloading analysis data locally...', 'info');
        server.downloadAllRecordings(analysisData);
        return;
    }
    
    // Show upload overlay for the entire upload process
    DOM.uploadOverlay.style.display = 'flex';
    
    // Track upload success for both MinIO and analysis server
    let minioUploadSuccess = false;
    let analysisUploadSuccess = false;
    
    // Upload to MinIO first if consent was given, to get the file URLs
    if (cam.recordingConsent) {
        try {
            const res = await server.uploadToMinIO(analysisData);
            if (res && server.minioFileUrls) {
                // Include MinIO URLs for all uploaded files
                minioFileUrls = analysisData.minio_urls;
                minioUploadSuccess = true;
                utils.addLog('✅ MinIO upload completed, URLs captured', 'success');
            }
        } catch (error) {
            minioUploadSuccess = false;
            utils.addLog('❌ MinIO upload failed', 'error');
        }
    } else {
        // If no recording consent, consider MinIO upload as "success" (not applicable)
        minioUploadSuccess = true;
    }
    
    // Try to upload analysis data to server (keep overlay visible)
    try {
        const result = await server.uploadAnalysisToServer(analysisData);
        analysisUploadSuccess = (result !== null);
    } catch (error) {
        analysisUploadSuccess = false;
        utils.addLog('❌ Analysis submission failed', 'error');
    }
    
    // Hide upload overlay now that both uploads are complete
    DOM.uploadOverlay.style.display = 'none';
    
    // Handle different scenarios based on upload results
    if (minioUploadSuccess && analysisUploadSuccess) {
        // Both succeeded - no download button needed
        ui.showCompletionScreen(
            true, 
            t('completion.uploadSuccess'), 
            t('completion.uploadMessage'),
            `<p><strong>${t('completion.sessionId')}:</strong> ${analysisData.session_id}</p>
             <p><strong>${t('completion.date')}:</strong> ${new Date().toLocaleString()}</p>`,
            true
        );
    } else if (!minioUploadSuccess && !analysisUploadSuccess) {
        // Both failed - show download button
        utils.addLog('⚠️ MinIO和分析数据上传均失败。请点击下载按钮保存数据到本地。', 'warning');
        ui.showCompletionScreen(
            false, 
            '上传失败', 
            'MinIO和分析服务器上传均失败。请点击下方按钮下载您的文件。',
            '<p>⚠️ MinIO上传：失败<br>⚠️ 分析上传：失败</p>',
            true
        );
    } else if (!minioUploadSuccess) {
        // MinIO failed but analysis succeeded - show download button for recordings
        utils.addLog('⚠️ MinIO上传失败，但分析数据已提交。请点击下载按钮保存录制文件到本地。', 'warning');
        ui.showCompletionScreen(
            false, 
            '部分上传成功', 
            '分析数据已提交，但文件上传失败。请点击下方按钮下载您的文件。',
            '<p>⚠️ MinIO上传：失败<br>✅ 分析上传：成功</p>',
            true
        );
    } else if (!analysisUploadSuccess) {
        // Analysis failed but MinIO succeeded - show download button
        utils.addLog('⚠️ 分析数据上传失败，但MinIO上传成功。请点击下载按钮保存数据到本地。', 'warning');
        ui.showCompletionScreen(
            false, 
            '部分上传成功', 
            '文件已上传，但分析数据提交失败。请点击下方按钮下载您的文件。',
            '<p>✅ MinIO上传：成功<br>⚠️ 分析上传：失败</p>',
            true
        );
    }
}

// Auto-scanning OCR functionality
function startAutoOcrScanning() {
    if (autoOcrInterval) return; // Already running
    
    // Scan every second
    autoOcrInterval = setInterval(async () => {
        if (analysisSession.currentStep !== 1 || ocrRecognized || ocrSkipped) {
            stopAutoOcrScanning();
            return;
        }
        
        const res = await cam.performAutoOcrScan(ocrTargetString);

        if (res) {
            stopAutoOcrScanning();
            clearInterval(autoOcrInterval!);
            // Mark as recognized
            ocrRecognized = true;
            DOM.ocrStatusBadge.textContent = t('frame.ocrRecognized');
            DOM.ocrStatusBadge.className = 'ocr-status success';
            DOM.ocrResultCompact.innerHTML = '';
            
            utils.addLog('✅ Product label recognized!', 'success');
            
            // Update UI
            updateSessionUI();
            
            // Auto-advance after short delay
            setTimeout(() => {
                nextStep();
            }, 1500);
        }
    }, 500);
    
    utils.addLog('🔍 Auto-scanning for product label...', 'info');
}

function stopAutoOcrScanning() {
    if (autoOcrInterval) {
        clearInterval(autoOcrInterval);
        autoOcrInterval = null;
    }
}

// OCR state
let ocrRecognized = false;
let ocrSkipped = false;

// Palm detection state
let palmSkipped = false;

async function performOCR(canvas: any) {
    try {
        const worker = await Tesseract.createWorker({ workerPath: './worker.min.js', corePath: './tesseract-core-simd.wasm.js', langPath: './tessdata' });
        await worker.loadLanguage('chi_sim');
        await worker.initialize('chi_sim');
        const { data: { text } } = await worker.recognize(canvas);
        await worker.terminate();
        
        utils.addLog(`📄 OCR Text: ${text.trim()}`, 'info');
        
        // Check if the target string is present in the recognized text
        const recognizedText = text;
        const targetString = ocrTargetString;

        if (recognizedText.includes(targetString)) {
            ocrRecognized = true;
            utils.addLog('✅ Product label recognized!', 'success');

            // Update compact display - only show success status
            DOM.ocrStatusBadge.textContent = t('frame.ocrRecognized');
            DOM.ocrStatusBadge.className = 'ocr-status success';
            DOM.ocrResultCompact.innerHTML = '';

            // Hide OCR analysis overlay
            DOM.ocrAnalysisOverlay.style.display = 'none';

            // Update button state
            updateSessionUI();

            // Auto-advance to next step after a short delay
            utils.addLog('⏭️ Auto-advancing to next step...', 'info');
            setTimeout(() => {
                nextStep();
            }, 1500);
        } else {
            ocrRecognized = false;
            utils.addLog('❌ Product label not found in image. Try again.', 'error');

            // Update compact display - only show failed status
            DOM.ocrStatusBadge.textContent = t('frame.ocrNotFound');
            DOM.ocrStatusBadge.className = 'ocr-status failed';
            DOM.ocrResultCompact.innerHTML = '';

            // Hide OCR analysis overlay
            DOM.ocrAnalysisOverlay.style.display = 'none';

            // Show the modal for OCR failure
            DOM.ocrFailModal.style.display = 'flex';
        }
        
    } catch (err: any) {
        utils.addLog('❌ OCR failed: ' + err.message, 'error');
        
        // Update compact display - only show error status
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
    // Check if language is already set
    // Show language selection modal and hide loading screen
    DOM.loadingScreen.style.display = 'flex';
    initializeApplication();
    updateLanguage('zh');
});

// Event listeners for language selection modal
// Language selector event listeners
DOM.langEnBtn.addEventListener('click', () => {
    updateLanguage('en');
    // Re-translate dynamic content after language change
    updateSessionUI();
});

DOM.langZhBtn.addEventListener('click', () => {
    updateLanguage('zh');
    // Re-translate dynamic content after language change
    updateSessionUI();
});

// Event listeners for loading screen
DOM.continueOfflineBtn.addEventListener('click', server.continueOffline);
DOM.retryConnectionBtn.addEventListener('click', async () => {
    DOM.offlinePrompt.style.display = 'none';
    await initializeApplication();
});

DOM.startTrackingBtn.addEventListener('click', cam.startTracking);

DOM.captureFrameBtn.addEventListener('click', async () => {
    DOM.captureFrameBtn.disabled = true; // Prevent multiple clicks
    if (analysisSession.currentStep == 1) {
        stopAutoOcrScanning();
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
        analysisSession = await cam.acceptRecordingConsent(analysisSession.sessionId);
        updateSessionUI();
        utils.addLog(`✅ Tracking session started: ${analysisSession.sessionId}`, 'success');
        utils.addLog('📊 All tracking is performed locally on this device', 'info');
        utils.addLog('📹 Requesting camera access...', 'info');
        
        // Enable camera (preliminary step, not tracked)
        cameraEnabled = await cam.enableCamera();

		if (cameraEnabled) {
			utils.addLog('✅ Camera access granted', 'success');
			
			// Start camera processing with MediaPipe
			let lastVideoTime = -1;
			await cam.setCameraInstance(new Camera(DOM.webcam, {
				onFrame: async () => {
					// Optimize by only running necessary models for current step
					const currentTime = performance.now();
					
					// Step 0 (Preliminaries): Only need face detection
					if (analysisSession.currentStep === 0) {
						if (DOM.webcam.currentTime !== lastVideoTime && faceDetector) {
							lastVideoTime = DOM.webcam.currentTime;
							const results = faceDetector.detectForVideo(DOM.webcam, currentTime);
							
							// Process results
							if (analysisSession.isActive && !mp.faceCentered) {
								ui.showWarningToast(t('warning.centerFace'));
							} else {
								ui.hideWarningToast();
							}
							mp.onFaceDetectionResults(results);
							mp.drawFaceBoundingBox(results);
							updateSessionUI();
						}
					}
					// Step 1 (OCR): Use face detection to keep camera feed updating and draw OCR overlay
					else if (analysisSession.currentStep === 1) {
						if (DOM.webcam.currentTime !== lastVideoTime && faceDetector) {
							lastVideoTime = DOM.webcam.currentTime;
							const results = faceDetector.detectForVideo(DOM.webcam, currentTime);
							
							// Process results and draw OCR overlay
							mp.onFaceDetectionResults(results);
							mp.drawOcrCaptureArea();
							updateSessionUI();
						}
					}
					// Step 2 (Palm Detection): Only need hands detection (no face tracking needed)
					else if (analysisSession.currentStep === 2) {
						if (DOM.webcam.currentTime !== lastVideoTime && handLandmarker) {
							lastVideoTime = DOM.webcam.currentTime;
							const results = handLandmarker.detectForVideo(DOM.webcam, currentTime);
							
							// Process results
							mp.onHandsDetectionResults(results, analysisSession.currentStep);
							updateSessionUI();
						}
					}
					// Step 3 (Face Rubbing): Need both models - run in parallel for better FPS
					else if (analysisSession.currentStep === 3) {
						if (DOM.webcam.currentTime !== lastVideoTime && handLandmarker && faceLandmarker) {
							lastVideoTime = DOM.webcam.currentTime;
							
							// Run both detections
							const handResults = handLandmarker.detectForVideo(DOM.webcam, currentTime);
							const faceResults = faceLandmarker.detectForVideo(DOM.webcam, currentTime);
							
							// Process results
							mp.onFaceMeshResults(faceResults);
							mp.onHandsDetectionResults(handResults, analysisSession.currentStep);
							updateSessionUI();
						}
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
    ocrRecognized = false;
    ocrSkipped = false;
    
    // Re-enable capture button for retry
    DOM.captureFrameBtn.disabled = false;
    
    utils.addLog('Retry OCR - Capture a new frame', 'info');

    startAutoOcrScanning()
    
    // Update UI to allow recapture
    updateSessionUI();
});

DOM.continueAnywayBtn.addEventListener('click', () => {
    // Hide the modal
    DOM.ocrFailModal.style.display = 'none';

    // Mark as manually reviewed/skipped
    ocrSkipped = true;
    
    // Update the status badge to show manual review
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
    palmSkipped = false;
    
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
    palmSkipped = true;
    
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
	// General initializing screen with status for each subsystem
    DOM.loadingScreen.style.display = 'flex';
    // Add new status elements for MediaPipe initializers
    const statusMap = {
        server: { el: DOM.serverCheckStatus, label: t('loading.server'), status: 'checking' },
        minio: { el: DOM.minioCheckStatus, label: t('loading.minio'), status: 'checking' },
        face: { el: DOM.faceCheckStatus, label: 'Face Detection', status: 'checking' },
        hands: { el: DOM.handsCheckStatus, label: 'Hands Detection', status: 'checking' },
        mesh: { el: DOM.meshCheckStatus, label: 'Face Mesh', status: 'checking' }
    };

    // Set all to checking
    Object.values(statusMap).forEach(({ el }) => {
        el.textContent = t('loading.checking');
        el.className = 'check-status checking';
    });

    // Server checks
    const { serverOnline, minioOnline } = await server.checkServers();
    statusMap.server.el.textContent = serverOnline ? t('loading.online') : t('loading.offline');
    statusMap.server.el.className = serverOnline ? 'check-status online' : 'check-status offline';
    statusMap.minio.el.textContent = minioOnline ? t('loading.online') : t('loading.offline');
    statusMap.minio.el.className = minioOnline ? 'check-status online' : 'check-status offline';

    // MediaPipe initializers
    try {
        await initializeFaceDetection();
        statusMap.face.el.textContent = '已初始化';
        statusMap.face.el.className = 'check-status online';
    } catch {
        statusMap.face.el.textContent = '失败';
        statusMap.face.el.className = 'check-status offline';
    }
    try {
        await initializeHandsDetection();
        statusMap.hands.el.textContent = '已初始化';
        statusMap.hands.el.className = 'check-status online';
    } catch {
        statusMap.hands.el.textContent = '失败';
        statusMap.hands.el.className = 'check-status offline';
    }
    try {
        await initializeFaceMesh();
        statusMap.mesh.el.textContent = '已初始化';
        statusMap.mesh.el.className = 'check-status online';
    } catch {
        statusMap.mesh.el.textContent = '失败';
        statusMap.mesh.el.className = 'check-status offline';
    }

    // Hide loading screen and show offline prompt only if server or minio failed
    if (serverOnline && minioOnline) {
        ui.updateServerStatus('Connected');
        DOM.loadingScreen.style.display = 'none';
    } else {
        DOM.offlinePrompt.style.display = 'flex';
    }
    updateSessionUI();
}

// Initialize MediaPipe Face Detection
async function initializeFaceDetection() {
    utils.addLog('🤖 Initializing MediaPipe Face Detection...', 'info');
    
    faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: './blaze_face_short_range.tflite',
            delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5
    });
    
    utils.addLog('✅ Face detection initialized', 'success');
}

// Initialize MediaPipe Hands
async function initializeHandsDetection() {
    utils.addLog('🤖 Initializing MediaPipe Hands Detection...', 'info');
    
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: './hand_landmarker.task',
            delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    utils.addLog('✅ Hands detection initialized', 'success');
}

// Initialize MediaPipe Face Mesh (for Step 3)
async function initializeFaceMesh() {
    utils.addLog('🤖 Initializing MediaPipe Face Mesh...', 'info');
    
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: './face_landmarker.task',
            delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false
    });
    
    utils.addLog('✅ Face mesh initialized', 'success');
}


