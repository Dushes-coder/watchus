// ===== DURAK BOT ANALYZER =====

// Анализатор для ИИ бота в игре Дурак
class DurakBotAnalyzer {
    constructor() {
        this.trumpSuit = null;
        this.gameState = null;
    }

    // Анализ текущего состояния игры
    analyzeGameState(gameState) {
        this.trumpSuit = gameState.trumpSuit;
        this.gameState = gameState;

        return {
            tableCards: this.getTableCards(),
            undefendedCards: this.getUndefendedCards(),
            playerHandAnalysis: this.analyzeHand(gameState.playerHand),
            botHandAnalysis: this.analyzeBotHand(),
            riskScore: this.evaluateRisk()
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
        return this.gameState.attackingCards.filter((_, index) => !this.gameState.defendingCards[index]);
    }

    // Анализ руки игрока
    analyzeHand(hand) {
        const trumps = hand.filter(card => card.suit === this.trumpSuit);
        const nonTrumps = hand.filter(card => card.suit !== this.trumpSuit);

        return {
            cards: hand,
            trumps: trumps,
            nonTrumps: nonTrumps,
            cardsByValue: this.groupCardsByValue(hand)
        };
    }

    // Анализ руки бота
    analyzeBotHand() {
        const hand = this.gameState.opponentHand;
        const trumps = hand.filter(card => card.suit === this.trumpSuit);
        const nonTrumps = hand.filter(card => card.suit !== this.trumpSuit);

        return {
            cards: hand,
            trumps: trumps,
            nonTrumps: nonTrumps,
            cardsByValue: this.groupCardsByValue(hand)
        };
    }

    // Группировка карт по достоинству
    groupCardsByValue(cards) {
        const groups = {};
        cards.forEach(card => {
            if (!groups[card.value]) groups[card.value] = [];
            groups[card.value].push(card);
        });
        return groups;
    }

    // Проверка возможности подкидывания
    canThrowCards() {
        const tableCards = this.getTableCards();
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
        const possibleDefenses = botHand.filter(card => this.canDefend(card, attackCard));

        if (possibleDefenses.length === 0) return null;

        // Приоритет защиты:
        // 1. Некозырная карта той же масти (минимальная)
        // 2. Слабый козырь (если атака не козырем)
        // 3. Козырь для козыря (минимальный)

        const sameSuitDefenses = possibleDefenses.filter(card =>
            card.suit === attackCard.suit && card.suit !== this.trumpSuit
        );

        if (sameSuitDefenses.length > 0) {
            return sameSuitDefenses.reduce((weakest, card) =>
                card.power < weakest.power ? card : weakest
            );
        }

        const trumpDefenses = possibleDefenses.filter(card => card.suit === this.trumpSuit);

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
