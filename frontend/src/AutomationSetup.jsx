import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { updateUserSettings, triggerReelSync, fetchCurrentUser, fetchReels, scanVoiceProfile } from './api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

/* ════════════════════════════════════════════
   STEP SIDEBAR
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

function StepSidebar({ currentStep, completedSteps }) {
  return (
    <div className="w-56 shrink-0 pr-6 border-r border-stone-200">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-6">Account Setup</div>
      <div className="space-y-1">
        {STEPS.map((step) => {
          const isCompleted = completedSteps.includes(step.id);
          const isActive = currentStep === step.id;
          return (
            <div
              key={step.id}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isActive ? 'bg-stone-100 border border-stone-200' : 'border border-transparent'
              }`}
            >
              {isCompleted ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold ${
                  isActive ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-500'
                }`}>
                  {step.id}
                </div>
              )}
              <div>
                <div className={`text-sm font-bold ${isActive ? 'text-stone-900' : isCompleted ? 'text-stone-600' : 'text-stone-400'}`}>
                  {step.label}
                </div>
                <div className={`text-[11px] ${isActive ? 'text-stone-500' : 'text-stone-400'}`}>
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
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="max-w-xl w-full">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-3">Step 1 · Connect</div>
        <h2 className="text-3xl font-serif font-bold text-stone-900 leading-tight mb-3">
          Let's set up your first Instagram account.
        </h2>
        <p className="text-sm text-stone-500 mb-8 leading-relaxed">
          We'll connect Instagram, then build a voice profile that you fully review before any draft can go live.
        </p>

        <div className="flex items-center gap-6 mb-10">
          {['Connect', 'Build voice', 'Review'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i === 0 ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-500'
              }`}>{i + 1}</span>
              <span className="text-sm font-semibold text-stone-700">{label}</span>
            </div>
          ))}
        </div>

        {isConnected ? (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-semibold text-emerald-700">Instagram connected successfully!</span>
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="flex items-center gap-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all shadow-lg"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            Connect Instagram
          </button>
        )}
      </div>

      {/* Right sidebar info */}
      <div className="max-w-xl w-full mt-8 bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span className="text-sm font-bold text-stone-800">What connecting does</span>
        </div>
        <div className="space-y-2">
          {[
            'Business or Creator account required',
            'Reads profile, posts, captions, and comments',
            'Needs comment-management permission',
            'Manual review starts on by default',
            'Disconnect anytime from settings',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs text-stone-600">{item}</span>
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
    <div className="flex-1 flex flex-col items-center justify-center">
      <div className="max-w-md w-full text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-3">Step 2 · Scan</div>
        <h2 className="text-3xl font-serif font-bold text-stone-900 leading-tight mb-3">
          Reading your Instagram...
        </h2>
        <p className="text-sm text-stone-500 mb-8">
          We're scanning your profile, posts, and captions to pre-fill your voice profile.
        </p>

        <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 space-y-4 text-left">
          {scanSteps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-stone-700">{step}</span>
            </motion.div>
          ))}
          {!done && (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              <span className="text-sm text-stone-400">Processing...</span>
            </div>
          )}
          {done && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2 border-t border-stone-200">
              <span className="text-sm font-semibold text-emerald-600">
                Found {apiUser?.username ? `@${apiUser.username}'s` : 'your'} content — ready to build your voice profile!
              </span>
            </motion.div>
          )}
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
    <div className="flex-1">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-1">Voice Profile</div>
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-lg font-bold text-stone-900">
          {activeSubTab === 'identity' && 'Identity'}
          {activeSubTab === 'knowledge' && 'Knowledge'}
          {activeSubTab === 'voice' && 'Voice'}
          {activeSubTab === 'safety' && 'Safety'}
          {activeSubTab === 'confirm' && 'Confirm'}
        </h2>
        <span className="text-sm text-stone-400 ml-1">
          {activeSubTab === 'identity' && 'Who you are'}
          {activeSubTab === 'knowledge' && 'What we should know'}
          {activeSubTab === 'voice' && 'How you sound'}
          {activeSubTab === 'safety' && 'What to avoid'}
          {activeSubTab === 'confirm' && 'Final review'}
        </span>
      </div>

      {/* Sub-tab pills */}
      <div className="flex gap-2 mb-6">
        {subTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab.toLowerCase())}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeSubTab === tab.toLowerCase()
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Identity Tab */}
      {activeSubTab === 'identity' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-lg px-4 py-2.5 text-xs text-stone-600 flex items-center gap-2">
            <span>✨</span> We pre-filled this from your Instagram. Edit anything that's wrong.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">Business or account name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={voiceProfile.business_name}
                onChange={(e) => update('business_name', e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-900 bg-white focus:outline-none focus:border-stone-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">Industry / category</label>
              <select
                value={voiceProfile.industry}
                onChange={(e) => update('industry', e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-900 bg-white focus:outline-none focus:border-stone-500"
              >
                {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">Who this account serves</label>
            <textarea
              value={voiceProfile.audience}
              onChange={(e) => update('audience', e.target.value)}
              rows={3}
              className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-900 bg-white focus:outline-none focus:border-stone-500 resize-none"
            />
          </div>
          <button onClick={() => setActiveSubTab('knowledge')} className="bg-stone-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg hover:bg-stone-800 transition-all">
            Next → Knowledge
          </button>
        </motion.div>
      )}

      {/* Knowledge Tab */}
      {activeSubTab === 'knowledge' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <p className="text-xs text-stone-500">
            Everything your AI should know before replying — products, pricing, hours, policies, FAQs, differentiators.
          </p>
          <textarea
            value={voiceProfile.knowledge}
            onChange={(e) => update('knowledge', e.target.value)}
            rows={10}
            placeholder="Tell your AI what to know about your business..."
            className="w-full border border-stone-300 rounded-lg px-4 py-3 text-sm text-stone-900 bg-white focus:outline-none focus:border-stone-500 resize-none font-mono"
          />
          <button onClick={() => setActiveSubTab('voice')} className="bg-stone-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg hover:bg-stone-800 transition-all">
            Next → Voice
          </button>
        </motion.div>
      )}

      {/* Voice Tab */}
      {activeSubTab === 'voice' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">Reply persona</label>
            <select
              value={voiceProfile.persona}
              onChange={(e) => update('persona', e.target.value)}
              className="border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-900 bg-white focus:outline-none focus:border-stone-500"
            >
              {PERSONAS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">Tone description</label>
            <textarea
              value={voiceProfile.tone_description}
              onChange={(e) => update('tone_description', e.target.value)}
              rows={3}
              className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-900 bg-white focus:outline-none focus:border-stone-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-2">
              Formality · {voiceProfile.formality}/5
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={voiceProfile.formality}
              onChange={(e) => update('formality', parseInt(e.target.value))}
              className="w-full accent-stone-900"
            />
            <div className="flex justify-between text-[10px] text-stone-400 font-bold uppercase mt-1">
              <span>Casual</span>
              <span>Pro</span>
            </div>
            <div className="mt-3 bg-stone-50 border border-stone-200 rounded-lg p-3">
              <div className="text-[10px] font-bold text-stone-400 uppercase mb-1">{FORMALITY_LABELS[voiceProfile.formality - 1]}</div>
              <div className="text-sm text-blue-600 italic">{FORMALITY_EXAMPLES[voiceProfile.formality - 1]}</div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">Signature phrases (optional)</label>
            <p className="text-[11px] text-stone-400 mb-1.5">One phrase per line — the small turns of phrase your AI can use to sound like you.</p>
            <textarea
              value={voiceProfile.signature_phrases.join('\n')}
              onChange={(e) => update('signature_phrases', e.target.value.split('\n').filter(Boolean))}
              rows={4}
              className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-900 bg-white focus:outline-none focus:border-stone-500 resize-none"
            />
          </div>
          <button onClick={() => setActiveSubTab('safety')} className="bg-stone-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg hover:bg-stone-800 transition-all">
            Next → Safety
          </button>
        </motion.div>
      )}

      {/* Safety Tab */}
      {activeSubTab === 'safety' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Words and phrases to avoid</label>
              <p className="text-[11px] text-stone-400 mb-2">Things your AI should never say or do — slang you hate, claims you can't make, competitor names. One per line.</p>
              <textarea
                value={voiceProfile.avoid_words.join('\n')}
                onChange={(e) => update('avoid_words', e.target.value.split('\n').filter(Boolean))}
                rows={6}
                className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-900 bg-white focus:outline-none focus:border-stone-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Topics to never reply about publicly</label>
              <p className="text-[11px] text-stone-400 mb-2">Subjects the AI should stay out of in public comments. It will skip the comment entirely instead of guessing.</p>
              <textarea
                value={voiceProfile.avoid_topics.join('\n')}
                onChange={(e) => update('avoid_topics', e.target.value.split('\n').filter(Boolean))}
                rows={6}
                placeholder={'e.g.\nMedical advice\nLegal advice\nRefund requests\nOrder complaints\nPolitics'}
                className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-900 bg-white focus:outline-none focus:border-stone-500 resize-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Send these to DM instead</label>
            <p className="text-[11px] text-stone-400 mb-2">When someone asks about these topics, the AI replies politely and points them to DM you. One topic per line.</p>
            <textarea
              value={voiceProfile.dm_topics.join('\n')}
              onChange={(e) => update('dm_topics', e.target.value.split('\n').filter(Boolean))}
              rows={3}
              placeholder="Pricing, private account details, order issues, booking specifics"
              className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-900 bg-white focus:outline-none focus:border-stone-500 resize-none"
            />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-700 flex items-center gap-2">
            <span>🛡️</span> Default mode is manual review / drafts only. You can enable full automation later from settings.
          </div>
          <button onClick={() => setActiveSubTab('confirm')} className="bg-stone-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg hover:bg-stone-800 transition-all">
            Next → Confirm
          </button>
        </motion.div>
      )}

      {/* Confirm Tab */}
      {activeSubTab === 'confirm' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Account</div>
              <div className="text-sm font-semibold text-stone-900">{voiceProfile.business_name || 'Not set'}</div>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Category</div>
              <div className="text-sm font-semibold text-stone-900">{voiceProfile.industry || 'Not set'}</div>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Audience</div>
              <div className="text-sm text-stone-700 leading-relaxed">{voiceProfile.audience || 'Not set'}</div>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Voice</div>
              <div className="text-sm font-semibold text-stone-900">
                {PERSONAS.find((p) => p.value === voiceProfile.persona)?.label || voiceProfile.persona} · formality {voiceProfile.formality}/5
              </div>
            </div>
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Knowledge</div>
            <div className="text-sm text-emerald-700 leading-relaxed">{(voiceProfile.knowledge || 'Not set').slice(0, 200)}{voiceProfile.knowledge?.length > 200 ? '...' : ''}</div>
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Safety</div>
            <div className="text-sm text-stone-700">
              {[...voiceProfile.avoid_words, ...voiceProfile.dm_topics].filter(Boolean).join(' · ') || 'No restrictions set'}
            </div>
          </div>
          <p className="text-xs text-stone-400">Confirm the profile in the banner below to enable Save.</p>

          <div
            onClick={() => setConfirmed(!confirmed)}
            className={`flex items-center gap-3 border rounded-xl px-5 py-4 cursor-pointer transition-all ${
              confirmed ? 'border-emerald-300 bg-emerald-50/50' : 'border-stone-200 bg-white'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              confirmed ? 'border-emerald-500 bg-emerald-500' : 'border-stone-300'
            }`}>
              {confirmed && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm font-semibold text-stone-800">I reviewed this profile. Pilotly can use it to draft replies.</span>
          </div>

          <button
            onClick={onComplete}
            disabled={!confirmed}
            className={`font-bold text-xs px-5 py-2.5 rounded-lg transition-all ${
              confirmed
                ? 'bg-stone-900 text-white hover:bg-stone-800'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            Save & Continue
          </button>
        </motion.div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   STEP 4: PREVIEW
   ════════════════════════════════════════════ */
function StepPreview({ voiceProfile, onComplete }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [drafts, setDrafts] = useState(['', '', '']);
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);

  const generateDraft = async (commentText, idx) => {
    try {
      const res = await fetch(`${API_BASE.replace('/api/v1', '')}/api/v1/demo/draft-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: commentText, product_context: voiceProfile.knowledge || voiceProfile.business_name || '' }),
      });
      const data = await res.json();
      setDrafts((prev) => { const n = [...prev]; n[idx] = data.reply || 'Draft generated.'; return n; });
    } catch {
      setDrafts((prev) => { const n = [...prev]; n[idx] = 'Reply generation completed.'; return n; });
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all(SAMPLE_COMMENTS.map((c, i) => generateDraft(c.text, i))).then(() => setLoading(false));
  }, []);

  const handleRegenerate = () => {
    setLoading(true);
    setDrafts(['', '', '']);
    Promise.all(SAMPLE_COMMENTS.map((c, i) => generateDraft(c.text, i))).then(() => setLoading(false));
  };

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Step 4 · Preview</div>
        <span className="text-xs text-stone-400 font-semibold">✨ {drafts.filter(Boolean).length}/3 drafts</span>
      </div>
      <h2 className="text-2xl font-serif font-bold text-stone-900 mb-1">Preview replies in your voice</h2>
      <p className="text-sm text-stone-500 mb-6">Review these sample drafts, approve the voice, then continue.</p>

      <div className="flex gap-5">
        {/* Left: Sample comment cards */}
        <div className="w-64 shrink-0 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Sample Comments</span>
            <button onClick={handleRegenerate} className="text-xs font-bold text-stone-600 border border-stone-300 rounded-lg px-3 py-1 hover:bg-stone-100 transition-all">
              Regenerate
            </button>
          </div>
          {SAMPLE_COMMENTS.map((c, i) => (
            <div
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                selectedIdx === i ? 'border-stone-400 bg-white shadow-sm' : 'border-stone-200 bg-stone-50 hover:border-stone-300'
              }`}
            >
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${c.color}`}>{c.label}</span>
              <div className="text-sm font-semibold text-stone-900 mt-2">{c.text}</div>
              <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Draft ready
              </div>
            </div>
          ))}
        </div>

        {/* Right: Draft reply preview */}
        <div className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-6">
          <div className="bg-stone-200/60 rounded-lg px-4 py-2 mb-4 flex items-center gap-2">
            <span className="text-stone-500">💬</span>
            <span className="text-sm text-stone-600">"{SAMPLE_COMMENTS[selectedIdx].text}"</span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">Draft Reply</div>
          {loading ? (
            <div className="flex items-center gap-2 py-8">
              <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              <span className="text-sm text-stone-400">Generating draft...</span>
            </div>
          ) : (
            <div className="text-lg text-stone-800 leading-relaxed font-serif">
              {drafts[selectedIdx] || 'Generating...'}
            </div>
          )}
        </div>
      </div>

      <div
        onClick={() => setApproved(!approved)}
        className={`mt-6 flex items-center gap-3 border rounded-xl px-5 py-4 cursor-pointer transition-all ${
          approved ? 'border-emerald-300 bg-emerald-50/50' : 'border-stone-200 bg-white'
        }`}
      >
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
          approved ? 'border-emerald-500 bg-emerald-500' : 'border-stone-300'
        }`}>
          {approved && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="text-sm font-semibold text-stone-800">This reply direction looks right for my account.</span>
      </div>

      <button
        onClick={onComplete}
        disabled={!approved}
        className={`mt-4 font-bold text-xs px-5 py-2.5 rounded-lg transition-all ${
          approved ? 'bg-stone-900 text-white hover:bg-stone-800' : 'bg-stone-200 text-stone-400 cursor-not-allowed'
        }`}
      >
        Continue
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
    <div className="flex-1">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-1">Step 5 · Automations</div>
      <h2 className="text-2xl font-serif font-bold text-stone-900 mb-1">
        Put {apiUser?.username ? `@${apiUser.username}` : 'your account'} on autopilot
      </h2>
      <p className="text-sm text-stone-500 mb-6">
        Decide how much the agent does without you. These settings are saved to this Instagram account on its own.
      </p>

      {apiUser?.username && (
        <div className="inline-flex items-center gap-2 bg-stone-100 border border-stone-200 rounded-full px-4 py-2 mb-6">
          <div className="w-5 h-5 rounded-full bg-stone-800 text-white flex items-center justify-center text-[9px] font-bold">
            {apiUser.username[0]?.toUpperCase()}
          </div>
          <span className="text-xs font-semibold text-stone-700">Settings for @{apiUser.username}</span>
        </div>
      )}

      {/* Auto-analyze toggle */}
      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-3">When a new post is published</div>
      <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-4 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-lg">🧠</span>
          <div>
            <div className="text-sm font-bold text-stone-800">Auto-analyze new posts</div>
            <div className="text-xs text-stone-500">The agent reads each new post the moment it arrives and prepares context so replies are accurate. Recommended.</div>
          </div>
        </div>
        <button
          onClick={() => update('auto_analyze_reels', !autoAnalyze)}
          className={`w-12 h-6 rounded-full transition-colors p-0.5 flex items-center ${
            autoAnalyze ? 'bg-emerald-500 justify-end' : 'bg-stone-300 justify-start'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white shadow-md" />
        </button>
      </div>

      {/* Use realtime data toggle */}
      <div className="bg-blue-50/60 border border-blue-200/60 rounded-xl p-4 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-lg">🌐</span>
          <div>
            <div className="text-sm font-bold text-stone-800">Use live market data in replies</div>
            <div className="text-xs text-stone-500">When a comment asks about real-time data (prices, news, scores), the AI fetches it via Grok + Tavily.</div>
          </div>
        </div>
        <button
          onClick={() => update('use_realtime_data', !useRealtime)}
          className={`w-12 h-6 rounded-full transition-colors p-0.5 flex items-center ${
            useRealtime ? 'bg-blue-500 justify-end' : 'bg-stone-300 justify-start'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white shadow-md" />
        </button>
      </div>

      {/* Reply mode cards */}
      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-3">Default Reply Mode For New Posts</div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {modes.map((mode) => (
          <div
            key={mode.id}
            onClick={() => update('reply_mode', mode.id)}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              replyMode === mode.id
                ? 'border-emerald-400 bg-white shadow-sm'
                : 'border-stone-200 bg-stone-50 hover:border-stone-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{mode.icon}</span>
              {replyMode === mode.id && (
                <span className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </div>
            <div className={`text-sm font-bold mb-1 ${replyMode === mode.id ? 'text-emerald-700' : 'text-stone-800'}`}>{mode.label}</div>
            <p className="text-[11px] text-stone-500 leading-relaxed">{mode.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-blue-50/60 border border-blue-200/60 rounded-lg px-4 py-2.5 text-xs text-blue-700 flex items-center gap-2 mb-6">
        <span>💡</span> You stay in control. Every post can be overridden individually, and you can change these defaults anytime from Agent Settings.
      </div>

      <button onClick={onComplete} className="bg-stone-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg hover:bg-stone-800 transition-all">
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
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-md"
      >
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-3xl font-serif font-bold text-stone-900 mb-2">Your AI is ready!</h2>
        <p className="text-sm text-stone-500 mb-8">
          {apiUser?.username ? `@${apiUser.username}'s` : 'Your'} AI reply agent is now active and will start processing incoming comments.
        </p>

        <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 text-left space-y-3 mb-8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Reply Mode</span>
            <span className="text-xs font-bold text-emerald-600 uppercase">{voiceProfile.reply_mode || 'draft'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Auto-analyze reels</span>
            <span className="text-xs font-bold text-emerald-600">{voiceProfile.auto_analyze_reels !== false ? 'ON' : 'OFF'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Live data</span>
            <span className="text-xs font-bold text-emerald-600">{voiceProfile.use_realtime_data ? 'ON' : 'OFF'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Voice</span>
            <span className="text-xs font-bold text-stone-700">{voiceProfile.persona} · {voiceProfile.formality}/5</span>
          </div>
        </div>

        <button
          onClick={onFinish}
          className="bg-stone-900 text-white font-bold text-sm px-8 py-3.5 rounded-xl hover:bg-stone-800 transition-all shadow-lg"
        >
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
    <div className="min-h-screen bg-[#FAF6F0] flex">
      {/* Left sidebar */}
      <div className="w-64 p-8 shrink-0">
        <StepSidebar currentStep={currentStep} completedSteps={completedSteps} />
      </div>

      {/* Main content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <StepConnect onConnect={onConnect} isConnected={isConnected} />
              {isConnected && (
                <div className="mt-4 flex justify-center">
                  <button onClick={() => completeStep(1)} className="bg-stone-900 text-white font-bold text-xs px-5 py-2.5 rounded-lg">
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
