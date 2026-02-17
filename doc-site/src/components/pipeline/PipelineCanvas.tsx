import React, { useRef, useEffect, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  size: number;
  life: number;
  maxLife: number;
}

interface PipelineCanvasProps {
  activeStageIndex: number | null;
  stagePositions: number[];
  isRunning: boolean;
}

export const PipelineCanvas: React.FC<PipelineCanvasProps> = ({
  activeStageIndex,
  stagePositions,
  isRunning,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const activeStageRef = useRef(activeStageIndex);
  const stagePositionsRef = useRef(stagePositions);
  const isRunningRef = useRef(isRunning);

  useEffect(() => {
    activeStageRef.current = activeStageIndex;
  }, [activeStageIndex]);

  useEffect(() => {
    stagePositionsRef.current = stagePositions;
  }, [stagePositions]);

  useEffect(() => {
    isRunningRef.current = isRunning;
    if (!isRunning) {
      // Drain particles when stopped
      particlesRef.current = particlesRef.current.slice(0, 20);
    }
  }, [isRunning]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const particles = particlesRef.current;
    const activeIdx = activeStageRef.current;
    const positions = stagePositionsRef.current;

    // Spawn new particles from left edge when running
    if (isRunningRef.current && particles.length < 100) {
      const maxLife = 100 + Math.random() * 80;
      particles.push({
        x: -4,
        y: H / 2 + (Math.random() - 0.5) * H * 0.5,
        vx: 1.5 + Math.random() * 2.5,
        vy: (Math.random() - 0.5) * 0.8,
        opacity: 0.2 + Math.random() * 0.6,
        size: 0.8 + Math.random() * 1.8,
        life: 0,
        maxLife,
      });
    }

    // Target x: cluster at active stage, or full-width flow when idle
    const targetX =
      activeIdx !== null && positions[activeIdx] !== undefined
        ? positions[activeIdx]
        : W + 40;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life++;

      // Gently steer toward target x
      const dx = targetX - p.x;
      if (Math.abs(dx) > 20) {
        p.vx += dx * 0.003;
      }
      // Clamp speed
      p.vx = Math.max(0.3, Math.min(p.vx, 10));
      p.vy *= 0.98;

      p.x += p.vx;
      p.y += p.vy;

      // Fade: life-based + distance from target
      const lifeRatio = p.life / p.maxLife;
      const distFromTarget = Math.abs(p.x - targetX);
      const proximityFade = distFromTarget < 40
        ? 1
        : Math.max(0, 1 - (distFromTarget - 40) / 120);
      const drawOpacity = p.opacity * (1 - lifeRatio * 0.7) * proximityFade;

      // Remove expired or off-screen particles
      if (p.life >= p.maxLife || p.x > W + 20 || drawOpacity < 0.02) {
        particles.splice(i, 1);
        continue;
      }

      // Draw particle with soft glow
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${drawOpacity})`;
      ctx.fill();

      // Faint trail
      if (p.size > 1.2) {
        ctx.beginPath();
        ctx.arc(p.x - p.vx * 1.5, p.y, p.size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${drawOpacity * 0.3})`;
        ctx.fill();
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      observer.disconnect();
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};
