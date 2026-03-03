import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastAction,
} from "@/components/ui/toast";
import { useToast } from "@/hooks/useToast";

function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, variant, action, duration }) => (
        <Toast
          key={id}
          variant={variant}
          progressDuration={duration}
        >
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && (
              <ToastDescription>{description}</ToastDescription>
            )}
          </div>
          {action && (
            <ToastAction altText={action.label} onClick={action.onClick}>
              {action.label}
            </ToastAction>
          )}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

export { Toaster };
