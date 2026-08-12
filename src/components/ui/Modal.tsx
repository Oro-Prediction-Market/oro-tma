import React, { useEffect } from "react"
import { createPortal } from "react-dom"

export type BottomSheetTheme = "default" | "epl" | "ucl" | "ufc" | "esports" | "btc" | "ter"

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Extra padding at the bottom for nav bars. Defaults to 80px (TMA nav height). */
  bottomPad?: number
  /** Max height as a vh value. Defaults to 88. */
  maxHeightVh?: number
  children: React.ReactNode
  theme?: BottomSheetTheme
}

/**
 * BottomSheet — slides up from the bottom, dismisses on backdrop tap.
 * Handles safe-area-inset-bottom automatically.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  title,
  bottomPad = 80,
  maxHeightVh = 88,
  children,
  theme = "default",
}) => {
  const [rendered, setRendered] = React.useState(open)
  const [closing, setClosing] = React.useState(false)

  // Keep the portal mounted briefly after `open` turns false so dismissals
  // mirror the entrance instead of disappearing abruptly.
  useEffect(() => {
    if (open) {
      setRendered(true)
      setClosing(false)
      return
    }
    if (!rendered) return
    setClosing(true)
    const timer = window.setTimeout(() => {
      setRendered(false)
      setClosing(false)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [open, rendered])

  // Prevent body scroll while open
  useEffect(() => {
    if (rendered) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [rendered])

  if (!rendered) return null

  const surfaces: Record<BottomSheetTheme, React.CSSProperties> = {
    default: { background: "var(--bg-card)" },
    epl: { background: "radial-gradient(circle at 100% 0%, rgba(0,255,133,0.17), transparent 42%), linear-gradient(145deg, #210025 0%, #0a0410 72%)", border: "1px solid rgba(0,255,133,0.24)", borderBottom: "none", boxShadow: "inset 0 3px 0 #e90052, 0 -18px 48px rgba(0,0,0,0.36)" },
    ucl: { background: "radial-gradient(circle at 88% 0%, rgba(43,107,255,0.30), transparent 42%), linear-gradient(145deg, #0c1746 0%, #070d29 70%)", border: "1px solid rgba(43,107,255,0.35)", borderBottom: "none", boxShadow: "inset 0 2px 0 rgba(232,199,102,0.7), 0 -18px 48px rgba(0,0,0,0.36)" },
    ufc: { background: "linear-gradient(110deg, rgba(210,10,10,0.17), #0d0b0c 42%, #0d0b0c 58%, rgba(37,99,235,0.17))", border: "1px solid rgba(255,255,255,0.15)", borderBottom: "none", boxShadow: "inset 3px 0 #d20a0a, inset -3px 0 #2563eb, 0 -18px 48px rgba(0,0,0,0.42)" },
    esports: { background: "radial-gradient(circle at 50% 0%, rgba(242,197,117,0.15), transparent 45%), linear-gradient(180deg, #16150f, #0f0e0b)", border: "1px solid rgba(190,158,89,0.45)", borderBottom: "none", boxShadow: "0 -18px 48px rgba(0,0,0,0.42)" },
    btc: { background: "radial-gradient(circle at 82% 0%, rgba(247,147,26,0.19), transparent 45%), linear-gradient(145deg, #14141f, #0c0c14 72%)", border: "1px solid rgba(247,147,26,0.28)", borderBottom: "none", boxShadow: "inset 0 2px 0 #f7931a, 0 -18px 48px rgba(0,0,0,0.42)" },
    ter: { background: "radial-gradient(circle at 82% 0%, rgba(244,175,57,0.18), transparent 45%), linear-gradient(145deg, #1a150b, #0e0b06 72%)", border: "1px solid rgba(244,175,57,0.28)", borderBottom: "none", boxShadow: "inset 0 2px 0 #F4AF39, 0 -18px 48px rgba(0,0,0,0.42)" },
  }
  const headerColor: Record<BottomSheetTheme, string> = { default: "var(--text-main)", epl: "#00ff85", ucl: "#e8c766", ufc: "#fff", esports: "#f2c575", btc: "#f7931a", ter: "#F4AF39" }
  const handleColor: Record<BottomSheetTheme, string> = { default: "var(--border)", epl: "#00ff85", ucl: "#2b6bff", ufc: "#fff", esports: "#be9e59", btc: "#f7931a", ter: "#F4AF39" }

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...surfaces[theme],
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          maxHeight: `${maxHeightVh}vh`,
          overflowY: "auto",
          paddingBottom: `calc(env(safe-area-inset-bottom) + ${bottomPad}px)`,
          animation: `${closing ? "sheetSlideDown" : "sheetSlideUp"} 0.25s cubic-bezier(0.32,0.72,0,1) forwards`,
        }}
      >
        <style>{`
          @keyframes sheetSlideUp {
            from { transform: translateY(100%) }
            to   { transform: translateY(0) }
          }
          @keyframes sheetSlideDown {
            from { transform: translateY(0) }
            to   { transform: translateY(100%) }
          }
        `}</style>

        {/* Drag handle */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "transparent",
            zIndex: 1,
            padding: "12px 20px 0",
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: "var(--radius-full)",
              background: handleColor[theme],
              margin: "0 auto 12px",
            }}
          />
          {title && (
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: headerColor[theme],
                letterSpacing: theme === "esports" ? "0.08em" : undefined,
                textTransform: theme === "esports" ? "uppercase" : undefined,
                fontFamily: theme === "esports" ? '"Quantico", system-ui, sans-serif' : undefined,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              {title}
            </div>
          )}
        </div>

        <div style={{ padding: "0 20px" }}>{children}</div>
      </div>
    </div>
  , document.body)
}

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

/**
 * Dialog — centered overlay modal for confirmations and alerts.
 */
export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  children,
}) => {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  if (!open) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 20px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          padding: "24px 20px",
          width: "100%",
          maxWidth: 400,
          boxShadow: "var(--shadow-premium)",
          animation: "dialogPop 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <style>{`
          @keyframes dialogPop {
            from { opacity: 0; transform: scale(0.92) }
            to   { opacity: 1; transform: scale(1) }
          }
        `}</style>
        {title && (
          <div
            style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "var(--text-main)",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
