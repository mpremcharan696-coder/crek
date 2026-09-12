import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toggle, Select, Accordion, SettingRow, TextInput, useTheme } from './components/ui';
import AutomationSetup from './AutomationSetup';
import CommentDMSetup from './CommentDMSetup';
import InstagramCommentPreview from './InstagramCommentPreview';
import ReelAutomationCustomizer from './ReelAutomationCustomizer';
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
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--accent-light)' }}>
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
  const [selectedAutomation, setSelectedAutomation] = useState(null); // null | 'ai-reply' | 'comment-to-dm'
  const [customizingReelId, setCustomizingReelId] = useState(null); // number | null
  const [inboxSubFilter, setInboxSubFilter] = useState('pending'); // 'pending' | 'posted'
  const [showScopePromptModal, setShowScopePromptModal] = useState(false);

  // Sync state from current URL hash (enables native browser back/forward buttons)
  const syncStateFromHash = () => {
    const hash = window.location.hash || '#/dashboard';
    if (hash.startsWith('#/setup-wizard')) {
      setShowSetupWizard(true);
      setCustomizingReelId(null);
    } else if (hash.startsWith('#/reel/') && hash.includes('/custom-automation')) {
      setShowSetupWizard(false);
      const match = hash.match(/#\/reel\/(\d+)\/custom-automation/);
      if (match) {
        setCustomizingReelId(parseInt(match[1]));
      }
      setSelectedAutomation(null);
    } else if (hash.startsWith('#/automations/comment-to-dm') || hash.startsWith('#/my-automations/comment-to-dm')) {
      setShowSetupWizard(false);
      setCustomizingReelId(null);
      setActiveTab('my-automations');
      setSelectedAutomation('comment-to-dm');
    } else if (hash.startsWith('#/automations/ai-reply') || hash.startsWith('#/my-automations/ai-reply')) {
      setShowSetupWizard(false);
      setCustomizingReelId(null);
      setActiveTab('my-automations');
      setSelectedAutomation('ai-reply');
    } else if (hash.startsWith('#/automations') || hash.startsWith('#/my-automations')) {
      setShowSetupWizard(false);
      setCustomizingReelId(null);
      setActiveTab('my-automations');
      setSelectedAutomation(null);
    } else if (hash.startsWith('#/settings')) {
      setShowSetupWizard(false);
      setCustomizingReelId(null);
      setActiveTab('settings');
      setSelectedAutomation(null);
    } else {
      setShowSetupWizard(false);
      setCustomizingReelId(null);
      setActiveTab('dashboard');
      setSelectedAutomation(null);
    }
  };

  // Helper to change view and push history state
  const navigateTo = (newHash) => {
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
    syncStateFromHash();
  };

  // Listen for browser Back / Forward arrow clicks
  useEffect(() => {
    syncStateFromHash();
    const handlePopState = () => {
      syncStateFromHash();
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

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

  // Theme (light / dark) — CSS variables handle the rest
  const [theme, setTheme] = useTheme();

  // Comment-to-DM Rules
  const [dmRules, setDmRules] = useState([]);
  const [dmAutomationEnabled, setDmAutomationEnabled] = useState(false);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [newDmMessageInput, setNewDmMessageInput] = useState('');

  // Inline Draft Editing state (Stores drafts modified by user)
  const [editedReplies, setEditedReplies] = useState({});
  const [analyzingReels, setAnalyzingReels] = useState({});

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
      showNotification('Success: Reels synced successfully');
      const updated = await fetchReels();
      setApiReels(updated);
      await loadDashboardData();
    } catch (err) {
      showNotification(`Error: ${err.message || 'Sync request failed'}`);
    } finally {
      setSyncing(false);
    }
  };

  // Connect via Real Meta OAuth (Basic Scope)
  const handleConnectInstagram = () => {
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1').replace('/api/v1', '');
    window.location.href = `${baseUrl}/api/v1/auth/login?scope_type=basic`;
  };

  // Re-connect with Advanced Scopes for Comment Automation
  const handleConnectAdvancedInstagram = () => {
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1').replace('/api/v1', '');
    window.location.href = `${baseUrl}/api/v1/auth/login?scope_type=advanced`;
  };

  // Trigger Reel Analysis (Gemini 2.5 Flash + Grok)
  const handleAnalyzeReel = async (e, reelId) => {
    e.stopPropagation();
    if (analyzingReels[reelId]) return;

    setAnalyzingReels((prev) => ({ ...prev, [reelId]: true }));
    try {
      await analyzeReel(reelId);
      showNotification('Success: AI analysis completed');
      await loadDashboardData();
    } catch (err) {
      showNotification(`Error: ${err.message || 'Analysis request failed'}`);
    } finally {
      setAnalyzingReels((prev) => ({ ...prev, [reelId]: false }));
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
      
      // Remove from local state immediately (do not wait for refetch)
      setApiComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      showNotification(`Error: ${err.message || 'Failed to post reply'}`);
    }
  };

  // Reject AI Reply
  const handleRejectReply = async (commentId) => {
    try {
      await rejectReply(commentId);
      showNotification('Success: Reply draft rejected');
      
      // Remove from local state immediately
      setApiComments((prev) => prev.filter((c) => c.id !== commentId));
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
    const prevUser = apiUser;
    const nextVal = !apiUser.auto_reply_enabled;
    // Optimistic update: the switch reflects the new state immediately,
    // then reconciles with (or rolls back to) the server response.
    setApiUser({ ...apiUser, auto_reply_enabled: nextVal });
    try {
      const updated = await updateUserSettings({
        auto_reply_enabled: nextVal,
        reply_tone: apiUser.reply_tone || 'friendly',
        reply_style: apiUser.reply_style || 'casual',
      });
      setApiUser((cur) => ({
        ...cur,
        ...(updated || {}),
        auto_reply_enabled: updated?.auto_reply_enabled ?? nextVal,
      }));
      showNotification(`Success: Auto-Reply turned ${nextVal ? 'ON' : 'OFF'}`);
    } catch (err) {
      setApiUser(prevUser);
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

  const handleUpdateVoiceConfig = async (key, value) => {
    if (!apiUser) return;
    const prevUser = apiUser;
    let styleObj = {};
    try { styleObj = JSON.parse(apiUser?.reply_style || '{}'); } catch(e) {}
    styleObj[key] = value;

    const payload = {
      auto_reply_enabled: key === 'auto_reply_enabled' ? value : (apiUser.auto_reply_enabled || false),
      reply_tone: key === 'persona' ? value : (apiUser.reply_tone || 'friendly'),
      reply_style: JSON.stringify(styleObj),
    };
    // Optimistic update so toggles and dropdowns respond instantly
    setApiUser({ ...apiUser, ...payload });
    try {
      const updated = await updateUserSettings(payload);
      setApiUser((cur) => ({ ...cur, ...(updated || {}) }));
      showNotification('Setting updated successfully');
    } catch (err) {
      setApiUser(prevUser);
      showNotification(`Error: ${err.message || 'Failed to update setting'}`);
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        style={{
          background: '#FFFFFF',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
        >
          <span style={{ fontWeight: 700, fontSize: 28, color: '#000000', letterSpacing: '-0.02em' }}>
            Pilotly<span style={{ color: 'var(--accent)' }}>.ai</span>
          </span>
          <div style={{ width: 200, height: 2, borderRadius: 2, background: '#EFEFEF', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
              animation: 'loadingBar 1.8s ease-in-out infinite',
            }} />
          </div>
          <span style={{
            color: 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 400,
          }}>
            Loading your dashboard…
          </span>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
      {/* Toast Notification */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            style={{
              position: 'fixed', top: 16, right: 16, zIndex: 100,
              padding: '12px 16px', borderRadius: 'var(--radius-card)',
              border: `1px solid ${actionMessage.toLowerCase().startsWith('error') ? 'rgba(237,73,86,0.3)' : 'var(--border)'}`,
              background: '#FFFFFF',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 14, fontWeight: 400,
              color: actionMessage.toLowerCase().startsWith('error') ? 'var(--error)' : 'var(--text-primary)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: actionMessage.toLowerCase().startsWith('error') ? 'var(--error)' : 'var(--accent)' }} />
            <span>{actionMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ INSTAGRAM-STYLE LEFT SIDEBAR ═══════════════ */}
      <aside className="ig-sidebar">
        {/* Logo */}
        <div className="ig-sidebar-logo">
          <svg className="ig-sidebar-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="ig-sidebar-logo-text">Pilotly.ai</span>
        </div>

        {/* Nav Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {[
            { id: 'dashboard', label: 'Dashboard', hash: '#/dashboard', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" /></svg> },
            { id: 'my-automations', label: 'Automations', hash: '#/automations', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
            { id: 'settings', label: 'Settings', hash: '#/settings', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => navigateTo(item.hash)}
              className={`ig-nav-item ${activeTab === item.id ? 'ig-nav-item-active' : ''}`}
            >
              {item.icon}
              <span className="ig-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Profile */}
          <button className="ig-nav-item" style={{ cursor: 'default' }}>
            <img
              src={apiUser?.profile_picture_url || user?.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
              alt="Profile"
              style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
            <span className="ig-nav-label" style={{ fontSize: 14 }}>
              {apiUser?.username ? `@${apiUser.username}` : 'Profile'}
            </span>
          </button>
          {/* Sign out */}
          <button onClick={onSignOut} className="ig-nav-item">
            <IconSignOut />
            <span className="ig-nav-label">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ═══════════════ MAIN CONTENT AREA ═══════════════ */}
      <main style={{ marginLeft: 'var(--sidebar-width)', padding: '32px 48px', width: 'calc(100% - var(--sidebar-width))', maxWidth: '100%', boxSizing: 'border-box', transition: 'margin-left 0.3s ease' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)', width: '100%', maxWidth: '100%' }}>

        {/* ═══════════════ REEL SPECIFIC CUSTOM AUTOMATION STUDIO ═══════════════ */}
        {customizingReelId ? (
          <ReelAutomationCustomizer
            reel={apiReels.find((r) => r.id === customizingReelId) || { id: customizingReelId }}
            apiUser={apiUser}
            onBack={() => navigateTo('#/dashboard')}
            onSaveSuccess={() => {
              loadDashboardData();
            }}
          />
        ) : (
          <>
            {/* ACCOUNT NOT CONNECTED ALERT BANNER */}
            {!isInstagramConnected && (
              <div className="ds-card" style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Action Required: Instagram Business Account Not Linked
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                      To fetch Reels and trigger intelligent replies, authenticate via Meta OAuth.
                    </p>
                  </div>
                  <button onClick={handleConnectInstagram} className="ds-btn-primary" style={{ flexShrink: 0 }}>
                    Connect Instagram via Meta
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════ TAB 1: DASHBOARD & REELS FEED ═══════════════ */}
            {activeTab === 'dashboard' && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>

            {/* Creator Profile Card */}
            <div className="ds-card" style={{ padding: 'var(--card-padding)' }}>
              {/* Top row: Avatar + Name + Sync */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Avatar */}
                  <div style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid #DBDBDB', padding: 3, flexShrink: 0 }}>
                    <img
                      src={apiUser?.profile_picture_url || user?.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                      alt="Profile"
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {apiUser?.full_name || (apiUser?.username ? `@${apiUser.username}` : 'Instagram Profile')}
                      </h1>
                      {apiUser?.username && (
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>@{apiUser.username}</span>
                      )}
                      {isInstagramConnected && (
                        <span className="ds-badge ds-badge-success">● Connected</span>
                      )}
                    </div>
                    {/* Bio */}
                    {apiUser?.biography ? (
                      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 500, lineHeight: 1.5 }}>
                        {apiUser.biography}
                      </p>
                    ) : (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>No biography listed on Instagram profile</p>
                    )}
                  </div>
                </div>

                {/* Sync Button (ghost style) */}
                <button
                  onClick={handleSyncReels}
                  disabled={syncing || !isInstagramConnected}
                  className="ds-btn-ghost"
                  style={{ flexShrink: 0, opacity: isInstagramConnected ? 1 : 0.4 }}
                >
                  {syncing ? <IconSync /> : null}
                  <span>{syncing ? 'Syncing reels…' : 'Sync reels from Meta'}</span>
                </button>
              </div>

              {/* Stats Row — Instagram style */}
              <div style={{ display: 'flex', gap: 40, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
                {[
                  { label: 'posts', value: apiUser?.media_count ?? apiReels.length },
                  { label: 'followers', value: apiUser?.followers_count ?? 0 },
                  { label: 'following', value: apiUser?.follows_count ?? 0 },
                ].map((stat) => (
                  <div key={stat.label} style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</span>{' '}
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reels Section Header */}
            <div className="ds-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>PROFILE REELS FEED</span>
                <span className="ds-badge ds-badge-purple" style={{ fontSize: 10 }}>{apiReels.length}</span>
              </div>
              <span className="ds-badge ds-badge-purple">Gemini multimodal analysis</span>
            </div>

            {/* Reels Grid */}
            {apiReels.length === 0 ? (
              <div className="ds-card" style={{ padding: 48, textAlign: 'center' }}>
                <svg style={{ width: 40, height: 40, color: 'var(--text-muted)', margin: '0 auto 16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>No reels found in data store.</p>
                <button onClick={handleSyncReels} className="ds-btn-primary-sm">
                  Sync Reels
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--element-gap)' }}>
                {apiReels.map((reel, index) => (
                  <motion.div
                    key={reel.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    className="ds-card"
                    style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{ position: 'relative', height: 200, overflow: 'hidden', transition: 'transform 0.4s ease' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <img
                        src={reel.thumbnail_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80'}
                        alt="Thumbnail"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-card) var(--radius-card) 0 0' }}
                      />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)', pointerEvents: 'none' }} />

                      {/* Analysis Badge */}
                      <span
                        className={`ds-badge ${reel.is_analyzed ? 'ds-badge-purple' : 'ds-badge-muted'}`}
                        style={{ position: 'absolute', top: 12, right: 12, backdropFilter: 'blur(6px)' }}
                      >
                        {reel.is_analyzed ? '✨ Analyzed' : 'Not analyzed'}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div style={{ padding: 'var(--card-padding)' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 10 }}>
                        {reel.caption || 'No caption provided'}
                      </p>

                      {/* Likes + Comments */}
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                        <span>♥ {reel.like_count || 0}</span>
                        <span>💬 {reel.comments_count || 0}</span>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleOpenReelDetail(reel.id)}
                          disabled={fetchingReelDetail}
                          className="ds-btn-ghost-sm"
                          style={{ flex: 1 }}
                        >
                          {fetchingReelDetail ? 'Loading…' : 'View Summary'}
                        </button>
                        <button
                          onClick={() => navigateTo(`#/reel/${reel.id}/custom-automation`)}
                          className="ds-btn-primary-sm"
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        >
                          ⚙️ Customize Automation
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ═══════════════ TAB 2: MY AUTOMATIONS ═══════════════ */}
        {activeTab === 'my-automations' && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>
            {selectedAutomation === 'comment-to-dm' ? (
              /* ──── COMMENT-TO-DM DEDICATED MANAGER ──── */
              <CommentDMSetup
                apiUser={apiUser}
                apiReels={apiReels}
                onBack={() => navigateTo('#/automations')}
                onSyncReels={handleSyncReels}
              />
            ) : selectedAutomation === 'ai-reply' ? (
              /* ──── AUTOMATION DETAIL VIEW ──── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <button
                    onClick={() => navigateTo('#/automations')}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Back to My Automations</span>
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`ds-badge ${apiUser?.auto_reply_enabled ? 'ds-badge-success' : 'ds-badge-muted'}`}>
                        {apiUser?.auto_reply_enabled ? '● Active' : '○ Paused'}
                      </span>
                      <Toggle
                        checked={Boolean(apiUser?.auto_reply_enabled)}
                        onChange={toggleAutoReplySetting}
                        label="Enable AI reply automation"
                      />
                    </div>
                    <button onClick={() => navigateTo('#/setup-wizard')} className="ds-btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>
                      Edit Setup
                    </button>
                  </div>
                </div>

                {/* Automation Title Card */}
                <div className="ds-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg style={{ width: 20, height: 20, color: 'var(--accent-light)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <div>
                      <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>AI Reply for Engagement</h1>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Auto-reply to Instagram comments using Gemini reel context + Groq Qwen LLM.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Analytics Row (4 Stat Cards) */}
                <div className="ds-section-header" style={{ marginBottom: -8 }}>
                  <span>LIVE AUTOMATION ANALYTICS</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--element-gap)' }}>
                  <div className="ds-stat-card">
                    <div className="ds-stat-label">Total Comments</div>
                    <div className="ds-stat-number">{apiComments.length}</div>
                    <div className="ds-stat-sub">Synced via Instagram webhook</div>
                  </div>
                  <div className="ds-stat-card">
                    <div className="ds-stat-label" style={{ color: 'var(--warning)' }}>Awaiting Approval</div>
                    <div className="ds-stat-number" style={{ color: 'var(--warning)' }}>{apiComments.filter(c => !c.is_processed).length}</div>
                    <div className="ds-stat-sub">Pending drafts in queue</div>
                  </div>
                  <div className="ds-stat-card">
                    <div className="ds-stat-label" style={{ color: 'var(--success)' }}>Posted Replies</div>
                    <div className="ds-stat-number" style={{ color: 'var(--success)' }}>{apiComments.filter(c => c.is_processed).length}</div>
                    <div className="ds-stat-sub">Published to Instagram</div>
                  </div>
                  <div className="ds-stat-card">
                    <div className="ds-stat-label" style={{ color: 'var(--accent-light)' }}>Synced Reels</div>
                    <div className="ds-stat-number" style={{ color: 'var(--accent-light)' }}>{apiReels.length}</div>
                    <div className="ds-stat-sub">{apiReels.filter(r => r.is_analyzed).length} AI Analyzed</div>
                  </div>
                </div>

                {/* 2-Column Split Layout: Configuration & Queue on Left, Live Dark Theme Phone Simulator on Right */}
                {(() => {
                  let styleObj = {};
                  try { styleObj = JSON.parse(apiUser?.reply_style || '{}'); } catch(e) {}
                  
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 32, alignItems: 'start' }}>
                      {/* ── LEFT COLUMN: Configuration Cards + Live Comment Stream ── */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>
                        {/* Section Header */}
                        <div className="ds-section-header" style={{ marginBottom: -8 }}>
                          <span>ACTIVE VOICE & PERSONA CONFIGURATION</span>
                          <button
                            onClick={() => navigateTo('#/setup-wizard')}
                            style={{ fontSize: 12, color: 'var(--accent-light)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                          >
                            Edit Configuration →
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--element-gap)' }}>
                          {/* Identity & Niche */}
                          <Accordion
                            title="Identity & Niche"
                            subtitle={styleObj.business_name || apiUser?.full_name || apiUser?.username || 'Brand identity'}
                            defaultOpen
                            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, paddingTop: 10 }}>
                              <div><span style={{ color: 'var(--text-muted)' }}>Business Name:</span> <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginLeft: 4 }}>{styleObj.business_name || apiUser?.full_name || apiUser?.username || 'N/A'}</span></div>
                              <div><span style={{ color: 'var(--text-muted)' }}>Industry:</span> <span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 4 }}>{styleObj.industry || 'General Content Creator'}</span></div>
                              <div>
                                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Target Audience:</span>
                                <p style={{ color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{styleObj.audience || 'Not specified'}</p>
                              </div>
                            </div>
                          </Accordion>

                          {/* Voice & Persona */}
                          <Accordion
                            title="Voice & Persona"
                            subtitle={`${styleObj.persona || 'Founder'} · Formality ${styleObj.formality || 3}/5`}
                            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, paddingTop: 10 }}>
                              <div><span style={{ color: 'var(--text-muted)' }}>Persona:</span> <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginLeft: 4, textTransform: 'capitalize' }}>{styleObj.persona || 'Founder'}</span></div>
                              <div><span style={{ color: 'var(--text-muted)' }}>Formality Level:</span> <span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 4 }}>{styleObj.formality || 3} / 5</span></div>
                              <div>
                                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Tone Description:</span>
                                <p style={{ color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{styleObj.tone_description || 'Friendly, engaging, and clear.'}</p>
                              </div>
                              {styleObj.signature_phrases?.length > 0 && (
                                <div style={{ paddingTop: 4 }}>
                                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontSize: 12 }}>Signature Phrases:</span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {styleObj.signature_phrases.map((phrase, i) => (
                                      <span key={i} className="ds-badge ds-badge-purple" style={{ fontSize: 10 }}>{phrase}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </Accordion>

                          {/* Knowledge Base */}
                          <Accordion
                            title="Knowledge Base & FAQs"
                            subtitle={styleObj.knowledge ? `${styleObj.knowledge.slice(0, 64)}…` : 'No custom knowledge base configured'}
                            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
                          >
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line', paddingTop: 10 }}>{styleObj.knowledge || 'No custom knowledge base configured.'}</p>
                          </Accordion>

                          {/* Safety & Guardrails */}
                          <Accordion
                            title="Safety & Guardrails"
                            subtitle={`${styleObj.avoid_words?.length || 0} avoided words · ${styleObj.avoid_topics?.length || 0} skipped topics · ${styleObj.dm_topics?.length || 0} DM redirects`}
                            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                          >
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, paddingTop: 10 }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontSize: 11 }}>Avoid Words:</span>
                              {styleObj.avoid_words?.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {styleObj.avoid_words.map((w, i) => (
                                    <span key={i} className="ds-badge ds-badge-error" style={{ fontSize: 10 }}>{w}</span>
                                  ))}
                                </div>
                              ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>None</span>}
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontSize: 11 }}>Skip Public Topics:</span>
                              {styleObj.avoid_topics?.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {styleObj.avoid_topics.map((t, i) => (
                                    <span key={i} className="ds-badge ds-badge-warning" style={{ fontSize: 10 }}>{t}</span>
                                  ))}
                                </div>
                              ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>None</span>}
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontSize: 11 }}>Redirect to DM:</span>
                              {styleObj.dm_topics?.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {styleObj.dm_topics.map((d, i) => (
                                    <span key={i} className="ds-badge ds-badge-purple" style={{ fontSize: 10 }}>{d}</span>
                                  ))}
                                </div>
                              ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>None</span>}
                            </div>
                          </div>
                        </Accordion>
                      </div>

                        {/* Active Settings Row */}
                        <div className="ds-card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Reply Mode:</span>
                            <span className="ds-badge ds-badge-purple">{styleObj.reply_mode || 'Draft'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Auto-Analyze:</span>
                            <span className={`ds-badge ${styleObj.auto_analyze_reels !== false ? 'ds-badge-success' : 'ds-badge-muted'}`}>
                              {styleObj.auto_analyze_reels !== false ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Real-Time:</span>
                            <span className={`ds-badge ${styleObj.use_realtime_data !== false ? 'ds-badge-success' : 'ds-badge-muted'}`}>
                              {styleObj.use_realtime_data !== false ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </div>

                        {/* Comment Stream Section */}
                        <div className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
                          <div className="ds-tab-bar" style={{ padding: '0 var(--card-padding)' }}>
                            <button
                              onClick={() => setInboxSubFilter('pending')}
                              className={`ds-tab ${inboxSubFilter === 'pending' ? 'ds-tab-active' : ''}`}
                            >
                              Pending Queue ({apiComments.filter(c => !c.is_processed).length})
                            </button>
                            <button
                              onClick={() => setInboxSubFilter('posted')}
                              className={`ds-tab ${inboxSubFilter === 'posted' ? 'ds-tab-active' : ''}`}
                            >
                              Posted History ({apiComments.filter(c => c.is_processed).length})
                            </button>
                          </div>

                          <div style={{ padding: 'var(--card-padding)' }}>
                            {(() => {
                              const filtered = apiComments.filter(c => inboxSubFilter === 'pending' ? !c.is_processed : c.is_processed);
                              if (filtered.length === 0) {
                                return (
                                  <div style={{ padding: '48px 0', textAlign: 'center' }}>
                                    <div style={{
                                      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                                      padding: '32px 40px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-card)',
                                      background: 'rgba(17,17,24,0.3)',
                                    }}>
                                      <svg style={{ width: 32, height: 32, color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-3.586 3.586a2 2 0 01-2.828 0L6 13" />
                                      </svg>
                                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                        No {inboxSubFilter === 'pending' ? 'pending comments waiting for approval' : 'posted comments history yet'}.
                                      </p>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--element-gap)' }}>
                                  {filtered.map((comment) => (
                                    <div key={comment.id} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-button)', border: '1px solid var(--border)', padding: 16 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>@{comment.commenter_username || 'user'}</span>
                                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(comment.created_at).toLocaleString()}</span>
                                        </div>
                                        <span className={`ds-badge ${comment.is_processed ? 'ds-badge-success' : 'ds-badge-warning'}`} style={{ fontSize: 10 }}>
                                          {comment.is_processed ? 'Posted' : 'Pending Review'}
                                        </span>
                                      </div>

                                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: 12, borderRadius: 'var(--radius-button)', border: '1px solid var(--border)', marginBottom: 10 }}>
                                        "{comment.text}"
                                      </p>

                                      {/* AI Reply Block */}
                                      {comment.replies && comment.replies.length > 0 && (
                                        <div style={{ marginBottom: 8 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-light)' }}>Generated AI Response:</span>
                                            {comment.replies[0].used_web_search && (
                                              <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>🌐 Real-time Web Verified</span>
                                            )}
                                          </div>
                                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--accent-glow)', padding: 12, borderRadius: 'var(--radius-button)', border: '1px solid rgba(124,58,237,0.15)' }}>
                                            {comment.replies[0].reply_text}
                                          </div>

                                          {!comment.is_processed && (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                                              <button onClick={() => handleRejectReply(comment.id)} className="ds-btn-ghost-sm">
                                                Discard
                                              </button>
                                              <button onClick={() => handleApproveReply(comment.id)} className="ds-btn-primary-sm" style={{ background: 'var(--success)' }}>
                                                Post to Instagram ✓
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {!comment.replies?.length && !comment.is_processed && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                                          <button onClick={() => handleGenerateReply(comment.id)} className="ds-btn-primary-sm">
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
                      </div>

                      {/* ── RIGHT COLUMN: Live Instagram Reel Comments Dark Theme Phone Simulator ── */}
                      <div style={{ position: 'sticky', top: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            📱 Live Instagram Comment Simulator
                          </span>
                          <span className="ds-badge ds-badge-purple" style={{ fontSize: 10 }}>Dark Theme</span>
                        </div>

                        <InstagramCommentPreview
                          apiUser={apiUser}
                          voiceProfile={styleObj}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* ──── AUTOMATION LIST VIEW ──── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>
                <div>
                  <h1 className="ds-page-title">My Automations</h1>
                  <p className="ds-page-subtitle">Click any automation to view settings, analytics, and pending approval queue.</p>
                </div>

                {/* AI Reply for Engagement Card */}
                <div
                  onClick={() => {
                    if (apiUser && !apiUser.has_advanced_scopes) {
                      setShowScopePromptModal(true);
                    } else if (apiUser && !apiUser.reply_style) {
                      navigateTo('#/setup-wizard');
                    } else {
                      navigateTo('#/automations/ai-reply');
                    }
                  }}
                  className="ds-card"
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg style={{ width: 20, height: 20, color: 'var(--accent-light)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      </div>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>AI Reply for Engagement</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Auto-reply to comments with AI-powered contextual responses</p>
                      </div>
                    </div>
                    <span className={`ds-badge ${apiUser?.auto_reply_enabled ? 'ds-badge-success' : 'ds-badge-muted'}`}>
                      {apiUser?.auto_reply_enabled ? '● Active' : 'Setup Required'}
                    </span>
                  </div>

                  {/* Feature badges */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <span className="ds-badge ds-badge-purple" style={{ fontSize: 10 }}>🧠 Gemini + Groq</span>
                    <span className="ds-badge ds-badge-purple" style={{ fontSize: 10 }}>🌐 Real-time data</span>
                    <span className="ds-badge ds-badge-purple" style={{ fontSize: 10 }}>⚡ Auto or Draft mode</span>
                  </div>

                  <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {apiComments.length} Comments • {apiComments.filter(c => !c.is_processed).length} Pending Review
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--accent-light)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                      View Details
                      <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>

                {/* Comment-to-DM Automation Card */}
                <div
                  className="ds-card"
                  style={{ padding: 18 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,149,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg style={{ width: 20, height: 20, color: '#0095F6' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Comment-to-DM Automation</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Auto-send private Instagram DMs with interactive buttons or direct links</p>
                      </div>
                    </div>

                    {/* Enable / Disable Toggle Switch (controlled — knob always matches state) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`ds-badge ${dmAutomationEnabled ? 'ds-badge-success' : 'ds-badge-muted'}`} style={{ fontSize: 11 }}>
                        {dmAutomationEnabled ? '● Enabled' : 'Disabled'}
                      </span>
                      <Toggle
                        checked={dmAutomationEnabled}
                        onChange={(next) => {
                          setDmAutomationEnabled(next);
                          showNotification(`Comment-to-DM ${next ? 'enabled' : 'disabled'}`);
                        }}
                        label="Toggle Comment-to-DM"
                      />
                    </div>
                  </div>

                  {/* Feature badges */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    <span className="ds-badge ds-badge-purple" style={{ fontSize: 10 }}>🔘 2-Step Button or Direct Link</span>
                    <span className="ds-badge ds-badge-purple" style={{ fontSize: 10 }}>🏷️ Custom Keyword or All Comments</span>
                    <span className="ds-badge ds-badge-purple" style={{ fontSize: 10 }}>🎬 Per-Reel Customization</span>
                  </div>

                  <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Active for configured reels
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Customize per reel on Dashboard ⚙️
                    </span>
                  </div>
                </div>

                {/* Coming Soon Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--element-gap)' }}>
                  {[
                    { icon: '📸', name: 'Story Mention Reply', desc: 'Auto-thank users who mention you in their stories.' },
                  ].map((item) => (
                    <div key={item.name} className="ds-card" style={{ opacity: 0.5, position: 'relative', borderStyle: 'dashed', borderColor: 'var(--border)' }}>
                      <span className="ds-badge ds-badge-muted" style={{ position: 'absolute', top: 16, right: 16, fontSize: 10 }}>Coming Soon</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(100,116,139,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, border: '1px solid rgba(100,116,139,0.12)' }}>
                          {item.icon}
                        </div>
                        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{item.name}</h3>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══════════════ TAB 3: SETTINGS ═══════════════ */}
        {activeTab === 'settings' && (() => {
          let styleObj = {};
          try { styleObj = JSON.parse(apiUser?.reply_style || '{}'); } catch(e) {}

          return (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>
              <div>
                <h1 className="ds-page-title">Settings</h1>
                <p className="ds-page-subtitle">Manage your Instagram integration, AI voice profile, and automation preferences.</p>
              </div>

              {/* 1. Instagram Business Integration */}
              <div className="ds-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Instagram Business Account</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Meta Graph API connection & reel sync</p>
                  </div>
                  {isInstagramConnected && (
                    <button onClick={handleSyncReels} disabled={syncing} className="ds-btn-ghost-sm" style={{ gap: 6 }}>
                      {syncing ? <IconSync /> : <IconGlobe />}
                      <span>{syncing ? 'Syncing...' : 'Sync Reels'}</span>
                    </button>
                  )}
                </div>

                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-button)', border: '1px solid var(--border)', padding: '4px 16px' }}>
                  <div className="ds-row">
                    <span className="ds-row-label">Linked Account</span>
                    <span className="ds-row-value">
                      {apiUser?.username ? `@${apiUser.username}` : 'Not Connected'}
                    </span>
                  </div>
                  <div className="ds-row">
                    <span className="ds-row-label">Full Name</span>
                    <span className="ds-row-value">{apiUser?.full_name || '—'}</span>
                  </div>
                  <div className="ds-row">
                    <span className="ds-row-label">Followers / Posts</span>
                    <span className="ds-row-value">{apiUser?.followers_count ?? 0} followers · {apiUser?.media_count ?? apiReels.length} posts</span>
                  </div>
                  <div className="ds-row">
                    <span className="ds-row-label">Connection Status</span>
                    {isInstagramConnected ? (
                      <span className="ds-badge ds-badge-success">● Connected & Active</span>
                    ) : (
                      <button onClick={handleConnectInstagram} className="ds-btn-primary-sm">
                        Connect Instagram
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. AI Reply Engine & Autopilot Rules (Synced with My Automations) */}
              <div className="ds-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>AI Reply Engine & Execution Rules</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Configure how your AI replies to Instagram comments</p>
                  </div>
                  <span className={`ds-badge ${apiUser?.auto_reply_enabled ? 'ds-badge-success' : 'ds-badge-muted'}`}>
                    {apiUser?.auto_reply_enabled ? '● Active' : '○ Paused'}
                  </span>
                </div>

                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-button)', border: '1px solid var(--border)', padding: '4px 16px' }}>
                  {/* Auto-Reply Master Switch */}
                  <div className="ds-row">
                    <div>
                      <span className="ds-row-label" style={{ fontWeight: 600 }}>Auto-Reply to Comments</span>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Turn the AI comment reply pipeline ON or OFF</p>
                    </div>
                    <button
                      onClick={toggleAutoReplySetting}
                      className={`ds-toggle ${apiUser?.auto_reply_enabled ? 'ds-toggle-on' : 'ds-toggle-off'}`}
                    >
                      <span className="ds-toggle-knob" />
                    </button>
                  </div>

                  {/* Reply Mode (Draft vs Auto) */}
                  <div className="ds-row">
                    <div>
                      <span className="ds-row-label" style={{ fontWeight: 600 }}>Default Reply Mode</span>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Draft mode requires approval; Auto mode sends replies immediately</p>
                    </div>
                    <select
                      value={styleObj.reply_mode || (apiUser?.auto_reply_enabled ? 'auto' : 'draft')}
                      onChange={(e) => handleUpdateVoiceConfig('reply_mode', e.target.value)}
                      className="ds-select"
                      style={{ padding: '6px 12px', fontSize: 13 }}
                    >
                      <option value="draft">Draft Mode (Manual Review)</option>
                      <option value="auto">Auto Mode (Instant Send)</option>
                    </select>
                  </div>

                  {/* Auto-Analyze New Reels */}
                  <div className="ds-row">
                    <div>
                      <span className="ds-row-label" style={{ fontWeight: 600 }}>Auto-Analyze New Posts</span>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Analyze reel video & caption when published to prepare context</p>
                    </div>
                    <button
                      onClick={() => handleUpdateVoiceConfig('auto_analyze_reels', styleObj.auto_analyze_reels === false)}
                      className={`ds-toggle ${styleObj.auto_analyze_reels !== false ? 'ds-toggle-on' : 'ds-toggle-off'}`}
                    >
                      <span className="ds-toggle-knob" />
                    </button>
                  </div>

                  {/* Realtime Web Search */}
                  <div className="ds-row">
                    <div>
                      <span className="ds-row-label" style={{ fontWeight: 600 }}>Live Web & Market Search</span>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Use Grok & Tavily to fetch live data when comments ask about prices or news</p>
                    </div>
                    <button
                      onClick={() => handleUpdateVoiceConfig('use_realtime_data', !styleObj.use_realtime_data)}
                      className={`ds-toggle ${styleObj.use_realtime_data ? 'ds-toggle-on' : 'ds-toggle-off'}`}
                    >
                      <span className="ds-toggle-knob" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. AI Voice DNA & Persona Configuration */}
              <div className="ds-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>AI Voice DNA & Persona</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Synchronized with Setup Wizard and My Automations</p>
                  </div>
                  <button
                    onClick={() => navigateTo('#/setup-wizard')}
                    className="ds-btn-primary-sm"
                  >
                    Open Voice Wizard →
                  </button>
                </div>

                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-button)', border: '1px solid var(--border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Persona Selector */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                      AI Persona / Tone Preset
                    </label>
                    <select
                      value={styleObj.persona || apiUser?.reply_tone || 'founder'}
                      onChange={(e) => handleUpdateVoiceConfig('persona', e.target.value)}
                      className="ds-select"
                      style={{ width: '100%', padding: '8px 12px', fontSize: 14 }}
                    >
                      <option value="founder">Founder / Brand Creator</option>
                      <option value="casual_friend">Casual Friend</option>
                      <option value="helpful_expert">Helpful Expert</option>
                      <option value="professional">Professional & Formal</option>
                      <option value="hype_friend">Hype & Energetic</option>
                      <option value="witty_sarcastic">Witty & Sarcastic</option>
                    </select>
                  </div>

                  {/* Formality Level */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Formality Level: {styleObj.formality || 3} / 5
                      </label>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {Number(styleObj.formality || 3) <= 2 ? 'Casual' : Number(styleObj.formality || 3) === 3 ? 'Balanced' : 'Strictly Formal'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={styleObj.formality || 3}
                      onChange={(e) => handleUpdateVoiceConfig('formality', parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Business Name & Industry */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                        Business / Brand Name
                      </label>
                      <input
                        type="text"
                        value={styleObj.business_name || apiUser?.full_name || apiUser?.username || ''}
                        onChange={(e) => handleUpdateVoiceConfig('business_name', e.target.value)}
                        placeholder="e.g. My Brand"
                        className="ds-input"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                        Industry / Niche
                      </label>
                      <input
                        type="text"
                        value={styleObj.industry || ''}
                        onChange={(e) => handleUpdateVoiceConfig('industry', e.target.value)}
                        placeholder="e.g. E-Commerce, Fitness, Tech"
                        className="ds-input"
                      />
                    </div>
                  </div>

                  {/* Tone Description */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                      Custom Tone Description
                    </label>
                    <input
                      type="text"
                      value={styleObj.tone_description || ''}
                      onChange={(e) => handleUpdateVoiceConfig('tone_description', e.target.value)}
                      placeholder="e.g. Friendly, encouraging, short, concise"
                      className="ds-input"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Safety & Guardrails */}
              <div className="ds-card">
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Content Safety & Guardrails</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Protect your brand reputation and handle sensitive topics</p>
                </div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-button)', border: '1px solid var(--border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                      Avoided Words & Phrases
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(styleObj.avoid_words && styleObj.avoid_words.length > 0 ? styleObj.avoid_words : ['cheap', 'guaranteed', 'discount', 'free stuff']).map((word, i) => (
                        <span key={i} className="ds-badge ds-badge-error" style={{ fontSize: 12 }}>
                          🚫 {word}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                      Avoided Topics
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(styleObj.avoid_topics && styleObj.avoid_topics.length > 0 ? styleObj.avoid_topics : ['politics', 'crypto', 'financial advice']).map((topic, i) => (
                        <span key={i} className="ds-badge ds-badge-warning" style={{ fontSize: 12 }}>
                          ⚠️ {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Danger Zone */}
              <div className="ds-danger-card">
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg style={{ width: 18, height: 18, color: 'var(--error)', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--error)' }}>Danger Zone</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Account management actions</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(239,68,68,0.03)', borderRadius: 'var(--radius-button)', border: '1px solid rgba(239,68,68,0.1)' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Sign Out & Clear Session</span>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Log out from this browser session.</p>
                  </div>
                  <button onClick={onSignOut} className="ds-btn-danger">
                    Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })()}
          </>
        )}
        </div>
      </main>

      {/* ═══════════════ REEL SUMMARY DRAWER MODAL ═══════════════ */}
      <AnimatePresence>
        {selectedReel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}
            onClick={() => setSelectedReel(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="ds-card"
              style={{ maxWidth: 560, width: '100%', position: 'relative', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <button
                onClick={() => setSelectedReel(null)}
                style={{ position: 'absolute', top: 16, right: 16, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', zIndex: 10 }}
              >
                <svg style={{ width: 20, height: 20 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 40, marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ds-badge ds-badge-purple" style={{ fontSize: 11, padding: '4px 10px' }}>
                    🤖 Gemini Multimodal AI
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                    Reel Summary
                  </span>
                </div>

                {/* Big, Visible, Prominent Analyze / Re-analyze Button */}
                <button
                  onClick={(e) => handleAnalyzeReel(e, selectedReel.id)}
                  disabled={analyzingReels[selectedReel.id]}
                  className={selectedReel.summary || selectedReel.is_analyzed ? "ds-btn-ghost" : "ds-btn-primary"}
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    padding: '8px 20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: 24,
                    border: selectedReel.summary || selectedReel.is_analyzed ? '1.5px solid var(--accent)' : 'none',
                    background: selectedReel.summary || selectedReel.is_analyzed ? 'rgba(124,58,237,0.12)' : undefined,
                    boxShadow: '0 0 16px rgba(124,58,237,0.35)',
                    cursor: analyzingReels[selectedReel.id] ? 'not-allowed' : 'pointer',
                  }}
                >
                  {analyzingReels[selectedReel.id] 
                    ? (selectedReel.summary || selectedReel.is_analyzed ? '🔄 Re-analyzing Reel…' : '✨ Analyzing Reel…')
                    : (selectedReel.summary || selectedReel.is_analyzed ? '🔄 Re-analyze Reel' : '✨ Analyze Reel')
                  }
                </button>
              </div>

              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>{selectedReel.caption || 'No caption'}</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 4, flex: 1 }}>
                {selectedReel.summary ? (
                  <>
                    {/* Error block if summary failed */}
                    {selectedReel.summary.analysis_model === 'failed' && (
                      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: 16, borderRadius: 'var(--radius-card)', fontSize: 13, color: '#FCA5A5', lineHeight: 1.5 }}>
                        Error: Summary generation failed. Details: {selectedReel.summary.ai_summary?.error || 'Unknown pipeline failure.'}
                      </div>
                    )}

                    {selectedReel.summary.analysis_model !== 'failed' && (
                      <>
                        <div style={{ background: 'rgba(17,24,39,0.5)', padding: 16, borderRadius: 'var(--radius-button)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Main Topic</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-light)', marginTop: 6 }}>
                            {selectedReel.summary.ai_summary?.topic || 'Not extracted'}
                          </div>
                        </div>

                        <div style={{ background: 'rgba(17,24,39,0.5)', padding: 16, borderRadius: 'var(--radius-button)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Key Points</div>
                          <ul style={{ listStyleType: 'disc', paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6, marker: 'var(--accent)' }}>
                            {selectedReel.summary.key_points && selectedReel.summary.key_points.length > 0 ? (
                              selectedReel.summary.key_points.map((pt, idx) => <li key={idx} style={{ marginBottom: 6 }}>{pt}</li>)
                            ) : (
                              <li>No key takeaways extracted.</li>
                            )}
                          </ul>
                        </div>

                        {selectedReel.summary.faq && selectedReel.summary.faq.length > 0 && (
                          <div style={{ background: 'rgba(17,24,39,0.5)', padding: 16, borderRadius: 'var(--radius-button)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 12 }}>Anticipated FAQs</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                              {selectedReel.summary.faq.map((item, idx) => (
                                <div key={idx} style={{ fontSize: 13, padding: '10px 14px', background: 'rgba(59,130,246,0.05)', borderRadius: 6, lineHeight: 1.5 }}>
                                  <p style={{ fontWeight: 600, color: 'var(--accent-light)' }}>Q: {item.question || item.q}</p>
                                  <p style={{ color: 'var(--text-primary)', marginTop: 4 }}>A: {item.answer || item.a}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedReel.summary.ai_summary?.realtime_context && (
                          <div style={{ background: 'rgba(17,24,39,0.5)', padding: 16, borderRadius: 'var(--radius-button)', border: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <IconGlobe /> Real-time search context
                            </div>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                              {selectedReel.summary.ai_summary.realtime_context}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
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
            style={{ position: 'fixed', inset: 0, zIndex: 60 }}
          >
            <AutomationSetup
              apiUser={apiUser}
              onComplete={() => {
                navigateTo(activeTab === 'my-automations' ? '#/automations' : '#/dashboard');
                loadDashboardData();
              }}
              onConnect={handleConnectInstagram}
              onConnectAdvanced={handleConnectAdvancedInstagram}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* STEP-UP SCOPE PROMPT MODAL */}
      <AnimatePresence>
        {showScopePromptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(4px)',
              zIndex: 70,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
            onClick={() => setShowScopePromptModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="ds-card"
              style={{
                maxWidth: 440,
                width: '100%',
                textAlign: 'center',
                padding: '32px 24px',
                border: '1px solid var(--border)',
                background: '#FFFFFF',
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Authorize Comment Management
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                To allow Pilotly to publish AI replies under your Instagram posts, Meta requires you to grant comment management permissions (<code>instagram_business_manage_comments</code>).
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => {
                    setShowScopePromptModal(false);
                    handleConnectAdvancedInstagram();
                  }}
                  className="ds-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', gap: 8, padding: '10px 16px' }}
                >
                  Authorize Comment Management via Meta →
                </button>
                <button
                  onClick={() => setShowScopePromptModal(false)}
                  className="ds-btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
