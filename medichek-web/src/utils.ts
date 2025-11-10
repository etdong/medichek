// Utility functions
// Utility functions (no-op stubs for removed UI elements)
export function addLog(message: string, type: string = 'info') {
    // Logs removed from UI - console only
    console.log(`[${type}] ${message}`);
}

export function updateResponse(data: any) {
    // Response panel removed from UI
    console.log('Response:', data);
}

export function generateSessionId() {
    return 'client-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}
