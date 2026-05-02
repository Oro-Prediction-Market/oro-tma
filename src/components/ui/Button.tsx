import React from "react"

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
type ButtonSize = "sm" | "md" | "lg"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  icon?: React.ReactNode
}

const base: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "none",
  borderRadius: "var(--radius-md)",
  fontFamily: "var(--font-primary)",
  fontWeight: 700,
  cursor: "pointer",
  transition: "opacity 0.15s ease, transform 0.1s ease",
  WebkitTapHighlightColor: "transparent",
  flexShrink: 0,
}

const variants: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--grad-primary)",
    color: "#fff",
    boxShadow: "0 8px 20px -6px rgba(39,117,208,0.45)",
  },
  secondary: {
    background: "var(--bg-card)",
    color: "var(--text-main)",
    border: "1.5px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
  },
  ghost: {
    background: "none",
    color: "var(--text-muted)",
    border: "none",
    boxShadow: "none",
    padding: 0,
  },
  danger: {
    background: "var(--color-danger)",
    color: "#fff",
    boxShadow: "0 8px 20px -6px rgba(239,68,68,0.4)",
  },
}

const sizes: Record<ButtonSize, React.CSSProperties> = {
  sm: { fontSize: "0.8rem", padding: "8px 14px", gap: 6 },
  md: { fontSize: "0.9rem", padding: "12px 20px" },
  lg: { fontSize: "1rem", padding: "15px 24px" },
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  icon,
  children,
  disabled,
  style,
  ...rest
}) => {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      style={{
        ...base,
        ...variants[variant],
        ...sizes[size],
        ...(variant === "ghost" ? {} : {}),
        width: fullWidth ? "100%" : undefined,
        opacity: isDisabled ? 0.5 : 1,
        cursor: isDisabled ? "not-allowed" : "pointer",
        ...style,
      }}
      {...rest}
    >
      {loading ? <Spinner size={size} /> : icon}
      {children}
    </button>
  )
}

const spinnerSize: Record<ButtonSize, number> = { sm: 12, md: 14, lg: 16 }

const Spinner: React.FC<{ size: ButtonSize }> = ({ size }) => (
  <svg
    width={spinnerSize[size]}
    height={spinnerSize[size]}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    style={{ animation: "oro-spin 0.75s linear infinite", flexShrink: 0 }}
  >
    <style>{`@keyframes oro-spin { to { transform: rotate(360deg) } }`}</style>
    <path d="M12 2a10 10 0 0 1 0 20A10 10 0 0 1 12 2" opacity={0.2} />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
)
