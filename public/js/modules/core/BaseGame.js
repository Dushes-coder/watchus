// ===== BASE GAME CLASSES =====

// Базовый класс для всех игр
class BaseGame {
    constructor(gameType, containerId = 'activeGameContent') {
        this.gameType = gameType;
        this.containerId = containerId;
        this.container = null;
        this.socket = window.socket;
        this.roomId = window.roomId;
        this.currentOpponent = window.currentOpponent;
        this.gameState = {};
        this.isNetworkGame = false;
    }

    // Инициализация игры
    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.error(`Container ${this.containerId} not found`);
            return false;
        }
        this.setupEventListeners();
        return true;
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Override in subclasses
    }

    // Отправка хода на сервер
    sendMove(moveData) {
        console.log('BaseGame sendMove: Socket connected =', this.socket?.connected, 'window.socket connected =', window.socket?.connected, 'roomId =', this.roomId, 'window.roomId =', window.roomId, 'moveData =', moveData);
        const activeSocket = this.socket?.connected ? this.socket : window.socket;
        console.log('Using socket:', activeSocket?.id, 'connected:', activeSocket?.connected);
        const roomId = this.roomId || window.roomId;
        if (activeSocket && roomId) {
            console.log('Sending game-move to server with data:', {
                roomId: roomId,
                gameType: this.gameType,
                move: moveData
            });
            activeSocket.emit('game-move', {
                roomId: roomId,
                gameType: this.gameType,
                move: moveData
            });
            console.log('game-move emit completed');
        } else {
            console.error('Cannot send move - no active socket or roomId missing', activeSocket, this.roomId, window.roomId);
        }
    }

    // Показ уведомления
    showNotification(message, type = 'info') {
        showNotification(message, type);
    }

    // Очистка контейнера
    clearContainer() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    // Проверка, является ли текущий игрок хостом
    isCurrentPlayer(playerId) {
        return playerId === (this.socket?.id || 'self');
    }

    // Получение информации об оппоненте
    getOpponentInfo() {
        return this.currentOpponent || { type: 'unknown', name: 'Неизвестно' };
    }

    // Завершение игры
    endGame(winner = null) {
        this.gameState.gameOver = true;
        this.gameState.winner = winner;

        // Записываем результат в статистику
        if (window.gameStatistics && this.gameState.winner) {
            const playerWon = this.gameState.winner === 'player' || this.gameState.winner === 'X' || this.gameState.winner === 'white';
            const result = playerWon ? 'win' : this.gameState.winner === 'draw' ? 'draw' : 'loss';
            window.gameStatistics.recordGameResult(this.gameType, result);
        }

        if (this.socket && this.roomId) {
            this.socket.emit('game-ended', {
                roomId: this.roomId,
                winner: winner,
                gameType: this.gameType
            });
        }
    }

    // Рендеринг базового UI для оппонента
    renderOpponentInfo() {
        const opponent = this.getOpponentInfo();
        return `
            <div class="game-opponent-info">
                <div class="opponent-avatar-small">${opponent.emoji || '👤'}</div>
                <div class="opponent-name-small">${opponent.name}</div>
                <div class="opponent-type">${opponent.type === 'bot' ? 'Бот' : 'Игрок'}</div>
            </div>
        `;
    }

    // Рендеринг базовых кнопок управления
    renderControls(buttons = []) {
        let html = '<div class="game-controls">';
        buttons.forEach(btn => {
            html += `<button onclick="${btn.action}" class="${btn.class || 'action-btn'}">${btn.text}</button>`;
        });
        html += '<button onclick="closeGame()" class="back-btn">Закрыть</button>';
        html += '</div>';
        return html;
    }
}

// Класс для карточных игр (Poker, Durak)
class CardGame extends BaseGame {
    constructor(gameType) {
        super(gameType);
        this.deck = [];
        this.suits = ['♠', '♥', '♦', '♣'];
        this.values = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    }

    // Создание колоды
    createDeck() {
        this.deck = [];
        this.suits.forEach(suit => {
            this.values.forEach(value => {
                this.deck.push({
                    suit,
                    value,
                    power: this.getCardPower(value)
                });
            });
        });
    }

    // Получение силы карты
    getCardPower(value) {
        const powers = { '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
        return powers[value] || 0;
    }

    // Перемешивание колоды
    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    // Получение CSS-класса для масти
    getSuitClass(suit) {
        const classes = { '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs', '♠': 'spades' };
        return classes[suit] || '';
    }

    // Рендеринг карты
    renderCard(card, options = {}) {
        const suitClass = this.getSuitClass(card.suit);
        const classes = ['card', suitClass];
        if (options.selected) classes.push('selected');
        if (options.playable) classes.push('playable');
        if (options.onTable) classes.push('on-table');

        const dataAttrs = options.dataIndex !== undefined ? `data-index="${options.dataIndex}"` : '';

        return `
            <div class="${classes.join(' ')}" ${dataAttrs}>
                <div class="card-value">${card.value}</div>
                <div class="card-suit">${card.suit}</div>
            </div>
        `;
    }

    // Рендеринг руки карт
    renderHand(cards, options = {}) {
        const containerClass = options.isOpponent ? 'opponent-hand' : 'player-hand';
        const cardBack = options.isOpponent ? '<div class="card card-back">🂠</div>' : '';

        let html = `<div class="cards-hand ${containerClass}">`;
        if (options.isOpponent) {
            for (let i = 0; i < cards.length; i++) {
                html += cardBack;
            }
        } else {
            cards.forEach((card, index) => {
                const cardOptions = {
                    dataIndex: index,
                    selected: card.selected,
                    playable: options.canPlay ? options.canPlay(card) : true
                };
                html += this.renderCard(card, cardOptions);
            });
        }
        html += '</div>';
        return html;
    }
}

// Экспорт классов для ES6 модулей
export { BaseGame, CardGame };

// Экспорт классов в глобальную область для совместимости
window.BaseGame = BaseGame;
window.CardGame = CardGame;
