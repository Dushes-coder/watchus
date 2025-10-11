// ИСПРАВЛЕННАЯ функция renderTicTacToeBoard с визуальной индикацией и блокировкой
function renderTicTacToeBoard() {
    // Инициализируем счётчики, если их ещё нет
    if (!window.tttScore) {
        window.tttScore = { X: 0, O: 0, draws: 0 };
    }

    let html = '';

    // Информация о сопернике
    if (window.currentOpponent) {
        html += '<div class="game-opponent-info">';
        html += '<div class="opponent-avatar-small">' + window.currentOpponent.emoji + '</div>';
        html += '<div class="opponent-name-small">' + window.currentOpponent.name + '</div>';
        html += '<div class="opponent-type">' + (window.currentOpponent.type === 'bot' ? 'Бот' : 'Игрок') + '</div>';
        html += '</div>';
    }

    // Статус игры с индикацией хода
    html += '<div class="game-status">';
    if (window.gameState.gameOver) {
        if (window.gameState.winner === 'draw') {
            html += '<span style="color: #ffc107; font-weight: bold;">🤝 Ничья!</span>';
        } else {
            const winnerColor = window.gameState.winner === 'X' ? 'var(--accent-primary)' : '#dc3545';
            html += `🏆 Победитель: <span style="color: ${winnerColor}; font-weight: bold;">${window.gameState.winner}</span>!`;
        }
    } else {
        // Показываем чей ход с визуальной индикацией
        const currentPlayerColor = window.gameState.currentPlayer === 'X' ? 'var(--accent-primary)' : '#dc3545';
        const currentPlayerSymbol = window.gameState.currentPlayer;

        // Для сетевых игр показываем дополнительную информацию
        if (window.currentOpponent?.type === 'player') {
            const isMyTurn = window.mySymbol === window.gameState.currentPlayer;
            const turnIndicator = isMyTurn ? '🟢 Ваш ход' : '🔴 Ход соперника';
            const turnColor = isMyTurn ? '#28a745' : '#dc3545';

            html += `<div style="display: flex; align-items: center; gap: 10px;">`;
            html += `<span style="color: ${turnColor}; font-weight: bold; font-size: 18px;">${turnIndicator}</span>`;
            html += `<span style="color: ${currentPlayerColor}; font-weight: bold;">Ходит: ${currentPlayerSymbol}</span>`;
            html += `</div>`;
        } else {
            html += `Ход: <span style="color: ${currentPlayerColor}; font-weight: bold;">${currentPlayerSymbol}</span>`;
        }
    }
    html += '</div>';

    // Счёт игры
    html += '<div class="score-display">';
    html += '<div class="score-item"><span style="color: var(--accent-primary); font-weight: bold;">X</span>: ' + window.tttScore.X + '</div>';
    html += '<div class="score-item"><span style="color: #dc3545; font-weight: bold;">O</span>: ' + window.tttScore.O + '</div>';
    html += '<div class="score-item">Ничьи: ' + window.tttScore.draws + '</div>';
    html += '</div>';

    // Доска с блокировкой интерфейса
    const isNetworkGame = window.currentOpponent?.type === 'player';
    const isMyTurn = isNetworkGame ? window.mySymbol === window.gameState.currentPlayer : true;
    const boardDisabled = isNetworkGame && !isMyTurn && !window.gameState.gameOver;

    html += '<div class="ttt-container' + (boardDisabled ? ' disabled' : '') + '">';
    if (boardDisabled) {
        html += '<div class="game-overlay">🔒 Ожидание хода соперника...</div>';
    }

    html += '<div class="ttt-board" id="tttBoard">';

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const cellValue = window.gameState.board[row][col];
            const isEmpty = cellValue === '';
            const cellClass = isEmpty ? 'empty' : (cellValue === 'X' ? 'x-cell' : 'o-cell');

            html += '<div class="ttt-cell ' + cellClass + '" data-row="' + row + '" data-col="' + col + '"';

            // Блокируем клики если не наш ход в сетевой игре
            if (boardDisabled) {
                html += ' style="pointer-events: none; opacity: 0.6;"';
            }

            html += '>';

            if (!isEmpty) {
                html += '<span class="ttt-symbol">' + cellValue + '</span>';
            }

            html += '</div>';
        }
    }

    html += '</div>';
    html += '</div>';

    html += '<div class="game-controls">';
    html += '<button onclick="closeGame()">Закрыть</button>';
    html += '</div>';

    const gamePanel = document.getElementById('activeGameContent');
    gamePanel.innerHTML = html;

    // Добавляем обработчики событий только если наш ход
    if (!boardDisabled) {
        const cells = document.querySelectorAll('.ttt-cell');
        cells.forEach(cell => {
            cell.addEventListener('click', handleTicTacToeCellClick);
        });
    }

    updateTicTacToeStatus();
}
