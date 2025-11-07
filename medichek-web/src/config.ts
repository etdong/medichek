// Medichek Configuration
// This file contains configuration settings for the Medichek web client

// Environment variables - Set these via your build process or environment
// For development, you can create a .env file (do NOT commit to git!)
// For production, set these as actual environment variables
const ENV = {
    SERVER_URL: import.meta.env.SERVER_URL || 'http://127.0.0.1:9000',
    PRODUCTION_SERVER_URL: import.meta.env.PRODUCTION_SERVER_URL || 'https://your-django-server.com',
    MINIO_ENDPOINT: import.meta.env.MINIO_ENDPOINT || 'localhost',
    MINIO_PORT: import.meta.env.MINIO_PORT || 9000,
    MINIO_USE_SSL: import.meta.env.MINIO_USE_SSL === 'true' || false,
    MINIO_ACCESS_KEY: import.meta.env.MINIO_ACCESS_KEY || 'minioadmin',
    MINIO_SECRET_KEY: import.meta.env.MINIO_SECRET_KEY || 'minioadmin',
    MINIO_VIDEOS_BUCKET: import.meta.env.MINIO_VIDEOS_BUCKET || 'video',
    MINIO_IMAGES_BUCKET: import.meta.env.MINIO_IMAGES_BUCKET || 'product',
    MINIO_REGION: import.meta.env.MINIO_REGION || 'us-east-1'
};

export const MedichekConfig = {
    // Backend Server URL
    serverUrl: ENV.SERVER_URL,
    
    // Auto-detect environment (optional)
    // This will use different URLs for localhost vs production
    useAutoDetect: false,

    // Production Server URL (used when useAutoDetect is true and not on localhost)
    productionServerUrl: ENV.PRODUCTION_SERVER_URL,

    // Get the appropriate Server URL based on configuration
    getServerUrl: function() {
        if (this.useAutoDetect) {
            const isLocalhost = window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1' ||
                              window.location.hostname === '';
            return isLocalhost ? this.serverUrl : this.productionServerUrl;
        }
        return this.serverUrl;
    },
    
    // MinIO Configuration
    // MinIO provides S3-compatible object storage for captured media
    minIO: {
        enabled: true,  // Set to false to disable MinIO upload (will download locally instead)
        endPoint: ENV.MINIO_ENDPOINT,
        port: ENV.MINIO_PORT,
        useSSL: ENV.MINIO_USE_SSL,
        accessKey: ENV.MINIO_ACCESS_KEY,
        secretKey: ENV.MINIO_SECRET_KEY,
        
        // Separate buckets for videos and images
        videosBucketName: ENV.MINIO_VIDEOS_BUCKET,
        imagesBucketName: ENV.MINIO_IMAGES_BUCKET,
        
        region: ENV.MINIO_REGION,
        
        // Generate object key for a file
        getObjectKey: function(sessionId: string, filename: string): string {
            // Get current date in YYYYMMDD format
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const dateStr = `${year}${month}${day}`;
            
            return `${dateStr}/${sessionId}/${filename}`;
        }
    }
};