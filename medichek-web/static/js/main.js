/**
 * Main entrypoint
 * - Attaches event handlers
 * - Initializes server checks and MediaPipe models
 * - Updates initial UI state
 */

import serverManager from './server-manager.js';
import eventHandlers from './event-handlers.js';
import { initializeAllMediaPipe } from './mediapipe-init.js';
import { updateSessionUI } from './ui-manager.js';
import { setCameraEnabled } from './ui-manager.js';
import { updateLanguage } from './translations.js';

async function boot() {
    // Attach UI event handlers
    eventHandlers.attachEventHandlers();

    // Initialize server & minio checks (shows loading screen until complete)
    try {
        await serverManager.initializeApplication();
    } catch (err) {
        console.warn('Server initialization error:', err);
    }

    // Initialize MediaPipe models (async but non-blocking for UI)
    try {
        await initializeAllMediaPipe();
    } catch (err) {
        // Some environments may not support MediaPipe (e.g., test harness)
        console.warn('MediaPipe init warning:', err);
    }

    // Set default language (if desired) and update UI
    try { updateLanguage('en'); } catch (e) {}
    updateSessionUI();

    // Ensure camera UI flag is reset
    setCameraEnabled(false);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}

export default { boot };
// Main Application Entry Point
// This file coordinates all modules

// Import configuration and state
import * as Config from './config.js';
import * as State from './mediapipe-state.js';
import * as DOM from './dom-elements.js';
import * as Utils from './utils.js';

// Import translations (already exists as separate file)
// Note: translations.js is already separate in ../translations.js

// Import initialization

// Import handlers

// Main initialization
window.addEventListener('load', async () => {
    // Initialize application
    console.log('Medichek application starting...');
    
    // TODO: Wire up all modules here
    // This is a placeholder - the full implementation would import
    // and initialize all the refactored modules
});

// For now, keep using the original script.js
// This modular structure is ready for gradual migration
console.log('Modular structure initialized');
