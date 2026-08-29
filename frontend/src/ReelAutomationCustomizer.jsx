import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchReelAutomationConfig,
  saveReelAutomationConfig,
  testReelCustomAPI,
  fetchDMRules,
  upsertDMRule,
  updateUserSettings,
} from './api';

export default function ReelAutomationCustomizer({ reel, apiUser, onBack, onSaveSuccess }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  
  // Main Automation Selection: 'ai-reply' | 'comment-to-dm'
  const [activeAutomation, setActiveAutomation] = useState('ai-reply');

  // AI Reply Scope: 'reel' | 'all_reels'
  const [aiApplyScope, setAiApplyScope] = useState('reel');

  // AI Reply Sub-Tabs: 'instructions' | 'knowledge' | 'api'
  const [aiSubTab, setAiSubTab] = useState('instructions');

  // AI Reply State
  const [aiReplyEnabled, setAiReplyEnabled] = useState(true);
  const [customInstructions, setCustomInstructions] = useState('');
  const [referenceKnowledge, setReferenceKnowledge] = useState('');
  
  // API Tool Calling State
  const [apiEnabled, setApiEnabled] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [apiMethod, setApiMethod] = useState('GET');
  const [apiHeadersText, setApiHeadersText] = useState('{\n  "Authorization": "Bearer YOUR_TOKEN"\n}');
  const [apiDocs, setApiDocs] = useState('');
  const [apiTriggerRule, setApiTriggerRule] = useState('');
  const [testingApi, setTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState(null);

  // Comment-to-DM State (Reel-Specific)
  const [commentDmEnabled, setCommentDmEnabled] = useState(false);
  const [dmTriggerType, setDmTriggerType] = useState('keyword'); // 'keyword' | 'all_comments'
  const [dmKeywords, setDmKeywords] = useState('link,guide');
  const [dmDeliveryMode, setDmDeliveryMode] = useState('interactive_button'); // 'interactive_button' | 'direct_link'
  const [dmInitialMessage, setDmInitialMessage] = useState("Want the resources mentioned in this reel? Click below and I'll send the link immediately! ✨");
  const [dmButtonText, setDmButtonText] = useState('Send me the link');
  const [dmPayloadMessage, setDmPayloadMessage] = useState('Here is your link and documentation:');
  const [dmPayloadUrl, setDmPayloadUrl] = useState('https://example.com/reel-resource');
  const [dmMaxLimit, setDmMaxLimit] = useState(0); // 0 = unlimited

  // "Don't ask me again" flag for Steps 1 & 2
  const [dontAskSteps1And2, setDontAskSteps1And2] = useState(() => {
    return localStorage.getItem('crek_dm_dont_ask_steps_1_2') === 'true';
  });
  const [showStep1And2Expanded, setShowStep1And2Expanded] = useState(false);

  // DM Simulator State
  const [dmSimStep, setDmSimStep] = useState(1); // 1 = initial prompt with button, 2 = user clicked button & link delivered

  useEffect(() => {
    if (!reel?.id) return;
    loadAllConfigs();
  }, [reel?.id]);

  const loadAllConfigs = async () => {
    setLoading(true);
    try {
      // 1. Load AI Reply / API Config
      const autoData = await fetchReelAutomationConfig(reel.id);
      setAiReplyEnabled(autoData.ai_reply_enabled ?? true);
      setCommentDmEnabled(autoData.comment_dm_enabled ?? false);
      setCustomInstructions(autoData.custom_instructions || '');
      setReferenceKnowledge(autoData.reference_knowledge || '');
      setApiEnabled(autoData.api_enabled ?? false);
      setApiEndpoint(autoData.api_endpoint || '');
      setApiMethod(autoData.api_method || 'GET');
      if (autoData.api_headers && Object.keys(autoData.api_headers).length > 0) {
        setApiHeadersText(JSON.stringify(autoData.api_headers, null, 2));
      }
      setApiDocs(autoData.api_docs || '');
      setApiTriggerRule(autoData.api_trigger_rule || '');

      // 2. Load DM Rule for this Reel if exists
      const dmRulesData = await fetchDMRules();
      const reelRule = dmRulesData.find((r) => r.reel_id === reel.id);
      if (reelRule) {
        setCommentDmEnabled(reelRule.is_enabled !== false);
        setDmTriggerType(reelRule.trigger_type || 'keyword');
        setDmKeywords(reelRule.trigger_keywords || 'link,guide');
        setDmDeliveryMode(reelRule.delivery_mode || 'interactive_button');
        setDmInitialMessage(reelRule.initial_message || "Want the resources? Click below and I'll send the link immediately! ✨");
        setDmButtonText(reelRule.button_text || 'Send me the link');
        setDmPayloadMessage(reelRule.payload_message || 'Here is your link and documentation:');
        setDmPayloadUrl(reelRule.payload_url || '');
        setDmMaxLimit(reelRule.max_dms_per_reel || 0);
      } else {
        // Prefill from saved defaults in localStorage if available
        const savedTrigger = localStorage.getItem('crek_dm_default_trigger_type');
        const savedKeywords = localStorage.getItem('crek_dm_default_keywords');
        const savedDelivery = localStorage.getItem('crek_dm_default_delivery_mode');
        if (savedTrigger) setDmTriggerType(savedTrigger);
        if (savedKeywords) setDmKeywords(savedKeywords);
        if (savedDelivery) setDmDeliveryMode(savedDelivery);
      }
    } catch (err) {
      console.warn('Failed to load reel configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveMessage(null);

    let parsedHeaders = null;
    if (apiHeadersText.trim()) {
      try {
        parsedHeaders = JSON.parse(apiHeadersText);
      } catch {
        alert('Invalid JSON in API Headers. Please format it as valid JSON (e.g. {"Authorization": "Bearer ..."})');
        setSaving(false);
        return;
      }
    }

    try {
      // 1. Save AI Reply / API Config
      await saveReelAutomationConfig(reel.id, {
        ai_reply_enabled: aiReplyEnabled,
        comment_dm_enabled: commentDmEnabled,
        custom_instructions: customInstructions,
        reference_knowledge: referenceKnowledge,
        api_enabled: apiEnabled,
        api_endpoint: apiEndpoint,
        api_method: apiMethod,
        api_headers: parsedHeaders,
        api_docs: apiDocs,
        api_trigger_rule: apiTriggerRule,
      });

      // If user selected "All Reels (Global Default)" for AI reply:
      if (aiApplyScope === 'all_reels') {
        let existingStyle = {};
        try {
          existingStyle = JSON.parse(apiUser?.reply_style || '{}');
        } catch {}

        existingStyle.knowledge = referenceKnowledge;
        existingStyle.custom_instructions = customInstructions;
        if (apiEnabled) {
          existingStyle.global_api = {
            endpoint: apiEndpoint,
            method: apiMethod,
            headers: parsedHeaders,
            docs: apiDocs,
            trigger_rule: apiTriggerRule,
          };
        }

        await updateUserSettings({
          reply_style: JSON.stringify(existingStyle),
        });
      }

      // 2. Save Comment-to-DM Rule specifically for this reel
      await upsertDMRule({
        reel_id: reel.id,
        is_enabled: commentDmEnabled,
        trigger_type: dmTriggerType,
        trigger_keywords: dmTriggerType === 'keyword' ? dmKeywords : null,
        delivery_mode: dmDeliveryMode,
        initial_message: dmInitialMessage,
        button_text: dmDeliveryMode === 'interactive_button' ? dmButtonText : null,
        payload_message: dmPayloadMessage,
        payload_url: dmPayloadUrl,
        max_dms_per_reel: parseInt(dmMaxLimit) || 0,
      });

      // Save defaults if "Don't ask me again" is checked
      if (dontAskSteps1And2) {
        localStorage.setItem('crek_dm_dont_ask_steps_1_2', 'true');
        localStorage.setItem('crek_dm_default_trigger_type', dmTriggerType);
        localStorage.setItem('crek_dm_default_keywords', dmKeywords);
        localStorage.setItem('crek_dm_default_delivery_mode', dmDeliveryMode);
      } else {
        localStorage.removeItem('crek_dm_dont_ask_steps_1_2');
      }

      setSaveMessage({
        type: 'success',
        text: aiApplyScope === 'all_reels'
          ? 'Settings saved globally for ALL reels and applied to this reel! 🚀'
          : 'Custom automation settings saved for this reel! 💾',
      });
      setTimeout(() => setSaveMessage(null), 4000);
      if (onSaveSuccess) onSaveSuccess();
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.message || 'Failed to save configuration.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestAPI = async () => {
    if (!apiEndpoint.trim()) {
      alert('Please enter an API endpoint URL first.');
      return;
    }

    let parsedHeaders = null;
    if (apiHeadersText.trim()) {
      try {
        parsedHeaders = JSON.parse(apiHeadersText);
      } catch {
        alert('Invalid JSON in API Headers.');
        return;
      }
    }

    setTestingApi(true);
    setApiTestResult(null);

    try {
      const res = await testReelCustomAPI(reel.id, {
        api_endpoint: apiEndpoint,
        api_method: apiMethod,
        api_headers: parsedHeaders,
        test_params: { sample: 'test' },
      });
      setApiTestResult(res);
    } catch (err) {
      setApiTestResult({ success: false, error: err.message || 'Network request failed' });
    } finally {
      setTestingApi(false);
    }
  };

  const handleFileUpload = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        if (field === 'knowledge') {
          setReferenceKnowledge((prev) => (prev ? prev + '\n\n' + content : content));
        } else if (field === 'docs') {
          setApiDocs(content);
        }
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>Loading Reel Automation Studio...</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: '100%' }}
    >
      {/* ═══════════════ TOP HEADER & ACTIONS ═══════════════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
            color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-button)', padding: '8px 14px', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saveMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`ds-badge ${saveMessage.type === 'success' ? 'ds-badge-success' : 'ds-badge-error'}`}
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              {saveMessage.text}
            </motion.div>
          )}
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="ds-btn-primary"
            style={{ padding: '8px 24px', fontSize: 13, fontWeight: 600 }}
          >
            {saving ? 'Saving Changes...' : 'Save Settings 💾'}
          </button>
        </div>
      </div>

      {/* ═══════════════ REEL HERO BANNER ═══════════════ */}
      <div className="ds-card" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: 18, background: 'linear-gradient(135deg, rgba(22,22,31,0.9), rgba(124,58,237,0.06))', borderColor: 'rgba(124,58,237,0.2)' }}>
        <img
          src={reel?.thumbnail_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80'}
          alt="Reel Thumbnail"
          style={{ width: 76, height: 100, objectFit: 'cover', borderRadius: 'var(--radius-button)', border: '1px solid var(--border)' }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="ds-badge ds-badge-purple" style={{ fontSize: 10 }}>Reel ID: #{reel?.id}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Published {reel?.published_at ? new Date(reel.published_at).toLocaleDateString() : 'Recently'}
            </span>
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
            {reel?.caption || 'Untitled Reel'}
          </h2>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>❤️ {reel?.like_count || 0} Likes</span>
            <span>💬 {reel?.comments_count || 0} Comments</span>
          </div>
        </div>
      </div>

      {/* ═══════════════ TWO AUTOMATION OPTIONS FOR THIS REEL ═══════════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
          Automations For This Reel
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* Option 1: AI Reply Card */}
          <div
            onClick={() => setActiveAutomation('ai-reply')}
            className="ds-card"
            style={{
              padding: 16,
              cursor: 'pointer',
              borderColor: activeAutomation === 'ai-reply' ? 'var(--accent)' : 'var(--border)',
              background: activeAutomation === 'ai-reply' ? 'var(--accent-glow)' : 'var(--bg-card)',
              boxShadow: activeAutomation === 'ai-reply' ? '0 0 16px rgba(124,58,237,0.2)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>🤖</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    AI Comment Reply {activeAutomation === 'ai-reply' && <span className="ds-badge ds-badge-purple" style={{ fontSize: 9 }}>Selected</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Custom instructions, reference docs & external API</div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAiReplyEnabled(!aiReplyEnabled);
                }}
                className={`ds-toggle ${aiReplyEnabled ? 'ds-toggle-on' : 'ds-toggle-off'}`}
                style={{ width: 44, height: 24, flexShrink: 0 }}
              >
                <span className="ds-toggle-knob" style={{ width: 20, height: 20 }} />
              </button>
            </div>
          </div>

          {/* Option 2: Comment-to-DM Card */}
          <div
            onClick={() => setActiveAutomation('comment-to-dm')}
            className="ds-card"
            style={{
              padding: 16,
              cursor: 'pointer',
              borderColor: activeAutomation === 'comment-to-dm' ? '#0095F6' : 'var(--border)',
              background: activeAutomation === 'comment-to-dm' ? 'rgba(0,149,246,0.08)' : 'var(--bg-card)',
              boxShadow: activeAutomation === 'comment-to-dm' ? '0 0 16px rgba(0,149,246,0.2)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>⚡</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Comment-to-DM {activeAutomation === 'comment-to-dm' && <span className="ds-badge ds-badge-success" style={{ fontSize: 9 }}>Selected</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Send automated link/doc DMs on keywords</div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCommentDmEnabled(!commentDmEnabled);
                }}
                className={`ds-toggle ${commentDmEnabled ? 'ds-toggle-on' : 'ds-toggle-off'}`}
                style={{ width: 44, height: 24, flexShrink: 0 }}
              >
                <span className="ds-toggle-knob" style={{ width: 20, height: 20 }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ STUDIO SECTION 1: AI REPLY CUSTOMIZER ═══════════════ */}
      {activeAutomation === 'ai-reply' && (
        <div className="ds-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 🌟 Scope Selector: Is this for a specific reel or all reels? */}
          <div style={{ padding: 14, background: 'rgba(124,58,237,0.05)', borderRadius: 'var(--radius-card)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-light)' }}>
              🎯 Apply Custom Instructions, Reference Knowledge & API to:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              <label
                onClick={() => setAiApplyScope('reel')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-button)',
                  border: aiApplyScope === 'reel' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: aiApplyScope === 'reel' ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input type="radio" checked={aiApplyScope === 'reel'} onChange={() => {}} style={{ accentColor: 'var(--accent)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>This Specific Reel Only (#{reel?.id})</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Context & API tools apply only to comments on this video</div>
                </div>
              </label>

              <label
                onClick={() => setAiApplyScope('all_reels')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-button)',
                  border: aiApplyScope === 'all_reels' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: aiApplyScope === 'all_reels' ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input type="radio" checked={aiApplyScope === 'all_reels'} onChange={() => {}} style={{ accentColor: 'var(--accent)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>All Reels (Global Default) 🚀</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Every reel will inherit this reference data & API key</div>
                </div>
              </label>
            </div>
          </div>

          {/* Sub Tab Navigation */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 12, overflowX: 'auto' }}>
            <button
              onClick={() => setAiSubTab('instructions')}
              className={`ds-tab-btn ${aiSubTab === 'instructions' ? 'ds-tab-active' : ''}`}
              style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>📝</span> {aiApplyScope === 'all_reels' ? 'Global Instructions' : 'Reel AI Instructions'}
            </button>

            <button
              onClick={() => setAiSubTab('knowledge')}
              className={`ds-tab-btn ${aiSubTab === 'knowledge' ? 'ds-tab-active' : ''}`}
              style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>📚</span> {aiApplyScope === 'all_reels' ? 'Global Reference Material' : 'Reference Material & Docs'}
            </button>

            <button
              onClick={() => setAiSubTab('api')}
              className={`ds-tab-btn ${aiSubTab === 'api' ? 'ds-tab-active' : ''}`}
              style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>🔌</span> Custom API & Docs Guide {apiEnabled && <span className="ds-badge ds-badge-success" style={{ fontSize: 9 }}>Active</span>}
            </button>
          </div>

          {/* ──── SUB-TAB 1: REEL INSTRUCTIONS ──── */}
          {aiSubTab === 'instructions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {aiApplyScope === 'all_reels' ? 'Global Prompt & Guidelines for All Reels' : 'Reel-Specific Prompt & Guidelines'}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                  {aiApplyScope === 'all_reels'
                    ? 'These guidelines will be followed across all comments on every reel.'
                    : 'Give the AI specific instructions for comments on this video only.'}
                </p>
              </div>

              <textarea
                rows={6}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g. In this video I discuss the new sneaker release. Tell commenters they drop this Friday at 10 AM EST. Do not quote old pricing. If they ask about shipping, say standard shipping is 2-4 business days."
                className="ds-input"
                style={{ width: '100%', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }}
              />

              {/* Quick Template Chips */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                  Quick Prompts to Add:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    "Emphasize limited quantity (only 50 units available).",
                    "Direct users to check our bio link for the discount code.",
                    "Politely decline questions about investment advice.",
                    "Keep all replies short (under 2 sentences) and friendly.",
                  ].map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setCustomInstructions((prev) => (prev ? prev + ' ' + prompt : prompt))}
                      className="ds-btn-ghost-sm"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                    >
                      + {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ──── SUB-TAB 2: REFERENCE MATERIAL & KNOWLEDGE BASE ──── */}
          {aiSubTab === 'knowledge' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {aiApplyScope === 'all_reels' ? 'Global Reference Material & Product Sheets' : 'Reference Knowledge & Product Sheets'}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                    Paste product specs, price sheets, event dates, FAQs, or upload documentation for the AI to refer to.
                  </p>
                </div>

                <label className="ds-btn-ghost-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  📄 Upload Doc (.txt / .md / .json)
                  <input
                    type="file"
                    accept=".txt,.md,.json,.csv"
                    onChange={(e) => handleFileUpload(e, 'knowledge')}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              <textarea
                rows={8}
                value={referenceKnowledge}
                onChange={(e) => setReferenceKnowledge(e.target.value)}
                placeholder="Paste product specs, pricing tables, launch details, links, or specific FAQs here...&#10;&#10;Product: Apex Runner 2.0&#10;Price: $149&#10;Sizes: US 7 to 13&#10;Colors: Midnight Black, Electric Blue"
                className="ds-input"
                style={{ width: '100%', fontSize: 13, lineHeight: 1.5, fontFamily: 'monospace', resize: 'vertical' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {referenceKnowledge.length} characters of custom reference context attached.
              </span>
            </div>
          )}

          {/* ──── SUB-TAB 3: CUSTOM API & REQUIRED DOCS GUIDE ──── */}
          {aiSubTab === 'api' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Enable Custom API Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-button)', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Enable Live API Tool Calling {aiApplyScope === 'all_reels' ? '(Global for All Reels)' : 'for this Reel'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Allows AI to dynamically fetch real-time inventory, booking availability, or pricing from your external API.
                  </div>
                </div>
                <button
                  onClick={() => setApiEnabled(!apiEnabled)}
                  className={`ds-toggle ${apiEnabled ? 'ds-toggle-on' : 'ds-toggle-off'}`}
                  style={{ width: 44, height: 24, flexShrink: 0 }}
                >
                  <span className="ds-toggle-knob" style={{ width: 20, height: 20 }} />
                </button>
              </div>

              {apiEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  {/* 1. Endpoint & Method */}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        Method
                      </label>
                      <select
                        value={apiMethod}
                        onChange={(e) => setApiMethod(e.target.value)}
                        className="ds-select"
                        style={{ width: '100%', fontSize: 13 }}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        API Endpoint URL *
                      </label>
                      <input
                        type="url"
                        value={apiEndpoint}
                        onChange={(e) => setApiEndpoint(e.target.value)}
                        placeholder="https://api.yourbrand.com/v1/inventory/status"
                        className="ds-input"
                        style={{ width: '100%', fontSize: 13 }}
                      />
                    </div>
                  </div>

                  {/* 2. Custom Headers & Auth */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                      Request Headers / Auth Tokens (JSON format)
                    </label>
                    <textarea
                      rows={3}
                      value={apiHeadersText}
                      onChange={(e) => setApiHeadersText(e.target.value)}
                      placeholder='{"Authorization": "Bearer YOUR_SECRET_KEY"}'
                      className="ds-input"
                      style={{ width: '100%', fontSize: 12, fontFamily: 'monospace' }}
                    />
                  </div>

                  {/* 3. API Documentation / Guide (Mandatory for LLM understanding) */}
                  <div style={{ padding: 16, background: 'rgba(124,58,237,0.04)', borderRadius: 'var(--radius-button)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📋</span> API Documentation & Schema Guide (Required)
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          The AI reads this documentation to know what parameters to send and how to interpret the response.
                        </div>
                      </div>

                      <label className="ds-btn-ghost-sm" style={{ cursor: 'pointer', fontSize: 11, padding: '4px 10px' }}>
                        Upload OpenAPI / Docs (.json/.yaml)
                        <input
                          type="file"
                          accept=".json,.yaml,.yml,.txt,.md"
                          onChange={(e) => handleFileUpload(e, 'docs')}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>

                    <textarea
                      rows={6}
                      value={apiDocs}
                      onChange={(e) => setApiDocs(e.target.value)}
                      placeholder="Paste Swagger / OpenAPI spec, curl request example, or parameter guide:&#10;&#10;GET /inventory?item_id={string}&size={number}&#10;Response: { in_stock: boolean, remaining_qty: number, price: number }"
                      className="ds-input"
                      style={{ width: '100%', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.4 }}
                    />
                  </div>

                  {/* 4. Trigger Rule */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                      When should the AI call this API? (Trigger Rule)
                    </label>
                    <input
                      type="text"
                      value={apiTriggerRule}
                      onChange={(e) => setApiTriggerRule(e.target.value)}
                      placeholder="e.g. Call this API when comments ask if specific sizes/colors are in stock or available for pickup."
                      className="ds-input"
                      style={{ width: '100%', fontSize: 13 }}
                    />
                  </div>

                  {/* 5. Live Test Tool */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                    <button
                      onClick={handleTestAPI}
                      disabled={testingApi || !apiEndpoint.trim()}
                      className="ds-btn-ghost-sm"
                      style={{ padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {testingApi ? 'Testing API...' : '🧪 Test API Connection'}
                    </button>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Verifies that the endpoint responds with valid 200 OK data.
                    </span>
                  </div>

                  {/* Test Result Display */}
                  {apiTestResult && (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 'var(--radius-button)',
                        background: apiTestResult.success ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${apiTestResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        fontSize: 12,
                        fontFamily: 'monospace',
                        overflowX: 'auto',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: apiTestResult.success ? 'var(--success)' : 'var(--error)', marginBottom: 4 }}>
                        {apiTestResult.success ? `✓ HTTP ${apiTestResult.status_code} Success` : `✕ Connection Failed: ${apiTestResult.error || `HTTP ${apiTestResult.status_code}`}`}
                      </div>
                      {apiTestResult.response_data && (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                          {typeof apiTestResult.response_data === 'object' ? JSON.stringify(apiTestResult.response_data, null, 2) : apiTestResult.response_data}
                        </pre>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ STUDIO SECTION 2: COMMENT-TO-DM CUSTOMIZER (CLONED FROM COMMENTDMSETUP) ═══════════════ */}
      {activeAutomation === 'comment-to-dm' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 28, alignItems: 'start' }}>
          {/* ── LEFT COLUMN: REEL DM FORM SETTINGS ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            
            {/* 🌟 Collapsed Step 1 & 2 view if "Don't ask me again" is active */}
            {dontAskSteps1And2 && !showStep1And2Expanded ? (
              <div style={{ padding: '14px 16px', background: 'rgba(0,149,246,0.06)', borderRadius: 'var(--radius-card)', border: '1px solid rgba(0,149,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0095F6', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ✓ Steps 1 & 2 Auto-Configured
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Trigger: <strong>{dmTriggerType === 'keyword' ? `Keywords (${dmKeywords})` : 'All Comments'}</strong> • Mode: <strong>{dmDeliveryMode === 'interactive_button' ? '2-Step Button' : 'Direct Link'}</strong>
                  </div>
                </div>
                <button
                  onClick={() => setShowStep1And2Expanded(true)}
                  className="ds-btn-ghost-sm"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  Edit Steps 1 & 2 ▾
                </button>
              </div>
            ) : (
              <>
                {/* 1. Trigger Words Selection */}
                <div className="ds-card" style={{ padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0095F6', marginBottom: 12 }}>
                    1. Trigger Conditions for This Reel
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label
                      onClick={() => setDmTriggerType('keyword')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-button)',
                        border: dmTriggerType === 'keyword' ? '1.5px solid #0095F6' : '1px solid var(--border)',
                        background: dmTriggerType === 'keyword' ? 'rgba(0,149,246,0.06)' : 'var(--bg-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <input type="radio" checked={dmTriggerType === 'keyword'} onChange={() => {}} style={{ accentColor: '#0095F6' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Specific Keywords Trigger DM</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Only comments containing your trigger words will receive the DM</div>
                      </div>
                    </label>

                    {dmTriggerType === 'keyword' && (
                      <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input
                          type="text"
                          value={dmKeywords}
                          onChange={(e) => setDmKeywords(e.target.value)}
                          placeholder="e.g. link, guide, template, claude"
                          className="ds-input"
                          style={{ fontSize: 13 }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Separate keywords with commas</span>
                      </div>
                    )}

                    <label
                      onClick={() => setDmTriggerType('all_comments')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-button)',
                        border: dmTriggerType === 'all_comments' ? '1.5px solid #0095F6' : '1px solid var(--border)',
                        background: dmTriggerType === 'all_comments' ? 'rgba(0,149,246,0.06)' : 'var(--bg-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <input type="radio" checked={dmTriggerType === 'all_comments'} onChange={() => {}} style={{ accentColor: '#0095F6' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Every Comment Triggers DM</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No keyword required; every follower who comments gets the DM</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 2. Delivery Mode */}
                <div className="ds-card" style={{ padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0095F6', marginBottom: 12 }}>
                    2. DM Delivery Mode
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label
                      onClick={() => setDmDeliveryMode('interactive_button')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-button)',
                        border: dmDeliveryMode === 'interactive_button' ? '1.5px solid #0095F6' : '1px solid var(--border)',
                        background: dmDeliveryMode === 'interactive_button' ? 'rgba(0,149,246,0.06)' : 'var(--bg-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <input type="radio" checked={dmDeliveryMode === 'interactive_button'} onChange={() => {}} style={{ accentColor: '#0095F6' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          2-Step Interactive Button <span className="ds-badge ds-badge-success" style={{ fontSize: 9 }}>Recommended</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sends an initial DM with a clickable quick-reply button. Link is sent when they tap it.</div>
                      </div>
                    </label>

                    <label
                      onClick={() => setDmDeliveryMode('direct_link')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-button)',
                        border: dmDeliveryMode === 'direct_link' ? '1.5px solid #0095F6' : '1px solid var(--border)',
                        background: dmDeliveryMode === 'direct_link' ? 'rgba(0,149,246,0.06)' : 'var(--bg-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <input type="radio" checked={dmDeliveryMode === 'direct_link'} onChange={() => {}} style={{ accentColor: '#0095F6' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Direct Link in 1st DM</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sends the link / payload directly in the very first automated DM.</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 🌟 Don't ask me again Checkbox */}
                <div style={{ padding: '12px 16px', background: 'rgba(0,149,246,0.05)', borderRadius: 'var(--radius-button)', border: '1px solid rgba(0,149,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={dontAskSteps1And2}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setDontAskSteps1And2(val);
                        if (!val) {
                          localStorage.removeItem('crek_dm_dont_ask_steps_1_2');
                        }
                      }}
                      style={{ width: 16, height: 16, accentColor: '#0095F6', cursor: 'pointer' }}
                    />
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        Don't ask me again for future reels
                      </span>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                        Save these Step 1 & Step 2 settings as default for future reels.
                      </p>
                    </div>
                  </label>
                </div>
              </>
            )}

            {/* 3. Messages & Payload Setup */}
            <div className="ds-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0095F6' }}>
                3. Messages & Resource Delivery for this Reel
              </div>

              {dmDeliveryMode === 'interactive_button' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                      Initial DM Text (Step 1 Message)
                    </label>
                    <textarea
                      rows={3}
                      value={dmInitialMessage}
                      onChange={(e) => setDmInitialMessage(e.target.value)}
                      className="ds-input"
                      style={{ width: '100%', fontSize: 13 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                      Interactive Button Text
                    </label>
                    <input
                      type="text"
                      value={dmButtonText}
                      onChange={(e) => setDmButtonText(e.target.value)}
                      placeholder="Send me the link"
                      className="ds-input"
                      style={{ width: '100%', fontSize: 13 }}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  {dmDeliveryMode === 'interactive_button' ? 'Follow-up Payload Message (Step 2)' : 'Direct DM Message'}
                </label>
                <input
                  type="text"
                  value={dmPayloadMessage}
                  onChange={(e) => setDmPayloadMessage(e.target.value)}
                  placeholder="Here is the link you requested:"
                  className="ds-input"
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Resource URL / Doc Link
                </label>
                <input
                  type="url"
                  value={dmPayloadUrl}
                  onChange={(e) => setDmPayloadUrl(e.target.value)}
                  placeholder="https://yourbrand.com/guide.pdf"
                  className="ds-input"
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Limit Total DMs for This Reel (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={dmMaxLimit}
                  onChange={(e) => setDmMaxLimit(e.target.value)}
                  placeholder="0 = Unlimited"
                  className="ds-input"
                  style={{ width: '100%', fontSize: 13 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enter 0 for unlimited DMs, or set a cap (e.g. 50).</span>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: INSTAGRAM DM LIVE SIMULATOR ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 10 }}>
              📱 Live Instagram DM Preview
            </div>

            {/* Dark Theme Phone Frame */}
            <div style={{
              width: '100%', maxWidth: 360, borderRadius: 32, background: '#000000', border: '8px solid #1E1E24',
              boxShadow: '0 16px 36px rgba(0,0,0,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
              height: 490, color: '#FFFFFF', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #1A1A1A' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img
                    src={apiUser?.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                    alt="Avatar"
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{apiUser?.username || 'thefinancial.pilot'}</div>
                    <div style={{ fontSize: 10, color: '#0095F6' }}>Active now</div>
                  </div>
                </div>
                <button
                  onClick={() => setDmSimStep(1)}
                  style={{ background: 'none', border: 'none', color: '#737373', fontSize: 11, cursor: 'pointer' }}
                >
                  Reset ↺
                </button>
              </div>

              {/* Messages Area */}
              <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
                {/* Step 1: Initial DM */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    alignSelf: 'flex-start', maxWidth: '85%', background: '#262626', borderRadius: 16,
                    borderBottomLeftRadius: 4, padding: '10px 14px', fontSize: 13, lineHeight: 1.4,
                  }}
                >
                  {dmDeliveryMode === 'interactive_button'
                    ? (dmInitialMessage || "Want the resources? Click below!")
                    : `${dmPayloadMessage} ${dmPayloadUrl}`
                  }
                </motion.div>

                {/* Step 1 Quick Reply Button */}
                {dmDeliveryMode === 'interactive_button' && dmSimStep === 1 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setDmSimStep(2)}
                    style={{
                      alignSelf: 'center', background: '#0095F6', color: '#FFFFFF', border: 'none',
                      borderRadius: 20, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,149,246,0.3)',
                    }}
                  >
                    {dmButtonText || 'Send me the link'}
                  </motion.button>
                )}

                {/* User Clicked Quick Reply */}
                {dmDeliveryMode === 'interactive_button' && dmSimStep >= 2 && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        alignSelf: 'flex-end', background: '#0095F6', color: '#FFFFFF', borderRadius: 16,
                        borderBottomRightRadius: 4, padding: '8px 14px', fontSize: 12, fontWeight: 600,
                      }}
                    >
                      {dmButtonText || 'Send me the link'}
                    </motion.div>

                    {/* Step 2 Payload Message */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      style={{
                        alignSelf: 'flex-start', maxWidth: '85%', background: '#262626', borderRadius: 16,
                        borderBottomLeftRadius: 4, padding: '10px 14px', fontSize: 13, lineHeight: 1.4,
                      }}
                    >
                      <div>{dmPayloadMessage || 'Here is your link:'}</div>
                      {dmPayloadUrl && (
                        <a
                          href={dmPayloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#0095F6', fontWeight: 600, display: 'block', marginTop: 6, wordBreak: 'break-all', fontSize: 12 }}
                        >
                          {dmPayloadUrl}
                        </a>
                      )}
                    </motion.div>
                  </>
                )}
              </div>

              {/* Bottom Input */}
              <div style={{ padding: '8px 12px', borderTop: '1px solid #1A1A1A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Message..."
                  disabled
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#737373', fontSize: 12, outline: 'none' }}
                />
                <span style={{ fontSize: 14 }}>💙</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ BOTTOM SAVE ACTION BAR ═══════════════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {aiApplyScope === 'all_reels'
            ? 'AI changes will apply as global defaults for ALL reels. DM settings apply to this reel.'
            : 'All changes apply exclusively to comments on this specific reel.'}
        </span>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="ds-btn-primary"
          style={{ padding: '10px 28px', fontSize: 14, fontWeight: 700 }}
        >
          {saving ? 'Saving...' : 'Save & Apply Settings 🚀'}
        </button>
      </div>
    </motion.div>
  );
}
