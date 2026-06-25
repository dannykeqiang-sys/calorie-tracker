import { EffectComposer, Bloom } from '@react-three/postprocessing';

interface PostEffectsProps {
  enabled?: boolean;
}

export default function PostEffects({ enabled = true }: PostEffectsProps) {
  if (!enabled) return null;

  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.6}
        luminanceSmoothing={0.9}
        intensity={0.4}
        mipmapBlur
      />
    </EffectComposer>
  );
}
