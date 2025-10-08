const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

// Import TikTok libraries
const { TiktokDL } = require('@tobyg74/tiktok-api-dl');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Track which method is being used
let stats = {
    library: 0,
    puppeteer: 0,
    failed: 0
};

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'TikTok Downloader API',
        status: 'running',
        version: '2.0',
        methods: {
            primary: 'TikTok API Library',
            fallback: 'Puppeteer Scraping'
        },
        stats: stats,
        endpoints: {
            download: 'POST /api/download',
            status: 'GET /api/status'
        }
    });
});

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        stats: stats
    });
});

// Download endpoint with fallback system
app.post('/api/download', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        // Validate TikTok URL
        if (!url.includes('tiktok.com') && !url.includes('vm.tiktok.com')) {
            return res.status(400).json({ error: 'Invalid TikTok URL' });
        }
        
        console.log('📥 Attempting to download:', url);
        
        // Try Method 1: TikTok API Library
        try {
            console.log('🔄 Method 1: Using TikTok API Library...');
            const videoData = await extractWithLibrary(url);
            stats.library++;
            console.log('✅ Success with Library!');
            return res.json({
                ...videoData,
                method: 'library'
            });
        } catch (error) {
            console.log('❌ Library failed:', error.message);
            console.log('🔄 Trying fallback method...');
        }
        
        // Try Method 2: Puppeteer Scraping
        try {
            console.log('🔄 Method 2: Using Puppeteer...');
            const videoData = await extractWithPuppeteer(url);
            stats.puppeteer++;
            console.log('✅ Success with Puppeteer!');
            return res.json({
                ...videoData,
                method: 'puppeteer'
            });
        } catch (error) {
            console.log('❌ Puppeteer failed:', error.message);
        }
        
        // Both methods failed
        stats.failed++;
        throw new Error('جميع الطرق فشلت. حاول مرة أخرى لاحقاً.');
        
    } catch (error) {
        console.error('❌ Final Error:', error);
        res.status(500).json({ 
            error: 'فشل في معالجة الفيديو',
            message: error.message 
        });
    }
});

// ============================================
// Method 1: Using TikTok API Library
// ============================================
async function extractWithLibrary(url) {
    try {
        // Try different versions of the library
        const versions = ['v1', 'v2', 'v3'];
        let result = null;
        
        for (const version of versions) {
            try {
                console.log(`  Trying library version: ${version}`);
                result = await TiktokDL(url, { version });
                if (result && result.status === 'success') {
                    break;
                }
            } catch (err) {
                console.log(`  Version ${version} failed:`, err.message);
                continue;
            }
        }
        
        if (!result || result.status !== 'success') {
            throw new Error('Library returned no valid data');
        }
        
        const data = result.result;
        
        // Format duration
        const duration = data.duration ? formatDuration(data.duration) : 'غير معروف';
        
        // Get video URLs (prioritize no watermark version)
        let videoUrl = null;
        if (data.video) {
            if (Array.isArray(data.video)) {
                videoUrl = data.video[0]; // First video is usually no watermark
            } else if (typeof data.video === 'string') {
                videoUrl = data.video;
            } else if (data.video.noWatermark) {
                videoUrl = data.video.noWatermark;
            } else if (data.video.watermark) {
                videoUrl = data.video.watermark;
            }
        }
        
        return {
            videoId: data.id || extractVideoId(url),
            title: data.title || data.desc || 'فيديو TikTok',
            author: data.author?.nickname || data.author?.unique_id || 'Unknown',
            authorUsername: data.author?.unique_id || '',
            thumbnail: data.cover || data.dynamicCover || data.originCover || null,
            duration: duration,
            views: data.playCount ? formatNumber(data.playCount) : '0',
            likes: data.diggCount ? formatNumber(data.diggCount) : '0',
            comments: data.commentCount ? formatNumber(data.commentCount) : '0',
            shares: data.shareCount ? formatNumber(data.shareCount) : '0',
            videoUrl: videoUrl,
            audioUrl: data.music || data.musicInfo?.playUrl || null,
            musicTitle: data.musicInfo?.title || 'صوت أصلي'
        };
        
    } catch (error) {
        throw new Error('Library extraction failed: ' + error.message);
    }
}

// ============================================
// Method 2: Using Puppeteer (Fallback)
// ============================================
async function extractWithPuppeteer(url) {
    let browser = null;
    
    try {
        console.log('  Launching browser...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080'
            ]
        });
        
        const page = await browser.newPage();
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Intercept network requests to capture video URLs
        const videoUrls = [];
        const audioUrls = [];
        
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            request.continue();
        });
        
        page.on('response', async (response) => {
            const url = response.url();
            const contentType = response.headers()['content-type'] || '';
            
            // Capture video URLs
            if (contentType.includes('video') || url.includes('.mp4')) {
                if (!videoUrls.includes(url)) {
                    videoUrls.push(url);
                }
            }
            
            // Capture audio URLs
            if (contentType.includes('audio') || url.includes('.mp3') || url.includes('music')) {
                if (!audioUrls.includes(url)) {
                    audioUrls.push(url);
                }
            }
        });
        
        console.log('  Navigating to TikTok...');
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Wait for video to load
        await page.waitForSelector('video', { timeout: 10000 });
        
        console.log('  Extracting video data...');
        
        // Extract video information from page
        const videoData = await page.evaluate(() => {
            // Try to get video element
            const video = document.querySelector('video');
            const videoSrc = video ? video.src : null;
            
            // Try to get title/description
            let title = '';
            const titleSelectors = [
                '[data-e2e="browse-video-desc"]',
                '.tiktok-j2a19r-SpanText',
                'h1',
                '.video-meta-title'
            ];
            
            for (const selector of titleSelectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent) {
                    title = element.textContent.trim();
                    break;
                }
            }
            
            // Try to get author
            let author = '';
            const authorSelectors = [
                '[data-e2e="browse-username"]',
                '.author-uniqueId',
                '.tiktok-author'
            ];
            
            for (const selector of authorSelectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent) {
                    author = element.textContent.trim().replace('@', '');
                    break;
                }
            }
            
            // Try to get thumbnail
            let thumbnail = '';
            const thumbSelectors = [
                'img[alt*="video"]',
                '.tiktok-video-thumbnail img',
                'video + img'
            ];
            
            for (const selector of thumbSelectors) {
                const element = document.querySelector(selector);
                if (element && element.src) {
                    thumbnail = element.src;
                    break;
                }
            }
            
            return {
                title,
                author,
                thumbnail,
                videoSrc
            };
        });
        
        await browser.close();
        browser = null;
        
        // Find the best video URL (prefer non-watermarked)
        let finalVideoUrl = videoData.videoSrc || videoUrls.find(u => !u.includes('watermark')) || videoUrls[0];
        let finalAudioUrl = audioUrls[0] || null;
        
        if (!finalVideoUrl) {
            throw new Error('No video URL found');
        }
        
        return {
            videoId: extractVideoId(url),
            title: videoData.title || 'فيديو TikTok',
            author: videoData.author || 'مستخدم',
            authorUsername: videoData.author || '',
            thumbnail: videoData.thumbnail || null,
            duration: 'غير معروف',
            views: '0',
            likes: '0',
            comments: '0',
            shares: '0',
            videoUrl: finalVideoUrl,
            audioUrl: finalAudioUrl,
            musicTitle: 'صوت أصلي'
        };
        
    } catch (error) {
        if (browser) {
            await browser.close();
        }
        throw new Error('Puppeteer extraction failed: ' + error.message);
    }
}

// ============================================
// Helper Functions
// ============================================

// Extract video ID from URL
function extractVideoId(url) {
    const match = url.match(/\/video\/(\d+)/);
    return match ? match[1] : Date.now().toString();
}

// Format duration (seconds to MM:SS)
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format large numbers (e.g., 1000 -> 1K)
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log('═══════════════════════════════════════');
    console.log('🚀 TikTok Downloader Server Started!');
    console.log('═══════════════════════════════════════');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🔧 Methods: Library + Puppeteer Fallback`);
    console.log(`📊 Status: http://localhost:${PORT}/api/status`);
    console.log('═══════════════════════════════════════');
});