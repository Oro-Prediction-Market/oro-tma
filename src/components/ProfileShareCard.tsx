import { FC, useRef, useEffect, useState } from "react";
import { Share2, Download } from "lucide-react";
import { avatarUrl } from "@shared/api/client";

interface ProfileShareCardProps {
  userName: string;
  avatarInitial?: string | null;
  userPhotoUrl?: string | null;
  /** User id — used to load the avatar via the CORS-friendly proxy so the
   *  canvas can draw a Telegram photo and still export as PNG. */
  userId?: string;
  reputationTier: string;
  reputationScore: number;
  totalPredictions: number;
  correctPredictions: number;
  referralId?: string;
}

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME as string;
const CARD_W = 640;
const CARD_H = 400;
// Render at 2x so the exported PNG is crisp on retina screens and when re-shared.
const SCALE = 2;

function tierLabel(tier: string): string {
  if (tier === "legend") return "Legend";
  if (tier === "hot_hand") return "Hot Hand";
  if (tier === "sharpshooter") return "Sharpshooter";
  return "Rookie";
}

// Primary + secondary accent per tier — the secondary gives gradients depth.
function tierColor(tier: string): string {
  if (tier === "legend") return "#f5a623";
  if (tier === "hot_hand") return "#10b981";
  if (tier === "sharpshooter") return "#3b82f6";
  return "#818cf8"; // rookie — a cool indigo instead of flat grey
}
function tierColor2(tier: string): string {
  if (tier === "legend") return "#fcd34d";
  if (tier === "hot_hand") return "#34d399";
  if (tier === "sharpshooter") return "#60a5fa";
  return "#c4b5fd";
}

async function renderProfileCard(
  canvas: HTMLCanvasElement,
  opts: ProfileShareCardProps,
): Promise<void> {
  const ctx = canvas.getContext("2d")!;
  canvas.width = CARD_W * SCALE;
  canvas.height = CARD_H * SCALE;
  ctx.scale(SCALE, SCALE);

  const tier = opts.reputationTier;
  const accent = tierColor(tier);
  const accent2 = tierColor2(tier);
  const label = tierLabel(tier);
  const acc =
    opts.totalPredictions > 0
      ? Math.round((opts.correctPredictions / opts.totalPredictions) * 100)
      : 0;

  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };

  // ── Base background ─────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, "#111a2e");
  bg.addColorStop(0.52, "#0b1221");
  bg.addColorStop(1, "#080d17");
  rr(0, 0, CARD_W, CARD_H, 24);
  ctx.fillStyle = bg;
  ctx.fill();

  // Clip everything decorative to the rounded card.
  ctx.save();
  rr(0, 0, CARD_W, CARD_H, 24);
  ctx.clip();

  // Soft tier lighting stays behind the content instead of competing with it.
  const glow1 = ctx.createRadialGradient(CARD_W - 28, 42, 8, CARD_W - 28, 42, 320);
  glow1.addColorStop(0, `${accent}36`);
  glow1.addColorStop(1, "transparent");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const glow2 = ctx.createRadialGradient(10, CARD_H, 10, 10, CARD_H, 300);
  glow2.addColorStop(0, `${accent2}20`);
  glow2.addColorStop(1, "transparent");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // A restrained grid gives the share card texture without making the logo busy.
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  for (let x = 0; x < CARD_W; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_H);
    ctx.stroke();
  }
  for (let y = 0; y < CARD_H; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_W, y);
    ctx.stroke();
  }

  // Top accent hairline.
  const topbar = ctx.createLinearGradient(0, 0, CARD_W, 0);
  topbar.addColorStop(0, "transparent");
  topbar.addColorStop(0.5, accent);
  topbar.addColorStop(1, "transparent");
  ctx.fillStyle = topbar;
  ctx.fillRect(0, 0, CARD_W, 3);

  // ── Brand ───────────────────────────────────────────────────────────────────
  // The real wordmark is wide. Keeping its original aspect ratio prevents the
  // compressed, cluttered logo treatment that a square draw produced.
  ctx.textAlign = "left";
  try {
    const logoImg = new Image();
    await new Promise<void>((res, rej) => {
      logoImg.onload = () => res();
      logoImg.onerror = () => rej();
      logoImg.src = "/logo.svg";
    });
    ctx.drawImage(logoImg, 32, 24, 82, 28);
  } catch {
    ctx.font = "800 18px system-ui, sans-serif";
    ctx.fillStyle = "#f8fbff";
    ctx.fillText("ORO", 32, 43);
  }

  // Keep the app mark in a dedicated header so it never competes with the avatar.
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(32, 72, CARD_W - 64, 1);

  // ── Tier badge (top-right) — glowing pill ───────────────────────────────────
  const badgeText = label.toUpperCase();
  ctx.font = "bold 12px system-ui, sans-serif";
  const bW = ctx.measureText(badgeText).width + 26;
  const bH = 28;
  const bX = CARD_W - 32 - bW;
  const bY = 22;
  ctx.save();
  ctx.shadowColor = `${accent}88`;
  ctx.shadowBlur = 14;
  rr(bX, bY, bW, bH, 9);
  const badgeGrad = ctx.createLinearGradient(bX, bY, bX, bY + bH);
  badgeGrad.addColorStop(0, `${accent}30`);
  badgeGrad.addColorStop(1, `${accent}14`);
  ctx.fillStyle = badgeGrad;
  ctx.fill();
  ctx.restore();
  rr(bX, bY, bW, bH, 9);
  ctx.strokeStyle = `${accent}88`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = accent2;
  ctx.fillText(badgeText, bX + bW / 2, bY + 18);

  // ── Avatar with glowing tier ring ───────────────────────────────────────────
  const avatarR = 32;
  const avatarInnerR = avatarR - 3.5;
  const avatarCX = 32 + avatarR;
  const avatarCY = 94 + avatarR;

  let avatarDrawn = false;
  // Prefer the CORS-friendly avatar proxy (keeps the canvas exportable); fall
  // back to a raw photoUrl. A ".svg" is Telegram's placeholder and isn't
  // drawable, so skip straight to the initial.
  const photoSrc = opts.userId
    ? avatarUrl(opts.userId)
    : opts.userPhotoUrl || null;
  if (photoSrc && !/\.svg(\?|$)/i.test(photoSrc)) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej();
        img.src = photoSrc;
      });
      // Clip + draw synchronously (no await between save and restore) so the
      // round mask can't be corrupted by a concurrent re-render. Center-crop
      // to a square ("cover") so non-square photos fill the frame cleanly.
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCX, avatarCY, avatarInnerR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(
        img,
        sx,
        sy,
        side,
        side,
        avatarCX - avatarInnerR,
        avatarCY - avatarInnerR,
        avatarInnerR * 2,
        avatarInnerR * 2,
      );
      ctx.restore();
      avatarDrawn = true;
    } catch {}
  }
  if (!avatarDrawn) {
    const initial = (
      opts.avatarInitial?.trim() || opts.userName.replace(/^@+/, "").trim() || "?"
    )[0].toUpperCase();
    const ag = ctx.createLinearGradient(
      avatarCX - avatarR,
      avatarCY - avatarR,
      avatarCX + avatarR,
      avatarCY + avatarR,
    );
    ag.addColorStop(0, "#85dd77");
    ag.addColorStop(1, "#49b967");
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarInnerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "800 30px system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(initial, avatarCX, avatarCY + 11);
  }

  // Ring in tier gradient
  const ring = ctx.createLinearGradient(
    avatarCX - avatarR,
    avatarCY - avatarR,
    avatarCX + avatarR,
    avatarCY + avatarR,
  );
  ring.addColorStop(0, accent2);
  ring.addColorStop(1, accent);
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // ── Name + underline + tagline ──────────────────────────────────────────────
  const textX = avatarCX + avatarR + 20;
  ctx.textAlign = "left";
  ctx.font = "800 25px system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(opts.userName, textX, avatarCY - 6);

  // Accent underline bar
  rr(textX, avatarCY + 4, 46, 3, 2);
  const ul = ctx.createLinearGradient(textX, 0, textX + 46, 0);
  ul.addColorStop(0, accent);
  ul.addColorStop(1, `${accent}00`);
  ctx.fillStyle = ul;
  ctx.fill();

  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText(`I'm a ${label} on Oro. Beat me.`, textX, avatarCY + 28);

  // ── Stat cards ──────────────────────────────────────────────────────────────
  const stats = [
    {
      label: "Win Rate",
      value: `${acc}%`,
      color: acc >= 60 ? "#4ade80" : acc >= 40 ? "#fbbf24" : "#f87171",
    },
    { label: "Predictions", value: String(opts.totalPredictions), color: "#93c5fd" },
    { label: "Correct", value: String(opts.correctPredictions), color: "#6ee7b7" },
  ];

  const statY = 220;
  const statH = 82;
  const gap = 12;
  const statW = (CARD_W - 64 - gap * 2) / 3;
  stats.forEach((s, i) => {
    const sx = 32 + i * (statW + gap);
    // Card fill
    rr(sx, statY, statW, statH, 13);
    const cardGrad = ctx.createLinearGradient(sx, statY, sx, statY + statH);
    cardGrad.addColorStop(0, "rgba(255,255,255,0.07)");
    cardGrad.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Accent top edge
    rr(sx + 14, statY, statW - 28, 2.5, 2);
    ctx.fillStyle = `${s.color}cc`;
    ctx.fill();
    // Value (with glow)
    ctx.save();
    ctx.font = "800 30px system-ui, sans-serif";
    ctx.fillStyle = s.color;
    ctx.textAlign = "center";
    ctx.shadowColor = `${s.color}99`;
    ctx.shadowBlur = 14;
    ctx.fillText(s.value, sx + statW / 2, statY + 43);
    ctx.restore();
    // Label
    ctx.font = "700 10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.textAlign = "center";
    const lbl = s.label.toUpperCase();
    ctx.save();
    // letter-spacing emulation
    const ls = 1.5;
    const total = ctx.measureText(lbl).width + ls * (lbl.length - 1);
    let lx = sx + statW / 2 - total / 2;
    ctx.textAlign = "left";
    for (const ch of lbl) {
      ctx.fillText(ch, lx, statY + 66);
      lx += ctx.measureText(ch).width + ls;
    }
    ctx.restore();
  });

  // ── Footer ──────────────────────────────────────────────────────────────────
  const divY = CARD_H - 54;
  const div = ctx.createLinearGradient(32, 0, CARD_W - 32, 0);
  div.addColorStop(0, `${accent}55`);
  div.addColorStop(1, "rgba(255,255,255,0.04)");
  ctx.fillStyle = div;
  ctx.fillRect(32, divY, CARD_W - 64, 1);

  const refUrl = opts.referralId
    ? `https://t.me/${BOT_USERNAME}?startapp=ref_${opts.referralId}`
    : `https://t.me/${BOT_USERNAME}`;
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.textAlign = "left";
  ctx.fillText(refUrl, 32, CARD_H - 27);
  ctx.textAlign = "right";
  ctx.fillStyle = `${accent}aa`;
  ctx.fillText("ORO PREDICT", CARD_W - 32, CARD_H - 27);

  ctx.restore(); // end card clip

  // ── Border on top ───────────────────────────────────────────────────────────
  rr(0.75, 0.75, CARD_W - 1.5, CARD_H - 1.5, 24);
  ctx.strokeStyle = `${accent}3a`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export const ProfileShareCard: FC<ProfileShareCardProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const accent = tierColor(props.reputationTier);
  const accent2 = tierColor2(props.reputationTier);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRendering(true);
    renderProfileCard(canvas, props)
      .then(() => {
        canvas.toBlob((blob) => {
          if (blob) setBlobUrl(URL.createObjectURL(blob));
        }, "image/png");
      })
      .finally(() => setRendering(false));
  }, [
    props.avatarInitial,
    props.correctPredictions,
    props.reputationTier,
    props.totalPredictions,
    props.userName,
    props.userPhotoUrl,
    props.userId,
  ]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "oro-profile.png";
    a.click();
  };

  const handleShare = async () => {
    if (!blobUrl) return;
    const tier = tierLabel(props.reputationTier);
    const shareText = `I'm a ${tier} on Oro Predict. Can you beat my record?\n\nhttps://t.me/${BOT_USERNAME}${props.referralId ? `?startapp=ref_${props.referralId}` : ""}`;
    try {
      const blob = await fetch(blobUrl).then((r) => r.blob());
      const file = new File([blob], "oro-profile.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
        return;
      }
    } catch {}
    // Fallback: open Telegram share
    const encoded = encodeURIComponent(shareText);
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${BOT_USERNAME}`)}&text=${encoded}`;
    window.open(tgUrl, "_blank");
  };

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Canvas preview — scaled to fit */}
      <div
        style={{
          width: "100%",
          borderRadius: 16,
          overflow: "hidden",
          background: "#0a0d15",
          position: "relative",
          boxShadow: `0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px ${accent}22`,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "auto", display: "block" }}
        />
        {rendering && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.15)",
                borderTopColor: "#fff",
                animation: "spin 0.8s linear infinite",
              }}
            />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleShare}
          disabled={rendering || !blobUrl}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 0",
            borderRadius: 12,
            background: `linear-gradient(135deg, ${accent}, ${accent2})`,
            border: "none",
            color: "#0b0f17",
            fontSize: 14,
            fontWeight: 800,
            cursor: rendering ? "default" : "pointer",
            opacity: rendering ? 0.6 : 1,
            boxShadow: `0 6px 20px ${accent}55`,
          }}
        >
          <Share2 size={16} />
          Share Card
        </button>
        <button
          onClick={handleDownload}
          disabled={rendering || !blobUrl}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            border: "1.5px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)",
            cursor: rendering ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            opacity: rendering ? 0.5 : 1,
          }}
        >
          <Download size={18} />
        </button>
      </div>
    </div>
  );
};
