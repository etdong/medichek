# Modular JavaScript Structure

This directory contains the modularized version of the Medichek application.

## File Structure

```
static/
├── js/
│   ├── config.js                 # Configuration and global state
│   ├── mediapipe-state.js        # MediaPipe detection state
│   ├── dom-elements.js           # DOM element references
│   ├── translations.js           # Internationalization (i18n)
│   ├── utils.js                  # Utility functions
│   ├── ui-manager.js             # UI update functions
│   ├── camera.js                 # Camera and recording management
│   ├── mediapipe-init.js         # MediaPipe initialization
│   ├── face-detection.js         # Face detection logic
│   ├── hand-detection.js         # Hand detection logic
│   ├── face-mesh.js              # Face mesh and rubbing detection
│   ├── ocr-handler.js            # OCR capture and processing
│   ├── session-manager.js        # Session and step management
│   ├── upload-manager.js         # MinIO upload functionality
│   ├── event-handlers.js         # Event listener setup
│   └── main.js                   # Main entry point
├── script.js                     # Original monolithic file (keep as backup)
└── config.js                     # External configuration
```

## Module Responsibilities

### config.js
- Server URL configuration
- Offline mode flags
- Analysis session state
- Captured frame storage

### mediapipe-state.js
- MediaPipe detection instances
- Face/hand detection state
- Palm detection tracking
- Face rubbing state
- OCR state

### dom-elements.js
- All DOM element references
- Canvas context
- Button references
- Modal and overlay references

### translations.js
- Language switching (EN/ZH)
- Translation function
- UI text updates

### utils.js
- Logging functions
- Session ID generation
- Helper utilities

### ui-manager.js
- updateSessionUI()
- updateServerStatus()
- Toast notifications
- Progress updates

### camera.js
- enableCamera()
- Video recording management
- MediaRecorder handling

### mediapipe-init.js
- initializeFaceDetection()
- initializeHandsDetection()
- initializeFaceMesh()

### face-detection.js
- onFaceDetectionResults()
- Face centering logic
- Face bounds checking

### hand-detection.js
- onHandsDetectionResults()
- Palm detection logic
- Hand bounds validation

### face-mesh.js
- onFaceMeshResults()
- checkFaceRubbing()
- drawFaceMeshOverlay()
- Face coverage tracking

### ocr-handler.js
- captureFrame()
- performOCR()
- Auto-scanning logic

### session-manager.js
- startTracking()
- nextStep()
- finishSession()
- Step transitions

### upload-manager.js
- uploadToMinIO()
- downloadLocalAnalysis()
- Server communication

### event-handlers.js
- Button click handlers
- Modal interactions
- Language switching

### main.js
- Application initialization
- Server connection checks
- Module orchestration

## Migration Guide

To use the modular version:

1. **In index.html**, replace:
   ```html
   <script src="static/script.js"></script>
   ```
   
   With:
   ```html
   <script type="module" src="static/js/main.js"></script>
   ```

2. The original `script.js` is kept as a backup

3. All modules use ES6 import/export syntax

## Benefits

- **Maintainability**: Each module has a single responsibility
- **Testability**: Individual modules can be tested in isolation
- **Reusability**: Modules can be reused across different parts of the app
- **Performance**: Tree-shaking can remove unused code
- **Collaboration**: Multiple developers can work on different modules
- **Debugging**: Easier to locate and fix issues

## Development Workflow

1. Edit individual module files in `static/js/`
2. Changes are automatically reflected (no build step required with ES6 modules)
3. Use browser dev tools to debug specific modules
4. Run tests on individual modules

## Notes

- All modules use ES6 module syntax (`import`/`export`)
- Shared state is managed through getter/setter functions
- DOM elements are imported where needed
- Event handlers are centralized in `event-handlers.js`
