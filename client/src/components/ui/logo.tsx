"use client"

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizes = {
    sm: { icon: 'w-8 h-8', text: 'text-lg' },
    md: { icon: 'w-10 h-10', text: 'text-xl' },
    lg: { icon: 'w-14 h-14', text: 'text-3xl' },
  };

  const currentSize = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${currentSize.icon} rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-3/4 h-3/4">
          <path
            d="M12 2L2 7L12 12L22 7L12 2Z"
            fill="white"
            fillOpacity="0.9"
          />
          <path
            d="M2 17L12 22L22 17"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 12L12 17L22 12"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`${currentSize.text} font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent`}>
            Bok Option
          </span>
        </div>
      )}
    </div>
  );
}
