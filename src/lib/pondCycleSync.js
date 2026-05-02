import { base44 } from '@/api/base44Client';
import { computeFcr } from '@/lib/fcr';

/**
 * Đồng bộ hóa dữ liệu giữa HarvestRecord và PondCycle
 * - Tính tổng actual_yield từ HarvestRecord cho mỗi PondCycle
 * - Tính toán FCR dựa trên total_feed_used và actual_yield
 * - Cập nhật harvest_done và status
 */
export async function syncPondCyclesWithHarvests() {
  try {
    console.log('Bắt đầu đồng bộ hóa PondCycle với HarvestRecord...');
    
    // Lấy tất cả PondCycle
    const allCycles = await base44.entities.PondCycle.list('-updated_date', 1000);
    console.log(`Tìm thấy ${allCycles.length} chu kỳ`);
    
    // Lấy tất cả HarvestRecord
    const allHarvests = await base44.entities.HarvestRecord.list('-harvest_date', 1000);
    console.log(`Tìm thấy ${allHarvests.length} bản ghi thu hoạch`);
    
    let updatedCount = 0;
    
    // Xử lý từng chu kỳ
    for (const cycle of allCycles) {
      // Tìm tất cả harvest records cho chu kỳ này
      const cycleHarvests = allHarvests.filter(h => 
        h.pond_cycle_id === cycle.id || 
        (h.pond_id && h.pond_id === cycle.pond_id)
      );
      
      // Tính tổng actual_yield
      const totalActualYield = cycleHarvests.reduce((sum, h) => sum + (h.actual_yield || 0), 0);
      
      // Tính FCR nếu có total_feed_used
      let fcr = cycle.fcr;
      if (cycle.total_feed_used && totalActualYield > 0) {
        fcr = computeFcr(cycle.total_feed_used, totalActualYield);
      }
      
      // Xác định status
      const newStatus = totalActualYield > 0 ? 'CT' : cycle.status;
      
      // Kiểm tra xem có cần cập nhật không
      const needsUpdate = 
        cycle.actual_yield !== totalActualYield ||
        cycle.fcr !== fcr ||
        cycle.harvest_done !== (totalActualYield > 0) ||
        cycle.status !== newStatus;
      
      if (needsUpdate) {
        await base44.entities.PondCycle.update(cycle.id, {
          actual_yield: totalActualYield,
          harvest_done: totalActualYield > 0,
          fcr: fcr,
          status: newStatus,
        });
        updatedCount++;
        console.log(`Đã cập nhật chu kỳ ${cycle.id}: actual_yield=${totalActualYield}, fcr=${fcr}`);
      }
    }
    
    console.log(`Hoàn thành đồng bộ hóa. Đã cập nhật ${updatedCount}/${allCycles.length} chu kỳ`);
    return { totalCycles: allCycles.length, updatedCount };
    
  } catch (error) {
    console.error('Lỗi khi đồng bộ hóa PondCycle:', error);
    throw error;
  }
}

/**
 * Tính toán lại FCR cho một chu kỳ cụ thể
 */
export async function recalculateFcrForCycle(cycleId) {
  try {
    const cycle = await base44.entities.PondCycle.get(cycleId);
    if (!cycle) {
      throw new Error(`Không tìm thấy chu kỳ ${cycleId}`);
    }
    
    // Lấy harvest records cho chu kỳ này
    const harvests = await base44.entities.HarvestRecord.filter({ pond_cycle_id: cycleId });
    const totalActualYield = harvests.reduce((sum, h) => sum + (h.actual_yield || 0), 0);
    
    // Tính FCR
    let fcr = null;
    if (cycle.total_feed_used && totalActualYield > 0) {
      fcr = computeFcr(cycle.total_feed_used, totalActualYield);
    }
    
    // Cập nhật
    await base44.entities.PondCycle.update(cycleId, {
      actual_yield: totalActualYield,
      harvest_done: totalActualYield > 0,
      fcr: fcr,
      status: totalActualYield > 0 ? 'CT' : cycle.status,
    });
    
    return { cycleId, actual_yield: totalActualYield, fcr };
    
  } catch (error) {
    console.error(`Lỗi khi tính toán lại FCR cho chu kỳ ${cycleId}:`, error);
    throw error;
  }
}