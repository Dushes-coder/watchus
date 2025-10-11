// ИСПРАВЛЕННЫЕ обработчики сетевых игр
// Замените блок "Обработчики для сетевых игр" в games.js на этот код

// Обработчики для сетевых игр
if (window.socket) {
    window.socket.on('game-started', ({ gameType, players, roomId }) => {
        console.log('🎮 Network game started:', gameType, 'in room:', roomId);
        window.currentGame = gameType;
        window.gameState = {
            gameType: gameType,
            players: players,
            currentPlayer: 0,
            gameStarted: true
        };

        console.log('👥 Game started with players:', players);

        // НЕ вызываем initNetworkTicTacToe здесь - подождем game-state
    });

    window.socket.on('game-state', (state) => {
        console.log('📊 Received game-state:', state);
        window.gameState = state;

        // Теперь инициализируем игру когда состояние получено
        if (state.gameType === 'tictactoe' && !window.gameStateInitialized) {
            window.gameStateInitialized = true;
            console.log('🎯 Initializing TicTacToe with players:', state.players);
            initNetworkTicTacToe();
        } else if (state.gameType === 'chess' && !window.gameStateInitialized) {
            window.gameStateInitialized = true;
            initNetworkChess();
        } else if (state.gameType === 'poker' && !window.gameStateInitialized) {
            window.gameStateInitialized = true;
            initNetworkPoker();
        } else if (state.gameType === 'cards' && !window.gameStateInitialized) {
            window.gameStateInitialized = true;
            initNetworkCards();
        }

        // Обновляем отображение для всех игр
        if (state.gameType === 'tictactoe') {
            renderTicTacToeBoard();
        } else if (state.gameType === 'chess') {
            renderChessBoard();
        }
    });

    window.socket.on('game-move', ({ gameType, move, playerId }) => {
        console.log('🏃 Received game move:', move, 'from player:', playerId);

        // Обновляем состояние игры и перерисовываем
        if (gameType === 'tictactoe') {
            handleNetworkTicTacToeMove(move);
        } else if (gameType === 'chess') {
            handleNetworkChessMove(move);
        } else if (gameType === 'poker') {
            handleNetworkPokerMove(move);
        } else if (gameType === 'cards') {
            handleNetworkCardsMove(move);
        }
    });

    window.socket.on('game-ended', ({ winner, gameType }) => {
        console.log('🏁 Game ended, winner:', winner);
        window.gameState.gameOver = true;
        window.gameState.winner = winner;

        // Показываем сообщение о завершении
        if (gameType === 'tictactoe') {
            updateTicTacToeStatus();
        } else if (gameType === 'chess') {
            updateChessStatus();
        } else if (gameType === 'poker') {
            window.gameState.gamePhase = 'finished';
            window.gameState.winner = winner;
            renderPokerGame();
        }
    });
}
