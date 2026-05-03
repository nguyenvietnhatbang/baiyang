/**
 * Hàm tính sản lượng chung cho cả hệ thống
 * Đảm bảo tính nhất quán giữa các báo cáo
 */

/**
 * Tính sản lượng dự kiến từ tổng cá, tỷ lệ sống và trọng lượng mục tiêu
 * @param {number} totalFish - Tổng số cá
 * @param {number} survivalRate - Tỷ lệ sống (%)
 * @param {number} targetWeight - Trọng lượng mục tiêu (g)
 * @returns {number} Sản lượng tính bằng kg
 */
export function calculateYield(totalFish, survivalRate, targetWeight) {
  if (!totalFish || !survivalRate || !targetWeight) return 0;
  return Math.round((totalFish * (survivalRate / 100) * targetWeight) / 1000);
}

/**
 * Tính sản lượng từ đối tượng pond/cycle
 * @param {object} pond - Đối tượng ao/chu kỳ
 * @returns {number} Sản lượng tính bằng kg
 */
export function calculateYieldFromPond(pond) {
  if (!pond) return 0;
  return calculateYield(pond.total_fish, pond.survival_rate, pond.target_weight);
}

/**
 * Tính sản lượng hiện tại từ current_fish
 * @param {object} cycle - Đối tượng chu kỳ
 * @returns {number} Sản lượng tính bằng kg
 */
export function calculateCurrentYield(cycle) {
  if (!cycle) return 0;
  return calculateYield(cycle.current_fish, cycle.survival_rate, cycle.target_weight);
}