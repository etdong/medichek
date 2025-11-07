# Migration Instructions

## Current Status

✅ **Created**:
- `/static/js/` directory structure
- `config.js` - Configuration and state management
- `mediapipe-state.js` - Detection state
- `dom-elements.js` - DOM references
- `README.md` - Documentation

## Next Steps to Complete Migration

### 1. Extract Remaining Code from script.js

The original `script.js` (2950 lines) needs to be split into these additional modules:

#### A. **translations.js** (~200 lines)
Extract all translation-related code:
- `translations` object with EN/ZH text
- `currentLanguage` variable
- `t()` function
- `updateLanguage()` function

#### B. **utils.js** (~150 lines)
Extract utility functions:
- `addLog()`
- `updateResponse()`
- `generateSessionId()`
- `showWarningToast()`
- `hideWarningToast()`
- `showHandBoundsWarning()`
- `hideHandBoundsWarning()`

#### C. **ui-manager.js** (~300 lines)
Extract UI update functions:
- `updateSessionUI()`
- `updateServerStatus()`
- `updateLoadingScreenStatuses()`
- `updateFrameCaptureStatuses()`
- `updateFaceRubbingUI()`

#### D. **camera.js** (~200 lines)
Extract camera and recording:
- `enableCamera()`
- `startStepRecording()`
- `stopStepRecording()`
- Video recording state management
- MediaRecorder handling

#### E. **mediapipe-init.js** (~150 lines)
Extract MediaPipe initialization:
- `initializeFaceDetection()`
- `initializeHandsDetection()`
- `initializeFaceMesh()`

#### F. **face-detection.js** (~200 lines)
Extract face detection logic:
- `onFaceDetectionResults()`
- Face centering checks
- Face drawing functions

#### G. **hand-detection.js** (~300 lines)
Extract hand detection:
- `onHandsDetectionResults()`
- Palm detection logic
- `drawHandLandmarks()`
- Palm validation

#### H. **face-mesh.js** (~400 lines)
Extract face mesh logic:
- `onFaceMeshResults()`
- `checkFaceRubbing()`
- `drawFaceMeshOverlay()`
- `trackRubbingMotion()`
- `resetRubbingTimer()`
- Face coverage tracking

#### I. **ocr-handler.js** (~300 lines)
Extract OCR functionality:
- `captureFrame()`
- `performOCR()`
- `startAutoOcrScanning()`
- `stopAutoOcrScanning()`
- `performAutoOcrScan()`
- `captureStep4Frame()`

#### J. **session-manager.js** (~400 lines)
Extract session management:
- `startTracking()`
- `acceptRecordingConsent()`
- `declineRecordingConsent()`
- `nextStep()`
- `showReviewScreen()`
- `restartSession()`
- `createAnalysisData()`

#### K. **upload-manager.js** (~400 lines)
Extract upload/download:
- `uploadToMinIO()`
- `downloadLocalAnalysis()`
- `downloadAllRecordings()`
- `submitAnalysis()`
- `showCompletionScreen()`

#### L. **server-manager.js** (~200 lines)
Extract server checks:
- `checkServer()`
- `checkMinIOServer()`
- `initializeApplication()`
- `hideLoadingScreen()`
- `continueOffline()`
- `retryConnection()`

#### M. **event-handlers.js** (~150 lines)
Extract all event listeners:
- Button click handlers
- Modal handlers
- Language switching
- Window load event

#### N. **main.js** (~100 lines)
Main entry point that:
- Imports all modules
- Initializes application
- Sets up event listeners
- Starts the app

### 2. Update HTML

In `index.html` or `templates/index.html`, update the script tag:

```html
<!-- OLD -->
<script src="{{ url_for('static', filename='script.js') }}"></script>

<!-- NEW -->
<script type="module" src="{{ url_for('static', filename='js/main.js') }}"></script>
```

### 3. Testing Checklist

After migration, test:
- [ ] Page loads without errors
- [ ] Language switching works
- [ ] Camera initialization works
- [ ] Face detection works (Step 0)
- [ ] OCR capture works (Step 1)
- [ ] Palm detection works (Step 2)
- [ ] Face rubbing works (Step 3)
- [ ] Video recording works
- [ ] Upload to MinIO works
- [ ] Offline mode works
- [ ] Download analysis works

### 4. Module Creation Template

When creating each module, follow this pattern:

```javascript
// ModuleName.js
// Description: What this module does

// Import dependencies
import { dependency1, dependency2 } from './other-module.js';

// Export functions
export function functionName() {
    // Implementation
}

// Export variables if needed
export let variableName = initialValue;
export function setVariableName(value) { variableName = value; }
```

### 5. Benefits After Migration

- **Single Responsibility**: Each file has one clear purpose
- **Easy Navigation**: Find code by feature, not by scrolling
- **Better Git**: Smaller, focused commits and diffs
- **Team Collaboration**: Multiple developers can work simultaneously
- **Easier Testing**: Unit test individual modules
- **Improved Performance**: Browser can cache individual modules

### 6. Backward Compatibility

Keep the original `script.js` as `script.legacy.js` for:
- Rollback capability
- Reference during migration
- Comparison testing

### 7. Development Workflow

1. Create one module at a time
2. Test that module works independently
3. Update imports in other modules
4. Test integration
5. Move to next module
6. Keep browser console open for errors

## Priority Order

Recommend this order for migration:

1. ✅ `config.js` (DONE)
2. ✅ `mediapipe-state.js` (DONE)
3. ✅ `dom-elements.js` (DONE)
4. `translations.js` - Needed by everything
5. `utils.js` - Used across all modules
6. `ui-manager.js` - Updates UI based on state
7. `camera.js` - Core functionality
8. `mediapipe-init.js` - Sets up detection
9. `face-detection.js` - Step 0
10. `hand-detection.js` - Step 2
11. `ocr-handler.js` - Step 1
12. `face-mesh.js` - Step 3
13. `session-manager.js` - Orchestrates steps
14. `upload-manager.js` - Final submission
15. `server-manager.js` - Initialization
16. `event-handlers.js` - Wires everything up
17. `main.js` - Entry point

## Quick Start Command

To continue migration, start with translations:

```bash
# Create translations module from script.js lines ~XXX-YYY
# Extract the translations object and related functions
```
