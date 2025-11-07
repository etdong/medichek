import * as utils from './utils.js';
import { t } from './translations.js';

// OCR state
export let ocrRecognized = false;
export let ocrSkipped = false;
export function setOcrRecognized(recognized: boolean) {
    ocrRecognized = recognized;
}
export function setOcrSkipped(skipped: boolean) {
    ocrSkipped = skipped;
}

export async function performOCR(canvas) {
    try {
        const worker = await Tesseract.createWorker();
        
        const { data: { text, confidence } } = await worker.recognize(canvas);
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
            ocrStatusBadge.textContent = t('frame.ocrRecognized');
            ocrStatusBadge.className = 'ocr-status success';
            ocrResultCompact.innerHTML = '';  // No detailed message
            
            // Hide OCR analysis overlay
            ocrAnalysisOverlay.style.display = 'none';
            
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
            ocrStatusBadge.textContent = t('frame.ocrNotFound');
            ocrStatusBadge.className = 'ocr-status failed';
            ocrResultCompact.innerHTML = '';  // No detailed message
            
            // Hide OCR analysis overlay
            ocrAnalysisOverlay.style.display = 'none';
            
            // Show the modal for OCR failure
            ocrFailModal.style.display = 'flex';
        }
        
    } catch (error) {
        utils.addLog('❌ OCR failed: ' + error.message, 'error');
        
        // Update compact display - only show error status
        currentOcrStatus = 'error';
        ocrStatusBadge.textContent = t('frame.ocrError');
        ocrStatusBadge.className = 'ocr-status failed';
        ocrResultCompact.innerHTML = '';  // No detailed error message
        
        // Hide OCR analysis overlay
        ocrAnalysisOverlay.style.display = 'none';
    }
}