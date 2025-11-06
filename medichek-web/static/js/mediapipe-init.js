/**
 * MediaPipe Initialization Module
 * 
 * Handles initialization of all MediaPipe models:
 * - Face Detection (for face centering and OCR step)
 * - Hands Detection (for palm and face rubbing detection)
 * - Face Mesh (for face rubbing tracking)
 */

import { addLog } from './utils.js';
import { 
    setFaceDetection, 
    setHandsDetection, 
    setFaceMesh 
} from './mediapipe-state.js';

/**
 * Initialize MediaPipe Face Detection
 * Used for face centering validation in preliminaries and OCR steps
 */
export function initializeFaceDetection() {
    addLog('🤖 Initializing MediaPipe Face Detection...', 'info');
    
    const faceDetection = new FaceDetection({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
        }
    });
    
    faceDetection.setOptions({
        model: 'short',
        minDetectionConfidence: 0.5
    });
    
    // Note: onResults callback will be set by the face-detection module
    // faceDetection.onResults(onFaceDetectionResults);
    
    setFaceDetection(faceDetection);
    
    addLog('✅ Face detection initialized', 'success');
    
    return faceDetection;
}

/**
 * Initialize MediaPipe Hands Detection
 * Used for palm detection and hand tracking during face rubbing
 */
export function initializeHandsDetection() {
    addLog('🤖 Initializing MediaPipe Hands Detection...', 'info');
    
    const handsDetection = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });
    
    handsDetection.setOptions({
        maxNumHands: 2,  // Allow detection of up to 2 hands
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    // Note: onResults callback will be set by the hand-detection module
    // handsDetection.onResults(onHandsDetectionResults);
    
    setHandsDetection(handsDetection);
    
    addLog('✅ Hands detection initialized', 'success');
    
    return handsDetection;
}

/**
 * Initialize MediaPipe Face Mesh
 * Used for detailed face landmark tracking during face rubbing step
 */
export function initializeFaceMesh() {
    addLog('🤖 Initializing MediaPipe Face Mesh...', 'info');
    
    const faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });
    
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,  // Disable for better performance (we don't need iris/lips detail)
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    // Note: onResults callback will be set by the face-mesh module
    // faceMesh.onResults(onFaceMeshResults);
    
    setFaceMesh(faceMesh);
    
    addLog('✅ Face mesh initialized', 'success');
    
    return faceMesh;
}

/**
 * Initialize all MediaPipe models at once
 * Convenience function to initialize all models during camera setup
 */
export function initializeAllMediaPipe() {
    initializeFaceDetection();
    initializeHandsDetection();
    initializeFaceMesh();
    
    addLog('✅ All MediaPipe models initialized', 'success');
}
