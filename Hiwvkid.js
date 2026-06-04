/* === 1. Security Layer (Anti-Theft) === */

// A. Anti-Debugging (Freezes DevTools)
setInterval(function() {
    (function() { return false; }['constructor']('debugger')());
}, 2000);

// B. Domain Lock (Only allow running on your GitHub Pages)
// ပြင်ရန်: အောက်က 'ya2umi.github.io' နေရာမှာ အစ်ကို့ရဲ့ အမှန်တကယ် Domain ကို ထည့်ပါ။ Local မှာစမ်းဖို့ 'localhost' ထည့်ထားပေးပါတယ်။
const allowedDomains = ['ya2umi12.github.io', 'localhost', '127.0.0.1'];
const currentDomain = window.location.hostname;
if (!allowedDomains.includes(currentDomain) && currentDomain !== "") {
    document.body.innerHTML = "<h1 style='color:red; text-align:center; margin-top:20%;'>Unauthorized Domain! YZ Tool is locked.</h1>";
    window.location.href = "https://t.me/yazumiskylin3"; // Redirect to your TG
}

// C. Advanced Key Blocking (Inspect Element, View Source)
document.addEventListener('keydown', function(e) {
    if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || 
        (e.ctrlKey && e.key === 'U') || 
        (e.ctrlKey && e.key === 'S') || 
        (e.ctrlKey && e.key === 'P') ||
        (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'J' || e.key === 'U'))
    ) {
        e.preventDefault();
        return false;
    }
});


/* === 2. Application Logic === */

let isEngineLoaded = false;
let ffmpeg = null;
let currentLang = 'MM';
let selectedFile = null;

const toast = document.getElementById('toast');
const startBtn = document.getElementById('startBtn');
const f1Toggle = document.getElementById('f1-toggle');
const f2Toggle = document.getElementById('f2-toggle');
const f3Toggle = document.getElementById('f3-toggle');
const f1SliderBox = document.getElementById('f1-slider-box');
const f2SliderBox = document.getElementById('f2-slider-box');
const f3Input = document.getElementById('f3-input');
const uploader = document.getElementById('videoUploader');

// --- Initialization ---
window.onload = async () => {
    const { createFFmpeg } = FFmpeg;
    async function tryLoad(cdnUrl) {
        ffmpeg = createFFmpeg({ corePath: cdnUrl, log: false });
        ffmpeg.setProgress(({ ratio }) => {
            let percent = Math.round(ratio * 100);
            if(percent < 0) percent = 0; if(percent > 100) percent = 100;
            document.getElementById('progressBar').value = percent;
            document.getElementById('progressText').innerText = `Processing: ${percent}%`;
        });
        await ffmpeg.load();
    }

    try {
        await tryLoad('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js');
        isEngineLoaded = true;
    } catch (err) {
        try {
            await tryLoad('https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js');
            isEngineLoaded = true;
        } catch (e) {
            alert("Engine Error! Check Internet Connection.");
        }
    }
    
    // Load initial language
    switchLang('MM');
};

function checkEngine(e) {
    if (!isEngineLoaded) {
        e.preventDefault();
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 2000);
    }
}

// --- Metadata Logic ---
uploader.addEventListener('change', (e) => {
    if(!isEngineLoaded) return;
    const file = e.target.files[0];
    if(!file) return;
    selectedFile = file;

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = function() {
        window.URL.revokeObjectURL(video.src);
        document.getElementById('v-res').innerText = `${video.videoWidth}x${video.videoHeight}`;
        const mins = Math.floor(video.duration / 60);
        const secs = Math.floor(video.duration % 60);
        document.getElementById('v-dur').innerText = `${mins}m ${secs}s`;
        const bitrateKbps = Math.round((file.size * 8) / video.duration / 1024);
        document.getElementById('v-bit').innerText = `${bitrateKbps} kbps`;
        document.getElementById('videoDetails').style.display = 'grid';
    }
    video.src = URL.createObjectURL(file);
});

// --- UI Toggles ---
f1Toggle.addEventListener('change', (e) => {
    if(!isEngineLoaded) { e.target.checked = false; return; }
    f1SliderBox.style.display = e.target.checked ? 'block' : 'none';
    if(e.target.checked && f3Toggle.checked) { f3Toggle.checked = false; triggerF3(); }
});
f2Toggle.addEventListener('change', (e) => {
    if(!isEngineLoaded) { e.target.checked = false; return; }
    f2SliderBox.style.display = e.target.checked ? 'block' : 'none';
    if(e.target.checked && f3Toggle.checked) { f3Toggle.checked = false; triggerF3(); }
});
f3Toggle.addEventListener('change', (e) => {
    if(!isEngineLoaded) { e.target.checked = false; return; }
    triggerF3();
    if(e.target.checked) {
        f1Toggle.checked = false; f1SliderBox.style.display = 'none';
        f2Toggle.checked = false; f2SliderBox.style.display = 'none';
    }
});
function triggerF3() { f3Input.style.display = f3Toggle.checked ? 'block' : 'none'; }

// --- Translations ---
const texts = {
    EN: `
        <ul style="padding-left: 20px; margin: 0;">
            <li style="margin-bottom: 8px;">Use YZ V5 strictly on Chrome Browser.</li>
            <li style="margin-bottom: 8px;">You can leave settings at default.</li>
            <li style="margin-bottom: 8px;">Enabling <b>Ultra Smooth</b> alone retains video duration but provides high-quality smoothness.</li>
            <li style="margin-bottom: 8px;">Enabling <b>Fake FPS</b> will alter video duration and cause a slow-mo bug on PC browsers, but it works perfectly on mobile.</li>
            <li style="margin-bottom: 8px;">To upload to TikTok, download Edge Browser.</li>
            <li style="margin-bottom: 8px;">Turn on Desktop Mode in Edge and upload with privacy set to 'Only me'.</li>
            <li style="margin-bottom: 8px;">Include <b>#yztool</b> in your caption.</li>
            <li>Switch visibility back to 'Everyone' from the TikTok App later.</li>
        </ul>`,
    MM: `
        <ul style="padding-left: 20px; margin: 0;">
            <li style="margin-bottom: 8px;">YZ V5 ကို Chrome Browser မှာ အသုံးပြုပါ။</li>
            <li style="margin-bottom: 8px;">Setting များကို Default အတိုင်း ထားသုံးနိုင်ပါတယ်။</li>
            <li style="margin-bottom: 8px;"><b>Ultra Smooth</b> တစ်ခုတည်း On လျှင် Video duration ပြောင်းလဲမှုမရှိဘဲ smooth ဖြစ်ဖြစ် quality ရပါမယ်။</li>
            <li style="margin-bottom: 8px;"><b>Fake FPS</b> On ပါက Video duration ပြောင်းလဲမှုရှိပြီး Browser တွင် Slow-mo bug ဖြစ်ပါမယ်။ ဒါပေမဲ့ Mobile တွင် အဆင်ပြေပါလိမ့်မယ်။</li>
            <li style="margin-bottom: 8px;">Tiktok ပေါ် Video တင်ရန် Edge Browser ကို Download ဆွဲပါ။</li>
            <li style="margin-bottom: 8px;">Edge browser မှာ Desktop mode On ပြီး Privacy ကို 'Only me' ထားပြီး တင်ပါ။</li>
            <li style="margin-bottom: 8px;">Caption မှာ <b>#yztool</b> ထည့်ရေးပါ။</li>
            <li>Tiktok App မှ 'Everyone' ပြန်ပြောင်းပါ။</li>
        </ul>`
};

function switchLang(lang) {
    currentLang = lang;
    document.getElementById('ruleContent').innerHTML = texts[lang];
    document.getElementById('btn-mm').className = lang === 'MM' ? 'lang-box active' : 'lang-box';
    document.getElementById('btn-en').className = lang === 'EN' ? 'lang-box active' : 'lang-box';
}

// --- Engine Execution ---
async function startProcess() {
    if(!isEngineLoaded) { checkEngine(new Event('click')); return; }
    if(!selectedFile) { alert("Please select a video file first!"); return; }
    
    const f1Map = {
        "1": "tmix=frames=2:weights=5 5",
        "2": "tmix=frames=3:weights=6 3 1",
        "3": "tmix=frames=4:weights=4 3 2 1"
    };
    
    // User Update: Extreme (Level 4) fixed from 50 to 30 fps
    const f2Map = {
        "1": { scale: '2', fps: '30' },
        "2": { scale: '2', fps: '60' },
        "3": { scale: '4', fps: '30' },
        "4": { scale: '8', fps: '30' } 
    };

    let args = [];

    if (f3Toggle.checked) {
        const customText = f3Input.value.trim();
        if(!customText) { alert("Please enter custom arguments!"); return; }
        args = ['-i', 'input.mp4', ...customText.split(' '), '-movflags', '+faststart', 'output.mp4'];
    } else {
        if(f2Toggle.checked) {
            args.push('-itsscale', f2Map[document.getElementById('f2-slider').value].scale);
        }
        args.push('-i', 'input.mp4');
        if(f1Toggle.checked) {
            args.push('-filter:v', f1Map[document.getElementById('f1-slider').value]);
        }
        if(f2Toggle.checked) {
            args.push('-r', f2Map[document.getElementById('f2-slider').value].fps);
        }
        args.push('-preset', 'ultrafast', '-movflags', '+faststart', 'output.mp4');
    }

    if(!f1Toggle.checked && !f2Toggle.checked && !f3Toggle.checked) {
        args = ['-i', 'input.mp4', '-c', 'copy', '-movflags', '+faststart', 'output.mp4'];
    }

    startBtn.disabled = true;
    startBtn.innerText = "Engine Running...";
    document.getElementById('progressBox').style.display = 'block';
    document.getElementById('progressBar').value = 0;
    
    try {
        const { fetchFile } = FFmpeg;
        ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(selectedFile));
        
        await ffmpeg.run(...args);
        
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `YZ_${selectedFile.name}`; 
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        startBtn.innerText = "Completed!";
        startBtn.style.background = "#34C759";
        
        try { ffmpeg.FS('unlink', 'input.mp4'); ffmpeg.FS('unlink', 'output.mp4'); } catch(e) {}

        setTimeout(() => {
            startBtn.innerText = "Start Processing";
            startBtn.style.background = "";
            startBtn.disabled = false;
            document.getElementById('progressBox').style.display = 'none';
        }, 4000);

    } catch (error) {
        console.error(error);
        alert("Engine encountered an error.");
        startBtn.innerText = "Start Processing";
        startBtn.disabled = false;
    }
}