// Translations for Medichek
const translations: Record<string, Record<string, string>> = {
    en: {
        // Loading Screen
        'loading.title': 'Initializing',
        'loading.message': 'Checking server connections...',
        'loading.server': 'Backend:',
        'loading.minio': 'MinIO:',
        'loading.checking': 'Checking...',
        'loading.online': 'Online',
        'loading.offline': 'Offline',
        'loading.offline.warning': '⚠️ Some services are unavailable. You can continue in offline mode.',
        'loading.offline.details': 'Offline mode will download analysis data locally instead of uploading to servers.',
        'loading.offline.continue': 'Continue Offline',
        'loading.offline.retry': 'Retry Connection',
        
        // Status Bar
        'status.server': 'Server:',
        'status.session': 'Session:',
        'status.step': 'Step:',
        'status.none': 'None',
        'status.connected': 'Connected',
        'status.checking': 'Checking...',
        'status.disconnected': 'Disconnected',
        'status.offlineMode': 'Offline Mode',
        
        // Captured Frame Area
        'frame.step1': 'Step 1',
        'frame.step2': 'Step 2',
        'frame.placeholder': 'Captured frames will appear here',
        'frame.ocrRecognized': '✅ Recognized',
        'frame.ocrAnalyzing': '⏳ Analyzing...',
        'frame.ocrNotFound': '❌ Not Found',
        'frame.ocrError': '❌ Error',
        'frame.ocrReview': '⚠️ Review',
        'frame.palmCaptured': '✅ Captured',
        'frame.palmNoHandDetected': 'No hand detected. Please show your hand to the camera.',
        
        // Action Buttons
        'button.start': 'Start',
        'button.nextStep': 'Next Step',
        'button.manualCapture': 'Manual Capture',
        'button.finish': 'Finish',
        
        // Steps
        'steps.readyToBegin': 'Ready to begin',
        'steps.preliminaries.title': 'Preliminaries: Camera & Face Centering',
        'steps.preliminaries.activatingCamera': 'Activating camera...',
        'steps.preliminaries.positionFace': 'Position your face in the center',
        'steps.preliminaries.ready': 'Camera ready ✓ Face centered ✓ - Ready to begin',
        'steps.ocr.title': 'Step 1: Capture Product Label',
        'steps.ocr.productRecognized': 'Product recognized ✓ - Advancing...',
        'steps.ocr.proceedingManual': 'Proceeding with manual review - Advancing...',
        'steps.ocr.showLabel': 'Show product label to camera (auto-scanning active)',
        'steps.palm.title': 'Step 2: Show product on hand/fingers',
        'steps.palm.complete': 'Detection complete ✓ - Advancing...',
        'steps.palm.holdSteady': 'Hold hand steady: {progress}%',
        'steps.palm.showProduct': 'Show the product clearly on hand/palm/fingers. We will automatically scan it',
        'steps.faceRubbing.title': 'Step 3: Rub Face Areas',
        'steps.faceRubbing.progress': 'Forehead: {forehead} | Left: {left} | Right: {right}',
        'steps.faceRubbing.coverage': 'Face Coverage',
        
        // Session status
        'status.sessionNone': 'None',
        
        // Loading screen log
        'loading.offlineModeLog': '⚠️ Running in offline mode - data will be downloaded locally',
        
        // Recording Consent Modal
        'consent.title': 'Video Recording Consent',
        'consent.intro': 'This application will record video of each step for quality assurance and analysis purposes.',
        'consent.whatRecorded': 'What will be recorded:',
        'consent.record1': 'Video of your face and hand movements during each step',
        'consent.record2': 'Product label capture',
        'consent.record3': 'Hand palm detection',
        'consent.record4': 'Face rubbing verification',
        'consent.privacy': 'Your privacy:',
        'consent.privacy1': 'Videos will be saved securely',
        'consent.privacy2': 'Data is used only for analysis purposes',
        'consent.note': 'Note: Video recording is required to proceed with the tracking session.',
        'consent.accept': 'Accept & Continue',
        'consent.decline': 'Decline',
        
        // OCR Fail Modal
        'ocr.fail.title': 'Product Label Not Recognized',
        'ocr.fail.message': 'The automatic verification could not detect the product label the captured image.',
        'ocr.fail.question': 'What would you like to do?',
        'ocr.fail.retryLabel': 'Retry:',
        'ocr.fail.retry': 'Show the product label in better lighting or position',
        'ocr.fail.continueLabel': 'Continue:',
        'ocr.fail.continue': 'Submit the image for manual review',
        'ocr.fail.retryBtn': 'Retry Capture',
        'ocr.fail.continueBtn': 'Continue',
        
        // Palm Detection Fail Modal
        'palm.fail.title': 'Product Not Detected',
        'palm.fail.message': 'We weren\'t able to scan the product in your hand.',
        'palm.fail.instruction': 'You can continue with the manual capture for backend review.',
        'palm.fail.question': 'What would you like to do?',
        'palm.fail.retryLabel': 'Retry:',
        'palm.fail.retry': 'Show your palm more clearly with the product visible, fingers pointing down.',
        'palm.fail.continueLabel': 'Continue:',
        'palm.fail.continue': 'Submit the image for manual review',
        'palm.fail.retryBtn': 'Retry Capture',
        'palm.fail.continueBtn': 'Continue',
        
        // Review Screen
        'review.title': 'Session Complete!',
        'review.message': 'You have completed all steps. What would you like to do?',
        'review.ocr': 'Product Label:',
        'review.palm': 'Hand Detection:',
        'review.face': 'Face Rubbing:',
        'review.captured': '✓ Captured',
        'review.recognized': '✓ Recognized',
        'review.manualReview': '⚠️ Manual Review',
        'review.completed': '✓ Completed',
        'review.submit': 'Submit Analysis',
        'review.download': 'Download Analysis',
        'review.restart': 'Restart Session',
        
        // Completion Screen
        'completion.uploadSuccess': 'Upload Successful!',
        'completion.uploadMessage': 'All session data has been uploaded.',
        'completion.downloadSuccess': 'Download Successful!',
        'completion.downloadMessage': 'All session data has been downloaded to your device.',
        'completion.downloadBtn': 'Download Analysis',
        'completion.newSession': 'Start New Session',
        'completion.sessionId': 'Session ID',
        'completion.date': 'Date',
        'completion.totalFiles': 'Total files',
        'completion.offlineMode': 'Offline Mode - Data saved locally',
        
        // Warnings
        'warning.centerFace': 'Please keep your face in the center frame',
        'warning.keepInFrame': 'Keep hand in frame',
        'warning.faceNotDetected': 'Face not detected - please stay in frame',
        
        // OCR Analysis
        'ocr.analyzing': 'Analyzing product label...',
        
        // Canvas Overlays
        'overlay.placeLabel': 'Place product label in this area',
        'overlay.autoScan': '▼ AUTO SCAN ▼',
        
        // Upload/Download
        'upload.uploading': 'Uploading session data...',
        'upload.wait': 'Please wait, do not close this window',
        'download.generating': 'Generating zip file...',
        'download.wait': 'Please wait, preparing your download'
    },
    zh: {
        // Loading Screen
        'loading.title': '正在初始化',
        'loading.message': '正在检查服务器连接...',
        'loading.server': '服务器：',
        'loading.minio': 'MinIO：',
        'loading.checking': '检查中...',
        'loading.online': '在线',
        'loading.offline': '离线',
        'loading.offline.warning': '⚠️ 部分服务不可用。您可以继续使用离线模式。',
        'loading.offline.details': '离线模式将在本地下载分析数据，而不是上传到服务器。',
        'loading.offline.continue': '继续离线模式',
        'loading.offline.retry': '重试连接',
        
        // Status Bar
        'status.server': '服务器：',
        'status.session': '会话：',
        'status.step': '步骤：',
        'status.none': '无',
        'status.connected': '已连接',
        'status.checking': '检查中...',
        'status.disconnected': '已断开',
        'status.offlineMode': '离线模式',
        
        // Captured Frame Area
        'frame.step1': '步骤 1',
        'frame.step2': '步骤 2',
        'frame.placeholder': '拍摄的画面将显示在此处',
        'frame.ocrRecognized': '✅ 已识别',
        'frame.ocrAnalyzing': '⏳ 分析中...',
        'frame.ocrNotFound': '❌ 未找到',
        'frame.ocrError': '❌ 错误',
        'frame.ocrReview': '⚠️ 审核',
        'frame.palmCaptured': '✅ 已拍摄',
        'frame.palmNoHandDetected': '未检测到手部。请将您的手展示给摄像头。',
        
        // Action Buttons
        'button.start': '开始',
        'button.nextStep': '下一步',
        'button.manualCapture': '手动拍摄',
        'button.finish': '完成',
        
        // Steps
        'steps.readyToBegin': '准备开始',
        'steps.preliminaries.title': '准备工作：摄像头和面部居中',
        'steps.preliminaries.activatingCamera': '激活摄像头中...',
        'steps.preliminaries.positionFace': '将您的脸部置于中心',
        'steps.preliminaries.ready': '摄像头就绪 ✓ 面部居中 ✓ - 准备开始',
        'steps.ocr.title': '步骤 1：拍摄产品标签',
        'steps.ocr.productRecognized': '产品已识别 ✓ - 进入下一步...',
        'steps.ocr.proceedingManual': '继续进行人工审核 - 进入下一步...',
        'steps.ocr.showLabel': '向摄像头展示产品标签（自动扫描已激活）',
        'steps.palm.title': '步骤 2：在手/手指上展示产品',
        'steps.palm.complete': '检测完成 ✓ - 进入下一步...',
        'steps.palm.holdSteady': '保持手部稳定：{progress}%',
        'steps.palm.showProduct': '在手/手掌/手指上清晰展示产品 (自动扫描已激活）',
        'steps.faceRubbing.title': '步骤 3：揉搓面部区域',
        'steps.faceRubbing.progress': '额头：{forehead} | 左侧：{left} | 右侧：{right}',
        'steps.faceRubbing.coverage': '面部覆盖率',
        
        // Session status
        'status.sessionNone': '无',
        
        // Loading screen log
        'loading.offlineModeLog': '⚠️ 正在以离线模式运行 - 数据将在本地下载',
        
        // Recording Consent Modal
        'consent.title': '视频录制同意书',
        'consent.intro': '此应用程序将录制每个步骤的视频，用于质量保证和分析目的。',
        'consent.whatRecorded': '将录制的内容：',
        'consent.record1': '每个步骤中您的面部和手部动作的视频',
        'consent.record2': '产品标签拍摄',
        'consent.record3': '手掌检测',
        'consent.record4': '面部揉搓验证',
        'consent.privacy': '您的隐私：',
        'consent.privacy1': '视频将被安全保存',
        'consent.privacy2': '数据仅用于分析目的',
        'consent.note': '注意：视频录制是继续跟踪会话所必需的。',
        'consent.accept': '接受并继续',
        'consent.decline': '拒绝',
        
        // OCR Fail Modal
        'ocr.fail.title': '无法识别产品标签',
        'ocr.fail.message': '自动验证无法检测到拍摄图像中的产品标签。',
        'ocr.fail.question': '您想怎么做？',
        'ocr.fail.retryLabel': '重试：',
        'ocr.fail.retry': '在更好的光线或位置展示产品标签',
        'ocr.fail.continueLabel': '继续：',
        'ocr.fail.continue': '提交图像以供人工审核',
        'ocr.fail.retryBtn': '重试拍摄',
        'ocr.fail.continueBtn': '继续',
        
        // Palm Detection Fail Modal
        'palm.fail.title': '无法检测产品',
        'palm.fail.message': '我们无法扫描您手中的产品。',
        'palm.fail.instruction': '您可以继续手动拍摄以供后端审核。',
        'palm.fail.question': '您想怎么做？',
        'palm.fail.retryLabel': '重试：',
        'palm.fail.retry': '在手掌上更清晰地展示产品，手指向下。',
        'palm.fail.continueLabel': '继续：',
        'palm.fail.continue': '提交图像以供人工审核',
        'palm.fail.retryBtn': '重试拍摄',
        'palm.fail.continueBtn': '继续',
        
        // Review Screen
        'review.title': '会话完成！',
        'review.message': '您已完成所有步骤。您想做什么？',
        'review.ocr': '产品标签：',
        'review.palm': '手部检测：',
        'review.face': '面部揉搓：',
        'review.captured': '✓ 已拍摄',
        'review.recognized': '✓ 已识别',
        'review.manualReview': '⚠️ 人工审核',
        'review.completed': '✓ 已完成',
        'review.submit': '提交分析',
        'review.download': '下载分析',
        'review.restart': '重新开始会话',
        
        // Completion Screen
        'completion.uploadSuccess': '上传成功！',
        'completion.uploadMessage': '所有会话数据已上传到 MinIO。',
        'completion.downloadSuccess': '下载成功！',
        'completion.downloadMessage': '所有会话数据已下载到您的设备。',
        'completion.downloadBtn': '下载分析',
        'completion.newSession': '开始新会话',
        'completion.sessionId': '会话ID',
        'completion.date': '日期',
        'completion.totalFiles': '总文件数',
        'completion.offlineMode': '离线模式 - 数据已保存到本地',
        
        // Warnings
        'warning.centerFace': '请将您的脸部保持在中心框架内',
        'warning.keepInFrame': '请将手保持在画面内',
        'warning.faceNotDetected': '未检测到面部 - 请保持在画面内',
        
        // OCR Analysis
        'ocr.analyzing': '正在分析产品标签...',
        
        // Canvas Overlays
        'overlay.placeLabel': '将产品标签放置在此区域',
        'overlay.autoScan': '▼ 自动扫描 ▼',
        
        // Upload/Download
        'upload.uploading': '正在上传会话数据...',
        'upload.wait': '请稍候，请勿关闭此窗口',
        'download.generating': '正在生成压缩文件...',
        'download.wait': '请稍候，正在准备您的下载'
    }
};

// Current language
let currentLanguage: string = localStorage.getItem('medichek-language') || 'zh';

// Get translation
export function t(key: string, replacements: Record<string, string> = {}): string {
    const langMap = translations[currentLanguage] || translations['en'] || {};
    let text: string = langMap[key] ?? translations['en'][key] ?? key;
    
    // Replace placeholders (global replace for each placeholder)
    Object.keys(replacements).forEach(placeholder => {
        text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), String(replacements[placeholder]));
    });
    
    return text;
}

// Update all translatable elements
export function updateLanguage(lang: string) {
    currentLanguage = lang;
    localStorage.setItem('medichek-language', lang);
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
    
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = t(key!);
    });
    
    // Update language selector buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-lang') === lang) {
            btn.classList.add('active');
        }
    });
}
