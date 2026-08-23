'use client';
import { useState, useEffect } from 'react';
import { Dumbbell } from 'lucide-react';

function deriveFrame1(url: string) {
  return url.replace(/\/0\.jpg$/, '/1.jpg');
}

/**
 * Thumbnail for exercises. Supports:
 * - MP4 video: rendered as a muted looping <video>
 * - Frame-pair images (/0.jpg): cross-fades between frame0 and frame1
 * - Any other image: static <img>
 * Falls back to a Dumbbell icon when no media is available.
 */
export function ExerciseThumb({
  gif_url,
  className = 'h-10 w-10',
  iconClassName = 'h-4 w-4',
}: {
  gif_url?: string | null;
  className?: string;
  iconClassName?: string;
}) {
  const [showSecond, setShowSecond] = useState(false);
  const isVideo = !!gif_url && gif_url.toLowerCase().endsWith('.mp4');
  const hasFrames = !!gif_url && !isVideo && /\/0\.jpg$/.test(gif_url);
  const frame1 = hasFrames ? deriveFrame1(gif_url!) : null;

  useEffect(() => {
    if (!hasFrames) return;
    const id = setInterval(() => setShowSecond((s) => !s), 900);
    return () => clearInterval(id);
  }, [hasFrames]);

  return (
    <div
      className={`shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center relative ${className}`}
    >
      {gif_url ? (
        isVideo ? (
          <video
            src={gif_url}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <>
            <img
              src={gif_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
              style={{ opacity: showSecond ? 0 : 1 }}
              loading="lazy"
            />
            {frame1 && (
              <img
                src={frame1}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                style={{ opacity: showSecond ? 1 : 0 }}
                loading="lazy"
              />
            )}
          </>
        )
      ) : (
        <Dumbbell className={`text-muted-foreground ${iconClassName}`} />
      )}
    </div>
  );
}
