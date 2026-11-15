export function AppLogo({ size = 48, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="PWS Logo"
    >
      <defs>
        <linearGradient id="pwsBgComp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1b735c" />
          <stop offset="50%" stop-color="#17634f" />
          <stop offset="100%" stop-color="#0f4436" />
        </linearGradient>
        <linearGradient id="pwsAccentComp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#d7f0e3" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx="128" fill="url(#pwsBgComp)" />
      <rect x="4" y="4" width="504" height="504" rx="124" fill="none" stroke="#ffffff" stroke-opacity="0.15" stroke-width="6" />

      <g>
        <rect x="136" y="148" width="240" height="156" rx="28" fill="#ffffff" fill-opacity="0.22" stroke="#ffffff" stroke-opacity="0.4" stroke-width="6" />
        <rect x="116" y="192" width="280" height="176" rx="32" fill="url(#pwsAccentComp)" />
        <path d="M152 308 L224 246 L272 278 L348 206" fill="none" stroke="#17634f" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M320 206 H348 V234" fill="none" stroke="#17634f" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="344" cy="280" r="26" fill="#17634f" />
        <circle cx="344" cy="280" r="16" fill="#ffffff" />
        <circle cx="344" cy="280" r="7" fill="#17634f" />
      </g>
    </svg>
  );
}
