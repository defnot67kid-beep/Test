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
const VIEWER_EARNING_RATE = 0.5;
const CAMPAIGN_COST_PER_SECOND = 0.19;
const BASE_URL = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');

// ============ ACHIEVEMENTS SYSTEM ============
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
}

// Check and award achievements
async function checkAchievements() {
    if (!userData) return;
    
    let newAchievements = [];
    let totalReward = 0;
    
    for (const achievement of ACHIEVEMENTS) {
        if (userData.achievements && userData.achievements.includes(achievement.id)) continue;
        
        let achieved = false;
        let currentValue = 0;
        
        switch (achievement.requirement.type) {
            case "watched":
                currentValue = userData.watchedVideos?.length || 0;
                achieved = currentValue >= achievement.requirement.count;
                break;
            case "created":
                currentValue = userData.campaignsCreated || 0;
                achieved = currentValue >= achievement.requirement.count;
                break;
            case "earned":
                currentValue = userData.totalEarned || 0;
                achieved = currentValue >= achievement.requirement.count;
                break;
            case "referrals":
                currentValue = userData.referrals?.length || 0;
                achieved = currentValue >= achievement.requirement.count;
                break;
            case "streak":
                currentValue = userData.streak?.highest || 0;
                achieved = currentValue >= achievement.requirement.count;
                break;
            case "campaign_views":
                currentValue = userData.totalCampaignViews || 0;
                achieved = currentValue >= achievement.requirement.count;
                break;
            case "watch_time":
                currentValue = userData.totalWatchTime || 0;
                achieved = currentValue >= achievement.requirement.count;
                break;
            case "spent":
                currentValue = userData.totalSpent || 0;
                achieved = currentValue >= achievement.requirement.count;
                break;
        }
        
        if (achieved) {
            newAchievements.push(achievement);
            totalReward += achievement.reward;
            if (!userData.achievements) userData.achievements = [];
            userData.achievements.push(achievement.id);
        }
    }
    
    if (newAchievements.length > 0) {
        await updateCredits(totalReward);
        for (const ach of newAchievements) {
            showNotification(`🏆 Achievement Unlocked!`, `${ach.name} - ${ach.description} (+${ach.reward} credits)`);
        }
        await saveUserData();
        if (currentPage === 'rewards') renderCurrentPage();
    }
}

// Track campaign creation
async function trackCampaignCreation() {
    userData.campaignsCreated = (userData.campaignsCreated || 0) + 1;
    await saveUserData();
    await checkAchievements();
}

// Track campaign views (for creators)
async function trackCampaignView(campaign) {
    if (campaign.creatorId === currentUser?.uid) return;
    const campaignRef = doc(db, 'viewswap_campaigns', campaign.id);
    const campaignSnap = await getDoc(campaignRef);
    if (campaignSnap.exists()) {
        const views = campaignSnap.data().totalViews || 0;
        const creatorRef = doc(db, 'viewswap_users', campaign.creatorId);
        const creatorSnap = await getDoc(creatorRef);
        if (creatorSnap.exists()) {
            const totalViews = (creatorSnap.data().totalCampaignViews || 0) + 1;
            await updateDoc(creatorRef, { totalCampaignViews: totalViews });
        }
    }
}

// Track spending
async function trackSpending(amount) {
    userData.totalSpent = (userData.totalSpent || 0) + amount;
    await saveUserData();
    await checkAchievements();
}

// Tab visibility
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
    if (youtubePlayer && youtubePlayer.pauseVideo) {
        youtubePlayer.pauseVideo();
    }
    if (activeWatchData) {
        activeWatchData.isPaused = true;
    }
}

function resumeCurrentVideo() {
    if (youtubePlayer && activeWatchData && activeWatchData.isPaused && !activeWatchData.completed && isTabVisible && currentPage === 'home') {
        youtubePlayer.playVideo();
        activeWatchData.isPaused = false;
    }
}

function stopCurrentWatch(keepPlayer = false) {
    if (watchInterval) clearInterval(watchInterval);
    watchInterval = null;
    videoFullyLoaded = false;
    if (!keepPlayer && youtubePlayer && youtubePlayer.destroy) {
        youtubePlayer.destroy();
        youtubePlayer = null;
    }
    if (!keepPlayer) {
        activeWatchData = null;
    }
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
        await checkAchievements();
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
        userData.achievements = userData.achievements || [];
        userData.campaignsCreated = userData.campaignsCreated || 0;
        userData.totalCampaignViews = userData.totalCampaignViews || 0;
        userData.totalSpent = userData.totalSpent || 0;
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
            earningsHistory: [], createdAt: new Date().toISOString(),
            achievements: [], campaignsCreated: 0, totalCampaignViews: 0, totalSpent: 0
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
            if (!resolved) {
                resolved = true;
                reject(new Error("YouTube API timeout - could not get video duration"));
            }
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
                                    if (duration && duration > 0) {
                                        resolve(duration);
                                    } else {
                                        reject(new Error("Invalid video duration"));
                                    }
                                }
                            },
                            onError: (error) => {
                                console.error("YouTube player error:", error);
                                tempPlayer.destroy();
                                tempDiv.remove();
                                if (!resolved) {
                                    resolved = true;
                                    clearTimeout(timeout);
                                    reject(new Error("YouTube API error - video unavailable"));
                                }
                            }
                        }
                    });
                } catch(e) {
                    tempDiv.remove();
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        reject(new Error("Failed to initialize YouTube player"));
                    }
                }
            } else {
                setTimeout(checkAPI, 200);
            }
        };
        checkAPI();
    });
}

async function validateAndCreateCampaign(campaignData) {
    const totalCost = campaignData.targetWatchTime * CAMPAIGN_COST_PER_SECOND;
    if (userData.credits < totalCost) {
        showToast(`Need ${totalCost.toFixed(2)} credits (${campaignData.targetWatchTime}s × ${CAMPAIGN_COST_PER_SECOND}/sec)`, true);
        return false;
    }
    const videoId = extractVideoId(campaignData.url);
    if (!videoId) {
        showToast('Invalid YouTube URL', true);
        return false;
    }
    
    showToast('Getting real video duration from YouTube...');
    let duration;
    try {
        duration = await getRealVideoDuration(videoId);
    } catch (error) {
        console.error("Duration fetch error:", error);
        showToast(`Failed to get video duration: ${error.message}. Please try again.`, true);
        return false;
    }
    
    let targetTime = parseInt(campaignData.targetWatchTime) || 30;
    
    if (duration < targetTime) {
        showToast(`❌ REJECTED: Video is ${Math.floor(duration)}s long, target is ${targetTime}s. Video must be longer than target time!`, true);
        return false;
    }
    
    await updateCredits(-totalCost);
    await trackSpending(totalCost);
    
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
        totalViews: 0,
        campaignCost: totalCost
    };
    await setDoc(doc(db, 'viewswap_campaigns', campaign.id), campaign);
    await trackCampaignCreation();
    showToast(`✅ Campaign created! Real duration: ${Math.floor(duration)}s, Target: ${targetTime}s | Cost: ${totalCost.toFixed(2)} credits`);
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
        let shouldDelete = false;
        let refundAmount = campaign.campaignCost || (campaign.targetWatchTime * CAMPAIGN_COST_PER_SECOND);
        
        if (campaign.videoDuration && campaign.targetWatchTime > campaign.videoDuration) {
            shouldDelete = true;
        } else if (campaign.videoDuration && campaign.totalWatchTimeSeconds > campaign.videoDuration) {
            shouldDelete = true;
        } else if (!campaign.videoDuration || campaign.videoDuration <= 0) {
            shouldDelete = true;
        }
        
        if (shouldDelete) {
            const creatorRef = doc(db, 'viewswap_users', campaign.creatorId);
            const creatorSnap = await getDoc(creatorRef);
            if (creatorSnap.exists()) {
                await updateDoc(creatorRef, { credits: increment(refundAmount) });
            }
            await deleteDoc(campaignDoc.ref);
            deletedCount++;
        }
    }
    
    if (deletedCount > 0 && currentPage === 'home') {
        if (unsubscribeCampaigns) {
            unsubscribeCampaigns();
            setupRealTimeCampaigns();
        }
    }
}

async function adminDeleteCampaign(campaignId) {
    const campaignRef = doc(db, 'viewswap_campaigns', campaignId);
    const campaignSnap = await getDoc(campaignRef);
    if (campaignSnap.exists()) {
        const campaign = campaignSnap.data();
        const refundAmount = campaign.campaignCost || (campaign.targetWatchTime * CAMPAIGN_COST_PER_SECOND);
        await updateDoc(doc(db, 'viewswap_users', campaign.creatorId), { credits: increment(refundAmount) });
    }
    await deleteDoc(campaignRef);
    showToast('Campaign deleted by admin with refund');
    if (currentPage === 'admin') renderAdminPanel();
}

async function adminGiveCredits(userEmail, amount) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const userId = snap.docs[0].id;
        await updateDoc(doc(db, 'viewswap_users', userId), { credits: increment(parseFloat(amount)), totalEarned: increment(parseFloat(amount)) });
        showToast(`Added ${amount} credits to ${userEmail}`);
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
    const viewerReward = campaign.targetWatchTime * VIEWER_EARNING_RATE;
    await updateCredits(viewerReward);
    userData.totalWatchTime = (userData.totalWatchTime || 0) + campaign.targetWatchTime;
    await trackCampaignView(campaign);
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
    await checkAchievements();
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
    
    if (youtubePlayer && youtubePlayer.getVideoData && youtubePlayer.getVideoData().video_id === videoId) {
        return youtubePlayer;
    }
    
    if (youtubePlayer && youtubePlayer.destroy) {
        youtubePlayer.destroy();
        youtubePlayer = null;
    }
    
    videoFullyLoaded = false;
    
    return new window.YT.Player('current_player', {
        videoId, 
        playerVars: { 
            autoplay: 1, 
            controls: 1, 
            rel: 0, 
            modestbranding: 1, 
            playsinline: 1,
            enablejsapi: 1
        },
        events: {
            onReady: (event) => {
                event.target.playVideo();
            },
            onStateChange: (e) => {
                if (e.data === 1 && !videoFullyLoaded) {
                    videoFullyLoaded = true;
                    if (activeWatchData && activeWatchData.startTimerOnLoad) {
                        activeWatchData.timerStarted = true;
                        showToast("Video loaded! Timer started.");
                    }
                }
                if (activeWatchData) {
                    if (e.data === 2) {
                        activeWatchData.isPaused = true;
                    } else if (e.data === 1 && videoFullyLoaded) {
                        activeWatchData.isPaused = false;
                    } else if (e.data === 0 && activeWatchData && !activeWatchData.completed && videoFullyLoaded) {
                        activeWatchData.completed = true;
                        completeCampaign(campaign);
                    }
                }
            },
            onError: (e) => {
                console.error("YouTube error:", e);
                nextVideo();
            }
        }
    });
}

async function startAutoWatch(campaign) {
    if (!currentUser || campaign.watchers?.includes(currentUser.uid)) return;
    
    if (activeWatchData && activeWatchData.campaignId === campaign.id && youtubePlayer) {
        if (activeWatchData.isPaused) {
            youtubePlayer.playVideo();
            activeWatchData.isPaused = false;
        }
        return;
    }
    
    if (activeWatchData) {
        stopCurrentWatch(true);
    }
    
    let elapsed = campaign.watcherWatchTime?.[currentUser.uid] || 0;
    const target = campaign.targetWatchTime;
    if (elapsed >= target) return;
    
    const updateUI = () => {
        if (document.getElementById('current_timer')) document.getElementById('current_timer').textContent = `${Math.max(0, target - elapsed)}`;
        if (document.getElementById('current_earnings')) document.getElementById('current_earnings').textContent = `${(elapsed * VIEWER_EARNING_RATE).toFixed(2)}`;
        if (document.getElementById('current_progress')) document.getElementById('current_progress').style.width = `${(elapsed / target) * 100}%`;
    };
    updateUI();
    
    const initPlayer = () => {
        if (window.YT && window.YT.Player) {
            youtubePlayer = initYouTubePlayer(campaign.videoId, campaign);
        } else {
            setTimeout(initPlayer, 100);
        }
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
    
    activeWatchData = { campaignId: campaign.id, elapsed, target, isPaused: false, campaign, completed: false, startTimerOnLoad: true, timerStarted: false };
}

function nextVideo() {
    if (watchInterval) clearInterval(watchInterval);
    watchInterval = null;
    videoFullyLoaded = false;
    const next = getNextCampaign();
    if (next) {
        startAutoWatch(next);
    } else {
        renderCurrentPage();
    }
}

function setupRealTimeCampaigns() {
    if (unsubscribeCampaigns) unsubscribeCampaigns();
    if (!currentUser) return;
    unsubscribeCampaigns = onSnapshot(query(collection(db, 'viewswap_campaigns'), orderBy('createdAt', 'desc')), (snapshot) => {
        const previousCampaignId = activeWatchData?.campaignId;
        allCampaigns = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.watchers?.includes(currentUser?.uid) && data.videoDuration && data.targetWatchTime <= data.videoDuration) {
                allCampaigns.push({ ...data, firestoreId: doc.id });
            }
        });
        
        if (currentPage === 'home' && previousCampaignId) {
            const existingCampaign = allCampaigns.find(c => c.id === previousCampaignId);
            if (existingCampaign && activeWatchData && !activeWatchData.completed) {
                if (youtubePlayer && activeWatchData.isPaused) {
                    youtubePlayer.playVideo();
                    activeWatchData.isPaused = false;
                }
            } else if (!activeWatchData && allCampaigns.length) {
                const next = getNextCampaign();
                if (next) startAutoWatch(next);
            }
        } else if (currentPage === 'home' && !activeWatchData && allCampaigns.length) {
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
                <div class="admin-stat-card"><h4>Campaign Cost</h4><div class="stat-number">${CAMPAIGN_COST_PER_SECOND}/sec</div></div>
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
                            <div class="user-stats">Creator: ${escapeHtml(c.creatorEmail || c.creatorName)} | Views: ${c.totalViews || 0} | Target: ${c.targetWatchTime}s | Real Duration: ${Math.floor(c.videoDuration || 0)}s</div>
                            <div class="user-stats ${c.targetWatchTime > (c.videoDuration || 0) ? 'error-text' : ''}">${c.targetWatchTime > (c.videoDuration || 0) ? '⚠️ INVALID' : '✅ Valid'}</div>
                        </div>
                        <div class="admin-actions">
                            <button class="admin-btn danger" onclick="window.adminDeleteCampaign('${c.id}')">Delete & Refund</button>
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
                            <div class="user-stats">Achievements: ${u.achievements?.length || 0}/${ACHIEVEMENTS.length}</div>
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

// Render Achievements Page (replacing old rewards/stats page)
function renderAchievementsPage() {
    const earnedAchievements = userData?.achievements || [];
    const lockedAchievements = ACHIEVEMENTS.filter(a => !earnedAchievements.includes(a.id));
    const earnedCount = earnedAchievements.length;
    const totalRewards = ACHIEVEMENTS.reduce((sum, a) => sum + a.reward, 0);
    const earnedRewards = ACHIEVEMENTS.filter(a => earnedAchievements.includes(a.id)).reduce((sum, a) => sum + a.reward, 0);
    
    return `
        <div class="card">
            <h2>🏆 Achievements Progress</h2>
            <div class="stat-row"><span>📊 Completed:</span><span>${earnedCount}/${ACHIEVEMENTS.length}</span></div>
            <div class="stat-row"><span>💰 Total Rewards Available:</span><span>${totalRewards} credits</span></div>
            <div class="stat-row"><span>🏅 Rewards Earned:</span><span>${earnedRewards} credits</span></div>
        </div>
        <div class="card">
            <h2>✅ Earned Achievements (${earnedCount})</h2>
            <div class="achievements-grid">
                ${earnedAchievements.map(achId => {
                    const ach = ACHIEVEMENTS.find(a => a.id === achId);
                    if (!ach) return '';
                    return `
                        <div class="achievement-card earned">
                            <div class="achievement-icon">${ach.name.split(' ')[0]}</div>
                            <div class="achievement-name">${ach.name}</div>
                            <div class="achievement-desc">${ach.description}</div>
                            <div class="achievement-reward">+${ach.reward} credits</div>
                        </div>
                    `;
                }).join('')}
                ${earnedCount === 0 ? '<div class="empty-state">No achievements yet. Keep watching and creating campaigns!</div>' : ''}
            </div>
        </div>
        <div class="card">
            <h2>🔒 Locked Achievements (${ACHIEVEMENTS.length - earnedCount})</h2>
            <div class="achievements-grid">
                ${lockedAchievements.map(ach => `
                    <div class="achievement-card locked">
                        <div class="achievement-icon">🔒</div>
                        <div class="achievement-name">${ach.name}</div>
                        <div class="achievement-desc">${ach.description}</div>
                        <div class="achievement-req">Need: ${ach.requirement.type.replace('_', ' ')} ${ach.requirement.count}</div>
                        <div class="achievement-reward">Reward: +${ach.reward} credits</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

async function renderCurrentPage() {
    const container = document.getElementById('pageContent');
    
    if (currentPage === 'home') {
        container.innerHTML = `<div class="card"><h2>🎬 Now Playing</h2>${activeWatchData?.campaign ? `<div class="campaign-item"><div class="video-container" id="current_player"></div><div class="watch-stats"><div class="stat-badge"><div class="stat-badge-label">YOU EARN</div><div class="stat-badge-value" id="current_earnings">0</div></div><div class="stat-badge"><div class="stat-badge-label">TIME LEFT</div><div class="stat-badge-value timer-value" id="current_timer">0</div></div></div><div class="progress-area"><div class="progress-bar-container"><div class="progress-fill" id="current_progress"></div></div></div><div class="action-buttons-area"><button class="action-btn btn-next" onclick="window.nextVideo()">⏭️ NEXT</button><button class="action-btn btn-autoplay ${autoplayEnabled ? 'active' : ''}" onclick="window.toggleAutoplay()">🔄 AUTO ${autoplayEnabled ? 'ON' : 'OFF'}</button></div></div>` : '<div class="empty-state">✨ No valid campaigns available. Create one with a video longer than target time!</div>'}</div>`;
        
        if (activeWatchData?.campaign && youtubePlayer && activeWatchData.isPaused && !activeWatchData.completed && isTabVisible) {
            setTimeout(() => {
                if (youtubePlayer && activeWatchData.isPaused) {
                    youtubePlayer.playVideo();
                    activeWatchData.isPaused = false;
                }
            }, 100);
        }
    } else if (currentPage === 'campaign') {
        const userCampaigns = allCampaigns.filter(c => c.creatorId === currentUser?.uid);
        container.innerHTML = `<div style="display: flex; justify-content: flex-end; margin-bottom: 12px;"><button class="btn-primary" id="createCampaignBtn" style="width: auto; padding: 10px 20px;">+ Create Campaign</button></div>${userCampaigns.map(c => `<div class="campaign-item"><div style="padding:16px;"><div><strong>${escapeHtml(c.title)}</strong></div><div>Views: ${c.totalViews || 0} / Target: ${c.targetWatchTime}s</div><div>Real Video Duration: ${Math.floor(c.videoDuration || 0)}s</div><div>Total Watch Time: ${(c.totalWatchTimeSeconds || 0)}s</div><div>Campaign Cost: ${(c.campaignCost || (c.targetWatchTime * CAMPAIGN_COST_PER_SECOND)).toFixed(2)} credits</div><div class="${c.targetWatchTime > (c.videoDuration || 0) ? 'error-text' : ''}">${c.targetWatchTime > (c.videoDuration || 0) ? '⚠️ INVALID: Target time exceeds real video duration!' : '✅ Real video duration is longer than target time'}</div><button class="small-btn btn-danger" onclick="window.deleteCampaign('${c.id}')">Delete & Refund</button></div></div>`).join('') || '<div class="empty-state">No campaigns yet. Click + to create!</div>'}`;
        document.getElementById('createCampaignBtn')?.addEventListener('click', () => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal-content"><h3>Create Campaign</h3><p style="font-size:0.8rem;margin-bottom:12px;color:#f87171;">⚠️ CRITICAL: Real video duration MUST be LONGER than target watch time!</p><p style="font-size:0.8rem;margin-bottom:12px;">💰 Campaign cost: <strong>${CAMPAIGN_COST_PER_SECOND} credits per second</strong> of target watch time</p><input id="newTitle" placeholder="Campaign Title"><input id="newUrl" placeholder="YouTube URL"><input id="newTarget" type="number" placeholder="Target watch time (seconds)" value="30"><p id="costPreview" style="font-size:0.8rem;margin-top:8px;">Cost: ${(30 * CAMPAIGN_COST_PER_SECOND).toFixed(2)} credits</p><p id="warningPreview" style="font-size:0.8rem;color:#f87171;"></p><button class="btn-primary" id="confirmCreateBtn">Create Campaign</button><button class="btn-secondary" id="cancelModal">Cancel</button></div>`;
            document.body.appendChild(modal);
            const targetInput = document.getElementById('newTarget');
            const costPreview = document.getElementById('costPreview');
            const warningPreview = document.getElementById('warningPreview');
            targetInput?.addEventListener('input', (e) => {
                const val = parseInt(e.target.value) || 0;
                costPreview.textContent = `Cost: ${(val * CAMPAIGN_COST_PER_SECOND).toFixed(2)} credits`;
                warningPreview.textContent = `⚠️ Video must be at least ${val} seconds long (real duration)!`;
            });
            document.getElementById('confirmCreateBtn')?.addEventListener('click', async () => {
                const targetTime = parseInt(targetInput?.value) || 30;
                await validateAndCreateCampaign({ 
                    title: document.getElementById('newTitle').value, 
                    url: document.getElementById('newUrl').value, 
                    targetWatchTime: targetTime 
                });
                modal.remove();
                renderCurrentPage();
            });
            document.getElementById('cancelModal')?.addEventListener('click', () => modal.remove());
        });
    } else if (currentPage === 'rewards') {
        // Now showing ACHIEVEMENTS instead of stats
        container.innerHTML = renderAchievementsPage();
        // Add styles for achievements grid
        if (!document.getElementById('achievementStyles')) {
            const style = document.createElement('style');
            style.id = 'achievementStyles';
            style.textContent = `
                .achievements-grid { display: flex; flex-direction: column; gap: 12px; }
                .achievement-card { background: rgba(255,255,255,0.1); border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
                .achievement-card.earned { border-left: 4px solid #10b981; background: rgba(16,185,129,0.1); }
                .achievement-card.locked { border-left: 4px solid #6b7280; opacity: 0.7; }
                .achievement-icon { font-size: 2rem; min-width: 50px; text-align: center; }
                .achievement-name { font-weight: bold; flex: 1; min-width: 120px; }
                .achievement-desc { font-size: 0.75rem; color: rgba(255,255,255,0.7); flex: 2; }
                .achievement-reward, .achievement-req { font-size: 0.75rem; font-weight: bold; min-width: 100px; }
                .achievement-card.earned .achievement-reward { color: #10b981; }
                @media (max-width: 600px) {
                    .achievement-card { flex-direction: column; text-align: center; }
                    .achievement-icon { font-size: 1.5rem; }
                }
            `;
            document.head.appendChild(style);
        }
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
    }
    currentPage = btn.dataset.page;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCurrentPage();
    if (currentPage === 'home' && activeWatchData && activeWatchData.isPaused && !activeWatchData.completed && isTabVisible) {
        setTimeout(() => resumeCurrentVideo(), 200);
    }
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
