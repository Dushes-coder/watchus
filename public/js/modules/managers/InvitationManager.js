// ===== INVITATION MANAGER =====

// Менеджер приглашений - управляет приглашениями игроков
class InvitationManager {
    constructor() {
        this.socket = window.socket;
        this.roomId = window.roomId;
        this.pendingInvitations = new Map(); // invitationId -> invitationData
        this.sentInvitations = new Map(); // targetPlayerId -> invitationData
        this.eventHandlers = {};
        this.setupSocketListeners();
    }

    // Настройка обработчиков сокетов
    setupSocketListeners() {
        if (!this.socket) return;

        // Обработчик получения приглашения
        this.on('game-invitation', (data) => {
            console.log('📨 Received game invitation:', data);
            this.handleIncomingInvitation(data);
        });

        // Обработчик ответа на приглашение
        this.on('game-invitation-response', (data) => {
            console.log('📬 Received invitation response:', data);
            this.handleInvitationResponse(data);
        });

        // Обработчик начала игры
        this.on('game-started', (data) => {
            console.log('🎮 Game started:', data);
            this.handleGameStarted(data);
        });

        // Обработчик закрытия игры
        this.on('game-closed', () => {
            console.log('🎯 Game closed');
            this.handleGameClosed();
        });
    }

    // Регистрация обработчика событий
    on(event, handler) {
        if (this.socket) {
            this.socket.on(event, handler);
            this.eventHandlers[event] = handler;
        }
    }

    // Отправка события
    emit(event, data) {
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }

    // Отправка приглашения игроку
    sendInvitation(targetPlayerId, gameType, senderName, senderEmoji) {
        if (!this.socket || !this.roomId) {
            console.error('Socket or roomId not available');
            return false;
        }

        const invitationData = {
            roomId: this.roomId,
            targetPlayerId: targetPlayerId,
            gameType: gameType,
            senderName: senderName,
            senderEmoji: senderEmoji,
            timestamp: Date.now()
        };

        // Отправляем приглашение на сервер
        this.emit('send-game-invitation', invitationData);

        // Сохраняем отправленное приглашение
        this.sentInvitations.set(targetPlayerId, invitationData);

        console.log('📤 Sent invitation:', invitationData);
        return true;
    }

    // Обработка входящего приглашения
    handleIncomingInvitation(data) {
        const invitationId = `${data.senderId}-${data.gameType}-${Date.now()}`;

        const invitationData = {
            id: invitationId,
            senderId: data.senderId,
            senderName: data.senderName,
            senderEmoji: data.senderEmoji,
            gameType: data.gameType,
            roomId: data.roomId,
            timestamp: data.timestamp || Date.now()
        };

        // Сохраняем в ожидающих приглашениях
        this.pendingInvitations.set(invitationId, invitationData);

        // Показываем модальное окно приглашения
        this.showInvitationModal(invitationData);

        // Автоматическое отклонение через 30 секунд
        setTimeout(() => {
            if (this.pendingInvitations.has(invitationId)) {
                this.declineInvitation(invitationId);
            }
        }, 30000);
    }

    // Показ приглашения пользователю
    showInvitationModal(data) {
        // Проверяем, есть ли уже открытое приглашение
        const existingModal = document.querySelector('.game-invitation');
        if (existingModal) {
            console.log('Invitation modal already exists, skipping creation');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay game-invitation';
        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';

        let gameIcon = '';
        let gameName = '';
        switch(data.gameType) {
            case 'chess': gameIcon = '♟️'; gameName = 'Шахматы'; break;
            case 'tictactoe': gameIcon = '⭕'; gameName = 'Крестики-нолики'; break;
            case 'poker': gameIcon = '🃏'; gameName = 'Покер'; break;
            case 'durak': gameIcon = '🎴'; gameName = 'Дурак'; break;
            default: gameIcon = '🎮'; gameName = 'Игра'; break;
        }

        let html = `
            <div class="modal-content invitation-modal">
                <div class="modal-header">
                    <h3>${gameIcon} Приглашение в игру</h3>
                </div>
                <div class="invitation-content">
                    <div class="invitation-message">
                        <div class="inviter">${data.senderEmoji || '👤'} ${data.senderName || 'Игрок'}</div>
                        <div class="game-invite">приглашает вас сыграть в <strong>${gameName}</strong></div>
                    </div>
        `;
        console.log('Generating invitation modal HTML, invitationManager available:', !!window.invitationManager);
        html += '<div class="invitation-actions">';
        html += '<button class="action-btn accept-btn" onclick="window.invitationManager.acceptInvitation(\'' + data.id + '\'); event.preventDefault(); event.stopPropagation(); return false;">✅ Принять</button>';
        html += '<button class="back-btn decline-btn" onclick="window.invitationManager.declineInvitation(\'' + data.id + '\'); event.preventDefault(); event.stopPropagation(); return false;">❌ Отклонить</button>';
        html += '</div>';
        html += `
                </div>
            </div>
        `;

        modal.innerHTML = html;

        document.body.appendChild(modal);

        // Анимация появления
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.querySelector('.modal-content').style.transform = 'scale(1)';
        }, 10);
    }

    // Принятие приглашения
    acceptInvitation(invitationId) {
        const invitation = this.pendingInvitations.get(invitationId);
        if (!invitation) {
            console.error('Invitation not found:', invitationId);
            return;
        }

        console.log('🎯 ACCEPTING INVITATION in InvitationManager:', invitation);

        // Отправляем ответ на сервер
        this.emit('game-invitation-response', {
            roomId: invitation.roomId,
            senderId: invitation.senderId,
            accepted: true,
            gameType: invitation.gameType
        });

        console.log('📤 Sent game-invitation-response from InvitationManager');

        // Очищаем приглашение
        this.pendingInvitations.delete(invitationId);
        console.log('🧹 Cleared pending invitation, calling closeInvitationModal');
        this.closeInvitationModal();

        console.log('🎯 Set currentOpponent in InvitationManager');
        // Устанавливаем информацию об оппоненте
        window.currentOpponent = {
            type: 'player',
            id: invitation.senderId,
            name: invitation.senderName,
            emoji: invitation.senderEmoji
        };

        // Запускаем игру
        this.startAcceptedGame(invitation.gameType);

        showNotification('Приглашение принято! Начинаем игру.', 'success');
    }

    // Отклонение приглашения
    declineInvitation(invitationId) {
        const invitation = this.pendingInvitations.get(invitationId);
        if (!invitation) {
            console.error('Invitation not found:', invitationId);
            return;
        }

        console.log('❌ Declining invitation:', invitation);

        // Отправляем отказ на сервер
        this.emit('game-invitation-response', {
            roomId: invitation.roomId,
            senderId: invitation.senderId,
            accepted: false
        });

        // Очищаем приглашение
        this.pendingInvitations.delete(invitationId);
        this.closeInvitationModal();

        showNotification('Приглашение отклонено.', 'warning');
    }

    // Обработка ответа на отправленное приглашение
    handleInvitationResponse(data) {
        console.log('🎉 Handling invitation response:', data);

        if (data.accepted) {
            // Приглашение принято
            const invitation = this.sentInvitations.get(data.responderId);
            if (invitation) {
                // Устанавливаем информацию об оппоненте
                window.currentOpponent = {
                    type: 'player',
                    id: data.responderId,
                    name: data.responderName || 'Игрок',
                    emoji: data.responderEmoji || '👤'
                };

                // Запускаем игру
                this.startAcceptedGame(data.gameType);

                showNotification('Приглашение принято! Начинаем игру.', 'success');
                this.sentInvitations.delete(data.responderId);
            }
        } else {
            // Приглашение отклонено
            showNotification('Приглашение отклонено.', 'warning');
            this.sentInvitations.delete(data.responderId);
        }

        // Пытаемся закрыть модальное окно приглашения (на случай если оно открыто)
        if (window.GameUI && window.GameUI.closeInvitationModal) {
            console.log('Attempting to close invitation modal from InvitationManager');
            window.GameUI.closeInvitationModal();
        }
    }

    // Запуск игры после принятия приглашения
    startAcceptedGame(gameType) {
        console.log('🚀 Starting accepted game:', gameType);

        // Проверяем, не запущена ли уже игра (предотвращаем двойную инициализацию)
        if (window.gameManager?.isGameActive() && window.gameManager.currentGame?.gameType === gameType) {
            console.log('Game already started, skipping duplicate initialization in startAcceptedGame');
            return;
        }

        // Сбрасываем флаг закрытия игры
        try { localStorage.removeItem('wt_active_game_closed'); } catch (e) {}

        // Создаем и инициализируем игру через менеджер
        console.log('Starting game for invitation sender');
        const game = window.gameManager.startGame(gameType, window.currentOpponent);
        if (game) {
            // Устанавливаем сетевой режим
            game.isNetworkGame = true;
            console.log('Network game initialized for sender');
        } else {
            console.error('Failed to start game in startAcceptedGame');
        }
    }

    // Обработка начала игры
    handleGameStarted(data) {
        const { gameType, players, roomId } = data;
        console.log('🎮 Game started event received:', data);

        window.roomId = roomId;  // Устанавливаем roomId для сетевых игр

        // Сбрасываем флаг закрытия игры
        try { localStorage.removeItem('wt_active_game_closed'); } catch (e) {}

        // Если игра уже активна и того же типа, обновляем состояние
        if (window.gameManager.isGameActive() && window.gameManager.currentGame && window.gameManager.currentGame.gameType === gameType) {
            console.log('Game already active, updating state');
            if (window.gameManager.currentGame) {
                window.gameManager.currentGame.gameState.players = players;
                window.gameManager.currentGame.isNetworkGame = true;
                console.log('Updated players for active game:', players);
                window.gameManager.currentGame.setupPlayerSymbols();
                // Не вызываем render() здесь, так как gameState придет через handleNetworkMove
            }
            return;
        }

        // Создаем новую игру для получателя приглашения
        console.log('Creating new game for started event');
        const opponent = {
            type: 'player',
            id: players.find(p => p !== window.socket.id),
            name: `Игрок ${players.find(p => p !== window.socket.id).slice(0, 6)}`,
            emoji: '🎮'
        };
        
        const game = window.gameManager.startGame(gameType, opponent);
        if (game) {
            // Устанавливаем игроков для сетевой игры
            game.gameState.players = players;
            game.isNetworkGame = true;
            console.log('Network game initialized for receiver, players:', players);
            // Переинициализируем символы игроков
            game.setupPlayerSymbols();
            // render() будет вызван через handleNetworkMove
        } else {
            console.error('Failed to start game in handleGameStarted');
        }
    }

    // Закрытие модального окна приглашения
    closeInvitationModal() {
        console.log('🔍 InvitationManager: Looking for invitation modal to close');
        const modal = document.querySelector('.game-invitation');
        console.log('InvitationManager: Found modal element:', modal);
        if (modal) {
            console.log('InvitationManager: Closing invitation modal');
            modal.style.opacity = '0';
            modal.querySelector('.modal-content').style.transform = 'scale(0.8)';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                    console.log('InvitationManager: Invitation modal removed from DOM');
                }
            }, 300);
        } else {
            console.log('InvitationManager: No invitation modal found to close');
        }
    }

    // Получение списка ожидающих приглашений
    getPendingInvitations() {
        return Array.from(this.pendingInvitations.values());
    }

    // Получение списка отправленных приглашений
    getSentInvitations() {
        return Array.from(this.sentInvitations.values());
    }

    // Очистка всех приглашений
    clearAllInvitations() {
        this.pendingInvitations.clear();
        this.sentInvitations.clear();
    }

    // Уничтожение менеджера (очистка обработчиков)
    destroy() {
        // Удаляем все обработчики событий
        Object.keys(this.eventHandlers).forEach(event => {
            if (this.socket && this.eventHandlers[event]) {
                this.socket.off(event, this.eventHandlers[event]);
            }
        });
        this.eventHandlers = {};

        // Очищаем приглашения
        this.clearAllInvitations();
    }
}

// Экспорт класса для ES6 модулей
export { InvitationManager };

// Экспорт класса в глобальную область
window.InvitationManager = InvitationManager;
