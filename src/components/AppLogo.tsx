import React from 'react';
import logoPng from '../assets/logo.png';

interface AppLogoProps {
  className?: string;
  size?: number | string;
  alt?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = 'w-8 h-8',
  size,
  alt = 'Kimai Zeiterfassung Logo',
}) => {
  return (
    <img
      src={logoPng}
      alt={alt}
      className={`object-contain shrink-0 select-none pointer-events-none ${className}`}
      style={size ? { width: size, height: size } : undefined}
      draggable={false}
      onError={(e) => {
        // Fallback to public pwa-512x512.png if needed
        const target = e.currentTarget;
        const fallbackUrl = `${import.meta.env.BASE_URL}pwa-512x512.png`;
        if (target.src !== fallbackUrl) {
          target.src = fallbackUrl;
        }
      }}
    />
  );
};
