// ===== NETWORK MANAGER =====

// Менеджер сети - управляет сетевыми взаимодействиями
class NetworkManager {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.isConnected = false;
        this.eventHandlers = {};
    }

    // Подключение к серверу
    connect(serverUrl = null) {
        if (this.socket && this.isConnected) {
            console.log('🔗 Already connected');
            return;
        }

        // Используем глобальный socket если он существует
        if (window.socket) {
            this.socket = window.socket;
            this.roomId = window.roomId;
            this.isConnected = true;
            this.setupSocketListeners();
            console.log('🔗 Using existing socket connection');
            return;
        }

        // Создаем новое подключение
        const url = serverUrl || window.location.origin;
        console.log('🔗 Connecting to:', url);

        try {
            this.socket = io(url);
            this.setupSocketListeners();
        } catch (error) {
            console.error('❌ Failed to connect:', error);
        }
    }

    // Настройка обработчиков сокетов
    setupSocketListeners() {
        if (!this.socket) return;

        // Обработчик подключения
        this.on('connect', () => {
            this.isConnected = true;
            console.log('✅ Connected to server');
            this.emit('join-room', { roomId: this.roomId });
        });

        // Обработчик отключения
        this.on('disconnect', () => {
            this.isConnected = false;
            console.log('❌ Disconnected from server');
        });

        // Обработчик ошибок
        this.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            this.isConnected = false;
        });

        // Обработчик успешного присоединения к комнате
        this.on('room-joined', (data) => {
            console.log('🏠 Joined room:', data);
            this.roomId = data.roomId;

            // Обновляем глобальные переменные
            window.roomId = this.roomId;
            if (data.players) {
                window.roomPlayers = data.players;
            }
        });

        // Обработчик обновления списка игроков
        this.on('players-update', (players) => {
            console.log('👥 Players updated:', players);
            window.roomPlayers = players;
        });

        // Обработчик получения приглашения
        this.on('game-invitation', (data) => {
            console.log('📨 Game invitation received:', data);
            if (window.invitationManager) {
                window.invitationManager.handleIncomingInvitation(data);
            }
        });

        // Обработчик ответа на приглашение
        this.on('game-invitation-response', (data) => {
            console.log('📬 Invitation response received:', data);
            if (window.invitationManager) {
                window.invitationManager.handleInvitationResponse(data);
            }
        });

        // Обработчик начала игры
        this.on('game-started', (data) => {
            console.log('🎮 Game started event:', data);
            if (window.invitationManager) {
                window.invitationManager.handleGameStarted(data);
            }
        });

        // Обработчик завершения игры
        this.on('game-ended', (data) => {
            console.log('🏁 Game ended:', data);
            if (window.gameManager && window.gameManager.currentGame) {
                window.gameManager.currentGame.endGame(data.winner);
            }
        });

        // Обработчик закрытия игры
        this.on('game-closed', () => {
            console.log('🎯 Game closed');
            if (window.invitationManager) {
                window.invitationManager.handleGameClosed();
            }
        });

        // Обработчик хода в игре
        this.on('game-move', (move) => {
            console.log('🎲 Game move received:', move);
            if (window.gameManager && window.gameManager.currentGame) {
                window.gameManager.currentGame.handleNetworkMove(move);
            }
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
        if (this.socket && this.isConnected) {
            this.socket.emit(event, data);
        } else {
            console.warn('⚠️ Cannot emit - not connected');
        }
    }

    // Отправка запроса на начало игры
    sendStartGame(gameType) {
        this.emit('start-game', {
            roomId: this.roomId,
            gameType: gameType
        });
    }

    // Отправка хода
    sendMove(moveData) {
        this.emit('game-move', {
            roomId: this.roomId,
            ...moveData
        });
    }

    // Присоединение к комнате
    joinRoom(roomId) {
        this.roomId = roomId;
        if (this.isConnected) {
            this.emit('join-room', { roomId });
        }
    }

    // Создание комнаты
    createRoom(roomData = {}) {
        this.emit('create-room', roomData);
    }

    // Выход из комнаты
    leaveRoom() {
        if (this.roomId) {
            this.emit('leave-room', { roomId: this.roomId });
            this.roomId = null;
        }
    }

    // Отключение
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.roomId = null;

            // Очищаем обработчики
            Object.keys(this.eventHandlers).forEach(event => {
                if (this.socket) {
                    this.socket.off(event, this.eventHandlers[event]);
                }
            });
            this.eventHandlers = {};
        }
    }

    // Получение статуса подключения
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            roomId: this.roomId,
            socketId: this.socket?.id
        };
    }

    // Проверка подключения
    isConnected() {
        return this.isConnected && this.socket && this.socket.connected;
    }
}

// Экспорт класса для ES6 модулей
export { NetworkManager };

// Экспорт класса в глобальную область
window.NetworkManager = NetworkManager;
