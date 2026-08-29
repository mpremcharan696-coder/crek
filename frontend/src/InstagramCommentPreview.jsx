import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';

const InstagramCommentPreview = forwardRef(function InstagramCommentPreview(
  {
    apiUser,
    voiceProfile = {},
    showTopChips = false,
  },
  ref
) {
  const [commentText, setCommentText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [commentsThread, setCommentsThread] = useState([
    {
      id: 1,
      author: 'tech.investor',
      text: "What's the difference between amazon gpus and nvidia gpus",
      time: '1w',
      replies: [
        {
          id: 101,
          author: apiUser?.username || 'thefinancial.pilot',
          avatar: apiUser?.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          text: "Amazon makes custom Trainium & Inferentia silicon tuned for internal AWS cloud scaling, while NVIDIA GPUs (H100/Blackwell) dominate general-purpose AI training with full CUDA ecosystem support. Both serve different parts of the AI infra stack! 🚀",
          time: '1w',
        }
      ]
    }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePostComment = async (customText = null) => {
    const textToPost = customText || commentText;
    if (!textToPost.trim() || isGenerating) return;

    const newCommentId = Date.now();
    const newEntry = {
      id: newCommentId,
      author: 'alex_creator',
      text: textToPost,
      time: 'Just now',
      replies: [],
    };

    setCommentsThread((prev) => [newEntry, ...prev]);
    if (!customText) setCommentText('');
    setIsGenerating(true);

    try {
      const baseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1').replace('/api/v1', '');
      const res = await fetch(`${baseUrl}/api/v1/demo/draft-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: textToPost,
          product_context: voiceProfile?.knowledge || voiceProfile?.tone_description || 'Friendly AI assistant',
        }),
      });
      const data = await res.json();
      const aiReply = data.reply || 'Thanks for your comment! Generated in your custom voice.';

      setCommentsThread((prev) =>
        prev.map((c) =>
          c.id === newCommentId
            ? {
                ...c,
                replies: [
                  {
                    id: Date.now() + 1,
                    author: apiUser?.username || 'thefinancial.pilot',
                    avatar: apiUser?.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
                    text: aiReply,
                    time: 'Just now',
                  },
                ],
              }
            : c
        )
      );
    } catch {
      setCommentsThread((prev) =>
        prev.map((c) =>
          c.id === newCommentId
            ? {
                ...c,
                replies: [
                  {
                    id: Date.now() + 1,
                    author: apiUser?.username || 'thefinancial.pilot',
                    avatar: apiUser?.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
                    text: 'Great question! We will cover this in our upcoming reel update.',
                    time: 'Just now',
                  },
                ],
              }
            : c
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  useImperativeHandle(ref, () => ({
    postComment: handlePostComment,
    setCommentText: setCommentText,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* ══════════ DARK THEME INSTAGRAM COMMENT PHONE FRAME (COMPACT FIT) ══════════ */}
      <div style={{
        width: '100%',
        maxWidth: 380,
        borderRadius: 32,
        background: '#000000',
        border: '8px solid #1E1E24',
        boxShadow: '0 16px 36px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: 520,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        color: '#FFFFFF',
      }}>
        {/* Header Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: '1px solid #1A1A1A', background: '#000000',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img
              src={apiUser?.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
              alt="Avatar"
              style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{apiUser?.username || 'thefinancial.pilot'}</span>
              </div>
              <div style={{ fontSize: 10, color: '#737373' }}>Original audio</div>
            </div>
          </div>
          <span style={{ fontSize: 16, color: '#FFFFFF', cursor: 'pointer' }}>•••</span>
        </div>

        {/* Scrollable Comments Thread */}
        <div style={{ flex: 1, padding: '10px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {commentsThread.map((item) => (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Follower Root Comment */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#262626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#A8A8A8', flexShrink: 0 }}>
                    👤
                  </div>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 12, marginRight: 6 }}>{item.author}</span>
                    <span style={{ fontSize: 12, color: '#E0E0E0', lineHeight: 1.35 }}>{item.text}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: '#737373', marginTop: 3 }}>
                      <span>{item.time}</span>
                      <span style={{ cursor: 'pointer', fontWeight: 600 }}>Reply</span>
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 13, color: '#737373', cursor: 'pointer' }}>♡</span>
              </div>

              {/* Nested AI Generated Reply Thread */}
              {item.replies && item.replies.length > 0 && (
                <div style={{ marginLeft: 34, paddingLeft: 10, borderLeft: '1.5px solid #262626', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {item.replies.map((reply) => (
                    <motion.div
                      key={reply.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <img
                          src={reply.avatar}
                          alt="Creator"
                          style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }}
                        />
                        <div>
                          <div style={{ display: 'inline', fontWeight: 700, fontSize: 12, marginRight: 6 }}>
                            {reply.author}
                          </div>
                          <span style={{ fontSize: 12, color: '#F0F0F0', lineHeight: 1.4 }}>
                            {reply.text}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: '#737373', marginTop: 3 }}>
                            <span>{reply.time}</span>
                            <span style={{ cursor: 'pointer', fontWeight: 600 }}>Reply</span>
                            <span>•••</span>
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: '#737373', cursor: 'pointer' }}>♡</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isGenerating && (
            <div style={{ marginLeft: 34, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#0095F6', fontStyle: 'italic' }}>
              <div style={{ width: 10, height: 10, border: '2px solid #0095F6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span>AI is drafting comment reply in your voice…</span>
            </div>
          )}
        </div>

        {/* Insights & Boost Reel Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 14px', borderTop: '1px solid #1A1A1A', background: '#000000',
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#0095F6', cursor: 'pointer' }}>View insights</span>
          <button style={{
            background: '#0095F6', color: '#FFFFFF', border: 'none',
            borderRadius: 5, padding: '3px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer',
          }}>
            Boost reel
          </button>
        </div>

        {/* Reel Action Icons (Heart, Comment, Share, Bookmark) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px', color: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 16 }}>
            <span>♡</span>
            <span>💬</span>
            <span>🔁</span>
            <span>➤</span>
          </div>
          <span style={{ fontSize: 16 }}>🔖</span>
        </div>

        <div style={{ padding: '0 14px 4px', fontSize: 10, color: '#A8A8A8' }}>
          Be the first to <strong style={{ color: '#FFFFFF' }}>like this</strong> • <span style={{ color: '#737373' }}>June 25</span>
        </div>

        {/* Bottom Interactive Add Comment Input Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          borderTop: '1px solid #1A1A1A', background: '#000000',
        }}>
          <span style={{ fontSize: 15 }}>😊</span>
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
            placeholder="Add a comment..."
            disabled={isGenerating}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#FFFFFF', fontSize: 12, caretColor: '#0095F6',
            }}
          />
          <button
            onClick={() => handlePostComment()}
            disabled={!commentText.trim() || isGenerating}
            style={{
              background: 'none', border: 'none', color: commentText.trim() ? '#0095F6' : '#555555',
              fontWeight: 700, fontSize: 12, cursor: commentText.trim() ? 'pointer' : 'default',
            }}
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
});

export default InstagramCommentPreview;
