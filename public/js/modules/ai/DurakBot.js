// ===== DURAK BOT =====
// Модуль для ИИ бота в игре Дурак

// Экспорт для ES6 модулей
export { makeDurakBotDefense, makeDurakBotAttack, makeDurakBotThrow };

// Экспорт в глобальную область
window.makeDurakBotDefense = makeDurakBotDefense;
window.makeDurakBotAttack = makeDurakBotAttack;
window.makeDurakBotThrow = makeDurakBotThrow;

export class DurakBotAnalyzer {
    constructor() {
        this.trumpSuit = null;
    }

    // Анализ текущего состояния игры
    analyzeGameState() {
        this.trumpSuit = window.gameState.trumpSuit;

        return {
            tableCards: this.getTableCards(),
            undefendedCards: this.getUndefendedCards(),
            botHand: this.analyzeBotHand(),
            gamePhase: window.gameState.gamePhase,
            currentAttacker: window.gameState.currentAttacker,
            canThrow: this.canThrowCards(),
            trumpsOnTable: this.getTrumpsOnTable()
        };
    }

    // Получить все карты на столе
    getTableCards() {
        return [
            ...window.gameState.attackingCards,
            ...window.gameState.defendingCards
        ];
    }

    // Получить неотбитые карты
    getUndefendedCards() {
        return window.gameState.attackingCards.filter((_, index) =>
            !window.gameState.defendingCards[index]
        );
    }

    // Анализ карт бота
    analyzeBotHand() {
        const hand = window.gameState.opponentHand;

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

        const botHand = window.gameState.opponentHand;
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
        const botHand = window.gameState.opponentHand;
        const possibleDefenses = botHand.filter(card =>
            this.canDefendCard(card, attackCard)
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

    // Проверка, можно ли защититься картой
    canDefendCard(defendCard, attackCard) {
        // Можно бить картой той же масти, но большего достоинства
        if (defendCard.suit === attackCard.suit && defendCard.power > attackCard.power) {
            return true;
        }

        // Можно бить козырем, если атакующая карта не козырь
        if (defendCard.suit === this.trumpSuit && attackCard.suit !== this.trumpSuit) {
            return true;
        }

        // Козырь можно бить только более старшим козырем
        if (defendCard.suit === this.trumpSuit &&
            attackCard.suit === this.trumpSuit &&
            defendCard.power > attackCard.power) {
            return true;
        }

        return false;
    }

    // Найти карты для подкидывания
    getThrowableCards() {
        const tableCards = this.getTableCards();
        const botHand = window.gameState.opponentHand;

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

// ===== DURAK BOT FUNCTIONS =====

async function makeDurakBotDefense() {
    if (window.currentOpponent?.type !== 'bot') return;

    // Анализируем текущее состояние игры
    durakAnalyzer.analyzeGameState();

    console.log('Бот пытается защититься');
    console.log('Состояние стола:', {
        attackingCards: window.gameState.attackingCards,
        defendingCards: window.gameState.defendingCards,
        gamePhase: window.gameState.gamePhase,
        currentAttacker: window.gameState.currentAttacker
    });

    const undefendedCards = durakAnalyzer.getUndefendedCards();
    console.log('Неотбитые карты:', undefendedCards);

    if (undefendedCards.length === 0) {
        console.log('Все карты отбиты, переходим к подкидыванию');
        if (window.currentOpponent?.type === 'bot') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            makeDurakBotThrow();
        }
        return;
    }

    const cardToDefend = undefendedCards[0];
    console.log('Защищаемся от карты:', cardToDefend);

    const bestDefenseCard = durakAnalyzer.getBestDefenseCard(cardToDefend);
    console.log('Лучшая защитная карта:', bestDefenseCard);

    const riskScore = durakAnalyzer.evaluateRisk();
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
                console.log('Все карты отбиты, игрок может подкинуть');
            } else {
                // Еще есть неотбитые карты, продолжаем защиту
                console.log('Остались неотбитые карты, продолжаем защиту');
            }

            // Импорт рендерера для обновления UI
            import('./DurakGameRenderer.js').then(module => {
                module.DurakGameRenderer.renderGame();
            });
            return;
        }
    }

    // Если не может или не хочет защищаться, берет карты
    console.log(`Бот берет карты (риск: ${riskScore})`);
    takeDurakCardsBot();
}

async function makeDurakBotThrow() {
    if (window.currentOpponent?.type !== 'bot') return;

    // Анализируем текущее состояние игры
    durakAnalyzer.analyzeGameState();

    // Бот может подкидывать только если он НЕ защищается
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

    const throwableCards = durakAnalyzer.getThrowableCards();
    console.log('Карты для подкидывания:', throwableCards);

    if (throwableCards.length > 0) {
        const playerHandSize = window.gameState.playerHand.length;
        const botHandSize = window.gameState.opponentHand.length;

        // Подкидываем чаще если у игрока мало карт
        const throwProbability = playerHandSize <= 3 ? 0.9 :
            playerHandSize <= 5 ? 0.7 : 0.4;

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

                import('./DurakGameRenderer.js').then(module => {
                    module.DurakGameRenderer.renderGame();
                });
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

    import('./DurakGameRenderer.js').then(module => {
        module.DurakGameRenderer.renderGame();
    });
}

async function makeDurakBotAttack() {
    if (window.currentOpponent?.type !== 'bot') return;

    // Анализируем текущее состояние игры
    durakAnalyzer.analyzeGameState();

    const bestCard = durakAnalyzer.getBestAttackCard();

    if (bestCard) {
        const cardIndex = window.gameState.opponentHand.indexOf(bestCard);
        if (cardIndex !== -1) {
            window.gameState.attackingCards.push(bestCard);
            window.gameState.opponentHand.splice(cardIndex, 1);
            window.gameState.gamePhase = 'defend';
            window.gameState.currentAttacker = 'bot';

            console.log(`Бот атакует картой: ${bestCard.value}${bestCard.suit}`);

            import('./DurakGameRenderer.js').then(module => {
                module.DurakGameRenderer.renderGame();
            });
        }
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

    import('./DurakGameRenderer.js').then(module => {
        module.DurakGameRenderer.renderGame();
    });
}

// Создаем экземпляр анализатора после объявления класса
export const durakAnalyzer = new DurakBotAnalyzer();

// Экспортируем в глобальную область
window.durakAnalyzer = durakAnalyzer;
