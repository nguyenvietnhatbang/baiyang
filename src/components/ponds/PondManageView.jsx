import { useState, useEffect, useMemo, useCallback } from 'react';
import { Fish, ClipboardList, ShoppingCart, QrCode, Pencil, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PondPlanTab from './PondPlanTab';
import PondLogTab from './PondLogTab';
import PondHarvestTab from './PondHarvestTab';
import PondQRCode from './PondQRCode';
import PondEditDialog from './PondEditDialog';
import PondStatusBadge from './PondStatusBadge';
import { differenceInDays, parseISO } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { pickActiveCycle } from '@/lib/pondCycleHelpers';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { calendarDaysUntilHarvest, isHarvestDateOnOrBeforeToday } from '@/lib/harvestAlerts';

function cycleLabel(c, idx) {
  if (!c) return '';
  const named = c.name && String(c.name).trim();
  const title = named || (c.stock_date ? `Thả ${c.stock_date}` : `Chu kỳ ${idx + 1}`);
  const parts = [
    title,
    c.status === 'CC' ? '· đang nuôi' : '',
    c.expected_yield != null ? `· ~${Number(c.expected_yield).toLocaleString()} kg` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

export default function PondManageView({
  pond,
  siblingPonds = [],
  activeTab = 'plan',
  onTabChange,
  onUpdate,
  onDeleted,
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canEditThisPond = Boolean(user);
  const today = new Date();
  const [showEdit, setShowEdit] = useState(false);
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [cycleLoadErr, setCycleLoadErr] = useState('');
  const [addingCycle, setAddingCycle] = useState(false);
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [newCycleName, setNewCycleName] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [deleteCycleOpen, setDeleteCycleOpen] = useState(false);
  const [deletingCycle, setDeletingCycle] = useState(false);

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

  const selectedHarvestDate = plannedHarvestDateForDisplay(selectedCycle);
  const harvestDiff = selectedHarvestDate ? calendarDaysUntilHarvest(selectedHarvestDate, today) : null;

  // Kiểm tra xem đã thu hoạch chưa (actual_yield > 0 hoặc harvest_done = true)
  const isHarvested = selectedCycle?.actual_yield > 0 || selectedCycle?.harvest_done;
  
  // Cảnh báo ưu tiên thu: ngày thu dự kiến <= hôm nay, chưa coi là đã thu xong (logic đơn giản trên form)
  const isUrgent = !isHarvested && isHarvestDateOnOrBeforeToday(harvestDiff);

  const handleLocalUpdate = async () => {
    await loadCycles();
    await onUpdate?.();
  };

  const handleCycleStatusChange = async (next) => {
    if (!selectedCycle || !canEditThisPond || next === selectedCycle.status) return;
    setStatusSaving(true);
    setCycleLoadErr('');
    try {
      await base44.entities.PondCycle.update(selectedCycle.id, { status: next });
      await handleLocalUpdate();
    } catch (e) {
      setCycleLoadErr(formatSupabaseError(e));
    }
    setStatusSaving(false);
  };

  const handleConfirmNewCycle = async () => {
    if (!canEditThisPond) return;
    setAddingCycle(true);
    setCycleLoadErr('');
    try {
      const row = await base44.entities.PondCycle.create({
        pond_id: pond.id,
        status: 'CT',
        name: newCycleName.trim() || null,
      });
      setNewCycleOpen(false);
      setNewCycleName('');
      await handleLocalUpdate();
      if (row?.id) setSelectedCycleId(row.id);
    } catch (e) {
      setCycleLoadErr(formatSupabaseError(e));
    }
    setAddingCycle(false);
  };

  const handleDeleteSelectedCycle = async () => {
    if (!selectedCycle || !canEditThisPond) return;
    setDeletingCycle(true);
    setCycleLoadErr('');
    try {
      await base44.entities.PondCycle.delete(selectedCycle.id);
      setDeleteCycleOpen(false);
      await handleLocalUpdate();
    } catch (e) {
      setCycleLoadErr(formatSupabaseError(e));
    }
    setDeletingCycle(false);
  };

  const cycleSelectItems = useMemo(
    () => [
      { value: '__none__', label: '— Chọn chu kỳ —' },
      ...cycles.map((c, i) => ({
        value: String(c.id),
        label: cycleLabel(c, i),
      })),
    ],
    [cycles]
  );

  /** Base UI Select đôi khi in ra `value` (UUID) thay vì nhãn — ép hiển thị bằng text tước tiên. */
  const selectedCycleTriggerLabel = useMemo(() => {
    if (!selectedCycleId) return null;
    const it = cycleSelectItems.find((x) => x.value === String(selectedCycleId));
    if (it?.label) return it.label;
    const idx = cycles.findIndex((c) => String(c.id) === String(selectedCycleId));
    if (idx >= 0) return cycleLabel(cycles[idx], idx);
    return null;
  }, [selectedCycleId, cycleSelectItems, cycles]);

  return (
    <>
      <div className="w-full flex flex-col min-h-0">
        <div className="px-4 sm:px-6 py-4 border-b border-border flex items-start justify-between bg-primary text-primary-foreground rounded-t-xl sm:rounded-t-none">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
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
            <p className="text-primary-foreground/85 text-sm mt-0.5">
              {pond.owner_name} • {pond.area} m²
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="text-primary-foreground/75 hover:text-primary-foreground transition-colors p-1 rounded shrink-0"
            title="Chỉnh sửa / Xóa ao"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-3 border-b border-border bg-muted/30 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Chu kỳ thả / kế hoạch
              </p>
              <Select
                modal={false}
                value={selectedCycleId ? String(selectedCycleId) : '__none__'}
                onValueChange={(v) => setSelectedCycleId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="Chọn chu kỳ">
                    {selectedCycleId
                      ? (selectedCycleTriggerLabel ?? 'Đang tải chu kỳ…')
                      : undefined}
                  </SelectValue>
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
                onClick={() => {
                  setNewCycleName('');
                  setNewCycleOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Chu kỳ mới
              </Button>
            )}
          </div>

          {selectedCycle && canEditThisPond && (
            <div className="flex flex-col sm:flex-row sm:items-end gap-2 border-t border-border/60 mt-2 pt-3">
              <div className="flex-1 min-w-0 sm:max-w-[22rem]">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Trạng thái chu kỳ đang chọn
                </p>
                <Select
                  modal={false}
                  disabled={statusSaving}
                  value={selectedCycle.status}
                  onValueChange={(v) => void handleCycleStatusChange(v)}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CC">CC — Có cá / đang nuôi</SelectItem>
                    <SelectItem value="CT">CT — Chưa thả / quay vòng</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                  Mỗi ao chỉ một chu kỳ <strong>CC</strong>. Chọn CC ở đây sẽ tự chuyển các chu kỳ CC khác trên ao sang{' '}
                  <strong>CT</strong>.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="sm:ml-auto text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => setDeleteCycleOpen(true)}
                disabled={statusSaving || deletingCycle}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Xóa chu kỳ
              </Button>
            </div>
          )}

          {selectedCycle && !canEditThisPond && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Trạng thái chu kỳ
              </span>
              <PondStatusBadge status={selectedCycle.status} />
            </div>
          )}

          {cycleLoadErr && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{cycleLoadErr}</p>
          )}
        </div>

        {isWithdrawal && selectedCycle?.withdrawal_end_date && (
          <div className="px-4 sm:px-6 py-2 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <p className="text-xs text-orange-700 font-medium">
              Còn {differenceInDays(parseISO(selectedCycle.withdrawal_end_date), today)} ngày ngưng thuốc. Hết ngưng:{' '}
              {selectedCycle.withdrawal_end_date}. Chưa được lên lịch thu hoạch.
            </p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 sm:px-6 pt-3 border-b border-border bg-card">
            <TabsList className="bg-muted flex-wrap h-auto gap-1 py-1">
              <TabsTrigger value="plan" className="flex items-center gap-1.5 text-xs">
                <Fish className="w-3.5 h-3.5" />
                Kế hoạch
              </TabsTrigger>
              <TabsTrigger value="log" className="flex items-center gap-1.5 text-xs">
                <ClipboardList className="w-3.5 h-3.5" />
                Nhật ký
              </TabsTrigger>
              <TabsTrigger value="harvest" className="flex items-center gap-1.5 text-xs">
                <ShoppingCart className="w-3.5 h-3.5" />
                Thu hoạch
              </TabsTrigger>
              <TabsTrigger value="qr" className="flex items-center gap-1.5 text-xs">
                <QrCode className="w-3.5 h-3.5" />
                Mã QR
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto min-h-[50vh]">
            <TabsContent value="plan" className="p-4 sm:p-6 mt-0">
              {selectedCycle ? (
                <PondPlanTab
                  pond={pond}
                  cycle={selectedCycle}
                  onUpdate={handleLocalUpdate}
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
            <TabsContent value="log" className="p-4 sm:p-6 mt-0">
              {selectedCycle ? (
                <PondLogTab pond={pond} cycle={selectedCycle} onUpdate={handleLocalUpdate} />
              ) : (
                <p className="text-sm text-muted-foreground">Chọn hoặc tạo chu kỳ để xem nhật ký.</p>
              )}
            </TabsContent>
            <TabsContent value="harvest" className="p-4 sm:p-6 mt-0">
              {selectedCycle ? (
                <PondHarvestTab
                  pond={pond}
                  cycle={selectedCycle}
                  onUpdate={handleLocalUpdate}
                  isWithdrawal={isWithdrawal}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Chọn hoặc tạo chu kỳ để ghi thu hoạch.</p>
              )}
            </TabsContent>
            <TabsContent value="qr" className="p-4 sm:p-6 mt-0 flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-6 text-center">
                In mã QR này và dán tại ao để quét nhanh khi nhập nhật ký.
              </p>
              <PondQRCode pond={pond} size={220} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <Dialog open={newCycleOpen} onOpenChange={setNewCycleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo chu kỳ mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Tên chu kỳ</Label>
              <Input
                className="mt-1"
                placeholder="Ví dụ: Thả tháng 3/2026"
                value={newCycleName}
                onChange={(e) => setNewCycleName(e.target.value)}
                disabled={addingCycle}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Có thể đổi sau trong tab Kế hoạch.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setNewCycleOpen(false)} disabled={addingCycle}>
              Hủy
            </Button>
            <Button type="button" onClick={() => void handleConfirmNewCycle()} disabled={addingCycle}>
              {addingCycle ? 'Đang tạo…' : 'Tạo chu kỳ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteCycleOpen} onOpenChange={setDeleteCycleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa chu kỳ này?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Bạn sắp xóa chu kỳ <strong className="text-foreground">{selectedCycleTriggerLabel || 'đang chọn'}</strong>.
            </p>
            <p>Nhật ký và phiếu thu hoạch gắn với chu kỳ này sẽ bị xóa theo.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteCycleOpen(false)} disabled={deletingCycle}>
              Hủy
            </Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => void handleDeleteSelectedCycle()}
              disabled={deletingCycle}
            >
              {deletingCycle ? 'Đang xóa…' : 'Xóa chu kỳ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showEdit && (
        <PondEditDialog
          pond={pond}
          canEditCode={isAdmin}
          open={showEdit}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            void handleLocalUpdate();
            setShowEdit(false);
          }}
          onDeleted={() => {
            onDeleted?.();
          }}
        />
      )}
    </>
  );
}
