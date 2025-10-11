// ИСПРАВЛЕННАЯ функция initNetworkTicTacToe
// Замените старую функцию на эту

function initNetworkTicTacToe() {
    console.log('🎯 initNetworkTicTacToe called with gameState:', window.gameState);

    // Определяем mapping игроков
    const currentPlayerId = window.socket?.id;
    const opponentId = window.currentOpponent?.id;

    // players может быть массивом socket.id строк
    let players = window.gameState.players || [];
    console.log('👥 Players array:', players);

    // Если players - массив строк, конвертируем в объекты
    if (players.length > 0 && typeof players[0] === 'string') {
        // Это массив socket.id - преобразуем в объекты для совместимости
        players = players.map(id => ({ id, name: `Игрок ${id.slice(0, 4)}`, emoji: '👤' }));
    }

    // Первый игрок в массиве ходит за 'X', второй за 'O'
    const firstPlayerId = players[0]?.id;
    const secondPlayerId = players[1]?.id;

    console.log('🔄 Player mapping:', {
        firstPlayerId,
        secondPlayerId,
        currentPlayerId,
        opponentId
    });

    // Определяем символы для игроков
    window.gamePlayerMapping = {
        [firstPlayerId]: 'X',
        [secondPlayerId]: 'O'
    };

    // Определяем, за кого играет текущий игрок
    window.mySymbol = window.gamePlayerMapping[currentPlayerId];
    window.opponentSymbol = window.gamePlayerMapping[opponentId];

    console.log('✅ Network TicTacToe initialized:', {
        mySymbol: window.mySymbol,
        opponentSymbol: window.opponentSymbol,
        currentPlayerId,
        opponentId,
        mapping: window.gamePlayerMapping,
        players: players
    });

    window.gameState = {
        ...window.gameState, // Сохраняем уже установленные свойства
        board: [
            ['', '', ''],
            ['', '', ''],
            ['', '', '']
        ],
        currentPlayer: 'X', // Всегда начинается с X
        gameOver: false,
        winner: null,
        gameType: 'tictactoe'
    };

    renderTicTacToeBoard();
}
