// Medichek Configuration
// This file contains configuration settings for the Medichek web client

const MedichekConfig = {
    // Django Backend Server URL
    // Change this to match your Django server location
    djangoServerUrl: 'http://127.0.0.1:8000',
    
    // Auto-detect environment (optional)
    // This will use different URLs for localhost vs production
    useAutoDetect: false,
    
    // Production Django URL (used when useAutoDetect is true and not on localhost)
    productionDjangoUrl: 'https://your-django-server.com',
    
    // Get the appropriate Django URL based on configuration
    getDjangoUrl: function() {
        if (this.useAutoDetect) {
            const isLocalhost = window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1' ||
                              window.location.hostname === '';
            return isLocalhost ? this.djangoServerUrl : this.productionDjangoUrl;
        }
        return this.djangoServerUrl;
    }
};

// Export for use in script.js
if (typeof window !== 'undefined') {
    window.MedichekConfig = MedichekConfig;
}
