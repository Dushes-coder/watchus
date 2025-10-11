// ИСПРАВЛЕННАЯ функция handleTicTacToeCellClick с проверкой хода
// Замените старую функцию на эту

function handleTicTacToeCellClick(e) {
    console.log('🔍 TicTacToe cell clicked:', {
        gameOver: window.gameState?.gameOver,
        currentPlayer: window.gameState?.currentPlayer,
        mySymbol: window.mySymbol,
        opponentSymbol: window.opponentSymbol,
        opponentType: window.currentOpponent?.type,
        isNetworkGame: window.currentOpponent?.type === 'player'
    });

    if (window.gameState?.gameOver) {
        console.log('❌ Game is over, ignoring click');
        return;
    }

    // Проверяем, что сейчас ход этого игрока (только для сетевых игр)
    if (window.currentOpponent?.type === 'player') {
        if (!window.mySymbol) {
            console.error('❌ mySymbol not defined! Cannot determine player turn.');
            console.log('Available data:', {
                gamePlayerMapping: window.gamePlayerMapping,
                socketId: window.socket?.id,
                gameState: window.gameState
            });
            showNotification('Ошибка: невозможно определить ход игрока', 'error');
            return;
        }

        if (window.gameState.currentPlayer !== window.mySymbol) {
            console.log('⛔ Not your turn! Current player:', window.gameState.currentPlayer, 'Your symbol:', window.mySymbol);
            showNotification('Сейчас ход соперника!', 'warning');
            return;
        }

        console.log('✅ Your turn confirmed, making move...');
    }

    const cell = e.target.closest('.ttt-cell');
    if (!cell) {
        console.log('❌ No cell found');
        return;
    }

    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    console.log('📍 Cell coordinates:', { row, col, currentValue: window.gameState.board?.[row]?.[col] });

    if (window.gameState.board[row][col] === '') {
        // Отправляем ход на сервер только если играем с игроком
        if (window.socket && window.roomId && window.currentOpponent?.type === 'player') {
            console.log('📤 Sending move to server:', { row, col, player: window.gameState.currentPlayer });
            window.socket.emit('game-move', {
                roomId: window.roomId,
                gameType: 'tictactoe',
                move: {
                    row,
                    col,
                    player: window.gameState.currentPlayer
                }
            });
        } else {
            // Локальная игра без сервера или с ботом
            console.log('🏠 Local game move:', { row, col, player: window.gameState.currentPlayer });
            window.gameState.board[row][col] = window.gameState.currentPlayer;
            window.gameState.currentPlayer = window.gameState.currentPlayer === 'X' ? 'O' : 'X';
            checkTicTacToeWinner();
            renderTicTacToeBoard();

            // Если играем с ботом и игра не окончена, делаем ход бота
            if (window.currentOpponent?.type === 'bot' && !window.gameState.gameOver) {
                setTimeout(() => {
                    makeBotMove();
                }, 500);
            }
        }
    } else {
        console.log('🚫 Cell already occupied');
    }
}
