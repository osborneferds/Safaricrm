import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const PALETTE = ["#c8912f", "#2f7e76", "#46558c", "#b4543a", "#b69355", "#3c6447", "#855c18", "#96402a"];

const tooltipStyle = {
  background: "#1e1811", border: "1px solid #3c3021", borderRadius: 10, fontSize: 12,
  fontFamily: "Manrope", color: "#faf7ef", fontWeight: 600, padding: "6px 10px",
};

export const ChartCard = ({ title, sub, right, children, h = 240 }: { title: string; sub?: string; right?: ReactNode; children: ReactNode; h?: number }) => (
  <div className="card p-4">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h4 className="font-display font-bold text-ink-900">{title}</h4>
        {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
    <div style={{ height: h }}>{children}</div>
  </div>
);

export const RevArea = ({ data, label = "Revenue" }: { data: { name: string; v: number }[]; label?: string }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
      <defs>
        <linearGradient id="goldfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8912f" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#c8912f" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke="#e9ddc2" strokeDasharray="3 4" vertical={false} />
      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6f5d42", fontFamily: "Manrope", fontWeight: 700 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
      <YAxis tick={{ fontSize: 10, fill: "#6f5d42", fontFamily: "Manrope" }} axisLine={false} tickLine={false} width={52} tickFormatter={(v: number) => `${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}`} />
      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`AED ${Number(v).toLocaleString()}`, label]} cursor={{ stroke: "#c8912f", strokeDasharray: "3 3" }} />
      <Area type="monotone" dataKey="v" stroke="#a87520" strokeWidth={2.2} fill="url(#goldfill)" />
    </AreaChart>
  </ResponsiveContainer>
);

export const DayBars = ({ data, color = "#2f7e76", label = "Bookings" }: { data: { name: string; v: number }[]; color?: string; label?: string }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
      <CartesianGrid stroke="#e9ddc2" strokeDasharray="3 4" vertical={false} />
      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6f5d42", fontFamily: "Manrope", fontWeight: 700 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
      <YAxis tick={{ fontSize: 10, fill: "#6f5d42", fontFamily: "Manrope" }} axisLine={false} tickLine={false} allowDecimals={false} />
      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, label]} cursor={{ fill: "#f3ecdb" }} />
      <Bar dataKey="v" fill={color} radius={[5, 5, 0, 0]} maxBarSize={26} />
    </BarChart>
  </ResponsiveContainer>
);

export const Donut = ({ data, centerLabel }: { data: { name: string; value: number }[]; centerLabel?: string }) => (
  <div className="relative h-full">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2.5} strokeWidth={0}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
    {centerLabel && (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-center text-[11px] font-bold text-ink-500 leading-tight">{centerLabel}</span>
      </div>
    )}
  </div>
);

export const FunnelRow = ({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) => (
  <div className="flex items-center gap-2.5">
    <span className="w-24 text-[11px] font-extrabold uppercase tracking-wide text-ink-500 shrink-0">{label}</span>
    <div className="grow h-6 rounded-md bg-sand-100 overflow-hidden relative">
      <div className="h-full rounded-md transition-all duration-700 flex items-center justify-end pr-2"
        style={{ width: `${Math.max(6, (value / Math.max(1, max)) * 100)}%`, background: tone }}>
        <span className="text-[10px] font-extrabold text-white drop-shadow">{value}</span>
      </div>
    </div>
  </div>
);
