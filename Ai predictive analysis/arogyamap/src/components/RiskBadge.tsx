import type { RiskLevel } from '@/data/types';

interface RiskBadgeProps {
  level: RiskLevel;
  /** Show as a larger badge with label text (default: compact pill) */
  size?: 'sm' | 'md' | 'lg';
  /** Show the label text, e.g. "Critical" */
  showLabel?: boolean;
}

const config: Record<RiskLevel, { label: string; bg: string; text: string; dot: string }> = {
  normal: {
    label: 'Normal',
    bg: 'bg-risk-normal-bg border-risk-normal-border',
    text: 'text-risk-normal',
    dot: 'bg-risk-normal',
  },
  elevated: {
    label: 'Elevated',
    bg: 'bg-risk-elevated-bg border-risk-elevated-border',
    text: 'text-risk-elevated',
    dot: 'bg-risk-elevated',
  },
  critical: {
    label: 'Critical',
    bg: 'bg-risk-critical-bg border-risk-critical-border',
    text: 'text-risk-critical',
    dot: 'bg-risk-critical',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export function RiskBadge({ level, size = 'sm', showLabel = true }: RiskBadgeProps) {
  const c = config[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium
                   ${c.bg} ${c.text} ${sizeClasses[size]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${level === 'critical' ? 'animate-pulse' : ''}`} />
      {showLabel && c.label}
    </span>
  );
}
