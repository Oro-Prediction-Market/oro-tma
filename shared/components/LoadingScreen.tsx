import React from "react";

interface LoadingScreenProps {
  message?: string;
  fullPage?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = "Consulting the Oracles...",
  fullPage = true,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: fullPage ? "80vh" : "100%",
        minHeight: fullPage ? "400px" : "200px",
        background: "transparent",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes orbPulse {
          0%, 100% { transform: scale(1); opacity: 0.8; filter: blur(8px) brightness(1.2); }
          50% { transform: scale(1.1); opacity: 1; filter: blur(12px) brightness(1.5); }
        }
        @keyframes ringRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes textGlow {
          0%, 100% { opacity: 0.7; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
        }
        @keyframes meshMove {
          0% { background-position: 0% 0%; }
          50% { background-position: 100% 100%; }
          100% { background-position: 0% 0%; }
        }
      `}</style>

      {/* Sophisticated Animation Container */}
      <div
        style={{
          position: "relative",
          width: 120,
          height: 120,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 32,
        }}
      >
        {/* The Core Orb */}
        <div
          style={{
            position: "absolute",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--color-primary, #7c3aed), var(--color-info, #3b82f6))",
            boxShadow: "0 0 30px var(--color-primary, #7c3aed)",
            animation: "orbPulse 3s ease-in-out infinite",
            zIndex: 2,
          }}
        />

        {/* Outer Ring 1 */}
        <div
          style={{
            position: "absolute",
            width: 100,
            height: 100,
            borderRadius: "50%",
            border: "1px solid rgba(124, 58, 237, 0.2)",
            borderTop: "2px solid var(--color-primary, #7c3aed)",
            animation: "ringRotate 4s linear infinite",
            zIndex: 1,
          }}
        />

        {/* Outer Ring 2 */}
        <div
          style={{
            position: "absolute",
            width: 80,
            height: 80,
            borderRadius: "50%",
            border: "1px solid rgba(59, 130, 246, 0.1)",
            borderRight: "2px solid var(--color-info, #3b82f6)",
            animation: "ringRotate 6s linear infinite reverse",
            zIndex: 1,
          }}
        />

        {/* Subtle Ambient Glow */}
        <div
          style={{
            position: "absolute",
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124, 58, 237, 0.1) 0%, transparent 70%)",
            zIndex: 0,
          }}
        />
      </div>

      {/* Loading Text */}
      <div
        style={{
          textAlign: "center",
          animation: "textGlow 2.5s ease-in-out infinite",
        }}
      >
        <div
          style={{
            fontSize: "1.1rem",
            fontWeight: 800,
            color: "var(--text-main, #ffffff)",
            letterSpacing: "-0.02em",
            fontFamily: "var(--font-display, inherit)",
            marginBottom: 8,
          }}
        >
          {message}
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--text-muted, rgba(255,255,255,0.6))",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Predicting the Future
        </div>
      </div>
    </div>
  );
};
