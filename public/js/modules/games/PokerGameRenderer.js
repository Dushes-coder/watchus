// ===== POKER GAME RENDERER =====
// Модуль для рендеринга интерфейса покера

import { CardGame } from './CardGame.js';

export class PokerGameRenderer {
    static renderGame() {
        console.log('renderPokerGame called');

        // Показываем панель активной игры
        const activeGamePanel = document.getElementById('activeGamePanel');
        if (activeGamePanel) {
            activeGamePanel.classList.remove('hidden');
            activeGamePanel.style.display = 'block';
            document.getElementById('activeGameTitle').textContent = 'Покер';
            document.getElementById('activeGameIcon').textContent = '🃏';
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

        html += '<h3>🃏 Покер</h3>';
        html += '<div class="game-info">';
        html += '<div>Раунд: <strong>' + window.gameState.round + '</strong></div>';
        html += '<div>Ваш счёт: ' + window.gameState.playerScore + '</div>';
        html += '<div>Счёт противника: ' + window.gameState.opponentScore + '</div>';
        html += '</div>';

        // Карты противника (вверху)
        html += this.renderOpponentCards();

        // Центральная область
        html += this.renderPokerCenter();

        // Ваши карты (внизу)
        html += this.renderPlayerCards();

        // Кнопки управления
        html += this.renderPokerControls();

        html += '</div>';
        gamePanel.innerHTML = html;

        // Добавляем обработчики
        this.addPokerCardHandlers();
    }

    static renderOpponentCards() {
        let html = '<div class="opponent-cards">';
        html += '<h4>Карты противника:</h4>';
        html += '<div class="cards-hand opponent-hand">';

        for (let i = 0; i < window.gameState.opponentHand.length; i++) {
            if (window.gameState.gamePhase === 'waiting' || window.gameState.gamePhase === 'finished') {
                const card = window.gameState.opponentHand[i];
                const suitClass = CardGame.getSuitClass(card.suit);
                html += '<div class="card ' + suitClass + ' revealed" data-index="' + i + '">';
                html += '<div class="card-value">' + card.value + '</div>';
                html += '<div class="card-suit">' + card.suit + '</div>';
                html += '</div>';
            } else {
                html += '<div class="card card-back">🂠</div>';
            }
        }
        html += '</div>';
        html += '</div>';
        return html;
    }

    static renderPokerCenter() {
        let html = '<div class="poker-center">';

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
            html += this.renderPokerTable();
            html += '<div class="poker-status">Определяем победителя...</div>';
        } else if (window.gameState.gamePhase === 'exchange') {
            html += '<div class="poker-status">Выберите карты для обмена или проверьте комбинацию</div>';
        }

        html += '</div>';
        return html;
    }

    static renderPokerTable() {
        let html = '<div class="poker-table">';
        html += '<div class="table-title">Сравнение комбинаций</div>';

        // Карты игрока на столе
        html += '<div class="table-player-cards">';
        html += '<div class="player-label">Ваши карты:</div>';
        html += '<div class="table-cards-row">';
        for (let i = 0; i < window.gameState.playerHand.length; i++) {
            const card = window.gameState.playerHand[i];
            const suitClass = CardGame.getSuitClass(card.suit);
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
            const suitClass = CardGame.getSuitClass(card.suit);
            html += '<div class="card ' + suitClass + ' on-table" data-index="' + i + '">';
            html += '<div class="card-value">' + card.value + '</div>';
            html += '<div class="card-suit">' + card.suit + '</div>';
            html += '</div>';
        }
        html += '</div>';
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
            const suitClass = CardGame.getSuitClass(card.suit);
            const isSelected = card.selected ? ' selected' : '';
            html += '<div class="card ' + suitClass + isSelected + '" data-index="' + i + '">';
            html += '<div class="card-value">' + card.value + '</div>';
            html += '<div class="card-suit">' + card.suit + '</div>';
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
        return html;
    }

    static renderPokerControls() {
        let html = '<div class="poker-controls">';

        if (window.gameState.gamePhase === 'finished') {
            html += '<button onclick="startNewPokerGame()" class="action-btn">🎮 Новая игра</button>';
        } else if (window.gameState.gamePhase === 'exchange') {
            html += '<button onclick="exchangeCards()" class="action-btn">Обменять выбранные</button>';
            html += '<button onclick="checkPokerHand()" class="action-btn">Проверить комбинацию</button>';
            html += '<button onclick="newPokerRound()" class="action-btn">Новый раунд</button>';
        } else if (window.gameState.gamePhase === 'waiting') {
            html += '<button disabled class="action-btn" style="opacity: 0.5;">Подготовка...</button>';
        }

        html += '<button onclick="backToMenu()" class="back-btn">Назад к меню</button>';
        html += '</div>';
        return html;
    }

    static addPokerCardHandlers() {
        const cards = document.querySelectorAll('.player-cards .card');
        cards.forEach(card => {
            card.addEventListener('click', function () {
                cards.forEach(c => c.classList.remove('selected'));
                this.classList.toggle('selected');
            });
        });
    }

    static showResult() {
        if (!window.gameState.lastResult) return;

        const { combination, opponentCombination, result } = window.gameState.lastResult;
        const statusElement = document.querySelector('.poker-status');

        if (statusElement) {
            if (window.gameState.gamePhase === 'finished') {
                statusElement.innerHTML = `
                    <div style="margin-bottom: 10px;"><strong>Результат раунда ${window.gameState.round}:</strong></div>
                    <div>Ваша комбинация: <span style="color: var(--accent-primary);">${combination.name}</span></div>
                    <div>Комбинация противника: <span style="color: var(--accent-primary);">${opponentCombination.name}</span></div>
                    <div style="margin-top: 20px; font-size: 32px; font-weight: bold; color: ${result.includes('Вы выиграли') ? '#28a745' : result.includes('Противник выиграл') ? '#dc3545' : '#ffc107'};">${result.includes('Вы выиграли') ? 'ПОБЕДА!' : result.includes('Противник выиграл') ? 'ПОРАЖЕНИЕ!' : 'НИЧЬЯ!'}</div>
                    <div style="margin-top: 10px; color: #666;">Новый раунд через 3 секунды...</div>
                `;

                setTimeout(() => {
                    newPokerRound();
                }, 3000);
            } else {
                statusElement.innerHTML = `
                    <div style="margin-bottom: 10px;"><strong>Результат раунда ${window.gameState.round}:</strong></div>
                    <div>Ваша комбинация: <span style="color: var(--accent-primary);">${combination.name}</span></div>
                    <div>Комбинация противника: <span style="color: var(--accent-primary);">${opponentCombination.name}</span></div>
                    <div style="margin-top: 20px; font-size: 32px; font-weight: bold; color: ${result.includes('Вы выиграли') ? '#28a745' : result.includes('Противник выиграл') ? '#dc3545' : '#ffc107'};">${result.includes('Вы выиграли') ? 'ПОБЕДА!' : result.includes('Противник выиграл') ? 'ПОРАЖЕНИЕ!' : 'НИЧЬЯ!'}</div>
                    <div style="margin-top: 10px; color: #666;">Новый раунд через 3 секунды...</div>
                `;

                setTimeout(() => {
                    newPokerRound();
                }, 3000);
            }
        }
    }
}

// Экспорт класса в глобальную область
window.PokerGameRenderer = PokerGameRenderer;
