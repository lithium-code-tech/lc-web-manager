"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, disabled, className, children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-brand text-white hover:bg-brand-dark",
        variant === "secondary" && "border border-line bg-surface-2 text-ink hover:border-muted",
        variant === "danger" && "bg-danger-soft text-danger hover:bg-danger hover:text-white",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        small ? "size-4" : "size-6 text-brand",
      )}
    />
  );
}

export function PageLoading() {
  return (
    <div className="flex justify-center py-20" role="status" aria-label="Carregando">
      <Spinner />
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-xl border border-line bg-surface p-5", className)}>{children}</section>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

const TONES = {
  neutral: "bg-surface-2 text-muted",
  brand: "bg-brand-soft text-brand",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", TONES[tone])}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink placeholder:text-muted/60 focus:border-brand focus:outline-none disabled:opacity-60";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputClass, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputClass, "h-auto min-h-20 py-2", props.className)} />;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{message}</p>;
}

/** Caixa de diálogo nativa (<dialog>) com fundo escuro e Esc para fechar. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/70"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
        {footer && <div className="flex flex-wrap justify-end gap-2 pt-1">{footer}</div>}
      </div>
    </dialog>
  );
}

type ToastItem = { id: number; message: string; tone: "ok" | "danger" };
const ToastContext = createContext<(message: string, tone?: ToastItem["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((message: string, tone: ToastItem["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={cx(
              "max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg",
              item.tone === "ok" ? "border-ok/40 bg-surface text-ink" : "border-danger/40 bg-surface text-danger",
            )}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatDate(isoDate: string): string {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
