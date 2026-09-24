type Props = {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  thickness?: number;
};
export default function Sparkline({
  data,
  width = 120,
  height = 28,
  stroke = "#0369a1",
  fill = "rgba(3, 105, 161, 0.14)",
  thickness = 2,
}: Props) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);
  const stepX = width / (data.length - 1);

  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return [x, y] as [number, number];
  });

  // Smooth path
  const t = 0.3;
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : pts.length - 1];
    const cp1x = p1[0] + (p2[0] - p0[0]) * t;
    const cp1y = p1[1] + (p2[1] - p0[1]) * t;
    const cp2x = p2[0] - (p3[0] - p1[0]) * t;
    const cp2y = p2[1] - (p3[1] - p1[1]) * t;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }
  const area = `${d} L ${pts[pts.length - 1][0]},${height} L 0,${height} Z`;

  return (
    <svg width={width} height={height}>
      <path d={area} fill={fill} stroke="none" />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={thickness}
        strokeLinecap="round"
      />
    </svg>
  );
}
