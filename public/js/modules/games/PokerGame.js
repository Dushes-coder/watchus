// ===== POKER GAME CLASS =====

import { BaseGame } from '../core/BaseGame.js';

// Класс для игры в покер
class PokerGame extends BaseGame {
    constructor() {
        super('poker');
        this.round = 1;
        this.maxRounds = 10;
        this.playerScore = 0;
        this.opponentScore = 0;
        this.gamePhase = 'discard'; // 'discard', 'waiting', 'finished'
    }

    // Создание колоды
    createDeck() {
        this.deck = [];
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        suits.forEach(suit => {
            values.forEach(value => {
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
        const powers = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
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

    // Инициализация игры
    init() {
        try {
            console.log('PokerGame.init() called');
            if (!super.init()) {
                console.log('PokerGame.init(): super.init() failed');
                return false;
            }
            console.log('PokerGame.init(): super.init() success, container found:', !!this.container);

            // Устанавливаем mapping игроков для определения типа игры
            this.setupPlayerMapping();

            if (this.isNetworkGame) {
                // Для сетевой игры состояние приходит с сервера
                console.log('PokerGame.init(): Network game detected');

                // Показываем сообщение о загрузке
                this.showLoadingState();

                // Убедимся, что socket в комнате
                console.log('PokerGame.init(): Ensuring socket is in room:', this.roomId);
                this.socket.emit('join-room', { roomId: this.roomId, userEmoji: '🃏' });

            // Подписываемся на обновления состояния игры
            if (this.socket && this.roomId) {
                // game-state обрабатывается через games.js handleGameStateUpdate
                // socket.on('game-state') убрана, чтобы избежать дублирования
            }

                // НЕ вызываем render() здесь - ждем gameState с сервера
                return true;
            }

            // Локальная игра (с ботом)
            this.gameState = {
                gameMode: 'poker',
                deck: [],
                playerHand: [],
                opponentHand: [],
                playerScore: 0,
                opponentScore: 0,
                currentPlayer: 'player',
                round: 1,
                gamePhase: 'discard',
                winner: null
            };

            // Создаем колоду и раздаем карты
            this.createDeck();
            this.shuffleDeck();
            this.dealCards();

            console.log('PokerGame.init(): calling render');
            this.render();
            console.log('PokerGame.init(): render completed');

            return true;
        } catch (error) {
            console.error('PokerGame.init(): Error during initialization:', error);
            return false;
        }
    }

    // Настройка mapping игроков
    setupPlayerMapping() {
        if (this.socket && this.roomId && this.currentOpponent?.type === 'player') {
            this.isNetworkGame = true;
            // this.gameState.players будет установлен сервером при получении game-state
        }
    }

    // Настройка символов игроков (для совместимости с InvitationManager)
    setupPlayerSymbols() {
        this.setupPlayerMapping();
    }

    // Раздача карт
    dealCards() {
        this.gameState.playerHand = [];
        this.gameState.opponentHand = [];

        for (let i = 0; i < 5; i++) {
            if (this.deck.length > 0) this.gameState.playerHand.push(this.deck.pop());
            if (this.deck.length > 0) this.gameState.opponentHand.push(this.deck.pop());
        }
    }

    // Рендеринг игры
    render() {
        if (!this.gameState) {
            console.log('PokerGame.render(): gameState not loaded yet, showing loading state');
            this.showLoadingState();
            return;
        }

        if (this.isNetworkGame && !this.gameState.players) {
            console.log('PokerGame.render(): players not loaded yet, showing loading state');
            this.showLoadingState();
            return;
        }

        if (this.isNetworkGame && (!this.gameState.player1Hand || !this.gameState.player2Hand)) {
            console.log('PokerGame.render(): hands not loaded yet, showing loading state');
            this.showLoadingState();
            return;
        }

        // Для сетевых игр определяем руки игроков
        let playerHand, opponentHand, playerScore, opponentScore;
        if (this.isNetworkGame && this.playerRole) {
            playerHand = this.playerRole === 'player1' ? this.gameState.player1Hand : this.gameState.player2Hand;
            opponentHand = this.playerRole === 'player1' ? this.gameState.player2Hand : this.gameState.player1Hand;
        } else {
            playerHand = this.gameState.playerHand;
            opponentHand = this.gameState.opponentHand;
            playerScore = this.gameState.playerScore;
            opponentScore = this.gameState.opponentScore;
        }

        let html = this.renderOpponentInfo();
        html += '<div class="poker-game">';
        html += '<h3>🃏 Покер</h3>';
        html += '<div class="game-info">';
        html += `<div>Раунд: <strong>${this.gameState.round || 1}</strong></div>`;
        html += `<div>Ваш счёт: ${playerScore}</div>`;
        html += `<div>Счёт противника: ${opponentScore}</div>`;
        html += '</div>';

        // Карты противника
        if (this.gameState.gamePhase !== 'waiting') {
            html += '<div class="opponent-cards">';
            html += '<h4>Карты противника:</h4>';
            html += '<div class="cards-hand opponent-hand">';
            if (opponentHand && opponentHand.length > 0) {
                for (let i = 0; i < opponentHand.length; i++) {
                    const card = opponentHand[i];
                    if (this.gameState.gamePhase === 'waiting' || this.gameState.gamePhase === 'finished') {
                        // Показываем открытые карты после проверки
                        const suitClass = this.getSuitClass(card.suit);
                        html += `<div class="card ${suitClass} revealed">`;
                        html += `<div class="card-value">${card.value}</div>`;
                        html += `<div class="card-suit">${card.suit}</div>`;
                        html += '</div>';
                    } else {
                        // Закрытые карты
                        html += '<div class="card card-back">🂠</div>';
                    }
                }
            }
            html += '</div></div>';
        }

        // Центральная область
        html += '<div class="poker-center">';
        if (this.gameState.gamePhase === 'finished') {
            if (this.isNetworkGame) {
                // Для сетевой игры finished означает конец раунда, показываем индивидуальный результат
                let playerResult;
                if (this.gameState.winner === 'draw') {
                    playerResult = 'НИЧЬЯ!';
                } else if (this.gameState.winner === this.playerRole) {
                    playerResult = 'ПОБЕДА!';
                } else {
                    playerResult = 'ПОРАЖЕНИЕ!';
                }

                const resultColor = playerResult === 'ПОБЕДА!' ? '#28a745' : 
                                   playerResult === 'ПОРАЖЕНИЕ!' ? '#dc3545' : '#ffc107';

                html += '<div class="poker-status">';
                html += '<div style="font-size: 24px; font-weight: bold; color: ' + resultColor + '; margin-bottom: 10px;">' + playerResult + '</div>';
                html += '<div>Раунд завершен! Нажмите "Новая игра" для следующего раунда.</div>';
                html += '</div>';
            } else {
                // Для локальной игры finished означает конец игры
                const winner = this.gameState.winner;
                html += '<div class="game-result">';
                if (winner === 'player1' || winner === 'player') {
                    html += '<div style="color: #28a745; font-size: 24px; font-weight: bold;">🎉 Вы выиграли игру!</div>';
                } else if (winner === 'player2' || winner === 'opponent') {
                    html += '<div style="color: #dc3545; font-size: 24px; font-weight: bold;">😞 Противник выиграл игру!</div>';
                } else {
                    html += '<div style="color: #ffc107; font-size: 24px; font-weight: bold;">🤝 Ничья в игре!</div>';
                }
                html += '<div style="margin-top: 10px;">Игра окончена. Первый, кто набрал 10 очков, побеждает!</div>';
                html += '</div>';
            }
        } else if (this.gameState.gamePhase === 'waiting') {
            // Показываем стол с картами
            html += '<div class="poker-table">';
            html += '<div class="table-title">Сравнение комбинаций</div>';

            // Карты игрока на столе
            html += '<div class="table-player-cards">';
            html += '<div class="player-label">Ваши карты:</div>';
            html += '<div class="table-cards-row">';
            if (playerHand && playerHand.length > 0) {
                playerHand.forEach((card, i) => {
                    const suitClass = this.getSuitClass(card.suit);
                    html += `<div class="card ${suitClass} on-table">`;
                    html += `<div class="card-value">${card.value}</div>`;
                    html += `<div class="card-suit">${card.suit}</div>`;
                    html += '</div>';
                });
            }
            html += '</div></div>';

            // Карты противника на столе
            html += '<div class="table-opponent-cards">';
            html += '<div class="opponent-label">Карты противника:</div>';
            html += '<div class="table-cards-row">';
            if (opponentHand && opponentHand.length > 0) {
                opponentHand.forEach((card, i) => {
                    const suitClass = this.getSuitClass(card.suit);
                    html += `<div class="card ${suitClass} on-table">`;
                    html += `<div class="card-value">${card.value}</div>`;
                    html += `<div class="card-suit">${card.suit}</div>`;
                    html += '</div>';
                });
            }
            html += '</div></div></div>';

            // Статус
            html += '<div class="poker-status">Определяем победителя...</div>';
        } else if (this.gameState.gamePhase === 'discard') {
            html += '<div class="poker-status">Выберите карты для обмена или проверьте комбинацию</div>';
        }
        html += '</div>';

        // Карты игрока
        if (this.gameState.gamePhase !== 'waiting') {
            html += '<div class="player-cards">';
            html += '<h4>Ваши карты:</h4>';
            html += '<div class="cards-hand player-hand">';
            if (playerHand && playerHand.length > 0) {
                playerHand.forEach((card, i) => {
                    const suitClass = this.getSuitClass(card.suit);
                    const selectedClass = card.selected ? ' selected' : '';
                    html += `<div class="card ${suitClass}${selectedClass}" data-index="${i}" onclick="window.gameManager.getCurrentGame().handleCardClick(${i})">`;
                    html += `<div class="card-value">${card.value}</div>`;
                    html += `<div class="card-suit">${card.suit}</div>`;
                    html += '</div>';
                });
            }
            html += '</div></div>';
        }

        // Кнопки управления
        html += '<div class="poker-controls">';
        console.log('PokerGame.render(): gamePhase =', this.gameState.gamePhase);
        if (this.gameState.gamePhase === 'finished') {
            console.log('PokerGame.render(): adding new game button');
            html += '<button onclick="console.log(\'Button clicked\'); startNewPokerGame()" class="action-btn">🎮 Новая игра</button>';
        } else if (this.gameState.gamePhase === 'discard') {
            html += '<button onclick="window.gameManager.getCurrentGame().exchangeCards()" class="action-btn">Обменять выбранные</button>';
            html += '<button onclick="window.gameManager.getCurrentGame().checkHand()" class="action-btn">Проверить комбинацию</button>';
            html += '<button onclick="window.gameManager.getCurrentGame().nextRound()" class="action-btn">Новый раунд</button>';
        } else if (this.gameState.gamePhase === 'waiting') {
            html += '<button disabled class="action-btn" style="opacity: 0.5;">Подготовка...</button>';
        }
        html += '<button onclick="window.gameManager.closeCurrentGame()" class="back-btn">Назад к меню</button>';
        html += '</div>';

        html += '</div>';

        console.log('PokerGame.render(): setting innerHTML, html length:', html.length);
        this.container.innerHTML = html;
        this.container.style.display = 'block'; // Показываем контейнер
        console.log('PokerGame.render(): container displayed');
    }

    // Обработка клика по карте
    handleCardClick(index) {
        if (this.gameState.gamePhase !== 'discard') return;

        let playerHand;
        if (this.isNetworkGame && this.playerRole) {
            playerHand = this.playerRole === 'player1' ? this.gameState.player1Hand : this.gameState.player2Hand;
        } else {
            playerHand = this.gameState.playerHand;
        }

        const card = playerHand[index];
        if (card) {
            card.selected = !card.selected;
            this.render();
        }
    }

    // Обмен карт
    exchangeCards() {
        let playerHand;
        if (this.isNetworkGame && this.playerRole) {
            playerHand = this.playerRole === 'player1' ? this.gameState.player1Hand : this.gameState.player2Hand;
        } else {
            playerHand = this.gameState.playerHand;
        }

        const selectedCards = playerHand.filter(card => card.selected);

        if (selectedCards.length === 0) {
            this.showNotification('Выберите карты для обмена', 'warning');
            return;
        }

        if (this.isNetworkGame) {
            // Для сетевых игр отправляем каждую выбранную карту отдельно
            selectedCards.forEach(card => {
                this.sendMove({
                    action: 'discard',
                    card: card,
                    playerId: this.socket.id
                });
            });
            this.showNotification('Карты отправлены на обмен...', 'info');
            // Снимаем выделение локально
            playerHand.forEach(card => card.selected = false);
            this.render();
            return;
        }

        selectedCards.forEach(card => {
            const index = playerHand.indexOf(card);
            if (index !== -1 && this.deck.length > 0) {
                playerHand[index] = this.deck.pop();
            }
            card.selected = false;
        });

        this.showNotification('Карты обменяны! Теперь проверьте комбинацию.', 'success');
        this.render();
    }

    // Проверка комбинации
    checkHand() {
        if (this.isNetworkGame) {
            this.sendMove({ action: 'finish', playerId: this.socket.id });
            this.showNotification('Проверяем комбинации...', 'info');
            return;
        }

        const playerCombination = this.getPokerCombination(this.gameState.playerHand);

        // Бот тоже может обменять карты
        if (this.currentOpponent?.type === 'bot') {
            this.makeBotExchange();
        }

        const opponentCombination = this.getPokerCombination(this.gameState.opponentHand);

        // Определяем победителя
        let result = '';
        if (playerCombination.rank > opponentCombination.rank) {
            result = 'Вы выиграли раунд!';
            this.gameState.playerScore++;
        } else if (playerCombination.rank < opponentCombination.rank) {
            result = 'Противник выиграл раунд!';
            this.gameState.opponentScore++;
        } else {
            result = 'Ничья в раунде!';
        }

        // Проверяем окончание игры
        if (this.gameState.playerScore >= this.maxRounds) {
            this.gameState.gamePhase = 'finished';
            this.gameState.winner = 'player';
            this.endGame('player');
        } else if (this.gameState.opponentScore >= this.maxRounds) {
            this.gameState.gamePhase = 'finished';
            this.gameState.winner = 'opponent';
            this.endGame('opponent');
        } else {
            this.gameState.gamePhase = 'waiting';
        }

        this.gameState.lastResult = {
            playerCombination,
            opponentCombination,
            result
        };

        // Показываем результат через 2 секунды
        this.render();
        if (!this.isNetworkGame) {
            setTimeout(() => {
                this.nextRound();
            }, 2000);
        }
    }

    // Получение покерной комбинации
    getPokerCombination(hand) {
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

    // Обмен карт бота
    makeBotExchange() {
        if (this.currentOpponent?.type !== 'bot') return;

        const hand = this.gameState.opponentHand;
        const combination = this.getPokerCombination(hand);

        // Если у бота хорошая комбинация, не меняем
        if (combination.rank >= 2) return;

        // Меняем 1-3 карты
        const cardsToChange = Math.floor(Math.random() * 3) + 1;
        const changedIndices = [];

        for (let i = 0; i < cardsToChange; i++) {
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * hand.length);
            } while (changedIndices.includes(randomIndex));

            changedIndices.push(randomIndex);

            if (this.deck.length > 0) {
                this.gameState.opponentHand[randomIndex] = this.deck.pop();
            }
        }
    }

    // Показ результата
    showResult() {
        if (!this.gameState.lastResult) return;

        const { playerCombination, opponentCombination, result } = this.gameState.lastResult;

        // Определяем результат для текущего игрока
        let playerResult;
        if (this.isNetworkGame && this.playerRole) {
            if (this.gameState.winner === 'draw') {
                playerResult = 'НИЧЬЯ!';
            } else if (this.gameState.winner === this.playerRole) {
                playerResult = 'ПОБЕДА!';
            } else {
                playerResult = 'ПОРАЖЕНИЕ!';
            }
        } else {
            // Для локальной игры используем старый результат
            playerResult = result.includes('Вы выиграли') ? 'ПОБЕДА!' : 
                          result.includes('Противник выиграл') ? 'ПОРАЖЕНИЕ!' : 'НИЧЬЯ!';
        }

        const resultColor = playerResult === 'ПОБЕДА!' ? '#28a745' : 
                           playerResult === 'ПОРАЖЕНИЕ!' ? '#dc3545' : '#ffc107';

        let statusHtml = `
            <div style="margin-bottom: 10px;"><strong>Результат раунда ${this.gameState.round}:</strong></div>
            <div>Ваша комбинация: <span style="color: var(--accent-primary);">${playerCombination.name}</span></div>
            <div>Комбинация противника: <span style="color: var(--accent-primary);">${opponentCombination.name}</span></div>
            <div style="margin-top: 20px; font-size: 32px; font-weight: bold; color: ${resultColor};">${playerResult}</div>
            <div style="margin-top: 10px; color: #666;">Новый раунд через 3 секунды...</div>
        `;

        const statusElement = this.container.querySelector('.poker-status');
        if (statusElement) {
            statusElement.innerHTML = statusHtml;
        }

        // Автоматически переходим к следующему раунду
        setTimeout(() => {
            this.nextRound();
        }, 3000);
    }

    // Следующий раунд
    nextRound() {
        if (this.isNetworkGame) {
            // Для сетевых игр новая игра через сервер
            return;
        }

        this.gameState.round++;
        this.gameState.gamePhase = 'discard';

        // Создаем новую колоду и раздаем карты
        this.createDeck();
        this.shuffleDeck();
        this.dealCards();

        this.render();
        this.showNotification('🎮 Начата новая игра в покер!', 'info');
    }

    // Новая игра
    startNewGame() {
        console.log('PokerGame.startNewGame() called, isNetworkGame:', this.isNetworkGame);
        if (this.isNetworkGame) {
            console.log('PokerGame: Starting new network game');
            // Для сетевых игр отправляем запрос на новую игру
            this.sendMove({ action: 'new-game', playerId: this.socket.id });
            this.showNotification('Запрос на новую игру отправлен...', 'info');
            return;
        }

        // Локальная игра (с ботом)
        console.log('PokerGame: Starting new local game');
        this.gameState = {
            gameMode: 'poker',
            deck: [],
            playerHand: [],
            opponentHand: [],
            playerScore: 0,
            opponentScore: 0,
            currentPlayer: 'player',
            round: 1,
            gamePhase: 'discard',
            winner: null
        };

        this.createDeck();
        this.shuffleDeck();
        this.dealCards();
        this.render();
        this.showNotification('🎮 Начата новая игра в покер!', 'info');
    }

    // Показать состояние загрузки
    showLoadingState() {
        if (this.container) {
            this.container.innerHTML = `
                <div class="game-loading">
                    <h3>🃏 Покер</h3>
                    <div class="loading-spinner"></div>
                    <p>Загрузка игры...</p>
                    <p>Подключение к серверу...</p>
                </div>
            `;
            this.container.style.display = 'block';
        }
    }

    // Обработка сетевых ходов (добавлено для сетевых игр покера)
    handleNetworkMove(move) {
        // Если это не move object, а gameState update
        if (!move.action) {
            console.log(`PokerGame [${this.socket?.id}]: Received gameState update, gamePhase: ${move.gamePhase}`);
            this.playerRole = this.socket?.id === move.players?.[0] ? 'player1' : 'player2';
            const myHand = this.playerRole === 'player1' ? move.player1Hand : move.player2Hand;
            console.log(`PokerGame [${this.socket?.id}]: My role: ${this.playerRole}, my hand:`, myHand?.map(c => c.value + c.suit));
            this.gameState = move;
            this.render();
            return;
        }

        const { action, card, playerId } = move;
        const isCurrentPlayer = playerId === this.socket?.id;

        if (action === 'discard') {
            // Обработка обмена карт
            if (isCurrentPlayer) {
                // Текущий игрок обменял карту
                if (card) {
                    const index = this.gameState.player1Hand.findIndex(c =>
                        c.suit === card.suit && c.value === card.value
                    );
                    if (index !== -1) {
                        this.gameState.player1Hand.splice(index, 1);
                        if (this.gameState.deck.length > 0) {
                            this.gameState.player1Hand.push(this.gameState.deck.pop());
                        }
                    }
                }
            } else {
                // Противник обменял карту
                if (card) {
                    const index = this.gameState.player2Hand.findIndex(c =>
                        c.suit === card.suit && c.value === card.value
                    );
                    if (index !== -1) {
                        this.gameState.player2Hand.splice(index, 1);
                        if (this.gameState.deck.length > 0) {
                            this.gameState.player2Hand.push(this.gameState.deck.pop());
                        }
                    }
                }
            }
            this.showNotification(`${isCurrentPlayer ? 'Вы' : 'Противник'} обменяли карту`, 'info');
            this.render();

        } else if (action === 'finish') {
            // Завершение раунда - сравнение рук
            this.gameState.gamePhase = 'waiting';
            this.render();
            
            // Показываем таблицу на 2 секунды, затем результат
            setTimeout(() => {
                this.gameState.gamePhase = 'finished';
                // Определяем победителя (упрощенная логика)
                const hand1 = this.gameState.player1Hand;
                const hand2 = this.gameState.player2Hand;

                // Простая оценка: кто имеет старшую карту
                const getHandValue = (hand) => {
                    return Math.max(...hand.map(card => ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(card.value)));
                };

                const value1 = getHandValue(hand1);
                const value2 = getHandValue(hand2);

                if (value1 > value2) {
                    this.gameState.winner = 'player1';
                } else if (value2 > value1) {
                    this.gameState.winner = 'player2';
                } else {
                    this.gameState.winner = 'draw';
                }

                this.showNotification('Раунд завершен! Определяем победителя...', 'info');
                this.render();
            }, 2000);
        }
    }
}

// Экспорт класса для ES6 модулей
export { PokerGame };

// Экспорт класса в глобальную область
window.PokerGame = PokerGame;
