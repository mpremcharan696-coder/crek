import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AutomationSetup from './AutomationSetup';
import {
  fetchCurrentUser,
  fetchReels,
  fetchComments,
  fetchReelDetail,
  updateUserSettings,
  triggerReelSync,
  analyzeReel,
  generateAiReply,
  approveReply,
  rejectReply,
  getAuthToken,
} from './api';

// Custom SVG Icons (to replace emojis with premium visuals)
const IconDashboard = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
  </svg>
);

const IconInbox = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-3.586 3.586a2 2 0 01-2.828 0L6 13m12 2a2 2 0 01-2 2H8a2 2 0 01-2-2" />
  </svg>
);

const IconAutomations = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const IconSettings = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconSignOut = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const IconGlobe = () => (
  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

const IconSync = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
  </svg>
);

export default function Dashboard({ user, onSignOut }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState(null); // null | 'ai-reply'
  const [inboxSubFilter, setInboxSubFilter] = useState('pending'); // 'pending' | 'posted'


  // Real Backend State
  const [apiUser, setApiUser] = useState(null);
  const [apiReels, setApiReels] = useState([]);
  const [apiComments, setApiComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Selected Reel for AI Summary Drawer Modal
  const [selectedReel, setSelectedReel] = useState(null);
  const [fetchingReelDetail, setFetchingReelDetail] = useState(false);

  // Comment-to-DM Rules
  const [dmRules, setDmRules] = useState([]);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [newDmMessageInput, setNewDmMessageInput] = useState('');

  // Inline Draft Editing state (Stores drafts modified by user)
  const [editedReplies, setEditedReplies] = useState({});

  // Load Real Data from Backend
  const loadDashboardData = async () => {
    try {
      if (!getAuthToken()) {
        setLoading(false);
        return; // User needs Meta link
      }

      const [u, r, c] = await Promise.allSettled([
        fetchCurrentUser(),
        fetchReels(),
        fetchComments(),
      ]);

      if (u.status === 'fulfilled') setApiUser(u.value);
      if (r.status === 'fulfilled') setApiReels(r.value);
      if (c.status === 'fulfilled') setApiComments(c.value);

    } catch (err) {
      console.warn('Backend load warning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const showNotification = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  // Connection check
  const isInstagramConnected = Boolean(apiUser && apiUser.instagram_user_id);

  // Sync Reels from Meta API
  const handleSyncReels = async () => {
    if (!isInstagramConnected) {
      showNotification('Error: Connect your Instagram account first');
      return;
    }

    setSyncing(true);
    try {
      await triggerReelSync();
      showNotification('Success: Reel sync request dispatched');
      setTimeout(async () => {
        const updated = await fetchReels();
        setApiReels(updated);
      }, 1500);
    } catch (err) {
      showNotification(`Error: ${err.message || 'Sync request failed'}`);
    } finally {
      setSyncing(false);
    }
  };

  // Connect via Real Meta OAuth
  const handleConnectInstagram = () => {
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1').replace('/api/v1', '');
    window.location.href = `${baseUrl}/api/v1/auth/login`;
  };

  // Trigger Reel Analysis (Gemini 2.5 Flash + Grok)
  const handleAnalyzeReel = async (e, reelId) => {
    e.stopPropagation();
    try {
      await analyzeReel(reelId);
      showNotification('Success: AI analysis enqueued');
      setTimeout(loadDashboardData, 1000);
    } catch (err) {
      showNotification(`Error: ${err.message || 'Analysis request failed'}`);
    }
  };

  // Fetch full details (including summary) and open drawer
  const handleOpenReelDetail = async (reelId) => {
    setFetchingReelDetail(true);
    try {
      const detail = await fetchReelDetail(reelId);
      setSelectedReel(detail);
    } catch (err) {
      showNotification(`Error: ${err.message || 'Failed to load details'}`);
    } finally {
      setFetchingReelDetail(false);
    }
  };

  // Approve AI Reply (handles customized/edited draft replies)
  const handleApproveReply = async (commentId) => {
    const comment = apiComments.find((c) => c.id === commentId);
    const originalText = comment?.replies?.[0]?.reply_text || '';
    const textToSend = editedReplies[commentId] !== undefined ? editedReplies[commentId] : originalText;

    try {
      await approveReply(commentId, textToSend);
      showNotification('Success: Reply approved and posted to Instagram');
      
      // Update local state is_processed to immediately remove it from Pending Queue list
      setApiComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, is_processed: true } : c))
      );
      
      // Refresh list to update DB sync states
      setTimeout(loadDashboardData, 1000);
    } catch (err) {
      showNotification(`Error: ${err.message || 'Failed to post reply'}`);
    }
  };

  // Reject AI Reply
  const handleRejectReply = async (commentId) => {
    try {
      await rejectReply(commentId);
      showNotification('Success: Reply draft rejected');
      
      // Keep in list but marked as processed or remove from local inbox
      setApiComments((prev) => prev.filter((c) => c.id !== commentId));
      setTimeout(loadDashboardData, 1000);
    } catch (err) {
      showNotification(`Error: ${err.message || 'Failed to reject reply'}`);
    }
  };

  // Generate AI Reply
  const handleGenerateReply = async (commentId) => {
    try {
      await generateAiReply(commentId);
      showNotification('Success: AI Reply draft generated');
      loadDashboardData();
    } catch (err) {
      showNotification(`Error: ${err.message || 'AI reply generation failed'}`);
    }
  };

  // Add Comment-to-DM Rule
  const handleAddDmRule = (e) => {
    e.preventDefault();
    if (!newKeywordInput.trim()) return;

    const newRule = {
      id: Date.now(),
      keyword: newKeywordInput.toUpperCase().trim(),
      message: newDmMessageInput.trim() || 'Details sent: https://pilotly.ai',
      dmsSent: 0,
      status: true,
    };

    setDmRules([newRule, ...dmRules]);
    setNewKeywordInput('');
    setNewDmMessageInput('');
    showNotification(`Success: Keyword rule ${newRule.keyword} created`);
  };

  const toggleDmRule = (id) => {
    setDmRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: !r.status } : r))
    );
  };

  const toggleAutoReplySetting = async () => {
    if (!apiUser) return;
    const nextVal = !apiUser.auto_reply_enabled;
    try {
      const updated = await updateUserSettings({
        auto_reply_enabled: nextVal,
        reply_tone: apiUser.reply_tone || 'friendly',
        reply_style: apiUser.reply_style || 'casual',
      });
      setApiUser(updated);
      showNotification(`Success: Auto-Reply turned ${nextVal ? 'ON' : 'OFF'}`);
    } catch (err) {
      showNotification(`Error: ${err.message || 'Failed to update settings'}`);
    }
  };

  const handleUpdateTone = async (newTone) => {
    if (!apiUser) return;
    try {
      const updated = await updateUserSettings({
        auto_reply_enabled: apiUser.auto_reply_enabled,
        reply_tone: newTone,
        reply_style: apiUser.reply_style || 'casual',
      });
      setApiUser(updated);
      showNotification(`Success: Tone set to ${newTone}`);
    } catch (err) {
      showNotification(`Error: ${err.message || 'Failed to update tone'}`);
    }
  };

  // Filtered comments for Approval Queue
  const filteredComments = apiComments.filter((comment) => {
    if (inboxSubFilter === 'pending') {
      return !comment.is_processed;
    } else {
      return comment.is_processed;
    }
  });

  const automations = [
    {
      id: 'ai-reply',
      name: 'AI Auto-Replies',
      desc: 'Automatically reply to all incoming comments using Gemini and Grok contextual search without approval queue.',
      active: apiUser?.auto_reply_enabled || false,
    },
    {
      id: 'auto-dm',
      name: 'Auto-DM Keyword Rule',
      desc: 'Send private direct messages automatically to users using targeted keywords in their comment.',
      active: dmRules.some((r) => r.status),
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center text-slate-400 font-bold text-xs uppercase tracking-widest gap-4">
        <IconSync />
        <span className="animate-pulse">Loading Engine Dashboard</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col md:flex-row antialiased">
      {/* Toast Notification */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border font-bold text-xs flex items-center gap-3 ${
              actionMessage.toLowerCase().startsWith('error')
                ? 'bg-red-950/80 border-red-500/30 text-red-200'
                : 'bg-[#0F172A] border-purple-500/20 text-purple-200 shadow-purple-500/5'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${actionMessage.toLowerCase().startsWith('error') ? 'bg-red-500' : 'bg-purple-500'}`} />
            <span>{actionMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 bg-[#090D1A] border-b md:border-b-0 md:border-r border-slate-800/60 p-5 flex flex-col justify-between flex-shrink-0 z-30">
        <div className="space-y-8">
          <div className="flex items-center justify-between px-2">
            <span className="font-black text-xl tracking-tight text-white flex items-center gap-1.5">
              Pilotly<span className="text-purple-500">.ai</span>
            </span>
            <span
              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1.5 border ${
                isInstagramConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
              }`}
            >
              <span className={`w-1 h-1 rounded-full ${isInstagramConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {isInstagramConnected ? 'Linked' : 'Not Linked'}
            </span>
          </div>

          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/10 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <IconDashboard />
              <span>Dashboard & Feed</span>
            </button>

            <button
              onClick={() => setActiveTab('my-automations')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'my-automations'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/10 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <IconAutomations />
              <span>My Automations</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'settings'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/10 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <IconSettings />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Profile Card */}
        <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <img
              src={apiUser?.profile_picture_url || user?.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
              alt="Profile"
              className="w-9 h-9 rounded-full border border-purple-500/20 object-cover"
            />
            <div className="text-left overflow-hidden">
              <div className="text-xs font-bold text-white truncate max-w-[110px]">
                {apiUser?.username ? `@${apiUser.username}` : 'Creator Account'}
              </div>
              <div className="text-[10px] text-slate-500 truncate max-w-[110px]">{user?.email || 'creator@gmail.com'}</div>
            </div>
          </div>
          <button onClick={onSignOut} className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-lg">
            <IconSignOut />
          </button>
        </div>
      </aside>

      {/* MAIN DISPLAY CONTENT AREA */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-6xl mx-auto w-full space-y-6">

        {/* ACCOUNT NOT CONNECTED ALERT BANNER */}
        {!isInstagramConnected && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                Action Required: Instagram Business Account Not Linked
              </h3>
              <p className="text-xs text-slate-400">
                To fetch Reels and trigger intelligent replies, authenticate via Meta OAuth.
              </p>
            </div>
            <button
              onClick={handleConnectInstagram}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all flex-shrink-0"
            >
              Connect Instagram via Meta
            </button>
          </div>
        )}

        {/* TAB 1: DASHBOARD & REELS FEED */}
        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Claude / AI-Style Warm Greeting */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>
                    {(() => {
                      const hour = new Date().getHours();
                      if (hour < 12) return 'Good morning';
                      if (hour < 18) return 'Good afternoon';
                      return 'Good evening';
                    })()}, {apiUser?.full_name?.split(' ')[0] || (apiUser?.username ? `@${apiUser.username}` : 'Creator')}
                  </span>
                  <span className="inline-block animate-bounce">👋</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Here is your live Instagram profile overview, content feed, and AI engagement automation status.
                </p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
                  📅 {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Instagram Profile Card Header */}
            <div className="bg-gradient-to-r from-[#0F172A] via-[#1E1B4B]/40 to-[#0F172A] rounded-2xl p-6 border border-slate-800/80 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-amber-500 p-0.5 shadow-lg shrink-0">
                    <img
                      src={apiUser?.profile_picture_url || user?.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                      alt="Profile"
                      className="w-full h-full rounded-full object-cover border-2 border-[#0F172A]"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl font-black text-white">
                        {apiUser?.full_name || (apiUser?.username ? `@${apiUser.username}` : 'Instagram Profile')}
                      </h1>
                      {apiUser?.username && (
                        <span className="text-xs text-slate-400 font-normal">@{apiUser.username}</span>
                      )}
                      {isInstagramConnected && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                          ● Connected
                        </span>
                      )}
                    </div>

                    {/* Account Bio */}
                    {apiUser?.biography ? (
                      <p className="text-xs text-slate-200 max-w-xl leading-relaxed bg-slate-950/80 px-3.5 py-2 rounded-xl border border-purple-500/20 font-medium">
                        📝 <span className="text-slate-300 ml-1">{apiUser.biography}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No biography listed on Instagram profile</p>
                    )}
                  </div>
                </div>


                <button
                  onClick={handleSyncReels}
                  disabled={syncing}
                  className={`px-4 py-2.5 font-bold text-xs rounded-xl border transition-all flex items-center gap-2 shrink-0 ${
                    isInstagramConnected
                      ? 'bg-purple-600 hover:bg-purple-500 border-purple-500/20 text-white shadow-lg'
                      : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {syncing ? <IconSync /> : null}
                  <span>{syncing ? 'Syncing reels' : 'Sync reels from Meta'}</span>
                </button>
              </div>

              {/* Followers, Following & Posts Stats Bar */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/60">
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/60 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Posts / Reels</div>
                  <div className="text-lg font-black text-white">{apiUser?.media_count ?? apiReels.length}</div>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/60 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Followers</div>
                  <div className="text-lg font-black text-purple-300">{apiUser?.followers_count ?? 0}</div>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/60 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Following</div>
                  <div className="text-lg font-black text-slate-300">{apiUser?.follows_count ?? 0}</div>
                </div>
              </div>
            </div>


            {/* Reels Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  Profile Reels Feed
                </h2>
                <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-md">
                  Gemini multimodal analysis
                </span>
              </div>

              {apiReels.length === 0 ? (
                <div className="bg-[#090D1A] border border-slate-800/80 rounded-2xl p-12 text-center text-slate-500 space-y-4">
                  <p className="text-xs">No reels found in data store.</p>
                  <button
                    onClick={handleSyncReels}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl"
                  >
                    Sync Reels
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {apiReels.map((reel) => (
                    <div
                      key={reel.id || reel.media_id}
                      className="bg-[#090D1A] rounded-2xl border border-slate-800/80 hover:border-purple-500/20 overflow-hidden shadow-lg transition-all group"
                    >
                      <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden">
                        <img
                          src={reel.thumbnail_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80'}
                          alt="Thumbnail"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                        <span className={`absolute top-3 left-3 bg-[#030712]/80 backdrop-blur-md border text-[9px] font-bold px-2 py-0.5 rounded-md ${
                          reel.is_analyzed
                            ? reel.summary?.analysis_model === 'failed'
                              ? 'text-red-400 border-red-500/20'
                              : 'text-purple-400 border-purple-500/20'
                            : 'text-amber-400 border-amber-500/20 animate-pulse'
                        }`}>
                          {reel.is_analyzed
                            ? reel.summary?.analysis_model === 'failed'
                              ? 'Analysis Failed'
                              : 'Analyzed'
                            : 'Sync Pending'}
                        </span>
                        
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-slate-300 font-bold bg-slate-950/60 backdrop-blur-sm py-1 px-2.5 rounded-lg">
                          <span>Likes: {reel.like_count || 0}</span>
                          <span>Comments: {reel.comments_count || 0}</span>
                        </div>
                      </div>

                      <div className="p-4 space-y-4">
                        <p className="text-xs font-semibold text-slate-300 line-clamp-2 min-h-[2rem] leading-relaxed">
                          {reel.caption || 'No caption provided'}
                        </p>
                        
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                          <button
                            onClick={() => handleOpenReelDetail(reel.id)}
                            disabled={fetchingReelDetail}
                            className="text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            {fetchingReelDetail ? 'Loading summary' : 'View AI summary'}
                          </button>

                          <button
                            onClick={(e) => handleAnalyzeReel(e, reel.id)}
                            className="text-[10px] font-bold bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/20 px-3 py-1 rounded-lg transition-all"
                          >
                            Analyze
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 2: MY AUTOMATIONS */}
        {activeTab === 'my-automations' && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {selectedAutomation === 'ai-reply' ? (
              <div className="space-y-6">
                {/* Back button & top bar */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSelectedAutomation(null)}
                    className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Back to My Automations</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full border ${
                      apiUser?.auto_reply_enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {apiUser?.auto_reply_enabled ? '● Active' : '○ Paused'}
                    </span>
                    <button
                      onClick={toggleAutoReplySetting}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all"
                    >
                      {apiUser?.auto_reply_enabled ? 'Pause Automation' : 'Enable Automation'}
                    </button>
                  </div>
                </div>

                {/* Main Header Banner */}
                <div className="bg-[#090D1A] rounded-2xl border border-slate-800/80 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">🤖</span>
                      <h1 className="text-xl font-black text-white">AI Reply for Engagement</h1>
                    </div>
                    <p className="text-xs text-slate-400">
                      Auto-reply to Instagram comments using Gemini reel context + Groq Qwen LLM.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSetupWizard(true)}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0"
                  >
                    <span>✍️</span>
                    <span>Edit Voice & Setup Wizard</span>
                  </button>
                </div>

                {/* SECTION 1: REAL ANALYTICS METRICS (100% Real DB Data) */}
                <div>
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Live Automation Analytics</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#090D1A] rounded-2xl border border-slate-800/80 p-5 space-y-1 shadow-md">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Comments</span>
                      <div className="text-2xl font-black text-white">{apiComments.length}</div>
                      <div className="text-[10px] text-slate-500">Synced via Instagram webhook</div>
                    </div>
                    <div className="bg-[#090D1A] rounded-2xl border border-slate-800/80 p-5 space-y-1 shadow-md">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Awaiting Approval</span>
                      <div className="text-2xl font-black text-amber-300">{apiComments.filter(c => !c.is_processed).length}</div>
                      <div className="text-[10px] text-slate-500">Pending drafts in queue</div>
                    </div>
                    <div className="bg-[#090D1A] rounded-2xl border border-slate-800/80 p-5 space-y-1 shadow-md">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Posted Replies</span>
                      <div className="text-2xl font-black text-emerald-400">{apiComments.filter(c => c.is_processed).length}</div>
                      <div className="text-[10px] text-slate-500">Published to Instagram</div>
                    </div>
                    <div className="bg-[#090D1A] rounded-2xl border border-slate-800/80 p-5 space-y-1 shadow-md">
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Synced Reels</span>
                      <div className="text-2xl font-black text-purple-300">{apiReels.length}</div>
                      <div className="text-[10px] text-slate-500">{apiReels.filter(r => r.is_analyzed).length} AI Analyzed</div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: CONFIGURATION OVERVIEW (All Saved Voice Profile Settings) */}
                <div className="bg-[#090D1A] rounded-2xl border border-slate-800/80 p-6 space-y-6 shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                    <div>
                      <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <span>⚙️</span> Active Voice & Persona Configuration
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Settings currently used by Qwen AI when generating replies for @{apiUser?.username || 'your account'}.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowSetupWizard(true)}
                      className="text-xs text-purple-400 hover:text-purple-300 font-bold transition-colors flex items-center gap-1"
                    >
                      <span>Edit Configuration</span>
                      <span>→</span>
                    </button>
                  </div>

                  {(() => {
                    let styleObj = {};
                    try { styleObj = JSON.parse(apiUser?.reply_style || '{}'); } catch(e) {}
                    
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                        {/* Identity & Niche */}
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">1. Identity & Niche</div>
                          <div><span className="text-slate-500">Business Name:</span> <span className="font-bold text-white ml-1">{styleObj.business_name || apiUser?.full_name || apiUser?.username || 'N/A'}</span></div>
                          <div><span className="text-slate-500">Industry:</span> <span className="font-bold text-slate-200 ml-1">{styleObj.industry || 'General Content Creator'}</span></div>
                          <div>
                            <span className="text-slate-500 block">Target Audience:</span>
                            <p className="text-slate-300 mt-1 leading-relaxed">{styleObj.audience || 'Not specified'}</p>
                          </div>
                        </div>

                        {/* Voice & Tone */}
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">2. Voice & Persona</div>
                          <div><span className="text-slate-500">Persona:</span> <span className="font-bold text-white capitalize ml-1">{styleObj.persona || 'Founder'}</span></div>
                          <div><span className="text-slate-500">Formality Level:</span> <span className="font-bold text-slate-200 ml-1">{styleObj.formality || 3} / 5</span></div>
                          <div>
                            <span className="text-slate-500 block">Tone Description:</span>
                            <p className="text-slate-300 mt-1 leading-relaxed">{styleObj.tone_description || 'Friendly, engaging, and clear.'}</p>
                          </div>
                          {styleObj.signature_phrases?.length > 0 && (
                            <div className="pt-1">
                              <span className="text-slate-500 block mb-1">Signature Phrases:</span>
                              <div className="flex flex-wrap gap-1">
                                {styleObj.signature_phrases.map((phrase, i) => (
                                  <span key={i} className="bg-purple-950/60 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded text-[10px]">{phrase}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Knowledge Base */}
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-2 md:col-span-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">3. Knowledge Base & FAQs</div>
                          <p className="text-slate-300 leading-relaxed whitespace-pre-line">{styleObj.knowledge || 'No custom knowledge base configured.'}</p>
                        </div>

                        {/* Safety & Guardrails */}
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-3 md:col-span-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">4. Safety & Guardrails</div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <span className="text-slate-500 block mb-1 text-[10px]">Avoid Words:</span>
                              {styleObj.avoid_words?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {styleObj.avoid_words.map((w, i) => (
                                    <span key={i} className="bg-red-950/40 text-red-300 border border-red-500/20 px-2 py-0.5 rounded text-[10px]">{w}</span>
                                  ))}
                                </div>
                              ) : <span className="text-slate-600">None</span>}
                            </div>

                            <div>
                              <span className="text-slate-500 block mb-1 text-[10px]">Skip Public Topics:</span>
                              {styleObj.avoid_topics?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {styleObj.avoid_topics.map((t, i) => (
                                    <span key={i} className="bg-amber-950/40 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded text-[10px]">{t}</span>
                                  ))}
                                </div>
                              ) : <span className="text-slate-600">None</span>}
                            </div>

                            <div>
                              <span className="text-slate-500 block mb-1 text-[10px]">Redirect to DM:</span>
                              {styleObj.dm_topics?.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {styleObj.dm_topics.map((d, i) => (
                                    <span key={i} className="bg-blue-950/40 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded text-[10px]">{d}</span>
                                  ))}
                                </div>
                              ) : <span className="text-slate-600">None</span>}
                            </div>
                          </div>
                        </div>

                        {/* Automation Options */}
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-2 md:col-span-2 flex flex-wrap items-center justify-between gap-4 text-[11px]">
                          <div>
                            <span className="text-slate-500">Reply Mode:</span>
                            <span className="font-bold text-purple-300 ml-1.5 uppercase tracking-wider">{styleObj.reply_mode || 'Draft'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Auto-Analyze Reels:</span>
                            <span className="font-bold text-emerald-400 ml-1.5">{styleObj.auto_analyze_reels !== false ? 'Enabled' : 'Disabled'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Real-Time Web Search:</span>
                            <span className="font-bold text-emerald-400 ml-1.5">{styleObj.use_realtime_data !== false ? 'Enabled' : 'Disabled'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* SECTION 3: LIVE COMMENT STREAM & APPROVAL QUEUE */}
                <div className="bg-[#090D1A] rounded-2xl border border-slate-800/80 p-6 space-y-4 shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                    <div>
                      <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <span>📥</span> Live Comment & Approval Stream
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">Review, edit, and post AI responses directly to Instagram.</p>
                    </div>

                    <div className="bg-slate-950 p-0.5 rounded-xl border border-slate-800 flex items-center">
                      <button
                        onClick={() => setInboxSubFilter('pending')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          inboxSubFilter === 'pending'
                            ? 'bg-purple-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Pending Queue ({apiComments.filter(c => !c.is_processed).length})
                      </button>
                      <button
                        onClick={() => setInboxSubFilter('posted')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          inboxSubFilter === 'posted'
                            ? 'bg-purple-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Posted History ({apiComments.filter(c => c.is_processed).length})
                      </button>
                    </div>
                  </div>

                  {/* Render Comments */}
                  {(() => {
                    const filtered = apiComments.filter(c => inboxSubFilter === 'pending' ? !c.is_processed : c.is_processed);
                    if (filtered.length === 0) {
                      return (
                        <div className="py-12 text-center text-xs text-slate-500">
                          No {inboxSubFilter === 'pending' ? 'pending comments waiting for approval' : 'posted comments history yet'}.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {filtered.map((comment) => (
                          <div key={comment.id} className="bg-slate-950 rounded-xl border border-slate-800/80 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs">@{comment.commenter_username || 'user'}</span>
                                <span className="text-[10px] text-slate-500">{new Date(comment.created_at).toLocaleString()}</span>
                              </div>
                              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                                comment.is_processed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300'
                              }`}>
                                {comment.is_processed ? 'Posted' : 'Pending Review'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800/40">
                              "{comment.text}"
                            </p>

                            {/* AI Reply Block */}
                            {comment.replies && comment.replies.length > 0 && (
                              <div className="space-y-2 pt-1">
                                <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center justify-between">
                                  <span>Generated AI Response:</span>
                                  {comment.replies[0].used_web_search && (
                                    <span className="text-emerald-400 flex items-center gap-1">🌐 Real-time Web Verified</span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-200 bg-purple-950/20 p-3 rounded-lg border border-purple-500/20">
                                  {comment.replies[0].reply_text}
                                </div>

                                {!comment.is_processed && (
                                  <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                      onClick={() => handleRejectReply(comment.id)}
                                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                                    >
                                      Discard
                                    </button>
                                    <button
                                      onClick={() => handleApproveReply(comment.id)}
                                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition-all"
                                    >
                                      Post to Instagram ✓
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {!comment.replies?.length && !comment.is_processed && (
                              <div className="pt-1 flex justify-end">
                                <button
                                  onClick={() => handleGenerateReply(comment.id)}
                                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-all"
                                >
                                  ✨ Generate AI Reply
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* AUTOMATION LIST CARDS VIEW */
              <div className="space-y-6">
                <div className="border-b border-slate-800/60 pb-3">
                  <h1 className="text-lg font-black text-white uppercase tracking-wider">My Automations</h1>
                  <p className="text-xs text-slate-400 mt-0.5">Click any automation to view settings, analytics, and pending approval queue.</p>
                </div>

                {/* AI Reply Automation Card */}
                <div
                  onClick={() => setSelectedAutomation('ai-reply')}
                  className="bg-[#090D1A] rounded-2xl border border-slate-800/80 p-6 cursor-pointer hover:border-purple-500/40 transition-all group shadow-md"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">AI Reply for Engagement</h3>
                        <p className="text-[11px] text-slate-400">Auto-reply to comments with AI-powered contextual responses</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                      apiUser?.auto_reply_enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {apiUser?.auto_reply_enabled ? 'Active' : 'Setup Required'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <span>🧠 Gemini + Groq</span>
                    <span>🌐 Real-time data</span>
                    <span>⚡ Auto or Draft mode</span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      {apiComments.length} Comments • {apiComments.filter(c => !c.is_processed).length} Pending Review
                    </span>
                    <span className="text-purple-400 font-semibold group-hover:text-purple-300 transition-colors flex items-center gap-1">
                      <span>View Details & Settings</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>

                {/* Coming Soon Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#090D1A] rounded-2xl border border-slate-800/40 p-5 opacity-50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                        <span className="text-sm">💬</span>
                      </div>
                      <h3 className="text-xs font-bold text-slate-500">Comment-to-DM</h3>
                    </div>
                    <p className="text-[10px] text-slate-600">Auto-send DMs when users comment specific keywords.</p>
                    <span className="text-[9px] text-slate-600 font-bold uppercase mt-2 inline-block">Coming Soon</span>
                  </div>
                  <div className="bg-[#090D1A] rounded-2xl border border-slate-800/40 p-5 opacity-50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                        <span className="text-sm">📸</span>
                      </div>
                      <h3 className="text-xs font-bold text-slate-500">Story Mention Reply</h3>
                    </div>
                    <p className="text-[10px] text-slate-600">Auto-thank users who mention you in their stories.</p>
                    <span className="text-[9px] text-slate-600 font-bold uppercase mt-2 inline-block">Coming Soon</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}



        {/* TAB 4: SETTINGS & META GRAPH API */}
        {activeTab === 'settings' && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="border-b border-slate-800/60 pb-3">
              <h1 className="text-lg font-black text-white uppercase tracking-wider">Settings & Meta Credentials</h1>
            </div>

            <div className="bg-[#090D1A] rounded-2xl border border-slate-800/80 p-5 space-y-6 shadow-md">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Instagram Business Integration</h3>
                <p className="text-xs text-slate-400 mt-0.5">Meta Graph API access configuration</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Linked Account</span>
                  <span className="text-xs font-bold text-purple-400">
                    {apiUser?.username ? `@${apiUser.username}` : 'Not Connected'}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-900 pt-3">
                  <span className="text-xs font-semibold text-slate-400">AI Reply Tone</span>
                  <select
                    value={apiUser?.reply_tone || 'friendly'}
                    onChange={(e) => handleUpdateTone(e.target.value)}
                    className="bg-slate-900 text-xs border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-purple-500/20"
                  >
                    <option value="friendly">Friendly & Casual</option>
                    <option value="professional">Professional</option>
                    <option value="hype">Hype & Energetic</option>
                    <option value="witty">Witty / Sarcastic</option>
                  </select>
                </div>

                <div className="flex items-center justify-between border-t border-slate-900 pt-3">
                  <span className="text-xs font-semibold text-slate-400">Auto-Reply Comments</span>
                  <button
                    onClick={toggleAutoReplySetting}
                    className={`w-9 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                      apiUser?.auto_reply_enabled
                        ? 'bg-purple-600 justify-end'
                        : 'bg-slate-800 justify-start'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-md bg-white shadow-md" />
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-slate-900 pt-3">
                  <span className="text-xs font-semibold text-slate-400">Connection Handshake</span>
                  {isInstagramConnected ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                      Handshake Active
                    </span>
                  ) : (
                    <button
                      onClick={handleConnectInstagram}
                      className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all"
                    >
                      Connect Instagram
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* REEL SUMMARY DRAWER MODAL */}
      <AnimatePresence>
        {selectedReel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedReel(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#090D1A] border border-slate-800/80 rounded-2xl p-6 sm:p-7 max-w-xl w-full text-white space-y-5 shadow-2xl relative"
            >
              <button
                onClick={() => setSelectedReel(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                <span>Gemini Analysis Summary</span>
              </div>

              <h2 className="text-base font-black text-white">{selectedReel.caption || 'No caption'}</h2>

              <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                {selectedReel.summary ? (
                  <>
                    {/* Error block if summary failed */}
                    {selectedReel.summary.analysis_model === 'failed' && (
                      <div className="bg-red-950/40 border border-red-500/20 p-4 rounded-xl text-xs text-red-200 leading-relaxed">
                        Error: Summary generation failed. Details: {selectedReel.summary.ai_summary?.error || 'Unknown pipeline failure.'}
                      </div>
                    )}

                    {selectedReel.summary.analysis_model !== 'failed' && (
                      <>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                          <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Main Topic</div>
                          <div className="text-xs font-bold text-purple-300 mt-1">
                            {selectedReel.summary.ai_summary?.topic || 'Not extracted'}
                          </div>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                          <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Key Points</div>
                          <ul className="list-decimal list-inside text-xs text-slate-300 mt-1.5 space-y-1.5 leading-relaxed">
                            {selectedReel.summary.key_points && selectedReel.summary.key_points.length > 0 ? (
                              selectedReel.summary.key_points.map((pt, idx) => <li key={idx}>{pt}</li>)
                            ) : (
                              <li>No key takeaways extracted.</li>
                            )}
                          </ul>
                        </div>

                        {selectedReel.summary.faq && selectedReel.summary.faq.length > 0 && (
                          <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-3">
                            <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Anticipated FAQs</div>
                            <div className="space-y-3.5">
                              {selectedReel.summary.faq.map((item, idx) => (
                                <div key={idx} className="text-xs border-l-2 border-purple-500/20 pl-3 leading-relaxed">
                                  <p className="font-bold text-purple-200">Question: {item.question || item.q}</p>
                                  <p className="text-slate-400 mt-1">Answer: {item.answer || item.a}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedReel.summary.ai_summary?.realtime_context && (
                          <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                            <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                              <IconGlobe /> Real-time search context
                            </div>
                            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed whitespace-pre-wrap">
                              {selectedReel.summary.ai_summary.realtime_context}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-slate-500 text-center py-6">
                    Reel analysis pending. Click Analyze Reel to generate.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AUTOMATION SETUP WIZARD OVERLAY */}
      <AnimatePresence>
        {showSetupWizard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60]"
          >
            <AutomationSetup
              apiUser={apiUser}
              onComplete={() => {
                setShowSetupWizard(false);
                loadDashboardData();
              }}
              onConnect={handleConnectInstagram}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
