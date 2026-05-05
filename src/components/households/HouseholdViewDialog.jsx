import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Building2, Hash, CheckCircle2, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function HouseholdViewDialog({ open, onClose, household, agency, region }) {
  const [householdPonds, setHouseholdPonds] = useState([]);
  const [loadingPonds, setLoadingPonds] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!open || !household?.id) {
      setHouseholdPonds([]);
      return () => {
        cancelled = true;
      };
    }

    setLoadingPonds(true);
    base44.entities.Pond.filter({ household_id: household.id }, '-updated_date', 200)
      .then((rows) => {
        if (!cancelled) setHouseholdPonds(rows || []);
      })
      .catch(() => {
        if (!cancelled) setHouseholdPonds([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPonds(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, household?.id]);

  if (!household) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Thông tin hộ nuôi
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Thông tin</TabsTrigger>
            <TabsTrigger value="ponds">Ao ({householdPonds.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 py-2">
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

            {household.created_at && (
              <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
                Tạo ngày: {new Date(household.created_at).toLocaleDateString('vi-VN')}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ponds" className="py-2">
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Mã ao</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Trạng thái</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Diện tích (m²)</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPonds ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={3}>Đang tải ao...</td>
                    </tr>
                  ) : householdPonds.length === 0 ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={3}>Hộ này chưa có ao</td>
                    </tr>
                  ) : (
                    householdPonds.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2.5 font-semibold text-primary">{p.code || '—'}</td>
                        <td className="px-3 py-2.5">{p.status || p.active_cycle?.status || 'CT'}</td>
                        <td className="px-3 py-2.5 text-right">{p.area != null ? Number(p.area).toLocaleString() : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
