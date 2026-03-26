// ShimmerLoader — animated loading placeholder for async fields (e.g. image analysis)
// Gentle gradient sweep left-to-right on a bg-elevated block.
// Use as inline replacement for a field while Claude Vision processes.

interface ShimmerLoaderProps {
  /** Width of the shimmer block — default "100%" */
  width?: string | number;
  /** Height of the shimmer block — default "36px" (matches input height) */
  height?: string | number;
  /** Corner radius — default var(--radius-md) */
  rounded?: string;
  className?: string;
}

function ShimmerLoader({
  width = "100%",
  height = "36px",
  rounded = "var(--radius-md)",
  className = "",
}: ShimmerLoaderProps) {
  return (
    <span
      className={`shimmer block ${className}`}
      style={{
        width,
        height,
        borderRadius: rounded,
        display: "block",
      }}
      role="status"
      aria-label="Loading…"
    />
  );
}

// Inline shimmer — matches a line of text
interface ShimmerTextProps {
  /** Approximate character count to size the block */
  chars?: number;
  className?: string;
}

export function ShimmerText({ chars = 12, className = "" }: ShimmerTextProps) {
  return (
    <ShimmerLoader
      width={`${chars * 8}px`}
      height="14px"
      rounded="var(--radius-sm)"
      className={className}
    />
  );
}

export { ShimmerLoader };
export default ShimmerLoader;
