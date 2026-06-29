// Portable, themeable multi-step wizard popup with direction-aware slide
// transitions and an animated success screen. No project-specific imports —
// pass colors/labels/direction via props. Requires `motion` (motion/react).
//
// The animation is the point: each step slides horizontally based on travel
// direction (forward vs back), driven by AnimatePresence `custom={dir}` and a
// snappy spring. Tune the knobs marked TUNE below.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

export interface WizardTheme {
  paper: string;    // popup surface background
  ink: string;      // primary text
  muted: string;    // secondary text / inactive
  rule: string;     // borders + inactive progress dots
  soft: string;     // subtle button / close-button background
  accent: string;   // primary action, active progress, success check
  onAccent: string; // text/icon color on top of `accent`
}

export interface WizardLabels {
  next: string;
  back: string;
  complete: string;
  submitting: string;
  done: string;
  close: string;
  stepCounter: (current: number, total: number) => string;
}

const DEFAULT_LABELS: WizardLabels = {
  next: "Continue",
  back: "Back",
  complete: "Confirm",
  submitting: "Saving…",
  done: "Done",
  close: "Close",
  stepCounter: (current, total) => `Step ${current} of ${total}`,
};

export interface WizardStep {
  key: string;                 // stable & unique — this is the AnimatePresence key that drives the slide
  title: string;
  hint?: string;
  canAdvance: boolean;         // gate the Continue/Confirm button (per-step validation)
  content: ReactNode;
}

// TUNE — slide distance (px) and the step-change spring.
const SLIDE = 70;
const STEP_SPRING = { type: "spring", stiffness: 420, damping: 36 } as const;
const POP_SPRING = { type: "spring", stiffness: 380, damping: 30 } as const;

function CloseIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function BackIcon({ size = 16, ltr }: { size?: number; ltr: boolean }) {
  // Chevron points toward the "back" direction: right in RTL, left in LTR.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: ltr ? "scaleX(-1)" : "none" }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function SuccessCheck({ color }: { color: string }) {
  return (
    <motion.svg width={86} height={86} viewBox="0 0 52 52" style={{ display: "block", margin: "0 auto" }}>
      <motion.circle
        cx={26} cy={26} r={24} fill="none" stroke={color} strokeWidth={2.5}
        initial={{ pathLength: 0, opacity: 0.3 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: "easeInOut" }}
      />
      <motion.path
        d="M15 27 l8 8 l14 -16" fill="none" stroke={color} strokeWidth={3.5}
        strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.42 }}
      />
    </motion.svg>
  );
}

/**
 * A small centered popup that walks the user through one small step at a time.
 *
 * Flow: the last step's primary button calls `onComplete` (do any async work
 * there, keeping `submitting` true). When it resolves, flip `done` to true and a
 * success screen slides in. The popup does NOT auto-close — the user taps Done,
 * which calls `onClose`. Reset your `done`/form state on close.
 */
export function StepWizard({
  open,
  onClose,
  steps,
  onComplete,
  done = false,
  submitting = false,
  theme,
  dir = "rtl",
  fontFamily = "inherit",
  labels,
  successMessage = "Done!",
  successHint,
  width = 370,
}: {
  open: boolean;
  onClose: () => void;
  steps: WizardStep[];
  onComplete: () => void;
  done?: boolean;
  submitting?: boolean;
  theme: WizardTheme;
  dir?: "rtl" | "ltr";
  fontFamily?: string;
  labels?: Partial<WizardLabels>;
  successMessage?: string;
  successHint?: string;
  width?: number;
}) {
  const c = theme;
  const L = { ...DEFAULT_LABELS, ...labels };
  const ltr = dir === "ltr";

  const [index, setIndex] = useState(0);
  const [travel, setTravel] = useState(1); // +1 forward, -1 back — feeds the slide variants

  // Reset to the first step whenever the popup (re)opens.
  useEffect(() => {
    if (open && !done) { setIndex(0); setTravel(1); }
  }, [open, done]);

  // Forward enters from one side, exits to the other; `ltr` flips the whole axis
  // so RTL and LTR both read as "next comes from ahead, back comes from behind".
  const variants = useMemo(() => {
    const s = ltr ? -1 : 1;
    return {
      enter: (d: number) => ({ x: (d > 0 ? -SLIDE : SLIDE) * s, opacity: 0 }),
      center: { x: 0, opacity: 1 },
      exit: (d: number) => ({ x: (d > 0 ? SLIDE : -SLIDE) * s, opacity: 0 }),
    };
  }, [ltr]);

  const safeIndex = Math.min(index, steps.length - 1);
  const step = steps[safeIndex];
  const isLast = safeIndex === steps.length - 1;
  const isFirst = safeIndex === 0;

  const next = () => {
    if (!step?.canAdvance) return;
    if (isLast) { onComplete(); return; }
    setTravel(1);
    setIndex((i) => i + 1);
  };
  const back = () => {
    if (isFirst) return;
    setTravel(-1);
    setIndex((i) => i - 1);
  };

  return (
    <AnimatePresence>
      {open && step && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => { if (!submitting) onClose(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 60, direction: dir,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
          }}
        >
          <motion.div
            layout
            initial={{ scale: 0.94, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={POP_SPRING}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: `min(${width}px, 100%)`, background: c.paper,
              borderRadius: 22, overflow: "hidden",
              border: `1px solid ${c.rule}`,
              boxShadow: "0 24px 60px rgba(0,0,0,0.32)",
              fontFamily,
            }}
          >
            {/* Header: progress dots + close */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 0" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {steps.map((s, i) => (
                  <div
                    key={s.key}
                    style={{
                      height: 4, borderRadius: 999,
                      width: !done && i === safeIndex ? 22 : 7,
                      background: done || i <= safeIndex ? c.accent : c.rule,
                      transition: "width 0.25s ease, background 0.25s ease",
                    }}
                  />
                ))}
              </div>
              <button
                onClick={() => { if (!submitting) onClose(); }}
                aria-label={L.close}
                style={{
                  background: c.soft, border: "none", borderRadius: 999, width: 30, height: 30,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: c.muted,
                }}
              >
                <CloseIcon size={15} />
              </button>
            </div>

            {/* Step counter (hidden on success) */}
            {!done && (
              <div style={{ padding: "12px 20px 0", fontSize: 10, fontWeight: 700, color: c.muted, letterSpacing: "0.14em" }}>
                {L.stepCounter(safeIndex + 1, steps.length)}
              </div>
            )}

            {/* Sliding content */}
            <div style={{ position: "relative", overflow: "hidden", padding: "4px 20px 0" }}>
              <AnimatePresence mode="popLayout" custom={travel} initial={false}>
                {done ? (
                  <motion.div
                    key="__success__"
                    custom={1}
                    variants={variants}
                    initial="enter" animate="center" exit="exit"
                    transition={STEP_SPRING}
                    style={{ textAlign: "center", padding: "24px 0 12px" }}
                  >
                    <SuccessCheck color={c.accent} />
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                      style={{ fontSize: 18, fontWeight: 800, color: c.ink, marginTop: 12 }}
                    >
                      {successMessage}
                    </motion.div>
                    {successHint && (
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
                        style={{ fontSize: 12, color: c.muted, marginTop: 6 }}
                      >
                        {successHint}
                      </motion.div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key={step.key}
                    custom={travel}
                    variants={variants}
                    initial="enter" animate="center" exit="exit"
                    transition={STEP_SPRING}
                  >
                    <div style={{ fontSize: 19, fontWeight: 800, color: c.ink, marginTop: 8 }}>
                      {step.title}
                    </div>
                    {step.hint && (
                      <div style={{ fontSize: 12, color: c.muted, marginTop: 4, lineHeight: 1.5 }}>
                        {step.hint}
                      </div>
                    )}
                    <div style={{ marginTop: 16, maxHeight: "52vh", overflowY: "auto" }}>
                      {step.content}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {done ? (
              <div style={{ padding: "16px 20px 22px" }}>
                <button
                  onClick={() => onClose()}
                  style={{
                    width: "100%", padding: "13px", borderRadius: 12, border: "none",
                    background: c.soft, color: c.ink, fontSize: 14, fontWeight: 800, cursor: "pointer",
                  }}
                >
                  {L.done}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "16px 20px 20px", marginTop: 8 }}>
                {!isFirst && (
                  <button
                    onClick={back}
                    disabled={submitting}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      background: "transparent", border: `1.5px solid ${c.rule}`, borderRadius: 12,
                      padding: "12px 16px", cursor: submitting ? "not-allowed" : "pointer",
                      fontSize: 13, fontWeight: 700, color: c.ink,
                    }}
                  >
                    <BackIcon size={16} ltr={ltr} /> {L.back}
                  </button>
                )}
                <button
                  onClick={next}
                  disabled={!step.canAdvance || submitting}
                  style={{
                    flex: 1, padding: "13px", borderRadius: 12, border: "none",
                    background: step.canAdvance ? c.accent : c.soft,
                    color: step.canAdvance ? c.onAccent : c.muted,
                    fontSize: 14, fontWeight: 800,
                    cursor: step.canAdvance && !submitting ? "pointer" : "not-allowed",
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? L.submitting : isLast ? L.complete : L.next}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
