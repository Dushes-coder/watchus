// games.js - исправленная версия без синтаксических ошибок

// Загрузка модулей динамически
function loadGameModules() {
    return new Promise((resolve, reject) => {
        // Загружаем модули в правильном порядке
        const modules = [
            './js/modules/legacy/legacy-functions.js',
            './js/modules/index.js'
        ];

        let loadedCount = 0;
        const totalModules = modules.length;

        function loadModule(src) {
            const script = document.createElement('script');
            script.src = src;

            // Legacy functions загружаем как обычный скрипт, остальные как модули
            if (src.includes('legacy-functions.js')) {
                // Обычный скрипт для legacy функций
            } else {
                script.type = 'module';
            }

            script.onload = () => {
                loadedCount++;
                console.log(`Loaded module ${loadedCount}/${totalModules}: ${src}`);
                if (loadedCount === totalModules) {
                    console.log('All game modules loaded successfully!');

                    // После загрузки всех модулей переопределяем функции
                    overrideLegacyFunctions();

                    resolve();
                }
            };
            script.onerror = (e) => {
                console.error('Failed to load module:', src, e);
                reject(new Error(`Failed to load ${src}`));
            };
            document.head.appendChild(script);
        }

        // Загружаем модули последовательно
        modules.forEach(loadModule);
    });
}

// Инициализация после загрузки модулей
loadGameModules().then(() => {
    console.log('🎮 Game system initialized successfully');

    // Инициализируем игровую систему
    if (window.initializeGameSystem) {
        window.initializeGameSystem();
    }

    // Инициализируем обработчики приглашений и состояний игры
    initializeGameInvitations();

    // Проверяем, что gameManager доступен
    console.log('GameManager available:', !!window.gameManager);
    console.log('TicTacToeGame available:', !!window.TicTacToeGame);
}).catch((error) => {
    console.error('Failed to load game modules:', error);
});

// Функции-заглушки для синхронного доступа
function initializeGameInvitations() {
    if (!window.socket) return;

    console.log('🎮 Initializing game invitations...');

    // Обработчик обновления состояния игры
    window.socket.on('game-state', (data) => {
        console.log('🎯 Game state update received:', data);
        handleGameStateUpdate(data);
    });

    // Обработчик отклонения приглашения
    window.socket.on('invitation-declined', (data) => {
        console.log('❌ Invitation declined by:', data.playerId);
        showNotification('Приглашение отклонено', 'warning');
    });

    // Обработчик ответа на приглашение
    window.socket.on('game-invitation-response', (data) => {
        console.log('📬 Game invitation response:', data);
        handleInvitationResponse(data);
    });

    // Синхронизирующие события: game-started, game-ended

    // Обработчик начала новой игры
    window.socket.on('game-started', (data) => {
        console.log('🎮 Game started event received:', data);
        // Не инициализируем игру повторно, если она уже активна
        // Для сетевых игр инициализируем, для локальных с ботом - игнорируем
        if (!window.gameManager?.currentGame || window.gameManager.currentGame.gameType !== data.gameType) {
            // Проверяем, что это не локальная игра с ботом
            console.log('Ignoring game-started for local bot game');
        } else {
            console.log('Game already active, just updating state for network games');
            // Обновляем состояние только для сетевых игр
            if (window.gameManager?.currentGame?.currentOpponent?.type === 'player') {
                // Для game-started события не передаем data в handleNetworkMove,
                // так как это не содержит полного gameState
                console.log('Game-started event received, waiting for game-state event');
            }
        }
    });

    console.log('✅ Game invitations initialized');
}

function handleGameStateUpdate(data) {
    console.log('🎯 FULL GAME STATE UPDATE:', data);

    const currentGame = window.gameManager?.currentGame;

    if (data.gameType === 'tictactoe') {
        // Обновляем состояние крестиков-ноликов только для сетевых игр
        console.log('Updating TicTacToe state, currentGame exists:', !!(window.gameManager && window.gameManager.currentGame));
        console.log('Current game type:', window.gameManager?.currentGame?.gameType);
        console.log('Current opponent type:', window.gameManager?.currentGame?.currentOpponent?.type);
        console.log('Game state data received:', data);
        console.log('Current local game state:', window.gameManager?.currentGame?.gameState);
        
        // Игнорируем game-state обновления для локальных игр с ботом
        if (window.gameManager?.currentGame?.currentOpponent?.type === 'bot') {
            console.log('Ignoring game-state update for local bot game');
            return;
        }
        
        if (window.gameManager && window.gameManager.currentGame &&
            window.gameManager.currentGame.gameType === 'tictactoe') {
            // Сбрасываем флаг ожидания хода при получении обновления от сервера
            if (window.gameManager.currentGame.gameState) {
                window.gameManager.currentGame.gameState.waitingForMove = false;
            }
            
            const oldState = window.gameManager.currentGame.gameState;
            const preservedPlayers = oldState.players;
            const mergedState = { ...oldState, ...data };

            if (data.players) {
                mergedState.players = data.players;
            } else if (!mergedState.players && preservedPlayers) {
                mergedState.players = preservedPlayers;
            }

            window.gameManager.currentGame.gameState = mergedState;
            console.log('Updated TicTacToe state from:', oldState, 'to:', mergedState);

            // Переинициализируем символы игроков после обновления состояния
            window.gameManager.currentGame.setupPlayerSymbols();

            // Проверяем, закончилась ли игра
            if (window.gameManager.currentGame.gameState.gameOver) {
                const winner = window.gameManager.currentGame.gameState.winner;
                const mySymbol = window.gameManager.currentGame.mySymbol;
                
                let message, type;
                if (winner === 'draw') {
                    message = '🤝 Ничья!';
                    type = 'info';
                } else if (winner === mySymbol) {
                    message = '🎉 Вы победили!';
                    type = 'success';
                } else {
                    message = '😔 Вы проиграли!';
                    type = 'warning';
                }
                
                console.log('Game ended with result:', { winner, mySymbol, message });
                if (window.showNotification) {
                    window.showNotification(message, type);
                }
            }

            // Перерисовываем доску
            console.log('Calling render on TicTacToe game');
            window.gameManager.currentGame.render();
            console.log('TicTacToe render completed');
        } else {
            console.warn('No TicTacToe game to update or wrong game type');
        }

        return;
    }

    if (data.gameType === 'chess') {
        if (currentGame?.gameType === 'chess' && currentGame?.isNetworkGame) {
            console.log('Passing chess state to current network game');
            currentGame.handleNetworkMove(data);
        } else {
            console.warn('Received chess state update but no active chess network game');
        }
        return;
    }

    // Для остальных сетевых игр передаем gameState в текущую игру
    if (currentGame?.gameType !== 'tictactoe' &&
        (currentGame?.isNetworkGame ||
         (currentGame?.currentOpponent?.type === 'player' &&
          (data.gameType === 'durak' || data.gameType === 'poker')))) {
        console.log('Passing gameState to current network game');
        currentGame.handleNetworkMove(data);
        return;
    }
}

// Показать модальное окно выбора соперника
function showOpponentSelector(gameType) {
    console.log('showOpponentSelector called with:', gameType);
    console.log('Current game state - currentGame:', window.currentGame);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay opponent-selector';
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    console.log('Modal element created');

    let gameIcon = '';
    let gameName = '';
    let botName = '';
    let botDescription = '';
    let botEmoji = '🤖';

    // Для всех игр показываем обычный селектор соперников
    switch (gameType) {
        case 'chess':
            gameIcon = '♟️';
            gameName = 'Шахматы';
            botName = 'Шахматный бот';
            botDescription = 'Умный шахматный соперник';
            botEmoji = '♟️';
            break;
        case 'tictactoe':
            gameIcon = '⭕';
            gameName = 'Крестики-нолики';
            botName = 'Бот';
            botDescription = 'Опытный соперник в крестики-нолики';
            botEmoji = '⭕';
            break;
        case 'poker':
            gameIcon = '🃏';
            gameName = 'Покер';
            botName = 'Покерный бот';
            botDescription = 'Умный покерный соперник';
            botEmoji = '🃏';
            break;
        case 'durak':
            gameIcon = '🎴';
            gameName = 'Дурак';
            botName = 'Карточный бот';
            botDescription = 'Опытный игрок в карты';
            botEmoji = '🎴';
            break;
    }

    let html = '<div class="modal-content opponent-modal">';
    html += '<div class="modal-header">';
    html += '<h3>' + gameIcon + ' Выберите соперника для ' + gameName + '</h3>';
    html += '<button class="secondary icon-btn" onclick="closeOpponentSelector()">✕</button>';
    html += '</div>';

    html += '<div class="opponent-sections">';

    // Секция с ботом
    html += '<div class="opponent-section">';
    html += '<h4>' + botEmoji + ' Игра с ботом</h4>';
    html += '<div class="bot-options">';
    html += '<div class="opponent-option bot-option" onclick="selectBot(\'' + gameType + '\')">';
    html += '<div class="opponent-avatar">' + botEmoji + '</div>';
    html += '<div class="opponent-info">';
    html += '<div class="opponent-name">' + botName + '</div>';
    html += '<div class="opponent-status">' + botDescription + '</div>';
    html += '</div>';
    html += '</div>';
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
    let botName = '';
    let botEmoji = '🤖';

    switch (gameType) {
        case 'chess':
            botName = 'Шахматный бот';
            botEmoji = '♟️';
            break;
        case 'tictactoe':
            botName = 'Бот';
            botEmoji = '⭕';
            break;
        case 'poker':
            botName = 'Покерный бот';
            botEmoji = '🃏';
            break;
        case 'cards':
            botName = 'Карточный бот';
            botEmoji = '🃏';
            break;
        default:
            botName = 'Бот';
            botEmoji = '🤖';
    }

    window.currentOpponent = {
        type: 'bot',
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
        showNotification('Приглашение отправлено! Ожидание ответа...', 'info');
        closeOpponentSelector();
    }
}

function handleInvitationResponse(data) {
    console.log('🎉 HANDLING invitation response:', data);
    if (data.accepted) {
        console.log('✅ Invitation ACCEPTED');
        const opponent = window.roomPlayers.find(p => p.id === data.responderId);
        window.currentOpponent = {
            type: 'player',
            id: data.responderId,
            name: opponent?.name || 'Игрок',
            emoji: opponent?.emoji || '👤'
        };

        // Запускаем игру у отправителя приглашения
        console.log('🚀 Starting game for invitation sender');
        startGameWithOpponent(data.gameType);

        showNotification('Приглашение принято! Начинаем игру.', 'success');
    } else {
        console.log('❌ Invitation DECLINED');
        showNotification('Приглашение отклонено.', 'warning');
    }
}

function startGameWithOpponent(gameType) {
    // Сбрасываем флаг закрытия активной игры, так как пользователь начинает новую
    try { localStorage.removeItem('wt_active_game_closed'); } catch (e) { }

    // Проверяем, не запущена ли уже игра того же типа
    if (window.gameManager?.isGameActive() && window.gameManager.currentGame?.gameType === gameType) {
        console.log('Game already started, skipping startGameWithOpponent');
        return;
    }

    // Закрываем все модальные окна
    closeOpponentSelector();

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
    panel.style.display = ''; // Убираем принудительное скрытие
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Запускаем игру
    switch (gameType) {
        case 'chess':
            if (window.initNetworkChess) window.initNetworkChess();
            break;
        case 'tictactoe':
            if (window.initNetworkTicTacToe) window.initNetworkTicTacToe();
            break;
        case 'poker':
            if (window.selectPoker) window.selectPoker();
            break;
        case 'durak':
            if (window.selectDurak) window.selectDurak();
            break;
        case 'cards':
            initCards();
            break;
    }
}

// Функция для запуска игры дурак
function selectDurak() {
    console.log('selectDurak called');

    // Если игра уже активна, не запускаем новую
    if (window.gameManager.isGameActive() && window.gameManager.currentGame && window.gameManager.currentGame.gameType === 'durak') {
        console.log('Network durak game already active, not starting new one');
        return;
    }

    // Если играем с ботом или не в комнате, запускаем локальную игру
    if (window.currentOpponent?.type === 'bot' || !window.roomId) {
        console.log('Starting local durak game');
        if (window.gameManager) {
            window.gameManager.startGame('durak');
        } else {
            console.error('GameManager not available for durak');
        }
        return;
    }

    console.log('Starting network durak game');
    if (window.gameManager) {
        window.gameManager.startGame('durak');
    } else {
        console.error('GameManager not available for durak network game');
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

function updateParticipantsList() {
    const participantsList = document.getElementById('participantsList');
    const participantCount = document.getElementById('participantCount');

    if (!participantsList || !participantCount) return;

    // Очищаем текущий список
    participantsList.innerHTML = '';

    if (!window.roomPlayers || window.roomPlayers.length === 0) {
        // Нет участников
        participantsList.innerHTML = `
            <div class="no-participants">
                <div class="no-participants-icon">👤</div>
                <div class="no-participants-text">Нет участников</div>
            </div>
        `;
        if (participantCount) participantCount.textContent = '(0)';
        return;
    }

    // Обновляем счетчик участников
    if (participantCount) {
        participantCount.textContent = `(${window.roomPlayers.length})`;
    }

    // Добавляем участников
    window.roomPlayers.forEach(player => {
        const participantDiv = document.createElement('div');
        participantDiv.className = 'participant-item';

        participantDiv.innerHTML = `
            <div class="participant-avatar">${player.emoji || '👤'}</div>
            <div class="participant-info">
                <div class="participant-name">${player.name || 'Игрок'}</div>
                <div class="participant-status">${player.id === window.socket?.id ? 'Вы' : 'В сети'}</div>
            </div>
        `;

        participantsList.appendChild(participantDiv);
    });
}

// Game Functions
function openGame(game) {
    console.log('openGame called with:', game);

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

    // Если не в комнате, автоматически выбрать бота
    if (!window.roomId || !window.socket) {
        console.log('Not in room, auto-selecting bot');
        window.currentOpponent = { type: 'bot', name: 'Бот', emoji: '🤖' };
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
    try { localStorage.removeItem('wt_active_game_closed'); } catch (e) { }

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
        panel.style.display = ''; // Убираем принудительное скрытие
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
    panel.style.display = ''; // Убираем принудительное скрытие
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Показываем контейнер активной игры
    const activeGameContent = document.getElementById('activeGameContent');
    if (activeGameContent) {
        activeGameContent.style.display = ''; // Показываем контейнер
    }

    // Отправляем запрос на сервер для начала игры
    if (window.socket && window.roomId && window.currentOpponent?.type === 'player') {
        window.socket.emit('game-start', {
            roomId: window.roomId,
            gameType: game,
            opponentId: window.currentOpponent.id
        });
    } else {
        // Если играем с ботом или нет подключения, запускаем локально
        console.log('startGameDirectly: starting local game via gameManager');
        const startedGame = window.gameManager?.startGame(game);
        console.log('gameManager.startGame result:', startedGame);
        if (!startedGame) {
            console.error('Failed to start game via gameManager!');
        }
    }
}

function closeGame() {
    console.log('closeGame() called - closing active game');

    // Сохраняем факт того, что пользователь закрыл активную игру
    try { localStorage.setItem('wt_active_game_closed', 'true'); } catch (e) { }

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

    // Очищаем состояние GameManager
    if (window.gameManager) {
        window.gameManager.closeCurrentGame();
    }

    // Восстанавливаем меню игр в gameContainer
    const container = document.getElementById('gameContainer');
    if (container) {
        console.log('Restoring game menu');
        container.style.display = ''; // Показываем контейнер
        container.innerHTML = `
            <h2> 🎮 Игры</h2>
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

                <div class="game-card" onclick="openGame('poker')">
                    <div class="game-icon">🃏</div>
                    <div class="game-title">Покер</div>
                    <div class="game-description">Игра на комбинации из 5 карт</div>
                </div>

                <div class="game-card" onclick="openGame('durak')">
                    <div class="game-icon">🎴</div>
                    <div class="game-title">Дурак</div>
                    <div class="game-description">Классическая русская карточная игра</div>
                </div>
            </div>
        `;
    }

    // Показываем панель игр
    const gamesPanel = document.getElementById('gamesPanel');
    if (gamesPanel) {
        console.log('Showing games panel');
        gamesPanel.classList.remove('collapsed');
        gamesPanel.style.display = ''; // Гарантируем показ панели
    }

    // Показываем контейнер игр
    const gameContainer = document.getElementById('gameContainer');
    if (gameContainer) {
        console.log('Showing game container');
        gameContainer.style.display = ''; // Гарантируем показ контейнера
    }

    // Если игра была сетевой, уведомляем сервер
    if (window.socket && window.roomId) {
        console.log('Notifying server about game end');
        window.socket.emit('leave-game', { roomId: window.roomId });
    }

    console.log('Game closed successfully');
}

// Резервные функции для инициализации игр, если модули не загрузились
function initSimpleChess() {
    console.log('Initializing full chess game');

    // Устанавливаем соперника, если его нет
    if (!window.currentOpponent) {
        window.currentOpponent = { type: 'bot', name: 'Шахматный бот', emoji: '♟️' };
    }

    // Показываем панель игры
    const panel = document.getElementById('activeGamePanel');
    if (panel) {
        document.getElementById('activeGameTitle').textContent = 'Шахматы';
        document.getElementById('activeGameIcon').textContent = '♟️';
        panel.classList.remove('hidden');
        panel.style.display = ''; // Убираем принудительное скрытие
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const container = document.getElementById('activeGameContent');
    if (container) {
        // Создаем шахматную доску с Unicode фигурами
        let html = '<div class="chess-status">Ваш ход (белые фигуры)</div>';
        html += '<div class="chess-board">';

        // Создаем экземпляр игры
        window.chessGame = new ChessGame();

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const isLight = (row + col) % 2 === 0;
                const cellClass = isLight ? 'light' : 'dark';
                const piece = window.chessGame.board[row][col] || '';
                html += `<div class="chess-cell ${cellClass}" data-row="${row}" data-col="${col}">${piece}</div>`;
            }
        }
        html += '</div>';
        html += '<div class="chess-info">';
        html += '<div class="chess-moves">Ходы: 0</div>';
        html += '<div class="chess-status-text">Ход белых</div>';
        html += '</div>';
        html += '<div class="game-controls"><button onclick="closeGame()">Закрыть</button></div>';

        container.innerHTML = html;
        container.style.display = 'block';

        // Добавляем обработчики кликов
        container.querySelectorAll('.chess-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const row = parseInt(cell.dataset.row);
                const col = parseInt(cell.dataset.col);
                handleChessClick(row, col);
            });
        });

        // Обновляем статус
        updateChessStatus();
    }
}

// Обработка кликов по шахматной доске
function handleChessClick(row, col) {
    if (!window.chessGame) return;

    const piece = window.chessGame.board[row][col];
    const pieceColor = window.chessGame.getPieceColor(piece);

    // Если фигура не выбрана
    if (!window.chessGame.selectedSquare) {
        // Выбираем фигуру текущего игрока
        if (piece && pieceColor === window.chessGame.currentPlayer) {
            window.chessGame.selectedSquare = { row, col };
            updateChessBoard();
            highlightPossibleMoves(row, col);
        }
        return;
    }

    const selected = window.chessGame.selectedSquare;

    // Если кликнули на ту же клетку - снимаем выделение
    if (selected.row === row && selected.col === col) {
        window.chessGame.selectedSquare = null;
        updateChessBoard();
        return;
    }

    // Если кликнули на свою фигуру - выбираем её
    if (piece && pieceColor === window.chessGame.currentPlayer) {
        window.chessGame.selectedSquare = { row, col };
        updateChessBoard();
        highlightPossibleMoves(row, col);
        return;
    }

    // Пытаемся сделать ход
    if (window.chessGame.makeMove(selected.row, selected.col, row, col)) {
        window.chessGame.selectedSquare = null;
        updateChessBoard();
        updateChessStatus();

        // Ход ИИ
        if (window.currentOpponent?.type === 'bot' && window.chessGame.currentPlayer === 'black' && window.chessGame.gameStatus === 'playing') {
            setTimeout(() => {
                makeChessAIMove();
            }, 1000);
        }
    } else {
        // Невозможный ход - снимаем выделение
        window.chessGame.selectedSquare = null;
        updateChessBoard();
    }
}

// Ход шахматного ИИ
function makeChessAIMove() {
    if (!window.chessGame || window.chessGame.gameStatus !== 'playing') return;

    const bestMove = window.chessGame.findBestMove(2); // Глубина 2 для быстрого расчета

    if (bestMove) {
        window.chessGame.makeMove(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol);
        updateChessBoard();
        updateChessStatus();
    }
}

// Обновление шахматной доски
function updateChessBoard() {
    if (!window.chessGame) return;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.querySelector(`.chess-cell[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                const piece = window.chessGame.board[row][col] || '';

                // Убираем все классы
                cell.className = cell.className.replace(/selected|valid-move|last-move/g, '');
                cell.classList.remove('selected', 'valid-move', 'last-move');

                // Добавляем базовый класс клетки
                const isLight = (row + col) % 2 === 0;
                cell.classList.add(isLight ? 'light' : 'dark');

                // Добавляем выделение выбранной клетки
                if (window.chessGame.selectedSquare &&
                    window.chessGame.selectedSquare.row === row &&
                    window.chessGame.selectedSquare.col === col) {
                    cell.classList.add('selected');
                }

                // Устанавливаем фигуру
                cell.textContent = piece;
            }
        }
    }
}

// Подсветка возможных ходов
function highlightPossibleMoves(row, col) {
    if (!window.chessGame) return;

    const moves = window.chessGame.getPossibleMoves(row, col);

    moves.forEach(move => {
        const cell = document.querySelector(`.chess-cell[data-row="${move.row}"][data-col="${move.col}"]`);
        if (cell) {
            cell.classList.add('valid-move');
        }
    });
}

// Обновление статуса шахмат
function updateChessStatus() {
    if (!window.chessGame) return;

    const statusEl = document.querySelector('.chess-status');
    const movesEl = document.querySelector('.chess-moves');
    const statusTextEl = document.querySelector('.chess-status-text');

    if (statusEl) {
        statusEl.textContent = window.chessGame.getGameStatusText();
    }

    if (movesEl) {
        movesEl.textContent = `Ходы: ${window.chessGame.moveHistory.length}`;
    }

    if (statusTextEl) {
        if (window.chessGame.gameStatus === 'checkmate' || window.chessGame.gameStatus === 'stalemate') {
            statusTextEl.textContent = 'Игра окончена';
            statusTextEl.style.color = '#dc3545';
        } else if (window.chessGame.gameStatus === 'check') {
            statusTextEl.textContent = 'Шах!';
            statusTextEl.style.color = '#ffc107';
        } else {
            statusTextEl.textContent = `Ход ${window.chessGame.currentPlayer === 'white' ? 'белых' : 'черных'}`;
            statusTextEl.style.color = '';
        }
    }
}

function initSimpleTicTacToe() {
    console.log('Initializing simple tic-tac-toe game');

    // Устанавливаем соперника, если его нет
    if (!window.currentOpponent) {
        window.currentOpponent = { type: 'bot', name: 'Бот', emoji: '⭕' };
    }

    // Показываем панель игры
    const panel = document.getElementById('activeGamePanel');
    if (panel) {
        document.getElementById('activeGameTitle').textContent = 'Крестики-нолики';
        document.getElementById('activeGameIcon').textContent = '⭕';
        panel.classList.remove('hidden');
        panel.style.display = ''; // Убираем принудительное скрытие
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const container = document.getElementById('activeGameContent');
    if (container) {
        // Создаем игровое поле
        const opponentEmoji = window.currentOpponent?.emoji || '🤖';
        const opponentName = window.currentOpponent?.name || 'Бот';

        let html = '<div class="tic-tac-toe-container">';
        html += '<div class="tic-tac-toe-header">';
        html += '<div class="tic-tac-toe-title"><span class="ttt-icon">⭕</span>Крестики-нолики</div>';
        html += '<div class="tic-tac-toe-status">Ваш ход</div>';
        html += '</div>';

        html += '<div class="tic-tac-toe-meta">';
        html += '<div class="ttt-badge player active"><span>⭐</span>Вы (X)</div>';
        html += `<div class="ttt-badge opponent"><span>${opponentEmoji}</span>${opponentName}</div>`;
        html += '</div>';

        html += '<div class="tic-tac-toe-board">';
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                html += `<div class="cell" data-row="${row}" data-col="${col}" onclick="window.handleSimpleTicTacToeClick(${row}, ${col})"></div>`;
            }
        }
        html += '</div>';

        html += '<div class="tic-tac-toe-actions">';
        html += '<button class="secondary" onclick="closeGame()">Закрыть</button>';
        html += '</div>';

        html += '</div>';

        container.innerHTML = html;
        container.style.display = 'block';

        // Инициализируем состояние игры
        window.gameState = {
            board: Array(3).fill().map(() => Array(3).fill('')),
            currentPlayer: 'X',
            gameOver: false,
            winner: null
        };
    }
}

// Вспомогательные функции
function createInitialChessBoard() {
    const board = Array(8).fill().map(() => Array(8).fill(''));
    // Добавляем начальные фигуры с правильными Unicode символами
    const blackPieces = ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'];
    const whitePieces = ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'];

    for (let i = 0; i < 8; i++) {
        board[1][i] = '♟️'; // Черные пешки
        board[6][i] = '♙'; // Белые пешки
        board[0][i] = blackPieces[i]; // Черные фигуры
        board[7][i] = whitePieces[i]; // Белые фигуры
    }
    return board;
}

// Альтернативная функция с ASCII символами для тестирования
function createSimpleChessBoard() {
    const board = Array(8).fill().map(() => Array(8).fill(''));
    // Используем простые ASCII символы вместо Unicode
    const blackPieces = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    const whitePieces = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

    for (let i = 0; i < 8; i++) {
        board[1][i] = 'p'; // Черные пешки
        board[6][i] = 'P'; // Белые пешки
        board[0][i] = blackPieces[i]; // Черные фигуры
        board[7][i] = whitePieces[i]; // Белые фигуры
    }
    return board;
}

// Глобальная функция для обработки кликов по крестикам-ноликам
window.handleSimpleTicTacToeClick = function(row, col) {
    if (window.gameState.gameOver || window.gameState.board[row][col] !== '') {
        return;
    }

    // Делаем ход
    window.gameState.board[row][col] = window.gameState.currentPlayer;

    // Проверяем победителя
    if (checkSimpleWinner(window.gameState.currentPlayer)) {
        window.gameState.gameOver = true;
        window.gameState.winner = window.gameState.currentPlayer;
        updateSimpleTicTacToeDisplay(`Игрок ${window.gameState.currentPlayer} победил!`);
        return;
    }

    // Проверяем ничью
    if (window.gameState.board.flat().every(cell => cell !== '')) {
        window.gameState.gameOver = true;
        window.gameState.winner = 'draw';
        updateSimpleTicTacToeDisplay('Ничья!');
        return;
    }

    // Меняем игрока
    window.gameState.currentPlayer = window.gameState.currentPlayer === 'X' ? 'O' : 'X';
    updateSimpleTicTacToeDisplay(window.gameState.currentPlayer === 'X' ? 'Ваш ход' : 'Ход бота');

    // Ход бота
    if (window.currentOpponent?.type === 'bot' && window.gameState.currentPlayer === 'O' && !window.gameState.gameOver) {
        setTimeout(() => {
            makeSimpleBotMove();
        }, 500);
    }
};

function updateSimpleTicTacToeDisplay(message) {
    const statusEl = document.querySelector('.tic-tac-toe-status');
    if (statusEl) {
        statusEl.textContent = message;
    }

    const playerBadge = document.querySelector('.ttt-badge.player');
    const opponentBadge = document.querySelector('.ttt-badge.opponent');

    if (playerBadge && opponentBadge) {
        playerBadge.classList.remove('active', 'winner', 'draw');
        opponentBadge.classList.remove('active', 'winner', 'draw');

        if (window.gameState.gameOver) {
            const winner = window.gameState.winner;
            if (winner === 'X') {
                playerBadge.classList.add('winner');
            } else if (winner === 'O') {
                opponentBadge.classList.add('winner');
            } else {
                playerBadge.classList.add('draw');
                opponentBadge.classList.add('draw');
            }
        } else {
            const isPlayerTurn = window.gameState.currentPlayer === 'X';
            if (isPlayerTurn) {
                playerBadge.classList.add('active');
            } else {
                opponentBadge.classList.add('active');
            }
        }
    }

    // Обновляем отображение доски
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                cell.textContent = window.gameState.board[row][col];
                cell.className = `cell ${window.gameState.board[row][col].toLowerCase()}`;
            }
        }
    }
}

function checkSimpleWinner(player) {
    const board = window.gameState.board;

    // Проверяем строки и столбцы
    for (let i = 0; i < 3; i++) {
        if ((board[i][0] === player && board[i][1] === player && board[i][2] === player) ||
            (board[0][i] === player && board[1][i] === player && board[2][i] === player)) {
            return true;
        }
    }

    // Проверяем диагонали
    if ((board[0][0] === player && board[1][1] === player && board[2][2] === player) ||
        (board[0][2] === player && board[1][1] === player && board[2][0] === player)) {
        return true;
    }

    return false;
}

function makeSimpleBotMove() {
    if (window.gameState.gameOver) return;

    // Улучшенная логика бота для крестиков-ноликов
    const botSymbol = 'O';
    const playerSymbol = 'X';
    const board = window.gameState.board;

    // Функция для оценки позиции
    function evaluatePosition() {
        // Проверяем, выиграл ли бот
        if (checkWinnerForSymbol(botSymbol)) return 10;
        // Проверяем, выиграл ли игрок
        if (checkWinnerForSymbol(playerSymbol)) return -10;
        // Ничья
        return 0;
    }

    // Проверяем, выиграл ли символ
    function checkWinnerForSymbol(symbol) {
        // Проверяем строки, столбцы и диагонали
        for (let i = 0; i < 3; i++) {
            if ((board[i][0] === symbol && board[i][1] === symbol && board[i][2] === symbol) ||
                (board[0][i] === symbol && board[1][i] === symbol && board[2][i] === symbol)) {
                return true;
            }
        }
        // Диагонали
        if ((board[0][0] === symbol && board[1][1] === symbol && board[2][2] === symbol) ||
            (board[0][2] === symbol && board[1][1] === symbol && board[2][0] === symbol)) {
            return true;
        }
        return false;
    }

    // Минимакс алгоритм для поиска лучшего хода
    function minimax(depth, isMaximizing, alpha = -Infinity, beta = Infinity) {
        const score = evaluatePosition();

        // Терминальные состояния
        if (score === 10 || score === -10) return score;
        if (board.flat().every(cell => cell !== '')) return 0; // Ничья

        if (isMaximizing) {
            // Ход бота (максимизация)
            let maxEval = -Infinity;
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    if (board[row][col] === '') {
                        board[row][col] = botSymbol;
                        const eval = minimax(depth + 1, false, alpha, beta);
                        board[row][col] = '';
                        maxEval = Math.max(maxEval, eval);
                        alpha = Math.max(alpha, eval);
                        if (beta <= alpha) break;
                    }
                }
            }
            return maxEval;
        } else {
            // Ход игрока (минимизация)
            let minEval = Infinity;
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    if (board[row][col] === '') {
                        board[row][col] = playerSymbol;
                        const eval = minimax(depth + 1, true, alpha, beta);
                        board[row][col] = '';
                        minEval = Math.min(minEval, eval);
                        beta = Math.min(beta, eval);
                        if (beta <= alpha) break;
                    }
                }
            }
            return minEval;
        }
    }

    // Находим лучший ход
    let bestMove = null;
    let bestValue = -Infinity;

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            if (board[row][col] === '') {
                board[row][col] = botSymbol;
                const moveValue = minimax(0, false);
                board[row][col] = '';

                if (moveValue > bestValue) {
                    bestValue = moveValue;
                    bestMove = { row, col };
                }
            }
        }
    }

    // Если нашли лучший ход, делаем его
    if (bestMove) {
        window.handleSimpleTicTacToeClick(bestMove.row, bestMove.col);
    } else {
        // Резервный вариант - случайный ход
        const emptyCells = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (board[row][col] === '') {
                    emptyCells.push({ row, col });
                }
            }
        }
        if (emptyCells.length > 0) {
            const randomMove = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            window.handleSimpleTicTacToeClick(randomMove.row, randomMove.col);
        }
    }
}

// Функция для обработки кликов по шахматной доске
window.handleSimpleChessClick = function(row, col) {
    if (window.gameState.gameOver) return;

    const piece = window.gameState.board[row][col];

    // Если клетка уже выбрана, снимаем выделение
    if (window.gameState.selectedSquare &&
        window.gameState.selectedSquare.row === row &&
        window.gameState.selectedSquare.col === col) {
        window.gameState.selectedSquare = null;
        updateSimpleChessBoard();
        return;
    }

    // Если выбрана фигура игрока, выделяем её
    if (piece && isPlayerPiece(piece, window.gameState.currentPlayer)) {
        window.gameState.selectedSquare = { row, col };
        updateSimpleChessBoard();
        return;
    }

    // Если есть выбранная фигура, пытаемся сделать ход
    if (window.gameState.selectedSquare) {
        const fromRow = window.gameState.selectedSquare.row;
        const fromCol = window.gameState.selectedSquare.col;
        const fromPiece = window.gameState.board[fromRow][fromCol];

        if (isValidSimpleMove(fromPiece, fromRow, fromCol, row, col)) {
            // Делаем ход
            window.gameState.board[row][col] = fromPiece;
            window.gameState.board[fromRow][fromCol] = '';
            window.gameState.selectedSquare = null;
            window.gameState.currentPlayer = window.gameState.currentPlayer === 'white' ? 'black' : 'white';
            window.gameState.moveCount++;

            updateSimpleChessBoard();
            updateSimpleChessStatus();

            // Ход бота
            if (window.currentOpponent?.type === 'bot' && window.gameState.currentPlayer === 'black' && !window.gameState.gameOver) {
                setTimeout(() => {
                    makeSimpleChessBotMove();
                }, 1000);
            }
        }
    }
};

// Проверка, является ли фигура фигурой игрока
function isPlayerPiece(piece, player) {
    // Для ASCII символов
    const whitePiecesASCII = ['r', 'n', 'b', 'q', 'k', 'P'];
    const blackPiecesASCII = ['R', 'N', 'B', 'Q', 'K', 'p'];

    // Для Unicode символов (резерв)
    const whitePiecesUnicode = ['♔', '♕', '♖', '♗', '♘', '♙'];
    const blackPiecesUnicode = ['♚', '♛', '♜', '♝', '♞', '♟️'];

    if (player === 'white') {
        return whitePiecesASCII.includes(piece) || whitePiecesUnicode.includes(piece);
    } else {
        return blackPiecesASCII.includes(piece) || blackPiecesUnicode.includes(piece);
    }
}

// Простая проверка допустимости хода (очень упрощенная)
function isValidSimpleMove(piece, fromRow, fromCol, toRow, toCol) {
    // Базовые проверки
    if (fromRow === toRow && fromCol === toCol) return false;

    const targetPiece = window.gameState.board[toRow][toCol];
    const isCapture = targetPiece !== '';

    // Нельзя ходить на свои фигуры
    if (isCapture && isPlayerPiece(targetPiece, window.gameState.currentPlayer)) {
        return false;
    }

    const pieceType = getPieceType(piece);
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);

    let isValid = false;

    switch (pieceType) {
        case 'pawn':
            isValid = isValidPawnMove(piece, fromRow, fromCol, toRow, toCol, window.gameState.currentPlayer);
            break;
        case 'rook':
            isValid = isValidRookMove(fromRow, fromCol, toRow, toCol);
            break;
        case 'bishop':
            isValid = isValidBishopMove(fromRow, fromCol, toRow, toCol);
            break;
        case 'queen':
            isValid = isValidQueenMove(fromRow, fromCol, toRow, toCol);
            break;
        case 'knight':
            isValid = isValidKnightMove(fromRow, fromCol, toRow, toCol);
            break;
        case 'king':
            isValid = isValidKingMove(fromRow, fromCol, toRow, toCol, window.gameState.currentPlayer);
            break;
    }

    if (!isValid) return false;

    return true;
}

// Получить тип фигуры
function getPieceType(piece) {
    const types = {
        '♔': 'king', '♚': 'king',
        '♕': 'queen', '♛': 'queen',
        '♖': 'rook', '♜': 'rook',
        '♗': 'bishop', '♝': 'bishop',
        '♘': 'knight', '♞': 'knight',
        '♙': 'pawn', '♟️': 'pawn'
    };
    return types[piece] || null;
}

// Валидация хода пешки
function isValidPawnMove(piece, fromRow, fromCol, toRow, toCol, color) {
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;

    // Обычный ход вперед
    if (fromCol === toCol && !window.gameState.board[toRow][toCol]) {
        if (toRow === fromRow + direction) return true;
        // Двойной ход с начальной позиции
        if (fromRow === startRow && toRow === fromRow + 2 * direction && !window.gameState.board[fromRow + direction][toCol]) {
            return true;
        }
    }

    // Взятие по диагонали
    if (Math.abs(toCol - fromCol) === 1 && toRow === fromRow + direction) {
        if (window.gameState.board[toRow][toCol]) return true; // Обычное взятие

        // Взятие на проходе
        if (window.gameState.enPassantTarget && window.gameState.enPassantTarget.row === toRow && window.gameState.enPassantTarget.col === toCol) {
            return true;
        }
    }

    return false;
}

// Валидация хода ладьи
function isValidRookMove(fromRow, fromCol, toRow, toCol) {
    if (fromRow !== toRow && fromCol !== toCol) return false;

    // Проверяем, нет ли фигур на пути
    const rowStep = fromRow === toRow ? 0 : (toRow - fromRow) / Math.abs(toRow - fromRow);
    const colStep = fromCol === toCol ? 0 : (toCol - fromCol) / Math.abs(toCol - fromCol);

    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;

    while (currentRow !== toRow || currentCol !== toCol) {
        if (window.gameState.board[currentRow][currentCol]) return false;
        currentRow += rowStep;
        currentCol += colStep;
    }

    return true;
}

// Валидация хода слона
function isValidBishopMove(fromRow, fromCol, toRow, toCol) {
    if (Math.abs(toRow - fromRow) !== Math.abs(toCol - fromCol)) return false;

    // Проверяем, нет ли фигур на пути
    const rowStep = (toRow - fromRow) / Math.abs(toRow - fromRow);
    const colStep = (toCol - fromCol) / Math.abs(toCol - fromCol);

    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;

    while (currentRow !== toRow || currentCol !== toCol) {
        if (window.gameState.board[currentRow][currentCol]) return false;
        currentRow += rowStep;
        currentCol += colStep;
    }

    return true;
}

// Валидация хода ферзя
function isValidQueenMove(fromRow, fromCol, toRow, toCol) {
    return isValidRookMove(fromRow, fromCol, toRow, toCol) ||
           isValidBishopMove(fromRow, fromCol, toRow, toCol);
}

// Валидация хода коня
function isValidKnightMove(fromRow, fromCol, toRow, toCol) {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);

    return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
}

// Валидация хода короля
function isValidKingMove(fromRow, fromCol, toRow, toCol, color) {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);

    // Обычный ход короля
    if (rowDiff <= 1 && colDiff <= 1) return true;

    // Рокировка
    if (rowDiff === 0 && colDiff === 2 && fromRow === (color === 'white' ? 7 : 0)) {
        return canCastle(fromRow, fromCol, toCol, color);
    }

    return false;
}

// Проверка возможности рокировки
function canCastle(kingRow, kingCol, targetCol, color) {
    const kingside = targetCol > kingCol;
    const rights = window.gameState.castlingRights[color];

    if ((kingside && !rights.kingside) || (!kingside && !rights.queenside)) return false;

    // Проверяем, что клетки между королем и ладьей пустые
    const rookCol = kingside ? 7 : 0;
    const step = kingside ? 1 : -1;

    for (let col = kingCol + step; col !== rookCol; col += step) {
        if (window.gameState.board[kingRow][col]) return false;
    }

    // Проверяем, что король и промежуточные клетки не под шахом
    const opponentColor = color === 'white' ? 'black' : 'white';
    if (isSquareAttacked(kingRow, kingCol, opponentColor)) return false;

    const intermediateCol = kingCol + step;
    if (isSquareAttacked(kingRow, intermediateCol, opponentColor)) return false;

    return true;
}

// Проверка, находится ли клетка под атакой
function isSquareAttacked(row, col, byColor) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = window.gameState.board[r][c];
            if (piece && getPieceColor(piece) === byColor) {
                if (isValidMove(r, c, row, col, true)) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Обновление шахматной доски
function updateSimpleChessBoard() {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.querySelector(`.chess-cell[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                const piece = window.gameState.board[row][col] || '';
                cell.textContent = piece;

                // Убираем все классы выделения
                cell.classList.remove('selected', 'valid-move');

                // Добавляем класс для выбранной клетки
                if (window.gameState.selectedSquare &&
                    window.gameState.selectedSquare.row === row &&
                    window.gameState.selectedSquare.col === col) {
                    cell.classList.add('selected');
                }
            }
        }
    }
}

// Обновление статуса шахмат
function updateSimpleChessStatus() {
    const statusEl = document.querySelector('.chess-status');
    if (statusEl) {
        const playerName = window.gameState.currentPlayer === 'white' ? 'Ваш ход (белые)' : 'Ход противника (черные)';
        statusEl.textContent = playerName;
    }
}

// Ход шахматного бота
function makeSimpleChessBotMove() {
    if (window.gameState.gameOver) return;

    // Простая логика: выбираем случайный допустимый ход
    const possibleMoves = [];

    for (let fromRow = 0; fromRow < 8; fromRow++) {
        for (let fromCol = 0; fromCol < 8; fromCol++) {
            const piece = window.gameState.board[fromRow][fromCol];
            if (piece && isPlayerPiece(piece, 'black')) {
                for (let toRow = 0; toRow < 8; toRow++) {
                    for (let toCol = 0; toCol < 8; toCol++) {
                        if (isValidSimpleMove(piece, fromRow, fromCol, toRow, toCol)) {
                            possibleMoves.push({ fromRow, fromCol, toRow, toCol });
                        }
                    }
                }
            }
        }
    }

    if (possibleMoves.length > 0) {
        const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        window.gameState.board[move.toRow][move.toCol] = window.gameState.board[move.fromRow][move.fromCol];
        window.gameState.board[move.fromRow][move.fromCol] = '';
        window.gameState.currentPlayer = 'white';
        window.gameState.moveCount++;

        updateSimpleChessBoard();
        updateSimpleChessStatus();
    }
}

// Cards Game - Меню выбора карточных игр (теперь не используется, оставлено для совместимости)
function initCards() {
    console.log('initCards called - this function is deprecated, use openGame("cards") instead');
    // Для обратной совместимости перенаправляем на новый поток
    openGame('cards');
}

function renderCardsGame() {
    const playerHandElement = document.getElementById('playerHand');
    const opponentHandElement = document.getElementById('opponentHand');
    const tableElement = document.getElementById('cardsTable');

    if (playerHandElement && opponentHandElement && tableElement) {
        // Отрисовываем руку игрока
        let playerHandHtml = '';
        window.gameState.playerHand.forEach((card, index) => {
            playerHandHtml += `<div class="card" data-index="${index}">${card.value}${card.suit}</div>`;
        });
        playerHandElement.innerHTML = playerHandHtml;

        // Отрисовываем руку противника
        let opponentHandHtml = '';
        window.gameState.opponentHand.forEach((card, index) => {
            opponentHandHtml += `<div class="card" data-index="${index}">${card.value}${card.suit}</div>`;
        });
        opponentHandElement.innerHTML = opponentHandHtml;

        // Отрисовываем карты на столе
        let tableHtml = '';
        window.gameState.table.forEach((card, index) => {
            tableHtml += `<div class="card" data-index="${index}">${card.value}${card.suit}</div>`;
        });
        tableElement.innerHTML = tableHtml;
    }
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
        gamePhase: 'exchange',
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
    console.log('startDurak called');

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

    console.log('Creating deck...');
    createDeck();
    console.log('Shuffling deck...');
    shuffleDeck();
    console.log('Setting trump suit...');
    setTrumpSuit();
    console.log('Dealing durak cards...');
    dealDurakCards();
    console.log('Rendering durak game...');

    // Показываем панель активной игры
    const activeGamePanel = document.getElementById('activeGamePanel');
    if (activeGamePanel) {
        activeGamePanel.classList.remove('hidden');
        document.getElementById('activeGameTitle').textContent = 'Дурак';
        document.getElementById('activeGameIcon').textContent = '🎴';
    }

    renderDurakGame();
}

function selectPoker() {
    console.log('selectPoker called - starting poker game selection');
    // Устанавливаем тип игры
    window.currentGame = 'poker';
    console.log('Set currentGame to poker, calling showOpponentSelector');
    showOpponentSelector('poker');
}

function selectDurak() {
    console.log('selectDurak called - starting durak game selection');
    // Устанавливаем тип игры
    window.currentGame = 'durak';
    console.log('Set currentGame to durak, calling showOpponentSelector');
    showOpponentSelector('durak');
}

function getCardPower(value) {
    const powers = { '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return powers[value] || 0;
}

function createDeck() {
    window.gameState.deck = [];
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    const getCardPower = (value) => {
        const powers = { '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
        return powers[value] || 0;
    };

    for (let suit of suits) {
        for (let value of values) {
            window.gameState.deck.push({ suit, value, power: getCardPower(value) });
        }
    }
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
    console.log('dealDurakCards called');
    window.gameState.playerHand = [];
    window.gameState.opponentHand = [];

    console.log('Deck length before dealing:', window.gameState.deck.length);

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

    console.log('Player hand:', window.gameState.playerHand);
    console.log('Opponent hand:', window.gameState.opponentHand);
    console.log('First attacker:', window.gameState.currentAttacker);
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
            window.gameState.gamePhase = 'defend';
        }
    } else if (playerLowestTrump) {
        // Только у игрока есть козыри - он ходит первым
        window.gameState.currentAttacker = 'player';
        window.gameState.gamePhase = 'attack';
    } else if (opponentLowestTrump) {
        // Только у бота есть козыри - он ходит первым
        window.gameState.currentAttacker = 'bot';
        window.gameState.gamePhase = 'defend';
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
        activeGamePanel.style.display = 'block';
        document.getElementById('activeGameTitle').textContent = 'Покер';
        document.getElementById('activeGameIcon').textContent = '';
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

    html += '<h3> Покер</h3>';
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
    console.log('renderDurakGame called');

    // Показываем панель активной игры и скрываем основное меню
    const activeGamePanel = document.getElementById('activeGamePanel');
    const gameContainer = document.getElementById('gameContainer');

    if (activeGamePanel) {
        activeGamePanel.classList.remove('hidden');
        activeGamePanel.style.display = 'block';
        document.getElementById('activeGameTitle').textContent = 'Дурак';
        document.getElementById('activeGameIcon').textContent = '🎴';
    }

    const gamePanel = document.getElementById('activeGameContent');
    console.log('gamePanel for durak:', gamePanel);
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

    console.log('gameState:', window.gameState);
    console.log('playerHand length:', window.gameState.playerHand.length);
    console.log('opponentHand length:', window.gameState.opponentHand.length);
    console.log('Фаза игры:', window.gameState.gamePhase, 'Атакующий:', window.gameState.currentAttacker);

    let html = '<div class="cards-menu">';
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
            html += '<div class="card ' + suitClass + '" data-index="' + i + '" onclick="playDurakCard(' + i + ')">';
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
    switch (suit) {
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
        card.addEventListener('click', function () {
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

    if (window.socket && window.roomId && window.currentOpponent?.type === 'player') {
        // Отправляем ход на сервер для сетевой игры
        window.socket.emit('game-move', {
            roomId: window.roomId,
            gameType: 'poker',
            move: {
                action: 'exchange',
                cardIndex: index,
                playerId: window.socket.id
            }
        });

        // Локально обновляем карту
        if (window.gameState.deck.length > 0) {
            window.gameState.playerHand[index] = window.gameState.deck.pop();

            // Показываем информацию об обмене
            const statusElement = document.querySelector('.poker-status');
            if (statusElement) {
                statusElement.innerHTML = '<div style="color: #28a745;">Карта обменяна! Теперь проверьте комбинацию.</div>';
            }

            renderPokerGame();
        }
    } else {
        // Локальная игра с ботом
        if (window.gameState.deck.length > 0) {
            window.gameState.playerHand[index] = window.gameState.deck.pop();

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
}

function checkPokerHand() {
    console.log('checkPokerHand called');

    if (window.socket && window.roomId && window.currentOpponent?.type === 'player') {
        // Отправляем запрос на проверку комбинации для сетевой игры
        window.socket.emit('game-move', {
            roomId: window.roomId,
            gameType: 'poker',
            move: {
                action: 'check',
                playerId: window.socket.id
            }
        });

        // Локально переходим к фазе ожидания
        window.gameState.gamePhase = 'waiting';

        // Показываем сообщение
        const statusElement = document.querySelector('.poker-status');
        if (statusElement) {
            statusElement.innerHTML = '<div style="color: #ffc107;">Ожидание противника...</div>';
        }

        renderPokerGame();
    } else {
        // Локальная игра с ботом - сразу переходим к сравнению
        window.gameState.gamePhase = 'waiting';
        renderPokerGame();

        // Имитируем задержку для показа карт противника
        setTimeout(() => {
            comparePokerHands();
        }, 2000);
    }
}

function comparePokerHands() {
    console.log('comparePokerHands called');

    // Простое сравнение - считаем сумму значений карт
    const playerScore = window.gameState.playerHand.reduce((sum, card) => sum + getCardPower(card.value), 0);
    const opponentScore = window.gameState.opponentHand.reduce((sum, card) => sum + getCardPower(card.value), 0);

    console.log('Player score:', playerScore, 'Opponent score:', opponentScore);

    let winner;
    if (playerScore > opponentScore) {
        winner = 'player';
        window.gameState.playerScore++;
    } else if (opponentScore > playerScore) {
        winner = 'opponent';
        window.gameState.opponentScore++;
    } else {
        winner = 'draw';
    }

    window.gameState.winner = winner;
    window.gameState.gamePhase = 'finished';

    renderPokerGame();

    // Показываем результат
    const statusElement = document.querySelector('.poker-status');
    if (statusElement) {
        if (winner === 'player') {
            statusElement.innerHTML = '<div style="color: #28a745; font-size: 18px; font-weight: bold;">🎉 Вы выиграли раунд!</div>';
        } else if (winner === 'opponent') {
            statusElement.innerHTML = '<div style="color: #dc3545; font-size: 18px; font-weight: bold;">😞 Противник выиграл раунд!</div>';
        } else {
            statusElement.innerHTML = '<div style="color: #ffc107; font-size: 18px; font-weight: bold;">🤝 Ничья в раунде!</div>';
        }
    }

    // Проверяем, закончилась ли игра
    if (window.gameState.playerScore >= 10 || window.gameState.opponentScore >= 10) {
        // Игра окончена
        setTimeout(() => {
            showNotification('Игра окончена! ' + (window.gameState.playerScore > window.gameState.opponentScore ? 'Вы победили!' : 'Противник победил!'), 'info');
        }, 2000);
    }
}

function newPokerRound() {
    console.log('newPokerRound called');

    // Сбрасываем состояние для нового раунда
    window.gameState.round++;
    window.gameState.gamePhase = 'exchange';
    window.gameState.winner = null;

    // Создаем новую колоду и раздаем карты
    createDeck();
    shuffleDeck();
    dealPokerCards();

    renderPokerGame();

    // Показываем сообщение
    const statusElement = document.querySelector('.poker-status');
    if (statusElement) {
        statusElement.innerHTML = '<div style="color: #28a745;">Раунд ' + window.gameState.round + ' начат!</div>';
    }
}

// Функции для дурака
function playDurakCard(cardIndex) {
    console.log('playDurakCard called with index:', cardIndex);

    if (!window.gameState || !window.gameState.playerHand || cardIndex >= window.gameState.playerHand.length) {
        return;
    }

    const card = window.gameState.playerHand[cardIndex];
    if (!card) return;

    console.log('Playing card:', card);

    if (window.socket && window.roomId && window.currentOpponent?.type === 'player') {
        // Сетевая игра
        let action = 'play';
        if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'bot') {
            action = 'defend';
        } else if (window.gameState.gamePhase === 'attack' && window.gameState.currentAttacker === 'player') {
            // Проверяем, все ли карты отбиты для подкидывания
            const allDefended = window.gameState.attackingCards.every((_, index) => window.gameState.defendingCards[index]);
            if (allDefended && window.gameState.attackingCards.length > 0) {
                action = 'throw';
            } else {
                action = 'play';
            }
        }

        window.socket.emit('game-move', {
            roomId: window.roomId,
            gameType: 'durak',
            move: {
                action: action,
                card: { suit: card.suit, value: card.value },
                cardIndex: cardIndex,
                playerId: window.socket.id
            }
        });
    } else {
        // Локальная игра с ботом
        makeDurakMove(card, cardIndex);
    }
}

function makeDurakMove(card, cardIndex) {
    console.log('makeDurakMove:', card, cardIndex);

    if (window.gameState.gamePhase === 'attack' && window.gameState.currentAttacker === 'player') {
        // Игрок атакует
        if (window.gameState.attackingCards.length === 0) {
            // Первая атака
            window.gameState.playerHand.splice(cardIndex, 1);
            window.gameState.attackingCards.push(card);
            window.gameState.gamePhase = 'defend';
            console.log('Player attacked with:', card);
        } else {
            // Подкидывание карт
            window.gameState.playerHand.splice(cardIndex, 1);
            window.gameState.attackingCards.push(card);
            console.log('Player threw card:', card);
        }
    } else if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'bot') {
        // Игрок защищается от бота
        const undefendedIndex = window.gameState.attackingCards.findIndex((_, index) => !window.gameState.defendingCards[index]);
        if (undefendedIndex !== -1) {
            window.gameState.playerHand.splice(cardIndex, 1);
            window.gameState.defendingCards[undefendedIndex] = card;
            console.log('Player defended with:', card);

            // Проверяем, все ли карты отбиты
            const allDefended = window.gameState.attackingCards.every((_, index) => window.gameState.defendingCards[index]);
            if (allDefended) {
                // Все карты отбиты - очищаем стол и меняем атакующего
                window.gameState.attackingCards = [];
                window.gameState.defendingCards = [];
                window.gameState.currentAttacker = 'bot'; // Теперь бот атакует
                window.gameState.gamePhase = 'attack';

                // Добираем карты
                refillDurakHands();

                // Бот атакует
                setTimeout(() => {
                    makeDurakBotAttack();
                }, 1000);
            }
        }
    }

    renderDurakGame();
}

function takeDurakCards() {
    console.log('takeDurakCards called');

    if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'bot') {
        // Игрок берет все карты со стола
        window.gameState.playerHand.push(...window.gameState.attackingCards);
        window.gameState.playerHand.push(...window.gameState.defendingCards);
        window.gameState.attackingCards = [];
        window.gameState.defendingCards = [];

        // Меняем атакующего
        window.gameState.currentAttacker = 'bot';
        window.gameState.gamePhase = 'attack';

        // Добираем карты
        refillDurakHands();

        // Бот атакует
        setTimeout(() => {
            makeDurakBotAttack();
        }, 1000);

        renderDurakGame();
    }
}

function passDurakTurn() {
    console.log('passDurakTurn called');

    if (window.gameState.gamePhase === 'attack' && window.gameState.currentAttacker === 'player') {
        // Игрок завершает атаку
        if (window.gameState.attackingCards.length > 0) {
            window.gameState.attackingCards = [];
            window.gameState.defendingCards = [];
            window.gameState.currentAttacker = 'bot';
            window.gameState.gamePhase = 'attack';
            refillDurakHands();

            // Бот атакует
            setTimeout(() => {
                makeDurakBotAttack();
            }, 1000);
        }
    } else if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'bot') {
        // Игрок не может отбиться и берет карты
        takeDurakCards();
    } else if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'player') {
        // Игрок атаковал, все карты отбиты - отбой
        window.gameState.attackingCards = [];
        window.gameState.defendingCards = [];
        window.gameState.currentAttacker = 'bot';
        window.gameState.gamePhase = 'attack';
        refillDurakHands();

        // Бот атакует
        setTimeout(() => {
            makeDurakBotAttack();
        }, 1000);
    }

    renderDurakGame();
}

function refillDurakHands() {
    console.log('refillDurakHands called');

    // Добираем карты до 6 у каждого игрока
    while (window.gameState.playerHand.length < 6 && window.gameState.deck.length > 0) {
        window.gameState.playerHand.push(window.gameState.deck.pop());
    }

    while (window.gameState.opponentHand.length < 6 && window.gameState.deck.length > 0) {
        window.gameState.opponentHand.push(window.gameState.deck.pop());
    }
}

function newDurakRound() {
    console.log('newDurakRound called');

    // Начинаем новую игру дурака
    startDurak();
}

function makeDurakBotAttack() {
    console.log('makeDurakBotAttack called');

    if (window.gameState.gamePhase !== 'attack' || window.gameState.currentAttacker !== 'bot' || window.gameState.opponentHand.length === 0) {
        return;
    }

    // Бот выбирает случайную карту для атаки
    const attackCard = window.gameState.opponentHand[Math.floor(Math.random() * window.gameState.opponentHand.length)];

    // Удаляем карту из руки бота
    const cardIndex = window.gameState.opponentHand.findIndex(card =>
        card.suit === attackCard.suit && card.value === attackCard.value
    );
    if (cardIndex !== -1) {
        window.gameState.opponentHand.splice(cardIndex, 1);
    }

    // Добавляем карту на стол
    window.gameState.attackingCards.push(attackCard);
    window.gameState.gamePhase = 'defend';

    console.log('Bot attacked with:', attackCard);
    renderDurakGame();

    // Ждем немного, затем бот может продолжить атаку
    setTimeout(() => {
        if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'bot') {
            // Бот может продолжить атаку, если игрок отбился
            const allDefended = window.gameState.attackingCards.every((_, index) => window.gameState.defendingCards[index]);
            if (allDefended && window.gameState.opponentHand.length > 0) {
                // Бот может подкинуть карту или завершить атаку
                if (Math.random() < 0.3) { // 30% шанс подкинуть
                    makeDurakBotAttack();
                }
            }
        }
    }, 1500);
}

function backToMenu() {
    console.log('backToMenu called');

    // Сбрасываем состояние игры
    window.gameState = null;
    window.currentOpponent = null;

    // Возвращаемся к меню карточных игр
    initCards();
}

function startNewPokerGame() {
    console.log('startNewPokerGame called');
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.startNewGame) {
        console.log('Calling startNewGame on current game');
        window.gameManager.currentGame.startNewGame();
    } else {
        console.error('No current game to start new poker game');
    }
}

// Вспомогательные функции
function updateRoomPlayers() {
    // Функция-заглушка для совместимости
    console.log('updateRoomPlayers called');
}

// Экспорт функций в глобальную область для использования в onclick-обработчиках HTML
try {
    // Функции инициализации - используем legacy функции с резервными вариантами
    window.initChess = function() {
        if (window.initNetworkChess) {
            window.initNetworkChess();
        } else {
            // Резервная функция, если модули не загрузились
            console.log('Using fallback chess initialization');
            initSimpleChess();
        }
    };

// После загрузки всех модулей переопределяем функции
function overrideLegacyFunctions() {
    console.log('Overriding legacy functions with new implementations...');

    // Переопределяем selectPoker и selectDurak из legacy-functions.js
    if (window.selectPoker && window.selectPoker.toString().includes('gameManager.startGame')) {
        console.log('Overriding legacy selectPoker function');
        window.selectPoker = selectPoker;
    } else {
        console.log('No legacy selectPoker function found or already overridden');
    }

    if (window.selectDurak && window.selectDurak.toString().includes('gameManager.startGame')) {
        console.log('Overriding legacy selectDurak function');
        window.selectDurak = selectDurak;
    } else {
        console.log('No legacy selectDurak function found or already overridden');
    }

    console.log('Legacy functions override completed - selectPoker:', typeof window.selectPoker, 'selectDurak:', typeof window.selectDurak);
}

// Определяем selectPoker функцию
function selectPoker() {
    if (window.gameManager && window.currentOpponent?.type === 'player') {
        // Сетевая игра
        console.log('Starting network poker game');
        const game = window.gameManager.startGame('poker', window.currentOpponent);
        if (game) {
            game.isNetworkGame = true;
            console.log('Network poker game initialized');
        }
    } else {
        // Локальная игра
        console.log('Starting local poker game');
        window.gameManager.startGame('poker');
    }
}

// Определяем selectDurak функцию
function selectDurak() {
    if (window.gameManager && window.currentOpponent?.type === 'player') {
        // Сетевая игра
        console.log('Starting network durak game');
        const game = window.gameManager.startGame('durak', window.currentOpponent);
        if (game) {
            game.isNetworkGame = true;
            console.log('Network durak game initialized');
        }
    } else {
        // Локальная игра
        console.log('Starting local durak game');
        window.gameManager.startGame('durak');
    }
}

    // Основные функции для работы с играми
    window.handleGameStateUpdate = handleGameStateUpdate;
    window.initializeGameInvitations = initializeGameInvitations;
    window.showOpponentSelector = showOpponentSelector;
    window.selectBot = selectBot;
    window.selectPoker = selectPoker;
    window.selectDurak = selectDurak;

    // Функции для работы с комнатами
    window.updateParticipantsList = updateParticipantsList;

    // Резервные функции
    window.initSimpleChess = initSimpleChess;
    window.initSimpleTicTacToe = initSimpleTicTacToe;
    window.handleSimpleTicTacToeClick = window.handleSimpleTicTacToeClick;
    window.handleSimpleChessClick = window.handleSimpleChessClick;
    window.updateSimpleChessBoard = updateSimpleChessBoard;

    // Новые шахматные функции
    window.handleChessClick = handleChessClick;
    window.makeChessAIMove = makeChessAIMove;
    window.updateChessBoard = updateChessBoard;
    window.highlightPossibleMoves = highlightPossibleMoves;
    window.updateChessStatus = updateChessStatus;

    // Функции карточных игр
    window.backToMenu = backToMenu;
    window.checkPokerHand = checkPokerHand;
    window.comparePokerHands = comparePokerHands;
    window.newPokerRound = newPokerRound;
    window.playDurakCard = playDurakCard;
    window.takeDurakCards = takeDurakCards;
    window.passDurakTurn = passDurakTurn;
    window.newDurakRound = newDurakRound;
    window.makeDurakBotAttack = makeDurakBotAttack;
    window.startNewPokerGame = startNewPokerGame;
    window.testDurak = testDurak;

    console.log('✅ games.js: Functions exported to global scope');
} catch (e) {
    console.warn('Error exporting functions to global scope:', e);
}
