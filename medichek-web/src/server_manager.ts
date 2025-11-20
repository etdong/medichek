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
    url: string;
    uploaded_at: string;
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
        resolve(true)
        try {
            const response = await fetch(`${MedichekConfig.getServerUrl()}`, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'authorization': 'Bearer ' + import.meta.env.VITE_BEARER_TOKEN,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                utils.updateResponse(response)
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

    return new Promise(async (resolve) => {
        try {
            const response = await fetch(`${MedichekConfig.getMinioUrl()}/minio/health/live`, {
                method: 'GET',
                mode: 'cors',
            });
            
            if (!response.ok) {
                throw new Error(`MinIO server responded with status ${response.status}`);
            }
            
            utils.addLog('✅ MinIO online', 'success');
            utils.updateResponse(response);
            resolve(true);
        } catch (err: any) {
            utils.addLog('⚠️ MinIO offline', 'warning');
            utils.updateResponse({ error: err.message });
            resolve(false);
        }
    })
}

// Continue in offline mode
export function continueOffline() {
    offlineMode = true;
    ui.updateServerStatus('Disconnected');
    utils.addLog(t('loading.offlineModeLog'), 'warning');
    DOM.loadingScreen.style.display = 'none';
}

// MinIO Upload Function
export async function uploadToMinIO(analysisData: any) {
    utils.addLog('☁️ Uploading all recordings and images to MinIO...', 'info');
    
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
                url: imageUrl,
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
                url: imageUrl,
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

        analysisData.minio_urls = minioFileUrls;
        
        // Show completion screen with download button
        const details = `
            <div>${t('completion.sessionId')}: ${sessionId}</div>
            <div>${t('completion.date')}: ${dateStr}</div>
            <div>${t('completion.totalFiles')}: ${uploadCount}</div>
        `;
        
        return details;
        
    } catch (err: any) {
        utils.addLog(`❌ MinIO upload failed: ${err.message}`, 'error');
        console.error('MinIO upload error:', err);
        
        // Return null on error (caller will handle fallback)
        return null;
    }
}

export async function uploadAnalysisToServer(analysisData: any) {
    utils.addLog('☁️ Uploading analysis data to Server...', 'info');
    const results = {
        "id": analysisData.session_id,
        "step1DurationSeconds": analysisData.step_info.step1.duration,
        "step1Passed": analysisData.step_info.step1.passed ? 1 : 0,
        "step1ImageUrl": analysisData.minio_urls.step1_image.url,
        "step1VideoUrl": analysisData.minio_urls.step1_video.url,
        "step2DurationSeconds": analysisData.step_info.step2.duration,
        "step2VideoUrl": analysisData.minio_urls.step2_video.url,
        "step3DurationSeconds": analysisData.step_info.step3.duration,
        "step3ForeheadDurationSeconds": analysisData.step_info.step3.forehead_seconds,
        "step3LeftCheekDurationSeconds": analysisData.step_info.step3.left_cheek_seconds,
        "step3RightCheekDurationSeconds": analysisData.step_info.step3.right_cheek_seconds,
        "step3VideoUrl": analysisData.minio_urls.step3_video.url,
        "step3CoveragePercentage": analysisData.step_info.step3.coverage_percentage,
        "step3Passed": analysisData.step_info.step3.passed ? 1 : 0
    }

    try {
            const response = await fetch(`${MedichekConfig.getServerUrl()}`, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'authorization': 'Bearer ' + import.meta.env.VITE_BEARER_TOKEN,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(results)
            });
            
            if (!response.ok) {
                // If server returns error status, try to parse error message
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Server responded with status ${response.status}`);
            }
            
            const data = await response.json();
            if (data.code !== 200) {
                throw new Error(data.msg || `Server responded with code ${data.code}`);
            }
            utils.addLog(`✅ Analysis submitted successfully to server!`, 'success');
            utils.updateResponse(data);
            
            // Return success indicator
            return data;
        } catch (err: any) {
            utils.addLog('❌ Failed to submit analysis: ' + err.message, 'error');
            
            // Return null on error (caller will handle fallback)
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
            a.download = `${analysisData.session_id}_${new Date().toISOString().replace(/:/g, '-')}.zip`;
            
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
                        <div>${t('completion.sessionId')}: ${analysisData.session_id}</div>
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
