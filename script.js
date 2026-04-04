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

// Hidden Admin Logs System
let adminLogs = [];
let showLogs = false;
let logPanel = null;

// Secret key combo (Ctrl+Shift+L) to toggle logs
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
            logPanel.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                width: 400px;
                max-height: 300px;
                background: rgba(0,0,0,0.95);
                color: #0f0;
                font-family: monospace;
                font-size: 11px;
                border-radius: 8px;
                padding: 10px;
                overflow-y: auto;
                z-index: 10001;
                border: 1px solid #0f0;
                box-shadow: 0 0 10px rgba(0,255,0,0.3);
            `;
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
    const logEntry = { timestamp, message, type };
    adminLogs.unshift(logEntry);
    if (adminLogs.length > 100) adminLogs.pop();
    
    console.log(`[${timestamp}] ${message}`);
    
    if (showLogs && logPanel) {
        refreshLogPanel();
    }
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

// Algorithm Settings
let algorithmSettings = {
    popularityWeight: 0.4,
    newCampaignBoost: 0.3,
    viewerPreferenceWeight: 0.3,
    minCampaignAgeHours: 0,
    maxCampaignAgeDays: 30,
    viralThreshold: 100
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
let currentVideoId = null; // Track current video to prevent re-initialization

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
    if (type === 'achievement' && !userNotificationSettings.achievements) return;
    if (type === 'referral' && !userNotificationSettings.referralEarnings) return;
    if (type === 'daily' && !userNotificationSettings.dailyBonus) return;
    if (type === 'campaign' && !userNotificationSettings.campaignAlerts) return;
    if (Notification.permission === 'granted') {
        new Notification(title, { body });
    }
}

// ============ AI BUG FIXER ============
async function aiFixEverything() {
    addAdminLog("🤖 AI Bug Fixer Activated - Scanning for issues...", "info");
    showToast("🤖 AI Bug Fixer: Scanning for issues...");
    
    let fixesApplied = [];
    let errorsFound = [];
    
    try {
        // 1. Check and fix Firebase connection
        addAdminLog("Checking Firebase connection...", "info");
        try {
            const testQuery = await getDocs(query(collection(db, 'viewswap_users'), limit(1)));
            addAdminLog("✅ Firebase connection OK", "success");
        } catch (e) {
            errorsFound.push("Firebase connection issue");
            addAdminLog("❌ Firebase connection issue detected", "error");
        }
        
        // 2. Auto-delete invalid campaigns
        addAdminLog("Scanning for invalid campaigns...", "info");
        const invalidCampaigns = await autoDeleteInvalidCampaigns(true);
        if (invalidCampaigns > 0) {
            fixesApplied.push(`Deleted ${invalidCampaigns} invalid campaigns`);
            addAdminLog(`✅ Deleted ${invalidCampaigns} invalid campaigns`, "success");
        }
        
        // 3. Check and fix user data consistency
        addAdminLog("Checking user data consistency...", "info");
        const usersSnapshot = await getDocs(collection(db, 'viewswap_users'));
        let userFixes = 0;
        for (const userDoc of usersSnapshot.docs) {
            const user = userDoc.data();
            let needsFix = false;
            const updates = {};
            
            if (!user.streak) {
                updates.streak = { current: 0, lastClaim: null, highest: 0 };
                needsFix = true;
            }
            if (!user.achievements) {
                updates.achievements = [];
                needsFix = true;
            }
            if (!user.notificationSettings) {
                updates.notificationSettings = { enabled: true, achievements: true, referralEarnings: true, dailyBonus: true, campaignAlerts: true };
                needsFix = true;
            }
            
            if (needsFix) {
                await updateDoc(doc(db, 'viewswap_users', userDoc.id), updates);
                userFixes++;
            }
        }
        if (userFixes > 0) {
            fixesApplied.push(`Fixed ${userFixes} user profiles`);
            addAdminLog(`✅ Fixed ${userFixes} user profiles`, "success");
        }
        
        // 4. Check YouTube API
        addAdminLog("Checking YouTube API...", "info");
        if (typeof YT === 'undefined') {
            errorsFound.push("YouTube API not loaded");
            addAdminLog("⚠️ YouTube API not loaded - will retry", "error");
            const script = document.createElement('script');
            script.src = "https://www.youtube.com/iframe_api";
            document.head.appendChild(script);
            fixesApplied.push("Reloaded YouTube API");
        } else {
            addAdminLog("✅ YouTube API available", "success");
        }
        
        // 5. Reset any stuck video state
        if (activeWatchData && !activeWatchData.completed && !youtubePlayer) {
            addAdminLog("Resetting stuck video state...", "info");
            stopCurrentWatch();
            fixesApplied.push("Reset stuck video player");
        }
        
        // 6. Refresh campaigns
        addAdminLog("Refreshing campaigns list...", "info");
        if (unsubscribeCampaigns) {
            unsubscribeCampaigns();
            setupRealTimeCampaigns();
            fixesApplied.push("Refreshed campaigns listener");
        }
        
        // 7. Check for orphaned campaigns (creator deleted)
        addAdminLog("Checking for orphaned campaigns...", "info");
        const allCampaignsSnap = await getDocs(collection(db, 'viewswap_campaigns'));
        let orphanedCount = 0;
        for (const campDoc of allCampaignsSnap.docs) {
            const camp = campDoc.data();
            const creatorSnap = await getDoc(doc(db, 'viewswap_users', camp.creatorId));
            if (!creatorSnap.exists()) {
                await deleteDoc(campDoc.ref);
                orphanedCount++;
            }
        }
        if (orphanedCount > 0) {
            fixesApplied.push(`Deleted ${orphanedCount} orphaned campaigns`);
            addAdminLog(`✅ Deleted ${orphanedCount} orphaned campaigns`, "success");
        }
        
        // 8. Re-render current page without destroying player
        await renderCurrentPage();
        
        const resultMsg = fixesApplied.length > 0 
            ? `✅ AI Fixer completed! Applied: ${fixesApplied.join(', ')}` 
            : "✅ AI Fixer: No issues found! System is healthy.";
        
        showToast(resultMsg);
        addAdminLog(resultMsg, "success");
        
        if (errorsFound.length > 0) {
            addAdminLog(`⚠️ Warning: Some issues couldn't be auto-fixed: ${errorsFound.join(', ')}`, "error");
        }
        
    } catch (error) {
        addAdminLog(`AI Fixer error: ${error.message}`, "error");
        showToast(`AI Fixer error: ${error.message}`, true);
    }
}

// FIXED: Tab visibility - ONLY PAUSE/RESUME, NEVER DESTROY PLAYER
document.addEventListener('visibilitychange', () => {
    isTabVisible = !document.hidden;
    if (activeWatchData && youtubePlayer) {
        if (!isTabVisible) {
            youtubePlayer.pauseVideo();
            activeWatchData.isPaused = true;
            addAdminLog("Video paused - tab hidden", "info");
        } else if (isTabVisible && activeWatchData.isPaused && !activeWatchData.completed) {
            youtubePlayer.playVideo();
            activeWatchData.isPaused = false;
            addAdminLog("Video resumed - tab visible", "info");
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

// FIXED: Stop watch but preserve player when switching tabs
function stopCurrentWatch(keepPlayer = false) {
    if (watchInterval) clearInterval(watchInterval);
    watchInterval = null;
    videoFullyLoaded = false;
    // Only destroy player if explicitly told to (like when changing videos)
    if (!keepPlayer && youtubePlayer && youtubePlayer.destroy) {
        youtubePlayer.destroy();
        youtubePlayer = null;
        currentVideoId = null;
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
            return defaultReferrerIdCache;
        }
        return null;
    } catch (e) {
        addAdminLog(`Error getting default referrer: ${e.message}`, "error");
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
            addAdminLog(`Auto-referred user ${userEmail} to default referrer`, "info");
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
        showNotification('Referral Success', `+10 credits!`, 'referral');
        addAdminLog(`User ${currentUser.email} used referral code ${code}`, "success");
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
        userData.notificationSettings = userData.notificationSettings || { ...userNotificationSettings };
        userNotificationSettings = userData.notificationSettings;
        addAdminLog(`Loaded user data for ${currentUser.email}`, "info");
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
            achievements: [], campaignsCreated: 0, totalCampaignViews: 0, totalSpent: 0,
            notificationSettings: { ...userNotificationSettings }
        };
        await setDoc(ref, userData);
        addAdminLog(`Created new user: ${currentUser.email}`, "success");
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
    } catch (e) {
        addAdminLog(`Referral error: ${e.message}`, "error");
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
    showNotification('Daily Bonus', `+${bonusAmount} credits! ${newStreak} day streak!`, 'daily');
    addAdminLog(`Daily bonus: ${bonusAmount} credits, streak: ${newStreak}`, "info");
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
                reject(new Error("YouTube API timeout"));
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
                                        reject(new Error("Invalid duration"));
                                    }
                                }
                            },
                            onError: (error) => {
                                tempPlayer.destroy();
                                tempDiv.remove();
                                if (!resolved) {
                                    resolved = true;
                                    clearTimeout(timeout);
                                    reject(new Error("YouTube API error"));
                                }
                            }
                        }
                    });
                } catch(e) {
                    tempDiv.remove();
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        reject(new Error("Player init failed"));
                    }
                }
            } else {
                setTimeout(checkAPI, 200);
            }
        };
        checkAPI();
    });
}

async function validateAndCreateCampaign(campaignData, isAdminAction = false, targetUserId = null) {
    addAdminLog(`Starting campaign creation for ${campaignData.title}`, "info");
    
    const targetTime = parseInt(campaignData.targetWatchTime) || 30;
    const totalCost = targetTime * CAMPAIGN_COST_PER_SECOND;
    
    if (!isAdminAction && userData.credits < totalCost) {
        showToast(`Need ${totalCost.toFixed(2)} credits`, true);
        addAdminLog(`Insufficient credits: need ${totalCost}, have ${userData.credits}`, "error");
        return false;
    }
    
    const videoId = extractVideoId(campaignData.url);
    if (!videoId) {
        showToast('Invalid YouTube URL', true);
        addAdminLog(`Invalid YouTube URL: ${campaignData.url}`, "error");
        return false;
    }
    
    showToast('Getting real video duration from YouTube...');
    let duration;
    try {
        duration = await getRealVideoDuration(videoId);
        addAdminLog(`Video duration: ${duration}s for ${videoId}`, "info");
    } catch (error) {
        addAdminLog(`Duration fetch error: ${error.message}`, "error");
        showToast(`Failed to get video duration: ${error.message}`, true);
        return false;
    }
    
    if (duration < targetTime) {
        showToast(`❌ REJECTED: Video is ${Math.floor(duration)}s long, target is ${targetTime}s`, true);
        addAdminLog(`Campaign rejected: duration ${duration} < target ${targetTime}`, "error");
        return false;
    }
    
    if (!isAdminAction) {
        await updateCredits(-totalCost);
        await trackSpending(totalCost);
        await trackCampaignCreation();
        addAdminLog(`Deducted ${totalCost} credits from user`, "info");
    }
    
    const campaignId = Date.now().toString();
    const campaign = {
        id: campaignId, 
        title: campaignData.title, 
        url: campaignData.url, 
        videoId,
        creatorId: isAdminAction && targetUserId ? targetUserId : currentUser.uid, 
        creatorName: isAdminAction && targetUserId ? (await getDoc(doc(db, 'viewswap_users', targetUserId))).data()?.displayName || targetUserId : userData.displayName,
        creatorEmail: isAdminAction && targetUserId ? (await getDoc(doc(db, 'viewswap_users', targetUserId))).data()?.email : currentUser.email,
        createdAt: new Date().toISOString(), 
        targetWatchTime: targetTime, 
        videoDuration: duration,
        totalWatchTimeSeconds: 0, 
        watchers: [], 
        watcherWatchTime: {},
        isActive: true, 
        totalViews: 0,
        campaignCost: totalCost,
        createdByAdmin: isAdminAction || false
    };
    
    try {
        await setDoc(doc(db, 'viewswap_campaigns', campaignId), campaign);
        addAdminLog(`Campaign created successfully: ${campaignData.title}`, "success");
        showToast(`✅ Campaign created! Duration: ${Math.floor(duration)}s, Target: ${targetTime}s`);
        
        if (unsubscribeCampaigns) {
            unsubscribeCampaigns();
            setupRealTimeCampaigns();
        }
        
        return true;
    } catch (error) {
        addAdminLog(`Error saving campaign: ${error.message}`, "error");
        showToast(`Failed to save campaign: ${error.message}`, true);
        return false;
    }
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
            addAdminLog(`Refunded ${refundAmount} credits for deleted campaign ${campaign.title}`, "info");
        }
    }
    await deleteDoc(campaignRef);
}

async function autoDeleteInvalidCampaigns(silent = false) {
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
            if (!silent) addAdminLog(`Auto-deleted invalid campaign: ${campaign.title}`, "warning");
        }
    }
    
    if (deletedCount > 0 && currentPage === 'home') {
        if (unsubscribeCampaigns) {
            unsubscribeCampaigns();
            setupRealTimeCampaigns();
        }
    }
    
    return deletedCount;
}

// ============ ADMIN FUNCTIONS ============

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
    addAdminLog(`Admin deleted campaign ${campaignId}`, "info");
    if (currentPage === 'admin') renderAdminPanel();
}

async function adminGiveCredits(userEmail, amount) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const userId = snap.docs[0].id;
        await updateDoc(doc(db, 'viewswap_users', userId), { credits: increment(parseFloat(amount)), totalEarned: increment(parseFloat(amount)) });
        showToast(`Added ${amount} credits to ${userEmail}`);
        addAdminLog(`Admin added ${amount} credits to ${userEmail}`, "success");
        if (currentPage === 'admin') renderAdminPanel();
    } else {
        showToast('User not found', true);
    }
}

async function adminSetCredits(userEmail, amount) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const userId = snap.docs[0].id;
        const userRef = doc(db, 'viewswap_users', userId);
        const userSnap = await getDoc(userRef);
        const currentCredits = userSnap.data().credits || 0;
        const diff = parseFloat(amount) - currentCredits;
        await updateDoc(userRef, { credits: parseFloat(amount), totalEarned: increment(diff) });
        showToast(`Set ${userEmail} credits to ${amount}`);
        addAdminLog(`Admin set ${userEmail} credits to ${amount}`, "success");
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
        addAdminLog(`Admin removed ${amount} credits from ${userEmail}`, "warning");
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
        addAdminLog(`Admin removed referral for ${userEmail}`, "info");
        if (currentPage === 'admin') renderAdminPanel();
    }
}

async function adminSetReferral(userEmail, referrerEmail) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const userSnap = await getDocs(q);
    const referrerQ = query(collection(db, 'viewswap_users'), where('email', '==', referrerEmail));
    const referrerSnap = await getDocs(referrerQ);
    
    if (userSnap.empty || referrerSnap.empty) {
        showToast('User or referrer not found', true);
        return;
    }
    
    const userId = userSnap.docs[0].id;
    const referrerId = referrerSnap.docs[0].id;
    
    const userRef = doc(db, 'viewswap_users', userId);
    await updateDoc(userRef, { referredBy: referrerId });
    await updateDoc(doc(db, 'viewswap_users', referrerId), { referrals: arrayUnion(userId) });
    showToast(`Set ${userEmail} referred by ${referrerEmail}`);
    addAdminLog(`Admin set ${userEmail} referred by ${referrerEmail}`, "success");
    if (currentPage === 'admin') renderAdminPanel();
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
        addAdminLog(`Admin removed ALL referrals`, "warning");
        if (currentPage === 'admin') renderAdminPanel();
    }
}

async function adminResetUser(userEmail) {
    if (confirm(`⚠️ WARNING: This will RESET ${userEmail}'s account. All progress, credits, achievements will be lost. This cannot be undone. Are you sure?`)) {
        const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const userId = snap.docs[0].id;
            const userRef = doc(db, 'viewswap_users', userId);
            await setDoc(userRef, {
                credits: 0,
                totalEarned: 0,
                watchedVideos: [],
                achievements: [],
                campaignsCreated: 0,
                totalCampaignViews: 0,
                totalSpent: 0,
                referralEarnings: 0,
                defaultReferralEarnings: 0,
                streak: { current: 0, lastClaim: null, highest: 0 },
                totalWatchTime: 0,
                earningsHistory: []
            }, { merge: true });
            showToast(`Reset ${userEmail}'s account`);
            addAdminLog(`Admin reset account for ${userEmail}`, "warning");
            if (currentPage === 'admin') renderAdminPanel();
        }
    }
}

async function adminDeleteUser(userEmail) {
    if (confirm(`⚠️ DANGER: This will PERMANENTLY DELETE ${userEmail}'s account. All data will be lost. This cannot be undone. Are you ABSOLUTELY sure?`)) {
        const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const userId = snap.docs[0].id;
            await deleteDoc(doc(db, 'viewswap_users', userId));
            showToast(`Deleted user ${userEmail}`);
            addAdminLog(`Admin DELETED user ${userEmail}`, "error");
            if (currentPage === 'admin') renderAdminPanel();
        }
    }
}

async function adminUpdateAlgorithmSettings(settings) {
    algorithmSettings = { ...algorithmSettings, ...settings };
    showToast('Algorithm settings updated');
    addAdminLog(`Algorithm settings updated: ${JSON.stringify(settings)}`, "info");
    if (currentPage === 'home') {
        setupRealTimeCampaigns();
    }
}

async function adminCreateCampaignForUser(userEmail, campaignData) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (snap.empty) {
        showToast('User not found', true);
        return false;
    }
    const userId = snap.docs[0].id;
    const userSnap = await getDoc(doc(db, 'viewswap_users', userId));
    const targetUserData = userSnap.data();
    
    const originalUserData = userData;
    userData = targetUserData;
    
    const result = await validateAndCreateCampaign(campaignData, true, userId);
    
    userData = originalUserData;
    
    if (result) {
        showToast(`Campaign created for ${userEmail} using their credits`);
        addAdminLog(`Admin created campaign for user ${userEmail}: ${campaignData.title}`, "success");
        if (currentPage === 'admin') renderAdminPanel();
    }
    return result;
}

async function adminToggleNotifications(userEmail, notificationType, enabled) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const userId = snap.docs[0].id;
        const userRef = doc(db, 'viewswap_users', userId);
        const userSnap = await getDoc(userRef);
        const currentSettings = userSnap.data().notificationSettings || { ...userNotificationSettings };
        currentSettings[notificationType] = enabled;
        await updateDoc(userRef, { notificationSettings: currentSettings });
        showToast(`Updated notifications for ${userEmail}: ${notificationType} = ${enabled}`);
        addAdminLog(`Admin set ${notificationType}=${enabled} for ${userEmail}`, "info");
        if (currentPage === 'admin') renderAdminPanel();
    }
}

async function adminDisableAllNotifications(userEmail) {
    const q = query(collection(db, 'viewswap_users'), where('email', '==', userEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const userId = snap.docs[0].id;
        const userRef = doc(db, 'viewswap_users', userId);
        const currentSettings = { enabled: false, achievements: false, referralEarnings: false, dailyBonus: false, campaignAlerts: false };
        await updateDoc(userRef, { notificationSettings: currentSettings });
        showToast(`All notifications disabled for ${userEmail}`);
        addAdminLog(`Admin disabled all notifications for ${userEmail}`, "info");
        if (currentPage === 'admin') renderAdminPanel();
    }
}

async function adminBroadcastMessage(message) {
    showNotification(`📢 Admin Broadcast`, message);
    showToast(`Broadcast sent to all users`);
    addAdminLog(`Broadcast message sent: "${message}"`, "info");
}

async function adminChangeEarningRate(newRate) {
    VIEWER_EARNING_RATE = newRate;
    showToast(`Viewer earning rate changed to ${newRate}/sec`);
    addAdminLog(`Viewer earning rate changed to ${newRate}/sec`, "info");
}

async function adminChangeCampaignCost(newCost) {
    CAMPAIGN_COST_PER_SECOND = newCost;
    showToast(`Campaign cost changed to ${newCost}/sec`);
    addAdminLog(`Campaign cost changed to ${newCost}/sec`, "info");
}

function sortCampaignsByAlgorithm(campaigns) {
    const now = Date.now();
    const maxAge = algorithmSettings.maxCampaignAgeDays * 24 * 60 * 60 * 1000;
    
    return campaigns.sort((a, b) => {
        let scoreA = 0, scoreB = 0;
        
        const popularityA = (a.totalViews || 0) * algorithmSettings.popularityWeight;
        const popularityB = (b.totalViews || 0) * algorithmSettings.popularityWeight;
        scoreA += popularityA;
        scoreB += popularityB;
        
        const ageA = now - new Date(a.createdAt).getTime();
        const ageB = now - new Date(b.createdAt).getTime();
        if (ageA < 24 * 60 * 60 * 1000) scoreA += algorithmSettings.newCampaignBoost * 100;
        if (ageB < 24 * 60 * 60 * 1000) scoreB += algorithmSettings.newCampaignBoost * 100;
        
        if ((a.totalViews || 0) > algorithmSettings.viralThreshold) scoreA += 50;
        if ((b.totalViews || 0) > algorithmSettings.viralThreshold) scoreB += 50;
        
        return scoreB - scoreA;
    });
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
    const sorted = sortCampaignsByAlgorithm(available);
    return sorted[0] || allCampaigns.filter(c => c.creatorId !== currentUser?.uid)[0];
}

// FIXED: Reuse player if same video, don't destroy on tab switch
function initYouTubePlayer(videoId, campaign) {
    const div = document.getElementById('current_player');
    if (!div || !videoId) return null;
    
    // If we already have a player with the same video, just return it
    if (youtubePlayer && currentVideoId === videoId) {
        addAdminLog(`Reusing existing player for video ${videoId}`, "info");
        return youtubePlayer;
    }
    
    // Only destroy if different video
    if (youtubePlayer && youtubePlayer.destroy) {
        youtubePlayer.destroy();
        youtubePlayer = null;
    }
    
    currentVideoId = videoId;
    videoFullyLoaded = false;
    
    addAdminLog(`Creating new YouTube player for video ${videoId}`, "info");
    
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
                addAdminLog(`YouTube player ready for ${videoId}`, "success");
            },
            onStateChange: (e) => {
                if (e.data === 1 && !videoFullyLoaded) {
                    videoFullyLoaded = true;
                    if (activeWatchData && activeWatchData.startTimerOnLoad) {
                        activeWatchData.timerStarted = true;
                        addAdminLog(`Video loaded, timer started`, "info");
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
                addAdminLog(`YouTube error: ${e.data}`, "error");
                nextVideo();
            }
        }
    });
}

async function startAutoWatch(campaign) {
    if (!currentUser || campaign.watchers?.includes(currentUser.uid)) return;
    
    // If already watching the same campaign and player exists, just resume
    if (activeWatchData && activeWatchData.campaignId === campaign.id && youtubePlayer) {
        if (activeWatchData.isPaused) {
            youtubePlayer.playVideo();
            activeWatchData.isPaused = false;
            addAdminLog(`Resumed watching campaign: ${campaign.title}`, "info");
        }
        return;
    }
    
    // Only stop if switching to different campaign
    if (activeWatchData) {
        stopCurrentWatch(true); // Keep player if same video
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
    addAdminLog(`Started watching campaign: ${campaign.title}`, "info");
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
        
        const sortedCampaigns = sortCampaignsByAlgorithm(allCampaigns);
        
        if (currentPage === 'home' && previousCampaignId) {
            const existingCampaign = sortedCampaigns.find(c => c.id === previousCampaignId);
            if (existingCampaign && activeWatchData && !activeWatchData.completed) {
                // Campaign still exists, preserve player
                if (youtubePlayer && activeWatchData.isPaused && isTabVisible) {
                    youtubePlayer.playVideo();
                    activeWatchData.isPaused = false;
                }
            } else if (!activeWatchData && sortedCampaigns.length) {
                const next = getNextCampaign();
                if (next) startAutoWatch(next);
            }
        } else if (currentPage === 'home' && !activeWatchData && sortedCampaigns.length) {
            const next = getNextCampaign();
            if (next) startAutoWatch(next);
        }
        renderCurrentPage();
    });
}

async function trackCampaignCreation() {
    userData.campaignsCreated = (userData.campaignsCreated || 0) + 1;
    await saveUserData();
    await checkAchievements();
    addAdminLog(`User created campaign #${userData.campaignsCreated}`, "info");
}

async function trackCampaignView(campaign) {
    if (campaign.creatorId === currentUser?.uid) return;
    const campaignRef = doc(db, 'viewswap_campaigns', campaign.id);
    const campaignSnap = await getDoc(campaignRef);
    if (campaignSnap.exists()) {
        const creatorRef = doc(db, 'viewswap_users', campaign.creatorId);
        const creatorSnap = await getDoc(creatorRef);
        if (creatorSnap.exists()) {
            const totalViews = (creatorSnap.data().totalCampaignViews || 0) + 1;
            await updateDoc(creatorRef, { totalCampaignViews: totalViews });
        }
    }
}

async function trackSpending(amount) {
    userData.totalSpent = (userData.totalSpent || 0) + amount;
    await saveUserData();
    await checkAchievements();
}

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
            addAdminLog(`Achievement unlocked: ${achievement.name}`, "success");
        }
    }
    
    if (newAchievements.length > 0) {
        await updateCredits(totalReward);
        for (const ach of newAchievements) {
            showNotification(`🏆 Achievement Unlocked!`, `${ach.name} - ${ach.description} (+${ach.reward} credits)`, 'achievement');
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
            <h2>👑 Admin Dashboard - Full Control</h2>
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
                <button class="btn-primary" id="broadcastMsgBtn">📢 Broadcast Message</button>
                <button class="btn-primary" id="aiFixEverythingBtn" style="background: linear-gradient(135deg, #8b5cf6, #ec489a);">🤖 AI FIX EVERYTHING</button>
            </div>
            <p style="font-size:0.7rem; margin-top:8px;">💡 Press <strong>Ctrl+Shift+L</strong> to toggle hidden admin logs panel</p>
        </div>
        
        <div class="card">
            <h2>⚙️ System Controls</h2>
            <div class="algorithm-control">
                <label>Viewer Earning Rate (credits/sec): <span id="earningRateVal">${VIEWER_EARNING_RATE}</span></label>
                <input type="range" id="earningRate" min="0.1" max="2" step="0.05" value="${VIEWER_EARNING_RATE}">
                <button class="admin-btn info" id="saveEarningRate" style="margin-top: 8px;">Apply Rate Change</button>
            </div>
            <div class="algorithm-control">
                <label>Campaign Cost (credits/sec): <span id="campaignCostVal">${CAMPAIGN_COST_PER_SECOND}</span></label>
                <input type="range" id="campaignCost" min="0.05" max="1" step="0.05" value="${CAMPAIGN_COST_PER_SECOND}">
                <button class="admin-btn info" id="saveCampaignCost" style="margin-top: 8px;">Apply Cost Change</button>
            </div>
        </div>
        
        <div class="card">
            <h2>⚙️ Algorithm Controls</h2>
            <div class="algorithm-control">
                <label>Popularity Weight: <span id="popularityWeightVal" class="slider-value">${algorithmSettings.popularityWeight}</span></label>
                <input type="range" id="popularityWeight" min="0" max="1" step="0.05" value="${algorithmSettings.popularityWeight}">
            </div>
            <div class="algorithm-control">
                <label>New Campaign Boost: <span id="newCampaignBoostVal" class="slider-value">${algorithmSettings.newCampaignBoost}</span></label>
                <input type="range" id="newCampaignBoost" min="0" max="1" step="0.05" value="${algorithmSettings.newCampaignBoost}">
            </div>
            <div class="algorithm-control">
                <label>Viral Threshold (views): <span id="viralThresholdVal" class="slider-value">${algorithmSettings.viralThreshold}</span></label>
                <input type="range" id="viralThreshold" min="10" max="500" step="10" value="${algorithmSettings.viralThreshold}">
            </div>
            <div class="algorithm-control">
                <label>Max Campaign Age (days): <span id="maxAgeVal" class="slider-value">${algorithmSettings.maxCampaignAgeDays}</span></label>
                <input type="range" id="maxAgeDays" min="1" max="90" step="1" value="${algorithmSettings.maxCampaignAgeDays}">
            </div>
            <button class="btn-primary" id="saveAlgorithmBtn">Save Algorithm Settings</button>
        </div>
        
        <div class="card">
            <h2>📢 Create Campaign For User</h2>
            <input type="email" id="targetUserEmail" placeholder="User Email">
            <input type="text" id="campaignTitle" placeholder="Campaign Title">
            <input type="text" id="campaignUrl" placeholder="YouTube URL">
            <input type="number" id="campaignTargetTime" placeholder="Target Time (seconds)" value="30">
            <button class="btn-primary" id="createForUserBtn">Create Campaign (uses user's credits)</button>
        </div>
        
        <div class="card">
            <h2>🔔 Notification Controls</h2>
            <div class="user-list" style="max-height: 300px;">
                ${users.map(u => `
                    <div class="user-item">
                        <div class="user-info">
                            <div class="user-email"><strong>${escapeHtml(u.email)}</strong></div>
                            <div class="user-stats">Notifications: ${u.notificationSettings?.enabled !== false ? 'Enabled' : 'Disabled'}</div>
                        </div>
                        <div class="admin-actions">
                            <button class="admin-btn warning" onclick="window.adminToggleNotifications('${u.email}', 'enabled', ${!u.notificationSettings?.enabled})">${u.notificationSettings?.enabled !== false ? 'Disable All' : 'Enable All'}</button>
                            <button class="admin-btn danger" onclick="window.adminDisableAllNotifications('${u.email}')">Mute All</button>
                        </div>
                    </div>
                `).join('')}
            </div>
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
            <h2>👥 Manage Users - Full Control</h2>
            <div class="user-list">
                ${users.map(u => `
                    <div class="user-item">
                        <div class="user-info">
                            <div class="user-email"><strong>${escapeHtml(u.email)}</strong></div>
                            <div class="user-stats">Credits: ${u.credits || 0} | Referrals: ${u.referrals?.length || 0} | Earned: ${(u.totalEarned || 0).toFixed(2)}</div>
                            <div class="user-stats">Referral Earnings: ${(u.referralEarnings || 0).toFixed(4)} | Platform: ${(u.defaultReferralEarnings || 0).toFixed(4)}</div>
                            ${u.referredBy ? `<div class="user-stats">Referred by: ${u.referredBy.substring(0, 12)}...</div>` : '<div class="user-stats">No referrer</div>'}
                            <div class="user-stats">Achievements: ${u.achievements?.length || 0}/${ACHIEVEMENTS.length}</div>
                        </div>
                        <div class="admin-actions">
                            <input type="number" id="amount_set_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}" placeholder="Set Amount" class="amount-input">
                            <button class="admin-btn success" onclick="window.adminSetCredits('${u.email}', document.getElementById('amount_set_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}').value)">Set Credits</button>
                            <button class="admin-btn info" onclick="window.adminGiveCredits('${u.email}', document.getElementById('amount_set_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}').value)">+Add</button>
                            <button class="admin-btn danger" onclick="window.adminRemoveCredits('${u.email}', document.getElementById('amount_set_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}').value)">-Remove</button>
                            <button class="admin-btn warning" onclick="window.adminRemoveReferral('${u.email}')">Remove Ref</button>
                            <button class="admin-btn danger" onclick="window.adminResetUser('${u.email}')">Reset</button>
                            <button class="admin-btn danger" onclick="window.adminDeleteUser('${u.email}')">Delete User</button>
                        </div>
                        <div class="admin-actions" style="margin-top: 5px;">
                            <input type="email" id="referrer_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}" placeholder="Referrer Email" class="amount-input" style="width: 150px;">
                            <button class="admin-btn info" onclick="window.adminSetReferral('${u.email}', document.getElementById('referrer_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}').value)">Set Referrer</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.getElementById('pageContent').innerHTML = adminHtml;
    
    document.getElementById('popularityWeight')?.addEventListener('input', (e) => {
        document.getElementById('popularityWeightVal').textContent = e.target.value;
    });
    document.getElementById('newCampaignBoost')?.addEventListener('input', (e) => {
        document.getElementById('newCampaignBoostVal').textContent = e.target.value;
    });
    document.getElementById('viralThreshold')?.addEventListener('input', (e) => {
        document.getElementById('viralThresholdVal').textContent = e.target.value;
    });
    document.getElementById('maxAgeDays')?.addEventListener('input', (e) => {
        document.getElementById('maxAgeVal').textContent = e.target.value;
    });
    document.getElementById('earningRate')?.addEventListener('input', (e) => {
        document.getElementById('earningRateVal').textContent = e.target.value;
    });
    document.getElementById('campaignCost')?.addEventListener('input', (e) => {
        document.getElementById('campaignCostVal').textContent = e.target.value;
    });
    
    document.getElementById('saveAlgorithmBtn')?.addEventListener('click', () => {
        adminUpdateAlgorithmSettings({
            popularityWeight: parseFloat(document.getElementById('popularityWeight').value),
            newCampaignBoost: parseFloat(document.getElementById('newCampaignBoost').value),
            viralThreshold: parseInt(document.getElementById('viralThreshold').value),
            maxCampaignAgeDays: parseInt(document.getElementById('maxAgeDays').value)
        });
    });
    document.getElementById('saveEarningRate')?.addEventListener('click', () => {
        const newRate = parseFloat(document.getElementById('earningRate').value);
        adminChangeEarningRate(newRate);
    });
    document.getElementById('saveCampaignCost')?.addEventListener('click', () => {
        const newCost = parseFloat(document.getElementById('campaignCost').value);
        adminChangeCampaignCost(newCost);
    });
    document.getElementById('createForUserBtn')?.addEventListener('click', async () => {
        const userEmail = document.getElementById('targetUserEmail').value;
        const title = document.getElementById('campaignTitle').value;
        const url = document.getElementById('campaignUrl').value;
        const targetTime = parseInt(document.getElementById('campaignTargetTime').value);
        if (!userEmail || !title || !url) {
            showToast('Please fill all fields', true);
            return;
        }
        await adminCreateCampaignForUser(userEmail, { title, url, targetWatchTime: targetTime });
        document.getElementById('targetUserEmail').value = '';
        document.getElementById('campaignTitle').value = '';
        document.getElementById('campaignUrl').value = '';
    });
    document.getElementById('removeAllReferralsBtn')?.addEventListener('click', () => adminRemoveAllReferrals());
    document.getElementById('broadcastMsgBtn')?.addEventListener('click', () => {
        const msg = prompt('Enter broadcast message to send to all users:');
        if (msg) adminBroadcastMessage(msg);
    });
    document.getElementById('aiFixEverythingBtn')?.addEventListener('click', () => aiFixEverything());
}

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

// FIXED: renderCurrentPage - NEVER destroys the video player when switching away from home
async function renderCurrentPage() {
    const container = document.getElementById('pageContent');
    
    if (currentPage === 'home') {
        container.innerHTML = `<div class="card"><h2>🎬 Now Playing</h2>${activeWatchData?.campaign ? `<div class="campaign-item"><div class="video-container" id="current_player"></div><div class="watch-stats"><div class="stat-badge"><div class="stat-badge-label">YOU EARN</div><div class="stat-badge-value" id="current_earnings">0</div></div><div class="stat-badge"><div class="stat-badge-label">TIME LEFT</div><div class="stat-badge-value timer-value" id="current_timer">0</div></div></div><div class="progress-area"><div class="progress-bar-container"><div class="progress-fill" id="current_progress"></div></div></div><div class="action-buttons-area"><button class="action-btn btn-next" onclick="window.nextVideo()">⏭️ NEXT</button><button class="action-btn btn-autoplay ${autoplayEnabled ? 'active' : ''}" onclick="window.toggleAutoplay()">🔄 AUTO ${autoplayEnabled ? 'ON' : 'OFF'}</button></div></div>` : '<div class="empty-state">✨ No valid campaigns available. Create one with a video longer than target time!</div>'}</div>`;
        
        // If we have a player but it's not attached to the DOM (because we recreated the container),
        // we need to reattach it. Check if player exists but container is empty.
        if (youtubePlayer && activeWatchData && !activeWatchData.completed) {
            // Player exists but might need to be reattached - we'll recreate the player
            const playerDiv = document.getElementById('current_player');
            if (playerDiv && playerDiv.innerHTML === '') {
                addAdminLog("Reattaching existing player to DOM", "info");
                // Reinitialize the player with the same video
                const campaign = activeWatchData.campaign;
                youtubePlayer = initYouTubePlayer(campaign.videoId, campaign);
                if (activeWatchData.isPaused) {
                    youtubePlayer.pauseVideo();
                } else {
                    youtubePlayer.playVideo();
                }
            }
        }
        
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
            modal.innerHTML = `<div class="modal-content"><h3>Create Campaign</h3><p style="font-size:0.8rem;margin-bottom:12px;color:#f87171;">⚠️ CRITICAL: Real video duration MUST be LONGER than target watch time!</p><p style="font-size:0.8rem;margin-bottom:12px;">💰 Campaign cost: <strong>${CAMPAIGN_COST_PER_SECOND} credits per second</strong> of target watch time</p><p style="font-size:0.8rem;margin-bottom:12px;">💳 Your balance: ${userData?.credits || 0} credits</p><input id="newTitle" placeholder="Campaign Title"><input id="newUrl" placeholder="YouTube URL"><input id="newTarget" type="number" placeholder="Target watch time (seconds)" value="30"><p id="costPreview" style="font-size:0.8rem;margin-top:8px;">Cost: ${(30 * CAMPAIGN_COST_PER_SECOND).toFixed(2)} credits</p><p id="warningPreview" style="font-size:0.8rem;color:#f87171;"></p><button class="btn-primary" id="confirmCreateBtn">Create Campaign</button><button class="btn-secondary" id="cancelModal">Cancel</button></div>`;
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
                const title = document.getElementById('newTitle').value;
                const url = document.getElementById('newUrl').value;
                
                if (!title || !url) {
                    showToast('Please enter a title and YouTube URL', true);
                    return;
                }
                
                const success = await validateAndCreateCampaign({ 
                    title: title, 
                    url: url, 
                    targetWatchTime: targetTime 
                });
                if (success) {
                    modal.remove();
                    renderCurrentPage();
                }
            });
            document.getElementById('cancelModal')?.addEventListener('click', () => modal.remove());
        });
    } else if (currentPage === 'rewards') {
        container.innerHTML = renderAchievementsPage();
        
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
        container.innerHTML = `
            <div class="card">
                <div style="text-align:center;">
                    <img src="${userData?.photoURL}" style="width:80px;border-radius:50%;border:2px solid #f5576c;">
                    <div>${escapeHtml(userData?.displayName || currentUser?.email)}</div>
                    <div style="font-size:0.7rem;opacity:0.7;">${currentUser?.email}</div>
                    <div style="font-size:1.2rem;margin-top:8px;">💰 Balance: ${Math.floor(userData?.credits || 0)} credits</div>
                </div>
            </div>
            <div class="card">
                <h2>🔔 Notification Settings</h2>
                <div class="stat-row"><span>🔔 Push Notifications:</span><label class="toggle-switch"><input type="checkbox" id="notifEnabled" ${userNotificationSettings.enabled !== false ? 'checked' : ''}><span class="toggle-slider"></span></label></div>
                <div class="stat-row"><span>🏆 Achievements:</span><label class="toggle-switch"><input type="checkbox" id="notifAchievements" ${userNotificationSettings.achievements !== false ? 'checked' : ''}><span class="toggle-slider"></span></label></div>
                <div class="stat-row"><span>🤝 Referral Earnings:</span><label class="toggle-switch"><input type="checkbox" id="notifReferrals" ${userNotificationSettings.referralEarnings !== false ? 'checked' : ''}><span class="toggle-slider"></span></label></div>
                <div class="stat-row"><span>🎁 Daily Bonus:</span><label class="toggle-switch"><input type="checkbox" id="notifDaily" ${userNotificationSettings.dailyBonus !== false ? 'checked' : ''}><span class="toggle-slider"></span></label></div>
                <div class="stat-row"><span>📢 Campaign Alerts:</span><label class="toggle-switch"><input type="checkbox" id="notifCampaigns" ${userNotificationSettings.campaignAlerts !== false ? 'checked' : ''}><span class="toggle-slider"></span></label></div>
            </div>
            <div class="card"><h2>📈 Performance (24h)</h2><div class="graph-container"><canvas id="performanceChart"></canvas></div></div>
            <div class="card"><div class="referral-code-box" id="refCodeBox">${userData?.referralCode}</div><button class="btn-primary" id="copyCodeBtn">Copy Code</button></div>
            <button class="btn-secondary" id="signOutBtn">Sign Out</button>
        `;
        
        if (!document.getElementById('toggleStyles')) {
            const style = document.createElement('style');
            style.id = 'toggleStyles';
            style.textContent = `
                .toggle-switch { position: relative; display: inline-block; width: 50px; height: 24px; }
                .toggle-switch input { opacity: 0; width: 0; height: 0; }
                .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 24px; }
                .toggle-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
                input:checked + .toggle-slider { background-color: #10b981; }
                input:checked + .toggle-slider:before { transform: translateX(26px); }
            `;
            document.head.appendChild(style);
        }
        
        document.getElementById('notifEnabled')?.addEventListener('change', (e) => { userNotificationSettings.enabled = e.target.checked; saveUserData(); });
        document.getElementById('notifAchievements')?.addEventListener('change', (e) => { userNotificationSettings.achievements = e.target.checked; saveUserData(); });
        document.getElementById('notifReferrals')?.addEventListener('change', (e) => { userNotificationSettings.referralEarnings = e.target.checked; saveUserData(); });
        document.getElementById('notifDaily')?.addEventListener('change', (e) => { userNotificationSettings.dailyBonus = e.target.checked; saveUserData(); });
        document.getElementById('notifCampaigns')?.addEventListener('change', (e) => { userNotificationSettings.campaignAlerts = e.target.checked; saveUserData(); });
        
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
window.adminSetCredits = adminSetCredits;
window.adminRemoveCredits = adminRemoveCredits;
window.adminRemoveReferral = adminRemoveReferral;
window.adminSetReferral = adminSetReferral;
window.adminResetUser = adminResetUser;
window.adminDeleteUser = adminDeleteUser;
window.adminToggleNotifications = adminToggleNotifications;
window.adminDisableAllNotifications = adminDisableAllNotifications;
window.aiFixEverything = aiFixEverything;

document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => {
    if (currentPage !== btn.dataset.page) {
        // Only pause video, never destroy the player
        if (youtubePlayer) {
            youtubePlayer.pauseVideo();
        }
        if (activeWatchData) {
            activeWatchData.isPaused = true;
        }
        addAdminLog(`Switched to ${btn.dataset.page} tab - video paused`, "info");
    }
    currentPage = btn.dataset.page;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCurrentPage();
    if (currentPage === 'home' && activeWatchData && activeWatchData.isPaused && !activeWatchData.completed && isTabVisible) {
        setTimeout(() => {
            if (youtubePlayer && activeWatchData.isPaused) {
                youtubePlayer.playVideo();
                activeWatchData.isPaused = false;
                addAdminLog(`Returned to Home tab - video resumed`, "info");
            }
        }, 200);
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
        
        addAdminLog(`User logged in: ${user.email}`, "success");
    } else {
        document.body.classList.remove('authenticated');
        if (unsubscribeCampaigns) unsubscribeCampaigns();
        if (unsubscribeReferralEarnings) unsubscribeReferralEarnings();
        if (activeWatchData) stopCurrentWatch();
        currentUser = null;
        isAdmin = false;
        addAdminLog(`User logged out`, "info");
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
