// Interim brand illustrations, drawn in code. These stand in until the real
// assets (the golden retriever, the book stack) arrive from the brand file —
// swapping them later won't change any layout.

// A layered dune/sea wave divider. Full-width; place between sections.
export function DuneWave({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <svg viewBox="0 0 1200 90" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "100%" }}>
        <path d="M0 46 C 220 8, 380 82, 600 47 S 1000 8, 1200 44 L1200 90 L0 90 Z" fill="#9BB7BF" opacity="0.45" />
        <path d="M0 60 C 240 26, 430 88, 640 60 S 1040 30, 1200 57 L1200 90 L0 90 Z" fill="#9BB7BF" opacity="0.9" />
      </svg>
    </div>
  );
}

// A cozy stack of books in the brand palette.
export function BookStack({ size = 116 }: { size?: number }) {
  const stroke = "#2E4047";
  const books = [
    { y: 98, x: 6, w: 104, fill: "#4B6B75" },
    { y: 74, x: 12, w: 100, fill: "#C89347" },
    { y: 50, x: 3, w: 104, fill: "#617E74" },
    { y: 26, x: 14, w: 92, fill: "#ECCCB2" },
  ];
  return (
    <svg width={size} height={size * (132 / 116)} viewBox="0 0 116 132" fill="none" aria-hidden="true">
      <ellipse cx="58" cy="126" rx="48" ry="5" fill="#2E4047" opacity="0.12" />
      {books.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height="24" rx="4.5" fill={b.fill} stroke={stroke} strokeWidth="2" />
          <rect x={b.x + b.w - 11} y={b.y + 3} width="7" height="18" rx="2" fill="#FCF7EC" opacity="0.55" />
        </g>
      ))}
    </svg>
  );
}

// Paw mark — a friendly stand-in for the dog mascot until the real art lands.
export function PawStub({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">
      <ellipse cx="24" cy="31" rx="9.5" ry="8" />
      <ellipse cx="12.5" cy="21" rx="3.6" ry="4.6" />
      <ellipse cx="19.5" cy="14" rx="3.6" ry="4.8" />
      <ellipse cx="28.5" cy="14" rx="3.6" ry="4.8" />
      <ellipse cx="35.5" cy="21" rx="3.6" ry="4.6" />
    </svg>
  );
}
