// Добавьте этот обработчик в server.js после других игровых событий

// Перезапуск игры
socket.on('game-restart', ({ roomId, gameType }) => {
    console.log(`Game restart requested: ${gameType} in room ${roomId}`);

    let initialState = null;

    if (gameType === 'tictactoe') {
        initialState = {
            gameType: 'tictactoe',
            board: [['', '', ''], ['', '', ''], ['', '', '']],
            currentPlayer: 'X',
            gameOver: false,
            winner: null,
            players: gameStates.get(roomId)?.players || [],
            gameStarted: true
        };
    } else if (gameType === 'chess') {
        initialState = {
            gameType: 'chess',
            board: [
                ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
                ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
                ['', '', '', '', '', '', '', ''],
                ['', '', '', '', '', '', '', ''],
                ['', '', '', '', '', '', '', ''],
                ['', '', '', '', '', '', '', ''],
                ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
                ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
            ],
            currentPlayer: 'white',
            selectedCell: null,
            check: false,
            checkmate: false,
            players: gameStates.get(roomId)?.players || [],
            gameStarted: true
        };
    }

    if (initialState) {
        gameStates.set(roomId, initialState);
        io.in(roomId).emit('game-state', initialState);
        console.log(`Game restarted: ${gameType} in room ${roomId}`);
    }
});
