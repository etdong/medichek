// Utility functions

import * as AWS from 'aws-sdk';
import { MedichekConfig } from './config.js';

const originalLog = console.log;
const logEntries: [any?, ...any[]][] = [];

console.log = function(...args) {
    originalLog(...args); // Still log to the console
    logEntries.push(args); // Store the arguments
};

// Utility functions (no-op stubs for removed UI elements)
export function addLog(message: string, type: string = 'info') {
    // Logs removed from UI - console only
    console.log(`[${type}] ${message}`);
}

export function updateResponse(data: any) {
    // Response panel removed from UI
    console.log('Response:', data);
}

export async function saveLogs() {
    try {
        // Configure AWS SDK to work with MinIO
        AWS.config.update({
            accessKeyId: MedichekConfig.minIO.accessKey,
            secretAccessKey: MedichekConfig.minIO.secretKey,
            region: MedichekConfig.minIO.region,
            s3ForcePathStyle: true, // Required for MinIO
            signatureVersion: 'v4'
        });
        
        // Create S3 client pointing to MinIO endpoint
        const s3 = new AWS.S3({
            endpoint: `${MedichekConfig.minIO.useSSL ? 'https' : 'http'}://${MedichekConfig.minIO.endPoint}:${MedichekConfig.minIO.port}`,
            s3ForcePathStyle: true,
            signatureVersion: 'v4'
        });

        // Upload video devices JSON to MinIO
        const devicesJsonBlob = new Blob([JSON.stringify(logEntries)], { type: 'application/json' });
        const devicesJsonObjectKey = `test/video_devices_${Date.now()}.json`;
        await new Promise((resolve, reject) => {
            s3.putObject({
                Bucket: 'video',
                Key: devicesJsonObjectKey,
                Body: devicesJsonBlob,
                ContentType: 'application/json'
            }, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
        addLog(`✅ Uploaded video devices JSON to videos bucket`, 'success');
    } catch (error: any) {
        addLog(`❌ Failed to upload video devices JSON: ${error.message}`, 'error');
        console.error('MinIO upload error:', error);
    }
}
