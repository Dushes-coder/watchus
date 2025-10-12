// ===== DURAK GAME RENDERER =====
// Модуль для рендеринга интерфейса дурака

import { CardGame } from './CardGame.js';

export class DurakGameRenderer {
    static renderGame() {
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
        console.log('Атакующие карты:', window.gameState.attackingCards);
        console.log('Защищающие карты:', window.gameState.defendingCards);

        let html = '<div class="cards-menu">';

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
        html += '<div>Козырь: <span class="trump-suit ' + (window.gameState.trumpSuit ? CardGame.getSuitClass(window.gameState.trumpSuit) : '') + '">' + (window.gameState.trumpSuit || '?') + '</span></div>';
        html += '<div>Карт в колоде: ' + (window.gameState.deck ? window.gameState.deck.length : 0) + '</div>';

        const currentPhase = window.gameState.gamePhase === 'attack' ? 'Атака' : 'Защита';
        const currentAttacker = window.gameState.currentAttacker === 'player' ? 'Вы' : 'Противник';
        html += '<div>Фаза: ' + currentPhase + ' (' + currentAttacker + ')</div>';
        html += '</div>';

        // Карты противника (вверху)
        html += this.renderOpponentCards();

        // Ваши карты (внизу)
        html += this.renderPlayerCards();

        // Стол (посередине)
        html += this.renderTable();

        // Кнопки управления
        html += this.renderControls();

        html += '</div>';

        try {
            gamePanel.innerHTML = html;
            console.log('Durak HTML set successfully');
        } catch (e) {
            console.error('Error setting durak HTML:', e);
        }
    }

    static renderOpponentCards() {
        let html = '<div class="opponent-cards">';
        html += '<h4>Карты противника (' + window.gameState.opponentHand.length + '):</h4>';
        html += '<div class="cards-hand opponent-hand">';
        for (let i = 0; i < window.gameState.opponentHand.length; i++) {
            html += '<div class="card card-back">🂠</div>';
        }
        html += '</div>';
        html += '</div>';
        return html;
    }

    static renderPlayerCards() {
        let html = '<div class="player-cards">';
        html += '<h4>Ваши карты:</h4>';
        html += '<div class="cards-hand player-hand">';

        for (let i = 0; i < window.gameState.playerHand.length; i++) {
            const card = window.gameState.playerHand[i];
            if (card && card.suit && card.value) {
                const suitClass = CardGame.getSuitClass(card.suit);

                // Проверяем, можно ли играть этой картой
                let canPlay = this.canPlayCard(card, i);

                const playableClass = canPlay ? ' playable' : '';
                html += '<div class="card ' + suitClass + playableClass + '" data-index="' + i + '" onclick="playDurakCard(' + i + ')">';
                html += '<div class="card-value">' + card.value + '</div>';
                html += '<div class="card-suit">' + card.suit + '</div>';
                html += '</div>';
            }
        }
        html += '</div>';
        html += '</div>';
        return html;
    }

    static canPlayCard(card, index) {
        try {
            if (window.gameState.gamePhase === 'attack' && window.gameState.currentAttacker === 'player') {
                // Игрок атакует
                if (window.gameState.attackingCards.length === 0) {
                    return true; // Первая атака - любой картой
                } else {
                    return CardGame.canAttackOrThrowCard(card, [...window.gameState.attackingCards, ...window.gameState.defendingCards]);
                }
            } else if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'player') {
                // Игрок атаковал, бот защищается, игрок может подкинуть
                const allDefended = window.gameState.attackingCards.every((_, index) => window.gameState.defendingCards[index]);
                if (allDefended) {
                    return CardGame.canAttackOrThrowCard(card, [...window.gameState.attackingCards, ...window.gameState.defendingCards]);
                }
            } else if (window.gameState.gamePhase === 'defend' && window.gameState.currentAttacker === 'bot') {
                // Игрок защищается от бота
                const undefendedCards = window.gameState.attackingCards.filter((_, index) => !window.gameState.defendingCards[index]);
                return undefendedCards.some(attackCard => CardGame.canDefendCard(card, attackCard, window.gameState.trumpSuit));
            } else if (window.gameState.gamePhase === 'attack' && window.gameState.currentAttacker === 'bot') {
                // Бот атаковал, но еще не все карты отбиты - игрок может подкинуть
                const allDefended = window.gameState.attackingCards.every((_, index) => window.gameState.defendingCards[index]);
                if (allDefended) {
                    return CardGame.canAttackOrThrowCard(card, [...window.gameState.attackingCards, ...window.gameState.defendingCards]);
                }
            }
        } catch (e) {
            console.error('Error checking if card can be played:', e);
            return true; // По умолчанию разрешаем играть картой
        }
        return false;
    }

    static renderTable() {
        let html = '<div class="durak-table">';
        html += '<h4>Стол:</h4>';
        html += '<div class="table-cards">';

        for (let i = 0; i < window.gameState.attackingCards.length; i++) {
            const attackCard = window.gameState.attackingCards[i];
            const defendCard = window.gameState.defendingCards[i];

            html += '<div class="card-pair">';
            html += '<div class="card ' + CardGame.getSuitClass(attackCard.suit) + ' attacking">';
            html += '<div class="card-value">' + attackCard.value + '</div>';
            html += '<div class="card-suit">' + attackCard.suit + '</div>';
            html += '</div>';

            if (defendCard) {
                html += '<div class="card ' + CardGame.getSuitClass(defendCard.suit) + ' defending">';
                html += '<div class="card-value">' + defendCard.value + '</div>';
                html += '<div class="card-suit">' + defendCard.suit + '</div>';
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
        return html;
    }

    static renderControls() {
        let html = '<div class="durak-controls">';

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
        return html;
    }

    static renderCardsMenu() {
        console.log('renderCardsMenu called');

        // Показываем панель активной игры с правильным заголовком
        const activeGamePanel = document.getElementById('activeGamePanel');
        console.log('activeGamePanel found:', !!activeGamePanel);
        if (activeGamePanel) {
            activeGamePanel.classList.remove('hidden');
            activeGamePanel.style.display = 'block';
            document.getElementById('activeGameTitle').textContent = 'Карточные игры';
            document.getElementById('activeGameIcon').textContent = '🃏';
        }

        const gamePanel = document.getElementById('activeGameContent');
        console.log('gamePanel (activeGameContent) found:', !!gamePanel);
        if (!gamePanel) {
            console.error('activeGameContent not found!');
            return;
        }

        gamePanel.style.display = 'block'; // Убеждаемся, что содержимое видимо

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
        html += '<button class="game-mode-btn" onclick="selectPoker()">🃏 Покер</button>';
        html += '<button class="game-mode-btn" onclick="selectDurak()">🎴 Дурак</button>';
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
        console.log('HTML set to gamePanel');
    }
}

// Экспорт класса в глобальную область
window.DurakGameRenderer = DurakGameRenderer;
