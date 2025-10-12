// ===== CARD GAME UTILITIES =====
// Общие утилиты для карточных игр (Покер, Дурак и т.д.)

export class CardGame {
    static getCardPower(value) {
        const powers = { '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
        return powers[value] || 0;
    }

    static getSuitClass(suit) {
        switch (suit) {
            case '♥': return 'hearts';
            case '♦': return 'diamonds';
            case '♣': return 'clubs';
            case '♠': return 'spades';
            default: return '';
        }
    }

    static createDeck() {
        const deck = [];
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

        for (let suit of suits) {
            for (let value of values) {
                deck.push({
                    suit,
                    value,
                    power: CardGame.getCardPower(value)
                });
            }
        }

        return deck;
    }

    static shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    static setTrumpSuit(deck) {
        if (deck.length > 0) {
            return deck[deck.length - 1].suit;
        }
        return null;
    }

    static canDefendCard(defendCard, attackCard, trumpSuit) {
        // Можно бить картой той же масти, но большего достоинства
        if (defendCard.suit === attackCard.suit && defendCard.power > attackCard.power) {
            return true;
        }

        // Можно бить козырем, если атакующая карта не козырь
        if (defendCard.suit === trumpSuit && attackCard.suit !== trumpSuit) {
            return true;
        }

        // Козырь можно бить только более старшим козырем
        if (defendCard.suit === trumpSuit &&
            attackCard.suit === trumpSuit &&
            defendCard.power > attackCard.power) {
            return true;
        }

        return false;
    }

    static canAttackOrThrowCard(card, tableCards) {
        if (!tableCards || tableCards.length === 0) return true;

        // Можно атаковать картой того же достоинства, что уже есть на столе
        const tableValues = tableCards.map(c => c.value);
        return tableValues.includes(card.value);
    }

    // Утилита для имитации задержки (для ботов)
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
