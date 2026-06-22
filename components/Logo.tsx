// Line-art brand mark: an open book with a small "quest" spark.
// Uses currentColor so it inherits whatever color the container sets.
export default function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* open book */}
      <path d="M14 8C12 6.6 8.9 6 5.2 6.3V20.1C8.9 19.8 12 20.4 14 21.8 16 20.4 19.1 19.8 22.8 20.1V6.3C19.1 6 16 6.6 14 8Z" />
      {/* spine */}
      <path d="M14 8V21.8" />
      {/* page lines */}
      <path d="M8 10.8c1.3-.2 2.5-.1 3.4.3" />
      <path d="M16.6 11.1c.9-.4 2.1-.5 3.4-.3" />
      {/* quest spark */}
      <path d="M22.4 3l.55 1.6 1.6.55-1.6.55L22.4 7.3l-.55-1.6-1.6-.55 1.6-.55Z" />
    </svg>
  );
}
