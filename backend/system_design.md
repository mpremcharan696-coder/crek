# Pilotly SaaS — System Design Document

**Pilotly** is a full-stack SaaS platform designed for Instagram creators to automate Reel comment management, AI-driven engagement, and personalized audience interactions.

---

## 1. Core Architecture Overview

Pilotly follows a **lean, asynchronous, event-driven micro-monolith** architecture built on FastAPI, Neon PostgreSQL, Redis, and ARQ worker queues. The codebase has been refactored for minimal overhead (repository abstraction layer removed, direct SQLAlchemy queries used).

```mermaid
graph TD
    subgraph Client & Third-Party Interfaces
        MetaWebhooks[Instagram / Meta Webhooks]
        CreatorUI[Next.js Creator Dashboard]
    end

    subgraph FastAPI Application Layer
        API[FastAPI Routers]
        AuthSvc[Auth Service]
        CommentSvc[Comment Service]
        ReelSvc[Reel Service]
        MetaAPI[Meta Graph API Service]
        AISvc[AI Agent Service]
    end

    subgraph Storage & Queues
        DB[(Neon PostgreSQL)]
        Redis[(Redis Broker)]
    end

    subgraph ARQ Background Workers
        WorkerPool[ARQ Worker Pool]
        TaskComment[process_comment_task]
        TaskReel[analyze_reel_task]
        TaskSyncReels[sync_all_reels_task]
        TaskSyncComments[sync_all_comments_task]
        TaskToken[refresh_expiring_tokens_task]
    end

    subgraph AI External Engines
        Gemini[Google Gemini 2.5 Flash]
        Groq[Groq API - Qwen LLM]
        xAI[xAI Grok API]
    end

    MetaWebhooks -->|HTTP POST| API
    CreatorUI -->|REST / JWT| API
    API --> AuthSvc & CommentSvc & ReelSvc
    CommentSvc & ReelSvc -->|Direct SQLAlchemy| DB
    API -->|Enqueue Jobs| Redis
    Redis --> WorkerPool
    WorkerPool --> TaskComment & TaskReel & TaskSyncReels & TaskSyncComments & TaskToken

    TaskReel -->|Multimodal Video Analysis| Gemini
    TaskComment --> AISvc
    AISvc -->|Text Generation| Groq
    AISvc -->|Real-Time Data Search| xAI
    TaskComment -->|Post Reply| MetaAPI
    MetaAPI -->|Graph API| MetaWebhooks
```

---

## 2. AI Pipeline & Model Responsibility Matrix

To optimize cost (free tier preservation) and response quality, model responsibilities are strictly compartmentalized:

| AI Engine | Primary Responsibility | Model / Endpoint | Trigger Condition |
| :--- | :--- | :--- | :--- |
| **Google Gemini** | **Reel Video Analysis** | `gemini-2.5-flash` | Triggered when a new reel is uploaded/discovered. Downloads MP4, uploads via Gemini File API, extracts visual topics, products, key points, and FAQ. |
| **Qwen (via Groq)** | **Comment Reply Generation & Logic** | `qwen/qwen3.6-27b` | Triggered for every incoming comment. Evaluates if the question can be answered using Reel context. If missing information is required, requests real-time web search. |
| **xAI Grok** | **Real-Time Live Data Provider** | `https://api.x.ai/v1` | Called *only* when Qwen determines that real-time live data (e.g. current events, sports scores, live stats, external links) is required. |

### AI Workflow Logic (`AIAgentService`)
1. **Comment Received** + **Reel AI Summary** passed into `AIAgentService.generate_reply()`.
2. **Qwen Check**: Qwen checks if real-time web search is required to answer the user's comment accurately.
3. **If Real-Time Needed**: Queries xAI Grok API (`_fetch_realtime_context_via_xai`) for fresh ground-truth facts.
4. **Synthesis**: Qwen synthesizes the final reply adhering to the creator's voice, style, and tone preferences.

---

## 3. Core Data Flow & Workflows

### 3.1 Comment-to-Reply Pipeline (Sequence Workflow)

```mermaid
sequenceDiagram
    autonumber
    actor Fan as Instagram User
    participant Meta as Meta Webhooks / Graph API
    participant Worker as ARQ Worker (process_comment_task)
    participant DB as Neon Postgres DB
    participant AI as AI Agent Service (Qwen / xAI)

    Fan->>Meta: Posts comment on Creator's Reel
    Meta->>Worker: Webhook Event received (enqueue process_comment_task)
    Worker->>DB: Fetch Reel & ReelSummary context
    alt Summary missing
        Worker->>Worker: Retry with exponential backoff (60s, 120s, 300s)
    end
    Worker->>DB: Fetch Creator preferences (auto_reply_enabled, tone, style)
    Worker->>AI: generate_reply(comment, summary, creator_style)
    opt Real-time data needed
        AI->>AI: Fetch context via xAI Grok API
    end
    AI-->>Worker: Returns {reply_text, used_web_search}
    Worker->>DB: Store CommentReply (status='approved' or 'pending')
    alt auto_reply_enabled == True
        Worker->>Meta: POST /v21.0/{comment_id}/replies
        Meta-->>Worker: ig_reply_id
        Worker->>DB: Update status='posted', reply_ig_id
    else auto_reply_enabled == False
        Worker->>DB: Status remains 'pending' (Awaits manual Creator approval via Dashboard)
    end
```

### 3.2 Reel Multimodal Analysis Pipeline

```mermaid
sequenceDiagram
    autonumber
    participant Meta as Meta Graph API
    participant Worker as ARQ Worker (analyze_reel_task)
    participant Media as Media Processor
    participant Gemini as Google Gemini File API
    participant DB as Neon Postgres DB

    Worker->>Meta: Fetch media_url for Reel (if missing)
    Worker->>Media: Download video stream to temp MP4 file
    Media-->>Worker: local_video_path
    Worker->>Gemini: Upload video file via File API
    Gemini-->>Worker: File URI
    Worker->>Gemini: Generate Content (Prompt: Extract topics, products, key points, FAQ)
    Gemini-->>Worker: Structured Reel Summary JSON
    Worker->>DB: Save ReelSummary record & mark Reel.is_analyzed = True
    Worker->>Media: Cleanup temporary MP4 file
```

---

## 4. Database Schema (Neon PostgreSQL)

The database schema is lightweight and optimized for multi-tenant isolation via `user_id` / `instagram_user_id`.

```mermaid
erDiagram
    users ||--o{ user_tokens : owns
    users ||--o{ reels : posts
    reels ||--o| reel_summaries : has
    reels ||--o{ comments : receives
    comments ||--o| comment_replies : generates

    users {
        bigint id PK
        string instagram_user_id UK
        string username
        string full_name
        string profile_picture_url
        boolean auto_reply_enabled
        string reply_tone
        string reply_style
        boolean is_active
        timestamp created_at
    }

    user_tokens {
        bigint id PK
        bigint user_id FK
        text encrypted_access_token
        string token_type
        timestamp expires_at
    }

    reels {
        bigint id PK
        bigint user_id FK
        string media_id UK
        text caption
        text media_url
        text thumbnail_url
        text permalink
        integer like_count
        integer comments_count
        boolean is_analyzed
        timestamp published_at
    }

    reel_summaries {
        bigint id PK
        bigint reel_id FK, UK
        jsonb ai_summary
        jsonb topics
        jsonb products
        jsonb key_points
        jsonb faq
        text transcript
        string model
    }

    comments {
        bigint id PK
        bigint reel_id FK
        string comment_id UK
        text text
        string commenter_id
        string commenter_username
        string parent_comment_id
        boolean is_processed
        timestamp created_at
    }

    comment_replies {
        bigint id PK
        bigint comment_id FK, UK
        text reply_text
        string status
        boolean used_web_search
        string ai_model
        string reply_ig_id
        timestamp posted_at
    }
```

---

## 5. Background Worker Cron & Queue Schedule

ARQ manages asynchronous execution with Redis:

| Task Function | Schedule / Trigger | Purpose |
| :--- | :--- | :--- |
| `process_comment_task` | On Demand (Webhook) | End-to-end processing of a single comment event. |
| `analyze_reel_task` | On Demand (Sync/Webhook) | Downloads Reel video & extracts Gemini AI summary. |
| `sync_all_reels_task` | Cron (Every 5 mins) | Discovers newly published Reels from active Meta accounts. |
| `sync_all_comments_task` | Cron (Every 2 mins) | Fallback sync for missed webhooks across 2 newest reels per active user. |
| `refresh_expiring_tokens_task` | Cron (Daily at 03:00 UTC) | Auto-refreshes Meta long-lived access tokens expiring within 7 days. |

---

## 6. Next Steps & Development Roadmap

1. **Phase 1: Next.js Frontend Dashboard** (Upcoming)
   - Account onboarding & Meta OAuth connect button
   - Creator settings panel (auto-reply toggle, reply tone/style customization)
   - Reel feed & summary viewer
   - Pending reply approval/rejection Inbox with single-click manual edit & post
2. **Comment-to-DM Engine**
   - Keyword-trigger rule matcher to send automated Instagram DMs (e.g. "Comment LINK for access")
3. **Multi-tenancy & Monetization**
   - Stripe / Razorpay integration with tier limits (e.g., Free Tier: 50 automated replies/mo, Creator Tier: unlimited).
