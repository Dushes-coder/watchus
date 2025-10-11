// Game State
// Используем существующие переменные из client.js через window: window.socket, window.roomId
// Убираем ESM-импорты — скрипт подключается обычным тегом <script>.

// Проверяем, есть ли ожидающее приглашение после загрузки games.js
if (window.pendingInvitation) {
    console.log('Processing pending invitation:', window.pendingInvitation);
    showGameInvitation(window.pendingInvitation);
    window.pendingInvitation = null;
}

// Инициализация глобального состояния игры
if (!window.gameState) {
    window.gameState = {
        gameMode: null,
        board: null,
        currentPlayer: 'white',
        selectedCell: null,
        checkmate: false,
        deck: [],
        playerHand: [],
        opponentHand: [],
        attackingCards: [],
        defendingCards: [],
        trumpSuit: null,
        gamePhase: 'attack',
        currentAttacker: 'player'
    };
}

// Глобальное состояние игроков в комнате
window.roomPlayers = [];
window.currentOpponent = null;
window.gameInvitations = {};

// Функция для обновления списка участников комнаты
function updateParticipantsList() {
    const participantsList = document.getElementById('participantsList');
    const participantCount = document.getElementById('participantCount');

    if (!participantsList || !participantCount) return;

    if (!window.roomPlayers || window.roomPlayers.length === 0) {
        participantsList.innerHTML = `
            <div class="no-participants">
                <div class="no-participants-icon">👤</div>
                <div class="no-participants-text">Нет участников</div>
            </div>
        `;
        participantCount.textContent = '(0)';
        return;
    }

    // Сортируем участников: текущий пользователь первым
    const sortedPlayers = [...window.roomPlayers].sort((a, b) => {
        const isCurrentA = a.id === (window.socket?.id || 'self');
        const isCurrentB = b.id === (window.socket?.id || 'self');
        if (isCurrentA && !isCurrentB) return -1;
        if (!isCurrentA && isCurrentB) return 1;
        return 0;
    });

    let html = '';
    sortedPlayers.forEach(player => {
        const isCurrentUser = player.id === (window.socket?.id || 'self');
        const statusClass = isCurrentUser ? 'current-user' : 'other-user';
        const statusText = isCurrentUser ? 'Вы' : 'Онлайн';

        html += `
            <div class="participant-item ${statusClass}">
                <div class="participant-avatar">${player.emoji || '👤'}</div>
                <div class="participant-info">
                    <div class="participant-name">${player.name || 'Игрок'}</div>
                    <div class="participant-status">${statusText}</div>
                </div>
                ${isCurrentUser ? '<div class="current-user-indicator">👑</div>' : ''}
            </div>
        `;
    });

    participantsList.innerHTML = html;
    participantCount.textContent = `(${window.roomPlayers.length})`;
}

// Значки для шахмат, если не определены
if (!window.chessPieces) {
    window.chessPieces = {
        white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
        black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    };
}

// Функция для получения списка игроков в комнате
function updateRoomPlayers() {
    if (window.socket && window.roomId) {
        window.socket.emit('get-room-players', { roomId: window.roomId });
    }
}

// Функция для инициализации обработчиков приглашений
function initializeGameInvitations() {
    if (!window.socket) {
        console.log('🎮 games.js: Socket not ready, waiting...');
        // Ждем пока socket инициализируется
        setTimeout(initializeGameInvitations, 100);
        return;
    }

    console.log('🎮 games.js: Socket found, registering event handlers...');

    window.socket.on('room-players', (players) => {
        console.log('👥 games.js: Room players received:', players);
        window.roomPlayers = players || [];
        updateParticipantsList();
        updateOpponentSelector();
    });

    window.socket.on('game-invitation', (data) => {
        console.log('📨 games.js: Game invitation received:', data);
        console.log('📨 games.js: Calling showGameInvitation...');
        showGameInvitation(data);
    });

    window.socket.on('game-invitation-response', (data) => {
        console.log('📬 games.js: Game invitation response received:', data);
        handleInvitationResponse(data);
    });

    // Обработчики для сетевых игр
    window.socket.on('game-started', ({ gameType, players, roomId }) => {
        console.log('Network game started:', gameType, 'in room:', roomId);
        window.currentGame = gameType;
        window.gameState = {
            gameType: gameType,
            players: players,
            currentPlayer: 0,
            gameStarted: true
        };

        // Запускаем соответствующую игру
        switch (gameType) {
            case 'tictactoe':
                initNetworkTicTacToe();
                break;
            case 'chess':
                initNetworkChess();
                break;
            case 'poker':
                initNetworkPoker();
                break;
            case 'cards':
                initNetworkCards();
                break;
        }
    });

    window.socket.on('game-move', ({ gameType, move, playerId }) => {
        console.log('Received game move:', move, 'from player:', playerId);

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
        console.log('Game ended, winner:', winner);
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

    console.log('✅ games.js: All event handlers registered!');
}

// Запускаем инициализацию при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎮 games.js: DOM loaded, initializing...');
    initializeGameInvitations();
});

// Также пытаемся инициализировать сразу, на случай если DOM уже загружен
if (document.readyState === 'loading') {
    // DOM еще загружается, ждем события
} else {
    // DOM уже загружен
    console.log('🎮 games.js: DOM already loaded, initializing...');
    initializeGameInvitations();
}

// Инициализация состояния панелей после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, была ли активная игра закрыта пользователем
    const activeGameClosed = localStorage.getItem('wt_active_game_closed') === 'true';
    console.log('Active game was closed by user:', activeGameClosed);

    // Скрываем активную игру, если она была закрыта
    if (activeGameClosed) {
        const panel = document.getElementById('activeGamePanel');
        if (panel) {
            panel.classList.add('hidden');
            panel.style.display = 'none';
            console.log('Hiding active game panel on page load');
        }
    }

    // Инициализируем состояние панели игр
    const panel = document.getElementById('gamesPanel');
    if (panel) {
        try {
            const isMobile = window.innerWidth <= 767;
            const saved = localStorage.getItem('wt_games_collapsed');

            // На мобильных по умолчанию свернуто, на десктопе - развернуто
            const shouldCollapse = isMobile ? (saved !== 'false') : (saved === 'true');

            if (shouldCollapse) {
                panel.classList.add('collapsed');
                const container = document.getElementById('gameContainer');
                if (container) container.style.display = 'none';
                const button = panel.querySelector('.toggle-panel');
                if (button) {
                    button.textContent = '+';
                    button.title = 'Развернуть';
                }
            }
        } catch (e) {}
    }
});


// Показать модальное окно выбора соперника
function showOpponentSelector(gameType) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay opponent-selector';
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';

    let gameIcon = '';
    let gameName = '';
    switch(gameType) {
        case 'chess': gameIcon = '♟️'; gameName = 'Шахматы'; break;
        case 'tictactoe': gameIcon = '⭕'; gameName = 'Крестики-нолики'; break;
        case 'poker': gameIcon = '🃏'; gameName = 'Покер'; break;
        case 'cards': gameIcon = '🃏'; gameName = 'Карты'; break;
    }

    let html = '<div class="modal-content opponent-modal">';
    html += '<div class="modal-header">';
    html += '<h3>' + gameIcon + ' Выберите соперника для ' + gameName + '</h3>';
    html += '<button class="secondary icon-btn" onclick="closeOpponentSelector()">✕</button>';
    html += '</div>';

    html += '<div class="opponent-sections">';

    // Секция с ботами
    html += '<div class="opponent-section">';
    html += '<h4>🤖 Игра с ботом</h4>';
    html += '<div class="bot-options">';

    // Разные уровни сложности для ботов
    const botLevels = [
        { level: 'easy', name: 'Легкий', emoji: '🐣', description: 'Для начинающих' },
        { level: 'medium', name: 'Средний', emoji: '😐', description: 'Нормальная игра' },
        { level: 'hard', name: 'Сложный', emoji: '💪', description: 'Для опытных' }
    ];

    botLevels.forEach(bot => {
        html += '<div class="opponent-option bot-option" onclick="selectBotLevel(\'' + gameType + '\', \'' + bot.level + '\')">';
        html += '<div class="opponent-avatar">' + bot.emoji + '</div>';
        html += '<div class="opponent-info">';
        html += '<div class="opponent-name">' + bot.name + ' бот</div>';
        html += '<div class="opponent-status">' + bot.description + '</div>';
        html += '</div>';
        html += '</div>';
    });

    html += '</div>';
    html += '</div>';

    // Секция с игроками в комнате
    html += '<div class="opponent-section">';
    html += '<h4>👥 Игроки в комнате</h4>';
    html += '<div class="opponent-list">';

    // Проверяем, есть ли другие игроки
    const otherPlayers = window.roomPlayers ? window.roomPlayers.filter(p => p.id !== (window.socket?.id || 'self')) : [];

    if (otherPlayers.length > 0) {
        otherPlayers.forEach(player => {
            const isInGame = false; // TODO: проверить, находится ли игрок в игре
            html += '<div class="opponent-option player-option ' + (isInGame ? 'busy' : 'available') + '" onclick="invitePlayer(\'' + player.id + '\', \'' + gameType + '\')">';
            html += '<div class="opponent-avatar">' + (player.emoji || '👤') + '</div>';
            html += '<div class="opponent-info">';
            html += '<div class="opponent-name">' + (player.name || 'Игрок') + '</div>';
            html += '<div class="opponent-status">' + (isInGame ? 'В игре' : 'Готов к игре') + '</div>';
            html += '</div>';
            html += '<div class="opponent-status-indicator ' + (isInGame ? 'busy' : 'online') + '"></div>';
            html += '</div>';
        });
    } else {
        html += '<div class="no-players">';
        html += '<div class="no-players-icon">👤❓</div>';
        html += '<div class="no-players-text">В комнате нет других игроков</div>';
        html += '<div class="no-players-subtext">Пригласите друзей или играйте с ботом!</div>';
        html += '</div>';
    }

    html += '</div>';
    html += '</div>';

    html += '</div>'; // Закрываем opponent-sections
    html += '</div>';

    modal.innerHTML = html;
    document.body.appendChild(modal);

    // Анимация появления
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('.modal-content').style.transform = 'scale(1)';
    }, 10);
}

function closeOpponentSelector() {
    const modal = document.querySelector('.opponent-selector');
    if (modal) {
        modal.style.opacity = '0';
        modal.querySelector('.modal-content').style.transform = 'scale(0.8)';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

function selectBot(gameType) {
    // По умолчанию выбираем среднего бота для обратной совместимости
    selectBotLevel(gameType, 'medium');
}

function selectBotLevel(gameType, level) {
    let botEmoji = '🤖';
    let botName = 'Бот';

    switch(level) {
        case 'easy':
            botEmoji = '🐣';
            botName = 'Легкий бот';
            break;
        case 'medium':
            botEmoji = '😐';
            botName = 'Средний бот';
            break;
        case 'hard':
            botEmoji = '💪';
            botName = 'Сложный бот';
            break;
    }

    window.currentOpponent = {
        type: 'bot',
        level: level,
        name: botName,
        emoji: botEmoji
    };

    closeOpponentSelector();
    startGameWithOpponent(gameType);
}

function invitePlayer(playerId, gameType) {
    if (window.socket && window.roomId) {
        window.socket.emit('send-game-invitation', {
            roomId: window.roomId,
            targetPlayerId: playerId,
            gameType: gameType,
            senderName: window.userEmoji || 'Игрок'
        });
        
        // Показываем уведомление об отправке приглашения
        showNotification('Приглашение отправлено!', 'info');
        closeOpponentSelector();
    }
}

function showGameInvitation(data) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay game-invitation';
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    
    let gameIcon = '';
    let gameName = '';
    switch(data.gameType) {
        case 'chess': gameIcon = '♟️'; gameName = 'Шахматы'; break;
        case 'tictactoe': gameIcon = '⭕'; gameName = 'Крестики-нолики'; break;
        case 'poker': gameIcon = '🃏'; gameName = 'Покер'; break;
        case 'cards': gameIcon = '🃏'; gameName = 'Карты'; break;
    }
    
    let html = '<div class="modal-content invitation-modal">';
    html += '<div class="modal-header">';
    html += '<h3>' + gameIcon + ' Приглашение в игру</h3>';
    html += '</div>';
    html += '<div class="invitation-content">';
    html += '<div class="invitation-message">';
    html += '<div class="inviter">' + (data.senderEmoji || '👤') + ' ' + (data.senderName || 'Игрок') + '</div>';
    html += '<div class="game-invite">приглашает вас сыграть в <strong>' + gameName + '</strong></div>';
    html += '</div>';
    html += '<div class="invitation-actions">';
    html += '<button class="action-btn accept-btn" onclick="acceptInvitation(\'' + data.gameType + '\', \'' + data.senderId + '\')">✅ Принять</button>';
    html += '<button class="back-btn decline-btn" onclick="declineInvitation(\'' + data.senderId + '\')">❌ Отклонить</button>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    // Анимация появления
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('.modal-content').style.transform = 'scale(1)';
    }, 10);
    
    // Автоматическое закрытие через 30 секунд
    setTimeout(() => {
        if (document.querySelector('.game-invitation')) {
            declineInvitation(data.senderId);
        }
    }, 30000);
}

function acceptInvitation(gameType, senderId) {
    if (window.socket && window.roomId) {
        window.socket.emit('game-invitation-response', {
            roomId: window.roomId,
            senderId: senderId,
            accepted: true,
            gameType: gameType
        });
    }

    // Найти информацию об отправителе
    const sender = window.roomPlayers.find(p => p.id === senderId);
    window.currentOpponent = {
        type: 'player',
        id: senderId,
        name: sender?.name || 'Игрок',
        emoji: sender?.emoji || '👤'
    };

    closeInvitationModal();

    // Устанавливаем глобальное состояние игры с игроками
    window.gameState = {
        players: window.roomPlayers || [],
        gameType: gameType
    };

    startGameWithOpponent(gameType);
}

function declineInvitation(senderId) {
    if (window.socket && window.roomId) {
        window.socket.emit('game-invitation-response', {
            roomId: window.roomId,
            senderId: senderId,
            accepted: false
        });
    }
    closeInvitationModal();
}

function closeInvitationModal() {
    const modal = document.querySelector('.game-invitation');
    if (modal) {
        modal.style.opacity = '0';
        modal.querySelector('.modal-content').style.transform = 'scale(0.8)';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

function handleInvitationResponse(data) {
    if (data.accepted) {
        const opponent = window.roomPlayers.find(p => p.id === data.responderId);
        window.currentOpponent = {
            type: 'player',
            id: data.responderId,
            name: opponent?.name || 'Игрок',
            emoji: opponent?.emoji || '👤'
        };

        // Устанавливаем глобальное состояние игры с игроками
        window.gameState = {
            players: window.roomPlayers || [],
            gameType: data.gameType
        };

        showNotification('Приглашение принято! Начинаем игру.', 'success');
        startGameWithOpponent(data.gameType);
    } else {
        showNotification('Приглашение отклонено.', 'warning');
    }
}

function startGameWithOpponent(gameType) {
    // Сбрасываем флаг закрытия активной игры, так как пользователь начинает новую
    try { localStorage.removeItem('wt_active_game_closed'); } catch (e) {}

    // Закрываем все модальные окна
    closeOpponentSelector();
    closeInvitationModal();

    // Показываем панель игры
    const panel = document.getElementById('activeGamePanel');
    if (!panel) return;
    const icon = document.getElementById('activeGameIcon');
    const title = document.getElementById('activeGameTitle');
    if (icon && title) {
        if (gameType === 'chess') { icon.textContent = '♟️'; title.textContent = 'Шахматы'; }
        else if (gameType === 'tictactoe') { icon.textContent = '⭕'; title.textContent = 'Крестики-нолики'; }
        else if (gameType === 'cards') { icon.textContent = '🃏'; title.textContent = 'Карты'; }
    }
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Запускаем игру
    switch (gameType) {
        case 'chess':
            initNetworkChess();
            break;
        case 'tictactoe':
            initNetworkTicTacToe();
            break;
        case 'poker':
            initNetworkPoker();
            break;
        case 'cards':
            initNetworkCards();
            break;
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function updateOpponentSelector() {
    // Обновляем селектор соперника, если он открыт
    const selector = document.querySelector('.opponent-selector');
    if (selector) {
        // Перерисовываем список игроков
        const list = selector.querySelector('.opponent-list');
        if (list) {
            // Здесь можно обновить список, но пока оставим как есть
        }
    }
}

// Game Functions
function openGame(game) {
    // Если пользователь уже в комнате, проверим наличие других игроков
    if (window.roomId && window.socket) {
        // Получаем количество других игроков в комнате (исключая себя)
        const otherPlayers = window.roomPlayers.filter(p => p.id !== (window.socket?.id || 'self'));

        if (otherPlayers.length === 0) {
            // В комнате нет других игроков - автоматически выбираем бота
            console.log('No other players in room, auto-selecting bot');
            window.currentOpponent = { type: 'bot', name: 'Бот', emoji: '🤖' };
            showNotification('В комнате нет других игроков. Играем с ботом! 🤖', 'info');
            startGameDirectly(game);
            return;
        } else {
            // В комнате есть другие игроки - показываем селектор соперников
            console.log('Other players found in room, showing opponent selector');
            // Обновляем список игроков в комнате
            updateRoomPlayers();

            // Показываем селектор соперника
            setTimeout(() => {
                showOpponentSelector(game);
            }, 100);
            return;
        }
    }

    // Если соперник уже выбран, запускаем игру напрямую
    if (window.currentOpponent) {
        startGameDirectly(game);
        return;
    }

    // Обновляем список игроков в комнате
    updateRoomPlayers();

    // Показываем селектор соперника
    setTimeout(() => {
        showOpponentSelector(game);
    }, 100);
}

function startNetworkGame(game) {
    console.log('Starting network game:', game);

    // Сбрасываем флаг закрытия активной игры, так как пользователь начинает новую
    try { localStorage.removeItem('wt_active_game_closed'); } catch (e) {}

    window.currentGame = game;

    // Инициализируем базовое состояние игры
    window.gameState = {
        gameType: game,
        players: [],
        currentPlayer: 0,
        gameStarted: false
    };

    // Отправляем запрос на начало игры в комнате
    if (window.socket && window.roomId) {
        window.socket.emit('start-game', {
            roomId: window.roomId,
            gameType: game
        });
    }

    // Показываем панель игры
    const panel = document.getElementById('activeGamePanel');
    if (panel) {
        const icon = document.getElementById('activeGameIcon');
        const title = document.getElementById('activeGameTitle');
        if (icon && title) {
            if (game === 'chess') { icon.textContent = '♟️'; title.textContent = 'Шахматы (сетевая)'; }
            else if (game === 'tictactoe') { icon.textContent = '⭕'; title.textContent = 'Крестики-нолики (сетевая)'; }
            else if (game === 'cards') { icon.textContent = '🃏'; title.textContent = 'Карты (сетевая)'; }
        }
        panel.classList.remove('hidden');
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Показываем сообщение об ожидании
    const container = document.getElementById('gameContainer');
    if (container) {
        container.innerHTML = `
            <div class="game-waiting">
                <h3>Ожидание начала игры...</h3>
                <p>Другие игроки в комнате смогут присоединиться к игре</p>
                <div class="game-controls">
                    <button onclick="closeGame()">Отмена</button>
                </div>
            </div>
        `;
    }
}

function startGameDirectly(game) {
    // Сбрасываем флаг закрытия активной игры, так как пользователь начинает новую
    try { localStorage.removeItem('wt_active_game_closed'); } catch (e) {}

    window.currentGame = game;
    const panel = document.getElementById('activeGamePanel');
    if (!panel) return;
    const icon = document.getElementById('activeGameIcon');
    const title = document.getElementById('activeGameTitle');
    if (icon && title) {
        if (game === 'chess') { icon.textContent = '♟️'; title.textContent = 'Шахматы'; }
        else if (game === 'tictactoe') { icon.textContent = '⭕'; title.textContent = 'Крестики-нолики'; }
        else if (game === 'cards') { icon.textContent = '🃏'; title.textContent = 'Карты'; }
    }
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Отправляем запрос на сервер для начала игры
    if (window.socket && window.roomId && window.currentOpponent?.type === 'player') {
        window.socket.emit('game-start', { 
            roomId: window.roomId, 
            gameType: game,
            opponentId: window.currentOpponent.id
        });
    } else {
        // Если играем с ботом или нет подключения, запускаем локально
        switch (game) {
            case 'chess':
                initChess();
                break;
            case 'tictactoe':
                initTicTacToe();
                break;
            case 'poker':
                startPoker();
                break;
            case 'cards':
                initCards();
                break;
        }
    }
}

function closeGame() {
    console.log('closeGame() called - closing active game');

    // Сохраняем факт того, что пользователь закрыл активную игру
    try { localStorage.setItem('wt_active_game_closed', 'true'); } catch (e) {}

    // Скрываем панель активной игры
    const panel = document.getElementById('activeGamePanel');
    if (panel) {
        console.log('Hiding active game panel');
        panel.classList.add('hidden');
        panel.style.display = 'none'; // Дополнительная гарантия
    } else {
        console.log('Active game panel not found');
    }

    // Полностью очищаем состояние игры
    window.gameState = null;
    window.currentOpponent = null;
    window.currentGame = null;

    // Очищаем содержимое активной игры
    const activeGameContent = document.getElementById('activeGameContent');
    if (activeGameContent) {
        console.log('Clearing active game content');
        activeGameContent.innerHTML = '';
        activeGameContent.style.display = 'none'; // Дополнительная гарантия
    }

    // Восстанавливаем меню игр в gameContainer
    const container = document.getElementById('gameContainer');
    if (container) {
        console.log('Restoring game menu');
        container.style.display = ''; // Показываем контейнер
        container.innerHTML = `
            <h2>🎮 Игры</h2>
            <p>Выберите игру для начала:</p>

            <div class="games-grid">
                <div class="game-card" onclick="openGame('tictactoe')">
                    <div class="game-icon">⭕</div>
                    <div class="game-title">Крестики-нолики</div>
                    <div class="game-description">Классическая игра 3x3</div>
                </div>

                <div class="game-card" onclick="openGame('chess')">
                    <div class="game-icon">♟️</div>
                    <div class="game-title">Шахматы</div>
                    <div class="game-description">Королевская игра</div>
                </div>

                <div class="game-card" onclick="openGame('cards')">
                    <div class="game-icon">🃏</div>
                    <div class="game-title">Карточные игры</div>
                    <div class="game-description">Покер и Дурак</div>
                </div>
            </div>
        `;
    }

    // Показываем панель игр, если она была скрыта
    const gamesPanel = document.getElementById('gamesPanel');
    if (gamesPanel && gamesPanel.classList.contains('collapsed')) {
        gamesPanel.classList.remove('collapsed');
        const gameContainer = document.getElementById('gameContainer');
        if (gameContainer) {
            gameContainer.style.display = '';
        }
    }

    // Если игра была сетевой, уведомляем сервер
    if (window.socket && window.roomId) {
        console.log('Notifying server about game end');
        window.socket.emit('leave-game', { roomId: window.roomId });
    }

    console.log('Game closed successfully');
}

// Chess Game
function initChess() {
    console.log('initChess called!');
    console.trace('initChess call stack'); // Покажет кто вызвал функцию
    
    window.gameState = {
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
        checkmate: false
    };

    // Устанавливаем цвета для локальной игры
    window.myColor = 'white'; // Игрок всегда играет за белых
    window.opponentColor = 'black'; // Бот играет за черных

    renderChessBoard();
}

function renderChessBoard() {
    console.log('renderChessBoard called!');
    console.trace('renderChessBoard call stack');
    
    const container = document.getElementById('activeGameContent');
    if (!container) return;
    
    let html = '';
    
    // Информация о сопернике
    if (window.currentOpponent) {
        html += '<div class="game-opponent-info">';
        html += '<div class="opponent-avatar-small">' + window.currentOpponent.emoji + '</div>';
        html += '<div class="opponent-name-small">' + window.currentOpponent.name + '</div>';
        html += '<div class="opponent-type">' + (window.currentOpponent.type === 'bot' ? 'Бот' : 'Игрок') + '</div>';
        html += '</div>';
    }
    
    html += '<div class="chess-status">Ход: Белые ♔</div>';
    html += '<div class="chess-container">';
    html += '<div class="chess-coordinates files">';
    html += '<span>a</span><span>b</span><span>c</span><span>d</span><span>e</span><span>f</span><span>g</span><span>h</span>';
    html += '</div>';
    html += '<div class="chess-coordinates ranks">';
    html += '<span>8</span><span>7</span><span>6</span><span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>';
    html += '</div>';
    html += '<div class="chess-board" id="chessBoard"></div>';
    html += '</div>';
    html += '<div class="chess-controls">';
    html += '<button onclick="closeGame()" class="back-btn">Закрыть</button>';
    html += '</div>';

    container.innerHTML = html;

    const chessBoard = document.getElementById('chessBoard');

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.className = `chess-cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            cell.dataset.row = row;
            cell.dataset.col = col;

            const piece = window.gameState.board[row][col];
            if (piece) {
                const color = piece[0]; // 'w' или 'b'
                const type = piece[1]; // 'p', 'r', 'n', 'b', 'q', 'k'

                let pieceSymbol = '';
                let pieceClass = color === 'w' ? 'white-piece' : 'black-piece';
                
                // Добавляем класс для блокировки фигур противника
                const isOpponentPiece = (color === 'w' && window.myColor !== 'white') || (color === 'b' && window.myColor !== 'black');
                const isMyTurn = window.myColor === window.gameState.currentPlayer;
                
                if (isOpponentPiece && !isMyTurn) {
                    pieceClass += ' disabled-piece';
                }
                
                if (color === 'w') {
                    switch (type) {
                        case 'p': pieceSymbol = window.chessPieces.white.pawn; break;
                        case 'r': pieceSymbol = window.chessPieces.white.rook; break;
                        case 'n': pieceSymbol = window.chessPieces.white.knight; break;
                        case 'b': pieceSymbol = window.chessPieces.white.bishop; break;
                        case 'q': pieceSymbol = window.chessPieces.white.queen; break;
                        case 'k': pieceSymbol = window.chessPieces.white.king; break;
                    }
                } else {
                    switch (type) {
                        case 'p': pieceSymbol = window.chessPieces.black.pawn; break;
                        case 'r': pieceSymbol = window.chessPieces.black.rook; break;
                        case 'n': pieceSymbol = window.chessPieces.black.knight; break;
                        case 'b': pieceSymbol = window.chessPieces.black.bishop; break;
                        case 'q': pieceSymbol = window.chessPieces.black.queen; break;
                        case 'k': pieceSymbol = window.chessPieces.black.king; break;
                    }
                }

                cell.innerHTML = `<span class="${pieceClass}">${pieceSymbol}</span>`;
                cell.dataset.piece = piece;
            }

            cell.addEventListener('click', handleChessCellClick);
            chessBoard.appendChild(cell);
        }
    }

    updateChessStatus();
}

function handleChessCellClick(e) {
    // Находим ближайшую клетку шахматной доски
    const cell = e.target.closest('.chess-cell');
    if (!cell) return;
    
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    
    // Проверяем, что координаты валидны
    if (isNaN(row) || isNaN(col) || !window.gameState || !window.gameState.board) return;
    
    const piece = window.gameState.board[row][col];

    console.log(`Chess: Player ${window.socket?.id} clicked [${row},${col}] piece: ${piece}, currentPlayer: ${window.gameState.currentPlayer}, myColor: ${window.myColor}`);

    // Проверяем, что сейчас ход игрока, который управляет этим клиентом
    if (window.myColor !== window.gameState.currentPlayer) {
        console.log(`Chess: Invalid action - it's not your turn. Your color: ${window.myColor}, current player: ${window.gameState.currentPlayer}`);
        return;
    }

    // Если клетка уже выбрана, отменяем выбор
    if (window.gameState.selectedCell && window.gameState.selectedCell.row === row && window.gameState.selectedCell.col === col) {
        window.gameState.selectedCell = null;
        clearHighlights();
        return;
    }

    // Если выбрана фигура текущего игрока
    if (piece && piece[0] === (window.gameState.currentPlayer === 'white' ? 'w' : 'b')) {
        window.gameState.selectedCell = { row, col };
        clearHighlights();
        highlightValidMoves(row, col);
        return;
    }

    // Если выбрана клетка для хода
    if (window.gameState.selectedCell) {
        const fromRow = window.gameState.selectedCell.row;
        const fromCol = window.gameState.selectedCell.col;

        if (isValidMoveCell(fromRow, fromCol, row, col)) {
            console.log(`Chess: Valid move from [${fromRow},${fromCol}] to [${row},${col}]`);
            // Отправляем ход на сервер только если играем с игроком
            if (window.socket && window.roomId && window.currentOpponent?.type === 'player') {
                window.socket.emit('game-move', {
                    roomId: window.roomId,
                    gameType: 'chess',
                    move: {
                        from: { row: fromRow, col: fromCol },
                        to: { row, col }
                    }
                });
            } else {
                // Локальная игра без сервера или с ботом
                console.log(`Chess: Local move - player: ${window.gameState.currentPlayer}`);
                const movingPiece = window.gameState.board[fromRow][fromCol];
                window.gameState.board[fromRow][fromCol] = '';
                window.gameState.board[row][col] = movingPiece;
                window.gameState.selectedCell = null;
                window.gameState.currentPlayer = window.gameState.currentPlayer === 'white' ? 'black' : 'white';
                renderChessBoard();
                
                // Если играем с ботом и игра не окончена, делаем ход бота
                if (window.currentOpponent?.type === 'bot' && !window.gameState.checkmate) {
                    setTimeout(() => {
                        makeChessBotMove();
                    }, 1000);
                }
            }
        }
    }
}

function makeChessBotMove() {
    if (window.gameState.checkmate) return;

    // Простая логика бота для шахмат
    const botColor = window.gameState.currentPlayer === 'white' ? 'w' : 'b';
    const allMoves = [];

    // Собираем все возможные ходы бота
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = window.gameState.board[row][col];
            if (piece && piece[0] === botColor) {
                const validMoves = generateMovesFor(row, col);
                validMoves.forEach(move => {
                    allMoves.push({
                        from: { row, col },
                        to: { row: move.row, col: move.col },
                        piece: piece,
                        capturedPiece: window.gameState.board[move.row][move.col]
                    });
                });
            }
        }
    }

    if (allMoves.length > 0) {
        // Простая оценка ходов
        let bestMove = getBestChessMove(allMoves) || allMoves[Math.floor(Math.random() * allMoves.length)];
        
        // Делаем ход
        window.gameState.board[bestMove.from.row][bestMove.from.col] = '';
        window.gameState.board[bestMove.to.row][bestMove.to.col] = bestMove.piece;
        window.gameState.selectedCell = null;
        window.gameState.currentPlayer = window.gameState.currentPlayer === 'white' ? 'black' : 'white';
        renderChessBoard();
    }
}

function getBestChessMove(moves) {
    // Простая оценка: предпочитаем взятие фигур
    const captureMoves = moves.filter(move => move.capturedPiece && move.capturedPiece !== '');
    
    if (captureMoves.length > 0) {
        // Оцениваем ценность захваченных фигур
        const pieceValues = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 100 };
        captureMoves.sort((a, b) => {
            const valueA = pieceValues[a.capturedPiece[1]] || 0;
            const valueB = pieceValues[b.capturedPiece[1]] || 0;
            return valueB - valueA;
        });
        return captureMoves[0];
    }

    // Если нет взятий, предпочитаем ходы к центру
    const centerMoves = moves.filter(move => {
        const centerDistance = Math.abs(move.to.row - 3.5) + Math.abs(move.to.col - 3.5);
        return centerDistance < 3;
    });
    
    if (centerMoves.length > 0) {
        return centerMoves[Math.floor(Math.random() * centerMoves.length)];
    }

    // Если нет центральных ходов, делаем случайный ход
    return null;
}

function clearHighlights() {
    const cells = document.querySelectorAll('.chess-cell');
    cells.forEach(cell => {
        cell.classList.remove('selected', 'valid-move');
    });
}

function highlightValidMoves(row, col) {
    const cells = document.querySelectorAll('.chess-cell');
    const selectedCell = document.querySelector(`.chess-cell[data-row="${row}"][data-col="${col}"]`);
    
    if (selectedCell) {
        selectedCell.classList.add('selected');
    }

    const validMoves = generateMovesFor(row, col);

    validMoves.forEach(move => {
        const moveCell = document.querySelector(`.chess-cell[data-row="${move.row}"][data-col="${move.col}"]`);
        if (moveCell) {
            moveCell.classList.add('valid-move');
        }
    });
}

function isValidMoveCell(fromRow, fromCol, toRow, toCol) {
    const validMoves = generateMovesFor(fromRow, fromCol);
    return validMoves.some(move => move.row === toRow && move.col === toCol);
}

function generateMovesFor(row, col) {
    // Проверяем валидность координат и состояния игры
    if (!window.gameState || !window.gameState.board || 
        isNaN(row) || isNaN(col) || 
        row < 0 || row >= 8 || col < 0 || col >= 8) {
        return [];
    }
    
    const piece = window.gameState.board[row][col];
    if (!piece) return [];

    const color = piece[0]; // 'w' или 'b'
    const type = piece[1]; // 'p', 'r', 'n', 'b', 'q', 'k'
    const moves = [];

    // Упрощенная логика ходов (без проверки шаха и т.д.)
    switch (type) {
        case 'p': // Пешка
            const direction = color === 'w' ? -1 : 1;
            const startRow = color === 'w' ? 6 : 1;

            // Ход вперед на 1 клетку
            if (row + direction >= 0 && row + direction < 8 && !window.gameState.board[row + direction][col]) {
                moves.push({ row: row + direction, col });

                // Ход вперед на 2 клетки с начальной позиции
                if (row === startRow && !window.gameState.board[row + 2 * direction][col]) {
                    moves.push({ row: row + 2 * direction, col });
                }
            }

            // Взятие по диагонали
            for (let offset of [-1, 1]) {
                if (col + offset >= 0 && col + offset < 8 &&
                    window.gameState.board[row + direction][col + offset] &&
                    window.gameState.board[row + direction][col + offset][0] !== color) {
                    moves.push({ row: row + direction, col: col + offset });
                }
            }
            break;

        case 'r': // Ладья
            // Горизонтальные и вертикальные ходы
            for (let direction of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                let r = row + direction[0];
                let c = col + direction[1];

                while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                    if (!window.gameState.board[r][c]) {
                        moves.push({ row: r, col: c });
                    } else {
                        if (window.gameState.board[r][c][0] !== color) {
                            moves.push({ row: r, col: c });
                        }
                        break;
                    }

                    r += direction[0];
                    c += direction[1];
                }
            }
            break;

        case 'n': // Конь
            for (let offset of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
                const r = row + offset[0];
                const c = col + offset[1];

                if (r >= 0 && r < 8 && c >= 0 && c < 8 &&
                    (!window.gameState.board[r][c] || window.gameState.board[r][c][0] !== color)) {
                    moves.push({ row: r, col: c });
                }
            }
            break;

        case 'b': // Слон
            // Диагональные ходы
            for (let direction of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
                let r = row + direction[0];
                let c = col + direction[1];

                while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                    if (!window.gameState.board[r][c]) {
                        moves.push({ row: r, col: c });
                    } else {
                        if (window.gameState.board[r][c][0] !== color) {
                            moves.push({ row: r, col: c });
                        }
                        break;
                    }

                    r += direction[0];
                    c += direction[1];
                }
            }
            break;

        case 'q': // Ферзь (комбинация ладьи и слона)
            // Горизонтальные и вертикальные ходы (как ладья)
            for (let direction of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                let r = row + direction[0];
                let c = col + direction[1];

                while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                    if (!window.gameState.board[r][c]) {
                        moves.push({ row: r, col: c });
                    } else {
                        if (window.gameState.board[r][c][0] !== color) {
                            moves.push({ row: r, col: c });
                        }
                        break;
                    }

                    r += direction[0];
                    c += direction[1];
                }
            }

            // Диагональные ходы (как слон)
            for (let direction of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
                let r = row + direction[0];
                let c = col + direction[1];

                while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                    if (!window.gameState.board[r][c]) {
                        moves.push({ row: r, col: c });
                    } else {
                        if (window.gameState.board[r][c][0] !== color) {
                            moves.push({ row: r, col: c });
                        }
                        break;
                    }

                    r += direction[0];
                    c += direction[1];
                }
            }
            break;

        case 'k': // Король
            for (let offset of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
                const r = row + offset[0];
                const c = col + offset[1];

                if (r >= 0 && r < 8 && c >= 0 && c < 8 &&
                    (!window.gameState.board[r][c] || window.gameState.board[r][c][0] !== color)) {
                    moves.push({ row: r, col: c });
                }
            }
            break;
    }

    return moves;
}

function updateChessStatus() {
    const statusElement = document.querySelector('.chess-status');
    if (statusElement) {
        if (window.gameState.checkmate) {
            const winner = window.gameState.currentPlayer === 'white' ? 'Черные' : 'Белые';
            const winnerSymbol = winner === 'Белые' ? '♔' : '♚';
            statusElement.innerHTML = `<span style="color: #28a745; font-weight: bold;">Мат! Победили ${winner} ${winnerSymbol}</span>`;
        } else if (window.gameState.check) {
            const currentSymbol = window.gameState.currentPlayer === 'white' ? '♔' : '♚';
            const currentName = window.gameState.currentPlayer === 'white' ? 'Белые' : 'Черные';
            statusElement.innerHTML = `<span style="color: #dc3545; font-weight: bold;">Шах!</span> Ход: <span style="color: var(--accent-primary); font-weight: bold;">${currentName} ${currentSymbol}</span>`;
        } else {
            // Показываем чей ход и указываем, ваш ли это ход
            const currentSymbol = window.gameState.currentPlayer === 'white' ? '♔' : '♚';
            const currentName = window.gameState.currentPlayer === 'white' ? 'Белые' : 'Черные';
            const isYourTurn = window.myColor === window.gameState.currentPlayer;
            const turnText = isYourTurn ? 'Ваш ход' : 'Ход противника';
            const turnIndicator = isYourTurn ? '👉' : '⏳';
            const playerColor = window.gameState.currentPlayer === 'white' ? '#ffffff' : '#1a1a1a';
            
            statusElement.innerHTML = `${turnIndicator} <span style="color: ${playerColor}; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">${currentName} ${currentSymbol}</span> (${turnText})`;
        }
    }
}

function initTicTacToe() {
    console.log('initTicTacToe called!');
    console.trace('initTicTacToe call stack');
    
    window.gameState = {
        board: [
            ['', '', ''],
            ['', '', ''],
            ['', '', '']
        ],
        currentPlayer: 'X',
        gameOver: false,
        winner: null
    };

    // Устанавливаем символы для локальной игры
    window.mySymbol = 'X'; // Игрок всегда ходит за X
    window.opponentSymbol = 'O'; // Бот ходит за O

    renderTicTacToeBoard();
}

function initNetworkTicTacToe() {
    // Определяем mapping игроков
    const currentPlayerId = window.socket?.id;
    const opponentId = window.currentOpponent?.id;

    // Первый игрок в массиве ходит за 'X', второй за 'O'
    const players = window.gameState.players || [];
    const firstPlayerId = players[0];
    const secondPlayerId = players[1];

    // Определяем символы для игроков
    window.gamePlayerMapping = {
        [firstPlayerId]: 'X',
        [secondPlayerId]: 'O'
    };

    // Определяем, за кого играет текущий игрок
    window.mySymbol = window.gamePlayerMapping[currentPlayerId];
    window.opponentSymbol = window.gamePlayerMapping[opponentId];

    console.log('Network TicTacToe initialized:', {
        mySymbol: window.mySymbol,
        opponentSymbol: window.opponentSymbol,
        currentPlayerId,
        opponentId,
        mapping: window.gamePlayerMapping
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

function initNetworkChess() {
    // Определяем mapping игроков
    const currentPlayerId = window.socket?.id;
    const opponentId = window.currentOpponent?.id;

    // Первый игрок в массиве ходит за белых, второй за черных
    const players = window.gameState.players || [];
    const firstPlayerId = players[0];
    const secondPlayerId = players[1];

    // Определяем цвета для игроков
    window.gamePlayerMapping = {
        [firstPlayerId]: 'white',
        [secondPlayerId]: 'black'
    };

    // Определяем, за кого играет текущий игрок
    window.myColor = window.gamePlayerMapping[currentPlayerId];
    window.opponentColor = window.gamePlayerMapping[opponentId];

    console.log('Network Chess initialized:', {
        myColor: window.myColor,
        opponentColor: window.opponentColor,
        currentPlayerId,
        opponentId,
        mapping: window.gamePlayerMapping
    });

    window.gameState = {
        ...window.gameState, // Сохраняем уже установленные свойства
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
        currentPlayer: 'white', // Белые ходят первыми
        selectedCell: null,
        check: false,
        checkmate: false,
        gameType: 'chess'
    };

    renderChessBoard();
}

function initNetworkPoker() {
    window.gameState = {
        gameMode: 'poker',
        deck: [],
        playerHand: [],
        opponentHand: [],
        playerScore: 0,
        opponentScore: 0,
        currentPlayer: 'player',
        round: 1,
        gamePhase: 'exchange',
        players: window.gameState.players || [],
        gameType: 'poker'
    };

    renderPokerGame();
}

function handleNetworkTicTacToeMove(move) {
    const { row, col, player } = move;

    if (window.gameState.board[row][col] === '') {
        window.gameState.board[row][col] = player;
        window.gameState.currentPlayer = player === 'X' ? 'O' : 'X';

        // Проверяем победителя
        checkTicTacToeWinner();
        renderTicTacToeBoard();

        // Если игра окончена, отправляем уведомление
        if (window.gameState.gameOver) {
            if (window.socket && window.roomId) {
                window.socket.emit('game-ended', {
                    roomId: window.roomId,
                    winner: window.gameState.winner,
                    gameType: 'tictactoe'
                });
            }
        }
    }
}

function handleNetworkChessMove(move) {
    const { from, to } = move;

    if (isValidMoveCell(from.row, from.col, to.row, to.col)) {
        const movingPiece = window.gameState.board[from.row][from.col];
        window.gameState.board[from.row][from.col] = '';
        window.gameState.board[to.row][to.col] = movingPiece;
        window.gameState.selectedCell = null;
        window.gameState.currentPlayer = window.gameState.currentPlayer === 'white' ? 'black' : 'white';

        renderChessBoard();

        // Проверяем мат
        // (упрощенная проверка - в реальности нужна более сложная логика)
        if (window.gameState.checkmate) {
            if (window.socket && window.roomId) {
                const winner = window.gameState.currentPlayer === 'white' ? 'black' : 'white';
                window.socket.emit('game-ended', {
                    roomId: window.roomId,
                    winner: winner,
                    gameType: 'chess'
                });
            }
        }
    }
}

function handleNetworkCardsMove(move) {
    const { action, card, playerIndex } = move;

    if (action === 'play' && card) {
        // Удаляем карту из руки
        const handIndex = window.gameState.player1Hand.findIndex(c =>
            c.suit === card.suit && c.value === card.value
        );
        if (handIndex !== -1) {
            window.gameState.player1Hand.splice(handIndex, 1);
            window.gameState.tableCards.push(card);
            window.gameState.currentPlayer = 'player2';
        }
    } else if (action === 'draw') {
        // Берем карты из колоды
        while (window.gameState.player1Hand.length < 6 && window.gameState.deck.length > 0) {
            window.gameState.player1Hand.push(window.gameState.deck.pop());
        }
    }
}

function handleNetworkPokerMove(move) {
    const { action, cardIndex, playerId } = move;
    
    if (action === 'exchange' && cardIndex !== undefined) {
        // Игрок обменял карту
        if (window.gameState.deck.length > 0) {
            window.gameState.opponentHand[cardIndex] = window.gameState.deck.pop();
            renderPokerGame();
        }
    } else if (action === 'check') {
        // Игрок проверил комбинацию - запускаем проверку для обоих игроков
        // Устанавливаем фазу ожидания
        window.gameState.gamePhase = 'waiting';
        checkPokerHand();
    }
}

    
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
    
    // Добавляем счётчик побед
    html += '<div class="ttt-score">';
    html += `<div class="score-item"><span style="color: var(--accent-primary); font-weight: bold;">X</span>: ${window.tttScore.X}</div>`;
    html += `<div class="score-item"><span style="color: #dc3545; font-weight: bold;">O</span>: ${window.tttScore.O}</div>`;
    html += `<div class="score-item">Ничьи: ${window.tttScore.draws}</div>`;
    html += '</div>';
    
    html += '<div class="game-status">Ход: X</div>';

    html += '<div class="ttt-board" id="tictactoeBoard">';
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const cellValue = window.gameState.board[row][col];
            const dataSymbol = cellValue ? `data-symbol="${cellValue}"` : '';
            
            // Блокируем клетку, если не ход текущего игрока или клетка занята
            const isDisabled = cellValue !== '' || window.mySymbol !== window.gameState.currentPlayer;
            const disabledClass = isDisabled ? 'disabled' : '';
            
            html += `<div class="ttt-cell ${disabledClass}" data-row="${row}" data-col="${col}" ${dataSymbol}>${cellValue}</div>`;
        }
    }
    html += '</div>';

    html += '<div class="game-controls">';
    html += '<button onclick="closeGame()">Закрыть</button>';
    html += '</div>';

    const gamePanel = document.getElementById('activeGameContent');
    gamePanel.innerHTML = html;

    // Добавляем обработчики событий
    const cells = document.querySelectorAll('.ttt-cell');
    cells.forEach(cell => {
        cell.addEventListener('click', handleTicTacToeCellClick);
    });

    updateTicTacToeStatus();
}

function handleTicTacToeCellClick(e) {
    if (window.gameState.gameOver) return;

    const cell = e.target;
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    console.log(`TicTacToe: Player ${window.socket?.id} attempting move at [${row},${col}], currentPlayer: ${window.gameState.currentPlayer}, mySymbol: ${window.mySymbol}`);

    // Проверяем, что сейчас ход игрока, который управляет этим клиентом
    if (window.mySymbol !== window.gameState.currentPlayer) {
        console.log(`TicTacToe: Invalid move - it's not your turn. Your symbol: ${window.mySymbol}, current player: ${window.gameState.currentPlayer}`);
        return;
    }

    if (window.gameState.board[row][col] === '') {
        // Отправляем ход на сервер только если играем с игроком
        if (window.socket && window.roomId && window.currentOpponent?.type === 'player') {
            console.log(`TicTacToe: Sending move to server - player: ${window.gameState.currentPlayer}`);
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
            console.log(`TicTacToe: Local move - player: ${window.gameState.currentPlayer}`);
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
    }
}

function makeBotMove() {
    if (window.gameState.gameOver) return;

    // Простая логика бота для крестиков-ноликов
    const availableMoves = [];
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            if (window.gameState.board[row][col] === '') {
                availableMoves.push({ row, col });
            }
        }
    }

    if (availableMoves.length > 0) {
        // Бот пытается выиграть или заблокировать игрока
        let bestMove = findBestMove() || availableMoves[Math.floor(Math.random() * availableMoves.length)];
        
        window.gameState.board[bestMove.row][bestMove.col] = window.gameState.currentPlayer;
        window.gameState.currentPlayer = window.gameState.currentPlayer === 'X' ? 'O' : 'X';

        checkTicTacToeWinner();
        renderTicTacToeBoard();
    }
}

function findBestMove() {
    const board = window.gameState.board;
    const currentPlayer = window.gameState.currentPlayer;
    const opponent = currentPlayer === 'X' ? 'O' : 'X';

    // Проверяем, может ли бот выиграть
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            if (board[row][col] === '') {
                board[row][col] = currentPlayer;
                if (checkWinCondition(board, currentPlayer)) {
                    board[row][col] = ''; // Отменяем временный ход
                    return { row, col };
                }
                board[row][col] = ''; // Отменяем временный ход
            }
        }
    }

    // Проверяем, нужно ли заблокировать игрока
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            if (board[row][col] === '') {
                board[row][col] = opponent;
                if (checkWinCondition(board, opponent)) {
                    board[row][col] = ''; // Отменяем временный ход
                    return { row, col };
                }
                board[row][col] = ''; // Отменяем временный ход
            }
        }
    }

    // Если нет критических ходов, выбираем центр или угол
    if (board[1][1] === '') return { row: 1, col: 1 }; // Центр
    
    const corners = [{ row: 0, col: 0 }, { row: 0, col: 2 }, { row: 2, col: 0 }, { row: 2, col: 2 }];
    for (let corner of corners) {
        if (board[corner.row][corner.col] === '') return corner;
    }

    return null;
}

function checkWinCondition(board, player) {
    // Проверяем строки
    for (let row = 0; row < 3; row++) {
        if (board[row][0] === player && board[row][1] === player && board[row][2] === player) {
            return true;
        }
    }

    // Проверяем столбцы
    for (let col = 0; col < 3; col++) {
        if (board[0][col] === player && board[1][col] === player && board[2][col] === player) {
            return true;
        }
    }

    // Проверяем диагонали
    if (board[0][0] === player && board[1][1] === player && board[2][2] === player) {
        return true;
    }

    if (board[0][2] === player && board[1][1] === player && board[2][0] === player) {
        return true;
    }

    return false;
}

function checkTicTacToeWinner() {
    const board = window.gameState.board;

    // Проверяем строки
    for (let row = 0; row < 3; row++) {
        if (board[row][0] && board[row][0] === board[row][1] && board[row][0] === board[row][2]) {
            window.gameState.gameOver = true;
            window.gameState.winner = board[row][0];
            return;
        }
    }

    // Проверяем столбцы
    for (let col = 0; col < 3; col++) {
        if (board[0][col] && board[0][col] === board[1][col] && board[0][col] === board[2][col]) {
            window.gameState.gameOver = true;
            window.gameState.winner = board[0][col];
            return;
        }
    }

    // Проверяем диагонали
    if (board[0][0] && board[0][0] === board[1][1] && board[0][0] === board[2][2]) {
        window.gameState.gameOver = true;
        window.gameState.winner = board[0][0];
        return;
    }

    if (board[0][2] && board[0][2] === board[1][1] && board[0][2] === board[2][0]) {
        window.gameState.gameOver = true;
        window.gameState.winner = board[0][2];
        return;
    }

    // Проверяем ничью
    let isDraw = true;
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            if (board[row][col] === '') {
                isDraw = false;
                break;
            }
        }
        if (!isDraw) break;
    }

    if (isDraw) {
        window.gameState.gameOver = true;
        window.gameState.winner = 'draw';
    }
}

function updateTicTacToeStatus() {
    // Инициализируем счётчики, если их ещё нет
    if (!window.tttScore) {
        window.tttScore = { X: 0, O: 0, draws: 0 };
    }
    
    const statusElement = document.querySelector('.game-status');
    if (statusElement) {
        if (window.gameState.gameOver) {
            // Обновляем счёт
            if (window.gameState.winner === 'draw') {
                window.tttScore.draws++;
                statusElement.innerHTML = '<span style="color: #ffc107;">Ничья!</span>';
            } else {
                window.tttScore[window.gameState.winner]++;
                const winnerColor = window.gameState.winner === 'X' ? 'var(--accent-primary)' : '#dc3545';
                statusElement.innerHTML = `Победитель: <span style="color: ${winnerColor}; font-weight: bold;">${window.gameState.winner}</span>!`;
            }
            
            // Обновляем отображение счёта
            updateScoreDisplay();
            
            // Добавляем кнопку "Новая игра" после завершения
            const gameControls = document.querySelector('.game-controls');
            if (gameControls && !gameControls.querySelector('.new-game-btn')) {
                const newGameBtn = document.createElement('button');
                newGameBtn.textContent = '🎮 Новая игра';
                newGameBtn.className = 'new-game-btn action-btn';
                newGameBtn.onclick = startNewTicTacToeGame;
                newGameBtn.style.opacity = '0';
                newGameBtn.style.transform = 'scale(0.8)';
                gameControls.insertBefore(newGameBtn, gameControls.firstChild);
                
                // Анимация появления кнопки
                setTimeout(() => {
                    newGameBtn.style.transition = 'all 0.3s ease';
                    newGameBtn.style.opacity = '1';
                    newGameBtn.style.transform = 'scale(1)';
                }, 100);
            }
        } else {
            // Показываем чей ход и указываем, ваш ли это ход
            const playerColor = window.gameState.currentPlayer === 'X' ? 'var(--accent-primary)' : '#dc3545';
            const isYourTurn = window.mySymbol === window.gameState.currentPlayer;
            const turnText = isYourTurn ? 'Ваш ход' : 'Ход противника';
            const turnIndicator = isYourTurn ? '👉' : '⏳';
            
            statusElement.innerHTML = `${turnIndicator} <span style="color: ${playerColor}; font-weight: bold;">${window.gameState.currentPlayer}</span> (${turnText})`;
        }
    }
}

function updateScoreDisplay() {
    // Инициализируем счётчики, если их ещё нет
    if (!window.tttScore) {
        window.tttScore = { X: 0, O: 0, draws: 0 };
    }
    
    const scoreItems = document.querySelectorAll('.score-item');
    if (scoreItems.length >= 3) {
        scoreItems[0].innerHTML = `<span style="color: var(--accent-primary); font-weight: bold;">X</span>: ${window.tttScore.X}`;
        scoreItems[1].innerHTML = `<span style="color: #dc3545; font-weight: bold;">O</span>: ${window.tttScore.O}`;
        scoreItems[2].innerHTML = `Ничьи: ${window.tttScore.draws}`;
    }
}

function startNewPokerGame() {
    console.log('startNewPokerGame called');
    
    // Полностью сбрасываем состояние игры
    window.gameState = {
        gameMode: 'poker',
        deck: [],
        playerHand: [],
        opponentHand: [],
        playerScore: 0,
        opponentScore: 0,
        currentPlayer: 'player',
        round: 1,
        gamePhase: 'exchange',
        winner: null
    };
    
    createDeck();
    shuffleDeck();
    dealPokerCards();
    renderPokerGame();
    
    // Показываем уведомление
    showNotification('🎮 Начата новая игра в покер!', 'info');
}

// Cards Game - Покер и Дурак
function initCards() {
    console.log('initCards called'); // Отладочное сообщение
    
    // Полностью очищаем состояние игры перед показом меню карточных игр
    window.gameState = {
        gameMode: 'menu', // 'menu', 'poker', 'durak'
        deck: [],
        playerHand: [],
        opponentHand: [],
        attackingCards: [],
        defendingCards: [],
        trumpSuit: null,
        gamePhase: 'attack',
        currentAttacker: 'player'
    };
    
    renderCardsMenu();
}

function renderCardsMenu() {
    console.log('renderCardsMenu called'); // Отладочное сообщение
    
    // Показываем панель активной игры с правильным заголовком
    const activeGamePanel = document.getElementById('activeGamePanel');
    if (activeGamePanel) {
        activeGamePanel.classList.remove('hidden');
        document.getElementById('activeGameTitle').textContent = 'Карточные игры';
        document.getElementById('activeGameIcon').textContent = '🃏';
    }
    
    const gamePanel = document.getElementById('gameContainer');
    
    let html = '<div class="cards-menu">';
    
    // Информация о сопернике
    if (window.currentOpponent) {
        html += '<div class="game-opponent-info">';
        html += '<div class="opponent-avatar-small">' + window.currentOpponent.emoji + '</div>';
        html += '<div class="opponent-name-small">' + window.currentOpponent.name + '</div>';
        html += '<div class="opponent-type">' + (window.currentOpponent.type === 'bot' ? 'Бот' : 'Игрок') + '</div>';
        html += '</div>';
    }
    
    html += '<h3>Выберите игру:</h3>';
    html += '<div class="game-selection">';
    html += '<button class="game-mode-btn" onclick="startPoker()">🃏 Покер</button>';
    html += '<button class="game-mode-btn" onclick="startDurak()">🎴 Дурак</button>';
    html += '</div>';
    html += '<div class="game-rules">';
    html += '<div class="rules-section">';
    html += '<h4>Правила Покера:</h4>';
    html += '<ul>';
    html += '<li>Каждый игрок получает 5 карт</li>';
    html += '<li>Цель: собрать лучшую покерную комбинацию</li>';
    html += '<li>Комбинации (по возрастанию): пара, две пары, тройка, стрит, флеш, фул-хаус, каре, стрит-флеш</li>';
    html += '<li>Можно менять до 3 карт за раз</li>';
    html += '</ul>';
    html += '</div>';
    html += '<div class="rules-section">';
    html += '<h4>Правила Дурака:</h4>';
    html += '<ul>';
    html += '<li>Каждый игрок получает 6 карт, определяется козырная масть</li>';
    html += '<li>Цель: избавиться от всех карт первым</li>';
    html += '<li>Атакующий кладёт карту, защищающийся должен побить её</li>';
    html += '<li>Бить можно старшей картой той же масти или козырем</li>';
    html += '<li>Если не можешь побить - забираешь все карты</li>';
    html += '</ul>';
    html += '</div>';
    html += '</div>';
    html += '<button onclick="closeGame()" class="close-btn">Закрыть</button>';
    html += '</div>';

    gamePanel.innerHTML = html;
    console.log('HTML set to gamePanel'); // Проверяем, что HTML установлен
}

function startPoker() {
    console.log('startPoker called');
    
    // Полностью очищаем состояние игры перед запуском покера
    window.gameState = {
        gameMode: 'poker',
        deck: [],
        playerHand: [],
        opponentHand: [],
        playerScore: window.gameState?.playerScore || 0,
        opponentScore: window.gameState?.opponentScore || 0,
        currentPlayer: 'player',
        round: window.gameState?.round || 1,
        gamePhase: 'exchange', // 'exchange' или 'finished'
        winner: null
    };
    
    createDeck();
    shuffleDeck();
    dealPokerCards();
    renderPokerGame();
    
    // Обновляем заголовок активной панели игры
    const activeGamePanel = document.getElementById('activeGamePanel');
    if (activeGamePanel) {
        document.getElementById('activeGameTitle').textContent = 'Покер';
        document.getElementById('activeGameIcon').textContent = '🃏';
    }
}

function startDurak() {
    console.log('startDurak called'); // Отладка
    
    // Полностью очищаем состояние игры перед запуском дурака
    window.gameState = {
        gameMode: 'durak',
        deck: [],
        playerHand: [],
        opponentHand: [],
        attackingCards: [],
        defendingCards: [],
        trumpSuit: null,
        gamePhase: 'attack',
        currentAttacker: 'player'
    };
    
    console.log('Creating deck...'); // Отладка
    createDeck();
    console.log('Shuffling deck...'); // Отладка
    shuffleDeck();
    console.log('Setting trump suit...'); // Отладка
    setTrumpSuit();
    console.log('Dealing durak cards...'); // Отладка
    dealDurakCards();
    console.log('Rendering durak game...'); // Отладка
    
    // Показываем панель активной игры
    const activeGamePanel = document.getElementById('activeGamePanel');
    if (activeGamePanel) {
        activeGamePanel.classList.remove('hidden');
        document.getElementById('activeGameTitle').textContent = 'Дурак';
        document.getElementById('activeGameIcon').textContent = '🎴';
    }
    
    renderDurakGame();
}

function createDeck() {
    window.gameState.deck = [];
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']; // Дурак играется с 36 картами

    for (let suit of suits) {
        for (let value of values) {
            window.gameState.deck.push({ suit, value, power: getCardPower(value) });
        }
    }
}

function getCardPower(value) {
    const powers = { '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return powers[value] || 0;
}

function shuffleDeck() {
    for (let i = window.gameState.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [window.gameState.deck[i], window.gameState.deck[j]] = [window.gameState.deck[j], window.gameState.deck[i]];
    }
}

function setTrumpSuit() {
    if (window.gameState.deck.length > 0) {
        window.gameState.trumpSuit = window.gameState.deck[window.gameState.deck.length - 1].suit;
    }
}

function dealPokerCards() {
    window.gameState.playerHand = [];
    window.gameState.opponentHand = [];
    
    for (let i = 0; i < 5; i++) {
        window.gameState.playerHand.push(window.gameState.deck.pop());
        window.gameState.opponentHand.push(window.gameState.deck.pop());
    }
}

function dealDurakCards() {
    console.log('dealDurakCards called'); // Отладка
    window.gameState.playerHand = [];
    window.gameState.opponentHand = [];
    
    console.log('Deck length before dealing:', window.gameState.deck.length); // Отладка
    
    for (let i = 0; i < 6; i++) {
        if (window.gameState.deck.length > 0) {
            window.gameState.playerHand.push(window.gameState.deck.pop());
        }
        if (window.gameState.deck.length > 0) {
            window.gameState.opponentHand.push(window.gameState.deck.pop());
        }
    }
    
    // Определяем кто ходит первым (у кого самый младший козырь)
    determineFirstPlayer();
    
    console.log('Player hand:', window.gameState.playerHand); // Отладка
    console.log('Opponent hand:', window.gameState.opponentHand); // Отладка
    console.log('First attacker:', window.gameState.currentAttacker); // Отладка
}

function determineFirstPlayer() {
    const trumpSuit = window.gameState.trumpSuit;
    
    // Находим козыри у игрока
    const playerTrumps = window.gameState.playerHand.filter(card => card.suit === trumpSuit);
    const opponentTrumps = window.gameState.opponentHand.filter(card => card.suit === trumpSuit);
    
    let playerLowestTrump = null;
    let opponentLowestTrump = null;
    
    if (playerTrumps.length > 0) {
        playerLowestTrump = playerTrumps.reduce((lowest, card) => 
            card.power < lowest.power ? card : lowest
        );
    }
    
    if (opponentTrumps.length > 0) {
        opponentLowestTrump = opponentTrumps.reduce((lowest, card) => 
            card.power < lowest.power ? card : lowest
        );
    }
    
    // Определяем кто ходит первым
    if (playerLowestTrump && opponentLowestTrump) {
        // У обоих есть козыри - ходит тот, у кого меньше
        if (playerLowestTrump.power < opponentLowestTrump.power) {
            window.gameState.currentAttacker = 'player';
            window.gameState.gamePhase = 'attack';
        } else {
            window.gameState.currentAttacker = 'bot';
            window.gameState.gamePhase = 'defend'; // Игрок защищается
            // Бот атакует первым только если активная панель игры открыта
            const activeGamePanel = document.getElementById('activeGamePanel');
            if (activeGamePanel && !activeGamePanel.classList.contains('hidden')) {
                setTimeout(() => {
                    makeDurakBotAttack();
                }, 1000);
            }
        }
    } else if (playerLowestTrump) {
        // Только у игрока есть козыри - он ходит первым
        window.gameState.currentAttacker = 'player';
        window.gameState.gamePhase = 'attack';
    } else if (opponentLowestTrump) {
        // Только у бота есть козыри - он ходит первым
        window.gameState.currentAttacker = 'bot';
        window.gameState.gamePhase = 'defend';
        // Бот атакует первым только если активная панель игры открыта
        const activeGamePanel = document.getElementById('activeGamePanel');
        if (activeGamePanel && !activeGamePanel.classList.contains('hidden')) {
            setTimeout(() => {
                makeDurakBotAttack();
            }, 1000);
        }
    } else {
        // Ни у кого нет козырей - игрок ходит первым (по умолчанию)
        window.gameState.currentAttacker = 'player';
        window.gameState.gamePhase = 'attack';
    }
}

function renderPokerGame() {
    console.log('renderPokerGame called');
    
    // Показываем панель активной игры
    const activeGamePanel = document.getElementById('activeGamePanel');
    if (activeGamePanel) {
        activeGamePanel.classList.remove('hidden');
        document.getElementById('activeGameTitle').textContent = 'Покер';
        document.getElementById('activeGameIcon').textContent = '🃏';
    }
    
    const gamePanel = document.getElementById('activeGameContent');
    if (!gamePanel) return;
    
    let html = '<div class="poker-game">';
    
    // Информация о сопернике
    if (window.currentOpponent) {
        html += '<div class="game-opponent-info">';
        html += '<div class="opponent-avatar-small">' + window.currentOpponent.emoji + '</div>';
        html += '<div class="opponent-name-small">' + window.currentOpponent.name + '</div>';
        html += '<div class="opponent-type">' + (window.currentOpponent.type === 'bot' ? 'Бот' : 'Игрок') + '</div>';
        html += '</div>';
    }
    
    html += '<h3>🃏 Покер</h3>';
    html += '<div class="game-info">';
    html += '<div>Раунд: <strong>' + window.gameState.round + '</strong></div>';
    html += '<div>Ваш счёт: ' + window.gameState.playerScore + '</div>';
    html += '<div>Счёт противника: ' + window.gameState.opponentScore + '</div>';
    html += '</div>';
    
    // Карты противника (вверху)
    html += '<div class="opponent-cards">';
    html += '<h4>Карты противника:</h4>';
    html += '<div class="cards-hand opponent-hand">';
    for (let i = 0; i < window.gameState.opponentHand.length; i++) {
        if (window.gameState.gamePhase === 'waiting' || window.gameState.gamePhase === 'finished') {
            // Показываем открытые карты противника после проверки комбинации
            const card = window.gameState.opponentHand[i];
            const suitClass = getSuitClass(card.suit);
            html += '<div class="card ' + suitClass + ' revealed" data-index="' + i + '">';
            html += '<div class="card-value">' + card.value + '</div>';
            html += '<div class="card-suit">' + card.suit + '</div>';
            html += '</div>';
        } else {
            // В фазе обмена карты противника закрыты
            html += '<div class="card card-back">🂠</div>';
        }
    }
    html += '</div>';
    html += '</div>';
    
    // Центральная область (для показа комбинаций или обмена)
    html += '<div class="poker-center">';
    if (window.gameState.gamePhase === 'finished') {
        const winner = window.gameState.winner;
        html += '<div class="game-result">';
        if (winner === 'player') {
            html += '<div style="color: #28a745; font-size: 24px; font-weight: bold;">🎉 Вы выиграли игру!</div>';
        } else if (winner === 'opponent') {
            html += '<div style="color: #dc3545; font-size: 24px; font-weight: bold;">😞 Противник выиграл игру!</div>';
        } else {
            html += '<div style="color: #ffc107; font-size: 24px; font-weight: bold;">🤝 Ничья в игре!</div>';
        }
        html += '<div style="margin-top: 10px;">Игра окончена. Первый, кто набрал 10 очков, побеждает!</div>';
        html += '</div>';
    } else if (window.gameState.gamePhase === 'waiting') {
        // Показываем стол с картами
        html += '<div class="poker-table">';
        html += '<div class="table-title">Сравнение комбинаций</div>';
        
        // Карты игрока на столе
        html += '<div class="table-player-cards">';
        html += '<div class="player-label">Ваши карты:</div>';
        html += '<div class="table-cards-row">';
        for (let i = 0; i < window.gameState.playerHand.length; i++) {
            const card = window.gameState.playerHand[i];
            const suitClass = getSuitClass(card.suit);
            html += '<div class="card ' + suitClass + ' on-table" data-index="' + i + '">';
            html += '<div class="card-value">' + card.value + '</div>';
            html += '<div class="card-suit">' + card.suit + '</div>';
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
        
        // Карты противника на столе
        html += '<div class="table-opponent-cards">';
        html += '<div class="opponent-label">Карты противника:</div>';
        html += '<div class="table-cards-row">';
        for (let i = 0; i < window.gameState.opponentHand.length; i++) {
            const card = window.gameState.opponentHand[i];
            const suitClass = getSuitClass(card.suit);
            html += '<div class="card ' + suitClass + ' on-table" data-index="' + i + '">';
            html += '<div class="card-value">' + card.value + '</div>';
            html += '<div class="card-suit">' + card.suit + '</div>';
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        
        // Добавляем область для показа результата
        html += '<div class="poker-status">Определяем победителя...</div>';
    } else if (window.gameState.gamePhase === 'exchange') {
        html += '<div class="poker-status">Выберите карты для обмена или проверьте комбинацию</div>';
    }
    html += '</div>';
    
    // Ваши карты (внизу)
    html += '<div class="player-cards">';
    html += '<h4>Ваши карты:</h4>';
    html += '<div class="cards-hand player-hand">';
    for (let i = 0; i < window.gameState.playerHand.length; i++) {
        const card = window.gameState.playerHand[i];
        const suitClass = getSuitClass(card.suit);
        const isSelected = card.selected ? ' selected' : '';
        html += '<div class="card ' + suitClass + isSelected + '" data-index="' + i + '">';
        html += '<div class="card-value">' + card.value + '</div>';
        html += '<div class="card-suit">' + card.suit + '</div>';
        html += '</div>';
    }
    html += '</div>';
    html += '</div>';
    
    // Кнопки управления
    html += '<div class="poker-controls">';
    if (window.gameState.gamePhase === 'finished') {
        html += '<button onclick="startNewPokerGame()" class="action-btn">🎮 Новая игра</button>';
    } else if (window.gameState.gamePhase === 'exchange') {
        html += '<button onclick="exchangeCards()" class="action-btn">Обменять выбранные</button>';
        html += '<button onclick="checkPokerHand()" class="action-btn">Проверить комбинацию</button>';
        html += '<button onclick="newPokerRound()" class="action-btn">Новый раунд</button>';
    } else if (window.gameState.gamePhase === 'waiting') {
        // Фаза ожидания следующего раунда - кнопки отключены
        html += '<button disabled class="action-btn" style="opacity: 0.5;">Подготовка...</button>';
    }
    html += '<button onclick="backToMenu()" class="back-btn">Назад к меню</button>';
    html += '</div>';
    
    html += '</div>';
    gamePanel.innerHTML = html;
    
    // Добавляем обработчики для выбора карт
    addPokerCardHandlers();
}

function renderDurakGame() {
    console.log('renderDurakGame called'); // Отладка
    
    // Показываем панель активной игры и скрываем основное меню
    const activeGamePanel = document.getElementById('activeGamePanel');
    const gameContainer = document.getElementById('gameContainer');
    
    if (activeGamePanel) {
        activeGamePanel.classList.remove('hidden');
        document.getElementById('activeGameTitle').textContent = 'Дурак';
        document.getElementById('activeGameIcon').textContent = '🎴';
    }
    
    const gamePanel = document.getElementById('activeGameContent');
    console.log('gamePanel for durak:', gamePanel); // Отладка
    if (!gamePanel) {
        console.error('activeGameContent not found!');
        return;
    }
    
    // Проверяем, что gameState правильно инициализирован
    if (!window.gameState) {
        console.error('gameState not initialized');
        return;
    }
    
    // Инициализируем массивы, если они не существуют
    if (!window.gameState.opponentHand) window.gameState.opponentHand = [];
    if (!window.gameState.playerHand) window.gameState.playerHand = [];
    if (!window.gameState.attackingCards) window.gameState.attackingCards = [];
    if (!window.gameState.defendingCards) window.gameState.defendingCards = [];
    
    console.log('gameState:', window.gameState); // Отладка
    console.log('playerHand length:', window.gameState.playerHand.length);
    console.log('opponentHand length:', window.gameState.opponentHand.length);
    console.log('Фаза игры:', window.gameState.gamePhase, 'Атакующий:', window.gameState.currentAttacker);
    console.log('Атакующие карты:', window.gameState.attackingCards);
    console.log('Защищающие карты:', window.gameState.defendingCards);
    
    let html = '<div class="durak-game">';
    
    // Информация о сопернике
    if (window.currentOpponent) {
        html += '<div class="game-opponent-info">';
        html += '<div class="opponent-avatar-small">' + window.currentOpponent.emoji + '</div>';
        html += '<div class="opponent-name-small">' + window.currentOpponent.name + '</div>';
        html += '<div class="opponent-type">' + (window.currentOpponent.type === 'bot' ? 'Бот' : 'Игрок') + '</div>';
        html += '</div>';
    }
    
    html += '<h3>🎴 Дурак</h3>';
    html += '<div class="game-info">';
    html += '<div>Козырь: <span class="trump-suit ' + (window.gameState.trumpSuit ? getSuitClass(window.gameState.trumpSuit) : '') + '">' + (window.gameState.trumpSuit || '?') + '</span></div>';
    html += '<div>Карт в колоде: ' + (window.gameState.deck ? window.gameState.deck.length : 0) + '</div>';
    
    // Показываем кто сейчас атакует
    const currentPhase = window.gameState.gamePhase === 'attack' ? 'Атака' : 'Защита';
    const currentAttacker = window.gameState.currentAttacker === 'player' ? 'Вы' : 'Противник';
    html += '<div>Фаза: ' + currentPhase + ' (' + currentAttacker + ')</div>';
    html += '</div>';
    
    // Карты противника (вверху)
    html += '<div class="opponent-cards">';
    html += '<h4>Карты противника (' + window.gameState.opponentHand.length + '):</h4>';
    html += '<div class="cards-hand opponent-hand">';
    for (let i = 0; i < window.gameState.opponentHand.length; i++) {
        html += '<div class="card card-back">🂠</div>';
    }
    html += '</div>';
    html += '</div>';
    
    // Ваши карты (внизу)
    html += '<div class="player-cards">';
    html += '<h4>Ваши карты:</h4>';
    html += '<div class="cards-hand player-hand">';
    for (let i = 0; i < window.gameState.playerHand.length; i++) {
        const card = window.gameState.playerHand[i];
        if (card && card.suit && card.value) {
            const suitClass = getSuitClass(card.suit);
            
            // Проверяем, можно ли играть этой картой
            let canPlay = false;
            try {
                if (window.gameState.gamePhase === 'attack' && window.gameState.currentAttacker === 'player') {
                    // Игрок атакует
                    if (window.gameState.attackingCards.length === 0) {
                        canPlay = true; // Первая атака - любой картой
                    } else {
                        canPlay = canAttackOrThrowCard && canAttackOrThrowCard(card);
                    }
                } else if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'player') {
                    // Игрок атаковал, бот защищается, игрок может подкинуть
                    // Проверяем, все ли карты отбиты
                    const allDefended = window.gameState.attackingCards.every((_, index) => window.gameState.defendingCards[index]);
                    if (allDefended) {
                        canPlay = canAttackOrThrowCard && canAttackOrThrowCard(card);
                    }
                } else if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'bot') {
                    // Игрок защищается от бота
                    const undefendedCards = window.gameState.attackingCards.filter((_, index) => !window.gameState.defendingCards[index]);
                    canPlay = undefendedCards.some(attackCard => canDefendCard && canDefendCard(card, attackCard));
                } else if (window.gameState.gamePhase === 'attack' && window.gameState.currentAttacker === 'bot') {
                    // Бот атаковал, но еще не все карты отбиты - игрок может подкинуть
                    const allDefended = window.gameState.attackingCards.every((_, index) => window.gameState.defendingCards[index]);
                    if (allDefended) {
                        canPlay = canAttackOrThrowCard && canAttackOrThrowCard(card);
                    }
                }
            } catch (e) {
                console.error('Error checking if card can be played:', e);
                canPlay = true; // По умолчанию разрешаем играть картой
            }
            
            const playableClass = canPlay ? ' playable' : '';
            html += '<div class="card ' + suitClass + playableClass + '" data-index="' + i + '" onclick="playDurakCard(' + i + ')">';
            html += '<div class="card-value">' + card.value + '</div>';
            html += '<div class="card-suit">' + card.suit + '</div>';
            html += '</div>';
        }
    }
    html += '</div>';
    html += '</div>';
    
    // Стол (посередине)
    html += '<div class="durak-table">';
    html += '<h4>Стол:</h4>';
    html += '<div class="table-cards">';
    for (let i = 0; i < window.gameState.attackingCards.length; i++) {
        const attackCard = window.gameState.attackingCards[i];
        const defendCard = window.gameState.defendingCards[i];
        
        html += '<div class="card-pair">';
        html += '<div class="card ' + getSuitClass(attackCard.suit) + ' attacking">';
        html += '<div class="card-value">' + attackCard.value + '</div>';
        html += '<div class="card-suit">' + attackCard.suit + '</div>';
        html += '</div>';
        
        if (defendCard) {
            html += '<div class="card ' + getSuitClass(defendCard.suit) + ' defending">';
            html += '<div class="card-value">' + defendCard.value + '</div>';
            html += '<div class="card-suit">' + defendCard.suit + '</div>';
            html += '</div>';
        }
        html += '</div>';
    }
    html += '</div>';
    html += '</div>';
    
    // Кнопки управления
    html += '<div class="durak-controls">';
    
    // Показываем разные кнопки в зависимости от фазы игры
    if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'bot') {
        // Бот атакует, игрок защищается
        html += '<button onclick="takeDurakCards()" class="action-btn">Взять карты</button>';
        html += '<button onclick="passDurakTurn()" class="action-btn">Пас (взять)</button>';
    }
    
    if (window.gameState.gamePhase === 'attack' && window.gameState.currentAttacker === 'player') {
        // Игрок атакует - может пасовать (завершить атаку)
        if (window.gameState.attackingCards.length > 0) {
            html += '<button onclick="passDurakTurn()" class="action-btn">Пас (завершить атаку)</button>';
        }
    }
    
    if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'player') {
        // Игрок атаковал, бот отбился, игрок может подкинуть или пасовать
        const allDefended = window.gameState.attackingCards.every((_, index) => window.gameState.defendingCards[index]);
        if (allDefended && window.gameState.attackingCards.length > 0) {
            html += '<button onclick="passDurakTurn()" class="action-btn">Пас (отбой)</button>';
        }
    }
    
    if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'bot') {
        // Бот атаковал, игрок отбился, теперь игрок может пасовать для отбоя
        const allDefended = window.gameState.attackingCards.every((_, index) => window.gameState.defendingCards[index]);
        if (allDefended && window.gameState.attackingCards.length > 0) {
            html += '<button onclick="passDurakTurn()" class="action-btn">Пас (отбой)</button>';
        }
    }
    
    html += '<button onclick="newDurakRound()" class="action-btn">Новая игра</button>';
    html += '<button onclick="closeGame()" class="back-btn">Назад к меню</button>';
    html += '</div>';
    
    html += '</div>';
    
    try {
        gamePanel.innerHTML = html;
        console.log('Durak HTML set successfully');
    } catch (e) {
        console.error('Error setting durak HTML:', e);
    }
}

// Тестовая функция для дурака
function testDurak() {
    console.log('testDurak called');
    
    // Устанавливаем бота как противника
    window.currentOpponent = {
        name: 'Умный Бот',
        emoji: '🤖',
        type: 'bot'
    };
    
    // Запускаем игру
    startDurak();
}

function getSuitClass(suit) {
    switch(suit) {
        case '♥': return 'hearts';
        case '♦': return 'diamonds';
        case '♣': return 'clubs';
        case '♠': return 'spades';
        default: return '';
    }
}

function addPokerCardHandlers() {
    const cards = document.querySelectorAll('.player-cards .card');
    cards.forEach(card => {
        card.addEventListener('click', function() {
            // Убираем выделение у всех карт
            cards.forEach(c => c.classList.remove('selected'));
            
            // Переключаем выделение только этой карты
            this.classList.toggle('selected');
        });
    });
}

function exchangeCards() {
    const selectedCards = document.querySelectorAll('.player-cards .card.selected');
    if (selectedCards.length === 0) {
        // Показываем сообщение в центральной области
        const statusElement = document.querySelector('.poker-status');
        if (statusElement) {
            statusElement.innerHTML = '<div style="color: #dc3545;">Выберите карту для обмена</div>';
        }
        return;
    }
    
    // Меняем только одну выбранную карту
    const selectedCard = selectedCards[0];
    const index = parseInt(selectedCard.dataset.index);
    
    if (window.gameState.deck.length > 0) {
        window.gameState.playerHand[index] = window.gameState.deck.pop();
        
        // Отправляем ход на сервер, если играем с игроком
        if (window.socket && window.roomId && window.currentOpponent?.type === 'player') {
            window.socket.emit('game-move', {
                roomId: window.roomId,
                gameType: 'poker',
                move: {
                    action: 'exchange',
                    cardIndex: index
                }
            });
        }
        
        // Показываем информацию об обмене
        const statusElement = document.querySelector('.poker-status');
        if (statusElement) {
            statusElement.innerHTML = '<div style="color: #28a745;">Карта обменяна! Теперь проверьте комбинацию.</div>';
        }
        
        renderPokerGame();
    } else {
        const statusElement = document.querySelector('.poker-status');
        if (statusElement) {
            statusElement.innerHTML = '<div style="color: #dc3545;">В колоде нет карт для обмена</div>';
        }
    }
}

function getPokerCombination(hand) {
    const values = hand.map(card => card.power).sort((a, b) => a - b);
    const suits = hand.map(card => card.suit);
    
    // Проверяем комбинации
    const isFlush = suits.every(suit => suit === suits[0]);
    const isStraight = values.every((val, i) => i === 0 || val === values[i-1] + 1);
    
    const valueCounts = {};
    values.forEach(val => valueCounts[val] = (valueCounts[val] || 0) + 1);
    const counts = Object.values(valueCounts).sort((a, b) => b - a);
    
    if (isFlush && isStraight) return { name: 'Стрит-флеш', rank: 8 };
    if (counts[0] === 4) return { name: 'Каре', rank: 7 };
    if (counts[0] === 3 && counts[1] === 2) return { name: 'Фул-хаус', rank: 6 };
    if (isFlush) return { name: 'Флеш', rank: 5 };
    if (isStraight) return { name: 'Стрит', rank: 4 };
    if (counts[0] === 3) return { name: 'Тройка', rank: 3 };
    if (counts[0] === 2 && counts[1] === 2) return { name: 'Две пары', rank: 2 };
    if (counts[0] === 2) return { name: 'Пара', rank: 1 };
    return { name: 'Старшая карта', rank: 0 };
}

function checkPokerHand() {
    // Отправляем событие проверки комбинации, если играем с игроком
    if (window.socket && window.roomId && window.currentOpponent?.type === 'player') {
        window.socket.emit('game-move', {
            roomId: window.roomId,
            gameType: 'poker',
            move: {
                action: 'check'
            }
        });
    }
    
    const combination = getPokerCombination(window.gameState.playerHand);
    
    // Если играем с ботом, генерируем комбинацию для бота
    let opponentCombination;
    if (window.currentOpponent?.type === 'bot') {
        // Бот тоже может обменять карты перед проверкой
        makePokerBotMove();
        opponentCombination = getPokerCombination(window.gameState.opponentHand);
    } else {
        opponentCombination = getPokerCombination(window.gameState.opponentHand);
    }
    
    let result = '';
    if (combination.rank > opponentCombination.rank) {
        result = 'Вы выиграли раунд!';
        window.gameState.playerScore++;
    } else if (combination.rank < opponentCombination.rank) {
        result = 'Противник выиграл раунд!';
        window.gameState.opponentScore++;
    } else {
        result = 'Ничья в раунде!';
    }
    
    // Проверяем, не закончилась ли игра
    const WINNING_SCORE = 10;
    if (window.gameState.playerScore >= WINNING_SCORE) {
        window.gameState.gamePhase = 'finished';
        window.gameState.winner = 'player';
        
        // Отправляем событие завершения игры
        if (window.socket && window.roomId && window.currentOpponent?.type === 'player') {
            window.socket.emit('game-ended', {
                roomId: window.roomId,
                winner: 'player',
                gameType: 'poker'
            });
        }
    } else if (window.gameState.opponentScore >= WINNING_SCORE) {
        window.gameState.gamePhase = 'finished';
        window.gameState.winner = 'opponent';
        
        // Отправляем событие завершения игры
        if (window.socket && window.roomId && window.currentOpponent?.type === 'player') {
            window.socket.emit('game-ended', {
                roomId: window.roomId,
                winner: 'opponent',
                gameType: 'poker'
            });
        }
    } else {
        // Игра продолжается - устанавливаем фазу ожидания
        window.gameState.gamePhase = 'waiting';
    }
    
    // Сначала показываем стол с картами
    renderPokerGame();
    
    // Сохраняем результаты для показа через 2 секунды
    window.gameState.lastResult = {
        combination,
        opponentCombination,
        result
    };
    
    // Через 2 секунды показываем результат
    setTimeout(() => {
        showPokerResult();
    }, 2000);
}

function showPokerResult() {
    if (!window.gameState.lastResult) return;
    
    const { combination, opponentCombination, result } = window.gameState.lastResult;
    
    // Показываем результат в центральной области
    const statusElement = document.querySelector('.poker-status');
    if (statusElement) {
        if (window.gameState.gamePhase === 'finished') {
            // Игра окончена - показываем финальный результат
            statusElement.innerHTML = `
                <div style="margin-bottom: 10px;"><strong>Результат раунда ${window.gameState.round}:</strong></div>
                <div>Ваша комбинация: <span style="color: var(--accent-primary);">${combination.name}</span></div>
                <div>Комбинация противника: <span style="color: var(--accent-primary);">${opponentCombination.name}</span></div>
                <div style="margin-top: 20px; font-size: 32px; font-weight: bold; color: ${result.includes('Вы выиграли') ? '#28a745' : result.includes('Противник выиграл') ? '#dc3545' : '#ffc107'};">${result.includes('Вы выиграли') ? 'ПОБЕДА!' : result.includes('Противник выиграл') ? 'ПОРАЖЕНИЕ!' : 'НИЧЬЯ!'}</div>
                <div style="margin-top: 10px; color: #666;">Новый раунд через 3 секунды...</div>
            `;
            
            // Автоматически начинаем новый раунд через 3 секунды
            setTimeout(() => {
                newPokerRound();
            }, 3000);
        } else {
            // Обычный раунд - показываем результат и ждем действий игрока
            statusElement.innerHTML = `
                <div style="margin-bottom: 10px;"><strong>Результат раунда ${window.gameState.round}:</strong></div>
                <div>Ваша комбинация: <span style="color: var(--accent-primary);">${combination.name}</span></div>
                <div>Комбинация противника: <span style="color: var(--accent-primary);">${opponentCombination.name}</span></div>
                <div style="margin-top: 20px; font-size: 32px; font-weight: bold; color: ${result.includes('Вы выиграли') ? '#28a745' : result.includes('Противник выиграл') ? '#dc3545' : '#ffc107'};">${result.includes('Вы выиграли') ? 'ПОБЕДА!' : result.includes('Противник выиграл') ? 'ПОРАЖЕНИЕ!' : 'НИЧЬЯ!'}</div>
                <div style="margin-top: 10px; color: #666;">Новый раунд через 3 секунды...</div>
            `;
            
            // Автоматически начинаем новый раунд через 3 секунды
            setTimeout(() => {
                newPokerRound();
            }, 3000);
        }
    }
    
    // Не вызываем renderPokerGame() здесь, чтобы не перезаписать результат
}

function makePokerBotMove() {
    if (window.currentOpponent?.type !== 'bot') return;
    
    // Простая логика бота для покера: обменивает слабые карты
    const hand = window.gameState.opponentHand;
    const combination = getPokerCombination(hand);
    
    // Если у бота уже хорошая комбинация (пара или лучше), не меняет карты
    if (combination.rank >= 2) return;
    
    // Иначе меняет 1-3 случайные карты
    const cardsToChange = Math.floor(Math.random() * 3) + 1;
    const changedIndices = [];
    
    for (let i = 0; i < cardsToChange; i++) {
        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * hand.length);
        } while (changedIndices.includes(randomIndex));
        
        changedIndices.push(randomIndex);
        
        if (window.gameState.deck.length > 0) {
            window.gameState.opponentHand[randomIndex] = window.gameState.deck.pop();
        }
    }
}

function newPokerRound() {
    if (window.gameState.gamePhase === 'finished') {
        // Игра окончена, начинаем новую игру
        startNewPokerGame();
        return;
    }
    
    // Увеличиваем счетчик раундов
    window.gameState.round++;
    // Сбрасываем фазу к обмену карт
    window.gameState.gamePhase = 'exchange';
    
    createDeck();
    shuffleDeck();
    dealPokerCards();
    renderPokerGame();
}

// Дурак функции
function playDurakCard(cardIndex) {
    const card = window.gameState.playerHand[cardIndex];
    
    if (window.gameState.gamePhase === 'attack' && window.gameState.currentAttacker === 'player') {
        // Игрок атакует - проверяем, можно ли атаковать или подкидывать этой картой
        if (canAttackOrThrowCard(card)) {
            window.gameState.attackingCards.push(card);
            window.gameState.playerHand.splice(cardIndex, 1);
            window.gameState.gamePhase = 'defend';
            
            // Если играем с ботом, бот пытается защититься
            if (window.currentOpponent?.type === 'bot') {
                setTimeout(() => {
                    makeDurakBotDefense();
                }, 1000);
            }
        } else {
            alert('Нельзя атаковать этой картой! Можно подкидывать только карты того же достоинства, что уже лежат на столе.');
            return;
        }
    } else if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'bot') {
        // Игрок защищается от атаки бота
        const undefendedCards = window.gameState.attackingCards.filter((_, index) => !window.gameState.defendingCards[index]);
        
        if (undefendedCards.length > 0) {
            const cardToDefend = undefendedCards[0]; // Берем первую неотбитую карту
            
            if (canDefendCard(card, cardToDefend)) {
                window.gameState.defendingCards.push(card);
                window.gameState.playerHand.splice(cardIndex, 1);
                
                // Проверяем, все ли карты отбиты
                if (window.gameState.attackingCards.length === window.gameState.defendingCards.length) {
                    // Все карты отбиты, убираем их со стола
                    window.gameState.attackingCards = [];
                    window.gameState.defendingCards = [];
                    window.gameState.gamePhase = 'attack';
                    window.gameState.currentAttacker = 'player'; // Теперь игрок атакует
                    refillDurakHands();
                } else {
                    // Еще есть неотбитые карты, бот может подкинуть
                    window.gameState.gamePhase = 'attack';
                    window.gameState.currentAttacker = 'bot';
                    // Бот может подкинуть карты
                    setTimeout(() => {
                        makeDurakBotThrow();
                    }, 1000);
                }
            } else {
                alert('Эта карта не может побить атакующую!');
                return;
            }
        }
    } else if (window.gameState.gamePhase === 'attack' && window.gameState.currentAttacker === 'bot') {
        // Игрок пытается подкинуть карты когда атакует бот
        if (canAttackOrThrowCard(card)) {
            window.gameState.attackingCards.push(card);
            window.gameState.playerHand.splice(cardIndex, 1);
            window.gameState.gamePhase = 'defend';
            
            // Бот пытается защититься от подкинутой карты
            if (window.currentOpponent?.type === 'bot') {
                setTimeout(() => {
                    makeDurakBotDefense();
                }, 1000);
            }
        } else {
            alert('Нельзя подкидывать эту карту! Можно подкидывать только карты того же достоинства.');
            return;
        }
    } else {
        alert('Сейчас не ваш ход!');
        return;
    }
    
    renderDurakGame();
}

function canAttackOrThrowCard(card) {
    // Если стол пустой, можно атаковать любой картой
    if (window.gameState.attackingCards.length === 0 && window.gameState.defendingCards.length === 0) {
        return true;
    }
    
    // Если на столе есть карты, можно подкидывать только карты того же достоинства
    const tableCards = [...window.gameState.attackingCards, ...window.gameState.defendingCards];
    return tableCards.some(tableCard => tableCard.value === card.value);
}

function makeDurakBotDefense() {
    if (window.currentOpponent?.type !== 'bot') return;
    
    console.log('Бот пытается защититься');
    console.log('Состояние стола:', {
        attackingCards: window.gameState.attackingCards,
        defendingCards: window.gameState.defendingCards,
        gamePhase: window.gameState.gamePhase,
        currentAttacker: window.gameState.currentAttacker
    });
    
    const analyzer = window.durakAnalyzer;
    const analysis = analyzer.analyzeGameState();
    
    // Находим все неотбитые карты
    const undefendedCards = analysis.undefendedCards;
    console.log('Неотбитые карты:', undefendedCards);
    
    if (undefendedCards.length === 0) {
        console.log('Все карты отбиты, переходим к подкидыванию');
        // Все карты отбиты, бот может подкинуть
        if (window.currentOpponent?.type === 'bot') {
            setTimeout(() => {
                makeDurakBotThrow();
            }, 1000);
        }
        return;
    }
    
    const cardToDefend = undefendedCards[0];
    console.log('Защищаемся от карты:', cardToDefend);
    
    // Используем умный анализ для выбора защитной карты
    const bestDefenseCard = analyzer.getBestDefenseCard(cardToDefend);
    console.log('Лучшая защитная карта:', bestDefenseCard);
    
    // Оценка риска взятия карт
    const riskScore = analyzer.evaluateRisk();
    const shouldDefend = bestDefenseCard && (riskScore < 8 || Math.random() < 0.85);
    console.log('Риск:', riskScore, 'Защищаться:', shouldDefend);
    
    if (shouldDefend) {
        const cardIndex = window.gameState.opponentHand.indexOf(bestDefenseCard);
        if (cardIndex !== -1) {
            window.gameState.defendingCards.push(bestDefenseCard);
            window.gameState.opponentHand.splice(cardIndex, 1);
            
            console.log(`Бот защищается картой: ${bestDefenseCard.value}${bestDefenseCard.suit} от ${cardToDefend.value}${cardToDefend.suit}`);
            
            // Проверяем, все ли карты отбиты
            if (window.gameState.attackingCards.length === window.gameState.defendingCards.length) {
                // Все карты отбиты, но игрок может подкинуть
                // Фаза остается 'defend', но теперь игрок может подкидывать
                console.log('Все карты отбиты, игрок может подкинуть или пасовать');
                // НЕ очищаем стол и НЕ меняем атакующего - игрок может подкинуть
                // НЕ делаем автоматический отбой - только по кнопке "Пас"
            } else {
                // Еще есть неотбитые карты, продолжаем защиту
                console.log('Остались неотбитые карты, продолжаем защиту');
            }
            
            renderDurakGame();
            return;
        }
    }
    
    // Если не может или не хочет защищаться, берет карты
    console.log(`Бот берет карты (риск: ${riskScore})`);
    takeDurakCardsBot();
}

function makeDurakBotThrow() {
    if (window.currentOpponent?.type !== 'bot') return;
    
    // Бот может подкидывать только если он НЕ защищается
    // Если currentAttacker === 'player', то бот защищается и НЕ может подкидывать
    if (window.gameState.currentAttacker === 'player') {
        console.log('Бот не может подкидывать - он защищается');
        return;
    }
    
    console.log('Бот пытается подкинуть карты (бот атакует)');
    console.log('Состояние стола:', {
        attackingCards: window.gameState.attackingCards,
        defendingCards: window.gameState.defendingCards,
        botHand: window.gameState.opponentHand
    });
    
    const analyzer = window.durakAnalyzer;
    const analysis = analyzer.analyzeGameState();
    
    // Получаем карты для подкидывания
    const throwableCards = analyzer.getThrowableCards();
    console.log('Карты для подкидывания:', throwableCards);
    
    // Бот подкидывает с умной логикой
    if (throwableCards.length > 0) {
        const playerHandSize = window.gameState.playerHand.length;
        const botHandSize = window.gameState.opponentHand.length;
        
        // Подкидываем чаще если у игрока мало карт
        const throwProbability = playerHandSize <= 3 ? 0.9 : 
                                playerHandSize <= 5 ? 0.7 : 0.4; // Уменьшили вероятность
        
        console.log('Вероятность подкидывания:', throwProbability);
        
        if (Math.random() < throwProbability) {
            // Выбираем самую слабую подходящую карту
            const cardToThrow = throwableCards.reduce((weakest, card) => 
                card.power < weakest.power ? card : weakest
            );
            
            const cardIndex = window.gameState.opponentHand.indexOf(cardToThrow);
            if (cardIndex !== -1) {
                window.gameState.attackingCards.push(cardToThrow);
                window.gameState.opponentHand.splice(cardIndex, 1);
                window.gameState.gamePhase = 'defend';
                
                console.log(`Бот подкидывает карту: ${cardToThrow.value}${cardToThrow.suit}`);
                renderDurakGame();
                return;
            }
        } else {
            console.log('Бот решил не подкидывать карты (вероятность)');
        }
    } else {
        console.log('У бота нет карт для подкидывания - пасует');
    }
    
    // Если не подкидывает, ждем действий игрока
    console.log('Бот не подкидывает карты - ждет действий игрока');
    
    // НЕ делаем автоматический отбой - игрок должен нажать "Пас"
    // Просто перерисовываем игру, чтобы показать кнопку "Пас (отбой)"
    renderDurakGame();
}

// ===== СИСТЕМА АНАЛИЗА ДУРАКА ДЛЯ БОТА =====

class DurakBotAnalyzer {
    constructor() {
        this.trumpSuit = null;
        this.gameState = null;
    }
    
    // Анализ текущего состояния игры
    analyzeGameState() {
        this.trumpSuit = window.gameState.trumpSuit;
        this.gameState = window.gameState;
        
        return {
            tableCards: this.getTableCards(),
            undefendedCards: this.getUndefendedCards(),
            botHand: this.analyzeBotHand(),
            gamePhase: this.gameState.gamePhase,
            currentAttacker: this.gameState.currentAttacker,
            canThrow: this.canThrowCards(),
            trumpsOnTable: this.getTrumpsOnTable()
        };
    }
    
    // Получить все карты на столе
    getTableCards() {
        return [
            ...this.gameState.attackingCards,
            ...this.gameState.defendingCards
        ];
    }
    
    // Получить неотбитые карты
    getUndefendedCards() {
        return this.gameState.attackingCards.filter((_, index) => 
            !this.gameState.defendingCards[index]
        );
    }
    
    // Анализ карт бота
    analyzeBotHand() {
        const hand = this.gameState.opponentHand;
        
        return {
            cards: hand,
            trumps: hand.filter(card => card.suit === this.trumpSuit),
            nonTrumps: hand.filter(card => card.suit !== this.trumpSuit),
            lowCards: hand.filter(card => card.power <= 8),
            highCards: hand.filter(card => card.power >= 12),
            cardsByValue: this.groupCardsByValue(hand)
        };
    }
    
    // Группировка карт по достоинству
    groupCardsByValue(cards) {
        const groups = {};
        cards.forEach(card => {
            if (!groups[card.value]) {
                groups[card.value] = [];
            }
            groups[card.value].push(card);
        });
        return groups;
    }
    
    // Проверка возможности подкидывания
    canThrowCards() {
        const tableCards = this.getTableCards();
        if (tableCards.length === 0) return false;
        
        const botHand = this.gameState.opponentHand;
        return botHand.some(card => 
            tableCards.some(tableCard => tableCard.value === card.value)
        );
    }
    
    // Получить козыри на столе
    getTrumpsOnTable() {
        return this.getTableCards().filter(card => card.suit === this.trumpSuit);
    }
    
    // Найти лучшую карту для атаки
    getBestAttackCard() {
        const analysis = this.analyzeBotHand();
        
        // Приоритет: слабые некозырные карты
        if (analysis.nonTrumps.length > 0) {
            const weakNonTrumps = analysis.nonTrumps.filter(card => card.power <= 10);
            if (weakNonTrumps.length > 0) {
                return weakNonTrumps.reduce((weakest, card) => 
                    card.power < weakest.power ? card : weakest
                );
            }
            return analysis.nonTrumps.reduce((weakest, card) => 
                card.power < weakest.power ? card : weakest
            );
        }
        
        // Если только козыри, берем самый слабый
        if (analysis.trumps.length > 0) {
            return analysis.trumps.reduce((weakest, card) => 
                card.power < weakest.power ? card : weakest
            );
        }
        
        return null;
    }
    
    // Найти лучшую карту для защиты
    getBestDefenseCard(attackCard) {
        const botHand = this.gameState.opponentHand;
        const possibleDefenses = botHand.filter(card => 
            this.canDefend(card, attackCard)
        );
        
        if (possibleDefenses.length === 0) return null;
        
        // Приоритет защиты:
        // 1. Некозырная карта той же масти (минимальная)
        // 2. Слабый козырь (если атака не козырем)
        // 3. Сильный козырь (если атака козырем)
        
        const sameSuitDefenses = possibleDefenses.filter(card => 
            card.suit === attackCard.suit && card.suit !== this.trumpSuit
        );
        
        if (sameSuitDefenses.length > 0) {
            return sameSuitDefenses.reduce((weakest, card) => 
                card.power < weakest.power ? card : weakest
            );
        }
        
        const trumpDefenses = possibleDefenses.filter(card => 
            card.suit === this.trumpSuit
        );
        
        if (trumpDefenses.length > 0) {
            return trumpDefenses.reduce((weakest, card) => 
                card.power < weakest.power ? card : weakest
            );
        }
        
        return possibleDefenses.reduce((weakest, card) => 
            card.power < weakest.power ? card : weakest
        );
    }
    
    // Проверка возможности защиты
    canDefend(defenseCard, attackCard) {
        // Карта той же масти и больше по силе
        if (defenseCard.suit === attackCard.suit && defenseCard.power > attackCard.power) {
            return true;
        }
        
        // Козырь бьет некозырь
        if (defenseCard.suit === this.trumpSuit && attackCard.suit !== this.trumpSuit) {
            return true;
        }
        
        // Козырь бьет козырь только если больше
        if (defenseCard.suit === this.trumpSuit && 
            attackCard.suit === this.trumpSuit && 
            defenseCard.power > attackCard.power) {
            return true;
        }
        
        return false;
    }
    
    // Найти карты для подкидывания
    getThrowableCards() {
        const tableCards = this.getTableCards();
        const botHand = this.gameState.opponentHand;
        
        return botHand.filter(card => 
            tableCards.some(tableCard => tableCard.value === card.value)
        );
    }
    
    // Оценка риска взятия карт
    evaluateRisk() {
        const undefended = this.getUndefendedCards();
        const analysis = this.analyzeBotHand();
        
        let riskScore = 0;
        
        // Риск увеличивается с количеством неотбитых карт
        riskScore += undefended.length * 2;
        
        // Риск увеличивается если много козырей на столе
        riskScore += this.getTrumpsOnTable().length * 3;
        
        // Риск уменьшается если у бота много карт
        riskScore -= Math.max(0, analysis.cards.length - 8);
        
        return riskScore;
    }
}

// Создаем глобальный экземпляр анализатора
window.durakAnalyzer = new DurakBotAnalyzer();

// ===== УЛУЧШЕННЫЕ ФУНКЦИИ БОТА =====

function makeDurakBotAttack() {
    if (window.currentOpponent?.type !== 'bot') return;
    
    const analyzer = window.durakAnalyzer;
    const analysis = analyzer.analyzeGameState();
    
    // Используем умный анализ для выбора карты
    const bestCard = analyzer.getBestAttackCard();
    
    if (bestCard) {
        const cardIndex = window.gameState.opponentHand.indexOf(bestCard);
        if (cardIndex !== -1) {
            window.gameState.attackingCards.push(bestCard);
            window.gameState.opponentHand.splice(cardIndex, 1);
            window.gameState.gamePhase = 'defend';
            window.gameState.currentAttacker = 'bot';
            
            console.log(`Бот атакует картой: ${bestCard.value}${bestCard.suit}`);
            renderDurakGame();
        }
    }
}

function refillDurakHands() {
    // Добираем карты до 6 (или сколько есть в колоде)
    // Сначала добирает атакующий, потом защищающийся
    const attackerFirst = window.gameState.currentAttacker === 'player';
    
    if (attackerFirst) {
        // Игрок добирает первым
        while (window.gameState.playerHand.length < 6 && window.gameState.deck.length > 0) {
            window.gameState.playerHand.push(window.gameState.deck.pop());
        }
        while (window.gameState.opponentHand.length < 6 && window.gameState.deck.length > 0) {
            window.gameState.opponentHand.push(window.gameState.deck.pop());
        }
    } else {
        // Бот добирает первым
        while (window.gameState.opponentHand.length < 6 && window.gameState.deck.length > 0) {
            window.gameState.opponentHand.push(window.gameState.deck.pop());
        }
        while (window.gameState.playerHand.length < 6 && window.gameState.deck.length > 0) {
            window.gameState.playerHand.push(window.gameState.deck.pop());
        }
    }
    
    // Проверяем условия окончания игры
    checkDurakGameEnd();
}

function checkDurakGameEnd() {
    const playerHasCards = window.gameState.playerHand.length > 0;
    const botHasCards = window.gameState.opponentHand.length > 0;
    const deckHasCards = window.gameState.deck.length > 0;
    
    // Игра заканчивается когда у одного из игроков нет карт и колода пуста
    if (!deckHasCards) {
        if (!playerHasCards && botHasCards) {
            setTimeout(() => {
                alert('🎉 Поздравляем! Вы выиграли!');
                newDurakRound();
            }, 500);
        } else if (!botHasCards && playerHasCards) {
            setTimeout(() => {
                alert('😔 Вы проиграли! Противник выиграл.');
                newDurakRound();
            }, 500);
        } else if (!playerHasCards && !botHasCards) {
            setTimeout(() => {
                alert('🤝 Ничья! У обоих игроков закончились карты.');
                newDurakRound();
            }, 500);
        }
    }
}

// Валидация действий бота
function validateBotAction(action, card, targetCard = null) {
    const analyzer = window.durakAnalyzer;
    
    switch (action) {
        case 'attack':
            // Проверяем, может ли бот атаковать этой картой
            if (window.gameState.attackingCards.length === 0) {
                return true; // Первая атака - любой картой
            }
            // Подкидывание - только карты того же достоинства
            const tableCards = [...window.gameState.attackingCards, ...window.gameState.defendingCards];
            return tableCards.some(tableCard => tableCard.value === card.value);
            
        case 'defend':
            // Проверяем, может ли бот защититься этой картой
            if (!targetCard) return false;
            return analyzer.canDefend(card, targetCard);
            
        case 'throw':
            // Проверяем, может ли бот подкинуть эту карту
            const allTableCards = [...window.gameState.attackingCards, ...window.gameState.defendingCards];
            return allTableCards.some(tableCard => tableCard.value === card.value);
            
        default:
            return false;
    }
}

function takeDurakCardsBot() {
    // Бот берет все карты со стола
    window.gameState.attackingCards.forEach(card => {
        window.gameState.opponentHand.push(card);
    });
    window.gameState.defendingCards.forEach(card => {
        window.gameState.opponentHand.push(card);
    });
    
    window.gameState.attackingCards = [];
    window.gameState.defendingCards = [];
    window.gameState.gamePhase = 'attack';
    window.gameState.currentAttacker = 'player'; // Игрок атакует, так как бот взял карты
    
    renderDurakGame();
}

function canDefendCard(defendCard, attackCard) {
    // Можно бить картой той же масти, но большего достоинства
    if (defendCard.suit === attackCard.suit && defendCard.power > attackCard.power) {
        return true;
    }
    
    // Можно бить козырем, если атакующая карта не козырь
    if (defendCard.suit === window.gameState.trumpSuit && attackCard.suit !== window.gameState.trumpSuit) {
        return true;
    }
    
    // Козырь можно бить только более старшим козырем
    if (defendCard.suit === window.gameState.trumpSuit && 
        attackCard.suit === window.gameState.trumpSuit && 
        defendCard.power > attackCard.power) {
        return true;
    }
    
    return false;
}

function playDurakCard(cardIndex) {
    const card = window.gameState.playerHand[cardIndex];
    console.log('Играем картой:', card, 'Фаза:', window.gameState.gamePhase, 'Атакующий:', window.gameState.currentAttacker);
    
    if (!card) {
        console.error('Карта не найдена по индексу:', cardIndex);
        return;
    }
    
    if (window.gameState.gamePhase === 'attack' && window.gameState.currentAttacker === 'player') {
        // Игрок атакует
        if (window.gameState.attackingCards.length === 0) {
            // Первая атака - любой картой
            window.gameState.attackingCards.push(card);
            window.gameState.playerHand.splice(cardIndex, 1);
            window.gameState.gamePhase = 'defend';
            // currentAttacker остается 'player' - он атакует, бот защищается
            console.log('Первая атака картой:', card);
            
            renderDurakGame();
            
            // Бот пытается защититься
            if (window.currentOpponent?.type === 'bot') {
                setTimeout(() => {
                    makeDurakBotDefense();
                }, 1000);
            }
        } else {
            // Подкидывание - только карты того же достоинства что уже на столе
            if (canAttackOrThrowCard(card)) {
                window.gameState.attackingCards.push(card);
                window.gameState.playerHand.splice(cardIndex, 1);
                console.log('Подкидываем карту:', card);
                
                renderDurakGame();
                
                // Бот пытается защититься от новой карты
                if (window.currentOpponent?.type === 'bot') {
                    setTimeout(() => {
                        makeDurakBotDefense();
                    }, 1000);
                }
            } else {
                alert('Нельзя подкинуть эту карту! Можно подкидывать только карты того же достоинства, что уже лежат на столе.');
            }
        }
    } else if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'bot') {
        // Игрок защищается от атаки бота
        const undefendedCards = window.gameState.attackingCards.filter((_, index) => !window.gameState.defendingCards[index]);
        
        if (undefendedCards.length === 0) {
            alert('Все карты уже отбиты!');
            return;
        }
        
        // Ищем первую неотбитую карту, которую можно отбить этой картой
        let defendedIndex = -1;
        for (let i = 0; i < window.gameState.attackingCards.length; i++) {
            if (!window.gameState.defendingCards[i]) {
                const attackCard = window.gameState.attackingCards[i];
                if (canDefendCard(card, attackCard)) {
                    defendedIndex = i;
                    break;
                }
            }
        }
        
        if (defendedIndex !== -1) {
            // Отбиваемся
            window.gameState.defendingCards[defendedIndex] = card;
            window.gameState.playerHand.splice(cardIndex, 1);
            console.log('Отбиваемся картой:', card, 'от карты:', window.gameState.attackingCards[defendedIndex]);
            
            renderDurakGame();
            
            // Проверяем, все ли карты отбиты
            const allDefended = window.gameState.attackingCards.every((_, index) => window.gameState.defendingCards[index]);
            
            if (allDefended) {
                // Все карты отбиты, теперь бот может подкинуть или игрок может пасовать
                console.log('Все карты отбиты, бот может подкинуть, игрок может пасовать');
                if (window.currentOpponent?.type === 'bot') {
                    setTimeout(() => {
                        makeDurakBotThrow();
                    }, 1000);
                }
            } else {
                // Есть еще неотбитые карты, бот должен защищаться
                if (window.currentOpponent?.type === 'bot') {
                    setTimeout(() => {
                        makeDurakBotDefense();
                    }, 1000);
                }
            }
        } else {
            alert('Этой картой нельзя отбиться от атакующих карт!');
        }
    } else if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'player') {
        // Бот отбился от игрока, игрок может подкинуть карты
        console.log('Попытка подкинуть карту после отбоя бота');
        console.log('Все карты отбиты?', window.gameState.attackingCards.every((_, index) => window.gameState.defendingCards[index]));
        console.log('Можно подкинуть эту карту?', canAttackOrThrowCard(card));
        
        if (canAttackOrThrowCard(card)) {
            window.gameState.attackingCards.push(card);
            window.gameState.playerHand.splice(cardIndex, 1);
            console.log('Игрок подкидывает карту после отбоя бота:', card);
            
            renderDurakGame();
            
            // Бот должен защититься от подкинутой карты
            if (window.currentOpponent?.type === 'bot') {
                setTimeout(() => {
                    makeDurakBotDefense();
                }, 1000);
            }
        } else {
            alert('Нельзя подкинуть эту карту! Можно подкидывать только карты того же достоинства, что уже лежат на столе.');
        }
    } else if (window.gameState.gamePhase === 'attack' && window.gameState.currentAttacker === 'bot') {
        // Бот атаковал, игрок может подкинуть если все карты отбиты
        const allDefended = window.gameState.attackingCards.every((_, index) => window.gameState.defendingCards[index]);
        
        if (allDefended && canAttackOrThrowCard(card)) {
            window.gameState.attackingCards.push(card);
            window.gameState.playerHand.splice(cardIndex, 1);
            window.gameState.gamePhase = 'defend';
            console.log('Игрок подкидывает карту после отбоя:', card);
            
            renderDurakGame();
            
            // Бот пытается защититься от подкинутой карты
            if (window.currentOpponent?.type === 'bot') {
                setTimeout(() => {
                    makeDurakBotDefense();
                }, 1000);
            }
        } else if (!allDefended) {
            alert('Сначала нужно отбить все атакующие карты!');
        } else {
            alert('Нельзя подкинуть эту карту! Можно подкидывать только карты того же достоинства, что уже лежат на столе.');
        }
    } else {
        console.log('Сейчас не ваш ход или неподходящая фаза игры');
    }
}

function canAttackWith(card) {
    if (window.gameState.attackingCards.length === 0) return true;
    
    // Можно атаковать картой того же достоинства, что уже есть на столе
    const tableValues = [...window.gameState.attackingCards, ...window.gameState.defendingCards]
        .map(c => c.value);
    return tableValues.includes(card.value);
}

function canDefendWith(defendCard, attackCard) {
    // Можно бить старшей картой той же масти или козырем
    if (defendCard.suit === attackCard.suit) {
        return defendCard.power > attackCard.power;
    }
    
    // Козырем можно бить любую некозырную карту
    if (defendCard.suit === window.gameState.trumpSuit && attackCard.suit !== window.gameState.trumpSuit) {
        return true;
    }
    
    // Козырем можно бить меньший козырь
    if (defendCard.suit === window.gameState.trumpSuit && attackCard.suit === window.gameState.trumpSuit) {
        return defendCard.power > attackCard.power;
    }
    
    return false;
}

function defendWithAI() {
    const lastAttackCard = window.gameState.attackingCards[window.gameState.attackingCards.length - 1];
    const defendingCard = window.gameState.opponentHand.find(card => canDefendWith(card, lastAttackCard));
    
    if (defendingCard) {
        const index = window.gameState.opponentHand.indexOf(defendingCard);
        window.gameState.defendingCards.push(defendingCard);
        window.gameState.opponentHand.splice(index, 1);
        window.gameState.gamePhase = 'attack';
        
        if (window.gameState.attackingCards.length === window.gameState.defendingCards.length) {
            endDurakRound();
        }
    } else {
        // ИИ берёт карты
        window.gameState.opponentHand.push(...window.gameState.attackingCards);
        window.gameState.attackingCards = [];
        window.gameState.defendingCards = [];
        window.gameState.gamePhase = 'attack';
        drawDurakCards();
    }
    
    renderDurakGame();
}

function takeDurakCards() {
    console.log('Игрок берет карты со стола');
    console.log('Карты на столе перед взятием:', {
        attackingCards: window.gameState.attackingCards,
        defendingCards: window.gameState.defendingCards
    });
    console.log('Количество карт у игрока до взятия:', window.gameState.playerHand.length);
    
    // Игрок берёт все карты со стола
    window.gameState.playerHand.push(...window.gameState.attackingCards);
    window.gameState.playerHand.push(...window.gameState.defendingCards);
    window.gameState.attackingCards = [];
    window.gameState.defendingCards = [];
    
    console.log('Карты взяты игроком, количество карт у игрока:', window.gameState.playerHand.length);
    
    // Тот кто атаковал, продолжает атаковать (по правилам дурака)
    // Если игрок взял карты, то атакующий остается тем же
    window.gameState.gamePhase = 'attack';
    
    // Добираем карты
    refillDurakHands();
    
    renderDurakGame();
    
    // Если атакует бот, делаем его ход
    if (window.gameState.currentAttacker === 'bot' && window.currentOpponent?.type === 'bot') {
        setTimeout(() => {
            makeDurakBotAttack();
        }, 1000);
    }
}

function passDurakTurn() {
    console.log('Пас в дураке');
    console.log('Текущая фаза:', window.gameState.gamePhase, 'Атакующий:', window.gameState.currentAttacker);
    console.log('Карты на столе:', {
        attackingCards: window.gameState.attackingCards,
        defendingCards: window.gameState.defendingCards
    });
    
    if (window.gameState.gamePhase === 'attack' && window.gameState.currentAttacker === 'player') {
        // Игрок атакует и пасует - завершаем раунд (отбой)
        console.log('Игрок пасует при атаке - отбой');
        finishDurakRound();
    } else if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'player') {
        // Игрок атаковал, бот отбился, игрок пасует (не подкидывает) - отбой
        console.log('Игрок пасует после отбоя бота - отбой');
        finishDurakRound();
    } else if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'bot') {
        // Бот атаковал, игрок отбился, теперь игрок пасует для отбоя
        console.log('Игрок пасует после отбоя - отбой');
        finishDurakRound();
    } else {
        console.log('Неопределенная ситуация для паса - возможно нужно взять карты?');
        // Если ситуация неясная, проверяем нужно ли взять карты
        if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'bot') {
            console.log('Бот атакует, игрок пасует - берем карты');
            takeDurakCards();
        } else {
            console.log('Другая ситуация - просто перерисовываем');
            renderDurakGame();
        }
    }
}

function finishDurakRound() {
    console.log('Завершение раунда дурака (отбой)');
    console.log('Карты на столе перед отбоем:', {
        attackingCards: window.gameState.attackingCards,
        defendingCards: window.gameState.defendingCards
    });
    
    // Убираем карты со стола (они уходят в отбой)
    window.gameState.attackingCards = [];
    window.gameState.defendingCards = [];
    
    console.log('Карты очищены со стола');
    console.log('Количество карт у игрока:', window.gameState.playerHand.length);
    console.log('Количество карт у бота:', window.gameState.opponentHand.length);
    
    // Переключаем атакующего - тот кто успешно отбился, теперь атакует
    if (window.gameState.currentAttacker === 'bot') {
        window.gameState.currentAttacker = 'player';
    } else {
        window.gameState.currentAttacker = 'bot';
    }
    
    window.gameState.gamePhase = 'attack';
    
    // Добираем карты
    refillDurakHands();
    
    // Перерисовываем игру
    renderDurakGame();
    
    // Если теперь атакует бот, делаем его ход
    if (window.gameState.currentAttacker === 'bot' && window.currentOpponent?.type === 'bot') {
        setTimeout(() => {
            makeDurakBotAttack();
        }, 1000);
    }
}

function endDurakRound() {
    // Все карты со стола убираются из игры
    window.gameState.attackingCards = [];
    window.gameState.defendingCards = [];
    window.gameState.gamePhase = 'attack';
    
    drawDurakCards();
    
    // Проверяем победу
    if (window.gameState.playerHand.length === 0) {
        alert('Вы выиграли!');
        newDurakRound();
    } else if (window.gameState.opponentHand.length === 0) {
        alert('Противник выиграл!');
        newDurakRound();
    }
}

function drawDurakCards() {
    // Добираем карты до 6 (или сколько есть в колоде)
    while (window.gameState.playerHand.length < 6 && window.gameState.deck.length > 0) {
        window.gameState.playerHand.push(window.gameState.deck.pop());
    }
    while (window.gameState.opponentHand.length < 6 && window.gameState.deck.length > 0) {
        window.gameState.opponentHand.push(window.gameState.deck.pop());
    }
}

function newDurakRound() {
    window.gameState.gameMode = 'durak';
    createDeck();
    shuffleDeck();
    setTrumpSuit();
    dealDurakCards();
    window.gameState.attackingCards = [];
    window.gameState.defendingCards = [];
    window.gameState.gamePhase = 'attack';
    renderDurakGame();
}

function backToMenu() {
    window.gameState.gameMode = 'menu';
    // Закрываем панель активной игры и возвращаемся в главное меню
    closeGame();
}

function handleCardClick(e) {
    if (window.gameState.currentPlayer !== 'player') return;

    const cardIndex = parseInt(e.target.dataset.index);
    const card = window.gameState.playerHand[cardIndex];

    // Отправляем ход на сервер
    window.socket.emit('game_event', {
        game: 'cards',
        data: {
            action: 'play',
            card,
            roomId: window.roomId
        }
    });

    // Обновляем локальное состояние
    window.gameState.tableCards.push(card);
    window.gameState.playerHand.splice(cardIndex, 1);
    window.gameState.currentPlayer = 'opponent';

    // Рендерим в зависимости от режима игры
    if (window.gameState.gameMode === 'poker') {
        renderPokerGame();
    } else if (window.gameState.gameMode === 'durak') {
        renderDurakGame();
    } else {
        renderCardsMenu();
    }

    // Имитируем ход оппонента (в реальной игре это будет приходить от сервера)
    setTimeout(() => {
        if (window.gameState.opponentHand.length > 0) {
            const opponentCardIndex = Math.floor(Math.random() * window.gameState.opponentHand.length);
            const opponentCard = window.gameState.opponentHand[opponentCardIndex];

            window.gameState.tableCards.push(opponentCard);
            window.gameState.opponentHand.splice(opponentCardIndex, 1);
            window.gameState.currentPlayer = 'player';

            // Рендерим в зависимости от режима игры
            if (window.gameState.gameMode === 'poker') {
                renderPokerGame();
            } else if (window.gameState.gameMode === 'durak') {
                renderDurakGame();
            } else {
                renderCardsMenu();
            }
        }
    }, 1000);
}

// === СЕТЕВАЯ СИНХРОНИЗАЦИЯ ===

// Обработчик входящего состояния игры с сервера
if (window.socket) {
    window.socket.on('game-state', (gameState) => {
        console.log('Received game-state:', gameState);
        if (!gameState) return;

        // Проверяем, была ли активная игра закрыта пользователем
        const activeGameClosed = localStorage.getItem('wt_active_game_closed') === 'true';
        if (activeGameClosed) {
            console.log('Active game was closed by user, ignoring game-state');
            return;
        }

        // Сохраняем состояние глобально
        window.gameState = gameState;

        // Рендерим игру только если активная панель игры открыта И выбранная игра соответствует полученному состоянию
        const activeGamePanel = document.getElementById('activeGamePanel');
        if (activeGamePanel && !activeGamePanel.classList.contains('hidden')) {
            // Проверяем что выбранная игра соответствует полученному состоянию
            const activeGameTitle = document.getElementById('activeGameTitle')?.textContent;
            
            // Рендерим игру в зависимости от типа
            if (gameState.gameType === 'chess' && activeGameTitle === 'Шахматы') {
                renderChessBoard();
            } else if (gameState.gameType === 'tictactoe' && activeGameTitle === 'Крестики-нолики') {
                renderTicTacToeBoard();
            } else if (gameState.gameType === 'cards' && activeGameTitle === 'Покер') {
                if (gameState.gameMode === 'poker') {
                    renderPokerGame();
                } else {
                    renderCardsMenu();
                }
            } else if (gameState.gameType === 'cards' && activeGameTitle === 'Дурак') {
                if (gameState.gameMode === 'durak') {
                    renderDurakGame();
                } else {
                    renderCardsMenu();
                }
            } else {
                console.log('Received game state does not match selected game, ignoring');
            }
        } else {
            console.log('Game state received but active game panel is hidden, not rendering');
        }
    });

    window.socket.on('game-closed', () => {
        console.log('Received game-closed event');
        closeGame();
    });
}

// Экспорт функций в глобальную область для использования в onclick-обработчиках HTML
try {
    window.openGame = openGame;
    window.closeGame = closeGame;
    window.startPoker = startPoker;
    window.startDurak = startDurak;
    window.exchangeCards = exchangeCards;
    window.checkPokerHand = checkPokerHand;
    window.newPokerRound = newPokerRound;
    window.playDurakCard = playDurakCard;
    window.takeDurakCards = takeDurakCards;
    window.passDurakTurn = passDurakTurn;
    window.newDurakRound = newDurakRound;
    window.finishDurakRound = finishDurakRound;
    window.backToMenu = backToMenu;
    window.showOpponentSelector = showOpponentSelector;
    window.closeOpponentSelector = closeOpponentSelector;
    window.selectBot = selectBot;
    window.invitePlayer = invitePlayer;
    window.acceptInvitation = acceptInvitation;
    window.declineInvitation = declineInvitation;
    window.updateRoomPlayers = updateRoomPlayers;
    window.makeBotMove = makeBotMove;
    window.makeChessBotMove = makeChessBotMove;
    window.makePokerBotMove = makePokerBotMove;
    window.makeDurakBotDefense = makeDurakBotDefense;
    window.makeDurakBotAttack = makeDurakBotAttack;
    window.makeDurakBotThrow = makeDurakBotThrow;
    window.canAttackOrThrowCard = canAttackOrThrowCard;
    window.refillDurakHands = refillDurakHands;
    window.determineFirstPlayer = determineFirstPlayer;
    window.checkDurakGameEnd = checkDurakGameEnd;
    window.validateBotAction = validateBotAction;
    window.durakAnalyzer = window.durakAnalyzer;
    window.testDurak = testDurak;
    window.startNewPokerGame = startNewPokerGame;
    window.showPokerResult = showPokerResult;
} catch (e) { 
    console.warn('Error exporting functions to global scope:', e);
}