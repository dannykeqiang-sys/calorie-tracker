import { useState, useEffect } from 'react';

export interface DeviceCapability {
  canUse3D: boolean;
  shouldReduceMotion: boolean;
  isTouchDevice: boolean;
  hasWebGL2: boolean;
  gpuTier: 'high' | 'medium' | 'low' | 'unknown';
}

function checkWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return !!gl;
  } catch {
    return false;
  }
}

function checkGPUPerformance(): 'high' | 'medium' | 'low' | 'unknown' {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'unknown';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'unknown';

    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);

    // Check for known high-performance GPUs
    const highPerfKeywords = ['nvidia', 'geforce', 'rtx', 'gtx', 'radeon rx', 'apple m'];
    const lowPerfKeywords = ['intel hd', 'intel uhd', 'intel iris', 'mali', 'adreno'];

    const gpuString = `${vendor} ${renderer}`.toLowerCase();

    if (highPerfKeywords.some(kw => gpuString.includes(kw))) {
      return 'high';
    }
    if (lowPerfKeywords.some(kw => gpuString.includes(kw))) {
      return 'low';
    }

    return 'medium';
  } catch {
    return 'unknown';
  }
}

function checkTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function checkReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useDeviceCapability(): DeviceCapability {
  const [capability, setCapability] = useState<DeviceCapability>({
    canUse3D: false,
    shouldReduceMotion: false,
    isTouchDevice: false,
    hasWebGL2: false,
    gpuTier: 'unknown',
  });

  useEffect(() => {
    const hasWebGL2 = checkWebGL2();
    const gpuTier = checkGPUPerformance();
    const isTouchDevice = checkTouchDevice();
    const shouldReduceMotion = checkReducedMotion();

    // Determine if 3D should be enabled
    // Disable on: no WebGL2, low GPU + touch device, reduced motion
    let canUse3D = hasWebGL2;

    if (gpuTier === 'low' && isTouchDevice) {
      canUse3D = false;
    }

    if (shouldReduceMotion) {
      canUse3D = false;
    }

    setCapability({
      canUse3D,
      shouldReduceMotion,
      isTouchDevice,
      hasWebGL2,
      gpuTier,
    });
  }, []);

  return capability;
}
