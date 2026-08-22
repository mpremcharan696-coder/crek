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
  const [selectedAutomation, setSelectedAutomation] = useState(null); // null | 'ai-reply'
  const [inboxSubFilter, setInboxSubFilter] = useState('pending'); // 'pending' | 'posted'
  const [showScopePromptModal, setShowScopePromptModal] = useState(false);


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
      <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <IconSync />
        <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', animation: 'pulse 2s infinite' }}>Loading Engine Dashboard</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} className="flex flex-col antialiased">
      {/* Toast Notification */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            style={{
              position: 'fixed', top: 24, right: 24, zIndex: 50,
              padding: '12px 16px', borderRadius: 'var(--radius-card)',
              border: `1px solid ${actionMessage.toLowerCase().startsWith('error') ? 'rgba(239,68,68,0.3)' : 'rgba(124,58,237,0.2)'}`,
              background: actionMessage.toLowerCase().startsWith('error') ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 12, fontWeight: 600,
              color: actionMessage.toLowerCase().startsWith('error') ? 'var(--error)' : 'var(--accent-light)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: actionMessage.toLowerCase().startsWith('error') ? 'var(--error)' : 'var(--accent)' }} />
            <span>{actionMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ PRIMARY TOP HEADER ═══════════════ */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          width: '100%',
          height: 64,
          background: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        {/* Left: Logo + Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <span
            style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
            onClick={() => setActiveTab('dashboard')}
          >
            Pilotly<span style={{ color: 'var(--accent)' }}>.ai</span>
          </span>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'my-automations', label: 'Automations' },
              { id: 'settings', label: 'Settings' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 'var(--radius-button)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  border: activeTab === item.id ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
                  background: activeTab === item.id ? 'rgba(124,58,237,0.15)' : 'transparent',
                  color: activeTab === item.id ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Profile & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {isInstagramConnected && (
            <span className="ds-badge ds-badge-success" style={{ fontSize: 11 }}>
              ● Connected
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px', background: 'var(--bg-card)', borderRadius: 999, border: '1px solid var(--border)' }}>
            <img
              src={apiUser?.profile_picture_url || user?.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
              alt="Profile"
              style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {apiUser?.username ? `@${apiUser.username}` : 'Creator'}
            </span>
          </div>
          <button
            onClick={onSignOut}
            style={{
              color: 'var(--text-muted)',
              background: 'none',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: 'var(--radius-button)',
              fontSize: 12,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s',
            }}
          >
            <IconSignOut />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ═══════════════ MAIN CONTENT AREA ═══════════════ */}
      <main style={{ flex: 1, padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>

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
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #EC4899, #F59E0B)', padding: 2, flexShrink: 0 }}>
                    <img
                      src={apiUser?.profile_picture_url || user?.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                      alt="Profile"
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--bg-card)' }}
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

              {/* Stats Pills Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--element-gap)', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                {[
                  { label: 'Posts', value: apiUser?.media_count ?? apiReels.length },
                  { label: 'Followers', value: apiUser?.followers_count ?? 0 },
                  { label: 'Following', value: apiUser?.follows_count ?? 0 },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-button)', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{stat.label}</div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--section-gap)' }}>
                {apiReels.map((reel) => (
                  <div
                    key={reel.id || reel.media_id}
                    className="ds-card"
                    style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
                  >
                    {/* Thumbnail */}
                    <div style={{ position: 'relative', height: 180, overflow: 'hidden' }}>
                      <img
                        src={reel.thumbnail_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80'}
                        alt="Thumbnail"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-card) var(--radius-card) 0 0', transition: 'transform 0.3s' }}
                      />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }} />

                      {/* Analysis Badge */}
                      <span
                        className={`ds-badge ${reel.is_analyzed ? (reel.summary?.analysis_model === 'failed' ? 'ds-badge-error' : 'ds-badge-success') : 'ds-badge-muted'}`}
                        style={{ position: 'absolute', top: 10, left: 10, fontSize: 10 }}
                      >
                        {reel.is_analyzed
                          ? reel.summary?.analysis_model === 'failed'
                            ? 'Failed'
                            : '● Analyzed'
                          : 'Not Analyzed'}
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
                          onClick={(e) => handleAnalyzeReel(e, reel.id)}
                          className="ds-btn-primary-sm"
                          style={{ flex: 1 }}
                        >
                          Analyze
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ═══════════════ TAB 2: MY AUTOMATIONS ═══════════════ */}
        {activeTab === 'my-automations' && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>
            {selectedAutomation === 'ai-reply' ? (
              /* ──── AUTOMATION DETAIL VIEW ──── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <button
                    onClick={() => setSelectedAutomation(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Back to My Automations</span>
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={`ds-badge ${apiUser?.auto_reply_enabled ? 'ds-badge-success' : 'ds-badge-muted'}`}>
                      {apiUser?.auto_reply_enabled ? '● Active' : '○ Paused'}
                    </span>
                    <button onClick={toggleAutoReplySetting} className="ds-btn-ghost" style={{ padding: '8px 16px', fontSize: 12 }}>
                      {apiUser?.auto_reply_enabled ? 'Pause Automation' : 'Enable Automation'}
                    </button>
                    <button onClick={() => setShowSetupWizard(true)} className="ds-btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>
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

                {/* Configuration Section */}
                {(() => {
                  let styleObj = {};
                  try { styleObj = JSON.parse(apiUser?.reply_style || '{}'); } catch(e) {}
                  
                  return (
                    <>
                      <div className="ds-section-header" style={{ marginBottom: -8 }}>
                        <span>ACTIVE VOICE & PERSONA CONFIGURATION</span>
                        <button
                          onClick={() => setShowSetupWizard(true)}
                          style={{ fontSize: 12, color: 'var(--accent-light)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                        >
                          Edit Configuration →
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--element-gap)' }}>
                        {/* Identity & Niche */}
                        <div className="ds-card">
                          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-light)', marginBottom: 12 }}>1. Identity & Niche</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--text-muted)' }}>Business Name:</span> <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginLeft: 4 }}>{styleObj.business_name || apiUser?.full_name || apiUser?.username || 'N/A'}</span></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>Industry:</span> <span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 4 }}>{styleObj.industry || 'General Content Creator'}</span></div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Target Audience:</span>
                              <p style={{ color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{styleObj.audience || 'Not specified'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Voice & Persona */}
                        <div className="ds-card">
                          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-light)', marginBottom: 12 }}>2. Voice & Persona</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
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
                        </div>
                      </div>

                      {/* Knowledge Base (full width) */}
                      <div className="ds-card">
                        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-light)', marginBottom: 12 }}>3. Knowledge Base & FAQs</div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{styleObj.knowledge || 'No custom knowledge base configured.'}</p>
                      </div>

                      {/* Safety & Guardrails (full width) */}
                      <div className="ds-card">
                        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-light)', marginBottom: 12 }}>4. Safety & Guardrails</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
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
                      </div>

                      {/* Active Settings Row (full width) */}
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
                    </>
                  );
                })()}

                {/* Comment Stream Section */}
                <div className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Tab Bar (underline style) */}
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

                  {/* Comment Cards */}
                  <div style={{ padding: 'var(--card-padding)' }}>
                    {(() => {
                      const filtered = apiComments.filter(c => inboxSubFilter === 'pending' ? !c.is_processed : c.is_processed);
                      if (filtered.length === 0) {
                        return (
                          <div style={{ padding: '48px 0', textAlign: 'center' }}>
                            <svg style={{ width: 32, height: 32, color: 'var(--text-muted)', margin: '0 auto 12px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-3.586 3.586a2 2 0 01-2.828 0L6 13" />
                            </svg>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                              No {inboxSubFilter === 'pending' ? 'pending comments waiting for approval' : 'posted comments history yet'}.
                            </p>
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
            ) : (
              /* ──── AUTOMATION LIST VIEW ──── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>
                <div>
                  <h1 className="ds-page-title">My Automations</h1>
                  <p className="ds-page-subtitle">Click any automation to view settings, analytics, and pending approval queue.</p>
                </div>

                {/* AI Reply Automation Card (Active) */}
                <div
                  onClick={() => {
                    if (apiUser && !apiUser.has_advanced_scopes) {
                      setShowScopePromptModal(true);
                    } else {
                      setSelectedAutomation('ai-reply');
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
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>AI Reply for Engagement</h3>
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

                {/* Coming Soon Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--element-gap)' }}>
                  {[
                    { icon: '💬', name: 'Comment-to-DM', desc: 'Auto-send DMs when users comment specific keywords.' },
                    { icon: '📸', name: 'Story Mention Reply', desc: 'Auto-thank users who mention you in their stories.' },
                  ].map((item) => (
                    <div key={item.name} className="ds-card" style={{ opacity: 0.6, position: 'relative' }}>
                      <span className="ds-badge ds-badge-muted" style={{ position: 'absolute', top: 16, right: 16, fontSize: 10 }}>Coming Soon</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
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
        {activeTab === 'settings' && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>
            <div>
              <h1 className="ds-page-title">Settings</h1>
              <p className="ds-page-subtitle">Manage your Instagram integration and account preferences.</p>
            </div>

            {/* Instagram Integration Card */}
            <div className="ds-card">
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Instagram Business Integration</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Meta Graph API access configuration</p>
              </div>

              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-button)', border: '1px solid var(--border)', padding: '4px 16px' }}>
                {/* Linked Account Row */}
                <div className="ds-row">
                  <span className="ds-row-label">Linked Account</span>
                  <span className="ds-row-value">
                    {apiUser?.username ? `@${apiUser.username}` : 'Not Connected'}
                  </span>
                </div>

                {/* AI Reply Tone Row */}
                <div className="ds-row">
                  <span className="ds-row-label">AI Reply Tone</span>
                  <select
                    value={apiUser?.reply_tone || 'friendly'}
                    onChange={(e) => handleUpdateTone(e.target.value)}
                    className="ds-select"
                    style={{ padding: '6px 10px', fontSize: 13 }}
                  >
                    <option value="friendly">Friendly & Casual</option>
                    <option value="professional">Professional</option>
                    <option value="hype">Hype & Energetic</option>
                    <option value="witty">Witty / Sarcastic</option>
                  </select>
                </div>

                {/* Auto-Reply Toggle Row */}
                <div className="ds-row">
                  <span className="ds-row-label">Auto-Reply Comments</span>
                  <button
                    onClick={toggleAutoReplySetting}
                    className={`ds-toggle ${apiUser?.auto_reply_enabled ? 'ds-toggle-on' : 'ds-toggle-off'}`}
                  >
                    <span className="ds-toggle-knob" />
                  </button>
                </div>

                {/* Connection Handshake Row */}
                <div className="ds-row">
                  <span className="ds-row-label">Connection Handshake</span>
                  {isInstagramConnected ? (
                    <span className="ds-badge ds-badge-success">Handshake Active</span>
                  ) : (
                    <button onClick={handleConnectInstagram} className="ds-btn-primary-sm">
                      Connect Instagram
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Notification Preferences Card */}
            <div className="ds-card">
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Notification Preferences</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Configure how you receive alerts</p>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-button)', border: '1px solid var(--border)', padding: '4px 16px' }}>
                <div className="ds-row">
                  <span className="ds-row-label">New comment alerts</span>
                  <button className="ds-toggle ds-toggle-on">
                    <span className="ds-toggle-knob" />
                  </button>
                </div>
                <div className="ds-row">
                  <span className="ds-row-label">AI reply failures</span>
                  <button className="ds-toggle ds-toggle-on">
                    <span className="ds-toggle-knob" />
                  </button>
                </div>
                <div className="ds-row">
                  <span className="ds-row-label">Weekly analytics digest</span>
                  <button className="ds-toggle ds-toggle-off">
                    <span className="ds-toggle-knob" />
                  </button>
                </div>
              </div>
            </div>

            {/* Danger Zone Card */}
            <div className="ds-danger-card">
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--error)' }}>Danger Zone</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Irreversible actions for your account</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Disconnect Instagram Account</span>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Remove your linked Instagram business account. You can reconnect anytime.</p>
                </div>
                <button className="ds-btn-danger">
                  Disconnect
                </button>
              </div>
            </div>
          </motion.div>
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

              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-light)', marginBottom: 8 }}>
                Gemini Analysis Summary
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
                        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--radius-button)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Main Topic</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-light)', marginTop: 6 }}>
                            {selectedReel.summary.ai_summary?.topic || 'Not extracted'}
                          </div>
                        </div>

                        <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--radius-button)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Key Points</div>
                          <ul style={{ listStyleType: 'decimal', paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
                            {selectedReel.summary.key_points && selectedReel.summary.key_points.length > 0 ? (
                              selectedReel.summary.key_points.map((pt, idx) => <li key={idx} style={{ marginBottom: 6 }}>{pt}</li>)
                            ) : (
                              <li>No key takeaways extracted.</li>
                            )}
                          </ul>
                        </div>

                        {selectedReel.summary.faq && selectedReel.summary.faq.length > 0 && (
                          <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--radius-button)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 12 }}>Anticipated FAQs</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                              {selectedReel.summary.faq.map((item, idx) => (
                                <div key={idx} style={{ fontSize: 13, borderLeft: '2px solid var(--accent)', paddingLeft: 12, lineHeight: 1.5 }}>
                                  <p style={{ fontWeight: 600, color: 'var(--accent-light)' }}>Q: {item.question || item.q}</p>
                                  <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>A: {item.answer || item.a}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedReel.summary.ai_summary?.realtime_context && (
                          <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--radius-button)', border: '1px solid var(--border)' }}>
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
                setShowSetupWizard(false);
                loadDashboardData();
              }}
              onConnect={handleConnectInstagram}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADVANCED SCOPE PROMPT MODAL */}
      <AnimatePresence>
        {showScopePromptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(10,10,15,0.85)',
              backdropFilter: 'blur(12px)',
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
                maxWidth: 460,
                width: '100%',
                textAlign: 'center',
                padding: '32px 24px',
                border: '1px solid rgba(124,58,237,0.3)',
                background: 'var(--bg-card)'
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                Advanced Permissions Required
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 28 }}>
                AI auto-replies require comment management permissions to draft and publish replies under your posts. Reconnect your Instagram account via Meta to grant these permissions.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => {
                    setShowScopePromptModal(false);
                    handleConnectAdvancedInstagram();
                  }}
                  className="ds-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', gap: 8 }}
                >
                  Authorize Comment Management
                </button>
                <button
                  onClick={() => setShowScopePromptModal(false)}
                  className="ds-btn-ghost"
                  style={{ width: '100%', justifyContent: 'center' }}
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
