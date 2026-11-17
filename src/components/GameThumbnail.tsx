import { useEffect, useRef, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { resolveThumbnailUrl, supabase } from '../lib/supabase';

interface GameThumbnailProps {
  src?: string | null;
  alt: string;
  title: string;
  fallbackBg?: string;
  compact?: boolean;
  imgClassName?: string;
}

function parseSupabasePublicStorageUrl(
  url: string
): { bucket: string; objectPath: string } | null {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/?#]+)\/([^?#]+)/i);
  if (!match) return null;
  try {
    return {
      bucket: decodeURIComponent(match[1]),
      objectPath: decodeURIComponent(match[2]),
    };
  } catch {
    return { bucket: match[1], objectPath: match[2] };
  }
}

export function GameThumbnail({
  src,
  alt,
  title,
  fallbackBg = 'from-[#D8F3E5] to-[#DDF0FC]',
  compact = false,
  imgClassName = 'w-full h-full object-cover',
}: GameThumbnailProps) {
  const normalizedSrc = resolveThumbnailUrl(src);
  const [activeSrc, setActiveSrc] = useState<string>(normalizedSrc);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(!normalizedSrc);

  const recoveryIndexRef = useRef(0);
  const recoveryVersionRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    recoveryVersionRef.current += 1;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    recoveryIndexRef.current = 0;
    setActiveSrc(normalizedSrc);
    setIsLoaded(false);
    setHasFailed(!normalizedSrc);
  }, [normalizedSrc]);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [activeSrc]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const handleImageError = async () => {
    const currentVersion = recoveryVersionRef.current;
    const failedUrl = activeSrc;
    const parsed = parseSupabasePublicStorageUrl(normalizedSrc);

    // Attempt safe Supabase Storage recovery before showing fallback:
    // 1) Signed URL / direct download on the saved bucket (covers private-bucket RLS configurations)
    // 2) Alternate bucket name ('thumbnails.' <-> 'thumbnails') in case an older record differs
    if (parsed && supabase) {
      const altBucket =
        parsed.bucket === 'thumbnails.'
          ? 'thumbnails'
          : parsed.bucket === 'thumbnails'
            ? 'thumbnails.'
            : null;

      const attempts: Array<() => Promise<string | null>> = [
        async () => {
          const { data } = await supabase!.storage
            .from(parsed.bucket)
            .createSignedUrl(parsed.objectPath, 3600);
          return data?.signedUrl || null;
        },
        async () => {
          const { data } = await supabase!.storage
            .from(parsed.bucket)
            .download(parsed.objectPath);
          if (!data || recoveryVersionRef.current !== currentVersion) return null;
          const objUrl = URL.createObjectURL(data);
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          blobUrlRef.current = objUrl;
          return objUrl;
        },
      ];

      if (altBucket) {
        attempts.push(async () => {
          const { data } = supabase!.storage.from(altBucket).getPublicUrl(parsed.objectPath);
          return data.publicUrl && data.publicUrl !== normalizedSrc ? data.publicUrl : null;
        });
        attempts.push(async () => {
          const { data } = await supabase!.storage
            .from(altBucket)
            .createSignedUrl(parsed.objectPath, 3600);
          return data?.signedUrl || null;
        });
      }

      while (recoveryIndexRef.current < attempts.length) {
        const nextIdx = recoveryIndexRef.current++;
        try {
          const candidate = await attempts[nextIdx]();
          if (recoveryVersionRef.current !== currentVersion) return;
          if (candidate && candidate !== failedUrl) {
            setIsLoaded(false);
            setActiveSrc(candidate);
            return;
          }
        } catch {
          // Continue to next recovery attempt
        }
      }
    }

    if (recoveryVersionRef.current !== currentVersion) return;
    console.warn(`Play Aura thumbnail failed to load for "${title}":`, failedUrl);
    setHasFailed(true);
  };

  if (!activeSrc || hasFailed) {
    return (
      <div
        className={`w-full h-full bg-gradient-to-br ${fallbackBg} flex flex-col items-center justify-center ${
          compact ? 'p-1.5' : 'gap-2 p-4'
        } text-center`}
      >
        <Gamepad2
          className={`${compact ? 'w-6 h-6' : 'w-10 h-10'} text-[#4B3D8F]/70`}
          aria-hidden="true"
        />
        {!compact && (
          <span className="font-display text-base font-bold text-[#2B3445] line-clamp-1">
            {title}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {!isLoaded && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 z-0 bg-gradient-to-br ${fallbackBg} animate-pulse pointer-events-none`}
        />
      )}
      <img
        ref={imgRef}
        src={activeSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => void handleImageError()}
        className={`relative z-10 ${imgClassName}`}
      />
    </div>
  );
}
