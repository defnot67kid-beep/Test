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
let VIEWER_EARNING_RATE = 0.5;
let CAMPAIGN_COST_PER_SECOND = 0.19;
const BASE_URL = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');

// Algorithm Settings
let algorithmSettings = {
    popularityWeight: 0.4,
    newCampaignBoost: 0.3,
    viralThreshold: 100,
    maxCampaignAgeDays: 30
};

let userNotificationSettings = {
    enabled: true,
    achievements: true,
    referralEarnings: true,
    dailyBonus: true,
    campaignAlerts: true
};

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
let videoFullyLoaded = false;
let currentVideoId = null;

// Hidden Admin Logs
let adminLogs = [];
let showLogs = false;
let logPanel = null;

// Secret key combo (Ctrl+Shift+L)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        toggleAdminLogs();
    }
});

function toggleAdminLogs() {
    showLogs = !showLogs;
    if (showLogs) {
        if (!logPanel) {
            logPanel = document.createElement('div');
            logPanel.id = 'adminLogPanel';
            document.body.appendChild(logPanel);
        }
        refreshLogPanel();
        logPanel.style.display = 'block';
    } else if (logPanel) {
        logPanel.style.display = 'none';
    }
}

function addAdminLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    adminLogs.unshift({ timestamp, message, type });
    if (adminLogs.length > 100) adminLogs.pop();
    console.log(`[${timestamp}] ${message}`);
    if (showLogs && logPanel) refreshLogPanel();
}

function refreshLogPanel() {
    if (!logPanel) return;
    logPanel.innerHTML = `<div style="border-bottom:1px solid #0f0; margin-bottom:5px; padding-bottom:3px;">
        <strong>📋 Admin Logs (Ctrl+Shift+L to hide)</strong>
        <button id="clearLogsBtn" style="float:right; background:#333; color:#0f0; border:none; border-radius:3px; cursor:pointer;">Clear</button>
    </div>`;
    adminLogs.forEach(log => {
        const color = log.type === 'error' ? '#f00' : (log.type === 'success' ? '#0f0' : '#ff0');
        logPanel.innerHTML += `<div style="color:${color}; border-bottom:1px solid #333; padding:3px 0;">
            <span style="color:#888;">[${log.timestamp}]</span> ${log.message}
        </div>`;
    });
    const clearBtn = document.getElementById('clearLogsBtn');
    if (clearBtn) clearBtn.onclick = () => { adminLogs = []; refreshLogPanel(); };
}

// ============ ACHIEVEMENTS ============
const ACHIEVEMENTS = [
    { id: "first_video", name: "🎬 First Step", description: "Watch your first video", requirement: { type: "watched", count: 1 }, reward: 10 },
    { id: "video_enthusiast", name: "📺 Video Enthusiast", description: "Watch 10 videos", requirement: { type: "watched", count: 10 }, reward: 50 },
    { id: "video_master", name: "🏆 Video Master", description: "Watch 50 videos", requirement: { type: "watched", count: 50 }, reward: 200 },
    { id: "video_legend", name: "👑 Video Legend", description: "Watch 100 videos", requirement: { type: "watched", count: 100 }, reward: 500 },
    { id: "video_god", name: "⭐ Video God", description: "Watch 500 videos", requirement: { type: "watched", count: 500 }, reward: 2000 },
    { id: "first_campaign", name: "📢 First Campaign", description: "Create your first campaign", requirement: { type: "created", count: 1 }, reward: 25 },
    { id: "campaign_creator", name: "🎯 Campaign Creator", description: "Create 5 campaigns", requirement: { type: "created", count: 5 }, reward: 100 },
    { id: "campaign_master", name: "🏭 Campaign Master", description: "Create 20 campaigns", requirement: { type: "created", count: 20 }, reward: 400 },
    { id: "campaign_tycoon", name: "💰 Campaign Tycoon", description: "Create 50 campaigns", requirement: { type: "created", count: 50 }, reward: 1000 },
    { id: "first_credit", name: "💎 First Credit", description: "Earn your first 100 credits", requirement: { type: "earned", count: 100 }, reward: 10 },
    { id: "credit_collector", name: "🪙 Credit Collector", description: "Earn 1000 credits", requirement: { type: "earned", count: 1000 }, reward: 100 },
    { id: "credit_millionaire", name: "💵 Credit Millionaire", description: "Earn 5000 credits", requirement: { type: "earned", count: 5000 }, reward: 500 },
    { id: "credit_billionaire", name: "💎 Credit Billionaire", description: "Earn 25000 credits", requirement: { type: "earned", count: 25000 }, reward: 2000 },
    { id: "first_referral", name: "🤝 First Referral", description: "Get your first referral", requirement: { type: "referrals", count: 1 }, reward: 50 },
    { id: "referral_star", name: "⭐ Referral Star", description: "Get 5 referrals", requirement: { type: "referrals", count: 5 }, reward: 250 },
    { id: "referral_king", name: "👑 Referral King", description: "Get 20 referrals", requirement: { type: "referrals", count: 20 }, reward: 1000 },
    { id: "referral_god", name: "🏆 Referral God", description: "Get 50 referrals", requirement: { type: "referrals", count: 50 }, reward: 5000 },
    { id: "streak_3", name: "🔥 Hot Streak", description: "3 day login streak", requirement: { type: "streak", count: 3 }, reward: 30 },
    { id: "streak_7", name: "⚡ Power Streak", description: "7 day login streak", requirement: { type: "streak", count: 7 }, reward: 100 },
    { id: "streak_30", name: "🌟 Legendary Streak", description: "30 day login streak", requirement: { type: "streak", count: 30 }, reward: 500 },
    { id: "streak_100", name: "💪 Unstoppable", description: "100 day login streak", requirement: { type: "streak", count: 100 }, reward: 2000 },
    { id: "campaign_views_10", name: "👁️ Getting Views", description: "Get 10 total views on your campaigns", requirement: { type: "campaign_views", count: 10 }, reward: 50 },
    { id: "campaign_views_100", name: "🌟 Popular Creator", description: "Get 100 total views on your campaigns", requirement: { type: "campaign_views", count: 100 }, reward: 200 },
    { id: "campaign_views_1000", name: "🎥 Viral Sensation", description: "Get 1000 total views on your campaigns", requirement: { type: "campaign_views", count: 1000 }, reward: 1000 },
    { id: "watch_time_1h", name: "⏰ Time Well Spent", description: "Watch 1 hour total", requirement: { type: "watch_time", count: 3600 }, reward: 50 },
    { id: "watch_time_10h", name: "📺 Dedicated Viewer", description: "Watch 10 hours total", requirement: { type: "watch_time", count: 36000 }, reward: 200 },
    { id: "watch_time_100h", name: "🎮 No-Life Achievement", description: "Watch 100 hours total", requirement: { type: "watch_time", count: 360000 }, reward: 1000 },
    { id: "credit_spender_100", name: "💸 First Spender", description: "Spend 100 credits on campaigns", requirement: { type: "spent", count: 100 }, reward: 20 },
    { id: "credit_spender_1000", name: "🏦 Investor", description: "Spend 1000 credits on campaigns", requirement: { type: "spent", count: 1000 }, reward: 150 },
    { id: "credit_spender_10000", name: "💼 Tycoon Investor", description: "Spend 10000 credits on campaigns", requirement: { type: "spent", count: 10000 }, reward: 1000 }
];

function showToast(msg, isErr = false) {
    const t = document.createElement('div');
    t.className = 'toast';
    if (isErr) t.style.background = 'rgba(239,68,68,0.9)';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
    addAdminLog(`Toast: ${msg}`, isErr ? 'error' : 'info');
}

function showNotification(title, body, type = 'info') {
    if (!userNotificationSettings.enabled) return;
    if (Notification.permission === 'granted') {
        new Notification(title, { body });
    }
}

// Tab visibility - ONLY PAUSE/RESUME, NEVER DESTROY
document.addEventListener('visibilitychange', () => {
    isTabVisible = !document.hidden;
    if (activeWatchData && youtubePlayer) {
        if (!isTabVisible) {
            youtubePlayer.pauseVideo();
            activeWatchData.isPaused = true;
        } else if (isTabVisible && activeWatchData.isPaused && !activeWatchData.completed) {
            youtubePlayer.playVideo();
            activeWatchData.isPaused = false;
        }
    }
});

function pauseCurrentVideo() {
    if (youtubePlayer && youtubePlayer.pauseVideo) youtubePlayer.pauseVideo();
    if (activeWatchData) activeWatchData.isPaused = true;
}

function stopCurrentWatch(keepPlayer = false) {
    if (watchInterval) clearInterval(watchInterval);
    watchInterval = null;
    videoFullyLoaded = false;
    if (!keepPlayer && youtubePlayer && youtubePlayer.destroy) {
        youtubePlayer.destroy();
        youtubePlayer = null;
        currentVideoId = null;
    }
    if (!keepPlayer) activeWatchData = null;
}

async function getDefaultReferrerId() {
    if (defaultReferrerIdCache) return defaultReferrerIdCache;
    try {
        const q = query(collection(db, 'viewswap_users'), where('email', '==', DEFAULT_REFERRAL_EMAIL));
        const snap = await getDocs(q);
        if (!snap.empty) {
            defaultReferrerIdCache = snap.docs[0].id;
            return defaultReferrerIdCache;
        }
        return null;
    } catch (e) { return null; }
}

async function ensureDefaultReferral(userId, userEmail) {
    const defaultReferrerId = await getDefaultReferrerId();
    if (!defaultReferrerId || defaultReferrerId === userId) return;
    const userRef = doc(db, 'viewswap_users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && !userSnap.data().referredBy) {
        await updateDoc(userRef, { referredBy: defaultReferrerId });
        await updateDoc(doc(db, 'viewswap_users', defaultReferrerId), { referrals: arrayUnion(userId) });
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
        userData.achievements = userData.achievements || [];
        userData.campaignsCreated = userData.campaignsCreated || 0;
        userData.totalCampaignViews = userData.totalCampaignViews || 0;
        userData.totalSpent = userData.totalSpent || 0;
        userData.notificationSettings = userData.notificationSettings || { ...userNotificationSettings };
        userNotificationSettings = userData.notificationSettings;
    } else {
        userData = {
            uid, email: currentUser.email, displayName: currentUser.displayName || currentUser.email,
            photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?background=f5576c&color=fff&name=${encodeURIComponent(currentUser.email)}`,
            credits: 100, referralCode: 'REF' + uid.substring(0, 8).toUpperCase(),
            referredBy: null, referralEarnings: 0, defaultReferralEarnings: 0,
            totalEarned: 0, watchedVideos: [], campaigns: [],
            streak: { current: 0, lastClaim: null, highest: 0 }, totalWatchTime: 0,
            likedCampaigns: [], subscribedChannels: [], recentlyWatched: [],
            totalEarnedByReferralShare: 0, totalEarnedByDefaultReferralShare: 0,
            earningsHistory: [], createdAt: new Date().toISOString(),
            achievements: [], campaignsCreated: 0, totalCampaignViews: 0, totalSpent: 0,
            notificationSettings: { ...userNotificationSettings }
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
        userData.notificationSettings = userNotificationSettings;
        await setDoc(doc(db, 'viewswap_users', currentUser.uid), userData, { merge: true });
    }
}

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
    } catch (e) { console.error("Referral error:", e); }
}

async function updateCredits(amount) {
    userData.credits += amount;
    if (amount > 0) {
        userData.totalEarned += amount;
        userData.earningsHistory.push({ timestamp: Date.now(), amount: amount });
        if (userData.earningsHistory.length > 48) userData.earningsHistory.shift();
        await saveUserData();
        await addAllReferralEarnings(currentUser.uid, amount);
        await checkAchievements();
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
    if (newStreak > (userData.streak?.highest || 0)) userData.streak.highest = newStreak;
    userData.streak.current = newStreak;
    userData.streak.lastClaim = today.toISOString();
    await saveUserData();
    await checkAchievements();
    showNotification('Daily Bonus', `+${bonusAmount} credits! ${newStreak} day streak!`, 'daily');
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
            await checkAchievements();
            if (currentPage === 'rewards') renderCurrentPage();
        }
    });
}

function extractVideoId(url) {
    const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/);
    return match ? match[1] : null;
}

async function getRealVideoDuration(videoId) {
    return new Promise((resolve, reject) => {
        let resolved = false;
        const timeout = setTimeout(() => {
            if (!resolved) reject(new Error("YouTube API timeout"));
        }, 10000);
        const checkAPI = () => {
            if (window.YT && window.YT.Player) {
                const tempDiv = document.createElement('div');
                tempDiv.style.display = 'none';
                document.body.appendChild(tempDiv);
                try {
                    const tempPlayer = new window.YT.Player(tempDiv, {
                        videoId: videoId,
                        events: {
                            onReady: (event) => {
                                const duration = event.target.getDuration();
                                tempPlayer.destroy();
                                tempDiv.remove();
                                if (!resolved) {
                                    resolved = true;
                                    clearTimeout(timeout);
                                    if (duration && duration > 0) resolve(duration);
                                    else reject(new Error("Invalid duration"));
                                }
                            },
                            onError: () => {
                                tempPlayer.destroy();
                                tempDiv.remove();
                                if (!resolved) reject(new Error("YouTube API error"));
                            }
                        }
                    });
                } catch(e) {
                    tempDiv.remove();
                    reject(new Error("Player init failed"));
                }
            } else {
                setTimeout(checkAPI, 200);
            }
        };
        checkAPI();
    });
}

async function validateAndCreateCampaign(campaignData, isAdminAction = false, targetUserId = null) {
    const targetTime = parseInt(campaignData.targetWatchTime) || 30;
    const totalCost = targetTime * CAMPAIGN_COST_PER_SECOND;
    if (!isAdminAction && userData.credits < totalCost) {
        showToast(`Need ${totalCost.toFixed(2)} credits`, true);
        return false;
    }
    const videoId = extractVideoId(campaignData.url);
    if (!videoId) {
        showToast('Invalid YouTube URL', true);
        return false;
    }
    let duration;
    try {
        duration = await getRealVideoDuration(videoId);
    } catch (error) {
        showToast(`Failed to get video duration`, true);
        return false;
    }
    if (duration < targetTime) {
        showToast(`Video is ${Math.floor(duration)}s long, target is ${targetTime}s`, true);
        return false;
    }
    if (!isAdminAction) {
        await updateCredits(-totalCost);
        await trackSpending(totalCost);
        await trackCampaignCreation();
    }
    const campaignId = Date.now().toString();
    const campaign = {
        id: campaignId, title: campaignData.title, url: campaignData.url, videoId,
        creatorId: isAdminAction && targetUserId ? targetUserId : currentUser.uid,
        creatorName: userData.displayName, creatorEmail: currentUser.email,
        createdAt: new Date().toISOString(), targetWatchTime: targetTime, videoDuration: duration,
        totalWatchTimeSeconds: 0, watchers: [], watcherWatchTime: {},
        isActive: true, totalViews: 0, campaignCost: totalCost, createdByAdmin: isAdminAction || false
    };
    await setDoc(doc(db, 'viewswap_campaigns', campaignId), campaign);
    showToast(`✅ Campaign created! Duration: ${Math.floor(duration)}s, Target: ${targetTime}s`);
    return true;
}

async function deleteCampaign(campaignId) {
    const campaignRef = doc(db, 'viewswap_campaigns', campaignId);
    const campaignSnap = await getDoc(campaignRef);
    if (campaignSnap.exists()) {
        const campaign = campaignSnap.data();
        const usedWatchTime = campaign.totalWatchTimeSeconds || 0;
        const remainingTime = Math.max(0, campaign.targetWatchTime - usedWatchTime);
        const refundAmount = remainingTime * CAMPAIGN_COST_PER_SECOND;
        if (refundAmount > 0) {
            await updateDoc(doc(db, 'viewswap_users', campaign.creatorId), { credits: increment(refundAmount) });
        }
    }
    await deleteDoc(campaignRef);
}

async function autoDeleteInvalidCampaigns() {
    const campaignsSnapshot = await getDocs(collection(db, 'viewswap_campaigns'));
    let deletedCount = 0;
    for (const campaignDoc of campaignsSnapshot.docs) {
        const campaign = campaignDoc.data();
        if (campaign.videoDuration && campaign.targetWatchTime > campaign.videoDuration) {
            const refundAmount = campaign.campaignCost || (campaign.targetWatchTime * CAMPAIGN_COST_PER_SECOND);
            await updateDoc(doc(db, 'viewswap_users', campaign.creatorId), { credits: increment(refundAmount) });
            await deleteDoc(campaignDoc.ref);
            deletedCount++;
        }
    }
    return deletedCount;
}

// ============ ADMIN FUNCTIONS ============

async function adminDeleteCampaign(campaignId) {
    const campaignRef = doc(db, 'viewswap_campaigns', campaignId);
    const campaignSnap = await getDoc(campaignRef);
    if (campaignSnap.exists()) {
        const refundAmount = campaignSnap.data().campaignCost || (campaignSnap.data().targetWatchTime * CAMPAIGN_COST_PER_SECOND);
        await updateDoc(doc(db, 'viewswap_users', campaignSnap.data().creatorId), { credits: increment(refundAmount) });
    }
    await deleteDoc(campaignRef);
    showToast('Campaign deleted');
    if (currentPage === 'admin') renderAdminPanel();
}

async function adminGiveCredits(userEmail, amount) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
        await updateDoc(doc(db, 'viewswap_users', snap.docs[0].id), { credits: increment(parseFloat(amount)), totalEarned: increment(parseFloat(amount)) });
        showToast(`Added ${amount} credits to ${userEmail}`);
        if (currentPage === 'admin') renderAdminPanel();
    }
}

async function adminSetCredits(userEmail, amount) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const userId = snap.docs[0].id;
        const userSnap = await getDoc(doc(db, 'viewswap_users', userId));
        const diff = parseFloat(amount) - (userSnap.data().credits || 0);
        await updateDoc(doc(db, 'viewswap_users', userId), { credits: parseFloat(amount), totalEarned: increment(diff) });
        showToast(`Set ${userEmail} credits to ${amount}`);
        if (currentPage === 'admin') renderAdminPanel();
    }
}

async function adminRemoveCredits(userEmail, amount) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
        await updateDoc(doc(db, 'viewswap_users', snap.docs[0].id), { credits: increment(-parseFloat(amount)) });
        showToast(`Removed ${amount} credits from ${userEmail}`);
        if (currentPage === 'admin') renderAdminPanel();
    }
}

async function adminRemoveReferral(userEmail) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const userId = snap.docs[0].id;
        const userSnap = await getDoc(doc(db, 'viewswap_users', userId));
        const oldReferrer = userSnap.data().referredBy;
        await updateDoc(doc(db, 'viewswap_users', userId), { referredBy: null });
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

async function adminSetReferral(userEmail, referrerEmail) {
    const userQ = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const userSnap = await getDocs(userQ);
    const referrerQ = query(collection(db, 'viewswap_users'), where('email', '==', referrerEmail));
    const referrerSnap = await getDocs(referrerQ);
    if (userSnap.empty || referrerSnap.empty) {
        showToast('User or referrer not found', true);
        return;
    }
    await updateDoc(doc(db, 'viewswap_users', userSnap.docs[0].id), { referredBy: referrerSnap.docs[0].id });
    await updateDoc(doc(db, 'viewswap_users', referrerSnap.docs[0].id), { referrals: arrayUnion(userSnap.docs[0].id) });
    showToast(`Set ${userEmail} referred by ${referrerEmail}`);
    if (currentPage === 'admin') renderAdminPanel();
}

async function adminRemoveAllReferrals() {
    if (confirm('Remove ALL referrals?')) {
        const usersSnapshot = await getDocs(collection(db, 'viewswap_users'));
        const batch = writeBatch(db);
        usersSnapshot.forEach(docSnap => batch.update(docSnap.ref, { referredBy: null, referrals: [] }));
        await batch.commit();
        showToast('All referrals removed');
        if (currentPage === 'admin') renderAdminPanel();
    }
}

async function adminResetUser(userEmail) {
    if (confirm(`Reset ${userEmail}?`)) {
        const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
            await setDoc(doc(db, 'viewswap_users', snap.docs[0].id), {
                credits: 0, totalEarned: 0, watchedVideos: [], achievements: [],
                campaignsCreated: 0, totalCampaignViews: 0, totalSpent: 0,
                referralEarnings: 0, defaultReferralEarnings: 0,
                streak: { current: 0, lastClaim: null, highest: 0 }, totalWatchTime: 0, earningsHistory: []
            }, { merge: true });
            showToast(`Reset ${userEmail}`);
            if (currentPage === 'admin') renderAdminPanel();
        }
    }
}

async function adminDeleteUser(userEmail) {
    if (confirm(`DELETE ${userEmail}?`)) {
        const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
            await deleteDoc(doc(db, 'viewswap_users', snap.docs[0].id));
            showToast(`Deleted ${userEmail}`);
            if (currentPage === 'admin') renderAdminPanel();
        }
    }
}

async function adminUpdateAlgorithmSettings(settings) {
    algorithmSettings = { ...algorithmSettings, ...settings };
    showToast('Algorithm settings updated');
    setupRealTimeCampaigns();
}

async function adminCreateCampaignForUser(userEmail, campaignData) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (snap.empty) { showToast('User not found', true); return false; }
    const userId = snap.docs[0].id;
    const userSnap = await getDoc(doc(db, 'viewswap_users', userId));
    const originalUserData = userData;
    userData = userSnap.data();
    const result = await validateAndCreateCampaign(campaignData, true, userId);
    userData = originalUserData;
    if (result) showToast(`Campaign created for ${userEmail}`);
    return result;
}

async function adminToggleNotifications(userEmail, enabled) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
        await updateDoc(doc(db, 'viewswap_users', snap.docs[0].id), { 'notificationSettings.enabled': enabled });
        showToast(`${enabled ? 'Enabled' : 'Disabled'} notifications for ${userEmail}`);
        if (currentPage === 'admin') renderAdminPanel();
    }
}

async function adminBroadcastMessage(message) {
    showNotification(`Admin Broadcast`, message);
    showToast(`Broadcast sent`);
}

async function aiFixEverything() {
    showToast("AI Fixer: Running...");
    const deleted = await autoDeleteInvalidCampaigns();
    if (unsubscribeCampaigns) { unsubscribeCampaigns(); setupRealTimeCampaigns(); }
    showToast(`AI Fixer: Deleted ${deleted} invalid campaigns`);
    addAdminLog(`AI Fixer ran, deleted ${deleted} campaigns`, "success");
}

function sortCampaignsByAlgorithm(campaigns) {
    return campaigns.sort((a, b) => {
        let scoreA = (a.totalViews || 0) * algorithmSettings.popularityWeight;
        let scoreB = (b.totalViews || 0) * algorithmSettings.popularityWeight;
        return scoreB - scoreA;
    });
}

async function completeCampaign(campaign) {
    const viewerReward = campaign.targetWatchTime * VIEWER_EARNING_RATE;
    await updateCredits(viewerReward);
    userData.totalWatchTime = (userData.totalWatchTime || 0) + campaign.targetWatchTime;
    const campaignRef = doc(db, 'viewswap_campaigns', campaign.id);
    await updateDoc(campaignRef, {
        totalWatchTimeSeconds: increment(campaign.targetWatchTime), totalViews: increment(1),
        [`watcherWatchTime.${currentUser.uid}`]: campaign.targetWatchTime, watchers: arrayUnion(currentUser.uid)
    });
    if (!userData.watchedVideos.includes(campaign.videoId)) userData.watchedVideos.push(campaign.videoId);
    watchedHistory.unshift(campaign.id);
    if (watchedHistory.length > 10) watchedHistory.pop();
    await saveUserData();
    await checkAchievements();
    if (autoplayEnabled && currentPage === 'home') {
        const next = getNextCampaign();
        if (next) setTimeout(() => startAutoWatch(next), 300);
    }
    renderCurrentPage();
}

function getNextCampaign() {
    const available = allCampaigns.filter(c => c.creatorId !== currentUser?.uid && !watchedHistory.includes(c.id));
    return sortCampaignsByAlgorithm(available)[0] || allCampaigns[0];
}

function initYouTubePlayer(videoId, campaign) {
    const div = document.getElementById('current_player');
    if (!div) return null;
    if (youtubePlayer && currentVideoId === videoId) return youtubePlayer;
    if (youtubePlayer && youtubePlayer.destroy) youtubePlayer.destroy();
    currentVideoId = videoId;
    videoFullyLoaded = false;
    return new window.YT.Player('current_player', {
        videoId, playerVars: { autoplay: 1, controls: 1, rel: 0, modestbranding: 1, playsinline: 1, enablejsapi: 1 },
        events: {
            onReady: (e) => e.target.playVideo(),
            onStateChange: (e) => {
                if (e.data === 1 && !videoFullyLoaded) {
                    videoFullyLoaded = true;
                    if (activeWatchData) activeWatchData.timerStarted = true;
                }
                if (activeWatchData) {
                    if (e.data === 2) activeWatchData.isPaused = true;
                    else if (e.data === 1 && videoFullyLoaded) activeWatchData.isPaused = false;
                    else if (e.data === 0 && activeWatchData && !activeWatchData.completed && videoFullyLoaded) {
                        activeWatchData.completed = true;
                        completeCampaign(campaign);
                    }
                }
            },
            onError: () => nextVideo()
        }
    });
}

async function startAutoWatch(campaign) {
    if (!currentUser || campaign.watchers?.includes(currentUser.uid)) return;
    if (activeWatchData && activeWatchData.campaignId === campaign.id && youtubePlayer) {
        if (activeWatchData.isPaused) { youtubePlayer.playVideo(); activeWatchData.isPaused = false; }
        return;
    }
    if (activeWatchData) stopCurrentWatch(true);
    let elapsed = campaign.watcherWatchTime?.[currentUser.uid] || 0;
    const target = campaign.targetWatchTime;
    if (elapsed >= target) return;
    const updateUI = () => {
        if (document.getElementById('current_timer')) document.getElementById('current_timer').textContent = `${target - elapsed}`;
        if (document.getElementById('current_earnings')) document.getElementById('current_earnings').textContent = `${(elapsed * VIEWER_EARNING_RATE).toFixed(2)}`;
        if (document.getElementById('current_progress')) document.getElementById('current_progress').style.width = `${(elapsed / target) * 100}%`;
    };
    updateUI();
    const initPlayer = () => {
        if (window.YT && window.YT.Player) youtubePlayer = initYouTubePlayer(campaign.videoId, campaign);
        else setTimeout(initPlayer, 100);
    };
    initPlayer();
    if (watchInterval) clearInterval(watchInterval);
    watchInterval = setInterval(async () => {
        if (activeWatchData && (!isTabVisible || activeWatchData.isPaused || currentPage !== 'home' || !videoFullyLoaded || !activeWatchData.timerStarted)) return;
        if (elapsed < target) {
            elapsed++;
            if (activeWatchData) activeWatchData.elapsed = elapsed;
            updateUI();
        } else if (elapsed >= target && !activeWatchData?.completed && videoFullyLoaded) {
            clearInterval(watchInterval);
            watchInterval = null;
            if (!activeWatchData?.completed) {
                activeWatchData.completed = true;
                await completeCampaign(campaign);
            }
        }
    }, 1000);
    activeWatchData = { campaignId: campaign.id, elapsed, target, isPaused: false, campaign, completed: false, timerStarted: false };
}

function nextVideo() {
    if (watchInterval) clearInterval(watchInterval);
    watchInterval = null;
    videoFullyLoaded = false;
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
            if (!data.watchers?.includes(currentUser?.uid) && data.videoDuration && data.targetWatchTime <= data.videoDuration) {
                allCampaigns.push({ ...data, firestoreId: doc.id });
            }
        });
        if (currentPage === 'home' && !activeWatchData && allCampaigns.length) {
            startAutoWatch(getNextCampaign());
        }
        renderCurrentPage();
    });
}

async function trackCampaignCreation() {
    userData.campaignsCreated = (userData.campaignsCreated || 0) + 1;
    await saveUserData();
    await checkAchievements();
}

async function trackSpending(amount) {
    userData.totalSpent = (userData.totalSpent || 0) + amount;
    await saveUserData();
    await checkAchievements();
}

async function checkAchievements() {
    if (!userData) return;
    let newAchievements = [];
    for (const achievement of ACHIEVEMENTS) {
        if (userData.achievements?.includes(achievement.id)) continue;
        let achieved = false;
        switch (achievement.requirement.type) {
            case "watched": achieved = (userData.watchedVideos?.length || 0) >= achievement.requirement.count; break;
            case "created": achieved = (userData.campaignsCreated || 0) >= achievement.requirement.count; break;
            case "earned": achieved = (userData.totalEarned || 0) >= achievement.requirement.count; break;
            case "referrals": achieved = (userData.referrals?.length || 0) >= achievement.requirement.count; break;
            case "streak": achieved = (userData.streak?.highest || 0) >= achievement.requirement.count; break;
            case "campaign_views": achieved = (userData.totalCampaignViews || 0) >= achievement.requirement.count; break;
            case "watch_time": achieved = (userData.totalWatchTime || 0) >= achievement.requirement.count; break;
            case "spent": achieved = (userData.totalSpent || 0) >= achievement.requirement.count; break;
        }
        if (achieved) {
            newAchievements.push(achievement);
            userData.achievements = userData.achievements || [];
            userData.achievements.push(achievement.id);
        }
    }
    if (newAchievements.length > 0) {
        const totalReward = newAchievements.reduce((sum, a) => sum + a.reward, 0);
        await updateCredits(totalReward);
        for (const ach of newAchievements) {
            showNotification(`Achievement Unlocked!`, `${ach.name} (+${ach.reward} credits)`, 'achievement');
        }
        await saveUserData();
        if (currentPage === 'rewards') renderCurrentPage();
    }
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
                <div class="admin-stat-card"><h4>Campaign Cost</h4><div class="stat-number">${CAMPAIGN_COST_PER_SECOND}/sec</div></div>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px;">
                <button class="btn-danger" id="removeAllReferralsBtn">⚠️ Remove ALL Referrals</button>
                <button class="btn-primary" id="broadcastMsgBtn">📢 Broadcast</button>
                <button class="btn-primary" id="aiFixBtn" style="background: linear-gradient(135deg, #8b5cf6, #ec489a);">🤖 AI FIX</button>
            </div>
            <p style="font-size:0.7rem; margin-top:8px;">💡 Press <strong>Ctrl+Shift+L</strong> for admin logs</p>
        </div>
        <div class="card">
            <h2>⚙️ System Controls</h2>
            <div class="algorithm-control"><label>Viewer Earning Rate: <span id="earningRateVal">${VIEWER_EARNING_RATE}</span></label><input type="range" id="earningRate" min="0.1" max="2" step="0.05" value="${VIEWER_EARNING_RATE}"><button class="admin-btn info" id="saveEarningRate">Apply</button></div>
            <div class="algorithm-control"><label>Campaign Cost: <span id="campaignCostVal">${CAMPAIGN_COST_PER_SECOND}</span></label><input type="range" id="campaignCost" min="0.05" max="1" step="0.05" value="${CAMPAIGN_COST_PER_SECOND}"><button class="admin-btn info" id="saveCampaignCost">Apply</button></div>
        </div>
        <div class="card">
            <h2>⚙️ Algorithm Controls</h2>
            <div class="algorithm-control"><label>Popularity Weight: <span id="popularityWeightVal">${algorithmSettings.popularityWeight}</span></label><input type="range" id="popularityWeight" min="0" max="1" step="0.05" value="${algorithmSettings.popularityWeight}"></div>
            <div class="algorithm-control"><label>New Campaign Boost: <span id="newCampaignBoostVal">${algorithmSettings.newCampaignBoost}</span></label><input type="range" id="newCampaignBoost" min="0" max="1" step="0.05" value="${algorithmSettings.newCampaignBoost}"></div>
            <div class="algorithm-control"><label>Viral Threshold: <span id="viralThresholdVal">${algorithmSettings.viralThreshold}</span></label><input type="range" id="viralThreshold" min="10" max="500" step="10" value="${algorithmSettings.viralThreshold}"></div>
            <div class="algorithm-control"><label>Max Campaign Age (days): <span id="maxAgeVal">${algorithmSettings.maxCampaignAgeDays}</span></label><input type="range" id="maxAgeDays" min="1" max="90" step="1" value="${algorithmSettings.maxCampaignAgeDays}"></div>
            <button class="btn-primary" id="saveAlgorithmBtn">Save Algorithm</button>
        </div>
        <div class="card">
            <h2>📢 Create Campaign For User</h2>
            <input type="email" id="targetUserEmail" placeholder="User Email">
            <input type="text" id="campaignTitle" placeholder="Title">
            <input type="text" id="campaignUrl" placeholder="YouTube URL">
            <input type="number" id="campaignTargetTime" placeholder="Target Seconds" value="30">
            <button class="btn-primary" id="createForUserBtn">Create Campaign</button>
        </div>
        <div class="card">
            <h2>📢 Manage Campaigns</h2>
            <div class="user-list">${campaigns.map(c => `<div class="user-item"><div><strong>${escapeHtml(c.title)}</strong></div><div class="user-stats">Creator: ${escapeHtml(c.creatorEmail)} | Views: ${c.totalViews || 0} | Target: ${c.targetWatchTime}s</div><button class="admin-btn danger" onclick="window.adminDeleteCampaign('${c.id}')">Delete</button></div>`).join('') || '<div class="empty-state">No campaigns</div>'}</div>
        </div>
        <div class="card">
            <h2>👥 Manage Users</h2>
            <div class="user-list">${users.map(u => `<div class="user-item"><div><strong>${escapeHtml(u.email)}</strong></div><div class="user-stats">Credits: ${u.credits || 0} | Referrals: ${u.referrals?.length || 0} | Achievements: ${u.achievements?.length || 0}</div><div class="admin-actions"><input type="number" id="amount_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}" placeholder="Amount" class="amount-input"><button class="admin-btn success" onclick="window.adminSetCredits('${u.email}', document.getElementById('amount_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}').value)">Set</button><button class="admin-btn info" onclick="window.adminGiveCredits('${u.email}', document.getElementById('amount_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}').value)">+Add</button><button class="admin-btn danger" onclick="window.adminRemoveCredits('${u.email}', document.getElementById('amount_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}').value)">-Remove</button><button class="admin-btn warning" onclick="window.adminRemoveReferral('${u.email}')">Remove Ref</button><button class="admin-btn danger" onclick="window.adminResetUser('${u.email}')">Reset</button><button class="admin-btn danger" onclick="window.adminDeleteUser('${u.email}')">Delete</button></div><div class="admin-actions"><input type="email" id="referrer_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}" placeholder="Referrer Email" class="amount-input"><button class="admin-btn info" onclick="window.adminSetReferral('${u.email}', document.getElementById('referrer_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}').value)">Set Referrer</button><button class="admin-btn warning" onclick="window.adminToggleNotifications('${u.email}', ${!u.notificationSettings?.enabled})">${u.notificationSettings?.enabled !== false ? 'Disable Notifs' : 'Enable Notifs'}</button></div></div>`).join('')}</div>
        </div>
    `;
    document.getElementById('pageContent').innerHTML = adminHtml;
    
    document.getElementById('popularityWeight')?.addEventListener('input', (e) => document.getElementById('popularityWeightVal').textContent = e.target.value);
    document.getElementById('newCampaignBoost')?.addEventListener('input', (e) => document.getElementById('newCampaignBoostVal').textContent = e.target.value);
    document.getElementById('viralThreshold')?.addEventListener('input', (e) => document.getElementById('viralThresholdVal').textContent = e.target.value);
    document.getElementById('maxAgeDays')?.addEventListener('input', (e) => document.getElementById('maxAgeVal').textContent = e.target.value);
    document.getElementById('earningRate')?.addEventListener('input', (e) => document.getElementById('earningRateVal').textContent = e.target.value);
    document.getElementById('campaignCost')?.addEventListener('input', (e) => document.getElementById('campaignCostVal').textContent = e.target.value);
    document.getElementById('saveAlgorithmBtn')?.addEventListener('click', () => adminUpdateAlgorithmSettings({ popularityWeight: parseFloat(document.getElementById('popularityWeight').value), newCampaignBoost: parseFloat(document.getElementById('newCampaignBoost').value), viralThreshold: parseInt(document.getElementById('viralThreshold').value), maxCampaignAgeDays: parseInt(document.getElementById('maxAgeDays').value) }));
    document.getElementById('saveEarningRate')?.addEventListener('click', () => { VIEWER_EARNING_RATE = parseFloat(document.getElementById('earningRate').value); showToast(`Earning rate: ${VIEWER_EARNING_RATE}/sec`); });
    document.getElementById('saveCampaignCost')?.addEventListener('click', () => { CAMPAIGN_COST_PER_SECOND = parseFloat(document.getElementById('campaignCost').value); showToast(`Campaign cost: ${CAMPAIGN_COST_PER_SECOND}/sec`); });
    document.getElementById('createForUserBtn')?.addEventListener('click', async () => {
        await adminCreateCampaignForUser(document.getElementById('targetUserEmail').value, { title: document.getElementById('campaignTitle').value, url: document.getElementById('campaignUrl').value, targetWatchTime: parseInt(document.getElementById('campaignTargetTime').value) });
        document.getElementById('targetUserEmail').value = ''; document.getElementById('campaignTitle').value = ''; document.getElementById('campaignUrl').value = '';
    });
    document.getElementById('removeAllReferralsBtn')?.addEventListener('click', adminRemoveAllReferrals);
    document.getElementById('broadcastMsgBtn')?.addEventListener('click', () => { const msg = prompt('Message:'); if (msg) adminBroadcastMessage(msg); });
    document.getElementById('aiFixBtn')?.addEventListener('click', aiFixEverything);
}

function renderAchievementsPage() {
    const earned = userData?.achievements || [];
    const earnedCount = earned.length;
    return `
        <div class="card"><h2>🏆 Achievements (${earnedCount}/${ACHIEVEMENTS.length})</h2><div class="stat-row"><span>💰 Total Rewards:</span><span>${ACHIEVEMENTS.reduce((s,a)=>s+a.reward,0)} credits</span></div></div>
        <div class="card"><h2>✅ Earned (${earnedCount})</h2><div class="achievements-grid">${ACHIEVEMENTS.filter(a=>earned.includes(a.id)).map(a=>`<div class="achievement-card earned"><div class="achievement-icon">🏆</div><div><div class="achievement-name">${a.name}</div><div class="achievement-desc">${a.description}</div></div><div class="achievement-reward">+${a.reward}</div></div>`).join('') || '<div class="empty-state">None yet</div>'}</div></div>
        <div class="card"><h2>🔒 Locked (${ACHIEVEMENTS.length - earnedCount})</h2><div class="achievements-grid">${ACHIEVEMENTS.filter(a=>!earned.includes(a.id)).map(a=>`<div class="achievement-card locked"><div class="achievement-icon">🔒</div><div><div class="achievement-name">${a.name}</div><div class="achievement-desc">${a.description}</div></div><div class="achievement-req">Need: ${a.requirement.count} ${a.requirement.type}</div><div class="achievement-reward">+${a.reward}</div></div>`).join('')}</div></div>
    `;
}

async function renderCurrentPage() {
    const container = document.getElementById('pageContent');
    if (currentPage === 'home') {
        container.innerHTML = `<div class="card"><h2>🎬 Now Playing</h2>${activeWatchData?.campaign ? `<div class="campaign-item"><div class="video-container" id="current_player"></div><div class="watch-stats"><div class="stat-badge"><div class="stat-badge-label">YOU EARN</div><div class="stat-badge-value" id="current_earnings">0</div></div><div class="stat-badge"><div class="stat-badge-label">TIME LEFT</div><div class="stat-badge-value timer-value" id="current_timer">0</div></div></div><div class="progress-area"><div class="progress-bar-container"><div class="progress-fill" id="current_progress"></div></div></div><div class="action-buttons-area"><button class="action-btn btn-next" onclick="window.nextVideo()">⏭️ NEXT</button><button class="action-btn btn-autoplay ${autoplayEnabled ? 'active' : ''}" onclick="window.toggleAutoplay()">🔄 AUTO ${autoplayEnabled ? 'ON' : 'OFF'}</button></div></div>` : '<div class="empty-state">✨ No campaigns available</div>'}</div>`;
        if (youtubePlayer && activeWatchData && activeWatchData.isPaused && !activeWatchData.completed && isTabVisible) {
            setTimeout(() => { if (youtubePlayer && activeWatchData.isPaused) { youtubePlayer.playVideo(); activeWatchData.isPaused = false; } }, 100);
        }
    } else if (currentPage === 'campaign') {
        const userCampaigns = allCampaigns.filter(c => c.creatorId === currentUser?.uid);
        container.innerHTML = `<button class="btn-primary" id="createCampaignBtn" style="width:auto; margin-bottom:12px;">+ Create Campaign</button>${userCampaigns.map(c => `<div class="campaign-item"><div style="padding:16px;"><strong>${escapeHtml(c.title)}</strong><div>Views: ${c.totalViews || 0} | Target: ${c.targetWatchTime}s | Duration: ${Math.floor(c.videoDuration || 0)}s</div><button class="small-btn btn-danger" onclick="window.deleteCampaign('${c.id}')">Delete</button></div></div>`).join('') || '<div class="empty-state">No campaigns</div>'}`;
        document.getElementById('createCampaignBtn')?.addEventListener('click', () => {
            const modal = document.createElement('div'); modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal-content"><h3>Create Campaign</h3><p>Cost: ${CAMPAIGN_COST_PER_SECOND}/sec | Your balance: ${userData?.credits || 0}</p><input id="newTitle" placeholder="Title"><input id="newUrl" placeholder="YouTube URL"><input id="newTarget" type="number" placeholder="Target seconds" value="30"><button class="btn-primary" id="confirmCreateBtn">Create</button><button class="btn-secondary" id="cancelModal">Cancel</button></div>`;
            document.body.appendChild(modal);
            document.getElementById('confirmCreateBtn')?.addEventListener('click', async () => {
                await validateAndCreateCampaign({ title: document.getElementById('newTitle').value, url: document.getElementById('newUrl').value, targetWatchTime: document.getElementById('newTarget').value });
                modal.remove(); renderCurrentPage();
            });
            document.getElementById('cancelModal')?.addEventListener('click', () => modal.remove());
        });
    } else if (currentPage === 'rewards') {
        container.innerHTML = renderAchievementsPage();
    } else if (currentPage === 'account') {
        container.innerHTML = `<div class="card"><div style="text-align:center;"><img src="${userData?.photoURL}" style="width:80px;border-radius:50%;"><div>${escapeHtml(userData?.displayName)}</div><div style="font-size:1.2rem;">💰 ${Math.floor(userData?.credits || 0)} credits</div></div></div><div class="card"><h2>🔔 Notifications</h2><div class="stat-row"><span>Enable Notifications</span><label class="toggle-switch"><input type="checkbox" id="notifEnabled" ${userNotificationSettings.enabled !== false ? 'checked' : ''}><span class="toggle-slider"></span></label></div></div><div class="card"><h2>📈 Performance</h2><div class="graph-container"><canvas id="performanceChart"></canvas></div></div><div class="card"><div class="referral-code-box">${userData?.referralCode}</div><button class="btn-primary" id="copyCodeBtn">Copy Code</button></div><button class="btn-secondary" id="signOutBtn">Sign Out</button>`;
        document.getElementById('notifEnabled')?.addEventListener('change', (e) => { userNotificationSettings.enabled = e.target.checked; saveUserData(); });
        document.getElementById('copyCodeBtn')?.addEventListener('click', () => { navigator.clipboard.writeText(userData?.referralCode); showToast('Copied!'); });
        document.getElementById('signOutBtn')?.addEventListener('click', async () => await signOut(auth));
        setTimeout(() => {
            const canvas = document.getElementById('performanceChart');
            if (canvas && performanceChart) performanceChart.destroy();
            if (canvas && userData) {
                const hourlyData = new Array(24).fill(0);
                (userData.earningsHistory || []).forEach(entry => { if (Date.now() - entry.timestamp <= 86400000) hourlyData[new Date(entry.timestamp).getHours()] += entry.amount; });
                performanceChart = new Chart(canvas, { type: 'line', data: { labels: Array.from({length:24},(_,i)=>`${i}:00`), datasets: [{ label: 'Earnings/hour', data: hourlyData, borderColor: '#f5576c', fill: true }] }, options: { responsive: true } });
            }
        }, 100);
    } else if (currentPage === 'refer') {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VIEWSWAP_REF:${userData?.referralCode}`;
        container.innerHTML = `<div class="card"><h2>Referral Program</h2><p>You earn 2.5% of referrals' earnings. Platform gets 0.09%.</p><div class="qr-display-img"><img src="${qrUrl}" width="120"></div><div class="referral-code-box">${userData?.referralCode}</div><div class="share-buttons"><div class="share-btn" id="copyLink">Copy Link</div><div class="share-btn" id="shareBtn">Share</div></div><input id="enterCode" placeholder="Friend's code"><button class="btn-primary" id="applyCodeBtn">Apply Code</button></div>`;
        document.getElementById('copyLink')?.addEventListener('click', () => { navigator.clipboard.writeText(`${BASE_URL}?ref=${userData?.referralCode}`); showToast('Copied!'); });
        document.getElementById('shareBtn')?.addEventListener('click', () => { if (navigator.share) navigator.share({ title: 'ViewSwap', text: `Join me! Code: ${userData?.referralCode}`, url: BASE_URL }); });
        document.getElementById('applyCodeBtn')?.addEventListener('click', async () => { const code = document.getElementById('enterCode')?.value; if (code && !userData.referredBy) await processQRReferral(code); else showToast('Invalid', true); });
    } else if (currentPage === 'admin' && isAdmin) {
        await renderAdminPanel();
    }
}

// Global functions
window.nextVideo = nextVideo;
window.toggleAutoplay = () => { autoplayEnabled = !autoplayEnabled; renderCurrentPage(); };
window.deleteCampaign = deleteCampaign;
window.adminDeleteCampaign = adminDeleteCampaign;
window.adminGiveCredits = adminGiveCredits;
window.adminSetCredits = adminSetCredits;
window.adminRemoveCredits = adminRemoveCredits;
window.adminRemoveReferral = adminRemoveReferral;
window.adminSetReferral = adminSetReferral;
window.adminResetUser = adminResetUser;
window.adminDeleteUser = adminDeleteUser;
window.adminToggleNotifications = adminToggleNotifications;

// Navigation
document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => {
    if (currentPage !== btn.dataset.page) pauseCurrentVideo();
    currentPage = btn.dataset.page;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCurrentPage();
    if (currentPage === 'home' && activeWatchData && activeWatchData.isPaused && !activeWatchData.completed && isTabVisible) {
        setTimeout(() => { if (youtubePlayer && activeWatchData.isPaused) { youtubePlayer.playVideo(); activeWatchData.isPaused = false; } }, 200);
    }
}));

// Auth
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
        addAdminLog(`Logged in: ${user.email}`, "success");
    } else {
        document.body.classList.remove('authenticated');
        if (unsubscribeCampaigns) unsubscribeCampaigns();
        if (unsubscribeReferralEarnings) unsubscribeReferralEarnings();
        if (activeWatchData) stopCurrentWatch();
        currentUser = null; isAdmin = false;
    }
});

document.getElementById('signInBtn')?.addEventListener('click', async () => { try { await signInWithPopup(auth, provider); } catch (e) { showToast(e.message, true); } });
document.getElementById('showEmailAuthBtn')?.addEventListener('click', () => { document.getElementById('emailAuthPanel').style.display = 'block'; document.getElementById('showEmailAuthBtn').style.display = 'none'; });
document.getElementById('backToGoogleBtn')?.addEventListener('click', () => { document.getElementById('emailAuthPanel').style.display = 'none'; document.getElementById('showEmailAuthBtn').style.display = 'flex'; });
document.getElementById('emailSignInBtn')?.addEventListener('click', async () => { try { await signInWithEmailAndPassword(auth, document.getElementById('emailInput').value, document.getElementById('passwordInput').value); showToast('Signed in!'); } catch (e) { document.getElementById('authErrorMsg').innerText = e.message; } });
document.getElementById('emailSignUpBtn')?.addEventListener('click', async () => { try { await createUserWithEmailAndPassword(auth, document.getElementById('emailInput').value, document.getElementById('passwordInput').value); showToast('Account created!'); } catch (e) { document.getElementById('authErrorMsg').innerText = e.message; } });
document.getElementById('applyReferralBtn')?.addEventListener('click', async () => { const code = document.getElementById('referralCodeInput')?.value; if (code && !userData?.referredBy && currentUser) await processQRReferral(code); else if (!currentUser) showToast('Sign in first', true); });
document.getElementById('qrSignInBtn')?.addEventListener('click', () => {
    const modal = document.createElement('div'); modal.className = 'modal-overlay';
    modal.innerHTML = `<div style="background:white;padding:20px;border-radius:24px;"><div id="qr-signin-reader"></div><button class="btn-secondary" onclick="this.parentElement.parentElement.remove()">Close</button></div>`;
    document.body.appendChild(modal);
    const scanner = new Html5Qrcode("qr-signin-reader");
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => { scanner.stop(); modal.remove(); if (!currentUser) { sessionStorage.setItem('pendingReferral', text); signInWithPopup(auth, provider); } else if (text.startsWith('VIEWSWAP_REF:')) processQRReferral(text.split(':')[1]); else showToast('Invalid QR', true); }, () => { });
});
const pending = sessionStorage.getItem('pendingReferral');
if (pending) setTimeout(async () => { if (currentUser && !userData?.referredBy) await processQRReferral(pending); sessionStorage.removeItem('pendingReferral'); }, 2000);
