/**
 * Hàm đồng bộ hóa HarvestRecord với PondCycle
 * Đảm bảo tính nhất quán dữ liệu khi tạo/xóa HarvestRecord
 */

import { base44 } from '@/api/base44Client';

/**
 * Tạo HarvestRecord và tự động đồng bộ với PondCycle
 * @param {object} data - Dữ liệu HarvestRecord
 * @returns {Promise<object>} HarvestRecord đã tạo
 */
export async function createHarvestRecordWithSync(data) {
  if (!data.pond_cycle_id) {
    throw new Error('Thiếu pond_cycle_id để đồng bộ với PondCycle');
  }

  // 1. Tạo HarvestRecord
  const harvest = await base44.entities.HarvestRecord.create(data);
  
  // 2. Đồng bộ với PondCycle
  await syncPondCycleWithHarvests(data.pond_cycle_id);
  
  return harvest;
}

/**
 * Xóa HarvestRecord và tự động đồng bộ với PondCycle
 * @param {string} harvestId - ID của HarvestRecord cần xóa
 * @param {string} pondCycleId - ID của PondCycle
 * @returns {Promise<void>}
 */
export async function deleteHarvestRecordWithSync(harvestId, pondCycleId) {
  // 1. Xóa HarvestRecord
  await base44.entities.HarvestRecord.delete(harvestId);
  
  // 2. Đồng bộ với PondCycle
  await syncPondCycleWithHarvests(pondCycleId);
}

/**
 * Đồng bộ PondCycle với tổng harvest records
 * @param {string} pondCycleId - ID của PondCycle
 * @returns {Promise<void>}
 */
export async function syncPondCycleWithHarvests(pondCycleId) {
  // Lấy tất cả harvest records của chu kỳ
  const allHarvests = await base44.entities.HarvestRecord.filter({ pond_cycle_id: pondCycleId });
  const totalActualYield = allHarvests.reduce((sum, h) => sum + (h.actual_yield || 0), 0);
  
  // Lấy thông tin PondCycle
  const cycle = await base44.entities.PondCycle.get(pondCycleId);
  if (!cycle) {
    throw new Error(`Không tìm thấy PondCycle với ID: ${pondCycleId}`);
  }
  
  // Tính FCR nếu có total_feed_used
  let fcr = null;
  if (cycle.total_feed_used && totalActualYield > 0) {
    fcr = Math.round((cycle.total_feed_used / totalActualYield) * 100) / 100;
  }
  
  // Xác định trạng thái
  const isHarvested = totalActualYield > 0;
  
  // Cập nhật PondCycle với retry logic
  let retries = 3;
  let lastError = null;
  
  while (retries > 0) {
    try {
      await base44.entities.PondCycle.update(pondCycleId, {
        actual_yield: totalActualYield,
        harvest_done: isHarvested,
        status: isHarvested ? 'CT' : cycle.status,
        fcr: fcr,
        ...(isHarvested ? { current_fish: 0 } : {}),
      });
      return; // Thành công
    } catch (e) {
      lastError = e;
      retries--;
      if (retries > 0) {
        console.warn(`Lỗi cập nhật PondCycle, thử lại... (còn ${retries} lần)`, e);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  
  throw new Error(`Không thể cập nhật PondCycle sau 3 lần thử: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Kiểm tra và sửa tính nhất quán giữa HarvestRecord và PondCycle
 * @param {string} pondCycleId - ID của PondCycle
 * @returns {Promise<{fixed: boolean, issues: string[]}>}
 */
export async function checkAndFixHarvestConsistency(pondCycleId) {
  const issues = [];
  
  // Lấy PondCycle
  const cycle = await base44.entities.PondCycle.get(pondCycleId);
  if (!cycle) {
    return { fixed: false, issues: [`Không tìm thấy PondCycle: ${pondCycleId}`] };
  }
  
  // Lấy tất cả harvest records
  const allHarvests = await base44.entities.HarvestRecord.filter({ pond_cycle_id: pondCycleId });
  const totalActualYield = allHarvests.reduce((sum, h) => sum + (h.actual_yield || 0), 0);
  
  // Kiểm tra 1: actual_yield có khớp không
  if (cycle.actual_yield !== totalActualYield) {
    issues.push(`actual_yield không khớp: PondCycle=${cycle.actual_yield}, HarvestRecords=${totalActualYield}`);
  }
  
  // Kiểm tra 2: harvest_done có đúng không
  const expectedHarvestDone = totalActualYield > 0;
  if (cycle.harvest_done !== expectedHarvestDone) {
    issues.push(`harvest_done không đúng: ${cycle.harvest_done} (expected: ${expectedHarvestDone})`);
  }
  
  // Kiểm tra 3: status có đúng không
  const expectedStatus = totalActualYield > 0 ? 'CT' : cycle.status;
  if (cycle.status !== expectedStatus && cycle.status !== 'CC') {
    issues.push(`status không đúng: ${cycle.status} (expected: ${expectedStatus})`);
  }
  
  // Nếu có vấn đề, tự động sửa
  if (issues.length > 0) {
    console.log(`Phát hiện ${issues.length} vấn đề với PondCycle ${pondCycleId}, đang sửa...`);
    await syncPondCycleWithHarvests(pondCycleId);
    return { fixed: true, issues };
  }
  
  return { fixed: false, issues: [] };
}