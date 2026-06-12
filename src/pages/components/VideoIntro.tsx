import { useState, useRef, useEffect } from 'react';
import { Flame, Volume2, VolumeX, SkipForward, Loader2 } from 'lucide-react';

const VIDEO_URL =
  'https://cdn.jsdelivr.net/gh/dannykeqiang-sys/image-hosting@main/videos/2026-06-12/1781256347654-t476ov-Vertical_aspect_ratio_ci.mp4';

export { VIDEO_URL };

interface VideoIntroProps {
  onEnd: () => void;
  leaving: boolean;
}

export default function VideoIntro({ onEnd, leaving }: VideoIntroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [muted, setMuted] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onEnd();
    }, 12000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onEnd]);

  const handleLoaded = () => {
    setLoaded(true);
    videoRef.current?.play().catch(() => {});
  };

  const handleEnded = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onEnd();
  };

  const handleSkip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onEnd();
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
    }
    setMuted(m => !m);
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        zIndex: 9999,
        opacity: leaving ? 0 : 1,
        transform: leaving ? 'scale(1.05)' : 'scale(1)',
        transition: 'opacity 0.72s cubic-bezier(0.4,0,0.2,1), transform 0.72s cubic-bezier(0.4,0,0.2,1)',
        background: loaded
          ? '#000'
          : 'linear-gradient(160deg, #FFF8F5 0%, #FFF0FA 60%, #F0F4FF 100%)',
      }}
    >
      <video
        ref={videoRef}
        src={VIDEO_URL}
        autoPlay
        preload="auto"
        muted={muted}
        playsInline
        onCanPlay={handleLoaded}
        onEnded={handleEnded}
        className="absolute inset-0 w-full h-full object-cover md:object-contain"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.6s ease', background: '#000' }}
      />

      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #F97316, #EC4899)' }}
            >
              <Flame className="w-8 h-8 text-white" />
            </div>
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#F97316' }} />
          </div>
        </div>
      )}

      {loaded && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.62) 100%)',
            }}
          />

          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-12 pb-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #F97316, #EC4899)' }}
              >
                <Flame style={{ width: 18, height: 18, color: '#fff' }} />
              </div>
              <span
                className="text-white font-black text-base tracking-tight"
                style={{ textShadow: '0 1px 6px rgba(0,0,0,0.4)' }}
              >
                燃烧我的卡路里
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="flex items-center justify-center w-9 h-9 rounded-full cursor-pointer active:scale-90 transition-all"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-white" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
                )}
              </button>
              <button
                onClick={handleSkip}
                className="flex items-center gap-1.5 px-3.5 h-9 rounded-full text-white text-sm font-semibold cursor-pointer active:scale-95 transition-all"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}
              >
                跳过
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 px-5 pb-10">
            <p
              className="text-white/80 text-sm font-medium text-center tracking-wide"
              style={{ textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}
            >
              科学记录，遇见更好的自己
            </p>
          </div>
        </>
      )}
    </div>
  );
}
