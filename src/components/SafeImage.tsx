import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function SafeImage({ src, alt, className = '', fallbackLabel }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 text-slate-500 dark:text-slate-400 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="h-6 w-6 opacity-70" />
        <span className="text-xs font-medium">{fallbackLabel || 'No photo attached'}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
