import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ════════════════════════════════════════════════════════
   PILOTLY UI KIT
   Toggle · TextInput · TextArea · Select · Menu · Accordion
   · ThemeToggle — all theme-aware via CSS variables.
   ════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────
   THEME — .dark class on <html>, persisted
   ──────────────────────────────────────────── */
const THEME_KEY = 'pilotly-theme';

export function getStoredTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* private mode */ }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
}

export function useTheme() {
  const [theme, setThemeState] = useState(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  const setTheme = useCallback((next) => {
    applyTheme(next);
    setThemeState(next);
  }, []);
  return [theme, setTheme];
}

export function ThemeToggle({ style }) {
  const [theme, setTheme] = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className="ds-theme-btn"
      style={style}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -60, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 60, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.18 }}
          style={{ display: 'inline-flex' }}
        >
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/* ────────────────────────────────────────────
   TOGGLE — controlled switch with animated knob.
   Visual state is bound to `checked`; the knob can
   never desync from the value that drives it.
   ──────────────────────────────────────────── */
export function Toggle({ checked, onChange, disabled = false, label, size = 'md' }) {
  const dims = size === 'sm'
    ? { w: 38, h: 21, knob: 15, pad: 3 }
    : { w: 46, h: 25, knob: 19, pad: 3 };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: 'relative',
        width: dims.w,
        height: dims.h,
        borderRadius: 999,
        border: '1px solid',
        borderColor: checked ? 'var(--accent)' : 'var(--border)',
        background: checked
          ? 'var(--accent)'
          : 'color-mix(in srgb, var(--text-muted) 25%, transparent)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        padding: 0,
        flexShrink: 0,
        transition: 'background 200ms ease, border-color 200ms ease',
        boxShadow: checked ? '0 0 12px -2px var(--accent-ring)' : 'none',
      }}
    >
      <motion.span
        initial={false}
        animate={{ x: checked ? dims.w - dims.knob - dims.pad - 2 : dims.pad - 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          translateY: '-50%',
          width: dims.knob,
          height: dims.knob,
          borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          display: 'block',
        }}
      />
    </button>
  );
}

/* ────────────────────────────────────────────
   SETTING ROW — label + description + control,
   consistent vertical rhythm for settings pages.
   ──────────────────────────────────────────── */
export function SettingRow({ title, description, children }) {
  return (
    <div className="ds-row">
      <div style={{ minWidth: 0 }}>
        <span className="ds-row-label" style={{ fontWeight: 600 }}>{title}</span>
        {description && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.45 }}>
            {description}
          </p>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

/* ────────────────────────────────────────────
   TEXT INPUT / TEXT AREA — label · input · hint
   stacked on a 6px rhythm.
   ──────────────────────────────────────────── */
export function TextInput({ label, hint, required, style, containerStyle, ...props }) {
  const id = useId();
  return (
    <div className="ds-field" style={containerStyle}>
      {label && (
        <label className="ds-label" htmlFor={id}>
          {label}
          {required && <span className="ds-label-required">*</span>}
        </label>
      )}
      <input id={id} type="text" className="ds-input" style={style} {...props} />
      {hint && <span className="ds-hint">{hint}</span>}
    </div>
  );
}

export function TextArea({ label, hint, required, rows = 3, style, containerStyle, ...props }) {
  const id = useId();
  return (
    <div className="ds-field" style={containerStyle}>
      {label && (
        <label className="ds-label" htmlFor={id}>
          {label}
          {required && <span className="ds-label-required">*</span>}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        className="ds-input"
        style={{ resize: 'vertical', lineHeight: 1.55, ...style }}
        {...props}
      />
      {hint && <span className="ds-hint">{hint}</span>}
    </div>
  );
}

/* ────────────────────────────────────────────
   SELECT — glassmorphic dropdown with checkmark,
   keyboard navigation and click-outside close.
   options: [{ value, label, description? }]
   ──────────────────────────────────────────── */
function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
}

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const ChevronIcon = () => (
  <svg className="ds-dropdown-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export function Select({ label, hint, options, value, onChange, placeholder = 'Select…', triggerStyle, containerStyle, compact = false }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const rootRef = useRef(null);
  const id = useId();
  useClickOutside(rootRef, useCallback(() => setOpen(false), []));

  const selected = options.find((o) => o.value === value);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open && highlighted >= 0) {
        onChange(options[highlighted].value);
        setOpen(false);
      } else {
        setOpen((o) => !o);
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      setHighlighted((h) => {
        const next = h + dir;
        if (next < 0) return options.length - 1;
        if (next >= options.length) return 0;
        return next;
      });
    }
  };

  return (
    <div className="ds-field" style={containerStyle} ref={rootRef}>
      {label && <label className="ds-label" htmlFor={id}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <button
          id={id}
          type="button"
          className="ds-dropdown-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={handleKeyDown}
          style={compact ? { padding: '7px 12px', fontSize: 13, width: 'auto', minWidth: 150, ...triggerStyle } : triggerStyle}
        >
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronIcon />
        </button>

        <AnimatePresence>
          {open && (
            <motion.ul
              role="listbox"
              aria-labelledby={id}
              className="ds-dropdown-panel"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ listStyle: 'none' }}
            >
              {options.map((opt, i) => {
                const isSelected = opt.value === value;
                return (
                  <li key={String(opt.value)}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`ds-dropdown-option ${isSelected ? 'is-selected' : ''} ${highlighted === i ? 'is-highlighted' : ''}`}
                      onMouseEnter={() => setHighlighted(i)}
                      onClick={() => { onChange(opt.value); setOpen(false); }}
                    >
                      <span style={{ minWidth: 0 }}>
                        {opt.label}
                        {opt.description && <span className="ds-option-desc">{opt.description}</span>}
                      </span>
                      {isSelected && <CheckIcon />}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
      {hint && <span className="ds-hint">{hint}</span>}
    </div>
  );
}

/* ────────────────────────────────────────────
   MENU — compact action dropdown (secondary
   actions, export options, bulk actions).
   items: [{ label, icon?, onClick, danger? }]
   ──────────────────────────────────────────── */
export function Menu({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  useClickOutside(rootRef, useCallback(() => setOpen(false), []));

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="ds-btn-ghost-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="ds-dropdown-panel"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            style={{ left: align === 'right' ? 'auto' : 0, right: align === 'right' ? 0 : 'auto', minWidth: 190, width: 'max-content' }}
          >
            {items.map((item, i) => (
              <button
                key={i}
                type="button"
                role="menuitem"
                className="ds-dropdown-option"
                style={item.danger ? { color: 'var(--error)' } : undefined}
                onClick={() => { setOpen(false); item.onClick?.(); }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {item.icon}
                  {item.label}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────
   ACCORDION — collapsible section for secondary
   configuration; keeps pages short.
   ──────────────────────────────────────────── */
export function Accordion({ title, subtitle, badge, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className="ds-accordion">
      <button
        type="button"
        className="ds-accordion-header"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {icon && (
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: 'var(--accent-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-light)', flexShrink: 0,
            }}>
              {icon}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {title}
              {badge}
            </div>
            {subtitle && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 220ms ease', transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="ds-accordion-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
