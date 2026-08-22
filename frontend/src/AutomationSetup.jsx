import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { updateUserSettings, triggerReelSync, fetchCurrentUser, fetchReels, scanVoiceProfile } from './api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

/* ════════════════════════════════════════════
   STEP SIDEBAR (DARK THEME)
   ════════════════════════════════════════════ */
const STEPS = [
  { id: 1, label: 'Connect', desc: 'Link your Instagram account' },
  { id: 2, label: 'Scan', desc: 'We read your profile and posts' },
  { id: 3, label: 'Voice', desc: 'Confirm tone and knowledge' },
  { id: 4, label: 'Preview', desc: 'Review draft replies' },
  { id: 5, label: 'Automations', desc: 'Choose what runs on its own' },
  { id: 6, label: 'Go live', desc: 'Turn on your first replies' },
];

const INDUSTRIES = [
  'Finance creator', 'Tech / SaaS', 'Beauty & Skincare', 'Fitness & Health',
  'Food & Cooking', 'Education', 'Entertainment', 'Fashion', 'Travel',
  'Real Estate', 'E-commerce', 'Other',
];

const PERSONAS = [
  { value: 'brand', label: 'Brand voice ("we")' },
  { value: 'founder', label: 'Founder ("I")' },
  { value: 'creator', label: 'Creator ("I")' },
  { value: 'expert', label: 'Expert / coach ("I")' },
  { value: 'custom', label: 'Custom' },
];

const FORMALITY_LABELS = ['Very Casual', 'Casual', 'Balanced', 'Professional', 'Very Formal'];
const FORMALITY_EXAMPLES = [
  '"yo that\'s fire 🔥 lmk if you want more"',
  '"hey! glad you liked it, check your DMs 😊"',
  '"Thank you so much. He is always happiest when people say hi."',
  '"Thank you for your interest. I\'d be happy to share more details."',
  '"We appreciate your inquiry. Please find the relevant information below."',
];

const SAMPLE_COMMENTS = [
  { label: 'CASUAL', color: 'bg-red-100 text-red-700', text: 'Where do you film?' },
  { label: 'CURIOUS', color: 'bg-amber-100 text-amber-700', text: 'Can you make a video about X?' },
  { label: 'FORMAL', color: 'bg-blue-100 text-blue-700', text: 'This is exactly what I needed today' },
];

const VOICE_MODES = [
  { id: 'witty', label: 'Witty', icon: '🃏', desc: 'Fast, clever wordplay & sharp banter' },
  { id: 'funny', label: 'Funny', icon: '😂', desc: 'Playful punchlines & humorous takes' },
  { id: 'roast', label: 'Roast Mode', icon: '🔥', desc: 'Cheeky comebacks & hilarious burns' },
  { id: 'sarcastic', label: 'Sarcastic', icon: '😏', desc: 'Deadpan humor & cheeky irony' },
  { id: 'helpful_expert', label: 'Helpful Expert', icon: '🎓', desc: 'Clear, authoritative & educational' },
  { id: 'casual_friend', label: 'Casual Friend', icon: '🤝', desc: 'Warm, conversational & friendly' },
  { id: 'professional', label: 'Professional', icon: '💼', desc: 'Polished & customer support ready' },
  { id: 'hype_friend', label: 'Hype Friend', icon: '⚡', desc: 'High energy & supportive' },
];

const QUICK_CHIPS = [
  'Roast my comment! 🔥',
  'Why are your prices so high? 🤔',
  'Is this video fake? 🎥',
  'When is your next drop? 🚀',
  'What camera do you use? 📹',
];


function StepSidebar({ currentStep, completedSteps }) {
  return (
    <div style={{ width: 200, flexShrink: 0, paddingRight: 24, borderRight: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 24 }}>Account Setup</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {STEPS.map((step) => {
          const isCompleted = completedSteps.includes(step.id);
          const isActive = currentStep === step.id;
          return (
            <div
              key={step.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 12px', borderRadius: 'var(--radius-button)',
                background: isActive ? 'var(--accent-glow)' : 'transparent',
                border: isActive ? '1px solid rgba(124,58,237,0.2)' : '1px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {isCompleted ? (
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <svg style={{ width: 14, height: 14, color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2, fontSize: 11, fontWeight: 700,
                  background: isActive ? 'var(--accent)' : 'var(--bg-hover)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                }}>
                  {step.id}
                </div>
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--text-primary)' : isCompleted ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 11, color: isActive ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                  {step.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   STEP 1: CONNECT
   ════════════════════════════════════════════ */
function StepConnect({ onConnect, isConnected }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 520, width: '100%' }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 12 }}>Step 1 · Connect</div>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: 12 }}>
          Let's set up your first Instagram account.
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
          We'll connect Instagram, then build a voice profile that you fully review before any draft can go live.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40 }}>
          {['Connect', 'Build voice', 'Review'].map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: i === 0 ? 'var(--accent)' : 'var(--bg-hover)',
                color: i === 0 ? '#fff' : 'var(--text-muted)',
              }}>{i + 1}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
            </div>
          ))}
        </div>

        {isConnected ? (
          <div className="ds-card" style={{ display: 'flex', alignItems: 'center', gap: 12, borderColor: 'rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.06)' }}>
            <svg style={{ width: 20, height: 20, color: 'var(--success)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}>Instagram connected successfully!</span>
          </div>
        ) : (
          <button onClick={onConnect} className="ds-btn-primary" style={{ gap: 12 }}>
            <svg style={{ width: 20, height: 20 }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            Connect Instagram
          </button>
        )}
      </div>

      {/* Info panel */}
      <div className="ds-card" style={{ maxWidth: 520, width: '100%', marginTop: 32, borderColor: 'rgba(16,185,129,0.15)', background: 'rgba(16,185,129,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg style={{ width: 12, height: 12, color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>What connecting does</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Business or Creator account required',
            'Reads profile, posts, captions, and comments',
            'Needs comment-management permission',
            'Manual review starts on by default',
            'Disconnect anytime from settings',
          ].map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg style={{ width: 14, height: 14, color: 'var(--success)', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   STEP 2: SCAN
   ════════════════════════════════════════════ */
function StepScan({ onComplete, apiUser }) {
  const [scanSteps, setScanSteps] = useState([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let generated = null;

    const runScan = async () => {
      setScanSteps(['Reading your profile and bio...']);
      try {
        await triggerReelSync();
      } catch (err) {
        console.warn('Reel sync trigger in scan:', err);
      }

      await new Promise((r) => setTimeout(r, 1000));
      setScanSteps((prev) => [...prev, 'Scanning posts, reels, and captions...']);

      try {
        generated = await scanVoiceProfile();
      } catch (err) {
        console.warn('AI voice profile scan failed, fallback:', err);
      }

      await new Promise((r) => setTimeout(r, 1000));
      setScanSteps((prev) => [...prev, 'Generating AI voice profile defaults with Qwen...']);

      await new Promise((r) => setTimeout(r, 800));
      setDone(true);
      setTimeout(() => onComplete(generated), 1200);
    };

    runScan();
  }, []);


  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 12 }}>Step 2 · Scan</div>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: 12 }}>
          Reading your Instagram...
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32 }}>
          We're scanning your profile, posts, and captions to pre-fill your voice profile.
        </p>

        <div className="ds-card" style={{ textAlign: 'left' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {scanSteps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                style={{ display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <svg style={{ width: 20, height: 20, color: 'var(--success)', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{step}</span>
              </motion.div>
            ))}
            {!done && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Processing...</span>
              </div>
            )}
            {done && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
                  Found {apiUser?.username ? `@${apiUser.username}'s` : 'your'} content — ready to build your voice profile!
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   STEP 3: VOICE PROFILE
   ════════════════════════════════════════════ */
function StepVoice({ voiceProfile, setVoiceProfile, apiUser, onComplete }) {
  const [activeSubTab, setActiveSubTab] = useState('identity');
  const [confirmed, setConfirmed] = useState(false);
  const subTabs = ['Identity', 'Knowledge', 'Voice', 'Safety', 'Confirm'];

  const update = (key, value) => setVoiceProfile((prev) => ({ ...prev, [key]: value }));

  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 4 }}>Voice Profile</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
          {activeSubTab === 'identity' && 'Identity'}
          {activeSubTab === 'knowledge' && 'Knowledge'}
          {activeSubTab === 'voice' && 'Voice'}
          {activeSubTab === 'safety' && 'Safety'}
          {activeSubTab === 'confirm' && 'Confirm'}
        </h2>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>
          {activeSubTab === 'identity' && 'Who you are'}
          {activeSubTab === 'knowledge' && 'What we should know'}
          {activeSubTab === 'voice' && 'How you sound'}
          {activeSubTab === 'safety' && 'What to avoid'}
          {activeSubTab === 'confirm' && 'Final review'}
        </span>
      </div>

      {/* Sub-tab pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {subTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab.toLowerCase())}
            style={{
              padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s', border: 'none',
              background: activeSubTab === tab.toLowerCase() ? 'var(--accent)' : 'var(--bg-hover)',
              color: activeSubTab === tab.toLowerCase() ? '#fff' : 'var(--text-muted)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Identity Tab */}
      {activeSubTab === 'identity' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="ds-card" style={{ borderColor: 'rgba(16,185,129,0.15)', background: 'rgba(16,185,129,0.04)', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
            <span>✨</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>We pre-filled this from your Instagram. Edit anything that's wrong.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Business or account name <span style={{ color: 'var(--error)' }}>*</span></label>
              <input
                type="text"
                value={voiceProfile.business_name}
                onChange={(e) => update('business_name', e.target.value)}
                className="ds-input"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Industry / category</label>
              <select
                value={voiceProfile.industry}
                onChange={(e) => update('industry', e.target.value)}
                className="ds-select"
                style={{ width: '100%' }}
              >
                {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Who this account serves</label>
            <textarea
              value={voiceProfile.audience}
              onChange={(e) => update('audience', e.target.value)}
              rows={3}
              className="ds-input"
              style={{ resize: 'none' }}
            />
          </div>
          <button onClick={() => setActiveSubTab('knowledge')} className="ds-btn-primary" style={{ alignSelf: 'flex-start' }}>
            Next → Knowledge
          </button>
        </motion.div>
      )}

      {/* Knowledge Tab */}
      {activeSubTab === 'knowledge' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Everything your AI should know before replying — products, pricing, hours, policies, FAQs, differentiators.
          </p>
          <textarea
            value={voiceProfile.knowledge}
            onChange={(e) => update('knowledge', e.target.value)}
            rows={10}
            placeholder="Tell your AI what to know about your business..."
            className="ds-input"
            style={{ resize: 'none', fontFamily: 'monospace' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
            <button onClick={() => setActiveSubTab('identity')} className="ds-btn-ghost">← Back</button>
            <button onClick={() => setActiveSubTab('voice')} className="ds-btn-primary">Next → Voice</button>
          </div>
        </motion.div>
      )}

      {/* Voice Tab */}
      {activeSubTab === 'voice' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Select Voice Mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {VOICE_MODES.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    update('mode', m.id);
                    if (m.desc) update('tone_description', m.desc);
                  }}
                  style={{
                    padding: 12, borderRadius: 'var(--radius-card)', cursor: 'pointer',
                    transition: 'all 0.15s', display: 'flex', alignItems: 'flex-start', gap: 10,
                    border: (voiceProfile.mode || 'casual_friend') === m.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: (voiceProfile.mode || 'casual_friend') === m.id ? 'var(--accent-glow)' : 'var(--bg-card)',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{m.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {m.label}
                      {(voiceProfile.mode || 'casual_friend') === m.id && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 2 }}>{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Reply persona</label>
            <select
              value={voiceProfile.persona}
              onChange={(e) => update('persona', e.target.value)}
              className="ds-select"
            >
              {PERSONAS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Tone description</label>
            <textarea
              value={voiceProfile.tone_description}
              onChange={(e) => update('tone_description', e.target.value)}
              rows={2}
              className="ds-input"
              style={{ resize: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Formality · {voiceProfile.formality}/5
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => update('formality', Math.max(1, voiceProfile.formality - 1))}
                className="ds-btn-ghost"
                style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >←</button>
              <input
                type="range"
                min={1}
                max={5}
                value={voiceProfile.formality}
                onChange={(e) => update('formality', parseInt(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <button
                type="button"
                onClick={() => update('formality', Math.min(5, voiceProfile.formality + 1))}
                className="ds-btn-ghost"
                style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >→</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: 4 }}>
              <span>Casual</span>
              <span>Pro</span>
            </div>
            <div className="ds-card" style={{ marginTop: 12, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{FORMALITY_LABELS[voiceProfile.formality - 1]}</div>
              <div style={{ fontSize: 13, color: 'var(--accent-light)', fontStyle: 'italic' }}>{FORMALITY_EXAMPLES[voiceProfile.formality - 1]}</div>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Signature phrases (optional)</label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>One phrase per line — the small turns of phrase your AI can use to sound like you.</p>
            <textarea
              value={voiceProfile.signature_phrases.join('\n')}
              onChange={(e) => update('signature_phrases', e.target.value.split('\n').filter(Boolean))}
              rows={3}
              className="ds-input"
              style={{ resize: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
            <button onClick={() => setActiveSubTab('knowledge')} className="ds-btn-ghost">← Back</button>
            <button onClick={() => setActiveSubTab('safety')} className="ds-btn-primary">Next → Safety</button>
          </div>
        </motion.div>
      )}

      {/* Safety Tab */}
      {activeSubTab === 'safety' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Words and phrases to avoid</label>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Things your AI should never say or do. One per line.</p>
              <textarea
                value={voiceProfile.avoid_words.join('\n')}
                onChange={(e) => update('avoid_words', e.target.value.split('\n').filter(Boolean))}
                rows={6}
                className="ds-input"
                style={{ resize: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Topics to never reply about publicly</label>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Subjects the AI should stay out of. It will skip the comment entirely.</p>
              <textarea
                value={voiceProfile.avoid_topics.join('\n')}
                onChange={(e) => update('avoid_topics', e.target.value.split('\n').filter(Boolean))}
                rows={6}
                placeholder={'e.g.\nMedical advice\nLegal advice\nRefund requests\nOrder complaints\nPolitics'}
                className="ds-input"
                style={{ resize: 'none' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Send these to DM instead</label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>When someone asks about these topics, the AI replies politely and points them to DM you. One topic per line.</p>
            <textarea
              value={voiceProfile.dm_topics.join('\n')}
              onChange={(e) => update('dm_topics', e.target.value.split('\n').filter(Boolean))}
              rows={3}
              placeholder="Pricing, private account details, order issues, booking specifics"
              className="ds-input"
              style={{ resize: 'none' }}
            />
          </div>
          <div className="ds-card" style={{ borderColor: 'rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.04)', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
            <span>🛡️</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Default mode is manual review / drafts only. You can enable full automation later from settings.</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
            <button onClick={() => setActiveSubTab('voice')} className="ds-btn-ghost">← Back</button>
            <button onClick={() => setActiveSubTab('confirm')} className="ds-btn-primary">Next → Confirm</button>
          </div>
        </motion.div>
      )}

      {/* Confirm Tab */}
      {activeSubTab === 'confirm' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'Account', value: voiceProfile.business_name || 'Not set' },
              { label: 'Category', value: voiceProfile.industry || 'Not set' },
              { label: 'Audience', value: voiceProfile.audience || 'Not set' },
              { label: 'Voice Mode', value: `${VOICE_MODES.find((m) => m.id === (voiceProfile.mode || 'casual_friend'))?.icon || ''} ${VOICE_MODES.find((m) => m.id === (voiceProfile.mode || 'casual_friend'))?.label || ''}` },
            ].map((item) => (
              <div key={item.label} className="ds-card">
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div className="ds-card">
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 6 }}>Knowledge</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{(voiceProfile.knowledge || 'Not set').slice(0, 200)}{voiceProfile.knowledge?.length > 200 ? '...' : ''}</div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Confirm the profile in the banner below to enable Save.</p>

          <div
            onClick={() => setConfirmed(!confirmed)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, borderRadius: 'var(--radius-card)',
              padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s',
              border: confirmed ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
              background: confirmed ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: 4,
              border: confirmed ? '2px solid var(--success)' : '2px solid var(--border)',
              background: confirmed ? 'var(--success)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
            }}>
              {confirmed && (
                <svg style={{ width: 12, height: 12, color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>I reviewed this profile. Pilotly can use it to draft replies.</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
            <button onClick={() => setActiveSubTab('safety')} className="ds-btn-ghost">← Back</button>
            <button
              onClick={onComplete}
              disabled={!confirmed}
              className="ds-btn-primary"
              style={{ opacity: confirmed ? 1 : 0.4 }}
            >
              Save & Continue →
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   STEP 4: PREVIEW (INTERACTIVE LIVE AI SANDBOX CHAT)
   ════════════════════════════════════════════ */
function StepPreview({ voiceProfile, onComplete }) {
  const activeMode = voiceProfile.mode || 'casual_friend';
  const activeModeObj = VOICE_MODES.find((m) => m.id === activeMode) || VOICE_MODES[5];
  
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: 'user',
      text: 'Why are your prices so high?',
    },
    {
      id: 2,
      sender: 'ai',
      text: 'Quality isn\'t cheap! We put extreme care into every single detail so you get real, massive value.',
      mode: activeMode,
    }
  ]);
  const [inputComment, setInputComment] = useState('');
  const [sending, setSending] = useState(false);
  const [approved, setApproved] = useState(false);

  const handleSendTestMessage = async (customText = null) => {
    const textToSubmit = customText || inputComment;
    if (!textToSubmit.trim() || sending) return;

    const userMsg = { id: Date.now(), sender: 'user', text: textToSubmit };
    setChatMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputComment('');
    setSending(true);

    try {
      const res = await fetch(`${API_BASE.replace('/api/v1', '')}/api/v1/demo/draft-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: textToSubmit,
          mode: activeMode,
          business_name: voiceProfile.business_name || '',
          knowledge: voiceProfile.knowledge || '',
        }),
      });
      const data = await res.json();
      const aiReply = data.reply || 'Reply generated in your voice.';

      setChatMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: 'ai', text: aiReply, mode: activeMode }
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: 'ai', text: 'Reply generated in your voice.', mode: activeMode }
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)' }}>Step 4 · Live Sandbox Chat</div>
        <span className="ds-badge ds-badge-success">✨ Live AI Sandbox</span>
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Test your AI in Real-Time</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        Test how your AI replies using the exact Voice Mode you configured in Step 3.
      </p>

      {/* Locked Active Mode Banner */}
      <div className="ds-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', marginBottom: 12, borderColor: 'rgba(124,58,237,0.2)', background: 'var(--accent-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: 'var(--accent-light)' }}>Configured Voice Mode:</span>
          <span className="ds-badge ds-badge-purple">
            {activeModeObj.icon} {activeModeObj.label}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Locked to Step 3 Selection</span>
      </div>

      {/* Sandbox Chat Window */}
      <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 320 }}>
        {/* Messages Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', maxHeight: 220, paddingRight: 8 }}>
          {chatMessages.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', borderRadius: 16, padding: '10px 16px', fontSize: 13,
                background: msg.sender === 'user' ? 'var(--bg-hover)' : 'var(--accent-glow)',
                color: msg.sender === 'user' ? 'var(--text-primary)' : 'var(--accent-light)',
                border: msg.sender === 'user' ? '1px solid var(--border)' : '1px solid rgba(124,58,237,0.2)',
                borderBottomRightRadius: msg.sender === 'user' ? 4 : 16,
                borderBottomLeftRadius: msg.sender === 'ai' ? 4 : 16,
              }}>
                {msg.sender === 'ai' && (
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-light)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    🤖 Pilotly AI ({activeModeObj.label})
                  </div>
                )}
                <div style={{ lineHeight: 1.5, color: msg.sender === 'user' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{msg.text}</div>
              </div>
            </div>
          ))}
          {sending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent-light)', fontStyle: 'italic', padding: '4px 8px' }}>
              <div style={{ width: 12, height: 12, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span>AI is drafting reply in {activeModeObj.label}...</span>
            </div>
          )}
        </div>

        {/* Quick Test Chips */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Quick Test Prompts</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleSendTestMessage(chip)}
                disabled={sending}
                className="ds-btn-ghost-sm"
                style={{ flexShrink: 0, fontSize: 11 }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              type="text"
              value={inputComment}
              onChange={(e) => setInputComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendTestMessage()}
              placeholder={`Type a comment to test ${activeModeObj.label}...`}
              className="ds-input"
              style={{ flex: 1 }}
            />
            <button
              onClick={() => handleSendTestMessage()}
              disabled={sending || !inputComment.trim()}
              className="ds-btn-primary"
              style={{ padding: '10px 20px', fontSize: 13 }}
            >
              Test →
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation & Continue */}
      <div
        onClick={() => setApproved(!approved)}
        style={{
          marginTop: 16, display: 'flex', alignItems: 'center', gap: 12,
          borderRadius: 'var(--radius-card)', padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s',
          border: approved ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
          background: approved ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 4,
          border: approved ? '2px solid var(--success)' : '2px solid var(--border)',
          background: approved ? 'var(--success)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
        }}>
          {approved && (
            <svg style={{ width: 12, height: 12, color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>I tested the live AI replies and approve this voice direction.</span>
      </div>

      <button
        onClick={onComplete}
        disabled={!approved}
        className="ds-btn-primary"
        style={{ marginTop: 12, alignSelf: 'flex-start', opacity: approved ? 1 : 0.4 }}
      >
        Continue to Automations →
      </button>
    </div>
  );
}


/* ════════════════════════════════════════════
   STEP 5: AUTOMATIONS
   ════════════════════════════════════════════ */
function StepAutomations({ voiceProfile, setVoiceProfile, apiUser, onComplete }) {
  const replyMode = voiceProfile.reply_mode || 'draft';
  const autoAnalyze = voiceProfile.auto_analyze_reels !== false;
  const useRealtime = voiceProfile.use_realtime_data || false;

  const update = (key, value) => setVoiceProfile((prev) => ({ ...prev, [key]: value }));

  const modes = [
    { id: 'off', icon: '🚫', label: 'Off', desc: "Nothing runs on new posts. You switch the agent on yourself, per post." },
    { id: 'draft', icon: '✏️', label: 'Draft', desc: "The agent writes every reply and waits for you to approve before it sends." },
    { id: 'auto', icon: '⚡', label: 'Auto', desc: "The agent writes and sends high-confidence replies on its own. You can step in anytime." },
  ];

  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 4 }}>Step 5 · Automations</div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        Put {apiUser?.username ? `@${apiUser.username}` : 'your account'} on autopilot
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Decide how much the agent does without you. These settings are saved to this Instagram account on its own.
      </p>

      {apiUser?.username && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 999, padding: '8px 16px', marginBottom: 24 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
            {apiUser.username[0]?.toUpperCase()}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Settings for @{apiUser.username}</span>
        </div>
      )}

      {/* Auto-analyze toggle */}
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>When a new post is published</div>
      <div className="ds-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderColor: 'rgba(16,185,129,0.15)', background: 'rgba(16,185,129,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>🧠</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Auto-analyze new posts</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>The agent reads each new post the moment it arrives and prepares context so replies are accurate. Recommended.</div>
          </div>
        </div>
        <button
          onClick={() => update('auto_analyze_reels', !autoAnalyze)}
          className={`ds-toggle ${autoAnalyze ? 'ds-toggle-on' : 'ds-toggle-off'}`}
          style={{ width: 44, height: 24, flexShrink: 0 }}
        >
          <span className="ds-toggle-knob" style={{ width: 20, height: 20 }} />
        </button>
      </div>

      {/* Use realtime data toggle */}
      <div className="ds-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, borderColor: 'rgba(124,58,237,0.15)', background: 'var(--accent-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>🌐</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Use live market data in replies</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>When a comment asks about real-time data (prices, news, scores), the AI fetches it via Grok + Tavily.</div>
          </div>
        </div>
        <button
          onClick={() => update('use_realtime_data', !useRealtime)}
          className={`ds-toggle ${useRealtime ? 'ds-toggle-on' : 'ds-toggle-off'}`}
          style={{ width: 44, height: 24, flexShrink: 0 }}
        >
          <span className="ds-toggle-knob" style={{ width: 20, height: 20 }} />
        </button>
      </div>

      {/* Reply mode cards */}
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>Default Reply Mode For New Posts</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {modes.map((mode) => (
          <div
            key={mode.id}
            onClick={() => update('reply_mode', mode.id)}
            style={{
              padding: 16, borderRadius: 'var(--radius-card)', cursor: 'pointer', transition: 'all 0.15s',
              border: replyMode === mode.id ? '2px solid var(--accent)' : '2px solid var(--border)',
              background: replyMode === mode.id ? 'var(--accent-glow)' : 'var(--bg-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{mode.icon}</span>
              {replyMode === mode.id && (
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg style={{ width: 12, height: 12, color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: replyMode === mode.id ? 'var(--accent-light)' : 'var(--text-primary)' }}>{mode.label}</div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{mode.desc}</p>
          </div>
        ))}
      </div>

      <div className="ds-card" style={{ borderColor: 'rgba(124,58,237,0.15)', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 24 }}>
        <span>💡</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>You stay in control. Every post can be overridden individually, and you can change these defaults anytime from Agent Settings.</span>
      </div>

      <button onClick={onComplete} className="ds-btn-primary">
        Continue → Go Live
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════
   STEP 6: GO LIVE
   ════════════════════════════════════════════ */
function StepGoLive({ voiceProfile, apiUser, onFinish }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ maxWidth: 420 }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Your AI is ready!</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>
          {apiUser?.username ? `@${apiUser.username}'s` : 'Your'} AI reply agent is now active and will start processing incoming comments.
        </p>

        <div className="ds-card" style={{ textAlign: 'left', marginBottom: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="ds-row">
              <span className="ds-row-label">Reply Mode</span>
              <span className="ds-badge ds-badge-success" style={{ textTransform: 'uppercase' }}>{voiceProfile.reply_mode || 'draft'}</span>
            </div>
            <div className="ds-row">
              <span className="ds-row-label">Auto-analyze reels</span>
              <span className={`ds-badge ${voiceProfile.auto_analyze_reels !== false ? 'ds-badge-success' : 'ds-badge-muted'}`}>{voiceProfile.auto_analyze_reels !== false ? 'ON' : 'OFF'}</span>
            </div>
            <div className="ds-row">
              <span className="ds-row-label">Live data</span>
              <span className={`ds-badge ${voiceProfile.use_realtime_data ? 'ds-badge-success' : 'ds-badge-muted'}`}>{voiceProfile.use_realtime_data ? 'ON' : 'OFF'}</span>
            </div>
            <div className="ds-row">
              <span className="ds-row-label">Voice</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{voiceProfile.persona} · {voiceProfile.formality}/5</span>
            </div>
          </div>
        </div>

        <button onClick={onFinish} className="ds-btn-primary" style={{ padding: '12px 32px', fontSize: 14 }}>
          Go to Dashboard →
        </button>
      </motion.div>
    </div>
  );
}

/* ════════════════════════════════════════════
   MAIN WIZARD EXPORT
   ════════════════════════════════════════════ */
export default function AutomationSetup({ apiUser, onComplete, onConnect }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);

  const isConnected = Boolean(apiUser?.instagram_user_id);

  const [voiceProfile, setVoiceProfile] = useState({
    business_name: apiUser?.full_name || apiUser?.username || '',
    industry: '',
    audience: '',

    knowledge: '',
    persona: 'founder',
    tone_description: '',
    formality: 3,
    signature_phrases: [],
    avoid_words: [],
    avoid_topics: [],
    dm_topics: [],
    reply_mode: 'draft',
    auto_analyze_reels: true,
    use_realtime_data: true,
  });

  // Pre-fill when apiUser loads
  useEffect(() => {
    if (apiUser) {
      setVoiceProfile((prev) => ({
        ...prev,
        business_name: apiUser.full_name || apiUser.username || prev.business_name,
      }));
      if (isConnected && currentStep === 1) {
        completeStep(1);
      }
    }
  }, [apiUser]);

  const completeStep = (stepId, generatedData = null) => {
    if (generatedData) {
      setVoiceProfile((prev) => ({
        ...prev,
        ...generatedData,
        business_name: generatedData.business_name || prev.business_name,
        signature_phrases: Array.isArray(generatedData.signature_phrases) ? generatedData.signature_phrases : prev.signature_phrases,
        avoid_words: Array.isArray(generatedData.avoid_words) ? generatedData.avoid_words : prev.avoid_words,
        avoid_topics: Array.isArray(generatedData.avoid_topics) ? generatedData.avoid_topics : prev.avoid_topics,
        dm_topics: Array.isArray(generatedData.dm_topics) ? generatedData.dm_topics : prev.dm_topics,
      }));
    }
    setCompletedSteps((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]));
    setCurrentStep(stepId + 1);
  };

  const handleSaveAndFinish = async () => {
    // Save voice profile as JSON in reply_style
    try {
      const autoReply = voiceProfile.reply_mode === 'auto';
      await updateUserSettings({
        reply_style: JSON.stringify(voiceProfile),
        reply_tone: voiceProfile.persona || 'friendly',
        auto_reply_enabled: autoReply,
      });
    } catch (err) {
      console.warn('Failed to save voice profile:', err);
    }
    onComplete();
  };

  return (
    <div style={{ height: '100vh', maxHeight: '100vh', width: '100%', overflow: 'hidden', background: 'var(--bg-primary)', display: 'flex' }}>
      {/* Left sidebar */}
      <div style={{ width: 256, padding: 32, flexShrink: 0, height: '100%', overflowY: 'auto', background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}>
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            Pilotly<span style={{ color: 'var(--accent)' }}>.ai</span>
          </span>
        </div>
        <StepSidebar currentStep={currentStep} completedSteps={completedSteps} />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, height: '100%', padding: 32, overflowY: 'auto' }}>
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <StepConnect onConnect={onConnect} isConnected={isConnected} />
              {isConnected && (
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                  <button onClick={() => completeStep(1)} className="ds-btn-primary">
                    Continue →
                  </button>
                </div>
              )}
            </motion.div>
          )}
          {currentStep === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <StepScan onComplete={(data) => completeStep(2, data)} apiUser={apiUser} />
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <StepVoice voiceProfile={voiceProfile} setVoiceProfile={setVoiceProfile} apiUser={apiUser} onComplete={() => completeStep(3)} />
            </motion.div>
          )}
          {currentStep === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <StepPreview voiceProfile={voiceProfile} onComplete={() => completeStep(4)} />
            </motion.div>
          )}
          {currentStep === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <StepAutomations voiceProfile={voiceProfile} setVoiceProfile={setVoiceProfile} apiUser={apiUser} onComplete={() => completeStep(5)} />
            </motion.div>
          )}
          {currentStep === 6 && (
            <motion.div key="s6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <StepGoLive voiceProfile={voiceProfile} apiUser={apiUser} onFinish={handleSaveAndFinish} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
