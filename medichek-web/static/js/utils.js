/**
 * Utility Functions Module
 * 
 * Contains helper functions for:
 * - Logging
 * - Response updates
 * - Session ID generation
 * - Toast notifications
 * - Warning messages
 */

import { warningToast, handBoundsWarning } from './dom-elements.js';

// Module-level timeout variables to track active timeouts
let toastTimeout = null;
let handBoundsWarningTimeout = null;

/**
 * Add a log entry with timestamp
 * @param {string} message - The message to log
 */
export function addLog(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Update the response text in the UI
 * @param {string} message - The message to display
 */
export function updateResponse(message) {
    console.log('Response:', message);
}

/**
 * Generate a unique session ID
 * @returns {string} A unique session identifier
 */
export function generateSessionId() {
    return 'client-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

/**
 * Show a warning toast message
 * @param {string} message - The message to display
 * @param {number} duration - How long to show the toast (ms)
 */
export function showWarningToast(message, duration = 3000) {
    // Update message if provided
    if (message) {
        const toastMessage = warningToast.querySelector('.toast-message');
        if (toastMessage) {
            toastMessage.textContent = message;
        }
    }
    
    // Clear any existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    // Show toast
    warningToast.classList.add('show');
    
    // Auto-hide after duration
    toastTimeout = setTimeout(() => {
        warningToast.classList.remove('show');
    }, duration);
}

/**
 * Hide the warning toast
 */
export function hideWarningToast() {
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    warningToast.classList.remove('show');
}

/**
 * Show hand bounds warning
 */
export function showHandBoundsWarning() {
    // Clear any existing timeout
    if (handBoundsWarningTimeout) {
        clearTimeout(handBoundsWarningTimeout);
    }
    
    // Show warning
    handBoundsWarning.classList.add('show');
    
    // Auto-hide after 2 seconds
    handBoundsWarningTimeout = setTimeout(() => {
        handBoundsWarning.classList.remove('show');
    }, 2000);
}

/**
 * Hide hand bounds warning
 */
export function hideHandBoundsWarning() {
    if (handBoundsWarningTimeout) {
        clearTimeout(handBoundsWarningTimeout);
        handBoundsWarningTimeout = null;
    }
    handBoundsWarning.classList.remove('show');
}
