import { useEffect, useMemo, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export const WATER_COLOR_PRESETS = ['Xanh lá', 'Xanh trà', 'Nâu', 'Nâu đỏ', 'Vàng nhạt', 'Trong'];

/**
 * Màu nước: mở danh sách gợi ý, gõ để lọc hoặc dùng giá trị mới (không giới hạn preset).
 */
export default function WaterColorCombobox({
  value,
  onChange,
  id,
  disabled,
  className,
  triggerClassName,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const trimmed = search.trim();
  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return WATER_COLOR_PRESETS;
    return WATER_COLOR_PRESETS.filter((c) => c.toLowerCase().includes(q));
  }, [trimmed]);

  const hasExactPreset =
    trimmed.length > 0 &&
    WATER_COLOR_PRESETS.some((c) => c.toLowerCase() === trimmed.toLowerCase());
  const showUseCustom = trimmed.length > 0 && !hasExactPreset;

  const display = value?.trim() ? value.trim() : 'Chọn hoặc nhập màu…';

  const select = (v) => {
    onChange(v);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className={cn('relative w-full min-w-0', triggerClassName)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="flex w-full min-w-0"
          render={
            <Button
              type="button"
              variant="outline"
              id={id}
              disabled={disabled}
              className={cn(
                'h-9 w-full min-w-0 justify-between px-2 font-normal text-sm',
                !value?.trim() && 'text-muted-foreground',
                className
              )}
            />
          }
        >
          <span className="truncate text-left">{display}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--anchor-width)] min-w-[12rem] max-w-[min(100vw-1rem,var(--available-width))] p-0"
          align="start"
          sideOffset={4}
        >
        <div className="flex flex-col gap-0 p-1">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm hoặc gõ màu mới…"
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && trimmed) {
                e.preventDefault();
                select(trimmed);
              }
            }}
          />
          <div className="max-h-48 overflow-y-auto py-0.5">
            {filtered.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                  value?.trim() === c && 'bg-accent/60'
                )}
                onClick={() => select(c)}
              >
                {c}
              </button>
            ))}
            {showUseCustom && (
              <button
                type="button"
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm font-medium text-primary hover:bg-accent"
                onClick={() => select(trimmed)}
              >
                Dùng «{trimmed}»
              </button>
            )}
            {!trimmed && (
              <button
                type="button"
                className="mt-0.5 flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/80"
                onClick={() => select('')}
              >
                Để trống
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
      </Popover>
    </div>
  );
}
