import * as React from "react";

const TOAST_LIMIT = 3;
const TOAST_DEFAULT_DURATION = 5000;

type ToastVariant = "default" | "success" | "error" | "warning";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  duration?: number;
}

type ToastInput = Omit<Toast, "id">;

let toastCount = 0;

function genId() {
  toastCount = (toastCount + 1) % Number.MAX_SAFE_INTEGER;
  return toastCount.toString();
}

// ---------------------------------------------------------------------------
// Global listener pattern so multiple useToast() calls share the same state.
// ---------------------------------------------------------------------------

type Listener = (toasts: Toast[]) => void;

let memoryState: Toast[] = [];
const listeners: Listener[] = [];

function dispatch(toasts: Toast[]) {
  memoryState = toasts;
  listeners.forEach((l) => l(memoryState));
}

// Auto-dismiss timers keyed by toast id.
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleRemoval(id: string, duration: number) {
  if (timers.has(id)) clearTimeout(timers.get(id)!);
  timers.set(
    id,
    setTimeout(() => {
      dismiss(id);
      timers.delete(id);
    }, duration)
  );
}

function toast(input: ToastInput): string {
  const id = genId();
  const duration = input.duration ?? TOAST_DEFAULT_DURATION;
  const newToast: Toast = { ...input, id, duration };

  // Keep only the latest TOAST_LIMIT entries (most recent at the end).
  dispatch([...memoryState, newToast].slice(-TOAST_LIMIT));

  scheduleRemoval(id, duration);
  return id;
}

function dismiss(id: string) {
  if (timers.has(id)) {
    clearTimeout(timers.get(id)!);
    timers.delete(id);
  }
  dispatch(memoryState.filter((t) => t.id !== id));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function useToast() {
  const [toasts, setToasts] = React.useState<Toast[]>(memoryState);

  React.useEffect(() => {
    listeners.push(setToasts);
    return () => {
      const idx = listeners.indexOf(setToasts);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return { toasts, toast, dismiss } as const;
}

export { useToast, toast, dismiss };
export type { Toast, ToastInput, ToastVariant, ToastAction };
