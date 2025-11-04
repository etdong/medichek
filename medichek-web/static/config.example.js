// Medichek Configuration - PRODUCTION EXAMPLE
// Copy this file to config.js and update with your settings

const MedichekConfig = {
    // ===== BASIC CONFIGURATION =====
    
    // Django Backend Server URL
    // Update this to your Django server's URL
    djangoServerUrl: 'https://your-django-server.com',
    
    
    // ===== ADVANCED CONFIGURATION =====
    
    // Auto-detect Environment
    // If true, uses different URLs for localhost vs production
    useAutoDetect: false,
    
    // Production Django URL (only used when useAutoDetect is true)
    productionDjangoUrl: 'https://your-production-django.com',
    
    // Development Django URL (only used when useAutoDetect is true)
    developmentDjangoUrl: 'http://127.0.0.1:8000',
    
    
    // ===== UTILITY FUNCTION =====
    
    // Get the appropriate Django URL based on configuration
    getDjangoUrl: function() {
        if (this.useAutoDetect) {
            const isLocalhost = window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1' ||
                              window.location.hostname === '';
            return isLocalhost ? this.developmentDjangoUrl : this.productionDjangoUrl;
        }
        return this.djangoServerUrl;
    }
};

// ===== CONFIGURATION EXAMPLES =====

/*
// Example 1: Simple configuration (most common)
const MedichekConfig = {
    djangoServerUrl: 'https://api.medichek.com',
    useAutoDetect: false,
    getDjangoUrl: function() { return this.djangoServerUrl; }
};

// Example 2: Auto-detect environment (recommended)
const MedichekConfig = {
    useAutoDetect: true,
    developmentDjangoUrl: 'http://127.0.0.1:8000',
    productionDjangoUrl: 'https://api.medichek.com',
    getDjangoUrl: function() {
        const isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1' ||
                          window.location.hostname === '';
        return isLocalhost ? this.developmentDjangoUrl : this.productionDjangoUrl;
    }
};

// Example 3: Environment variable based (for build systems)
const MedichekConfig = {
    djangoServerUrl: process.env.DJANGO_URL || 'http://127.0.0.1:8000',
    useAutoDetect: false,
    getDjangoUrl: function() { return this.djangoServerUrl; }
};
*/

// Export for use in script.js
if (typeof window !== 'undefined') {
    window.MedichekConfig = MedichekConfig;
}
