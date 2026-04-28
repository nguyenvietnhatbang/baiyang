import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Fish, ClipboardList, ShoppingCart, QrCode, Pencil, AlertTriangle, Plus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PondPlanTab from './PondPlanTab';
import PondLogTab from './PondLogTab';
import PondHarvestTab from './PondHarvestTab';
import PondQRCode from './PondQRCode';
import PondEditDialog from './PondEditDialog';
import { differenceInDays, parseISO } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { pickActiveCycle } from '@/lib/pondCycleHelpers';
import { formatSupabaseError } from '@/lib/supabaseErrors';

function cycleLabel(c, idx) {
  if (!c) return '';
  const parts = [
    c.stock_date ? `Thả ${c.stock_date}` : `Chu kỳ ${idx + 1}`,
    c.status === 'CC' ? '· đang nuôi' : '',
    c.expected_yield != null ? `· ~${Number(c.expected_yield).toLocaleString()} kg` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

export default function PondDrawer({ pond, onClose, onUpdate, siblingPonds = [], defaultTab = 'plan' }) {
  const { harvestAlertDays, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canEditThisPond = Boolean(user);
  const today = new Date();
  const [showEdit, setShowEdit] = useState(false);
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [cycleLoadErr, setCycleLoadErr] = useState('');
  const [addingCycle, setAddingCycle] = useState(false);

  const loadCycles = useCallback(async () => {
    setCycleLoadErr('');
    try {
      const rows = await base44.entities.PondCycle.filter({ pond_id: pond.id }, '-updated_at', 200);
      const list = rows || [];
      setCycles(list);
      setSelectedCycleId((prev) => {
        if (prev && list.some((x) => x.id === prev)) return prev;
        return pickActiveCycle(list)?.id || list[0]?.id || '';
      });
    } catch (e) {
      setCycleLoadErr(formatSupabaseError(e));
      setCycles([]);
    }
  }, [pond.id]);

  useEffect(() => {
    void loadCycles();
  }, [loadCycles, pond.updated_at]);

  const selectedCycle = useMemo(
    () => cycles.find((c) => c.id === selectedCycleId) || null,
    [cycles, selectedCycleId]
  );

  const isWithdrawal =
    selectedCycle?.withdrawal_end_date &&
    differenceInDays(parseISO(selectedCycle.withdrawal_end_date), today) >= 0;

  const harvestDiff = selectedCycle?.expected_harvest_date
    ? differenceInDays(parseISO(selectedCycle.expected_harvest_date), today)
    : null;

  const isUrgent = harvestDiff !== null && harvestDiff <= harvestAlertDays;

  const handleDrawerUpdate = async () => {
    await loadCycles();
    await onUpdate?.();
  };

  const handleAddCycle = async () => {
    if (!canEditThisPond) return;
    setAddingCycle(true);
    setCycleLoadErr('');
    try {
      const row = await base44.entities.PondCycle.create({ pond_id: pond.id, status: 'CT' });
      await handleDrawerUpdate();
      if (row?.id) setSelectedCycleId(row.id);
    } catch (e) {
      setCycleLoadErr(formatSupabaseError(e));
    }
    setAddingCycle(false);
  };

  const cycleSelectItems = useMemo(
    () => [
      { value: '__none__', label: '— Chọn chu kỳ —' },
      ...cycles.map((c, i) => ({
        value: c.id,
        label: cycleLabel(c, i),
      })),
    ],
    [cycles]
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="relative w-full max-w-2xl h-full bg-card shadow-2xl flex flex-col overflow-hidden z-10">
          <div className="px-6 py-4 border-b border-border flex items-start justify-between bg-primary text-primary-foreground">
            <div>
              <div className="flex items-center gap-2">
                <Fish className="w-5 h-5 text-primary-foreground/85 shrink-0" />
                <h2 className="text-lg font-bold">{pond.code}</h2>
                {isUrgent && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold pulse-urgent">
                    ƯU TIÊN THU
                  </span>
                )}
                {isWithdrawal && (
                  <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    NGƯNG THUỐC
                  </span>
                )}
              </div>
              <p className="text-primary-foreground/85 text-sm mt-0.5">{pond.owner_name} • {pond.area} m²</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="text-primary-foreground/75 hover:text-primary-foreground transition-colors p-1 rounded"
                title="Chỉnh sửa / Xóa ao"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-primary-foreground/75 hover:text-primary-foreground transition-colors p-1"
                title="Đóng bảng ao (chỉ đóng bằng nút này — tránh mất dữ liệu đang nhập)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="px-6 py-3 border-b border-border bg-muted/30 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Chu kỳ thả / kế hoạch</p>
                <Select
                  modal={false}
                  value={selectedCycleId || '__none__'}
                  onValueChange={(v) => setSelectedCycleId(v === '__none__' ? '' : v)}
                  items={cycleSelectItems}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder="Chọn chu kỳ" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {cycleSelectItems.map((it) => (
                      <SelectItem key={it.value} value={it.value}>
                        {it.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canEditThisPond && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  disabled={addingCycle}
                  onClick={() => void handleAddCycle()}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {addingCycle ? 'Đang tạo…' : 'Chu kỳ mới'}
                </Button>
              )}
            </div>
            {cycleLoadErr && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{cycleLoadErr}</p>
            )}
          </div>

          {isWithdrawal && selectedCycle?.withdrawal_end_date && (
            <div className="px-6 py-2 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <p className="text-xs text-orange-700 font-medium">
                Còn {differenceInDays(parseISO(selectedCycle.withdrawal_end_date), today)} ngày ngưng thuốc.
                Hết ngưng: {selectedCycle.withdrawal_end_date}. Chưa được lên lịch thu hoạch.
              </p>
            </div>
          )}

          <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-3 border-b border-border bg-card">
              <TabsList className="bg-muted">
                <TabsTrigger value="plan" className="flex items-center gap-1.5 text-xs">
                  <Fish className="w-3.5 h-3.5" />Kế hoạch
                </TabsTrigger>
                <TabsTrigger value="log" className="flex items-center gap-1.5 text-xs">
                  <ClipboardList className="w-3.5 h-3.5" />Nhật ký
                </TabsTrigger>
                <TabsTrigger value="harvest" className="flex items-center gap-1.5 text-xs">
                  <ShoppingCart className="w-3.5 h-3.5" />Thu hoạch
                </TabsTrigger>
                <TabsTrigger value="qr" className="flex items-center gap-1.5 text-xs">
                  <QrCode className="w-3.5 h-3.5" />Mã QR
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="plan" className="p-6 mt-0">
                {selectedCycle ? (
                  <PondPlanTab
                    pond={pond}
                    cycle={selectedCycle}
                    onUpdate={handleDrawerUpdate}
                    isWithdrawal={isWithdrawal}
                    canEditPlan={canEditThisPond}
                    canEditAdjustedPlan={canEditThisPond}
                    isAdmin={isAdmin}
                    siblingPonds={siblingPonds}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Chưa có chu kỳ nào. Nhấn <strong>Chu kỳ mới</strong> để bắt đầu kế hoạch thả.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="log" className="p-6 mt-0">
                {selectedCycle ? (
                  <PondLogTab pond={pond} cycle={selectedCycle} onUpdate={handleDrawerUpdate} />
                ) : (
                  <p className="text-sm text-muted-foreground">Chọn hoặc tạo chu kỳ để xem nhật ký.</p>
                )}
              </TabsContent>
              <TabsContent value="harvest" className="p-6 mt-0">
                {selectedCycle ? (
                  <PondHarvestTab pond={pond} cycle={selectedCycle} onUpdate={handleDrawerUpdate} isWithdrawal={isWithdrawal} />
                ) : (
                  <p className="text-sm text-muted-foreground">Chọn hoặc tạo chu kỳ để ghi thu hoạch.</p>
                )}
              </TabsContent>
              <TabsContent value="qr" className="p-6 mt-0 flex flex-col items-center">
                <p className="text-xs text-muted-foreground mb-6 text-center">
                  In mã QR này và dán tại ao để quét nhanh khi nhập nhật ký.
                </p>
                <PondQRCode pond={pond} size={220} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {showEdit && (
        <PondEditDialog
          pond={pond}
          canEditCode={isAdmin}
          open={showEdit}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            void handleDrawerUpdate();
            setShowEdit(false);
          }}
          onDeleted={() => {
            onClose();
            void onUpdate?.();
          }}
        />
      )}
    </>
  );
}
