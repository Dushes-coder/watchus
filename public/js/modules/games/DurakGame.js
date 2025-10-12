// ===== DURAK GAME CLASS =====

import { BaseGame } from '../core/BaseGame.js';

// Класс для игры в дурак
class DurakGame extends BaseGame {
    constructor() {
        super('durak');
        this.maxHandSize = 6;
        this.trumpSuit = null;
        this.currentAttacker = 'player';
    }

    // Создание колоды
    createDeck() {
        this.gameState.deck = [];
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        suits.forEach(suit => {
            values.forEach(value => {
                this.gameState.deck.push({
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
        for (let i = this.gameState.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.gameState.deck[i], this.gameState.deck[j]] = [this.gameState.deck[j], this.gameState.deck[i]];
        }
    }

    // Получение CSS-класса для масти
    getSuitClass(suit) {
        const classes = { '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs', '♠': 'spades' };
        return classes[suit] || '';
    }

    // Инициализация игры
    init() {
        try {
            console.log('DurakGame.init() called');
            if (!super.init()) {
                console.log('DurakGame.init(): super.init() failed');
                return false;
            }
            console.log('DurakGame.init(): super.init() success, container found:', !!this.container);

            if (this.isNetworkGame) {
                // Для сетевой игры устанавливаем базовый gameState
                this.gameState = {
                    gameType: 'durak',
                    deck: [],
                    discardedCards: [], // Добавляем сброс для бесконечной игры
                    player1Hand: [],
                    player2Hand: [],
                    attackingCards: [],
                    defendingCards: [],
                    trumpSuit: null,
                    currentAttacker: null, // Будет установлен сервером
                    gamePhase: 'waiting', // Ждем gameState с сервера
                    winner: null,
                    players: []
                };

                // Показываем сообщение о загрузке
                this.showLoadingState();

                // Убедимся, что socket в комнате
                console.log('DurakGame.init(): Ensuring socket is in room:', this.roomId);
                this.socket.emit('join-room', { roomId: this.roomId, userEmoji: '🎴' });

                // НЕ вызываем render() здесь - ждем gameState с сервера
                return true;
            }

            // Локальная игра (с ботом)
            this.gameState = {
                gameMode: 'durak',
                deck: [],
                discardedCards: [], // Добавляем сброс
                playerHand: [],
                opponentHand: [],
                attackingCards: [],
                defendingCards: [],
                trumpSuit: null,
                currentAttacker: 'player',
                gamePhase: 'attack',
                winner: null,
                roundWinner: null
            };

            // Устанавливаем глобальный gameState для совместимости с ботом
            window.gameState = this.gameState;

            // Устанавливаем mapping игроков для сетевой игры
            this.setupPlayerMapping();

            // Для сетевой игры не инициализируем локальное состояние
            if (this.isNetworkGame) {
                // Убедимся, что socket в комнате
                console.log('DurakGame.init(): Ensuring socket is in room:', this.roomId);
                this.socket.emit('join-room', { roomId: this.roomId, userEmoji: '🎴' });
                // НЕ вызываем render() здесь - ждем gameState с сервера
                return true;
            }

            // Создаем колоду, раздаем карты, определяем козыря и первого игрока
            this.createDeck();
            this.shuffleDeck();
            this.setTrumpSuit();
            this.dealInitialCards();
            this.determineFirstPlayer();

            console.log('DurakGame.init(): calling render');
            this.render();
            console.log('DurakGame.init(): render completed');

            return true;
        } catch (error) {
            console.error('DurakGame.init(): Error during initialization:', error);
            return false;
        }
    }

    // Настройка mapping игроков
    setupPlayerMapping() {
        if (this.socket && this.roomId && this.currentOpponent?.type === 'player') {
            this.isNetworkGame = true;
            // В сетевой игре player1 - получатель приглашения, player2 - отправитель
            // Это нужно для правильного определения первого хода
            this.gameState.players = [this.currentOpponent.id, this.socket.id]; // Получатель первым, отправитель вторым
        }
    }

    // Настройка символов игроков (для совместимости с InvitationManager)
    setupPlayerSymbols() {
        this.setupPlayerMapping();
    }

    // Определение козырной масти
    setTrumpSuit() {
        if (this.gameState.deck.length > 0) {
            this.gameState.trumpSuit = this.gameState.deck[this.gameState.deck.length - 1].suit;
        }
    }

    // Начальная раздача карт
    dealInitialCards() {
        this.gameState.playerHand = [];
        this.gameState.opponentHand = [];

        for (let i = 0; i < this.maxHandSize; i++) {
            if (this.gameState.deck.length > 0) this.gameState.playerHand.push(this.gameState.deck.pop());
            if (this.gameState.deck.length > 0) this.gameState.opponentHand.push(this.gameState.deck.pop());
        }
    }

    // Определение первого игрока (с самым младшим козырем)
    determineFirstPlayer() {
        const trumpSuit = this.gameState.trumpSuit;

        // Находим козыри у игрока
        const playerTrumps = this.gameState.playerHand.filter(card => card.suit === trumpSuit);
        const opponentTrumps = this.gameState.opponentHand.filter(card => card.suit === trumpSuit);

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
            if (playerLowestTrump.power < opponentLowestTrump.power) {
                this.gameState.currentAttacker = 'player';
            } else {
                this.gameState.currentAttacker = 'opponent';
                // Если бот ходит первым, делаем его ход
                if (this.currentOpponent?.type === 'bot') {
                    setTimeout(() => this.makeBotAttack(), 1000);
                }
            }
        } else if (playerLowestTrump) {
            this.gameState.currentAttacker = 'player';
        } else if (opponentLowestTrump) {
            this.gameState.currentAttacker = 'opponent';
            if (this.currentOpponent?.type === 'bot') {
                setTimeout(() => this.makeBotAttack(), 1000);
            }
        } else {
            // Ни у кого нет козырей - игрок ходит первым
            this.gameState.currentAttacker = 'player';
        }
    }

    // Рендеринг игры
    render() {
        if (!this.gameState) {
            console.log('DurakGame.render(): gameState not loaded yet, showing loading state');
            this.showLoadingState();
            return;
        }

        // Для сетевой игры проверяем, что у нас есть правильные данные
        if (this.isNetworkGame && (!this.playerRole || this.gameState.gamePhase === 'waiting')) {
            console.log('DurakGame.render(): Waiting for complete gameState from server, playerRole:', this.playerRole, 'gamePhase:', this.gameState.gamePhase);
            this.showLoadingState();
            return;
        }

        let html = this.renderOpponentInfo();
        html += '<div class="durak-game">';
        html += '<h3>🎴 Дурак</h3>';
        html += '<div class="game-info">';
        html += '<div>Козырь: <span class="trump-suit ' + (this.gameState.trumpSuit ? this.getSuitClass(this.gameState.trumpSuit) : '') + '">' + (this.gameState.trumpSuit || '?') + '</span></div>';
        html += '<div>Карт в колоде: ' + ((this.gameState.deck && Array.isArray(this.gameState.deck)) ? this.gameState.deck.length : 0) + '</div>';
        html += '<div>Карт в сбросе: ' + ((this.gameState.discardedCards && Array.isArray(this.gameState.discardedCards)) ? this.gameState.discardedCards.length : 0) + '</div>';
        const phaseName = this.gameState.gamePhase === 'attack' ? 'Атака' : 'Защита';
        const currentPlayerRole = this.getCurrentPlayerRole();
        console.log(`DurakGame.render() [${this.socket?.id}]: gamePhase=${this.gameState.gamePhase}, currentAttacker=${this.gameState.currentAttacker}, myRole=${currentPlayerRole}, playerRole=${this.playerRole}, isNetwork=${this.isNetworkGame}`);
        const attackerName = this.gameState.currentAttacker === currentPlayerRole ? 'Вы' : 'Противник';
        html += '<div>Фаза: ' + phaseName + ' (' + attackerName + ')</div>';
        html += '</div>';

        // Определяем, какие руки показывать
        let playerCards = [];
        let opponentCards = [];
        let playerCardCount = 0;
        let opponentCardCount = 0;

        if (this.isNetworkGame && this.playerRole) {
            // В сетевой игре определяем руки по ролям
            playerCards = this.playerRole === 'player1' ? (this.gameState.player1Hand || []) : (this.gameState.player2Hand || []);
            opponentCards = this.playerRole === 'player1' ? (this.gameState.player2Hand || []) : (this.gameState.player1Hand || []);
            playerCardCount = playerCards.length;
            opponentCardCount = opponentCards.length;
        } else {
            // Локальная игра с ботом
            playerCards = this.gameState.playerHand || [];
            opponentCards = this.gameState.opponentHand || [];
            playerCardCount = playerCards.length;
            opponentCardCount = opponentCards.length;
        }

        // Карты противника
        html += '<div class="opponent-cards">';
        html += '<h4>Карты противника (' + opponentCardCount + '):</h4>';
        html += '<div class="cards-hand opponent-hand">';
        for (let i = 0; i < opponentCardCount; i++) {
            html += '<div class="card card-back">🂠</div>';
        }
        html += '</div></div>';

        // Стол с картами
        html += '<div class="durak-table">';
        html += '<h4>Стол:</h4>';
        html += '<div class="table-cards">';
        for (let i = 0; i < (this.gameState.attackingCards || []).length; i++) {
            const attackCard = this.gameState.attackingCards[i];
            const defendCard = this.gameState.defendingCards[i];

            html += '<div class="card-pair">';
            html += '<div class="card ' + this.getSuitClass(attackCard.suit) + ' attacking">';
            html += '<div class="card-value">' + attackCard.value + '</div>';
            html += '<div class="card-suit">' + attackCard.suit + '</div>';
            html += '</div>';

            if (defendCard) {
                html += '<div class="card ' + this.getSuitClass(defendCard.suit) + ' defending">';
                html += '<div class="card-value">' + defendCard.value + '</div>';
                html += '<div class="card-suit">' + defendCard.suit + '</div>';
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div></div>';

        // Карты игрока
        html += '<div class="player-cards">';
        html += '<h4>Ваши карты:</h4>';
        html += '<div class="cards-hand player-hand">';
        playerCards.forEach((card, i) => {
            if (card && card.suit && card.value) {
                const suitClass = this.getSuitClass(card.suit);
                const canPlay = this.canPlayCard(card, i);
                const playableClass = canPlay ? ' playable' : '';
                html += '<div class="card ' + suitClass + playableClass + '" data-index="' + i + '" onclick="window.gameManager.getCurrentGame().handleCardClick(' + i + ')">';
                html += '<div class="card-value">' + card.value + '</div>';
                html += '<div class="card-suit">' + card.suit + '</div>';
                html += '</div>';
            }
        });
        html += '</div></div>';

        // Кнопки управления
        html += '<div class="durak-controls">';

        // Кнопки в зависимости от фазы игры
        const myRole = this.getCurrentPlayerRole();
        console.log(`DurakGame.render() [${this.socket?.id}]: Showing controls for myRole=${myRole}, currentAttacker=${this.gameState.currentAttacker}, gamePhase=${this.gameState.gamePhase}`);
        if (this.gameState.gamePhase === 'defend' && this.gameState.currentAttacker !== myRole) {
            // Игрок защищается
            console.log(`DurakGame.render() [${this.socket?.id}]: Showing defense buttons for defender`);
            html += '<button onclick="window.gameManager.getCurrentGame().takeCards()" class="action-btn">Взять карты</button>';
            // Убираем кнопку "Пас (взять)" - пас в защите означает взять карты
        }

        if (this.gameState.gamePhase === 'attack' && this.gameState.currentAttacker === myRole) {
            // Игрок атакует
            console.log(`DurakGame.render() [${this.socket?.id}]: Showing attack buttons for attacker`);
            if ((this.gameState.attackingCards || []).length > 0) {
                html += '<button onclick="window.gameManager.getCurrentGame().passTurn()" class="action-btn">Пас (завершить атаку)</button>';
            }
        }

        if (this.gameState.gamePhase === 'defend' && this.gameState.currentAttacker === myRole) {
            // Игрок атаковал, может подкинуть
            console.log(`DurakGame.render() [${this.socket?.id}]: Showing throw buttons for attacker in defend phase`);
            const allDefended = (this.gameState.attackingCards || []).every((_, i) => (this.gameState.defendingCards || [])[i]);
            if (allDefended && (this.gameState.attackingCards || []).length > 0) {
                html += '<button onclick="window.gameManager.getCurrentGame().passTurn()" class="action-btn">Пас (отбой)</button>';
            }
        }

        if (this.gameState.gamePhase === 'attack' && this.gameState.currentAttacker !== myRole) {
            // Противник атаковал, игрок может подкинуть если все отбиты
            console.log(`DurakGame.render() [${this.socket?.id}]: Showing throw buttons for defender in attack phase`);
            const allDefended = (this.gameState.attackingCards || []).every((_, i) => (this.gameState.defendingCards || [])[i]);
            if (allDefended && (this.gameState.attackingCards || []).length > 0) {
                html += '<button onclick="window.gameManager.getCurrentGame().passTurn()" class="action-btn">Пас (отбой)</button>';
            }
        }

        html += '<button onclick="window.gameManager.getCurrentGame().newRound()" class="action-btn">Новая игра</button>';
        html += '<button onclick="window.gameManager.closeCurrentGame()" class="back-btn">Назад к меню</button>';
        html += '</div>';

        html += '</div>';

        console.log('DurakGame.render(): setting innerHTML, html length:', html.length);
        this.container.innerHTML = html;
        this.container.style.display = 'block'; // Показываем контейнер
        console.log('DurakGame.render(): container displayed');
    }

    // Показать состояние загрузки
    showLoadingState() {
        if (this.container) {
            this.container.innerHTML = `
                <div class="game-loading">
                    <h3>🎴 Дурак</h3>
                    <div class="loading-spinner"></div>
                    <p>Загрузка игры...</p>
                    <p>Подключение к серверу...</p>
                </div>
            `;
            this.container.style.display = 'block';
        }
    }

    // Получение роли текущего игрока
    getCurrentPlayerRole() {
        if (this.isNetworkGame && this.playerRole) {
            return this.playerRole;
        }
        return 'player';
    }

    // Проверка, может ли игрок сыграть картой
    canPlayCard(card, index) {
        if (!this.gameState) return false;

        const playerRole = this.getCurrentPlayerRole();
        const playerCards = this.isNetworkGame && this.playerRole ?
            (this.playerRole === 'player1' ? this.gameState.player1Hand : this.gameState.player2Hand) :
            this.gameState.playerHand;

        if (this.gameState.gamePhase === 'attack' && this.gameState.currentAttacker === playerRole) {
            // Игрок атакует
            if ((this.gameState.attackingCards || []).length === 0) {
                return true; // Первая атака - любой картой
            } else {
                return this.canAttackOrThrowCard(card);
            }
        } else if (this.gameState.gamePhase === 'defend' && this.gameState.currentAttacker !== playerRole) {
            // Игрок защищается
            const undefendedCards = (this.gameState.attackingCards || []).filter((_, i) => !(this.gameState.defendingCards || [])[i]);
            return undefendedCards.some(attackCard => this.canDefendCard(card, attackCard));
        } else if (this.gameState.gamePhase === 'defend' && this.gameState.currentAttacker === playerRole) {
            // Игрок атаковал, может подкинуть
            const allDefended = (this.gameState.attackingCards || []).every((_, i) => (this.gameState.defendingCards || [])[i]);
            if (allDefended) {
                return this.canAttackOrThrowCard(card);
            }
        } else if (this.gameState.gamePhase === 'attack' && this.gameState.currentAttacker !== playerRole) {
            // Противник атаковал, игрок может подкинуть если все отбиты
            const allDefended = (this.gameState.attackingCards || []).every((_, i) => (this.gameState.defendingCards || [])[i]);
            if (allDefended) {
                return this.canAttackOrThrowCard(card);
            }
        }

        return false;
    }

    // Проверка, можно ли использовать карту для атаки/подкидывания
    canAttackOrThrowCard(card) {
        if (this.gameState.attackingCards.length === 0) return true;

        const tableValues = [...this.gameState.attackingCards, ...this.gameState.defendingCards]
            .map(c => c.value);
        return tableValues.includes(card.value);
    }

    // Проверка, можно ли защититься картой
    canDefendCard(defendCard, attackCard) {
        // Можно бить картой той же масти, но большего достоинства
        if (defendCard.suit === attackCard.suit && defendCard.power > attackCard.power) {
            return true;
        }

        // Можно бить козырем, если атакующая карта не козырь
        if (defendCard.suit === this.gameState.trumpSuit && attackCard.suit !== this.gameState.trumpSuit) {
            return true;
        }

        // Козырь можно бить только более старшим козырем
        if (defendCard.suit === this.gameState.trumpSuit &&
            attackCard.suit === this.gameState.trumpSuit &&
            defendCard.power > attackCard.power) {
            return true;
        }

        return false;
    }

    // Обработка клика по карте
    handleCardClick(index) {
        if (!this.gameState) return;

        const playerRole = this.getCurrentPlayerRole();
        const playerCards = this.isNetworkGame && this.playerRole ?
            (this.playerRole === 'player1' ? this.gameState.player1Hand : this.gameState.player2Hand) :
            this.gameState.playerHand;

        const card = playerCards ? playerCards[index] : null;
        if (!card) return;

        if (this.gameState.gamePhase === 'attack' && this.gameState.currentAttacker === playerRole) {
            this.playerAttack(card, index);
        } else if (this.gameState.gamePhase === 'defend' && this.gameState.currentAttacker !== playerRole) {
            this.playerDefend(card, index);
        } else if (this.gameState.gamePhase === 'defend' && this.gameState.currentAttacker === playerRole) {
            this.playerThrow(card, index);
        } else if (this.gameState.gamePhase === 'attack' && this.gameState.currentAttacker !== playerRole) {
            this.playerThrow(card, index);
        }
    }

    // Атака игрока
    playerAttack(card, index) {
        if (this.gameState.attackingCards.length === 0) {
            // Первая атака
            this.makeAttack(card, index);
        } else if (this.canAttackOrThrowCard(card)) {
            // Подкидывание
            this.makeThrow(card, index);
        } else {
            this.showNotification('Нельзя подкинуть эту карту!', 'warning');
        }
    }

    // Защита игрока
    playerDefend(card, index) {
        const undefendedCards = this.gameState.attackingCards.filter((_, i) => !this.gameState.defendingCards[i]);

        if (undefendedCards.length === 0) {
            this.showNotification('Все карты уже отбиты!', 'warning');
            return;
        }

        const attackCard = undefendedCards[0];
        if (this.canDefendCard(card, attackCard)) {
            this.makeDefense(card, index);
        } else {
            this.showNotification('Этой картой нельзя отбиться!', 'warning');
        }
    }

    // Подкидывание игрока
    playerThrow(card, index) {
        const allDefended = this.gameState.attackingCards.every((_, i) => this.gameState.defendingCards[i]);

        if (!allDefended) {
            this.showNotification('Сначала нужно отбить все атакующие карты!', 'warning');
            return;
        }

        if (this.canAttackOrThrowCard(card)) {
            this.makeThrow(card, index);
        } else {
            this.showNotification('Нельзя подкинуть эту карту!', 'warning');
        }
    }

    // Совершение атаки
    makeAttack(card, index) {
        if (this.isNetworkGame) {
            this.sendMove({
                action: 'play',
                card: card,
                playerId: this.socket.id,
                cardIndex: index
            });
        }

        this.gameState.attackingCards.push(card);
        if (this.isNetworkGame && this.playerRole) {
            const playerHand = this.playerRole === 'player1' ? this.gameState.player1Hand : this.gameState.player2Hand;
            playerHand.splice(index, 1);
        } else {
            this.gameState.playerHand.splice(index, 1);
        }
        this.gameState.gamePhase = 'defend';

        this.showNotification(`Вы сыграли ${card.value}${card.suit}`, 'info');
        this.render();

        // Бот защищается
        if (this.currentOpponent?.type === 'bot') {
            setTimeout(() => this.makeBotDefense(), 1000);
        }
    }

    // Совершение защиты
    makeDefense(card, index) {
        if (this.isNetworkGame) {
            this.sendMove({
                action: 'defend',
                card: card,
                playerId: this.socket.id,
                cardIndex: index
            });
        }

        const undefendedIndex = this.gameState.attackingCards.findIndex((_, i) => !this.gameState.defendingCards[i]);
        this.gameState.defendingCards[undefendedIndex] = card;
        if (this.isNetworkGame && this.playerRole) {
            const playerHand = this.playerRole === 'player1' ? this.gameState.player1Hand : this.gameState.player2Hand;
            playerHand.splice(index, 1);
        } else {
            this.gameState.playerHand.splice(index, 1);
        }

        this.showNotification(`Вы отбились ${card.value}${card.suit}`, 'success');
        this.render();

        // Проверяем, все ли карты отбиты
        const allDefended = this.gameState.attackingCards.every((_, i) => this.gameState.defendingCards[i]);

        if (allDefended) {
            // Бот может подкинуть
            if (this.currentOpponent?.type === 'bot') {
                setTimeout(() => this.makeBotThrow(), 1000);
            }
        } else {
            // Продолжаем защиту
            if (this.currentOpponent?.type === 'bot') {
                setTimeout(() => this.makeBotDefense(), 1000);
            }
        }
    }

    // Совершение подкидывания
    makeThrow(card, index) {
        if (this.isNetworkGame) {
            this.sendMove({
                action: 'play',
                card: card,
                playerId: this.socket.id,
                cardIndex: index
            });
        }

        this.gameState.attackingCards.push(card);
        if (this.isNetworkGame && this.playerRole) {
            const playerHand = this.playerRole === 'player1' ? this.gameState.player1Hand : this.gameState.player2Hand;
            playerHand.splice(index, 1);
        } else {
            this.gameState.playerHand.splice(index, 1);
        }
        this.gameState.gamePhase = 'defend';

        this.showNotification(`Вы подкинули ${card.value}${card.suit}`, 'info');
        this.render();

        // Бот защищается от подкинутой карты
        if (this.currentOpponent?.type === 'bot') {
            setTimeout(() => this.makeBotDefense(), 1000);
        }
    }

    // Игрок берет карты
    takeCards() {
        if (this.isNetworkGame) {
            this.sendMove({
                action: 'take',
                playerId: this.socket.id
            });
        }

        // Игрок берет все карты со стола
        if (this.isNetworkGame && this.playerRole) {
            const playerHand = this.playerRole === 'player1' ? this.gameState.player1Hand : this.gameState.player2Hand;
            playerHand.push(...this.gameState.attackingCards);
            playerHand.push(...this.gameState.defendingCards);
            // Атакующий остается тем же
        } else {
            this.gameState.playerHand.push(...this.gameState.attackingCards);
            this.gameState.playerHand.push(...this.gameState.defendingCards);
            // Атакующий остается тем же
        }
        this.gameState.attackingCards = [];
        this.gameState.defendingCards = [];
        this.gameState.gamePhase = 'attack';

        this.refillHands();
        this.showNotification('Вы взяли карты со стола', 'warning');
        this.render();

        // Бот атакует
        if (this.currentOpponent?.type === 'bot') {
            setTimeout(() => this.makeBotAttack(), 1000);
        }
    }

    // Пас (завершение раунда)
    passTurn() {
        if (this.isNetworkGame) {
            this.sendMove({
                action: 'pass',
                playerId: this.socket.id
            });
        }

        this.finishRound();
    }

    // Завершение раунда
    finishRound() {
        console.log('finishRound() called, currentAttacker before:', this.gameState.currentAttacker);
        // Убираем карты со стола в сброс
        if (this.gameState.discardedCards) {
            this.gameState.discardedCards.push(...this.gameState.attackingCards);
            this.gameState.discardedCards.push(...this.gameState.defendingCards);
            console.log('Cards moved to discard pile, total discarded:', this.gameState.discardedCards.length);
        }
        this.gameState.attackingCards = [];
        this.gameState.defendingCards = [];

        // Меняем атакующего (только для локальной игры)
        if (!this.isNetworkGame) {
            this.gameState.currentAttacker = this.gameState.currentAttacker === 'player' ? 'opponent' : 'player';
            console.log('finishRound() - new attacker:', this.gameState.currentAttacker);
        }
        // Для сетевой игры currentAttacker меняет сервер
        
        this.gameState.gamePhase = 'attack';

        this.refillHands();
        this.showNotification('Раунд завершен (отбой)', 'info');
        this.render();

        // Если теперь атакует бот, делаем его ход
        if (this.gameState.currentAttacker === 'opponent' && this.currentOpponent?.type === 'bot') {
            console.log('Bot should attack now');
            setTimeout(() => this.makeBotAttack(), 1000);
        }
    }

    // Пополнение рук
    refillHands() {
        console.log('refillHands() called, deck length:', this.gameState.deck.length, 'discarded length:', this.gameState.discardedCards?.length);
        
        // Если колода пуста, перемешаем использованные карты и продолжим
        if (this.gameState.deck.length === 0 && this.gameState.discardedCards && this.gameState.discardedCards.length > 0) {
            console.log('Deck empty, reshuffling discarded cards, discarded count:', this.gameState.discardedCards.length);
            this.gameState.deck = [...this.gameState.discardedCards];
            this.gameState.discardedCards = [];
            
            // Перемешиваем
            for (let i = this.gameState.deck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.gameState.deck[i], this.gameState.deck[j]] = [this.gameState.deck[j], this.gameState.deck[i]];
            }
            
            console.log('Deck reshuffled, new deck length:', this.gameState.deck.length);
        } else if (this.gameState.deck.length === 0) {
            console.log('Deck empty but no discarded cards to reshuffle');
        }
        
        // Пополняем руки до 6 карт
        if (this.isNetworkGame && this.playerRole) {
            const playerHand = this.playerRole === 'player1' ? this.gameState.player1Hand : this.gameState.player2Hand;
            const opponentHand = this.playerRole === 'player1' ? this.gameState.player2Hand : this.gameState.player1Hand;
            while (playerHand.length < this.maxHandSize && this.gameState.deck.length > 0) {
                playerHand.push(this.gameState.deck.pop());
            }
            while (opponentHand.length < this.maxHandSize && this.gameState.deck.length > 0) {
                opponentHand.push(this.gameState.deck.pop());
            }
        } else {
            console.log('refillHands() - player hand before:', this.gameState.playerHand.length, 'opponent hand before:', this.gameState.opponentHand.length);
            while (this.gameState.playerHand.length < this.maxHandSize && this.gameState.deck.length > 0) {
                this.gameState.playerHand.push(this.gameState.deck.pop());
            }
            while (this.gameState.opponentHand.length < this.maxHandSize && this.gameState.deck.length > 0) {
                this.gameState.opponentHand.push(this.gameState.deck.pop());
            }
            console.log('refillHands() - player hand after:', this.gameState.playerHand.length, 'opponent hand after:', this.gameState.opponentHand.length, 'final deck length:', this.gameState.deck.length);
        }

        // Проверяем окончание игры
        this.checkGameEnd();
    }

    // Проверка окончания игры
    checkGameEnd() {
        let playerHasCards = false;
        let opponentHasCards = false;

        if (this.isNetworkGame && this.playerRole) {
            const playerHand = this.playerRole === 'player1' ? this.gameState.player1Hand : this.gameState.player2Hand;
            const opponentHand = this.playerRole === 'player1' ? this.gameState.player2Hand : this.gameState.player1Hand;
            playerHasCards = playerHand.length > 0;
            opponentHasCards = opponentHand.length > 0;
        } else {
            playerHasCards = this.gameState.playerHand.length > 0;
            opponentHasCards = this.gameState.opponentHand.length > 0;
        }

        // Проверка окончания игры: если один игрок остался без карт и колода пуста
        if (this.isNetworkGame) {
            if (this.playerRole === 'player1' && !playerHasCards && opponentHasCards && this.gameState.deck.length === 0) {
                this.gameState.winner = 'player1';
                this.showGameResult(true); // Вы выиграли
            } else if (this.playerRole === 'player2' && !playerHasCards && opponentHasCards && this.gameState.deck.length === 0) {
                this.gameState.winner = 'player2';
                this.showGameResult(true); // Вы выиграли
            } else if (this.playerRole === 'player1' && playerHasCards && !opponentHasCards && this.gameState.deck.length === 0) {
                this.gameState.winner = 'player2';
                this.showGameResult(false); // Вы проиграли
            } else if (this.playerRole === 'player2' && playerHasCards && !opponentHasCards && this.gameState.deck.length === 0) {
                this.gameState.winner = 'player1';
                this.showGameResult(false); // Вы проиграли
            }
        } else {
            // Локальная игра с ботом
            if (!playerHasCards && opponentHasCards && this.gameState.deck.length === 0) {
                this.gameState.winner = 'player';
                this.showGameResult(true); // Вы выиграли
            } else if (playerHasCards && !opponentHasCards && this.gameState.deck.length === 0) {
                this.gameState.winner = 'opponent';
                this.showGameResult(false); // Бот выиграл
            }
        }
    }

    // Показ результата игры индивидуально для игрока
    showGameResult(isWinner) {
        const message = isWinner ? '🎉 Вы выиграли! 🎉' : '😢 Вы проиграли 😢';
        const color = isWinner ? 'success' : 'error';

        // Показываем результат в интерфейсе
        if (this.container) {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'game-result';
            resultDiv.innerHTML = `
                <div class="result-message ${color}">
                    <h2>${message}</h2>
                    <p>Игра окончена</p>
                    <button onclick="window.selectDurak()" class="action-btn">Новая игра</button>
                </div>
            `;
            this.container.appendChild(resultDiv);
        }

        this.showNotification(message, color);
    }

    // Атака бота
    makeBotAttack() {
        if (this.gameState.currentAttacker !== 'opponent' || this.currentOpponent?.type !== 'bot') return;

        // Простая логика: бот атакует самой слабой картой
        if (this.gameState.opponentHand.length > 0) {
            const weakestCard = this.gameState.opponentHand.reduce((weakest, card) =>
                card.power < weakest.power ? card : weakest
            );

            this.gameState.attackingCards.push(weakestCard);
            this.gameState.opponentHand.splice(this.gameState.opponentHand.indexOf(weakestCard), 1);
            this.gameState.gamePhase = 'defend';

            this.showNotification(`Противник атаковал ${weakestCard.value}${weakestCard.suit}`, 'info');
            this.render();

            // Даем игроку время на защиту
            setTimeout(() => {
                // Если игрок не отбил, бот продолжит в следующем цикле
            }, 1000);
        }
    }

    // Защита бота
    makeBotDefense() {
        if (this.currentOpponent?.type !== 'bot') return;

        const undefendedCards = this.gameState.attackingCards.filter((_, i) => !this.gameState.defendingCards[i]);

        if (undefendedCards.length === 0) {
            // Все карты отбиты, бот может подкинуть
            setTimeout(() => this.makeBotThrow(), 1000);
            return;
        }

        const attackCard = undefendedCards[0];
        
        // Простая логика защиты: ищем подходящую карту для защиты
        const defenseCard = this.gameState.opponentHand.find(card => this.canDefendCard(card, attackCard));

        if (defenseCard) {
            const undefendedIndex = this.gameState.attackingCards.findIndex((_, i) => !this.gameState.defendingCards[i]);
            this.gameState.defendingCards[undefendedIndex] = defenseCard;
            this.gameState.opponentHand.splice(this.gameState.opponentHand.indexOf(defenseCard), 1);

            this.showNotification(`Противник отбился ${defenseCard.value}${defenseCard.suit}`, 'info');
            this.render();

            // Продолжаем защиту или переходим к подкидыванию
            const allDefended = this.gameState.attackingCards.every((_, i) => this.gameState.defendingCards[i]);
            if (allDefended) {
                setTimeout(() => this.makeBotThrow(), 1000);
            } else {
                setTimeout(() => this.makeBotDefense(), 1000);
            }
        } else {
            // Бот берет карты
            this.botTakeCards();
        }
    }

    // Подкидывание бота
    makeBotThrow() {
        if (this.gameState.currentAttacker === 'player' || this.currentOpponent?.type !== 'bot') return;

        // Простая логика подкидывания: подкидываем карту того же достоинства
        const tableValues = [...this.gameState.attackingCards, ...this.gameState.defendingCards]
            .map(c => c.value);
        
        const throwableCards = this.gameState.opponentHand.filter(card => tableValues.includes(card.value));

        if (throwableCards.length > 0) {
            // Случайно выбираем карту для подкидывания
            const cardToThrow = throwableCards[Math.floor(Math.random() * throwableCards.length)];

            this.gameState.attackingCards.push(cardToThrow);
            this.gameState.opponentHand.splice(this.gameState.opponentHand.indexOf(cardToThrow), 1);
            this.gameState.gamePhase = 'defend';

            this.showNotification(`Противник подкинул ${cardToThrow.value}${cardToThrow.suit}`, 'info');
            this.render();
            return;
        }

        // Бот не подкидывает - отбой
        console.log('Bot passes - finishing round');
        this.showNotification('Противник завершил раунд (отбой)', 'info');
        this.finishRound();
    }

    // Бот берет карты
    botTakeCards() {
        this.gameState.opponentHand.push(...this.gameState.attackingCards);
        this.gameState.opponentHand.push(...this.gameState.defendingCards);
        this.gameState.attackingCards = [];
        this.gameState.defendingCards = [];
        this.gameState.gamePhase = 'attack';
        // Атакующий остается тем же (opponent)

        this.refillHands();
        this.showNotification('Противник взял карты со стола', 'warning');
        this.render();
    }

    // Новая игра
    newRound() {
        console.log('DurakGame.newRound() called');
        if (this.isNetworkGame) {
            this.showNotification('Новая игра недоступна в сетевом режиме', 'warning');
            return;
        }
        // Для локальной игры сбрасываем состояние
        this.gameState = {
            gameMode: 'durak',
            deck: [],
            discardedCards: [],
            playerHand: [],
            opponentHand: [],
            attackingCards: [],
            defendingCards: [],
            trumpSuit: null,
            currentAttacker: 'player',
            gamePhase: 'attack',
            winner: null,
            roundWinner: null
        };
        this.createDeck();
        this.shuffleDeck();
        this.setTrumpSuit();
        this.dealInitialCards();
        this.determineFirstPlayer();
        this.render();
        this.showNotification('Новая игра начата!', 'info');
    };

    // Обработка сетевых ходов
    handleNetworkMove(move) {
        // Если это gameState update
        if (!move.action) {
            console.log(`DurakGame [${this.socket?.id}]: Received gameState update, gamePhase: ${move.gamePhase}`);
            this.playerRole = this.socket?.id === move.players?.[0] ? 'player1' : 'player2';
            // Если playerRole не установлен (socket.id не доступен), определяем по currentOpponent
            if (!this.playerRole) {
                if (this.currentOpponent?.id === move.players?.[0]) {
                    this.playerRole = 'player2'; // Приглашенный игрок
                } else {
                    this.playerRole = 'player1'; // Отправитель приглашения
                }
            }
            console.log(`DurakGame [${this.socket?.id || 'unknown'}]: My role: ${this.playerRole}`);
            console.log(`DurakGame [${this.socket?.id}]: Deck length: ${move.deck?.length}`);
            console.log(`DurakGame [${this.socket?.id}]: Attacking cards:`, move.attackingCards?.map(c => c.value + c.suit));
            console.log(`DurakGame [${this.socket?.id}]: Defending cards:`, move.defendingCards?.map(c => c.value + c.suit));
            if (this.playerRole === 'player1') {
                console.log(`DurakGame [${this.socket?.id}]: My hand:`, move.player1Hand?.map(c => c.value + c.suit));
                console.log(`DurakGame [${this.socket?.id}]: Opponent hand:`, move.player2Hand?.length, 'cards');
            } else {
                console.log(`DurakGame [${this.socket?.id}]: My hand:`, move.player2Hand?.map(c => c.value + c.suit));
                console.log(`DurakGame [${this.socket?.id}]: Opponent hand:`, move.player1Hand?.length, 'cards');
            }
            console.log(`DurakGame [${this.socket?.id}]: Current attacker: ${move.currentAttacker}`);
            
            // Проверяем, что gameState полный
            const isComplete = move.gamePhase && move.players && move.deck && move.player1Hand && move.player2Hand !== undefined;
            console.log(`DurakGame [${this.socket?.id}]: Checking completeness - gamePhase: ${!!move.gamePhase}, players: ${!!move.players}, deck: ${!!move.deck}, player1Hand: ${!!move.player1Hand}, player2Hand: ${move.player2Hand !== undefined}, complete: ${isComplete}`);
            if (isComplete) {
                this.gameState = move;
                console.log(`DurakGame [${this.socket?.id}]: Full gameState received, rendering`);
                this.render();
            } else {
                console.log(`DurakGame [${this.socket?.id}]: Incomplete gameState received, waiting for complete data`);
                console.log(`DurakGame [${this.socket?.id}]: Missing fields:`, {
                    gamePhase: !move.gamePhase,
                    players: !move.players,
                    deck: !move.deck,
                    player1Hand: !move.player1Hand,
                    player2Hand: move.player2Hand === undefined
                });
            }
            return;
        }

        const { action, card, playerId, cardIndex } = move;
        const isCurrentPlayer = playerId === this.socket?.id;

        if (action === 'play' && card) {
            if (isCurrentPlayer) {
                const index = this.gameState.playerHand.findIndex(c =>
                    c.suit === card.suit && c.value === card.value
                );
                if (index !== -1) {
                    this.gameState.attackingCards.push(card);
                    this.gameState.playerHand.splice(index, 1);
                }
            } else {
                const index = this.gameState.opponentHand.findIndex(c =>
                    c.suit === card.suit && c.value === card.value
                );
                if (index !== -1) {
                    this.gameState.attackingCards.push(card);
                    this.gameState.opponentHand.splice(index, 1);
                }
            }
            this.gameState.gamePhase = 'defend';
            this.showNotification(`${isCurrentPlayer ? 'Вы' : 'Противник'} сыграли ${card.value}${card.suit}`, 'info');

        } else if (action === 'defend' && card) {
            if (isCurrentPlayer) {
                const index = this.gameState.playerHand.findIndex(c =>
                    c.suit === card.suit && c.value === card.value
                );
                if (index !== -1) {
                    const undefendedIndex = this.gameState.attackingCards.findIndex((_, i) => !this.gameState.defendingCards[i]);
                    this.gameState.defendingCards[undefendedIndex] = card;
                    this.gameState.playerHand.splice(index, 1);
                }
            } else {
                const index = this.gameState.opponentHand.findIndex(c =>
                    c.suit === card.suit && c.value === card.value
                );
                if (index !== -1) {
                    const undefendedIndex = this.gameState.attackingCards.findIndex((_, i) => !this.gameState.defendingCards[i]);
                    this.gameState.defendingCards[undefendedIndex] = card;
                    this.gameState.opponentHand.splice(index, 1);
                }
            }
            this.showNotification(`${isCurrentPlayer ? 'Вы' : 'Противник'} отбились ${card.value}${card.suit}`, 'success');

        } else if (action === 'take') {
            if (isCurrentPlayer) {
                this.gameState.playerHand.push(...this.gameState.attackingCards);
                this.gameState.playerHand.push(...this.gameState.defendingCards);
                // Атакующий остается тем же (не меняем currentAttacker)
            } else {
                this.gameState.opponentHand.push(...this.gameState.attackingCards);
                this.gameState.opponentHand.push(...this.gameState.defendingCards);
                // Атакующий остается тем же
            }
            this.gameState.attackingCards = [];
            this.gameState.defendingCards = [];
            this.gameState.gamePhase = 'attack';
            this.refillHands();
            this.showNotification(`${isCurrentPlayer ? 'Вы' : 'Противник'} взяли карты со стола`, 'warning');
        }
    };

    // Новая игра
    newRound() {
        console.log('DurakGame.newRound() called');
        if (this.isNetworkGame) {
            this.showNotification('Новая игра недоступна в сетевом режиме', 'warning');
            return;
        }
        // Для локальной игры сбрасываем состояние
        this.gameState = {
            gameMode: 'durak',
            deck: [],
            discardedCards: [],
            playerHand: [],
            opponentHand: [],
            attackingCards: [],
            defendingCards: [],
            trumpSuit: null,
            currentAttacker: 'player',
            gamePhase: 'attack',
            winner: null,
            roundWinner: null
        };
        this.createDeck();
        this.shuffleDeck();
        this.setTrumpSuit();
        this.dealInitialCards();
        this.determineFirstPlayer();
        this.render();
        this.showNotification('Новая игра начата!', 'info');
    }
}

// Экспорт класса для ES6 модулей
export { DurakGame };

// Экспорт класса в глобальную область
window.DurakGame = DurakGame;
