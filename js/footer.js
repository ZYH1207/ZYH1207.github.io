/* Butterfly 页脚美化脚本 - Cole 定制版 */
function updateFooter() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const startTime = new Date("2026-03-10T00:00:00");

    // 1. 更新最上方的版权信息
    const copyrightElement = document.getElementById('copyright_info');
    if (copyrightElement) {
        copyrightElement.innerHTML = `©2026 - ${currentYear} <i class="fa-fw fas fa-star fa-beat" style="color: #ffffff;"></i> By Cole`;
    }

    // 2. 更新中间的运行时间
    const runtimeElement = document.getElementById('runtime_span');
    if (runtimeElement) {
        const diff = now - startTime;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        
        runtimeElement.innerHTML = `本站已运行 <span style="color:#ffffff">${days}</span> 天 <span style="color:#ffffff">${hours}</span> 时 <span style="color:#ffffff">${minutes}</span> 分 <span style="color:#ffffff">${seconds}</span> 秒`;
    }
}

// 启动定时更新
let footerTimer = setInterval(updateFooter, 1000);

// Pjax 适配 (确保切换页面后依然运行)
document.addEventListener('pjax:complete', () => {
    clearInterval(footerTimer);
    updateFooter();
    footerTimer = setInterval(updateFooter, 1000);
});

// 首次执行
updateFooter();