// Функция для обновления статуса подключения
function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;

    statusEl.classList.remove('connected', 'disconnected');
    if (connected) {
        statusEl.classList.add('connected');
        statusEl.querySelector('.connection-text').textContent = 'Подключено';
    } else {
        statusEl.classList.add('disconnected');
        statusEl.querySelector('.connection-text').textContent = 'Нет соединения';
    }

    // Обновляем индикатор в заголовке
    if (typeof updateHeaderConnectionStatus === 'function') {
        updateHeaderConnectionStatus();
    }
}
