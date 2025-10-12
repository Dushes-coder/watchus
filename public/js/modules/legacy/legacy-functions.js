// ===== LEGACY FUNCTIONS =====
// Старые функции для обратной совместимости

// Глобальные переменные (для совместимости)
window.currentGame = null;
window.currentOpponent = null;

// Функция для создания новой игры в крестики-нолики (для совместимости)
function createTicTacToeGame() {
    if (window.gameManager) {
        window.currentGame = window.gameManager.createGame('tictactoe');
        return window.currentGame ? window.currentGame.init() : false;
    }
    return false;
}

// Инициализация сетевой игры TicTacToe (для совместимости)
function initNetworkTicTacToe() {
    console.log('initNetworkTicTacToe called, currentOpponent:', window.currentOpponent);
    if (window.gameManager) {
        console.log('Using gameManager.startGame for tictactoe with opponent:', window.currentOpponent);
        const game = window.gameManager.startGame('tictactoe', window.currentOpponent);
        if (game) {
            console.log('TicTacToe game started, isNetworkGame:', game.isNetworkGame);
            return true;
        } else {
            console.error('Failed to start TicTacToe game');
        }
    } else {
        console.error('gameManager not available');
    }
    return false;
}

// Инициализация сетевой игры Chess (для совместимости)
function initNetworkChess() {
    if (window.gameManager) {
        const game = window.gameManager.startGame('chess', window.currentOpponent);
        if (game) {
            game.isNetworkGame = true;
            return game.init();
        }
    }
    return false;
}

// Инициализация сетевой игры Poker (для совместимости)
function initNetworkPoker() {
    if (window.gameManager) {
        const game = window.gameManager.startGame('poker', window.currentOpponent);
        if (game) {
            game.isNetworkGame = true;
            return game.init();
        }
    }
    return false;
}

// Инициализация сетевой игры Durak (для совместимости)
function initNetworkDurak() {
    if (window.gameManager) {
        const game = window.gameManager.startGame('durak', window.currentOpponent);
        if (game) {
            game.isNetworkGame = true;
            return game.init();
        }
    }
    return false;
}

// Обработка сетевых ходов (для совместимости)
function handleNetworkTicTacToeMove(move) {
    if (window.gameManager && window.gameManager.currentGame) {
        window.gameManager.currentGame.handleNetworkMove(move);
    }
}

function handleNetworkChessMove(move) {
    if (window.gameManager && window.gameManager.currentGame) {
        window.gameManager.currentGame.handleNetworkMove(move);
    }
}

function handleNetworkPokerMove(move) {
    if (window.gameManager && window.gameManager.currentGame) {
        window.gameManager.currentGame.handleNetworkMove(move);
    }
}

function handleNetworkCardsMove(move) {
    if (window.gameManager && window.gameManager.currentGame) {
        window.gameManager.currentGame.handleNetworkMove(move);
    }
}

// Старые функции для рендеринга (для совместимости)
function renderTicTacToeBoard() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.render) {
        window.gameManager.currentGame.render();
    }
}

function renderChessBoard() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.render) {
        window.gameManager.currentGame.render();
    }
}

function renderPokerGame() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.render) {
        window.gameManager.currentGame.render();
    }
}

function renderDurakGame() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.render) {
        window.gameManager.currentGame.render();
    }
}

function renderCardsGame() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.render) {
        window.gameManager.currentGame.render();
    }
}

function renderCardsMenu() {
    // Показываем меню карточных игр
    const container = document.getElementById('activeGameContent');
    if (!container) return;

    let html = '<div class="cards-menu">';
    html += '<h3>Выберите карточную игру:</h3>';
    html += '<div class="game-selection">';
    html += '<button class="game-mode-btn" onclick="selectPoker()">🃏 Покер</button>';
    html += '<button class="game-mode-btn" onclick="selectDurak()">🎴 Дурак</button>';
    html += '</div>';
    html += '<button onclick="backToMenu()" class="back-btn">Назад к меню</button>';
    html += '</div>';

    container.innerHTML = html;
    container.style.display = 'block'; // Показываем контейнер
}

  // Старые функции для выбора игр (для совместимости)
  function selectPoker() {
      // Вместо прямого запуска игры, теперь показываем выбор соперника
      if (window.selectPoker && window.selectPoker !== selectPoker) {
          // Вызываем новую функцию из games.js
          window.selectPoker();
      } else if (window.gameManager) {
          // Резервный вариант для совместимости
          window.gameManager.startGame('poker');
      }
  }

  function selectDurak() {
      // Вместо прямого запуска игры, теперь показываем выбор соперника
      if (window.selectDurak && window.selectDurak !== selectDurak) {
          // Вызываем новую функцию из games.js
          window.selectDurak();
      } else if (window.gameManager) {
          // Резервный вариант для совместимости
          window.gameManager.startGame('durak');
      }
  }

function initCards() {
    renderCardsMenu();
}

// Старые функции для ИИ (для совместимости)
function makeBotMove() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.makeBotMove) {
        window.gameManager.currentGame.makeBotMove();
    }
}

function makeChessBotMove() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.makeBotMove) {
        window.gameManager.currentGame.makeBotMove();
    }
}

function makePokerBotMove() {
    // Реализовано в классе PokerGame
}

function makeDurakBotDefense() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.makeBotDefense) {
        window.gameManager.currentGame.makeBotDefense();
    }
}

function makeDurakBotAttack() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.makeBotAttack) {
        window.gameManager.currentGame.makeBotAttack();
    }
}

function makeDurakBotThrow() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.makeBotThrow) {
        window.gameManager.currentGame.makeBotThrow();
    }
}

// Другие старые функции (для совместимости)
function handleCardClick(e) {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.handleCardClick) {
        window.gameManager.currentGame.handleCardClick(e);
    }
}

function addPokerCardHandlers() {
    // Реализовано в классе PokerGame
}

function exchangeCards() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.exchangeCards) {
        window.gameManager.currentGame.exchangeCards();
    }
}

function checkPokerHand() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.checkHand) {
        window.gameManager.currentGame.checkHand();
    }
}

function newPokerRound() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.nextRound) {
        window.gameManager.currentGame.nextRound();
    }
}

function startNewPokerGame() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.startNewGame) {
        window.gameManager.currentGame.startNewGame();
    }
}

function showPokerResult() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.showResult) {
        window.gameManager.currentGame.showResult();
    }
}

function playDurakCard(cardIndex) {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.handleCardClick) {
        window.gameManager.currentGame.handleCardClick(cardIndex);
    }
}

function takeDurakCards() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.takeCards) {
        window.gameManager.currentGame.takeCards();
    }
}

function passDurakTurn() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.passTurn) {
        window.gameManager.currentGame.passTurn();
    }
}

function newDurakRound() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.newRound) {
        window.gameManager.currentGame.newRound();
    }
}

function finishDurakRound() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.finishRound) {
        window.gameManager.currentGame.finishRound();
    }
}

// Функции для работы с колодой (для совместимости)
function createDeck() {
    // Реализовано в классе CardGame
}

function shuffleDeck() {
    // Реализовано в классе CardGame
}

function setTrumpSuit() {
    // Реализовано в классе DurakGame
}

function dealPokerCards() {
    // Реализовано в классе PokerGame
}

function dealDurakCards() {
    // Реализовано в классе DurakGame
}

function determineFirstPlayer() {
    // Реализовано в классе DurakGame
}

// Вспомогательные функции (для совместимости)
function getCardPower(value) {
    const powers = { '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return powers[value] || 0;
}

function getSuitClass(suit) {
    const classes = { '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs', '♠': 'spades' };
    return classes[suit] || '';
}

function canAttackOrThrowCard(card) {
    // Реализовано в классе DurakGame
    return false;
}

function refillDurakHands() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.refillHands) {
        window.gameManager.currentGame.refillHands();
    }
}

function checkDurakGameEnd() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.checkGameEnd) {
        window.gameManager.currentGame.checkGameEnd();
    }
}

function validateBotAction(action, card, targetCard = null) {
    // Реализовано в классе DurakGame
    return false;
}

function takeDurakCardsBot() {
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.botTakeCards) {
        window.gameManager.currentGame.botTakeCards();
    }
}

function canDefendCard(defendCard, attackCard) {
    // Реализовано в классе DurakGame
    return false;
}

function defendWithAI() {
    // Реализовано в классе DurakGame
}

function testDurak() {
    if (window.gameManager) {
        window.currentOpponent = {
            name: 'Умный Бот',
            emoji: '🤖',
            type: 'bot'
        };
        window.gameManager.startGame('durak');
    }
}

// Функции для работы с комнатами (для совместимости)
function updateRoomPlayers() {
    // Обновление списка игроков в комнате
    if (window.networkManager) {
        // Функционал реализован в NetworkManager
    }
}

function startGameDirectly(game) {
    // Сбрасываем флаг закрытия активной игры, так как пользователь начинает новую
    try { localStorage.removeItem('wt_active_game_closed'); } catch (e) { }

    window.currentGame = game;
    const panel = document.getElementById('activeGamePanel');
    if (!panel) {
        console.error('activeGamePanel not found!');
        return;
    }
    const icon = document.getElementById('activeGameIcon');
    const title = document.getElementById('activeGameTitle');
    if (icon && title) {
        if (game === 'chess') { icon.textContent = '♟️'; title.textContent = 'Шахматы'; }
        else if (game === 'tictactoe') { icon.textContent = '⭕'; title.textContent = 'Крестики-нолики'; }
        else if (game === 'cards') { icon.textContent = '🃏'; title.textContent = 'Карты'; }
    }
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    console.log('startGameDirectly: calling gameManager.startGame');
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

function openGame(game) {
    console.log('openGame called with:', game);
    console.log('window.gameManager exists:', !!window.gameManager);
    console.log('window.roomId:', window.roomId);
    console.log('window.socket exists:', !!window.socket);

    // Специальная обработка для карточных игр - всегда показываем меню выбора игры
    if (game === 'cards') {
        console.log('Opening cards menu');
        initCards();
        return;
    }

    // Если пользователь уже в комнате, проверим наличие других игроков
    if (window.roomId && window.socket) {
        // Получаем количество других игроков в комнате (исключая себя)
        const otherPlayers = window.roomPlayers.filter(p => p.id !== (window.socket?.id || 'self'));

        if (otherPlayers.length === 0) {
            // В комнате нет других игроков - автоматически выбираем бота
            console.log('No other players in room, auto-selecting bot');
            window.currentOpponent = { type: 'bot', name: 'Бот', emoji: '🤖' };
            if (window.showNotification) window.showNotification('В комнате нет других игроков. Играем с ботом! 🤖', 'info');
            startGameDirectly(game);
            return;
        } else {
            // В комнате есть другие игроки - показываем селектор соперников
            console.log('Other players found in room, showing opponent selector');
            // Обновляем список игроков в комнате
            updateRoomPlayers();

            // Показываем селектор соперника
            setTimeout(() => {
                if (window.showOpponentSelector) window.showOpponentSelector(game);
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
        if (window.showOpponentSelector) window.showOpponentSelector(game);
    }, 100);
}

// Глобальная функция для обработки кликов по клеткам в крестиках-ноликах
function handleTicTacToeCellClick(row, col) {
    console.log('handleTicTacToeCellClick called with:', row, col);
    console.log('window.gameManager exists:', !!window.gameManager);
    console.log('window.gameManager.currentGame exists:', !!(window.gameManager && window.gameManager.currentGame));
    console.log('currentGame type:', window.gameManager?.currentGame?.gameType);

    // Проверяем, что игра запущена и это крестики-нолики
    if (window.gameManager && window.gameManager.currentGame &&
        window.gameManager.currentGame.gameType === 'tictactoe' &&
        window.gameManager.currentGame.handleCellClick) {
        console.log('Calling handleCellClick on currentGame');
        window.gameManager.currentGame.handleCellClick(row, col);
    } else {
        console.log('TicTacToe game not active or not found');
    }
}

// Экспорт функций в глобальную область для совместимости с HTML
window.createTicTacToeGame = createTicTacToeGame;
window.initNetworkTicTacToe = initNetworkTicTacToe;
window.initNetworkChess = initNetworkChess;
window.initNetworkPoker = initNetworkPoker;
window.initNetworkDurak = initNetworkDurak;
window.handleNetworkTicTacToeMove = handleNetworkTicTacToeMove;
window.handleNetworkChessMove = handleNetworkChessMove;
window.handleNetworkPokerMove = handleNetworkPokerMove;
window.handleNetworkCardsMove = handleNetworkCardsMove;
window.renderTicTacToeBoard = renderTicTacToeBoard;
window.renderChessBoard = renderChessBoard;
window.renderPokerGame = renderPokerGame;
window.renderDurakGame = renderDurakGame;
window.renderCardsGame = renderCardsGame;
window.renderCardsMenu = renderCardsMenu;
window.selectPoker = selectPoker;
window.selectDurak = selectDurak;
window.initCards = initCards;
window.makeBotMove = makeBotMove;
window.makeChessBotMove = makeChessBotMove;
window.makePokerBotMove = makePokerBotMove;
window.makeDurakBotDefense = makeDurakBotDefense;
window.makeDurakBotAttack = makeDurakBotAttack;
window.makeDurakBotThrow = makeDurakBotThrow;
window.handleCardClick = handleCardClick;
window.addPokerCardHandlers = addPokerCardHandlers;
window.exchangeCards = exchangeCards;
window.checkPokerHand = checkPokerHand;
window.newPokerRound = newPokerRound;
window.startNewPokerGame = startNewPokerGame;
window.showPokerResult = showPokerResult;
window.playDurakCard = playDurakCard;
window.takeDurakCards = takeDurakCards;
window.passDurakTurn = passDurakTurn;
window.newDurakRound = newDurakRound;
window.finishDurakRound = finishDurakRound;
window.createDeck = createDeck;
window.shuffleDeck = shuffleDeck;
window.setTrumpSuit = setTrumpSuit;
window.dealPokerCards = dealPokerCards;
window.dealDurakCards = dealDurakCards;
window.determineFirstPlayer = determineFirstPlayer;
window.getCardPower = getCardPower;
window.getSuitClass = getSuitClass;
window.canAttackOrThrowCard = canAttackOrThrowCard;
window.refillDurakHands = refillDurakHands;
window.checkDurakGameEnd = checkDurakGameEnd;
window.validateBotAction = validateBotAction;
window.takeDurakCardsBot = takeDurakCardsBot;
window.canDefendCard = canDefendCard;
window.defendWithAI = defendWithAI;
window.testDurak = testDurak;
window.updateRoomPlayers = updateRoomPlayers;
window.startGameDirectly = startGameDirectly;
window.openGame = openGame;
window.handleTicTacToeCellClick = handleTicTacToeCellClick;
