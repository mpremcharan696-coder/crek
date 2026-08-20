import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signInWithGoogle, handleSignOut } from './firebase';
import { setAuthToken, getAuthToken, draftDemoReply } from './api';
import Dashboard from './Dashboard';

/* ════════════════════════════════════════════
   NAVBAR
   ════════════════════════════════════════════ */
function Navbar({ onGetStarted, user }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = ['Product', 'Solutions', 'Pricing', 'Resources'];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6 lg:px-12 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
          : 'bg-white'
      }`}
    >
      <a href="#" className="flex items-center gap-0.5 select-none">
        <span className="text-xl font-extrabold tracking-tight text-gray-900">Pilotly</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] mb-3 ml-0.5" />
      </a>

      <div className="hidden md:flex items-center gap-8">
        {links.map((link) => (
          <a
            key={link}
            href="#"
            className="text-[13px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900 transition-colors duration-200"
          >
            {link}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-900 bg-gray-100 rounded-full hover:bg-gray-200 transition-all"
          >
            <img src={user.photo} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
            <span>Dashboard</span>
          </button>
        ) : (
          <>
            <button
              onClick={onGetStarted}
              className="hidden sm:inline-flex items-center px-5 py-2.5 text-[13px] font-bold uppercase tracking-wider text-white bg-[#7C3AED] rounded-full hover:bg-[#6D28D9] transition-all duration-200 shadow-md flex items-center gap-2"
            >
              <span>Get Started</span>
            </button>
            <button
              onClick={onGetStarted}
              className="text-[13px] font-bold uppercase tracking-wider text-gray-600 hover:text-gray-900 transition-colors duration-200 px-3 py-2"
            >
              Sign In
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

/* ════════════════════════════════════════════
   HEART ICON
   ════════════════════════════════════════════ */
function HeartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="1.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

/* ════════════════════════════════════════════
   VERIFIED BADGE
   ════════════════════════════════════════════ */
function VerifiedBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#3B82F6">
      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

/* ════════════════════════════════════════════
   INSTAGRAM COMMENT DEMO
   ════════════════════════════════════════════ */

const CONVERSATIONS = [
  {
    user: {
      username: 'fitness_lover22',
      avatarColor: '#6B7280',
      comment: 'Does this protein work for lactose intolerant people? 🥛',
      time: '9h',
    },
    reply: {
      username: 'your_brand',
      comment: '@fitness_lover22 Yes! It\'s 100% dairy-free 🌱 Check your DMs for a discount code!',
      time: '9h',
    },
  },
  {
    user: {
      username: 'skincare.queen',
      avatarColor: '#EC4899',
      comment: 'Can I use this on sensitive skin? Been looking for something gentle 🧴',
      time: '5h',
    },
    reply: {
      username: 'your_brand',
      comment: '@skincare.queen Absolutely! It\'s dermatologist tested for all skin types. Check your DMs! 💜',
      time: '5h',
    },
  },
  {
    user: {
      username: 'crypto_trader99',
      avatarColor: '#F59E0B',
      comment: 'What\'s the current BTC price? 📈',
      time: '2h',
    },
    reply: {
      username: 'your_brand',
      comment: '@crypto_trader99 BTC is at $97,432 — down 1.2% today 📉 Check your DMs for our full analysis!',
      time: '2h',
    },
  },
];

function InstagramCommentDemo() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showReply, setShowReply] = useState(false);
  const [showTyping, setShowTyping] = useState(false);

  useEffect(() => {
    const cycle = () => {
      setShowReply(false);
      setShowTyping(false);

      // Show typing after 1.5s
      const t1 = setTimeout(() => setShowTyping(true), 1500);
      // Show reply after 3s
      const t2 = setTimeout(() => {
        setShowTyping(false);
        setShowReply(true);
      }, 3000);
      // Move to next conversation after 6s
      const t3 = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % CONVERSATIONS.length);
      }, 6500);

      return [t1, t2, t3];
    };

    const timeouts = cycle();
    return () => timeouts.forEach(clearTimeout);
  }, [currentIndex]);

  const convo = CONVERSATIONS[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.4 }}
      className="w-full max-w-[420px] mx-auto"
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: '#262626' }}
      >
        {/* Comment area */}
        <div className="p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              {/* User comment */}
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex-shrink-0"
                  style={{ backgroundColor: convo.user.avatarColor }}
                />

                {/* Comment body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-semibold text-white">{convo.user.username}</span>
                    <span className="text-[12px] text-[#737373]">{convo.user.time}</span>
                  </div>
                  <p className="text-[14px] text-white mt-1 leading-[1.4]">
                    {convo.user.comment}
                  </p>
                  {!showReply && (
                    <button className="text-[12px] text-[#737373] font-semibold mt-1.5">Reply</button>
                  )}
                </div>

                {/* Heart */}
                <div className="flex-shrink-0 pt-2">
                  <HeartIcon />
                </div>
              </div>

              {/* Typing indicator */}
              <AnimatePresence>
                {showTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ marginTop: '16px', paddingLeft: '48px' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden"
                        style={{
                          background: 'linear-gradient(135deg, #833AB4, #FD1D1D, #F77737)',
                          padding: '2px',
                        }}
                      >
                        <div className="w-full h-full rounded-full bg-[#7C3AED] flex items-center justify-center">
                          <span className="text-white text-[8px] font-bold">P</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AI Reply (nested & indented) */}
              <AnimatePresence>
                {showReply && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    style={{ marginTop: '16px', paddingLeft: '48px' }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Author avatar with IG gradient ring */}
                      <div
                        className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden"
                        style={{
                          background: 'linear-gradient(135deg, #833AB4, #FD1D1D, #F77737)',
                          padding: '2px',
                        }}
                      >
                        <div className="w-full h-full rounded-full bg-[#7C3AED] flex items-center justify-center">
                          <span className="text-white text-[8px] font-bold">P</span>
                        </div>
                      </div>

                      {/* Reply body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-white">{convo.reply.username}</span>
                          <VerifiedBadge />
                          <span className="text-[12px] text-[#737373]">{convo.reply.time}</span>
                          <span className="text-[11px] text-[#737373]">•</span>
                          <span className="text-[11px] text-[#737373] font-medium">Author</span>
                        </div>
                        <p className="text-[13px] text-white mt-1 leading-[1.4]">
                          <span className="text-[#E0D4FC]">@{convo.user.username}</span>
                          {' '}{convo.reply.comment.split(`@${convo.user.username} `)[1]}
                        </p>
                      </div>

                      {/* Heart */}
                      <div className="flex-shrink-0 pt-2">
                        <HeartIcon />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Label below */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        <span className="text-[11px] text-gray-400 font-medium tracking-wide uppercase">Powered by Pilotly AI</span>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════
   TRUST BAR
   ════════════════════════════════════════════ */
function TrustBar() {
  const items = [
    { icon: '📱', label: 'Meta Business Partners' },
    { icon: '⭐', label: '4.6/5 Stars Rating' },
    { icon: '🚀', label: '50K+ Creators' },
  ];

  return (
    <div className="border-t border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-6 flex flex-wrap items-center justify-center gap-8 md:gap-14">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-gray-400">
            <span className="text-lg">{item.icon}</span>
            <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   SECTION 2: COMMENT TO DM AUTOMATION
   ════════════════════════════════════════════ */
function CommentToDMSection() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    let timeouts = [];
    const runAnimation = () => {
      setStep(0);
      timeouts.push(setTimeout(() => setStep(1), 1200)); // open comment sheet & type keyword
      timeouts.push(setTimeout(() => setStep(2), 3000)); // comment posted
      timeouts.push(setTimeout(() => setStep(3), 4500)); // DM notification & switch to DM view
      timeouts.push(setTimeout(runAnimation, 9500));    // loop
    };
    runAnimation();
    return () => timeouts.forEach(clearTimeout);
  }, []);

  return (
    <section className="min-h-[calc(100vh-80px)] py-16 bg-gray-50 border-t border-gray-100 flex flex-col justify-center overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Text Column */}
          <div>
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-[#7C3AED] bg-[#7C3AED]/10 px-3.5 py-1.5 rounded-full mb-4">
              Comment-to-DM Automation
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight leading-[1.15]">
              Turn Reel Comments <br className="hidden sm:block" /> Into Instant Sales.
            </h2>
            <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-lg">
              Followers comment a keyword like <span className="font-semibold text-[#7C3AED]">"GROWTH"</span> on your post or reel, and Pilotly instantly delivers your link, ebook, or offer straight to their Instagram DMs.
            </p>

            {/* Feature Bullets */}
            <div className="mt-8 space-y-4">
              {[
                { title: 'Instant DM Delivery', desc: 'Sends under 3 seconds in your brand voice' },
                { title: 'Meta API Approved', desc: '100% compliant with Instagram policies' },
                { title: 'Rich Link Cards', desc: 'Deliver downloadable PDFs, links, or coupon codes' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-xs">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{item.title}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Phone Mockup with Instagram UI */}
          <div className="flex justify-center">
            <div className="relative w-[280px] sm:w-[300px] h-[570px]">
              {/* Side Buttons */}
              <div className="absolute -left-[7px] top-20 w-[4px] h-8 bg-gray-700 rounded-l-md" />
              <div className="absolute -left-[7px] top-30 w-[4px] h-8 bg-gray-700 rounded-l-md" />
              <div className="absolute -right-[7px] top-24 w-[4px] h-10 bg-gray-700 rounded-r-md" />

              {/* Phone Shell */}
              <div className="relative w-full h-full bg-[#1C1C1E] rounded-[40px] p-[8px] pt-[14px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.1)] border border-gray-700/60 flex flex-col justify-between overflow-hidden">
                
                {/* Sleek Top Speaker & Camera Lens in Top Bezel */}
                <div className="absolute top-[4px] left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-40">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a] border border-gray-800 flex items-center justify-center">
                    <div className="w-0.5 h-0.5 rounded-full bg-blue-900/60" />
                  </div>
                  <div className="w-8 h-1 bg-gray-800 rounded-full" />
                </div>

                {/* Phone Screen Container */}
                <div className="relative w-full h-full bg-black rounded-[28px] overflow-hidden">
                  
                  {/* Home Bar Indicator */}
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/40 rounded-full z-50 pointer-events-none" />
                
                {/* VIEW 1: REEL & COMMENT SCREEN (Steps 0, 1, 2) */}
                {step < 3 && (
                  <div className="relative w-full h-full flex flex-col justify-between bg-[#141417] overflow-hidden rounded-[24px]">
                    {/* Top Bar: Camera +, Reels & Friends Tabs (Positioned safely below top bezel) */}
                    <div className="px-3 pt-7 pb-1.5 flex items-center justify-between text-white text-xs z-10 bg-gradient-to-b from-black/95 via-black/60 to-transparent flex-shrink-0">
                      <span className="text-sm font-medium">+</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">Reels</span>
                        <span className="text-[11px] text-gray-400 font-medium">Friends</span>
                      </div>
                      <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-yellow-500 to-red-500 p-0.5">
                        <div className="w-full h-full rounded-full bg-black" />
                      </div>
                    </div>

                    {/* Logo Overlay Top Left */}
                    <div className="absolute top-14 left-3 z-10 font-black text-white text-xs tracking-tighter">
                      IFC.
                    </div>

                    {/* Simulated Reel Video Background & Green Highlighted Headline */}
                    <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-neutral-900 to-black flex items-center justify-center p-3">
                      <div className="w-full text-center space-y-1.5 max-w-[200px]">
                        {/* Green Highlighted Banner */}
                        <div className="bg-[#22C55E] text-black font-extrabold text-[11px] px-2.5 py-1 rounded-sm shadow-md leading-snug">
                          A 16-year-old is launching an AI startup aimed at benefiting his country.
                        </div>
                        <div className="bg-black/80 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-sm inline-block">
                          Comment "GROWTH" 👇
                        </div>
                      </div>
                    </div>

                    {/* Right Side Vertical Action Icons */}
                    <div className="absolute right-2 bottom-10 flex flex-col items-center gap-2 text-white text-[9px] z-10">
                      <div className="flex flex-col items-center gap-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        <span>159</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <span>4</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                        <span>4</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        <span>55</span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        <span>24</span>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                      <div className="w-3.5 h-3.5 rounded-md bg-emerald-700 border border-white/20 flex items-center justify-center text-[5px] font-bold">
                        IFC.
                      </div>
                    </div>

                    {/* Creator Info & Caption Bottom Left */}
                    <div className="px-2.5 pb-8 z-10 bg-gradient-to-t from-black via-black/90 to-transparent pt-2 flex-shrink-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[6px] font-bold">
                          IFC.
                        </div>
                        <span className="text-[10px] font-bold text-white">indianfoundersco</span>
                        <button className="text-[7px] text-white border border-white/40 px-1 py-0.1 rounded font-medium">
                          Follow
                        </button>
                      </div>
                      <p className="text-[9px] text-gray-200 line-clamp-2 leading-tight">
                        Most 16-year-olds are preparing for exams... Comment <span className="font-bold text-yellow-300">"GROWTH"</span> to receive guide!
                      </p>
                    </div>

                    {/* Bottom Instagram Navigation Bar */}
                    <div className="absolute bottom-0 inset-x-0 h-7 bg-black border-t border-white/10 flex items-center justify-around text-gray-400 text-[10px] z-20 px-2">
                      <span>🏠</span>
                      <span className="text-white font-bold">🎬</span>
                      <span>➕</span>
                      <span>🔍</span>
                      <div className="w-3 h-3 rounded-full bg-gray-600 border border-white/40" />
                    </div>

                    {/* INSTAGRAM COMMENT SHEET OVERLAY */}
                    <AnimatePresence>
                      {step >= 1 && (
                        <motion.div
                          initial={{ y: '100%' }}
                          animate={{ y: 0 }}
                          exit={{ y: '100%' }}
                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                          className="absolute inset-x-0 bottom-7 top-[135px] bg-[#1C1C1E] rounded-t-xl z-30 flex flex-col justify-between border-t border-white/10"
                        >
                          {/* Drag handle */}
                          <div className="w-full pt-2 pb-1 flex flex-col items-center border-b border-white/5">
                            <div className="w-8 h-1 bg-gray-500/50 rounded-full" />
                            <span className="text-[11px] font-bold text-white mt-1">Comments</span>
                          </div>

                          {/* Comments List */}
                          <div className="p-2 flex-1 overflow-y-auto space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="w-5 h-5 rounded-full bg-blue-500 flex-shrink-0" />
                              <div>
                                <span className="text-[11px] font-bold text-white">alex_creator</span>
                                <p className="text-[10px] text-gray-300 mt-0.5">Is this automation Meta compliant?</p>
                                <span className="text-[9px] text-gray-500 mt-0.5 inline-block">1h</span>
                              </div>
                            </div>

                            {/* User's posted comment at Step 2 */}
                            {step >= 2 && (
                              <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-start gap-2"
                              >
                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex-shrink-0" />
                                <div>
                                  <span className="text-[11px] font-bold text-white">you</span>
                                  <p className="text-[11px] font-bold text-yellow-300 mt-0.5">GROWTH 🔥</p>
                                  <span className="text-[9px] text-gray-500 mt-0.5 inline-block">Just now</span>
                                </div>
                              </motion.div>
                            )}
                          </div>

                          {/* Emoji quick reactions bar */}
                          <div className="px-2 py-1 border-t border-white/5 flex items-center justify-between text-[10px]">
                            <span>❤️</span>
                            <span>🙌</span>
                            <span>🔥</span>
                            <span>👏</span>
                            <span>😢</span>
                            <span>😍</span>
                            <span>😮</span>
                          </div>

                          {/* Comment input box */}
                          <div className="p-2 bg-[#121212] flex items-center gap-1.5 border-t border-white/10">
                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex-shrink-0" />
                            <div className="flex-1 bg-[#262626] rounded-full px-2.5 py-1 text-[10px] text-white flex items-center justify-between">
                              <span>
                                {step === 1 ? (
                                  <span className="text-yellow-300 font-bold animate-pulse">GROWTH 🔥</span>
                                ) : (
                                  <span className="text-gray-500">What do you think of this?</span>
                                )}
                              </span>
                              <div className="flex items-center gap-1 text-gray-400 text-[9px]">
                                🖼️ 🙂
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* VIEW 2: INSTAGRAM DM CHAT SCREEN (Step 3) */}
                {step >= 3 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative w-full h-full bg-black flex flex-col justify-between rounded-[26px] overflow-hidden"
                  >
                    {/* DM Top Bar */}
                    <div className="px-3 pt-7 pb-1.5 border-b border-[#262626] flex items-center justify-between bg-black text-white flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        <div className="w-5 h-5 rounded-full bg-[#7C3AED] flex items-center justify-center text-[9px] font-bold">P</div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold leading-none">Pilotly AI</span>
                            <span className="text-[8px] text-blue-400">✓</span>
                          </div>
                          <span className="text-[7px] text-gray-400 block leading-none mt-0.5">pilotly.ai</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                      </div>
                    </div>

                    {/* Scrollable Chat Area */}
                    <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5">
                      {/* Prominent Center Profile Card Header */}
                      <div className="flex flex-col items-center py-2 px-1 text-center border-b border-[#262626]/40">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold mb-1 shadow-lg border border-white/10">
                          P
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs font-bold text-white">Pilotly AI</span>
                          <span className="text-[10px] text-blue-400">✓</span>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5">pilotly.ai</span>
                        <span className="text-[9px] text-gray-400 mt-0.5">140K followers • 430 posts</span>
                        <span className="text-[8px] text-gray-400 mt-0.5">You don't follow each other on Instagram</span>
                        <button className="mt-2 px-3 py-1 bg-[#262626] hover:bg-[#333742] text-white text-[10px] font-semibold rounded-lg border border-white/10">
                          View profile
                        </button>
                      </div>

                      {/* Timestamp */}
                      <div className="text-center my-1.5">
                        <span className="text-[8px] text-gray-500 font-medium tracking-wide uppercase">JUL 4, 10:20 PM</span>
                      </div>

                      {/* Received Automated Message Bubble (Left Aligned) */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-end gap-1 max-w-[94%]"
                      >
                        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex-shrink-0 flex items-center justify-center text-white text-[7px] font-bold mb-0.5">
                          P
                        </div>
                        <div className="bg-[#262626] text-white p-2.5 rounded-xl rounded-bl-sm text-[10px] leading-relaxed border border-white/5 space-y-1.5">
                          <p>Hey! Excited you're interested in the full system prompt 🚀</p>
                          <p className="text-gray-300 text-[9px]">Please make sure you are following me, and then click below so I can send you the link right away</p>

                          <button className="w-full mt-1.5 bg-[#333742] hover:bg-[#404552] text-white font-semibold text-[9px] py-1.5 rounded-lg border border-white/10 transition-colors">
                            Send me the link
                          </button>
                        </div>
                      </motion.div>

                      {/* User Sent Quick Response (Right Aligned Purple Pill) */}
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="flex justify-end mt-1.5"
                      >
                        <div className="bg-[#7C3AED] text-white px-3 py-1 rounded-full text-[10px] font-medium shadow-sm">
                          Send me the link
                        </div>
                      </motion.div>
                    </div>

                    {/* Bottom DM Toolbar */}
                    <div className="p-2 bg-black border-t border-[#262626] flex items-center gap-2 flex-shrink-0">
                      <div className="w-6 h-6 rounded-full bg-[#3B82F6] flex items-center justify-center text-white text-[9px]">
                        📷
                      </div>
                      <div className="flex-1 bg-[#1A1D24] rounded-full px-3 py-1 text-[11px] text-gray-500">
                        Message...
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                        <span>🎙️</span>
                        <span>🖼️</span>
                        <span>😃</span>
                        <span>➕</span>
                      </div>
                    </div>
                  </motion.div>
                )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   SECTION 3: REAL-TIME DATA AI DM AUTOMATION
   ════════════════════════════════════════════ */
function RealTimeDMSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const scenarios = [
    {
      id: 0,
      badge: 'STORE INVENTORY',
      title: 'Product Stock & Price',
      icon: '🛍️',
      desc: 'Follower asks if a product is in stock & price.',
      userQuestion: 'Is the Matte Black Puffer Jacket in stock and what is its price?',
      aiAnswer: 'Yes! The Matte Black Puffer Jacket is in stock in Size M & L for $149.00 (15% OFF today) 🏷️. Free shipping included! Tap below to buy:',
      ctaText: 'Buy Now — $149 🛍️',
      tagline: 'Instant E-Commerce Sales',
      accentColor: 'from-emerald-500 to-teal-600'
    },
    {
      id: 1,
      badge: 'LOGISTICS & TRACKING',
      title: 'Order Status & Shipping',
      icon: '📦',
      desc: 'Customer asks when order #4829 will arrive.',
      userQuestion: 'When will I receive my order #4829?',
      aiAnswer: 'Your order #4829 has shipped via FedEx Ground! 📦 Expected delivery: Tomorrow by 4:00 PM. Tracking code: #FX-98214-US',
      ctaText: 'Track Package 🚚',
      tagline: 'Cuts Support Tickets by 80%',
      accentColor: 'from-blue-500 to-cyan-600'
    },
    {
      id: 2,
      badge: 'LIVE MARKET API',
      title: 'Live Market & Financial Data',
      icon: '📈',
      desc: 'Follower asks for current stock or live API data.',
      userQuestion: 'What is the current price of NVIDIA stock?',
      aiAnswer: 'NVIDIA (NVDA) is currently trading at $128.45 USD (+3.2% today) 📈. Today\'s High: $129.10 | Vol: 42.5M. Data refreshed 2s ago live from API.',
      ctaText: 'View Live Market Feed 📊',
      tagline: 'Real-Time API Intelligence',
      accentColor: 'from-purple-500 to-indigo-600'
    }
  ];

  // Continuous auto loop cycling 0 -> 1 -> 2 -> 0 every 4.5s
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % scenarios.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [scenarios.length]);

  // Trigger typing & answer sequence when activeStep changes
  useEffect(() => {
    setIsTyping(true);
    setShowAnswer(false);

    const timer = setTimeout(() => {
      setIsTyping(false);
      setShowAnswer(true);
    }, 900);

    return () => clearTimeout(timer);
  }, [activeStep]);

  const current = scenarios[activeStep];

  return (
    <section className="min-h-[calc(100vh-80px)] py-16 bg-white border-t border-gray-100 flex flex-col justify-center overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Text Column */}
          <div>
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-[#7C3AED] bg-[#7C3AED]/10 px-3.5 py-1.5 rounded-full mb-4">
              Real-Time AI DM Automation
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight leading-[1.15]">
              Instant AI Answers <br className="hidden sm:block" /> Powered By Live Data.
            </h2>
            <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-lg">
              Connect Pilotly AI to your Shopify store, logistics carrier, or custom live APIs. It fetches real-time prices, stock status, and live market data in under 2 seconds.
            </p>

            {/* 3 Step Vertical Feature Cards (Listed on Left) */}
            <div className="mt-8 space-y-3.5">
              {scenarios.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => setActiveStep(item.id)}
                  className={`w-full p-4 rounded-2xl text-left transition-all duration-300 flex items-start gap-4 border ${
                    activeStep === item.id
                      ? 'bg-white shadow-lg border-[#7C3AED]/30 ring-2 ring-[#7C3AED]/10'
                      : 'bg-white/60 hover:bg-white border-gray-200/80 text-gray-700'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 font-bold transition-transform ${
                      activeStep === item.id ? 'scale-110 shadow-md' : 'opacity-80'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-gray-900">{item.title}</h4>
                      {activeStep === item.id && (
                        <span className="text-[10px] font-extrabold text-[#7C3AED] uppercase tracking-wider bg-[#7C3AED]/10 px-2 py-0.5 rounded-full">
                          LIVE NOW
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {item.userQuestion}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Phone Mockup displaying Live DM Flow */}
          <div className="flex justify-center">
            <div className="relative w-[280px] sm:w-[300px] h-[570px]">
              {/* Side Buttons */}
              <div className="absolute -left-[7px] top-20 w-[4px] h-8 bg-gray-700 rounded-l-md" />
              <div className="absolute -left-[7px] top-30 w-[4px] h-8 bg-gray-700 rounded-l-md" />
              <div className="absolute -right-[7px] top-24 w-[4px] h-10 bg-gray-700 rounded-r-md" />

              {/* Phone Shell */}
              <div className="relative w-full h-full bg-[#1C1C1E] rounded-[40px] p-[8px] pt-[14px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.1)] border border-gray-700/60 flex flex-col justify-between overflow-hidden">
                
                {/* Sleek Top Speaker & Camera Lens in Top Bezel */}
                <div className="absolute top-[4px] left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-40">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a] border border-gray-800 flex items-center justify-center">
                    <div className="w-0.5 h-0.5 rounded-full bg-blue-900/60" />
                  </div>
                  <div className="w-8 h-1 bg-gray-800 rounded-full" />
                </div>

                {/* Inner Phone Screen */}
                <div className="relative w-full h-full bg-black rounded-[28px] overflow-hidden flex flex-col justify-between">
                  {/* Home Bar Indicator */}
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/40 rounded-full z-50 pointer-events-none" />

                  {/* Instagram DM Header */}
                  <div className="px-3 pt-4 pb-2 border-b border-[#262626] flex items-center justify-between bg-black text-white z-10 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-[9px] font-bold">
                        P
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold leading-none">Pilotly AI</span>
                          <span className="text-[8px] text-blue-400">✓</span>
                        </div>
                        <div className="flex items-center gap-1 text-[7px] text-emerald-400 leading-none mt-0.5">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping inline-block" />
                          <span>Real-Time API Active</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                    </div>
                  </div>

                  {/* Chat Canvas */}
                  <div className="flex-1 p-2.5 overflow-y-auto space-y-3 flex flex-col justify-end pb-2">
                    {/* Timestamp */}
                    <div className="text-center my-1">
                      <span className="text-[8px] text-gray-500 font-semibold tracking-wider uppercase">
                        TODAY • REAL-TIME API ANSWER
                      </span>
                    </div>

                    {/* Customer Question Bubble (Right Aligned) */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={current.id + '-q'}
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        className="flex justify-end"
                      >
                        <div className="bg-[#7C3AED] text-white p-2.5 rounded-xl rounded-tr-sm text-[10px] leading-relaxed max-w-[88%] shadow-sm">
                          {current.userQuestion}
                        </div>
                      </motion.div>
                    </AnimatePresence>

                    {/* AI Typing Indicator State */}
                    {isTyping && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-1.5 text-gray-400 text-[9px]"
                      >
                        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white text-[7px] font-bold">
                          P
                        </div>
                        <div className="bg-[#262626] px-3 py-2 rounded-xl rounded-tl-sm flex items-center gap-1">
                          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" />
                          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </motion.div>
                    )}

                    {/* AI Response Bubble + CTA Card */}
                    {showAnswer && (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={current.id + '-a'}
                          initial={{ opacity: 0, y: 8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="flex items-start gap-1 max-w-[94%]"
                        >
                          <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white text-[7px] font-bold mt-1">
                            P
                          </div>
                          <div className="space-y-1.5">
                            <div className="bg-[#262626] text-white p-2.5 rounded-xl rounded-bl-sm text-[10px] leading-relaxed border border-white/5 shadow-sm">
                              <p>{current.aiAnswer}</p>
                            </div>

                            {/* Action Button Card */}
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`w-full bg-gradient-to-r ${current.accentColor} text-white font-bold text-[9px] py-1.5 px-3 rounded-lg shadow flex items-center justify-center gap-1.5 border border-white/20 transition-all`}
                            >
                              <span>{current.ctaText}</span>
                            </motion.button>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>

                  {/* Bottom DM Toolbar */}
                  <div className="p-1.5 bg-black border-t border-[#262626] flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-5 h-5 rounded-full bg-[#3B82F6] flex items-center justify-center text-white text-[8px]">
                      📷
                    </div>
                    <div className="flex-1 bg-[#1A1D24] rounded-full px-2.5 py-1 text-[10px] text-gray-500">
                      Message Pilotly AI...
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 text-[10px]">
                      <span>🎙️</span>
                      <span>🖼️</span>
                      <span>😃</span>
                      <span>➕</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   TRY BEFORE CONNECTING WIDGET
   ════════════════════════════════════════════ */
function TryBeforeConnectingWidget() {
  const [comment, setComment] = useState('');
  const [productContext, setProductContext] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDraft = async () => {
    if (!comment.trim()) return;
    setLoading(true);
    setReply('');
    try {
      const data = await draftDemoReply(comment.trim(), productContext.trim());
      setReply(data.reply || 'Reply generated successfully.');
    } catch {
      setReply("Couldn't generate a reply right now. Try again!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">✨</span>
        <span className="text-sm font-bold text-gray-900">Try it before you connect</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Type a comment you get all the time. Watch it draft your reply.</p>

      <input
        type="text"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleDraft()}
        placeholder="How much is shipping to Canada?"
        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 mb-2.5 bg-gray-50"
      />
      <input
        type="text"
        value={productContext}
        onChange={(e) => setProductContext(e.target.value)}
        placeholder="What you sell (optional)"
        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20 mb-3 bg-gray-50"
      />

      <button
        onClick={handleDraft}
        disabled={loading || !comment.trim()}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
          loading || !comment.trim()
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm'
        }`}
      >
        {loading ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
            <span>Drafting...</span>
          </>
        ) : (
          <>
            <span>✍️</span>
            <span>Draft my reply</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {reply && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 bg-purple-50 border border-purple-100 rounded-xl px-4 py-3"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1">AI Draft Reply</div>
            <p className="text-sm text-gray-800 leading-relaxed">{reply}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ════════════════════════════════════════════
   HERO / APP
   ════════════════════════════════════════════ */
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing');

  const handleGoogleSignUp = async () => {
    const result = await signInWithGoogle();
    if (result.user) {
      setUser(result.user);
      setView('dashboard');
    }
  };

  // On mount: check for OAuth ?token= redirect OR existing JWT session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const authError = params.get('auth_error');

    if (token) {
      // Returning from Meta OAuth — save JWT and go to dashboard
      setAuthToken(token);
      window.history.replaceState({}, '', '/');
      setUser({ name: 'Instagram Creator', photo: '', email: '' });
      setView('dashboard');
    } else if (authError) {
      // OAuth failed — stay on landing, clean URL
      window.history.replaceState({}, '', '/');
      console.warn('OAuth login failed:', authError);
    } else if (getAuthToken()) {
      // Existing session from a previous login
      setUser({ name: 'Instagram Creator', photo: '', email: '' });
      setView('dashboard');
    }
  }, []);

  const handleSignOutUser = async () => {
    await handleSignOut();
    setUser(null);
    setView('landing');
  };

  if (view === 'dashboard') {
    return <Dashboard user={user} onSignOut={handleSignOutUser} />;
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar onGetStarted={handleGoogleSignUp} user={user} />

      {/* Hero */}
      <main className="pt-20 pb-12 min-h-[calc(100vh-80px)] flex flex-col items-center justify-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 w-full text-center flex flex-col items-center">
          {/* Copy */}
          <div className="flex flex-col items-center text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="text-[36px] sm:text-[48px] lg:text-[54px] font-extrabold leading-[1.1] tracking-tight text-gray-900 text-center"
            >
              Social smarter,
              <br />
              not harder.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mt-4 text-base sm:text-lg text-gray-500 leading-relaxed max-w-[500px] text-center"
            >
              AI reads your reels, understands every question, and replies intelligently in your brand voice — on autopilot.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-6 mb-8 relative z-30 flex justify-center"
            >
              <button
                onClick={handleGoogleSignUp}
                className="inline-flex items-center px-8 py-3.5 text-[14px] font-bold uppercase tracking-wider text-white bg-[#7C3AED] rounded-full hover:bg-[#6D28D9] transition-all duration-200 hover:shadow-[0_8px_30px_rgba(124,58,237,0.35)] flex items-center gap-2 cursor-pointer"
              >
                <span>Get Started</span>
              </button>
            </motion.div>
          </div>

          {/* Instagram comment demo — Left side */}
          <div className="mt-8 w-full flex flex-col lg:flex-row gap-6 items-start justify-center">
            <InstagramCommentDemo />

            {/* Try Before Connecting Widget — Right side */}
            <TryBeforeConnectingWidget />
          </div>
        </div>
      </main>

      {/* Section 2: Comment-to-DM Automation */}
      <CommentToDMSection />

      {/* Section 3: Real-Time AI DM Automation */}
      <RealTimeDMSection />

      <TrustBar />
    </div>
  );
}
