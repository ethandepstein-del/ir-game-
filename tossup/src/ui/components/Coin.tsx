interface Props {
  size?: number;
  className?: string;
  spin?: boolean;
}

/** The brand coin: gold, dark rim, a T stamped on it. Also stands in for "toss-up". */
export function Coin({ size = 32, className = '', spin = false }: Props) {
  return (
    <svg className={`coin ${spin ? 'flip' : ''} ${className}`} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#f0b429" stroke="#1b2436" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="10.6" fill="none" stroke="#b47c00" strokeWidth="1.2" strokeDasharray="1.6 2.4" />
      <path d="M10.4 12.2h11.2M16 12.2V23" stroke="#1b2436" strokeWidth="3.1" strokeLinecap="round" fill="none" />
      <path d="M8.2 10.2a9.6 9.6 0 0 1 5.4-4.1" stroke="#fff7d6" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.85" />
    </svg>
  );
}
