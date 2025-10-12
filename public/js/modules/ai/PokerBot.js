// ===== POKER BOT =====
// Модуль для ИИ бота в игре Покер

export class PokerBot {
    static makeMove() {
        if (window.currentOpponent?.type !== 'bot') return;

        // Простая логика бота для покера: обменивает слабые карты
        const hand = window.gameState.opponentHand;
        const combination = this.getPokerCombination(hand);

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

    static getPokerCombination(hand) {
        const values = hand.map(card => card.power).sort((a, b) => a - b);
        const suits = hand.map(card => card.suit);

        // Проверяем комбинации
        const isFlush = suits.every(suit => suit === suits[0]);
        const isStraight = values.every((val, i) => i === 0 || val === values[i - 1] + 1);

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
}

// Экспорт класса в глобальную область
window.PokerBot = PokerBot;
