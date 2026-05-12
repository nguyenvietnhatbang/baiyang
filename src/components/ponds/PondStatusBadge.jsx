export default function PondStatusBadge({ status }) {
  if (status === 'CC') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
        CC
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-50 text-slate-600 border border-slate-100 shadow-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
      CT
    </span>
  );
}