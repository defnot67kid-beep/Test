import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, getDocs, increment, arrayUnion, updateDoc, onSnapshot, where, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============ FIREBASE SETUP ============
const firebaseConfig = {
    apiKey: "AIzaSyAupBkllyicDPD9O6CmX4mS4sF5z96mqxc",
    authDomain: "vertexpaste.firebaseapp.com",
    projectId: "vertexpaste",
    storageBucket: "vertexpaste.firebasestorage.app",
    messagingSenderId: "255275350380",
    appId: "1:255275350380:web:7be4e8add2cb5b04045b49"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ============ CONFIG ============
const VIEWER_EARN_RATE = 0.5;
const CAMPAIGN_COST = 0.19;
const ADMIN_EMAIL = "defnot67kid@gmail.com";

// ============ GLOBAL STATE ============
let currentUser = null;
let userData = null;
let allCampaigns = [];
let activeCampaign = null;
let watchTimer = null;
let youtubePlayer = null;
let currentPage = 'home';
let unsubscribeCampaigns = null;

// ============ HELPER FUNCTIONS ============
function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    if (isError) toast.style.background = 'rgba(239,68,68,0.9)';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function extractVideoId(url) {
    const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
    return match ? match[1] : null;
}

function getVideoDuration(videoId) {
    return new Promise((resolve, reject) => {
        const checkYT = () => {
            if (window.YT && window.YT.Player) {
                const div = document.createElement('div');
                div.style.display = 'none';
                document.body.appendChild(div);
                const player = new window.YT.Player(div, {
                    videoId: videoId,
                    events: {
                        onReady: (e) => {
                            const duration = e.target.getDuration();
                            player.destroy();
                            div.remove();
                            resolve(duration);
                        },
                        onError: () => {
                            player.destroy();
                            div.remove();
                            reject(new Error("Invalid video"));
                        }
                    }
                });
            } else {
                setTimeout(checkYT, 200);
            }
        };
        checkYT();
    });
}

// ============ USER FUNCTIONS ============
async function loadUser(uid) {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
        userData = userSnap.data();
    } else {
        userData = {
            uid: uid,
            email: currentUser.email,
            name: currentUser.displayName || currentUser.email,
            photo: currentUser.photoURL || `https://ui-avatars.com/api/?background=f5576c&color=fff&name=${currentUser.email[0]}`,
            credits: 100,
            watchedVideos: [],
            campaignsCreated: [],
            totalEarned: 0,
            createdAt: new Date().toISOString()
        };
        await setDoc(userRef, userData);
    }
}

async function updateCredits(amount) {
    if (!userData) return;
    userData.credits += amount;
    if (amount > 0) userData.totalEarned += amount;
    await setDoc(doc(db, 'users', currentUser.uid), userData, { merge: true });
    
    // Update UI if on home page
    if (currentPage === 'home') renderHomePage();
}

// ============ CAMPAIGN FUNCTIONS ============
async function createCampaign(title, url, targetSeconds) {
    if (!currentUser) {
        showToast("Please login first", true);
        return false;
    }
    
    const cost = targetSeconds * CAMPAIGN_COST;
    if (userData.credits < cost) {
        showToast(`Need ${cost.toFixed(2)} credits. You have ${userData.credits}`, true);
        return false;
    }
    
    const videoId = extractVideoId(url);
    if (!videoId) {
        showToast("Invalid YouTube URL", true);
        return false;
    }
    
    showToast("Checking video duration...");
    let duration;
    try {
        duration = await getVideoDuration(videoId);
    } catch (e) {
        showToast("Failed to get video info", true);
        return false;
    }
    
    if (duration < targetSeconds) {
        showToast(`Video is only ${Math.floor(duration)}s long. Must be longer than ${targetSeconds}s`, true);
        return false;
    }
    
    // Deduct credits
    await updateCredits(-cost);
    
    // Create campaign
    const campaign = {
        id: Date.now().toString(),
        title: title,
        url: url,
        videoId: videoId,
        creatorId: currentUser.uid,
        creatorName: userData.name,
        targetTime: targetSeconds,
        duration: duration,
        views: 0,
        watchTime: 0,
        watchers: [],
        createdAt: new Date().toISOString(),
        active: true
    };
    
    await setDoc(doc(db, 'campaigns', campaign.id), campaign);
    showToast(`Campaign created! Cost: ${cost.toFixed(2)} credits`);
    return true;
}

async function deleteCampaign(campaignId) {
    const campaignRef = doc(db, 'campaigns', campaignId);
    const campaign = await getDoc(campaignRef);
    
    if (campaign.exists() && campaign.data().creatorId === currentUser?.uid) {
        await deleteDoc(campaignRef);
        showToast("Campaign deleted");
    }
}

async function completeWatch(campaign) {
    const reward = campaign.targetTime * VIEWER_EARN_RATE;
    await updateCredits(reward);
    
    // Update campaign stats
    const campaignRef = doc(db, 'campaigns', campaign.id);
    await updateDoc(campaignRef, {
        views: increment(1),
        watchTime: increment(campaign.targetTime),
        watchers: arrayUnion(currentUser.uid)
    });
    
    // Add to watched history
    if (!userData.watchedVideos.includes(campaign.id)) {
        userData.watchedVideos.push(campaign.id);
        await setDoc(doc(db, 'users', currentUser.uid), userData, { merge: true });
    }
    
    showToast(`Earned ${reward.toFixed(2)} credits!`);
    
    // Auto-play next
    if (currentPage === 'home') {
        const next = getNextCampaign();
        if (next) startWatching(next);
    }
}

function getNextCampaign() {
    const available = allCampaigns.filter(c => 
        c.creatorId !== currentUser?.uid && 
        !userData?.watchedVideos.includes(c.id)
    );
    return available[0] || null;
}

// ============ YOUTUBE PLAYER ============
function initPlayer(videoId, campaign) {
    if (youtubePlayer) {
        youtubePlayer.destroy();
    }
    
    return new window.YT.Player('youtubePlayer', {
        videoId: videoId,
        playerVars: { autoplay: 1, controls: 1 },
        events: {
            onStateChange: (e) => {
                if (e.data === 0 && activeCampaign) { // Video ended
                    completeWatch(campaign);
                    activeCampaign = null;
                    if (watchTimer) clearInterval(watchTimer);
                }
            }
        }
    });
}

function startWatching(campaign) {
    if (!campaign || campaign.watchers?.includes(currentUser?.uid)) return;
    
    activeCampaign = campaign;
    
    // Setup UI
    document.getElementById('currentTitle').textContent = campaign.title;
    document.getElementById('currentEarnings').textContent = `+${campaign.targetTime * VIEWER_EARN_RATE} credits`;
    document.getElementById('currentTimer').textContent = campaign.targetTime;
    
    let timeLeft = campaign.targetTime;
    if (watchTimer) clearInterval(watchTimer);
    
    watchTimer = setInterval(() => {
        if (activeCampaign && timeLeft > 0) {
            timeLeft--;
            document.getElementById('currentTimer').textContent = timeLeft;
            const progress = ((campaign.targetTime - timeLeft) / campaign.targetTime) * 100;
            document.getElementById('progressFill').style.width = `${progress}%`;
        }
    }, 1000);
    
    // Load video
    if (window.YT && window.YT.Player) {
        youtubePlayer = initPlayer(campaign.videoId, campaign);
    } else {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
        window.onYouTubeIframeAPIReady = () => {
            youtubePlayer = initPlayer(campaign.videoId, campaign);
        };
    }
}

// ============ RENDER FUNCTIONS ============
function renderHomePage() {
    const container = document.getElementById('pageContent');
    
    if (activeCampaign) {
        container.innerHTML = `
            <div class="card">
                <h2>🎬 Now Watching</h2>
                <div class="video-container">
                    <div id="youtubePlayer"></div>
                </div>
                <div class="campaign-info">
                    <h3 id="currentTitle">${activeCampaign.title}</h3>
                    <div class="stats">
                        <div class="stat">💰 <span id="currentEarnings">0</span> credits</div>
                        <div class="stat">⏱️ <span id="currentTimer">0</span> seconds left</div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <button class="btn-next" onclick="window.nextVideo()">⏭️ Next Video</button>
                </div>
            </div>
        `;
    } else {
        const available = allCampaigns.filter(c => 
            c.creatorId !== currentUser?.uid && 
            !userData?.watchedVideos.includes(c.id)
        );
        
        if (available.length > 0) {
            container.innerHTML = `
                <div class="card">
                    <h2>📺 Available Videos</h2>
                    <div class="campaigns-grid">
                        ${available.map(c => `
                            <div class="campaign-card" onclick="window.watchCampaign('${c.id}')">
                                <h3>${escapeHtml(c.title)}</h3>
                                <p>👁️ ${c.views || 0} views</p>
                                <p>💰 +${c.targetTime * VIEWER_EARN_RATE} credits</p>
                                <p>⏱️ ${c.targetTime} seconds</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="card">
                    <h2>✨ No Videos Available</h2>
                    <p>Create a campaign to start earning credits!</p>
                    <button class="btn-primary" onclick="document.querySelector('[data-page=\\"campaign\\"]').click()">
                        📢 Create Campaign
                    </button>
                </div>
            `;
        }
    }
}

function renderCampaignPage() {
    const myCampaigns = allCampaigns.filter(c => c.creatorId === currentUser?.uid);
    
    const container = document.getElementById('pageContent');
    container.innerHTML = `
        <div class="card">
            <button class="btn-primary" id="createBtn">+ Create New Campaign</button>
        </div>
        <div class="card">
            <h2>My Campaigns</h2>
            ${myCampaigns.length === 0 ? '<p>No campaigns yet</p>' : `
                <div class="campaigns-list">
                    ${myCampaigns.map(c => `
                        <div class="campaign-item">
                            <div>
                                <strong>${escapeHtml(c.title)}</strong>
                                <div>Views: ${c.views || 0} | Target: ${c.targetTime}s</div>
                            </div>
                            <button class="btn-danger" onclick="window.deleteCampaign('${c.id}')">Delete</button>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
    
    document.getElementById('createBtn')?.addEventListener('click', showCreateModal);
}

function renderAccountPage() {
    const container = document.getElementById('pageContent');
    container.innerHTML = `
        <div class="card" style="text-align: center;">
            <img src="${userData?.photo}" style="width: 80px; border-radius: 50%;">
            <h2>${escapeHtml(userData?.name)}</h2>
            <p>${currentUser?.email}</p>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${Math.floor(userData?.credits || 0)}</div>
                    <div class="stat-label">Credits</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${userData?.watchedVideos?.length || 0}</div>
                    <div class="stat-label">Videos Watched</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${userData?.campaignsCreated?.length || 0}</div>
                    <div class="stat-label">Campaigns</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Math.floor(userData?.totalEarned || 0)}</div>
                    <div class="stat-label">Total Earned</div>
                </div>
            </div>
            <button class="btn-secondary" id="signOutBtn">Sign Out</button>
        </div>
    `;
    
    document.getElementById('signOutBtn')?.addEventListener('click', () => signOut(auth));
}

function showCreateModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Create Campaign</h2>
            <p>Cost: ${CAMPAIGN_COST} credits/second</p>
            <p>Your balance: ${userData?.credits} credits</p>
            <input type="text" id="campaignTitle" placeholder="Campaign Title">
            <input type="text" id="campaignUrl" placeholder="YouTube URL">
            <input type="number" id="campaignTime" placeholder="Target Seconds" value="30">
            <div class="modal-buttons">
                <button class="btn-primary" id="confirmCreate">Create</button>
                <button class="btn-secondary" id="cancelCreate">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('confirmCreate')?.addEventListener('click', async () => {
        const title = document.getElementById('campaignTitle').value;
        const url = document.getElementById('campaignUrl').value;
        const time = parseInt(document.getElementById('campaignTime').value);
        
        if (!title || !url) {
            showToast("Please fill all fields", true);
            return;
        }
        
        const success = await createCampaign(title, url, time);
        if (success) {
            modal.remove();
            renderCampaignPage();
        }
    });
    
    document.getElementById('cancelCreate')?.addEventListener('click', () => modal.remove());
}

function renderReferPage() {
    const container = document.getElementById('pageContent');
    container.innerHTML = `
        <div class="card" style="text-align: center;">
            <h2>Referral Program</h2>
            <p>Share your code and earn 10% of what your referrals earn!</p>
            <div class="referral-code">${userData?.uid?.substring(0, 8)}</div>
            <button class="btn-primary" id="copyCode">Copy Code</button>
        </div>
    `;
    
    document.getElementById('copyCode')?.addEventListener('click', () => {
        navigator.clipboard.writeText(userData?.uid?.substring(0, 8));
        showToast("Copied!");
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}

// ============ CAMPAIGN LISTENER ============
function setupCampaignListener() {
    if (unsubscribeCampaigns) unsubscribeCampaigns();
    
    unsubscribeCampaigns = onSnapshot(query(collection(db, 'campaigns'), orderBy('createdAt', 'desc')), (snapshot) => {
        allCampaigns = [];
        snapshot.forEach(doc => {
            allCampaigns.push({ id: doc.id, ...doc.data() });
        });
        
        if (currentPage === 'home') renderHomePage();
        if (currentPage === 'campaign') renderCampaignPage();
    });
}

// ============ PAGE NAVIGATION ============
function navigateTo(page) {
    currentPage = page;
    
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });
    
    // Render page
    if (page === 'home') renderHomePage();
    else if (page === 'campaign') renderCampaignPage();
    else if (page === 'account') renderAccountPage();
    else if (page === 'refer') renderReferPage();
}

// ============ WINDOW FUNCTIONS ============
window.nextVideo = () => {
    if (watchTimer) clearInterval(watchTimer);
    if (youtubePlayer) youtubePlayer.destroy();
    activeCampaign = null;
    const next = getNextCampaign();
    if (next) startWatching(next);
    else renderHomePage();
};

window.watchCampaign = (campaignId) => {
    const campaign = allCampaigns.find(c => c.id === campaignId);
    if (campaign) startWatching(campaign);
};

window.deleteCampaign = deleteCampaign;

// ============ AUTH ============
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUser(user.uid);
        document.body.classList.add('authenticated');
        setupCampaignListener();
        navigateTo('home');
        
        // Show admin button if applicable
        if (user.email === ADMIN_EMAIL) {
            const adminBtn = document.querySelector('[data-page="admin"]');
            if (adminBtn) adminBtn.style.display = 'flex';
        }
    } else {
        currentUser = null;
        userData = null;
        document.body.classList.remove('authenticated');
        if (unsubscribeCampaigns) unsubscribeCampaigns();
    }
});

// ============ INIT ============
document.getElementById('signInBtn')?.addEventListener('click', () => signInWithPopup(auth, provider));

document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

// Check for YouTube API
if (!window.YT) {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
                                      }
