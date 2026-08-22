# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Instagram Content Creators, Founders, and Brand Managers who receive high comment volume on Instagram Reels and need fast, contextual AI replies without compromising their unique brand voice.

## Product Purpose
Crek (Pilotly.ai) automates Instagram comment management and DM lead generation. It analyzes Reel video/audio content, understands video context, and generates human-like replies matching the creator's exact voice mode (Witty, Roast, Helpful Expert, Casual, etc.).

## Positioning
Unlike generic auto-reply bots that output robotic "I don't have that info from the video" disclaimers, Crek uses a multi-LLM engine (Gemini Flash video analysis + Qwen 27B text + xAI Grok real-time web search) and an interactive live sandbox chat to deliver zero-bot-slop, hyper-accurate creator replies.

## Operating Context
- **Pending Approval Inbox:** Creators review and batch-approve/reject AI draft replies in real-time.
- **Automation Setup & Voice Wizard:** 6-step wizard with live AI sandbox chat to test and lock voice modes before enabling auto-reply.
- **Analytics & DM Automations:** Real-time tracking of comment reply volume, keyword DM triggers, and viewer engagement.

## Capabilities and Constraints
- Meta Instagram Graph API integration (OAuth login, webhook comment ingestion, comment reply publishing).
- FastAPI backend running on Google Cloud Run with Neon PostgreSQL & Upstash Redis.
- React + Vite + Tailwind CSS frontend deployed on Vercel.

## Brand Commitments
- Sleek, modern dark UI (`#030712` background, deep slate `#090D1A` cards).
- Distinct purple (`#A855F7`) and emerald (`#10B981`) accent highlights.
- Elegant serif headers paired with clean, readable sans-serif body typography.

## Evidence on Hand
- Live Vercel Frontend: `https://crekai-gamma.vercel.app`
- Live Cloud Run Backend: `https://pilotly-api-server-543261599288.us-central1.run.app`
- Unified Monorepo: `D:\crek`
