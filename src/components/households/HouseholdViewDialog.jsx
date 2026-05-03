import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, MapPin, Building2, Hash, CheckCircle2, XCircle } from 'lucide-react';

export default function HouseholdViewDialog({ open, onClose, household, agency, region }) {
  if (!household) return null;
a
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Thông tin hộ nuôi
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Trạng thái */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-sm font-medium text-slate-600">Trạng thái</span>
            <div className="flex items-center gap-2">
              {household.active ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold text-green-700">Hoạt động</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-700">Tạm dừng</span>
                </>
              )}
            </div>
          </div>

          {/* Thông tin chính */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="text-xs font-semibold text-slate-500 uppercase">Tên hộ</span>
              <span className="col-span-2 text-sm font-bold text-slate-800">{household.name}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="text-xs font-semibold text-slate-500 uppercase">Mã hộ</span>
              <span className="col-span-2 text-base font-mono font-bold text-primary">{household.household_segment}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="text-xs font-semibold text-slate-500 uppercase">Khu vực</span>
              <span className="col-span-2 text-sm text-slate-700">
                <span className="font-mono font-semibold">{household.region_code}</span>
                {region && <span className="text-slate-500 ml-2">— {region.name}</span>}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="text-xs font-semibold text-slate-500 uppercase">Đại lý</span>
              <span className="col-span-2 text-sm text-slate-700">
                {agency ? (
                  <>
                    <span className="font-semibold">{agency.code}</span>
                    <span className="text-slate-500 ml-2">— {agency.name}</span>
                  </>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </span>
            </div>
          </div>

          {/* Địa chỉ */}
          {household.address && (
            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Địa chỉ</p>
                  <p className="text-sm text-slate-700">{household.address}</p>
                </div>
              </div>
            </div>
          )}

          {/* Mã đầy đủ */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Hash className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase">Mã đầy đủ</span>
            </div>
            <p className="font-mono text-sm font-bold text-primary">
              {household.region_code}-{agency?.code || '??'}-{household.household_segment}
            </p>
            <p className="text-xs text-slate-500 mt-1">Dùng trong mã ao: [Mã này]-[STT ao]</p>
          </div>

          {/* Metadata */}
          {household.created_at && (
            <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
              Tạo ngày: {new Date(household.created_at).toLocaleDateString('vi-VN')}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
