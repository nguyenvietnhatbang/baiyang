/** FCR: tổng thức ăn / tổng sản lượng thu hoạch thực tế (kg). */
export function computeFcr(totalFeedKg, totalHarvestedKg) {
  if (totalHarvestedKg == null || totalHarvestedKg <= 0) return null;
  if (totalFeedKg == null || totalFeedKg < 0) return null;
  return Math.round((Number(totalFeedKg) / Number(totalHarvestedKg)) * 10000) / 10000;
}
