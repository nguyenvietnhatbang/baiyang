export default function PondStatusBadge({ status, compact = false }) {
  const pad = compact ? 'px-1.5 py-0.5 gap-1' : 'px-2.5 py-1 gap-1.5';
  const dot = compact ? 'w-1 h-1' : 'w-1.5 h-1.5';
  const text = compact ? 'text-[10px]' : 'text-xs';
  if (status === 'CC') {
    return (
      <span className={`inline-flex items-center ${pad} rounded-full ${text} font-extrabold bg-blue-50 text-blue-600 border border-blue-100`}>
        <span className={`${dot} rounded-full bg-blue-500`} />
        CC
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center ${pad} rounded-full ${text} font-extrabold bg-slate-50 text-slate-600 border border-slate-100`}>
      <span className={`${dot} rounded-full bg-slate-300`} />
      CT
    </span>
  );
}