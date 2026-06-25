import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import SceneWrapper from './SceneWrapper';
import PostEffects from './PostEffects';

interface ThreeRings3DProps {
  intake: number;
  target: number;
  protein: number;
  proteinTarget: number;
  carbs: number;
  carbsTarget: number;
  fat: number;
  fatTarget: number;
}

interface RingData {
  radius: number;
  tube: number;
  value: number;
  max: number;
  color: string;
  emissiveColor: string;
  label: string;
  unit: string;
}

function ProgressRing({
  radius,
  tube,
  value,
  max,
  color,
  emissiveColor,
  label,
  unit,
  index,
}: RingData & { index: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [animated, setAnimated] = useState(false);

  const percentage = Math.min(value / Math.max(max, 1), 1.5);
  const arc = percentage * Math.PI * 2;
  const isOver = percentage > 1;

  // Start animation after mount
  useFrame((_, delta) => {
    if (!animated) {
      setTimeout(() => setAnimated(true), 100 + index * 100);
    }

    if (meshRef.current) {
      // Smooth scale transition on hover
      const targetScale = hovered ? 1.08 : 1;
      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        delta * 8
      );
    }
  });

  const currentArc = animated ? arc : 0;

  // Calculate endpoint position
  const endPoint = useMemo(() => {
    if (currentArc <= 0) return null;
    const clampedArc = Math.min(currentArc, Math.PI * 2);
    const angle = clampedArc - Math.PI / 2;
    return new THREE.Vector3(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      0
    );
  }, [radius, currentArc]);

  const ringColor = isOver ? '#ef4444' : color;
  const ringEmissive = isOver ? '#ff0000' : emissiveColor;

  return (
    <group>
      {/* Background ring */}
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <torusGeometry args={[radius, tube, 16, 64, Math.PI * 2]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.08}
          emissive={emissiveColor}
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Progress ring */}
      {currentArc > 0 && (
        <mesh
          ref={meshRef}
          rotation={[0, 0, -Math.PI / 2]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = 'auto';
          }}
        >
          <torusGeometry args={[radius, tube, 16, 64, currentArc]} />
          <meshStandardMaterial
            color={ringColor}
            emissive={ringEmissive}
            emissiveIntensity={hovered ? 0.8 : 0.4}
            metalness={0.3}
            roughness={0.4}
          />
        </mesh>
      )}

      {/* Endpoint sphere */}
      {endPoint && (
        <mesh position={[endPoint.x, endPoint.y, endPoint.z]}>
          <sphereGeometry args={[tube * 1.1, 16, 16]} />
          <meshStandardMaterial
            color={ringColor}
            emissive={ringEmissive}
            emissiveIntensity={hovered ? 1 : 0.6}
            metalness={0.3}
            roughness={0.4}
          />
        </mesh>
      )}
    </group>
  );
}

function CameraController() {
  const mouseRef = useRef({ x: 0, y: 0 });

  useFrame(({ camera, pointer }) => {
    // Smooth camera movement based on mouse position
    const targetX = pointer.x * 0.3;
    const targetY = pointer.y * 0.3;

    mouseRef.current.x += (targetX - mouseRef.current.x) * 0.05;
    mouseRef.current.y += (targetY - mouseRef.current.y) * 0.05;

    camera.position.x = mouseRef.current.x;
    camera.position.y = mouseRef.current.y;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function CenterText({ intake, target }: { intake: number; target: number }) {
  const overallPct = Math.round((intake / Math.max(target, 1)) * 100);
  const isOver = intake > target;
  const overallColor = isOver ? '#ef4444' : '#22c55e';

  return (
    <Html center position={[0, 0, 0]}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          userSelect: 'none',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '30px',
            fontWeight: 900,
            color: 'var(--ck-dock-title, #1e293b)',
            lineHeight: 1,
            transition: 'all 0.3s ease',
          }}
        >
          {intake}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--ck-dock-sub, #64748b)',
            marginTop: '4px',
            transition: 'all 0.3s ease',
          }}
        >
          / {target} kcal
        </div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: overallColor,
            marginTop: '4px',
            transition: 'all 0.3s ease',
          }}
        >
          {overallPct}%
        </div>
      </div>
    </Html>
  );
}

function ThreeRingsScene(props: ThreeRings3DProps) {
  const { intake, target, protein, proteinTarget, carbs, carbsTarget, fat, fatTarget } = props;

  const rings: RingData[] = [
    {
      radius: 1.8,
      tube: 0.15,
      value: intake,
      max: target,
      color: '#f97316',
      emissiveColor: '#ff6b00',
      label: '热量',
      unit: 'kcal',
    },
    {
      radius: 1.4,
      tube: 0.15,
      value: protein,
      max: proteinTarget,
      color: '#3b82f6',
      emissiveColor: '#2563eb',
      label: '蛋白质',
      unit: 'g',
    },
    {
      radius: 1.0,
      tube: 0.15,
      value: carbs,
      max: carbsTarget,
      color: '#22c55e',
      emissiveColor: '#16a34a',
      label: '碳水',
      unit: 'g',
    },
  ];

  return (
    <>
      <CameraController />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />

      {/* Rings */}
      {rings.map((ring, i) => (
        <ProgressRing key={i} {...ring} index={i} />
      ))}

      {/* Center text */}
      <CenterText intake={intake} target={target} />

      {/* Post-processing */}
      <PostEffects enabled={true} />
    </>
  );
}

export default function ThreeRings3D(props: ThreeRings3DProps) {
  const fallback = (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ck-dock-sub, #64748b)',
        fontSize: '14px',
      }}
    >
      3D 加载中...
    </div>
  );

  return (
    <SceneWrapper fallback={fallback} style={{ width: '100%', height: '500px' }}>
      <ThreeRingsScene {...props} />
    </SceneWrapper>
  );
}
