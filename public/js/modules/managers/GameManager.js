// ===== GAME MANAGER =====

// Менеджер игр - управляет жизненным циклом игр
class GameManager {
    constructor() {
        this.currentGame = null;
        this.availableGames = {
            'tictactoe': window.TicTacToeGame,
            'chess': window.ChessGame,
            'poker': window.PokerGame,
            'durak': window.DurakGame
        };
    }

    // Создание игры по типу
    createGame(gameType) {
        if (this.availableGames[gameType]) {
            this.currentGame = new this.availableGames[gameType]();
            console.log(`🎮 Created game: ${gameType}`);
            return this.currentGame;
        }
        console.error(`❌ Unknown game type: ${gameType}`);
        return null;
    }

    // Получение текущей игры
    getCurrentGame() {
        return this.currentGame;
    }

    // Закрытие текущей игры
    closeCurrentGame() {
        if (this.currentGame) {
            console.log('🎯 Closing current game');
            this.currentGame.endGame();
            this.currentGame.clearContainer(); // Очищаем контейнер игры
            this.currentGame = null;
            
            // Сбрасываем глобальные переменные игры
            window.currentOpponent = null;
            window.gameState = null;
            window.currentGame = null;
        }
    }

    // Запуск игры
    startGame(gameType, opponent = null) {
        this.closeCurrentGame();

        const game = this.createGame(gameType);
        if (game) {
            // Устанавливаем противника если передан
            if (opponent) {
                window.currentOpponent = opponent;
                game.currentOpponent = opponent;
                console.log('GameManager: Set opponent for', gameType, ':', opponent);
            } else {
                console.log('GameManager: No opponent provided for', gameType);
            }

            console.log(`GameManager: Calling init on game ${gameType}, game.currentOpponent:`, game.currentOpponent);
            const success = game.init();
            console.log(`GameManager: init result for ${gameType}:`, success, 'game.isNetworkGame:', game.isNetworkGame);
            if (success) {
                console.log(`✅ Game started: ${gameType}`);
                return game;
            } else {
                console.error(`❌ Failed to start game: ${gameType}`);
                this.currentGame = null;
            }
        }
        return null;
    }

    // Получение списка доступных игр
    getAvailableGames() {
        return Object.keys(this.availableGames);
    }

    // Проверка, запущена ли игра
    isGameActive() {
        return this.currentGame !== null;
    }

    // Получение типа текущей игры
    getCurrentGameType() {
        return this.currentGame ? this.currentGame.gameType : null;
    }
}

// Экспорт класса для ES6 модулей
export { GameManager };

// Экспорт класса в глобальную область
window.GameManager = GameManager;
