/**
 * Camera Module
 * 
 * Handles all camera and video recording functionality:
 * - Camera initialization and stream management
 * - Video recording with MediaRecorder
 * - Step-by-step recording control
 * - Recording consent management
 */

import { addLog } from './utils.js';
import { analysisSession } from './config.js';
import { webcam } from './dom-elements.js';
import { setCameraEnabled } from './ui-manager.js';

// Module-level state
let cameraEnabled = false;
let videoStream = null;
let camera = null;
let mediaRecorder = null;
let recordedChunks = [];
let currentStepRecording = null;
let recordingConsent = false;

// Step recordings storage
let stepRecordings = {
    step1: null,
    step2: null,
    step3: null
};

/**
 * Get camera enabled state
 * @returns {boolean} Whether camera is enabled
 */
export function getCameraEnabled() {
    return cameraEnabled;
}

/**
 * Get video stream
 * @returns {MediaStream|null} The video stream
 */
export function getVideoStream() {
    return videoStream;
}

/**
 * Get camera instance
 * @returns {Camera|null} The MediaPipe camera instance
 */
export function getCamera() {
    return camera;
}

/**
 * Set camera instance
 * @param {Camera} cameraInstance - The MediaPipe camera instance
 */
export function setCamera(cameraInstance) {
    camera = cameraInstance;
}

/**
 * Get recording consent status
 * @returns {boolean} Whether user has given recording consent
 */
export function getRecordingConsent() {
    return recordingConsent;
}

/**
 * Set recording consent
 * @param {boolean} consent - Whether user consents to recording
 */
export function setRecordingConsent(consent) {
    recordingConsent = consent;
}

/**
 * Get step recordings
 * @returns {Object} Object containing all step recordings
 */
export function getStepRecordings() {
    return stepRecordings;
}

/**
 * Get current step recording number
 * @returns {number|null} The current step being recorded
 */
export function getCurrentStepRecording() {
    return currentStepRecording;
}

/**
 * Enable camera and initialize video stream
 * Note: MediaPipe initialization should be done separately after camera is enabled
 * @returns {Promise<boolean>} Whether camera was successfully enabled
 */
export async function enableCamera() {
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
        setCameraEnabled(true);
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            webcam.onloadedmetadata = () => {
                webcam.play();
                resolve();
            };
        });
        
        addLog('📹 Camera enabled successfully!', 'success');
        
        return true;
    } catch (err) {
        addLog('❌ Camera access denied: ' + err.message, 'error');
        return false;
    }
}

/**
 * Start recording for a specific step
 * @param {number} stepNumber - The step number to record (1, 2, or 3)
 */
export function startStepRecording(stepNumber) {
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

/**
 * Stop the current step recording
 */
export function stopStepRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        addLog(`⏹️ Recording stopped for Step ${currentStepRecording}`, 'info');
    }
}

/**
 * Stop camera and cleanup resources
 */
export function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    
    if (camera) {
        camera.stop();
        camera = null;
    }
    
    cameraEnabled = false;
    setCameraEnabled(false);
    addLog('📹 Camera stopped', 'info');
}

/**
 * Get media recorder state
 * @returns {string|null} The MediaRecorder state ('inactive', 'recording', 'paused') or null
 */
export function getMediaRecorderState() {
    return mediaRecorder ? mediaRecorder.state : null;
}
