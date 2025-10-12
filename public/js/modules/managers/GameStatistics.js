// ===== GAME STATISTICS =====

// Система сбора статистики игр
class GameStatistics {
    constructor() {
        this.storageKey = 'wt_game_statistics';
        this.stats = this.loadStats();
        this.listeners = [];
    }

    // Загрузка статистики из localStorage
    loadStats() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : this.getDefaultStats();
        } catch (e) {
            console.warn('Failed to load game statistics:', e);
            return this.getDefaultStats();
        }
    }

    // Сохранение статистики в localStorage
    saveStats() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.stats));
        } catch (e) {
            console.warn('Failed to save game statistics:', e);
        }
    }

    // Получение статистики по умолчанию
    getDefaultStats() {
        return {
            gamesPlayed: 0,
            totalWins: 0,
            totalLosses: 0,
            totalDraws: 0,
            games: {
                tictactoe: {
                    played: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    winRate: 0,
                    bestStreak: 0,
                    currentStreak: 0
                },
                chess: {
                    played: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    winRate: 0,
                    bestStreak: 0,
                    currentStreak: 0
                },
                poker: {
                    played: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    winRate: 0,
                    bestStreak: 0,
                    currentStreak: 0,
                    bestScore: 0,
                    totalScore: 0
                },
                durak: {
                    played: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    winRate: 0,
                    bestStreak: 0,
                    currentStreak: 0
                }
            },
            achievements: {
                firstWin: false,
                winStreak5: false,
                winStreak10: false,
                gamesPlayed100: false,
                perfectGame: false // выиграть без поражений во всех играх
            },
            lastUpdated: Date.now()
        };
    }

    // Регистрация результата игры
    recordGameResult(gameType, result, metadata = {}) {
        if (!this.stats.games[gameType]) {
            console.warn(`Unknown game type: ${gameType}`);
            return;
        }

        const gameStats = this.stats.games[gameType];

        // Обновляем счетчики
        gameStats.played++;
        this.stats.gamesPlayed++;

        switch (result) {
            case 'win':
                gameStats.wins++;
                this.stats.totalWins++;
                gameStats.currentStreak++;
                if (gameStats.currentStreak > gameStats.bestStreak) {
                    gameStats.bestStreak = gameStats.currentStreak;
                }
                break;
            case 'loss':
                gameStats.losses++;
                this.stats.totalLosses++;
                gameStats.currentStreak = 0;
                break;
            case 'draw':
                gameStats.draws++;
                this.stats.totalDraws++;
                gameStats.currentStreak = 0;
                break;
        }

        // Обновляем процент побед
        gameStats.winRate = gameStats.played > 0 ? Math.round((gameStats.wins / gameStats.played) * 100) : 0;

        // Специальная логика для покера (очки)
        if (gameType === 'poker' && metadata.score !== undefined) {
            gameStats.totalScore = (gameStats.totalScore || 0) + metadata.score;
            if (metadata.score > gameStats.bestScore) {
                gameStats.bestScore = metadata.score;
            }
        }

        // Проверяем достижения
        this.checkAchievements(gameType, result);

        // Сохраняем и уведомляем слушателей
        this.saveStats();
        this.notifyListeners('gameCompleted', { gameType, result, metadata });

        console.log(`📊 Game statistics updated: ${gameType} - ${result}`);
    }

    // Проверка достижений
    checkAchievements(gameType, result) {
        const achievements = this.stats.achievements;

        // Первая победа
        if (!achievements.firstWin && result === 'win') {
            achievements.firstWin = true;
            this.notifyListeners('achievementUnlocked', { achievement: 'firstWin', name: 'Первая победа!' });
        }

        // Серии побед
        const gameStats = this.stats.games[gameType];
        if (result === 'win') {
            if (gameStats.currentStreak >= 5 && !achievements.winStreak5) {
                achievements.winStreak5 = true;
                this.notifyListeners('achievementUnlocked', { achievement: 'winStreak5', name: 'Серия из 5 побед!' });
            }
            if (gameStats.currentStreak >= 10 && !achievements.winStreak10) {
                achievements.winStreak10 = true;
                this.notifyListeners('achievementUnlocked', { achievement: 'winStreak10', name: 'Серия из 10 побед!' });
            }
        }

        // 100 игр сыграно
        if (this.stats.gamesPlayed >= 100 && !achievements.gamesPlayed100) {
            achievements.gamesPlayed100 = true;
            this.notifyListeners('achievementUnlocked', { achievement: 'gamesPlayed100', name: '100 игр сыграно!' });
        }

        // Идеальная игра (победы во всех типах игр)
        const allGamesWon = Object.values(this.stats.games).every(game => game.wins > 0);
        if (allGamesWon && !achievements.perfectGame) {
            achievements.perfectGame = true;
            this.notifyListeners('achievementUnlocked', { achievement: 'perfectGame', name: 'Идеальная игра!' });
        }
    }

    // Получение статистики для игры
    getGameStats(gameType) {
        return this.stats.games[gameType] || null;
    }

    // Получение общей статистики
    getOverallStats() {
        return {
            gamesPlayed: this.stats.gamesPlayed,
            totalWins: this.stats.totalWins,
            totalLosses: this.stats.totalLosses,
            totalDraws: this.stats.totalDraws,
            winRate: this.stats.gamesPlayed > 0 ? Math.round((this.stats.totalWins / this.stats.gamesPlayed) * 100) : 0
        };
    }

    // Получение списка достижений
    getAchievements() {
        return this.stats.achievements;
    }

    // Получение рейтинга игр по популярности
    getGameRanking() {
        return Object.entries(this.stats.games)
            .map(([gameType, stats]) => ({
                gameType,
                played: stats.played,
                winRate: stats.winRate
            }))
            .sort((a, b) => b.played - a.played);
    }

    // Сброс всей статистики
    resetStats() {
        this.stats = this.getDefaultStats();
        this.saveStats();
        this.notifyListeners('statsReset', {});
        console.log('📊 Game statistics reset');
    }

    // Добавление слушателя событий
    addListener(callback) {
        this.listeners.push(callback);
    }

    // Удаление слушателя
    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    // Уведомление слушателей
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (e) {
                console.error('Error in statistics listener:', e);
            }
        });
    }

    // Экспорт статистики (для бэкапа)
    exportStats() {
        return JSON.stringify(this.stats, null, 2);
    }

    // Импорт статистики (из бэкапа)
    importStats(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            if (this.validateStats(imported)) {
                this.stats = imported;
                this.saveStats();
                this.notifyListeners('statsImported', {});
                console.log('📊 Game statistics imported');
                return true;
            }
        } catch (e) {
            console.error('Failed to import statistics:', e);
        }
        return false;
    }

    // Валидация импортированной статистики
    validateStats(stats) {
        return stats &&
               typeof stats.gamesPlayed === 'number' &&
               stats.games &&
               typeof stats.games === 'object' &&
               stats.achievements &&
               typeof stats.achievements === 'object';
    }

    // Получение текста достижения
    getAchievementDescription(achievement) {
        const descriptions = {
            firstWin: '🎉 Выиграйте свою первую игру!',
            winStreak5: '🔥 Выиграйте 5 игр подряд!',
            winStreak10: '⚡ Выиграйте 10 игр подряд!',
            gamesPlayed100: '🎮 Сыграйте 100 игр!',
            perfectGame: '🏆 Выиграйте хотя бы по одной игре каждого типа!'
        };
        return descriptions[achievement] || 'Неизвестное достижение';
    }
}

// Экспорт класса для ES6 модулей
export { GameStatistics };

// Экспорт класса в глобальную область
window.GameStatistics = GameStatistics;
