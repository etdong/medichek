// Medichek Configuration
// This file contains configuration settings for the Medichek web client

// Environment variables - Set these via your build process or environment
// For development, you can create a .env file (do NOT commit to git!)
// For production, set these as actual environment variables
const ENV = {
    SERVER_URL: import.meta.env.VITE_SERVER_URL || 'http://127.0.0.1:8000',
    MINIO_ENDPOINT: import.meta.env.VITE_MINIO_ENDPOINT || 'localhost',
    MINIO_PORT: import.meta.env.VITE_MINIO_PORT || 9000,
    MINIO_USE_SSL: import.meta.env.VITE_MINIO_USE_SSL === 'true' || false,
    MINIO_ACCESS_KEY: import.meta.env.VITE_MINIO_ACCESS_KEY || 'minioadmin',
    MINIO_SECRET_KEY: import.meta.env.VITE_MINIO_SECRET_KEY || 'minioadmin',
    MINIO_VIDEOS_BUCKET: import.meta.env.VITE_MINIO_VIDEOS_BUCKET || 'video',
    MINIO_IMAGES_BUCKET: import.meta.env.VITE_MINIO_IMAGES_BUCKET || 'product',
    MINIO_REGION: import.meta.env.VITE_MINIO_REGION || 'us-east-1'
};

export const MedichekConfig = {
    // Backend Server URL
    serverUrl: ENV.SERVER_URL,

    // Get the appropriate Server URL based on configuration
    getServerUrl: function() {
        return this.serverUrl;
    },

    getMinioUrl: function() {
        const protocol = ENV.MINIO_USE_SSL ? 'https' : 'http';
        return `${protocol}://${ENV.MINIO_ENDPOINT}:${ENV.MINIO_PORT}`;
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