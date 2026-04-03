import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, getDocs, increment, arrayUnion, updateDoc, onSnapshot, where, orderBy, deleteDoc, runTransaction, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
provider.setCustomParameters({ prompt: 'select_account' });

// ============ CONFIGURATION ============
const DEFAULT_REFERRAL_CODE = "REFAI40PA";
const DEFAULT_REFERRAL_EMAIL = "defnot67kid@gmail.com";
const DEFAULT_REFERRAL_PERCENT = 0.0009;
const USER_REFERRAL_PERCENT = 0.025;
const EARNINGS_RATE = 0.19;  // UPDATED: 0.19 per second
const CREATE_CAMPAIGN_COST = 15;
const BASE_URL = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');

let currentUser = null;
let userData = null;
let currentPage = 'home';
let allCampaigns = [];
let activeWatchData = null;
let autoplayEnabled = true;
let youtubePlayer = null;
let watchInterval = null;
let watchedHistory = [];
let unsubscribeCampaigns = null;
let unsubscribeReferralEarnings = null;
let performanceChart = null;
let isTabVisible = true;
let isAdmin = false;
let defaultReferrerIdCache = null;

function showToast(msg, isErr = false) {
    const t = document.createElement('div');
    t.className = 'toast';
    if (isErr) t.style.background = 'rgba(239,68,68,0.9)';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function showNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, { body });
    }
    showToast(`${title}: ${body}`);
}

// Tab visibility - PAUSE VIDEO WHEN TAB CHANGES
document.addEventListener('visibilitychange', () => {
    isTabVisible = !document.hidden;
    if (activeWatchData) {
        if (!isTabVisible && youtubePlayer && youtubePlayer.pauseVideo) {
            youtubePlayer.pauseVideo();
            activeWatchData.isPaused = true;
        } else if (isTabVisible && youtubePlayer && activeWatchData?.isPaused && !activeWatchData.completed && youtubePlayer.playVideo) {
            youtubePlayer.playVideo();
            activeWatchData.isPaused = false;
        }
    }
});

function pauseCurrentVideo() {
    if (youtubePlayer && youtubePlayer.pauseVideo) {
        youtubePlayer.pauseVideo();
    }
    if (activeWatchData) {
        activeWatchData.isPaused = true;
    }
}

function stopCurrentWatch() {
    if (watchInterval) clearInterval(watchInterval);
    if (youtubePlayer && youtubePlayer.destroy) youtubePlayer.destroy();
    youtubePlayer = null;
    activeWatchData = null;
}

async function getDefaultReferrerId() {
    if (defaultReferrerIdCache) return defaultReferrerIdCache;
    try {
        const q = query(collection(db, 'viewswap_users'), where('email', '==', DEFAULT_REFERRAL_EMAIL));
        const snap = await getDocs(q);
        if (!snap.empty) {
            defaultReferrerIdCache = snap.docs[0].id;
            const defaultRef = doc(db, 'viewswap_users', defaultReferrerIdCache);
            const defaultSnap = await getDoc(defaultRef);
            if (defaultSnap.exists() && defaultSnap.data().referralCode !== DEFAULT_REFERRAL_CODE) {
                await updateDoc(defaultRef, { referralCode: DEFAULT_REFERRAL_CODE });
            }
            return defaultReferrerIdCache;
        }
        return null;
    } catch (e) {
        console.error("Error getting default referrer:", e);
        return null;
    }
}

async function ensureDefaultReferral(userId, userEmail) {
    const defaultReferrerId = await getDefaultReferrerId();
    if (!defaultReferrerId || defaultReferrerId === userId) return;
    const userRef = doc(db, 'viewswap_users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const currentReferredBy = userSnap.data().referredBy;
        if (!currentReferredBy) {
            await updateDoc(userRef, { referredBy: defaultReferrerId });
            await updateDoc(doc(db, 'viewswap_users', defaultReferrerId), { referrals: arrayUnion(userId) });
            showToast(`Auto-applied default referral code: ${DEFAULT_REFERRAL_CODE}`);
        }
    }
}

async function processQRReferral(code) {
    if (!currentUser || userData.referredBy) return;
    const q = query(collection(db, 'viewswap_users'), where('referralCode', '==', code));
    const snap = await getDocs(q);
    if (!snap.empty && snap.docs[0].id !== currentUser.uid) {
        userData.referredBy = snap.docs[0].id;
        await saveUserData();
        await updateDoc(doc(db, 'viewswap_users', snap.docs[0].id), { referrals: arrayUnion(currentUser.uid) });
        await updateCredits(10);
        showNotification('Referral Success', `+10 credits from ${snap.docs[0].data().displayName || 'referral'}!`);
    } else {
        showToast('Invalid code', true);
    }
}

async function loadUserData(uid) {
    const ref = doc(db, 'viewswap_users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
        userData = snap.data();
        userData.streak = userData.streak || { current: 0, lastClaim: null, highest: 0 };
        userData.watchedVideos = userData.watchedVideos || [];
        userData.referralEarnings = userData.referralEarnings || 0;
        userData.totalEarned = userData.totalEarned || 0;
        userData.earningsHistory = userData.earningsHistory || [];
        watchedHistory = userData.recentlyWatched || [];
        userData.defaultReferralEarnings = userData.defaultReferralEarnings || 0;
    } else {
        userData = {
            uid, email: currentUser.email, displayName: currentUser.displayName || currentUser.email,
            photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?background=f5576c&color=fff&name=${encodeURIComponent(currentUser.email)}`,
            credits: 100, referralCode: 'REF' + uid.substring(0, 8).toUpperCase(),
            referredBy: null,
            referralEarnings: 0, defaultReferralEarnings: 0,
            totalEarned: 0, watchedVideos: [], campaigns: [],
            streak: { current: 0, lastClaim: null, highest: 0 }, totalWatchTime: 0,
            likedCampaigns: [], subscribedChannels: [], recentlyWatched: [],
            totalEarnedByReferralShare: 0, totalEarnedByDefaultReferralShare: 0,
            earningsHistory: [], createdAt: new Date().toISOString()
        };
        await setDoc(ref, userData);
    }
    await ensureDefaultReferral(uid, currentUser.email);
    const updatedSnap = await getDoc(ref);
    if (updatedSnap.exists()) userData = updatedSnap.data();
    await autoProcessDailyBonus();
    setupReferralEarningsListener();
    return userData;
}

async function saveUserData() {
    if (currentUser) {
        userData.recentlyWatched = watchedHistory;
        await setDoc(doc(db, 'viewswap_users', currentUser.uid), userData, { merge: true });
    }
}

// DUAL REFERRAL SYSTEM
async function addAllReferralEarnings(earnerId, earnedAmount) {
    if (!earnerId || earnedAmount <= 0) return;
    try {
        const earnerSnap = await getDoc(doc(db, 'viewswap_users', earnerId));
        if (!earnerSnap.exists()) return;
        const earnerData = earnerSnap.data();
        const userReferrerId = earnerData.referredBy;
        if (userReferrerId && userReferrerId !== earnerId) {
            const userShare = earnedAmount * USER_REFERRAL_PERCENT;
            if (userShare > 0) {
                await runTransaction(db, async (transaction) => {
                    const refRef = doc(db, 'viewswap_users', userReferrerId);
                    const refSnap = await transaction.get(refRef);
                    if (refSnap.exists()) {
                        transaction.update(refRef, {
                            referralEarnings: (refSnap.data().referralEarnings || 0) + userShare,
                            totalEarnedByReferralShare: (refSnap.data().totalEarnedByReferralShare || 0) + userShare,
                            credits: (refSnap.data().credits || 0) + userShare
                        });
                    }
                });
            }
        }
        const defaultReferrerId = await getDefaultReferrerId();
        if (defaultReferrerId && defaultReferrerId !== earnerId) {
            const defaultShare = earnedAmount * DEFAULT_REFERRAL_PERCENT;
            if (defaultShare > 0) {
                await runTransaction(db, async (transaction) => {
                    const defaultRef = doc(db, 'viewswap_users', defaultReferrerId);
                    const defaultSnap = await transaction.get(defaultRef);
                    if (defaultSnap.exists()) {
                        transaction.update(defaultRef, {
                            defaultReferralEarnings: (defaultSnap.data().defaultReferralEarnings || 0) + defaultShare,
                            totalEarnedByDefaultReferralShare: (defaultSnap.data().totalEarnedByDefaultReferralShare || 0) + defaultShare,
                            credits: (defaultSnap.data().credits || 0) + defaultShare
                        });
                    }
                });
            }
        }
    } catch (e) {
        console.error("Referral error:", e);
    }
}

async function updateCredits(amount) {
    userData.credits += amount;
    if (amount > 0) {
        userData.totalEarned += amount;
        userData.earningsHistory.push({ timestamp: Date.now(), amount: amount });
        if (userData.earningsHistory.length > 48) userData.earningsHistory.shift();
        await saveUserData();
        await addAllReferralEarnings(currentUser.uid, amount);
    } else {
        await saveUserData();
    }
    if (currentPage === 'home') renderCurrentPage();
}

async function autoProcessDailyBonus() {
    if (!currentUser || !userData) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastClaimRaw = userData.streak?.lastClaim;
    let lastDate = lastClaimRaw ? new Date(lastClaimRaw) : null;
    if (lastDate) lastDate.setHours(0, 0, 0, 0);
    if (lastDate && lastDate.getTime() === today.getTime()) return;
    let newStreak = lastDate && (lastDate.getTime() === new Date(today.getTime() - 86400000).getTime()) ? (userData.streak.current || 0) + 1 : 1;
    let bonusAmount = 25 + Math.floor(newStreak / 7) * 10;
    userData.credits += bonusAmount;
    userData.totalEarned += bonusAmount;
    userData.streak = { current: newStreak, lastClaim: today.toISOString(), highest: Math.max(newStreak, userData.streak?.highest || 0) };
    await saveUserData();
    showNotification('Daily Bonus', `+${bonusAmount} credits! ${newStreak} day streak!`);
}

function setupReferralEarningsListener() {
    if (unsubscribeReferralEarnings) unsubscribeReferralEarnings();
    if (!currentUser || !userData?.referralCode) return;
    unsubscribeReferralEarnings = onSnapshot(query(collection(db, 'viewswap_users'), where('referredBy', '==', currentUser.uid)), async (snapshot) => {
        let total = 0;
        for (const docSnap of snapshot.docs) total += (docSnap.data().totalEarnedByReferralShare || 0);
        if (Math.abs(userData.referralEarnings - total) > 0.001) {
            userData.referralEarnings = total;
            await saveUserData();
            if (currentPage === 'rewards' || currentPage === 'account') renderCurrentPage();
        }
    });
}

function extractVideoId(url) {
    const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
    return match ? match[1] : null;
}

async function getVideoDuration(videoId) {
    return new Promise((resolve) => {
        if (!window.YT || !window.YT.Player) {
            resolve(30);
            return;
        }
        const tempPlayer = new window.YT.Player('temp-player', {
            videoId: videoId,
            events: {
                onReady: (event) => {
                    const duration = event.target.getDuration();
                    event.target.destroy();
                    resolve(duration || 30);
                },
                onError: () => resolve(30)
            }
        });
        setTimeout(() => resolve(30), 5000);
    });
}

// AUTO DELETE CAMPAIGNS that have more watch time than video duration
async function autoDeleteInvalidCampaigns() {
    const campaignsSnapshot = await getDocs(collection(db, 'viewswap_campaigns'));
    let deletedCount = 0;
    for (const campaignDoc of campaignsSnapshot.docs) {
        const campaign = campaignDoc.data();
        // Check if campaign has accumulated more watch time than video duration
        if (campaign.videoDuration && campaign.totalWatchTimeSeconds > campaign.videoDuration) {
            // Refund creator
            const creatorRef = doc(db, 'viewswap_users', campaign.creatorId);
            const creatorSnap = await getDoc(creatorRef);
            if (creatorSnap.exists()) {
                await updateDoc(creatorRef, { credits: increment(CREATE_CAMPAIGN_COST) });
                showNotification('Campaign Deleted', `Your campaign "${campaign.title}" exceeded video duration. ${CREATE_CAMPAIGN_COST} credits refunded.`);
            }
            await deleteDoc(campaignDoc.ref);
            deletedCount++;
        }
        // Also check if target watch time exceeds video duration
        else if (campaign.videoDuration && campaign.targetWatchTime > campaign.videoDuration) {
            const creatorRef = doc(db, 'viewswap_users', campaign.creatorId);
            const creatorSnap = await getDoc(creatorRef);
            if (creatorSnap.exists()) {
                await updateDoc(creatorRef, { credits: increment(CREATE_CAMPAIGN_COST) });
                showNotification('Campaign Deleted', `Your campaign "${campaign.title}" had target time > video duration. ${CREATE_CAMPAIGN_COST} credits refunded.`);
            }
            await deleteDoc(campaignDoc.ref);
            deletedCount++;
        }
    }
    if (deletedCount > 0) {
        showToast(`🗑️ Auto-deleted ${deletedCount} invalid campaign(s)`);
    }
}

async function validateAndCreateCampaign(campaignData) {
    if (userData.credits < CREATE_CAMPAIGN_COST) {
        showToast(`Need ${CREATE_CAMPAIGN_COST} credits`, true);
        return false;
    }
    const videoId = extractVideoId(campaignData.url);
    if (!videoId) {
        showToast('Invalid YouTube URL', true);
        return false;
    }
    
    const duration = await getVideoDuration(videoId);
    let targetTime = parseInt(campaignData.targetWatchTime) || 30;
    
    // Auto-adjust target time to not exceed video duration
    if (targetTime > duration) {
        targetTime = Math.floor(duration);
        showToast(`Target time auto-adjusted to ${targetTime}s (video duration)`);
    }
    
    if (duration < 1) {
        showToast('Could not get video duration', true);
        return false;
    }
    
    await updateCredits(-CREATE_CAMPAIGN_COST);
    const campaign = {
        id: Date.now().toString(), 
        title: campaignData.title, 
        url: campaignData.url, 
        videoId,
        creatorId: currentUser.uid, 
        creatorName: userData.displayName, 
        creatorEmail: currentUser.email,
        createdAt: new Date().toISOString(), 
        targetWatchTime: targetTime, 
        videoDuration: duration,
        totalWatchTimeSeconds: 0, 
        watchers: [], 
        watcherWatchTime: {},
        isActive: true, 
        totalViews: 0
    };
    await setDoc(doc(db, 'viewswap_campaigns', campaign.id), campaign);
    showToast(`✅ Campaign created! Duration: ${Math.floor(duration)}s, Target: ${targetTime}s | Earn: ${(targetTime * EARNINGS_RATE).toFixed(2)} credits`);
    return true;
}

async function deleteCampaign(campaignId) {
    if (confirm('Delete this campaign?')) {
        await deleteDoc(doc(db, 'viewswap_campaigns', campaignId));
        showToast('Campaign deleted');
        renderCurrentPage();
    }
}

// Admin Functions
async function adminDeleteCampaign(campaignId) {
    await deleteDoc(doc(db, 'viewswap_campaigns', campaignId));
    showToast('Campaign deleted by admin');
    if (currentPage === 'admin') renderAdminPanel();
}

async function adminGiveCredits(userEmail, amount) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const userId = snap.docs[0].id;
        await updateDoc(doc(db, 'viewswap_users', userId), { credits: increment(parseFloat(amount)), totalEarned: increment(parseFloat(amount)) });
        showToast(`Added ${amount} credits to ${userEmail}`);
        showNotification('Admin Action', `You received ${amount} credits from admin!`);
        if (currentPage === 'admin') renderAdminPanel();
    } else {
        showToast('User not found', true);
    }
}

async function adminRemoveCredits(userEmail, amount) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const userId = snap.docs[0].id;
        await updateDoc(doc(db, 'viewswap_users', userId), { credits: increment(-parseFloat(amount)) });
        showToast(`Removed ${amount} credits from ${userEmail}`);
        if (currentPage === 'admin') renderAdminPanel();
    } else {
        showToast('User not found', true);
    }
}

async function adminRemoveReferral(userEmail) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const userId = snap.docs[0].id;
        const userRef = doc(db, 'viewswap_users', userId);
        const userSnap = await getDoc(userRef);
        const oldReferrer = userSnap.data().referredBy;
        await updateDoc(userRef, { referredBy: null });
        if (oldReferrer) {
            const oldRefSnap = await getDoc(doc(db, 'viewswap_users', oldReferrer));
            if (oldRefSnap.exists()) {
                const newReferrals = (oldRefSnap.data().referrals || []).filter(id => id !== userId);
                await updateDoc(doc(db, 'viewswap_users', oldReferrer), { referrals: newReferrals });
            }
        }
        showToast(`Removed referral for ${userEmail}`);
        if (currentPage === 'admin') renderAdminPanel();
    }
}

async function adminRemoveAllReferrals() {
    if (confirm('⚠️ WARNING: This will remove ALL referral relationships for ALL users. This action cannot be undone. Are you sure?')) {
        const usersSnapshot = await getDocs(collection(db, 'viewswap_users'));
        const batch = writeBatch(db);
        usersSnapshot.forEach(docSnap => {
            batch.update(docSnap.ref, { referredBy: null, referrals: [] });
        });
        await batch.commit();
        showToast('All referrals have been removed');
        if (currentPage === 'admin') renderAdminPanel();
    }
}

async function completeCampaign(campaign) {
    const finalReward = campaign.targetWatchTime * EARNINGS_RATE;
    await updateCredits(finalReward);
    userData.totalWatchTime = (userData.totalWatchTime || 0) + campaign.targetWatchTime;
    const campaignRef = doc(db, 'viewswap_campaigns', campaign.id);
    await updateDoc(campaignRef, {
        totalWatchTimeSeconds: increment(campaign.targetWatchTime), 
        totalViews: increment(1),
        [`watcherWatchTime.${currentUser.uid}`]: campaign.targetWatchTime, 
        watchers: arrayUnion(currentUser.uid)
    });
    if (!userData.watchedVideos.includes(campaign.videoId)) userData.watchedVideos.push(campaign.videoId);
    watchedHistory.unshift(campaign.id);
    if (watchedHistory.length > 10) watchedHistory.pop();
    await saveUserData();
    
    // Auto-delete check after completion
    await autoDeleteInvalidCampaigns();
    
    if (autoplayEnabled && currentPage === 'home') {
        const next = getNextCampaign();
        if (next) setTimeout(() => startAutoWatch(next), 300);
        else renderCurrentPage();
    } else {
        renderCurrentPage();
    }
}

function getNextCampaign() {
    const available = allCampaigns.filter(c => c.creatorId !== currentUser?.uid && !watchedHistory.includes(c.id) && c.isActive !== false);
    return available[0] || allCampaigns.filter(c => c.creatorId !== currentUser?.uid)[0];
}

function initYouTubePlayer(videoId, campaign) {
    const div = document.getElementById('current_player');
    if (!div || !videoId) return null;
    if (youtubePlayer && youtubePlayer.destroy) youtubePlayer.destroy();
    return new window.YT.Player('current_player', {
        videoId, 
        playerVars: { autoplay: 1, controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
            onStateChange: (e) => {
                if (activeWatchData) {
                    if (e.data === 2) activeWatchData.isPaused = true;
                    else if (e.data === 1) activeWatchData.isPaused = false;
                    else if (e.data === 0 && activeWatchData && !activeWatchData.completed) {
                        activeWatchData.completed = true;
                        completeCampaign(campaign);
                    }
                }
            },
            onError: () => { nextVideo(); }
        }
    });
}

async function startAutoWatch(campaign) {
    if (!currentUser || campaign.watchers?.includes(currentUser.uid)) return;
    if (activeWatchData) stopCurrentWatch();
    let elapsed = campaign.watcherWatchTime?.[currentUser.uid] || 0;
    const target = campaign.targetWatchTime;
    if (elapsed >= target) return;
    const updateUI = () => {
        if (document.getElementById('current_timer')) document.getElementById('current_timer').textContent = `${Math.max(0, target - elapsed)}`;
        if (document.getElementById('current_earnings')) document.getElementById('current_earnings').textContent = `${(elapsed * EARNINGS_RATE).toFixed(2)}`;
        if (document.getElementById('current_progress')) document.getElementById('current_progress').style.width = `${(elapsed / target) * 100}%`;
    };
    updateUI();
    if (window.YT?.Player) youtubePlayer = initYouTubePlayer(campaign.videoId, campaign);
    else window.onYouTubeIframeAPIReady = () => { youtubePlayer = initYouTubePlayer(campaign.videoId, campaign); };
    if (watchInterval) clearInterval(watchInterval);
    watchInterval = setInterval(async () => {
        if (activeWatchData && (!isTabVisible || activeWatchData.isPaused || currentPage !== 'home')) return;
        if (elapsed < target) {
            elapsed++;
            if (activeWatchData) activeWatchData.elapsed = elapsed;
            updateUI();
        } else if (elapsed >= target && !activeWatchData?.completed) {
            clearInterval(watchInterval);
            watchInterval = null;
            if (!activeWatchData?.completed) {
                activeWatchData.completed = true;
                await completeCampaign(campaign);
            }
        }
    }, 1000);
    activeWatchData = { campaignId: campaign.id, elapsed, target, isPaused: false, campaign, completed: false };
}

function nextVideo() {
    stopCurrentWatch();
    const next = getNextCampaign();
    if (next) startAutoWatch(next);
    else renderCurrentPage();
}

function setupRealTimeCampaigns() {
    if (unsubscribeCampaigns) unsubscribeCampaigns();
    if (!currentUser) return;
    unsubscribeCampaigns = onSnapshot(query(collection(db, 'viewswap_campaigns'), orderBy('createdAt', 'desc')), (snapshot) => {
        allCampaigns = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.watchers?.includes(currentUser?.uid)) allCampaigns.push({ ...data, firestoreId: doc.id });
        });
        if (currentPage === 'home' && !activeWatchData && allCampaigns.length) {
            const next = getNextCampaign();
            if (next) startAutoWatch(next);
        }
        renderCurrentPage();
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}

async function renderAdminPanel() {
    const usersSnapshot = await getDocs(collection(db, 'viewswap_users'));
    const users = [];
    usersSnapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));

    const campaignsSnapshot = await getDocs(collection(db, 'viewswap_campaigns'));
    const campaigns = [];
    campaignsSnapshot.forEach(doc => campaigns.push({ id: doc.id, ...doc.data() }));

    const totalCredits = users.reduce((sum, u) => sum + (u.credits || 0), 0);
    const totalEarned = users.reduce((sum, u) => sum + (u.totalEarned || 0), 0);
    const totalReferralEarnings = users.reduce((sum, u) => sum + (u.referralEarnings || 0), 0);
    const defaultReferralEarnings = users.reduce((sum, u) => sum + (u.defaultReferralEarnings || 0), 0);

    const adminHtml = `
        <div class="card">
            <h2>👑 Admin Dashboard</h2>
            <div class="admin-stats-grid">
                <div class="admin-stat-card"><h4>Total Users</h4><div class="stat-number">${users.length}</div></div>
                <div class="admin-stat-card"><h4>Total Credits</h4><div class="stat-number">${totalCredits.toFixed(0)}</div></div>
                <div class="admin-stat-card"><h4>Total Earned</h4><div class="stat-number">${totalEarned.toFixed(2)}</div></div>
                <div class="admin-stat-card"><h4>Referral Earnings</h4><div class="stat-number">${totalReferralEarnings.toFixed(2)}</div></div>
                <div class="admin-stat-card"><h4>Platform Earnings (0.09%)</h4><div class="stat-number">${defaultReferralEarnings.toFixed(4)}</div></div>
                <div class="admin-stat-card"><h4>Earning Rate</h4><div class="stat-number">${EARNINGS_RATE}/sec</div></div>
            </div>
            <button class="btn-danger" id="removeAllReferralsBtn" style="margin-top:12px;">⚠️ Remove ALL Referrals</button>
        </div>
        <div class="card">
            <h2>📢 Manage Campaigns</h2>
            <div class="user-list">
                ${campaigns.map(c => `
                    <div class="user-item">
                        <div class="user-info">
                            <div class="user-email">${escapeHtml(c.title)}</div>
                            <div class="user-stats">Creator: ${escapeHtml(c.creatorEmail || c.creatorName)} | Views: ${c.totalViews || 0} | Target: ${c.targetWatchTime}s | Duration: ${Math.floor(c.videoDuration || 0)}s | Watch Time: ${c.totalWatchTimeSeconds || 0}s</div>
                        </div>
                        <div class="admin-actions">
                            <button class="admin-btn danger" onclick="window.adminDeleteCampaign('${c.id}')">Delete</button>
                        </div>
                    </div>
                `).join('') || '<div class="empty-state">No campaigns</div>'}
            </div>
        </div>
        <div class="card">
            <h2>👥 Manage Users</h2>
            <div class="user-list">
                ${users.map(u => `
                    <div class="user-item">
                        <div class="user-info">
                            <div class="user-email"><strong>${escapeHtml(u.email)}</strong></div>
                            <div class="user-stats">Credits: ${u.credits || 0} | Referrals: ${u.referrals?.length || 0} | Earned: ${(u.totalEarned || 0).toFixed(2)}</div>
                            <div class="user-stats">Referral Earnings (2.5%): ${(u.referralEarnings || 0).toFixed(4)} | Platform Earnings (0.09%): ${(u.defaultReferralEarnings || 0).toFixed(4)}</div>
                            ${u.referredBy ? `<div class="user-stats">Referred by: ${u.referredBy.substring(0, 12)}...</div>` : '<div class="user-stats">No personal referrer (default applied)</div>'}
                        </div>
                        <div class="admin-actions">
                            <input type="number" id="amount_add_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}" placeholder="Amount" class="amount-input">
                            <button class="admin-btn success" onclick="window.adminGiveCredits('${u.email}', document.getElementById('amount_add_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}').value)">+Credits</button>
                            <button class="admin-btn danger" onclick="window.adminRemoveCredits('${u.email}', document.getElementById('amount_add_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}').value)">-Credits</button>
                            <button class="admin-btn warning" onclick="window.adminRemoveReferral('${u.email}')">Remove Referral</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.getElementById('pageContent').innerHTML = adminHtml;
    document.getElementById('removeAllReferralsBtn')?.addEventListener('click', () => adminRemoveAllReferrals());
}

async function renderCurrentPage() {
    const container = document.getElementById('pageContent');
    
    if (currentPage === 'home') {
        container.innerHTML = `<div class="card"><h2>🎬 Now Playing</h2>${activeWatchData?.campaign ? `<div class="campaign-item"><div class="video-container" id="current_player"></div><div class="watch-stats"><div class="stat-badge"><div class="stat-badge-label">EARNING</div><div class="stat-badge-value" id="current_earnings">0</div></div><div class="stat-badge"><div class="stat-badge-label">TIME LEFT</div><div class="stat-badge-value timer-value" id="current_timer">0</div></div></div><div class="progress-area"><div class="progress-bar-container"><div class="progress-fill" id="current_progress"></div></div></div><div class="action-buttons-area"><button class="action-btn btn-next" onclick="window.nextVideo()">⏭️ NEXT</button><button class="action-btn btn-autoplay ${autoplayEnabled ? 'active' : ''}" onclick="window.toggleAutoplay()">🔄 AUTO ${autoplayEnabled ? 'ON' : 'OFF'}</button></div></div>` : '<div class="empty-state">✨ No campaigns available. Create one to start earning!</div>'}</div>`;
        // Re-initialize player if needed
        if (activeWatchData?.campaign && !youtubePlayer) {
            startAutoWatch(activeWatchData.campaign);
        }
    } else if (currentPage === 'campaign') {
        const userCampaigns = allCampaigns.filter(c => c.creatorId === currentUser?.uid);
        container.innerHTML = `<div style="display: flex; justify-content: flex-end; margin-bottom: 12px;"><button class="btn-primary" id="createCampaignBtn" style="width: auto; padding: 10px 20px;">+ Create Campaign (${CREATE_CAMPAIGN_COST} credits)</button></div>${userCampaigns.map(c => `<div class="campaign-item"><div style="padding:16px;"><div><strong>${escapeHtml(c.title)}</strong></div><div>Views: ${c.totalViews || 0}/${c.targetWatchTime || 30}</div><div>Video Duration: ${Math.floor(c.videoDuration || 0)}s | Target: ${c.targetWatchTime}s</div><div>Total Watch Time: ${((c.totalWatchTimeSeconds || 0))}s</div><div>Earned Per View: ${(c.targetWatchTime * EARNINGS_RATE).toFixed(2)} credits</div><button class="small-btn btn-danger" onclick="window.deleteCampaign('${c.id}')">Delete</button></div></div>`).join('') || '<div class="empty-state">No campaigns yet. Click + to create!</div>'}`;
        document.getElementById('createCampaignBtn')?.addEventListener('click', () => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal-content"><h3>Create Campaign</h3><p style="font-size:0.8rem;margin-bottom:12px;">💰 You earn ${CREATE_CAMPAIGN_COST} credits back after ${(CREATE_CAMPAIGN_COST / EARNINGS_RATE).toFixed(0)} seconds of watch time!</p><p style="font-size:0.8rem;margin-bottom:12px;">⚠️ Video duration must be longer than target watch time!</p><input id="newTitle" placeholder="Title"><input id="newUrl" placeholder="YouTube URL"><input id="newTarget" type="number" placeholder="Target seconds (auto-adjusted to video length)" value="30"><button class="btn-primary" id="confirmCreateBtn">Create (${CREATE_CAMPAIGN_COST} credits)</button><button class="btn-secondary" id="cancelModal">Cancel</button></div>`;
            document.body.appendChild(modal);
            document.getElementById('confirmCreateBtn')?.addEventListener('click', async () => {
                await validateAndCreateCampaign({ title: document.getElementById('newTitle').value, url: document.getElementById('newUrl').value, targetWatchTime: document.getElementById('newTarget').value });
                modal.remove();
                renderCurrentPage();
            });
            document.getElementById('cancelModal')?.addEventListener('click', () => modal.remove());
        });
    } else if (currentPage === 'rewards') {
        container.innerHTML = `<div class="card"><h2>🏆 Stats</h2><div class="stat-row"><span>💰 Balance:</span><span>${Math.floor(userData?.credits || 0)}</span></div><div class="stat-row"><span>👀 Videos Watched:</span><span>${userData?.watchedVideos?.length || 0}</span></div><div class="stat-row"><span>💎 Your Referral Earnings (2.5%):</span><span>${(userData?.referralEarnings || 0).toFixed(4)}</span></div><div class="stat-row"><span>💎 Platform Earnings (0.09% to owner):</span><span>${(userData?.defaultReferralEarnings || 0).toFixed(4)}</span></div><div class="stat-row"><span>💎 Total Earned:</span><span>${((userData?.totalEarned || 0) + (userData?.referralEarnings || 0)).toFixed(2)}</span></div><div class="stat-row"><span>🔥 Streak:</span><span>${userData?.streak?.current || 0} days</span></div><div class="stat-row"><span>⚡ Earning Rate:</span><span>${EARNINGS_RATE} credits/sec</span></div></div>`;
    } else if (currentPage === 'account') {
        container.innerHTML = `<div class="card"><div style="text-align:center;"><img src="${userData?.photoURL}" style="width:80px;border-radius:50%;border:2px solid #f5576c;"><div>${escapeHtml(userData?.displayName || currentUser?.email)}</div><div style="font-size:0.7rem;opacity:0.7;">${currentUser?.email}</div></div></div><div class="card"><h2>📈 Performance (24h)</h2><div class="graph-container"><canvas id="performanceChart"></canvas></div></div><div class="card"><div class="referral-code-box" id="refCodeBox">${userData?.referralCode}</div><button class="btn-primary" id="copyCodeBtn">Copy Code</button></div><button class="btn-secondary" id="signOutBtn">Sign Out</button>`;
        setTimeout(() => {
            const canvas = document.getElementById('performanceChart');
            if (canvas && performanceChart) performanceChart.destroy();
            if (canvas && userData) {
                const hourlyData = new Array(24).fill(0);
                (userData.earningsHistory || []).forEach(entry => {
                    if (Date.now() - entry.timestamp <= 86400000) hourlyData[new Date(entry.timestamp).getHours()] += entry.amount;
                });
                performanceChart = new Chart(canvas, {
                    type: 'line', data: { labels: Array.from({ length: 24 }, (_, i) => `${i}:00`), datasets: [{ label: 'Earnings/hour', data: hourlyData, borderColor: '#f5576c', backgroundColor: 'rgba(245,87,108,0.1)', fill: true, tension: 0.3 }] },
                    options: { responsive: true, plugins: { legend: { labels: { color: 'white' } } } }
                });
            }
        }, 100);
        document.getElementById('copyCodeBtn')?.addEventListener('click', () => { navigator.clipboard.writeText(userData?.referralCode); showToast('Copied!'); });
        document.getElementById('signOutBtn')?.addEventListener('click', async () => await signOut(auth));
        document.getElementById('refCodeBox')?.addEventListener('click', () => { navigator.clipboard.writeText(userData?.referralCode); showToast('Code copied!'); });
    } else if (currentPage === 'refer') {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=VIEWSWAP_REF:${userData?.referralCode}`;
        container.innerHTML = `<div class="card"><h2>🤝 Referral Program</h2><p><strong>Default referral code for all users: ${DEFAULT_REFERRAL_CODE}</strong> (0.09% of your earnings goes to platform owner)</p><p>You earn 2.5% of your personal referrals' earnings.</p><div class="qr-display-img"><img src="${qrUrl}" width="150"></div><div class="referral-code-box">${userData?.referralCode}</div><div class="share-buttons"><div class="share-btn" id="copyShareLink">🔗 Copy Link</div><div class="share-btn" id="shareAppBtn">📱 Share</div></div><button class="btn-secondary" id="scanQrBtn">Scan QR</button><input type="text" id="enterReferralCode" placeholder="Friend's referral code"><button class="btn-primary" id="applyFriendCodeBtn">Apply Code</button></div>`;
        document.getElementById('copyShareLink')?.addEventListener('click', () => { navigator.clipboard.writeText(`${BASE_URL}?ref=${userData?.referralCode}`); showToast('Link copied!'); });
        document.getElementById('shareAppBtn')?.addEventListener('click', () => { if (navigator.share) navigator.share({ title: 'ViewSwap', text: `Join me on ViewSwap! Code: ${userData?.referralCode}`, url: `${BASE_URL}?ref=${userData?.referralCode}` }); else showToast('Share not supported', true); });
        document.getElementById('scanQrBtn')?.addEventListener('click', () => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div style="background:white;padding:20px;border-radius:24px;"><div id="qr-reader" style="width:100%;"></div><button class="btn-secondary" onclick="this.parentElement.parentElement.remove()">Close</button></div>`;
            document.body.appendChild(modal);
            const scanner = new Html5Qrcode("qr-reader");
            scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => { scanner.stop(); modal.remove(); if (text.startsWith('VIEWSWAP_REF:')) processQRReferral(text.split(':')[1]); else showToast('Invalid QR', true); }, () => { });
        });
        document.getElementById('applyFriendCodeBtn')?.addEventListener('click', async () => { const code = document.getElementById('enterReferralCode')?.value; if (code && !userData.referredBy) await processQRReferral(code); else showToast('Already referred or invalid', true); });
    } else if (currentPage === 'admin' && isAdmin) {
        await renderAdminPanel();
    }
}

window.nextVideo = nextVideo;
window.toggleAutoplay = () => { autoplayEnabled = !autoplayEnabled; renderCurrentPage(); };
window.deleteCampaign = deleteCampaign;
window.adminDeleteCampaign = adminDeleteCampaign;
window.adminGiveCredits = adminGiveCredits;
window.adminRemoveCredits = adminRemoveCredits;
window.adminRemoveReferral = adminRemoveReferral;

document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => {
    if (currentPage !== btn.dataset.page) {
        pauseCurrentVideo();
        // Don't stop the watch completely - just pause it
        // The video will resume when returning to home
    }
    currentPage = btn.dataset.page;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCurrentPage();
}));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData(user.uid);
        
        isAdmin = user.email === DEFAULT_REFERRAL_EMAIL;
        const adminNavBtn = document.querySelector('.nav-item[data-page="admin"]');
        if (adminNavBtn) adminNavBtn.style.display = isAdmin ? 'flex' : 'none';
        
        document.body.classList.add('authenticated');
        setupRealTimeCampaigns();
        await autoDeleteInvalidCampaigns();
        renderCurrentPage();
        
        if (Notification.permission === 'default') Notification.requestPermission();
    } else {
        document.body.classList.remove('authenticated');
        if (unsubscribeCampaigns) unsubscribeCampaigns();
        if (unsubscribeReferralEarnings) unsubscribeReferralEarnings();
        if (activeWatchData) stopCurrentWatch();
        currentUser = null;
        isAdmin = false;
    }
});

document.getElementById('signInBtn')?.addEventListener('click', async () => { try { await signInWithPopup(auth, provider); showToast('Welcome!'); } catch (e) { showToast(e.message, true); } });
document.getElementById('showEmailAuthBtn')?.addEventListener('click', () => { document.getElementById('emailAuthPanel').style.display = 'block'; document.getElementById('showEmailAuthBtn').style.display = 'none'; });
document.getElementById('backToGoogleBtn')?.addEventListener('click', () => { document.getElementById('emailAuthPanel').style.display = 'none'; document.getElementById('showEmailAuthBtn').style.display = 'flex'; });
document.getElementById('emailSignInBtn')?.addEventListener('click', async () => { try { await signInWithEmailAndPassword(auth, document.getElementById('emailInput').value, document.getElementById('passwordInput').value); showToast('Signed in!'); } catch (e) { document.getElementById('authErrorMsg').innerText = e.message; } });
document.getElementById('emailSignUpBtn')?.addEventListener('click', async () => { try { await createUserWithEmailAndPassword(auth, document.getElementById('emailInput').value, document.getElementById('passwordInput').value); showToast('Account created!'); } catch (e) { document.getElementById('authErrorMsg').innerText = e.message; } });
document.getElementById('applyReferralBtn')?.addEventListener('click', async () => { const code = document.getElementById('referralCodeInput')?.value; if (code && !userData?.referredBy && currentUser) await processQRReferral(code); else if (!currentUser) showToast('Sign in first', true); });
document.getElementById('qrSignInBtn')?.addEventListener('click', () => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div style="background:white;padding:20px;border-radius:24px;"><div id="qr-signin-reader" style="width:100%;"></div><button class="btn-secondary" onclick="this.parentElement.parentElement.remove()">Close</button></div>`;
    document.body.appendChild(modal);
    const scanner = new Html5Qrcode("qr-signin-reader");
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => { scanner.stop(); modal.remove(); if (!currentUser) { sessionStorage.setItem('pendingReferral', text); signInWithPopup(auth, provider); } else if (text.startsWith('VIEWSWAP_REF:')) processQRReferral(text.split(':')[1]); else showToast('Invalid QR', true); }, () => { });
});
const pending = sessionStorage.getItem('pendingReferral');
if (pending) setTimeout(async () => { if (currentUser && !userData?.referredBy) await processQRReferral(pending); sessionStorage.removeItem('pendingReferral'); }, 2000);
