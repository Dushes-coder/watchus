// ===== GAME UI =====
// Модуль для пользовательского интерфейса игр

console.log('🎨 GameUI module loaded');

export class GameUI {
    static showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    static showOpponentSelector(gameType) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay opponent-selector';
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';

        let gameIcon = '';
        let gameName = '';
        switch (gameType) {
            case 'chess': gameIcon = '♟️'; gameName = 'Шахматы'; break;
            case 'tictactoe': gameIcon = '⭕'; gameName = 'Крестики-нолики'; break;
            case 'poker': gameIcon = '🃏'; gameName = 'Покер'; break;
            case 'durak': gameIcon = '🎴'; gameName = 'Дурак'; break;
            case 'cards': gameIcon = '🃏'; gameName = 'Карты'; break;
        }

        let html = '<div class="modal-content opponent-modal">';
        html += '<div class="modal-header">';
        html += '<h3>' + gameIcon + ' Выберите соперника для ' + gameName + '</h3>';
        html += '<button class="secondary icon-btn" onclick="GameUI.closeOpponentSelector()">✕</button>';
        html += '</div>';

        html += '<div class="opponent-sections">';

        // Секция с ботами
        html += '<div class="opponent-section">';
        html += '<h4>🤖 Игра с ботом</h4>';
        html += '<div class="bot-options">';

        const botLevels = [
            { level: 'easy', name: 'Легкий', emoji: '🐣', description: 'Для начинающих' },
            { level: 'medium', name: 'Средний', emoji: '😐', description: 'Нормальная игра' },
            { level: 'hard', name: 'Сложный', emoji: '💪', description: 'Для опытных' }
        ];

        botLevels.forEach(bot => {
            html += '<div class="opponent-option bot-option" onclick="GameUI.selectBotLevel(\'' + gameType + '\', \'' + bot.level + '\')">';
            html += '<div class="opponent-avatar">' + bot.emoji + '</div>';
            html += '<div class="opponent-info">';
            html += '<div class="opponent-name">' + bot.name + ' бот</div>';
            html += '<div class="opponent-status">' + bot.description + '</div>';
            html += '</div>';
            html += '</div>';
        });

        html += '</div>';
        html += '</div>';

        // Секция с игроками в комнате
        html += '<div class="opponent-section">';
        html += '<h4>👥 Игроки в комнате</h4>';
        html += '<div class="opponent-list">';

        const otherPlayers = window.roomPlayers ? window.roomPlayers.filter(p => p.id !== (window.socket?.id || 'self')) : [];

        if (otherPlayers.length > 0) {
            otherPlayers.forEach(player => {
                const isInGame = false; // TODO: проверить, находится ли игрок в игре
                html += '<div class="opponent-option player-option ' + (isInGame ? 'busy' : 'available') + '" onclick="GameUI.invitePlayer(\'' + player.id + '\', \'' + gameType + '\')">';
                html += '<div class="opponent-avatar">' + (player.emoji || '👤') + '</div>';
                html += '<div class="opponent-info">';
                html += '<div class="opponent-name">' + (player.name || 'Игрок') + '</div>';
                html += '<div class="opponent-status">' + (isInGame ? 'В игре' : 'Готов к игре') + '</div>';
                html += '</div>';
                html += '<div class="opponent-status-indicator ' + (isInGame ? 'busy' : 'online') + '"></div>';
                html += '</div>';
            });
        } else {
            html += '<div class="no-players">';
            html += '<div class="no-players-icon">👤❓</div>';
            html += '<div class="no-players-text">В комнате нет других игроков</div>';
            html += '<div class="no-players-subtext">Пригласите друзей или играйте с ботом!</div>';
            html += '</div>';
        }

        html += '</div>';
        html += '</div>';

        html += '</div>';
        html += '</div>';

        modal.innerHTML = html;
        document.body.appendChild(modal);

        // Анимация появления
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.querySelector('.modal-content').style.transform = 'scale(1)';
        }, 10);
    }

    static closeOpponentSelector() {
        const modal = document.querySelector('.opponent-selector');
        if (modal) {
            modal.style.opacity = '0';
            modal.querySelector('.modal-content').style.transform = 'scale(0.8)';
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    }

    static selectBot(gameType) {
        // По умолчанию выбираем среднего бота для обратной совместимости
        this.selectBotLevel(gameType, 'medium');
    }

    static selectBotLevel(gameType, level) {
        let botEmoji = '🤖';
        let botName = 'Бот';

        switch (level) {
            case 'easy':
                botEmoji = '🐣';
                botName = 'Легкий бот';
                break;
            case 'medium':
                botEmoji = '😐';
                botName = 'Средний бот';
                break;
            case 'hard':
                botEmoji = '💪';
                botName = 'Сложный бот';
                break;
        }

        window.currentOpponent = {
            type: 'bot',
            level: level,
            name: botName,
            emoji: botEmoji
        };

        this.closeOpponentSelector();
        this.startGameWithOpponent(gameType);
    }

    static invitePlayer(playerId, gameType) {
        if (window.socket && window.roomId) {
            window.socket.emit('send-game-invitation', {
                roomId: window.roomId,
                targetPlayerId: playerId,
                gameType: gameType,
                senderName: window.userEmoji || 'Игрок'
            });

            this.showNotification('Приглашение отправлено! Ожидание ответа...', 'info');
            this.closeOpponentSelector();
        }
    }

    static showGameInvitation(data) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay game-invitation';
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';

        let gameIcon = '';
        let gameName = '';
        switch (data.gameType) {
            case 'chess': gameIcon = '♟️'; gameName = 'Шахматы'; break;
            case 'tictactoe': gameIcon = '⭕'; gameName = 'Крестики-нолики'; break;
            case 'poker': gameIcon = '🃏'; gameName = 'Покер'; break;
            case 'durak': gameIcon = '🎴'; gameName = 'Дурак'; break;
            case 'cards': gameIcon = '🃏'; gameName = 'Карты'; break;
        }

        let html = '<div class="modal-content invitation-modal">';
        html += '<div class="modal-header">';
        html += '<h3>' + gameIcon + ' Приглашение в игру</h3>';
        html += '</div>';
        html += '<div class="invitation-content">';
        html += '<div class="invitation-message">';
        html += '<div class="inviter">' + (data.senderEmoji || '👤') + ' ' + (data.senderName || 'Игрок') + '</div>';
        html += '<div class="game-invite">приглашает вас сыграть в <strong>' + gameName + '</strong></div>';
        html += '</div>';
        html += '<div class="invitation-actions">';
        html += '<button class="action-btn accept-btn" onclick="GameUI.acceptInvitation(\'' + data.gameType + '\', \'' + data.senderId + '\', \'' + (data.senderName || 'Игрок').replace(/'/g, '\\\'') + '\', \'' + (data.senderEmoji || '👤') + '\')">✅ Принять</button>';
        html += '<button class="back-btn decline-btn" onclick="GameUI.declineInvitation(\'' + data.senderId + '\')">❌ Отклонить</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        modal.innerHTML = html;
        document.body.appendChild(modal);

        // Анимация появления
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.querySelector('.modal-content').style.transform = 'scale(1)';
        }, 10);

        // Автоматическое закрытие через 30 секунд
        setTimeout(() => {
            if (document.querySelector('.game-invitation')) {
                this.declineInvitation(data.senderId);
            }
        }, 30000);
    }

    static acceptInvitation(gameType, senderId, senderName, senderEmoji) {
        console.log('🎯 NEW ACCEPT INVITATION FUNCTION CALLED with args:', arguments.length, 'args:', Array.from(arguments));
        console.log('🎯 ACCEPTING invitation:', { gameType, senderId, senderName, senderEmoji });
        if (window.socket && window.roomId) {
            window.socket.emit('game-invitation-response', {
                roomId: window.roomId,
                senderId: senderId,
                accepted: true,
                gameType: gameType,
                responderName: window.userEmoji || 'Игрок',
                responderEmoji: window.userEmoji || '👤'
            });
            console.log('📤 Sent game-invitation-response');
        }

        // Используем информацию из приглашения вместо roomPlayers
        window.currentOpponent = {
            type: 'player',
            id: senderId,
            name: senderName || 'Игрок',
            emoji: senderEmoji || '👤'
        };
        console.log('🎯 Set currentOpponent:', window.currentOpponent);

        console.log('🎯 Closing invitation modal for accepter');
        this.closeInvitationModal();
        window.expectedGameType = gameType;
        this.showNotification('Ожидание начала игры...', 'info');

        console.log('🚀 Starting game for invitation accepter');
        setTimeout(() => {
            this.startGameWithOpponent(gameType);
        }, 500);
    }

    static declineInvitation(senderId) {
        console.log('❌ DECLINING invitation from:', senderId);
        if (window.socket && window.roomId) {
            window.socket.emit('game-invitation-response', {
                roomId: window.roomId,
                senderId: senderId,
                accepted: false
            });
            console.log('📤 Sent decline response');
        }
        console.log('🎯 Closing invitation modal for decliner');
        this.closeInvitationModal();
    }

    static closeInvitationModal() {
        console.log('🔍 Looking for invitation modal to close');
        const modal = document.querySelector('.game-invitation');
        console.log('Found modal element:', modal);
        if (modal) {
            console.log('Closing invitation modal');
            modal.style.opacity = '0';
            modal.querySelector('.modal-content').style.transform = 'scale(0.8)';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                    console.log('Invitation modal removed from DOM');
                }
            }, 300);
        } else {
            console.log('No invitation modal found to close');
        }
    }

    static handleInvitationResponse(data) {
        console.log('🎉 HANDLING invitation response:', data);
        if (data.accepted) {
            console.log('✅ Invitation ACCEPTED');
            const opponent = window.roomPlayers.find(p => p.id === data.responderId);
            window.currentOpponent = {
                type: 'player',
                id: data.responderId,
                name: opponent?.name || 'Игрок',
                emoji: opponent?.emoji || '👤'
            };

            console.log('🚀 Starting game for invitation sender');
            this.startGameWithOpponent(data.gameType);

            this.showNotification('Приглашение принято! Начинаем игру.', 'success');
        } else {
            console.log('❌ Invitation DECLINED');
            this.showNotification('Приглашение отклонено.', 'warning');
        }
    }

    static startGameWithOpponent(gameType) {
        // Сбрасываем флаг закрытия активной игры
        try { localStorage.removeItem('wt_active_game_closed'); } catch (e) { }

        // Закрываем все модальные окна
        this.closeOpponentSelector();
        this.closeInvitationModal();

        // Показываем панель игры
        const panel = document.getElementById('activeGamePanel');
        if (!panel) return;
        const icon = document.getElementById('activeGameIcon');
        const title = document.getElementById('activeGameTitle');
        if (icon && title) {
            if (gameType === 'chess') { icon.textContent = '♟️'; title.textContent = 'Шахматы'; }
            else if (gameType === 'tictactoe') { icon.textContent = '⭕'; title.textContent = 'Крестики-нолики'; }
            else if (gameType === 'cards' || gameType === 'poker' || gameType === 'durak') { icon.textContent = '🃏'; title.textContent = 'Карты'; }
        }
        panel.classList.remove('hidden');
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Запускаем игру
        switch (gameType) {
            case 'chess':
                if (window.initNetworkChess) window.initNetworkChess();
                break;
            case 'tictactoe':
                if (window.initNetworkTicTacToe) window.initNetworkTicTacToe();
                break;
            case 'poker':
                this.startPoker();
                break;
            case 'durak':
                this.startDurak();
                break;
            case 'cards':
                this.initCards();
                break;
        }
    }

    static updateOpponentSelector() {
        // Обновляем селектор соперника, если он открыт
        const selector = document.querySelector('.opponent-selector');
        if (selector) {
            // Перерисовываем список игроков
            const list = selector.querySelector('.opponent-list');
            if (list) {
                // Обновление списка игроков
            }
        }
    }

    // Методы для карточных игр
    static initCards() {
        console.log('initCards called');

        const container = document.getElementById('activeGameContent');
        if (!container) return;

        let html = '';

        // Информация о сопернике
        if (window.currentOpponent) {
            html += '<div class="game-opponent-info">';
            html += '<div class="opponent-avatar-small">' + window.currentOpponent.emoji + '</div>';
            html += '<div class="opponent-name-small">' + window.currentOpponent.name + '</div>';
            html += '<div class="opponent-type">' + (window.currentOpponent.type === 'bot' ? 'Бот' : 'Игрок') + '</div>';
            html += '</div>';
        }

        html += '<div class="cards-status">Игра в карты</div>';
        html += '<div class="cards-container">';
        html += '<div class="cards-player-hand" id="playerHand"></div>';
        html += '<div class="cards-opponent-hand" id="opponentHand"></div>';
        html += '<div class="cards-table" id="cardsTable"></div>';
        html += '</div>';
        html += '<div class="cards-controls">';
        html += '<button onclick="closeGame()" class="back-btn">Закрыть</button>';
        html += '</div>';

        container.innerHTML = html;
        container.style.display = 'block';
        console.log('HTML set to container');

        // Инициализируем игру в карты
        window.gameState = {
            gameType: 'cards',
            playerHand: [],
            opponentHand: [],
            deck: [],
            table: [],
            gameOver: false
        };

        // Создаем колоду
        const suits = ['♥️', '♦️', '♣️', '♠️'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

        for (let suit of suits) {
            for (let value of values) {
                window.gameState.deck.push({ suit, value });
            }
        }

        // Раздаем карты
        for (let i = 0; i < 5; i++) {
            window.gameState.playerHand.push(window.gameState.deck.pop());
            window.gameState.opponentHand.push(window.gameState.deck.pop());
        }

        this.renderCardsGame();
    }

    static renderCardsGame() {
        const playerHandElement = document.getElementById('playerHand');
        const opponentHandElement = document.getElementById('opponentHand');
        const tableElement = document.getElementById('cardsTable');

        if (playerHandElement && opponentHandElement && tableElement) {
            // Отрисовываем руку игрока
            let playerHandHtml = '';
            window.gameState.playerHand.forEach((card, index) => {
                playerHandHtml += `<div class="card" data-index="${index}">${card.value}${card.suit}</div>`;
            });
            playerHandElement.innerHTML = playerHandHtml;

            // Отрисовываем руку противника
            let opponentHandHtml = '';
            window.gameState.opponentHand.forEach((card, index) => {
                opponentHandHtml += `<div class="card" data-index="${index}">${card.value}${card.suit}</div>`;
            });
            opponentHandElement.innerHTML = opponentHandHtml;

            // Отрисовываем карты на столе
            let tableHtml = '';
            window.gameState.table.forEach((card, index) => {
                tableHtml += `<div class="card" data-index="${index}">${card.value}${card.suit}</div>`;
            });
            tableElement.innerHTML = tableHtml;
        }
    }

    // Методы для запуска игр
    static startPoker() {
        console.log('startPoker called');

        // Полностью очищаем состояние игры перед запуском покера
        window.gameState = {
            gameMode: 'poker',
            deck: [],
            playerHand: [],
            opponentHand: [],
            playerScore: window.gameState?.playerScore || 0,
            opponentScore: window.gameState?.opponentScore || 0,
            currentPlayer: 'player',
            round: window.gameState?.round || 1,
            gamePhase: 'exchange',
            winner: null
        };

        // Импортируем и используем CardGame
        import('./CardGame.js').then(module => {
            const CardGame = module.CardGame;
            window.gameState.deck = CardGame.createDeck();
            CardGame.shuffleDeck(window.gameState.deck);

            // Раздаем карты
            for (let i = 0; i < 5; i++) {
                window.gameState.playerHand.push(window.gameState.deck.pop());
                window.gameState.opponentHand.push(window.gameState.deck.pop());
            }

            // Импортируем рендерер и рендерим
            import('./PokerGameRenderer.js').then(renderer => {
                renderer.PokerGameRenderer.renderGame();
            });
        });

        // Обновляем заголовок активной панели игры
        const activeGamePanel = document.getElementById('activeGamePanel');
        if (activeGamePanel) {
            document.getElementById('activeGameTitle').textContent = 'Покер';
            document.getElementById('activeGameIcon').textContent = '🃏';
        }
    }

    static startDurak() {
        console.log('startDurak called');

        // Полностью очищаем состояние игры перед запуском дурака
        window.gameState = {
            gameMode: 'durak',
            deck: [],
            playerHand: [],
            opponentHand: [],
            attackingCards: [],
            defendingCards: [],
            trumpSuit: null,
            gamePhase: 'attack',
            currentAttacker: 'player'
        };

        console.log('Creating deck...');
        import('./CardGame.js').then(module => {
            const CardGame = module.CardGame;
            window.gameState.deck = CardGame.createDeck();
            CardGame.shuffleDeck(window.gameState.deck);
            window.gameState.trumpSuit = CardGame.setTrumpSuit(window.gameState.deck);

            console.log('Dealing durak cards...');
            this.dealDurakCards();

            console.log('Rendering durak game...');

            // Показываем панель активной игры
            const activeGamePanel = document.getElementById('activeGamePanel');
            if (activeGamePanel) {
                activeGamePanel.classList.remove('hidden');
                document.getElementById('activeGameTitle').textContent = 'Дурак';
                document.getElementById('activeGameIcon').textContent = '🎴';
            }

            import('./DurakGameRenderer.js').then(renderer => {
                renderer.DurakGameRenderer.renderGame();
            });
        });
    }

    static dealDurakCards() {
        console.log('dealDurakCards called');
        window.gameState.playerHand = [];
        window.gameState.opponentHand = [];

        console.log('Deck length before dealing:', window.gameState.deck.length);

        for (let i = 0; i < 6; i++) {
            if (window.gameState.deck.length > 0) {
                window.gameState.playerHand.push(window.gameState.deck.pop());
            }
            if (window.gameState.deck.length > 0) {
                window.gameState.opponentHand.push(window.gameState.deck.pop());
            }
        }

        // Определяем кто ходит первым
        this.determineFirstPlayer();

        console.log('Player hand:', window.gameState.playerHand);
        console.log('Opponent hand:', window.gameState.opponentHand);
        console.log('First attacker:', window.gameState.currentAttacker);
    }

    static determineFirstPlayer() {
        const trumpSuit = window.gameState.trumpSuit;

        // Находим козыри у игрока
        const playerTrumps = window.gameState.playerHand.filter(card => card.suit === trumpSuit);
        const opponentTrumps = window.gameState.opponentHand.filter(card => card.suit === trumpSuit);

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
                window.gameState.currentAttacker = 'player';
                window.gameState.gamePhase = 'attack';
            } else {
                window.gameState.currentAttacker = 'bot';
                window.gameState.gamePhase = 'defend';
                // Бот атакует первым
                if (window.currentOpponent?.type === 'bot') {
                    setTimeout(() => {
                        import('./DurakBot.js').then(bot => bot.makeDurakBotAttack());
                    }, 1000);
                }
            }
        } else if (playerLowestTrump) {
            window.gameState.currentAttacker = 'player';
            window.gameState.gamePhase = 'attack';
        } else if (opponentLowestTrump) {
            window.gameState.currentAttacker = 'bot';
            window.gameState.gamePhase = 'defend';
            // Бот атакует первым
            if (window.currentOpponent?.type === 'bot') {
                setTimeout(() => {
                    import('./DurakBot.js').then(bot => bot.makeDurakBotAttack());
                }, 1000);
            }
        } else {
            // Ни у кого нет козырей - игрок ходит первым
            window.gameState.currentAttacker = 'player';
            window.gameState.gamePhase = 'attack';
        }
    }
}

// Экспорт в глобальную область для совместимости
window.GameUI = GameUI;
