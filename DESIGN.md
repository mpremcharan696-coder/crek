---
name: Crek AI (Pilotly) Design System
description: Modern dark-mode high-craft UI design system for AI comment & DM automation
colors:
  primary: "#a855f7"
  primary-hover: "#9333ea"
  secondary: "#10b981"
  secondary-hover: "#059669"
  dark-bg: "#030712"
  card-bg: "#090d1a"
  card-border: "#1e293b"
  text-heading: "#f8fafc"
  text-body: "#94a3b8"
typography:
  display:
    fontFamily: "Georgia, Cambria, serif"
    fontSize: "clamp(1.5rem, 4vw, 2.5rem)"
    fontWeight: 700
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    lineHeight: "1.5"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
---

# Design System

## Overview
Crek AI features an ultra-sleek, premium dark mode aesthetic tailored for modern content creators. It combines high-contrast dark slate containers with vibrant purple accents, emerald success indicators, and refined typography.

## Colors
- **Background (`dark-bg`):** Deep obsidian (`#030712`) providing high-contrast depth.
- **Surface / Cards (`card-bg`):** Slate dark navy (`#090d1a`) with subtle glassmorphic slate borders (`#1e293b`).
- **Primary Accent (`primary`):** Electric purple (`#a855f7`) used for AI badges, key CTAs, and interactive highlights.
- **Secondary Accent (`secondary`):** Vivid emerald (`#10b981`) used for live indicators, active states, and successful automations.

## Typography
- **Headings & Titles:** Serif typography (`Georgia, serif`) for high editorial polish and creator authority.
- **Body & Controls:** Crisp sans-serif (`Inter, sans-serif`) for max scanability and readability in data-dense dashboards.

## Layout & Components
- **Card Containers:** Rounded corners (`16px` / `24px`) with subtle slate borders and backdrop blur.
- **Interactive Buttons:** Bold, high-contrast buttons with smooth hover transitions and active state pulse dots.
- **Micro-Interactions:** Smooth spring animations (`framer-motion`), real-time toast notifications, and live status badges.
