export default function ShieldMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 4 55 12v17c0 15-9.2 26.4-23 32C18.2 55.4 9 44 9 29V12L32 4Z" fill="#DC2626" />
      <g stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 15v31M19 23h26M22 23l-6 12m6-12 6 12m14-12-6 12m6-12 6 12M23 35h-14m14 0a7 7 0 0 1-14 0m41 0H36m14 0a7 7 0 0 1-14 0M25 47h14" />
      </g>
    </svg>
  );
}
