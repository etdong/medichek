import * as ui from './ui_manager.js';
import * as DOM from './dom.js';
import * as utils from './utils.js';
import * as cam from './camera.js';
import { t } from './translations.js';
import JSZip from 'jszip';
import { MedichekConfig } from './config.js';
import * as AWS from 'aws-sdk';

// Storage for MinIO file URLs (organized by step/file)
type MinioFileEntry = {
    filename: string;
    url: string;
    uploaded_at: string;
    type?: string;
} | null;

export const minioFileUrls: Record<string, MinioFileEntry> = {
    step1_video: null,   // OCR Capture (was step3)
    step1_image: null,   // Product label image (was step3_image)
    step2_video: null,   // Palm Detection (was step4)
    step2_image: null,   // Palm detection image (was step4_image)
    step3_video: null    // Face Rubbing (was step5)
};

export let offlineMode: boolean = false;

// API functions

export async function checkServers(): Promise<{ serverOnline: boolean; minioOnline: boolean }> {
    const _serverOnline = await checkServer();
    const _minioOnline = await checkMinIOServer();
    if (_serverOnline && _minioOnline) {
        offlineMode = false;
    } else {
        offlineMode = true;
    }
    return { serverOnline: _serverOnline, minioOnline: _minioOnline };
}

// Check main server connection
async function checkServer(): Promise<boolean> {
    utils.addLog('Checking Server connection...');
    ui.updateServerStatus('Checking...');
    return new Promise(async (resolve) => {
        try {
            const response = await fetch(`${MedichekConfig.getServerUrl()}/api/health/`, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }
            
            const data = await response.json();
            ui.updateServerStatus('Connected');
            utils.addLog('✅ Server is online', 'success');
            utils.updateResponse(data);
            resolve(true);
        } catch (err: any) {
            ui.updateServerStatus('Disconnected');
            utils.addLog('⚠️ Server offline', 'warning');
            utils.updateResponse({ error: err.message });
            resolve(false);
        }
    })
}

// Check MinIO server connection
async function checkMinIOServer(): Promise<boolean> {
    if (!MedichekConfig.minIO.enabled) {
        return false;
    }
    
    try {
        // Configure AWS SDK to work with MinIO
        AWS.config.update({
            accessKeyId: MedichekConfig.minIO.accessKey,
            secretAccessKey: MedichekConfig.minIO.secretKey,
            region: MedichekConfig.minIO.region,
            s3ForcePathStyle: true
        });
        
        const s3 = new AWS.S3({
            endpoint: `${MedichekConfig.minIO.useSSL ? 'https' : 'http'}://${MedichekConfig.minIO.endPoint}:${MedichekConfig.minIO.port}`,
            s3BucketEndpoint: false
        });
        
        // Try to list buckets to test connection
        // Use callback-based approach instead of promise
        return new Promise<boolean>((resolve) => {
            s3.listBuckets((err: any, data: any) => {
                if (err) {
                    utils.addLog('⚠️ MinIO offline', 'warning');
                    utils.updateResponse({ error: err.message });
                    resolve(false);
                } else {
                    utils.addLog('✅ MinIO online', 'success');
                    utils.updateResponse({ data: data });
                    resolve(true);
                }
            });
        });
    } catch (error) {
        console.error('MinIO server check failed:', error);
        return false
    }
}

// Continue in offline mode
export function continueOffline() {
    offlineMode = true;
    ui.updateServerStatus('Disconnected');
    utils.addLog(t('loading.offlineModeLog'), 'warning');
    ui.hideLoadingScreen();
}

// MinIO Upload Function
export async function uploadToMinIO(analysisData: any) {
    // Show upload overlay
    DOM.uploadOverlay.style.display = 'flex';
    
    utils.addLog('☁️ Uploading all recordings and data to MinIO...', 'info');
    
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
        
        const videosBucketName = MedichekConfig.minIO.videosBucketName;
        const imagesBucketName = MedichekConfig.minIO.imagesBucketName;
        const sessionId = analysisData.session_id;
        let uploadCount = 0;
        
        // Helper function to generate MinIO URL
        const getMinioUrl = (bucketName: string, objectKey: string) => {
            const protocol = MedichekConfig.minIO.useSSL ? 'https' : 'http';
            return `${protocol}://${MedichekConfig.minIO.endPoint}:${MedichekConfig.minIO.port}/${bucketName}/${objectKey}`;
        };
        
        // Check if videos bucket exists, create if needed
        try {
            await new Promise((resolve, reject) => {
                s3.headBucket({ Bucket: videosBucketName }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
        } catch (error: any) {
            if (error.statusCode === 404 || error.code === 'NotFound') {
                await new Promise((resolve, reject) => {
                    s3.createBucket({ Bucket: videosBucketName }, (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });
                utils.addLog(`✅ Created bucket: ${videosBucketName}`, 'success');
            } else {
                throw error;
            }
        }
        
        // Check if images bucket exists, create if needed
        try {
            await new Promise((resolve, reject) => {
                s3.headBucket({ Bucket: imagesBucketName }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
        } catch (error: any) {
            if (error.statusCode === 404 || error.code === 'NotFound') {
                await new Promise((resolve, reject) => {
                    s3.createBucket({ Bucket: imagesBucketName }, (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });
                utils.addLog(`✅ Created bucket: ${imagesBucketName}`, 'success');
            } else {
                throw error;
            }
        }
        
        // Upload video recordings to videos bucket (only steps 1-3 now)
        for (let i = 1; i <= 3; i++) {
            const stepKey = `step${i}`;
            const blob = cam.stepRecordings[stepKey];
            
            if (blob) {
                const filename = `step${i}.webm`;
                const objectKey = MedichekConfig.minIO.getObjectKey(sessionId, filename);
                
                await new Promise((resolve, reject) => {
                    s3.putObject({
                        Bucket: videosBucketName,
                        Key: objectKey,
                        Body: blob,
                        ContentType: 'video/webm'
                    }, (err, data) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });
                
                // Store the MinIO URL for this step's video
                const videoUrl = getMinioUrl(videosBucketName, objectKey);
                minioFileUrls[`step${i}_video`] = {
                    filename: filename,
                    url: videoUrl,
                    uploaded_at: new Date().toISOString()
                };
                
                utils.addLog(`✅ Uploaded ${filename} to videos bucket`, 'success');
                uploadCount++;
            }
        }
        
        // Upload step 1 (OCR) captured frame to images bucket
        if (cam.step1CapturedFrameBlob) {
            const filename = 'step1_product_label.png';
            const objectKey = MedichekConfig.minIO.getObjectKey(sessionId, filename);
            
            await new Promise((resolve, reject) => {
                s3.putObject({
                    Bucket: imagesBucketName,
                    Key: objectKey,
                    Body: cam.step1CapturedFrameBlob!,
                    ContentType: 'image/png'
                }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
            
            // Store the MinIO URL for step 1 (OCR) image
            const imageUrl = getMinioUrl(imagesBucketName, objectKey);
            minioFileUrls.step1_image = {
                filename: filename,
                url: imageUrl,
                type: 'product_label',
                uploaded_at: new Date().toISOString()
            };
            
            utils.addLog(`✅ Uploaded ${filename} to images bucket`, 'success');
            uploadCount++;
        }
        
        // Upload step 2 (Palm Detection) captured frame to images bucket
        if (cam.step2CapturedFrameBlob) {
            const filename = 'step2_palm_detection.png';
            const objectKey = MedichekConfig.minIO.getObjectKey(sessionId, filename);
            
            await new Promise((resolve, reject) => {
                s3.putObject({
                    Bucket: imagesBucketName,
                    Key: objectKey,
                    Body: cam.step2CapturedFrameBlob!,
                    ContentType: 'image/png'
                }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
            
            // Store the MinIO URL for step 2 (Palm Detection) image
            const imageUrl = getMinioUrl(imagesBucketName, objectKey);
            minioFileUrls.step2_image = {
                filename: filename,
                url: imageUrl,
                type: 'palm_detection',
                uploaded_at: new Date().toISOString()
            };
            
            utils.addLog(`✅ Uploaded ${filename} to images bucket`, 'success');
            uploadCount++;
        }
        
        // Get current date in YYYYMMDD format for display
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        
        utils.addLog(`🎉 Successfully uploaded ${uploadCount} files to MinIO`, 'success');
        utils.addLog(`📂 Videos bucket: ${videosBucketName}/${dateStr}/${sessionId}/`, 'info');
        utils.addLog(`📂 Images bucket: ${imagesBucketName}/${dateStr}/${sessionId}/`, 'info');
        
        // Hide upload overlay
        DOM.uploadOverlay.style.display = 'none';
        
        // Show completion screen with download button
        const details = `
            <div>${t('completion.sessionId')}: ${sessionId}</div>
            <div>${t('completion.date')}: ${dateStr}</div>
            <div>${t('completion.totalFiles')}: ${uploadCount}</div>
        `;
        ui.showCompletionScreen(true, t('completion.uploadSuccess'), t('completion.uploadMessage'), details, true);
        
        return true;
        
    } catch (err: any) {
        utils.addLog(`❌ MinIO upload failed: ${err.message}`, 'error');
        console.error('MinIO upload error:', err);
        
        // Hide upload overlay
        DOM.uploadOverlay.style.display = 'none';
        
        // Fallback to local download
        utils.addLog('⚠️ Falling back to local download...', 'warning');
        downloadAllRecordings(analysisData);
        
        // Return null on error
        return null;
    }
}

export function downloadAllRecordings(analysisData: any) {
    utils.addLog('📥 Creating zip file with all recordings and captured frames...', 'info');
    
    // Show download overlay
    DOM.downloadOverlay.style.display = 'flex';
    
    const zip = new JSZip();
    let fileCount = 0;
    
    // Add video recordings to zip (only steps 1-3 now)
    for (let i = 1; i <= 3; i++) {
        const stepKey = `step${i}`;
        const blob = cam.stepRecordings[stepKey];
        
        if (blob) {
            zip.file(`step${i}.webm`, blob);
            fileCount++;
        }
    }
    
    // Add captured frame from step 1 (OCR - product label, if exists)
    if (cam.step1CapturedFrameBlob) {
        zip.file('step1_product_label.png', cam.step1CapturedFrameBlob);
        fileCount++;
    }
    
    // Add captured frame from step 2 (Palm Detection, if exists)
    if (cam.step2CapturedFrameBlob) {
        zip.file('step2_palm_detection.png', cam.step2CapturedFrameBlob);
        fileCount++;
    }
    
    zip.file('analysis.json', JSON.stringify(analysisData, null, 2));
    fileCount++;
    
    if (fileCount > 1) { // More than just analysis.json
        // Generate zip file
        zip.generateAsync({ type: 'blob' }).then(function(zipBlob) {
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${analysisData.sessionId}_${new Date().toISOString().replace(/:/g, '-')}.zip`;
            
            // Trigger download immediately
            document.body.appendChild(a);
            
            // Use requestAnimationFrame to ensure the element is rendered before clicking
            requestAnimationFrame(() => {
                a.click();
                
                // Give the browser time to start the download before cleanup
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    const videoCount = Object.values(cam.stepRecordings).filter(Boolean).length;
                    const frameCount = (cam.step1CapturedFrameBlob ? 1 : 0) + (cam.step2CapturedFrameBlob ? 1 : 0);
                    utils.addLog(`✅ Downloaded zip file with ${fileCount} files (${videoCount} videos + ${frameCount} frames + metadata)`, 'success');
                    
                    // Hide download overlay
                    DOM.downloadOverlay.style.display = 'none';
                    
                    // Show completion screen
                    const details = `
                        <div>${t('completion.sessionId')}: ${analysisData.sessionId}</div>
                        <div>${t('completion.totalFiles')}: ${fileCount}</div>
                    `;
                    ui.showCompletionScreen(true, t('completion.downloadSuccess'), t('completion.downloadMessage'), details);
                }, 1000); // 1 second delay to ensure download starts
            });
        }).catch(function(error) {
            utils.addLog(`❌ Failed to create zip file: ${error.message}`, 'error');
            console.error('Zip creation error:', error);
            
            // Hide download overlay
            DOM.downloadOverlay.style.display = 'none';
            
            // Show completion screen with error
            ui.showCompletionScreen(false, 'Download Failed', `Failed to create zip file: ${error.message}`);
        });
    } else {
        utils.addLog('⚠️ No recordings found to download', 'warning');
        
        // Hide download overlay
        DOM.downloadOverlay.style.display = 'none';
        
        // Show completion screen with warning
        ui.showCompletionScreen(false, 'No Data to Download', 'No recordings were found to include in the download.');
    }
}
