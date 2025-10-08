// Test script to verify both methods work
const axios = require('axios');

const API_URL = 'http://localhost:3000';

// Test URLs - replace with real TikTok URLs
const testUrls = [
    'https://www.tiktok.com/@username/video/7123456789012345678',
    'https://vm.tiktok.com/ZMabcdefg/'
];

async function testAPI() {
    console.log('🧪 Testing TikTok Downloader API...\n');
    
    // Test 1: Check server status
    console.log('📡 Test 1: Server Status');
    try {
        const response = await axios.get(`${API_URL}/api/status`);
        console.log('✅ Server is online');
        console.log('📊 Stats:', response.data.stats);
        console.log('');
    } catch (error) {
        console.log('❌ Server is offline. Please start the server first.');
        console.log('Run: npm start');
        process.exit(1);
    }
    
    // Test 2: Try downloading a video
    console.log('📥 Test 2: Download Video');
    const testUrl = testUrls[0];
    console.log(`Testing URL: ${testUrl}\n`);
    
    try {
        const response = await axios.post(`${API_URL}/api/download`, {
            url: testUrl
        });
        
        console.log('✅ Download successful!');
        console.log('📊 Method used:', response.data.method);
        console.log('📹 Title:', response.data.title);
        console.log('👤 Author:', response.data.author);
        console.log('🔗 Video URL:', response.data.videoUrl ? '✅ Available' : '❌ Not available');
        console.log('🎵 Audio URL:', response.data.audioUrl ? '✅ Available' : '❌ Not available');
        console.log('');
        
    } catch (error) {
        console.log('❌ Download failed');
        console.log('Error:', error.response?.data?.message || error.message);
        console.log('\n⚠️ This is normal if you used a fake URL.');
        console.log('Try with a real TikTok URL in the browser interface.\n');
    }
    
    // Test 3: Check final stats
    console.log('📊 Test 3: Final Statistics');
    try {
        const response = await axios.get(`${API_URL}/api/status`);
        console.log('Library successes:', response.data.stats.library);
        console.log('Puppeteer successes:', response.data.stats.puppeteer);
        console.log('Failures:', response.data.stats.failed);
    } catch (error) {
        console.log('❌ Could not fetch stats');
    }
    
    console.log('\n✅ Testing complete!');
    console.log('\n💡 Next steps:');
    console.log('1. Open frontend/index.html in your browser');
    console.log('2. Paste a real TikTok video URL');
    console.log('3. Click "تحميل الفيديو"');
}

// Run tests
testAPI().catch(console.error);