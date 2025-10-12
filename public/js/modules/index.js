// ===== GAME MODULES INDEX =====

// Импорт базовых классов
import { BaseGame } from './core/BaseGame.js';
import { CardGame } from './games/CardGame.js';

// Импорт игр
import { TicTacToeGame } from './games/TicTacToeGame.js';
import { ChessGame } from './games/ChessGame.js';
import { PokerGame } from './games/PokerGame.js';
import { DurakGame } from './games/DurakGame.js';

// Импорт рендереров
// import { PokerGameRenderer } from './games/PokerGameRenderer.js';
// import { DurakGameRenderer } from './games/DurakGameRenderer.js';

// Импорт ботов
import { PokerBot } from './ai/PokerBot.js';
import { durakAnalyzer, makeDurakBotDefense, makeDurakBotAttack, makeDurakBotThrow } from './ai/DurakBot.js';

// Импорт UI компонентов
// import { GameUI } from './ui/GameUI.js';
import { GameUI } from './ui/GameUI.js';
import { InvitationManager } from './managers/InvitationManager.js';
import { GameStatistics } from './managers/GameStatistics.js';

// Импорт ИИ
import { GameAI } from './ai/GameAI.js';

// Импорт менеджеров
import { GameManager } from './managers/GameManager.js';
import { NetworkManager } from './managers/NetworkManager.js';

// Импорт функций совместимости
// import './legacy/legacy-functions.js';

// Инициализация глобальных менеджеров
window.gameManager = new GameManager();
window.networkManager = new NetworkManager();
window.invitationManager = new InvitationManager();
window.gameStatistics = new GameStatistics();
window.gameAI = new GameAI();
// window.durakAnalyzer = new DurakBotAnalyzer(); // Теперь импортируется напрямую

// Экспорт классов в глобальную область для совместимости
window.BaseGame = BaseGame;
window.CardGame = CardGame;
window.TicTacToeGame = TicTacToeGame;
window.ChessGame = ChessGame;
window.PokerGame = PokerGame;
window.DurakGame = DurakGame;
window.GameManager = GameManager;
window.NetworkManager = NetworkManager;
window.InvitationManager = InvitationManager;
window.GameStatistics = GameStatistics;
window.GameAI = GameAI;

// Экспорт новых модулей
// window.PokerGameRenderer = PokerGameRenderer;
// window.DurakGameRenderer = DurakGameRenderer;
window.PokerBot = PokerBot;
window.durakAnalyzer = durakAnalyzer;
window.makeDurakBotDefense = makeDurakBotDefense;
window.makeDurakBotAttack = makeDurakBotAttack;
window.makeDurakBotThrow = makeDurakBotThrow;
// window.GameUI = GameUI;

// Функция инициализации системы
function initializeGameSystem() {
    console.log('🎮 Initializing modular game system...');

    // Подключение к сети
    window.networkManager.connect();

    // Настройка обработчиков достижений
    window.gameStatistics.addListener((event, data) => {
        if (event === 'achievementUnlocked') {
            const { achievement, name } = data;
            showNotification(`🏆 Достижение разблокировано: ${name}!`, 'success');
            console.log(`Achievement unlocked: ${achievement} - ${name}`);
        }
    });

    console.log('✅ Game system initialized successfully');
}

// Экспорт функции инициализации
window.initializeGameSystem = initializeGameSystem;

// Автоматическая инициализация при загрузке
// Убрана, инициализация происходит в games.js

console.log('🎯 Game modules loaded successfully');
