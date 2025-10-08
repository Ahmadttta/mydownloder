// API Configuration
const API_URL = 'http://localhost:3000/api'; // عدل هذا حسب عنوان السيرفر

// Global variables
let currentVideoData = null;

// Download video function
async function downloadVideo() {
    const urlInput = document.getElementById('videoUrl');
    const url = urlInput.value.trim();
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const error = document.getElementById('error');
    
    // Hide previous results
    results.classList.add('hidden');
    error.classList.add('hidden');
    
    // Validate URL
    if (!url) {
        showError('⚠️ الرجاء إدخال رابط الفيديو');
        return;
    }
    
    if (!url.includes('tiktok.com') && !url.includes('vm.tiktok.com')) {
        showError('⚠️ الرجاء إدخال رابط صحيح من TikTok');
        return;
    }
    
    // Show loading
    loading.classList.remove('hidden');
    
    try {
        // Send request to backend
        const response = await fetch(`${API_URL}/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: url })
        });
        
        if (!response.ok) {
            throw new Error('فشل في جلب معلومات الفيديو');
        }
        
        const data = await response.json();
        currentVideoData = data;
        
        // Hide loading
        loading.classList.add('hidden');
        
        // Show results
        displayResults(data);
        
    } catch (err) {
        loading.classList.add('hidden');
        showError('❌ حدث خطأ: ' + err.message);
        console.error('Error:', err);
    }
}

// Display results
function displayResults(data) {
    const results = document.getElementById('results');
    const videoPreview = document.getElementById('videoPreview');
    
    // Create preview HTML
    const thumbnailContent = data.thumbnail 
        ? `<img src="${data.thumbnail}" alt="Video thumbnail">` 
        : '🎬';
    
    videoPreview.innerHTML = `
        <div class="preview-box">
            <div class="preview-thumbnail">
                ${thumbnailContent}
            </div>
            <div class="preview-info">
                <h4 class="preview-title">${data.title || 'فيديو TikTok'}</h4>
                <p class="preview-author">@${data.author || data.authorUsername || 'username'}</p>
                <p class="preview-stats">
                    ${data.duration ? `⏱️ ${data.duration}` : ''} 
                    ${data.views ? `👁️ ${data.views}` : ''}
                    ${data.likes ? `❤️ ${data.likes}` : ''}
                </p>
            </div>
        </div>
    `;
    
    results.classList.remove('hidden');
}

// Download file (video or audio)
async function downloadFile(type) {
    if (!currentVideoData) {
        showError('❌ لا توجد بيانات للتحميل');
        return;
    }
    
    try {
        const downloadUrl = type === 'video' ? currentVideoData.videoUrl : currentVideoData.audioUrl;
        
        if (!downloadUrl) {
            showError('❌ رابط التحميل غير متوفر');
            return;
        }
        
        // Create download link
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `tiktok_${type}_${Date.now()}.${type === 'video' ? 'mp4' : 'mp3'}`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
    } catch (err) {
        showError('❌ فشل التحميل: ' + err.message);
        console.error('Download error:', err);
    }
}

// Show error message
function showError(message) {
    const error = document.getElementById('error');
    const errorText = error.querySelector('.error-text');
    
    if (errorText) {
        errorText.textContent = message;
    } else {
        error.innerHTML = `
            <div class="error-icon">❌</div>
            <p class="error-text">${message}</p>
        `;
    }
    
    error.classList.remove('hidden');
}

// Allow Enter key to trigger download
document.addEventListener('DOMContentLoaded', function() {
    const urlInput = document.getElementById('videoUrl');
    if (urlInput) {
        urlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                downloadVideo();
            }
        });
    }
});