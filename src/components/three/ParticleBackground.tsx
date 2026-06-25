import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SceneWrapper from './SceneWrapper';

interface ParticleBackgroundProps {
  caloriePercent: number; // 0-150+ percentage of calorie target
}

const PARTICLE_COUNT = 400;
const WIDTH = 8;
const HEIGHT = 6;
const DEPTH = 2;

function getColor(percent: number): THREE.Color {
  if (percent < 70) {
    // Green - doing well
    return new THREE.Color('#86efac');
  } else if (percent < 100) {
    // Yellow - approaching limit
    return new THREE.Color('#fcd34d');
  } else {
    // Orange - over limit
    return new THREE.Color('#fb923c');
  }
}

function Particles({ caloriePercent }: ParticleBackgroundProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Adjust particle count based on calorie status (more calories = fewer particles)
  const activeCount = useMemo(() => {
    if (caloriePercent > 120) return Math.floor(PARTICLE_COUNT * 0.6);
    if (caloriePercent > 100) return Math.floor(PARTICLE_COUNT * 0.8);
    return PARTICLE_COUNT;
  }, [caloriePercent]);

  // Generate random particle positions
  const positions = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * WIDTH;
      pos[i * 3 + 1] = (Math.random() - 0.5) * HEIGHT;
      pos[i * 3 + 2] = (Math.random() - 0.5) * DEPTH;
    }
    return pos;
  }, []);

  // Store initial velocities
  const velocities = useMemo(() => {
    const vel = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      vel[i * 3] = (Math.random() - 0.5) * 0.002; // x velocity
      vel[i * 3 + 1] = Math.random() * 0.003 + 0.001; // y velocity (upward)
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.001; // z velocity
    }
    return vel;
  }, []);

  // Target color based on calorie percent
  const targetColor = useMemo(() => getColor(caloriePercent), [caloriePercent]);
  const currentColor = useRef(new THREE.Color('#86efac'));

  useFrame(({ pointer }) => {
    if (!pointsRef.current) return;

    // Smooth color transition
    currentColor.current.lerp(targetColor, 0.02);
    const material = pointsRef.current.material as THREE.PointsMaterial;
    material.color.copy(currentColor.current);

    // Update mouse position for repulsion
    mouseRef.current.x = pointer.x * 4;
    mouseRef.current.y = pointer.y * 3;

    const geometry = pointsRef.current.geometry;
    const posArray = geometry.attributes.position.array as Float32Array;

    // Animate particles
    for (let i = 0; i < activeCount; i++) {
      const idx = i * 3;

      // Apply velocity
      posArray[idx] += velocities[idx];
      posArray[idx + 1] += velocities[idx + 1];
      posArray[idx + 2] += velocities[idx + 2];

      // Add slight horizontal drift
      posArray[idx] += Math.sin(posArray[idx + 1] * 0.5) * 0.001;

      // Mouse repulsion
      const dx = posArray[idx] - mouseRef.current.x;
      const dy = posArray[idx + 1] - mouseRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.5 && dist > 0.01) {
        const force = (0.5 - dist) * 0.02;
        posArray[idx] += (dx / dist) * force;
        posArray[idx + 1] += (dy / dist) * force;
      }

      // Wrap around when going off screen
      if (posArray[idx + 1] > HEIGHT / 2) {
        posArray[idx + 1] = -HEIGHT / 2;
        posArray[idx] = (Math.random() - 0.5) * WIDTH;
      }
      if (posArray[idx] > WIDTH / 2) posArray[idx] = -WIDTH / 2;
      if (posArray[idx] < -WIDTH / 2) posArray[idx] = WIDTH / 2;
    }

    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function ParticleScene({ caloriePercent }: ParticleBackgroundProps) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <Particles caloriePercent={caloriePercent} />
    </>
  );
}

export default function ParticleBackground({ caloriePercent }: ParticleBackgroundProps) {
  const fallback = null; // No fallback needed for background

  return (
    <SceneWrapper
      fallback={fallback}
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    >
      <ParticleScene caloriePercent={caloriePercent} />
    </SceneWrapper>
  );
}
