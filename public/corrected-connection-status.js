// Функция для обновления статуса подключения - ИСПРАВЛЕННАЯ ВЕРСИЯ
function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    const indicatorEl = document.querySelector('.connection-indicator');

    if (!statusEl || !indicatorEl) return;

    // Очищаем все классы
    statusEl.classList.remove('connected', 'disconnected');
    indicatorEl.classList.remove('connected', 'disconnected');

    if (connected) {
        statusEl.classList.add('connected');
        indicatorEl.classList.add('connected');
        statusEl.querySelector('.connection-text').textContent = 'Подключено';
    } else {
        statusEl.classList.add('disconnected');
        indicatorEl.classList.add('disconnected');
        statusEl.querySelector('.connection-text').textContent = 'Нет соединения';
    }
}
