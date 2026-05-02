// Script này cần chạy trong môi trường React với cấu hình import đúng
// Để chạy script, cần đảm bảo môi trường Node.js có thể resolve import alias

console.log('⚠️ Script này cần chạy trong môi trường React với cấu hình Vite');
console.log('Để đồng bộ hóa dữ liệu, vui lòng:');
console.log('1. Mở trình duyệt và đăng nhập vào ứng dụng');
console.log('2. Mở DevTools (F12)');
console.log('3. Dán đoạn code sau vào Console:');
console.log(`
(async () => {
  const { syncPondCyclesWithHarvests } = await import('/src/lib/pondCycleSync.js');
  await syncPondCyclesWithHarvests();
})();
`);

async function main() {
  console.log('🚀 Bắt đầu đồng bộ hóa dữ liệu PondCycle với HarvestRecord...\n');
  
  try {
    const result = await syncPondCyclesWithHarvests();
    
    console.log('\n✅ Đồng bộ hóa hoàn tất!');
    console.log(`📊 Tổng số chu kỳ: ${result.totalCycles}`);
    console.log(`🔄 Đã cập nhật: ${result.updatedCount}`);
    
    if (result.updatedCount > 0) {
      console.log('\n💡 Các thay đổi đã được áp dụng:');
      console.log('- actual_yield được cập nhật từ tổng HarvestRecord');
      console.log('- FCR được tính toán lại dựa trên total_feed_used và actual_yield');
      console.log('- harvest_done được cập nhật nếu có actual_yield > 0');
      console.log('- status được chuyển thành CT nếu đã thu hoạch');
    } else {
      console.log('\nℹ️ Không có thay đổi nào cần thiết, dữ liệu đã đồng bộ.');
    }
    
  } catch (error) {
    console.error('\n❌ Lỗi khi đồng bộ hóa:', error.message);
    process.exit(1);
  }
}

main();