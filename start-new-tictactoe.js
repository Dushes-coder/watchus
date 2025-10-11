// Добавьте эту функцию в games.js

function startNewTicTacToeGame() {
    console.log('🎮 Starting new TicTacToe game');

    // Сбрасываем флаг инициализации
    window.gameStateInitialized = false;

    // Сбрасываем состояние игры
    window.gameState = {
        ...window.gameState, // Сохраняем players и gameType
        board: [
            ['', '', ''],
            ['', '', ''],
            ['', '', '']
        ],
        currentPlayer: 'X', // Всегда начинается с X
        gameOver: false,
        winner: null
    };

    // Если это сетевая игра, отправляем новый game-state
    if (window.currentOpponent?.type === 'player' && window.socket && window.roomId) {
        window.socket.emit('game-restart', {
            roomId: window.roomId,
            gameType: 'tictactoe'
        });
    }

    // Перерисовываем доску
    renderTicTacToeBoard();

    // Показываем уведомление
    showNotification('🎮 Начата новая игра в крестики-нолики!', 'info');
}
