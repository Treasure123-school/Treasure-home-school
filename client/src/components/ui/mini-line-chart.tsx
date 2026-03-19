interface MiniLineChartProps {
  data: number[];
  color?: string;
  height?: number;
}
export function MiniLineChart({ data, color = '#6C63FF', height = 40 }: MiniLineChartProps) {
  if (!data || data.length === 0) {
    return <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">No data</div>;
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 100;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-in fade-in duration-500"
      />
      <polyline
        points={points}
        fill={color}
        fillOpacity="0.1"
        stroke="none"
      />
    </svg>
  );
}