"use client";

import { useReducedMotion } from "framer-motion";
import * as React from "react";

import { cn } from "../../lib/utils";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
}

export interface ParticleBackgroundPalette {
  particle: string;
  link: string;
}

export interface ParticleBackgroundProps extends React.ComponentProps<"div"> {
  enabled?: boolean;
  interactive?: boolean;
  particleCount?: number;
  particleDensity?: number;
  maxLinkDistance?: number;
  attractRadius?: number;
  attractStrength?: number;
  velocity?: number;
  showGradient?: boolean;
  palette: ParticleBackgroundPalette;
}

const DEFAULT_PARTICLE_COUNT = 320;
const DEFAULT_PARTICLE_DENSITY = 2800;
const DEFAULT_LINK_DISTANCE = 90;
const DEFAULT_ATTRACT_STRENGTH = 0.012;
const DEFAULT_ATTRACT_RADIUS = 180;
const DEFAULT_VELOCITY = 0.18;

const DEFAULT_PALETTE = {
  particle: "15,23,42",
  link: "15,23,42",
};

function useResolvedTheme() {
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const resolve = () => setResolvedTheme(media.matches ? "dark" : "light");

    resolve();
    media.addEventListener("change", resolve);

    return () => {
      media.removeEventListener("change", resolve);
    };
  }, []);

  return resolvedTheme;
}

export function ParticleBackground({
  className,
  enabled = true,
  interactive = true,
  particleCount,
  particleDensity = DEFAULT_PARTICLE_DENSITY,
  maxLinkDistance = DEFAULT_LINK_DISTANCE,
  attractRadius = DEFAULT_ATTRACT_RADIUS,
  attractStrength = DEFAULT_ATTRACT_STRENGTH,
  velocity = DEFAULT_VELOCITY,
  showGradient: _showGradient = true,
  palette = DEFAULT_PALETTE,
  ...props
}: ParticleBackgroundProps) {
  const prefersReduced = useReducedMotion();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const mouse = React.useRef({ x: -9999, y: -9999 });
  const particles = React.useRef<Particle[]>([]);
  const raf = React.useRef<number>(0);
  const resolvedTheme = useResolvedTheme();

  React.useEffect(() => {
    if (prefersReduced || !enabled) return;

    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const canvas = canvasEl;
    const context = ctx;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const targetCount =
        particleCount ??
        Math.max(
          80,
          Math.min(
            DEFAULT_PARTICLE_COUNT,
            Math.round((rect.width * rect.height) / particleDensity),
          ),
        );

      particles.current = Array.from({ length: targetCount }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        vx: (Math.random() - 0.5) * velocity,
        vy: (Math.random() - 0.5) * velocity,
        opacity: Math.random() * (resolvedTheme === "dark" ? 0.045 : 0.035) + 0.02,
      }));
    }

    function draw() {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      context.clearRect(0, 0, width, height);

      const ps = particles.current;

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];

        const mdx = mouse.current.x - p.x;
        const mdy = mouse.current.y - p.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

        if (interactive && mdist < attractRadius) {
          const force = (1 - mdist / attractRadius) * attractStrength;
          p.vx += mdx * force;
          p.vy += mdy * force;
        }

        p.vx *= 0.98;
        p.vy *= 0.98;

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        context.beginPath();
        context.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        context.fillStyle = `rgba(${palette.particle},${p.opacity})`;
        context.fill();

        for (let j = i + 1; j < ps.length; j++) {
          const q = ps[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxLinkDistance) {
            const alpha = (1 - dist / maxLinkDistance) * (resolvedTheme === "dark" ? 0.04 : 0.03);
            context.beginPath();
            context.moveTo(p.x, p.y);
            context.lineTo(q.x, q.y);
            context.strokeStyle = `rgba(${palette.link},${alpha})`;
            context.lineWidth = 0.5;
            context.stroke();
          }
        }
      }

      raf.current = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    draw();

    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onMouseLeave = () => {
      mouse.current = { x: -9999, y: -9999 };
    };

    if (interactive) {
      canvas.addEventListener("mousemove", onMouseMove);
      canvas.addEventListener("mouseleave", onMouseLeave);
      document.addEventListener("mousemove", onMouseMove);
    }

    return () => {
      cancelAnimationFrame(raf.current);
      ro.disconnect();
      document.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [
    attractRadius,
    attractStrength,
    enabled,
    interactive,
    maxLinkDistance,
    palette,
    particleCount,
    particleDensity,
    prefersReduced,
    resolvedTheme,
    velocity,
  ]);

  if (!enabled || prefersReduced) return null;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
      {...props}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
