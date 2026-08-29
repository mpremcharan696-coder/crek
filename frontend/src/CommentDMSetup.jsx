import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchDMRules, upsertDMRule, deleteDMRule, simulateDM } from './api';

export default function CommentDMSetup({ apiUser, apiReels, onBack, onSyncReels }) {
  // Loading & Action State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Rules list from backend
  const [rules, setRules] = useState([]);
  const [activeReelScope, setActiveReelScope] = useState('global'); // 'global' | reel_id (number)

  // Form State (for currently edited scope)
  const [isEnabled, setIsEnabled] = useState(true);
  const [triggerType, setTriggerType] = useState('keyword'); // 'keyword' | 'all_comments'
  const [keywordInput, setKeywordInput] = useState('link,guide,claude');
  const [deliveryMode, setDeliveryMode] = useState('interactive_button'); // 'interactive_button' | 'direct_link'
  const [initialMessage, setInitialMessage] = useState("Want to use claude without paying?\n\nClick below and I'll send you the link in a moment. ✨");
  const [buttonText, setButtonText] = useState('Send me the link');
  const [payloadMessage, setPayloadMessage] = useState('Here is your step-by-step guide & link:');
  const [payloadUrl, setPayloadUrl] = useState('https://example.com/claude-guide');
  const [maxDmsPerReel, setMaxDmsPerReel] = useState(0); // 0 = unlimited

  // Interactive Simulator State
  const [simStep, setSimStep] = useState(1); // 1 = initial prompt with button, 2 = user clicked button & link delivered
  const [simComment, setSimComment] = useState('claude');

  // Load Rules from Backend
  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await fetchDMRules();
      setRules(data);

      // Find global rule
      const globalRule = data.find((r) => r.reel_id === null);
      if (globalRule) {
        populateForm(globalRule);
      }
    } catch (err) {
      console.warn('Failed to load DM rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const populateForm = (rule) => {
    setIsEnabled(rule.is_enabled !== false);
    setTriggerType(rule.trigger_type || 'keyword');
    setKeywordInput(rule.trigger_keywords || 'link,guide');
    setDeliveryMode(rule.delivery_mode || 'interactive_button');
    setInitialMessage(rule.initial_message || "Want to get the link? Click below and I'll send it in a moment. ✨");
    setButtonText(rule.button_text || 'Send me the link');
    setPayloadMessage(rule.payload_message || 'Here is your step-by-step guide & link:');
    setPayloadUrl(rule.payload_url || '');
    setMaxDmsPerReel(rule.max_dms_per_reel || 0);
  };

  const handleSelectScope = (scope) => {
    setActiveReelScope(scope);
    setSimStep(1);

    if (scope === 'global') {
      const globalRule = rules.find((r) => r.reel_id === null);
      if (globalRule) {
        populateForm(globalRule);
      } else {
        // Reset to default
        setIsEnabled(true);
        setTriggerType('keyword');
        setKeywordInput('link,guide');
        setDeliveryMode('interactive_button');
        setInitialMessage("Want to get the link? Click below and I'll send you the details in a moment. ✨");
        setButtonText('Send me the link');
        setPayloadMessage('Here is your step-by-step guide & link:');
        setPayloadUrl('');
        setMaxDmsPerReel(0);
      }
    } else {
      // Per-reel scope
      const reelRule = rules.find((r) => r.reel_id === scope);
      if (reelRule) {
        populateForm(reelRule);
      } else {
        // Prefill from global rule or defaults
        const globalRule = rules.find((r) => r.reel_id === null);
        if (globalRule) {
          populateForm(globalRule);
        }
      }
    }
  };

  const showToast = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  // Save / Upsert Rule
  const handleSaveRule = async () => {
    setSaving(true);
    try {
      const currentRule = activeReelScope === 'global'
        ? rules.find((r) => r.reel_id === null)
        : rules.find((r) => r.reel_id === activeReelScope);

      const payload = {
        id: currentRule ? currentRule.id : null,
        reel_id: activeReelScope === 'global' ? null : activeReelScope,
        is_enabled: isEnabled,
        trigger_type: triggerType,
        trigger_keywords: keywordInput,
        delivery_mode: deliveryMode,
        initial_message: initialMessage.trim() || "Want to get the link? Click below and I'll send it to you in a moment. ✨",
        button_text: buttonText.trim() || 'Send me the link',
        payload_message: payloadMessage.trim() || 'Here is your link:',
        payload_url: payloadUrl.trim(),
        max_dms_per_reel: parseInt(maxDmsPerReel) || 0,
      };

      const saved = await upsertDMRule(payload);
      showToast('Comment-to-DM automation saved successfully! ✨');
      await loadRules();
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to save rule'}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete Custom Reel Rule (reverts to global)
  const handleDeleteCustomRule = async (ruleId) => {
    try {
      await deleteDMRule(ruleId);
      showToast('Custom reel rule removed (reverted to global rule)');
      await loadRules();
      handleSelectScope('global');
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to remove rule'}`);
    }
  };

  const activeReelObj = activeReelScope !== 'global'
    ? apiReels.find((r) => r.id === activeReelScope)
    : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', color: 'var(--text-primary)', paddingBottom: 60 }}>
      {/* Toast Notification */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            style={{
              position: 'fixed', top: 20, right: 24, zIndex: 100,
              padding: '12px 18px', borderRadius: 'var(--radius-card)',
              border: `1px solid ${actionMessage.toLowerCase().startsWith('error') ? 'rgba(237,73,86,0.3)' : 'var(--border)'}`,
              background: '#FFFFFF',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 14, fontWeight: 500,
              color: actionMessage.toLowerCase().startsWith('error') ? 'var(--error)' : 'var(--text-primary)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: actionMessage.toLowerCase().startsWith('error') ? 'var(--error)' : 'var(--success)' }} />
            <span>{actionMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navbar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: '#FFFFFF',
        borderBottom: '1px solid var(--border)',
        padding: '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onBack}
            className="ds-btn-ghost"
            style={{ padding: '8px 12px', fontSize: 13, gap: 6 }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Automations</span>
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>💬 Comment-to-DM Automation</span>
              <span className={`ds-badge ${isEnabled ? 'ds-badge-success' : 'ds-badge-muted'}`} style={{ fontSize: 11 }}>
                {isEnabled ? '● Active' : '○ Paused'}
              </span>
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              Auto-send private Instagram DMs with interactive buttons or direct links when followers comment.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Master Enable/Pause Switch */}
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`ds-btn-ghost ${isEnabled ? 'ds-toggle-on' : ''}`}
            style={{ fontSize: 12, padding: '8px 14px' }}
          >
            {isEnabled ? 'Automation Enabled' : 'Paused'}
          </button>

          <button
            onClick={handleSaveRule}
            disabled={saving}
            className="ds-btn-primary"
            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600 }}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </header>

      {/* Main Content Layout (2 Columns: Editor + Live Phone Simulator) */}
      <div style={{ width: '100%', maxWidth: '100%', padding: '32px 48px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Scope Selector Banner */}
        <div className="ds-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, background: '#FFFFFF' }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Targeting Scope
            </span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
              {activeReelScope === 'global' ? '🌐 Global Rule (Applies to All Reels by Default)' : `🎬 Custom Rule for Reel #${activeReelScope}`}
            </h2>
            {activeReelObj && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                "{activeReelObj.caption || 'Reel without caption'}"
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleSelectScope('global')}
              className={activeReelScope === 'global' ? 'ds-btn-primary-sm' : 'ds-btn-ghost-sm'}
            >
              Global Default Rule
            </button>
            {activeReelScope !== 'global' && (
              <button
                onClick={() => {
                  const rule = rules.find((r) => r.reel_id === activeReelScope);
                  if (rule) handleDeleteCustomRule(rule.id);
                  else handleSelectScope('global');
                }}
                className="ds-btn-ghost-sm"
                style={{ color: 'var(--error)' }}
              >
                Revert to Global
              </button>
            )}
          </div>
        </div>

        {/* Split Grid: Rule Settings & Phone Mockup */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 32, alignItems: 'start' }}>

          {/* ═════════ LEFT COLUMN: CONFIGURATION ═════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* 1. Trigger Conditions */}
            <div className="ds-card" style={{ background: '#FFFFFF' }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>1. Comment Trigger Condition</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Choose what triggers the automated private DM</p>
              </div>

              {/* Trigger Type Radio Options */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div
                  onClick={() => setTriggerType('keyword')}
                  style={{
                    padding: '14px 16px', borderRadius: 'var(--radius-button)',
                    border: `1.5px solid ${triggerType === 'keyword' ? 'var(--accent)' : 'var(--border)'}`,
                    background: triggerType === 'keyword' ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>🏷️</span> Specific Keywords
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Triggers only when comments contain specific words (e.g. <code>CLAUDE</code>, <code>LINK</code>).
                  </p>
                </div>

                <div
                  onClick={() => setTriggerType('all_comments')}
                  style={{
                    padding: '14px 16px', borderRadius: 'var(--radius-button)',
                    border: `1.5px solid ${triggerType === 'all_comments' ? 'var(--accent)' : 'var(--border)'}`,
                    background: triggerType === 'all_comments' ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>⚡</span> All Comments
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    No keyword needed — EVERY comment on the reel automatically triggers a DM.
                  </p>
                </div>
              </div>

              {triggerType === 'keyword' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    Trigger Keywords (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="e.g. link, claude, guide, prompt, price"
                    className="ds-input"
                    style={{ fontSize: 13 }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Followers can comment any of these keywords (case-insensitive) to receive the DM.
                  </span>
                </div>
              )}
            </div>

            {/* 2. Delivery Flow & Messages */}
            <div className="ds-card" style={{ background: '#FFFFFF' }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>2. Delivery Flow & Messages</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Configure how the DM is delivered</p>
              </div>

              {/* Delivery Mode Radios */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div
                  onClick={() => { setDeliveryMode('interactive_button'); setSimStep(1); }}
                  style={{
                    padding: '14px 16px', borderRadius: 'var(--radius-button)',
                    border: `1.5px solid ${deliveryMode === 'interactive_button' ? 'var(--accent)' : 'var(--border)'}`,
                    background: deliveryMode === 'interactive_button' ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>🔘</span> 2-Step Button (Recommended)
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Sends confirmation message with a button $\rightarrow$ follower taps button $\rightarrow$ link delivered.
                  </p>
                </div>

                <div
                  onClick={() => { setDeliveryMode('direct_link'); setSimStep(1); }}
                  style={{
                    padding: '14px 16px', borderRadius: 'var(--radius-button)',
                    border: `1.5px solid ${deliveryMode === 'direct_link' ? 'var(--accent)' : 'var(--border)'}`,
                    background: deliveryMode === 'direct_link' ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>🔗</span> Direct Link (1-Step)
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Immediately delivers message + link URL in the very first DM.
                  </p>
                </div>
              </div>

              {/* Message Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Initial DM Message */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    First DM Message Text
                  </label>
                  <textarea
                    rows={3}
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    placeholder="e.g. Want to use claude without paying? Click below and I'll send you the link in a moment. ✨"
                    className="ds-input"
                    style={{ fontSize: 13, resize: 'vertical' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    If left blank, defaults to a clean prompt asking them to tap the button below.
                  </span>
                </div>

                {deliveryMode === 'interactive_button' && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                      Button Label
                    </label>
                    <input
                      type="text"
                      value={buttonText}
                      onChange={(e) => setButtonText(e.target.value)}
                      placeholder="e.g. Send me the link"
                      className="ds-input"
                      style={{ fontSize: 13 }}
                    />
                  </div>
                )}

                {/* Delivered Payload Message */}
                {deliveryMode === 'interactive_button' && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                      Step 2: Message Sent After Clicking Button
                    </label>
                    <input
                      type="text"
                      value={payloadMessage}
                      onChange={(e) => setPayloadMessage(e.target.value)}
                      placeholder="e.g. Here is your step-by-step guide:"
                      className="ds-input"
                      style={{ fontSize: 13 }}
                    />
                  </div>
                )}

                {/* Delivered Link URL */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    Resource Link / Document URL to Deliver
                  </label>
                  <input
                    type="url"
                    value={payloadUrl}
                    onChange={(e) => setPayloadUrl(e.target.value)}
                    placeholder="https://yourwebsite.com/guide or Notion doc link"
                    className="ds-input"
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>
            </div>

            {/* 3. Limits & Caps */}
            <div className="ds-card" style={{ background: '#FFFFFF' }}>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>3. Rate Limits & DM Caps</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Cap the maximum number of automated DMs per reel</p>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Max DMs Limit (Enter number, or leave 0 for unlimited)
                </label>
                <input
                  type="number"
                  min="0"
                  value={maxDmsPerReel}
                  onChange={(e) => setMaxDmsPerReel(e.target.value)}
                  placeholder="e.g. 100"
                  className="ds-input"
                  style={{ width: 160, fontSize: 13 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  {maxDmsPerReel > 0 ? `Automation will automatically stop after sending ${maxDmsPerReel} DMs.` : 'Currently unlimited (sends to all qualifying comments).'}
                </span>
              </div>
            </div>
          </div>

          {/* ═════════ RIGHT COLUMN: LIVE INSTAGRAM DM PHONE SIMULATOR ═════════ */}
          <div style={{ position: 'sticky', top: 96 }}>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                📱 Live Instagram DM Preview
              </span>
              <button
                onClick={() => setSimStep(1)}
                className="ds-btn-ghost-sm"
                style={{ fontSize: 11 }}
              >
                Reset Simulator 🔄
              </button>
            </div>

            {/* Phone Container (Instagram Dark Mode Chat Frame) */}
            <div style={{
              width: '100%',
              maxWidth: 380,
              margin: '0 auto',
              borderRadius: 36,
              background: '#000000',
              border: '10px solid #1E1E24',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: 620,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              color: '#FFFFFF',
            }}>
              {/* Phone Status Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 6px', fontSize: 12, color: '#A8A8A8' }}>
                <span>2:31</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span>5G</span>
                  <span>🔋 85%</span>
                </div>
              </div>

              {/* Instagram DM Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #1A1A1A' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18 }}>←</span>
                  <img
                    src={apiUser?.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                    alt="Avatar"
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{apiUser?.username || 'snnubbo'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 16 }}>
                  <span>📞</span>
                  <span>📹</span>
                  <span>🏳️</span>
                </div>
              </div>

              {/* Chat Message Scroll Area */}
              <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Profile Summary Badge */}
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <img
                    src={apiUser?.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                    alt="Avatar"
                    style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 8px' }}
                  />
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{apiUser?.username || 'snnubbo'}</div>
                  <div style={{ fontSize: 12, color: '#737373', marginTop: 2 }}>
                    {apiUser?.followers_count ? `${(apiUser.followers_count / 1000).toFixed(0)}K` : '201K'} followers • {apiUser?.media_count || 110} posts
                  </div>
                </div>

                <div style={{ textAlign: 'center', fontSize: 11, color: '#737373' }}>
                  MON, 8:40 PM
                </div>

                {/* Subtitle Notice */}
                <div style={{ textAlign: 'center', fontSize: 11, color: '#0095F6', padding: '0 20px' }}>
                  <span style={{ color: '#737373' }}>{apiUser?.username || 'snnubbo'} messaged you about a comment you made on their post. </span>
                  <span style={{ cursor: 'pointer', fontWeight: 600 }}>See Post</span>
                </div>

                {/* STEP 1: Creator Prompt Card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', alignItems: 'flex-end', gap: 8, maxWidth: '85%' }}
                >
                  <img
                    src={apiUser?.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                    alt="Avatar"
                    style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginBottom: 4 }}
                  />
                  <div style={{
                    background: '#262626',
                    borderRadius: '18px 18px 18px 4px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}>
                    <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line' }}>
                      {initialMessage || "Want to use claude without paying?\n\nClick below and I'll send you the link in a moment. ✨"}
                    </p>

                    {deliveryMode === 'interactive_button' && (
                      <button
                        onClick={() => setSimStep(2)}
                        style={{
                          width: '100%',
                          background: '#363636',
                          border: 'none',
                          color: '#FFFFFF',
                          fontWeight: 600,
                          fontSize: 13,
                          padding: '10px 14px',
                          borderRadius: 12,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'background 0.2s',
                        }}
                      >
                        {buttonText || 'Send me the link'}
                      </button>
                    )}

                    {deliveryMode === 'direct_link' && payloadUrl && (
                      <a
                        href={payloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: '#0095F6',
                          color: '#FFFFFF',
                          padding: '8px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          textDecoration: 'none',
                          textAlign: 'center',
                          fontWeight: 600,
                        }}
                      >
                        Open Resource Link 🔗
                      </a>
                    )}
                  </div>
                </motion.div>

                {/* STEP 2: Follower Response & Final Payload Delivery */}
                <AnimatePresence>
                  {deliveryMode === 'interactive_button' && simStep === 2 && (
                    <>
                      {/* Follower Purple Response Bubble */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ alignSelf: 'flex-end', maxWidth: '75%' }}
                      >
                        <div style={{
                          background: '#7000FF',
                          borderRadius: '18px 18px 4px 18px',
                          padding: '10px 16px',
                          fontSize: 13,
                          fontWeight: 500,
                        }}>
                          {buttonText || 'Send me the link'}
                        </div>
                      </motion.div>

                      {/* Creator Delivered Link / Guide Card */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        style={{ display: 'flex', alignItems: 'flex-end', gap: 8, maxWidth: '85%' }}
                      >
                        <img
                          src={apiUser?.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                          alt="Avatar"
                          style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginBottom: 4 }}
                        />
                        <div style={{
                          background: '#262626',
                          borderRadius: '18px 18px 18px 4px',
                          padding: '12px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}>
                          <p style={{ fontSize: 13, margin: 0 }}>
                            {payloadMessage || 'Here is your step-by-step guide:'}
                          </p>
                          {payloadUrl && (
                            <a
                              href={payloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-block',
                                background: '#363636',
                                color: '#0095F6',
                                fontWeight: 600,
                                fontSize: 12,
                                padding: '8px 12px',
                                borderRadius: 8,
                                textDecoration: 'none',
                              }}
                            >
                              🔗 {payloadUrl}
                            </a>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Mock Bottom Input Bar */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid #1A1A1A', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0095F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                  📷
                </div>
                <div style={{ flex: 1, background: '#262626', borderRadius: 20, padding: '8px 14px', fontSize: 12, color: '#737373' }}>
                  Message...
                </div>
                <span style={{ fontSize: 16 }}>🎙️</span>
                <span style={{ fontSize: 16 }}>🖼️</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═════════ BOTTOM SECTION: ALL REELS MANAGEMENT ═════════ */}
        <div style={{ marginTop: 24 }}>
          <div className="ds-section-header" style={{ marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>ALL REELS COMMENT-TO-DM STATUS</span>
              <span className="ds-badge ds-badge-purple" style={{ marginLeft: 8, fontSize: 10 }}>{apiReels.length} REELS</span>
            </div>
            <button onClick={onSyncReels} className="ds-btn-ghost-sm">
              Sync Reels from Meta
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--element-gap)' }}>
            {apiReels.map((reel) => {
              const customRule = rules.find((r) => r.reel_id === reel.id);
              const isSelected = activeReelScope === reel.id;

              return (
                <div
                  key={reel.id}
                  className="ds-card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    boxShadow: isSelected ? '0 0 0 2px var(--accent-glow)' : 'none',
                  }}
                >
                  <div style={{ position: 'relative', height: 140, overflow: 'hidden' }}>
                    <img
                      src={reel.thumbnail_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80'}
                      alt="Thumbnail"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)' }} />

                    <span
                      className={`ds-badge ${customRule ? 'ds-badge-purple' : 'ds-badge-muted'}`}
                      style={{ position: 'absolute', top: 8, right: 8, fontSize: 10 }}
                    >
                      {customRule ? '⚡ Custom Rule' : '🌐 Global Rule'}
                    </span>
                  </div>

                  <div style={{ padding: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>
                      {reel.caption || 'No caption'}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                      <span>💬 {reel.comments_count || 0} comments</span>
                      <span>{customRule ? `Sent: ${customRule.sent_dm_count}` : 'Using global'}</span>
                    </div>

                    <button
                      onClick={() => handleSelectScope(reel.id)}
                      className={isSelected ? 'ds-btn-primary-sm' : 'ds-btn-ghost-sm'}
                      style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}
                    >
                      {isSelected ? 'Editing This Reel ✏️' : 'Customize Rule'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
