import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PondLabTestPanel, { pondChoiceLabel } from './PondLabTestPanel';

/**
 * Hộp thoại nhập / xem phiếu kiểm nghiệm kháng sinh — chọn ao nuôi, tự điền thông tin mẫu.
 */
export default function PondLabTestDialog({
  open,
  onClose,
  pond,
  pondOptions = [],
  selectedCycleId = '',
  canEditDelete = false,
}) {
  const [activePond, setActivePond] = useState(pond);

  useEffect(() => {
    if (open && pond) setActivePond(pond);
  }, [open, pond?.id]);

  const options = useMemo(() => {
    const map = new Map();
    for (const p of [...pondOptions, pond].filter(Boolean)) {
      map.set(String(p.id), p);
    }
    return [...map.values()];
  }, [pondOptions, pond]);

  if (!pond) return null;

  const titlePond = activePond || pond;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="w-[min(96vw,72rem)] sm:max-w-6xl max-h-[92vh] overflow-y-auto p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            Kiểm nghiệm KS — {pondChoiceLabel(titlePond)}
          </DialogTitle>
        </DialogHeader>
        <PondLabTestPanel
          pond={pond}
          pondOptions={options}
          onActivePondChange={setActivePond}
          selectedCycleId={selectedCycleId}
          canEditDelete={canEditDelete}
          compact
        />
      </DialogContent>
    </Dialog>
  );
}
