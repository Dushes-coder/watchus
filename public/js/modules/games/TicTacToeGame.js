// Глобальная функция для выхода из игры
window.exitTicTacToeGame = function() {
    console.log('Exiting TicTacToe game');

    // Скрываем панель игры и восстанавливаем меню через глобальную функцию
    if (window.closeGame) {
        window.closeGame();
    }

    if (window.showNotification) {
        window.showNotification('Вы вышли из игры', 'info');
    }
};

// Глобальная функция для автоматического рестарта игры
window.autoRestartTicTacToeGame = function() {
    console.log('Auto-restarting TicTacToe game with current opponent');
    
    if (!window.currentOpponent || window.currentOpponent.type !== 'player') {
        console.log('No opponent to restart with, exiting');
        return;
    }
    
    if (!window.gameManager || !window.gameManager.currentGame) {
        console.log('No current game to restart');
        return;
    }
    
    const game = window.gameManager.currentGame;
    
    // Сохраняем players перед сбросом
    const savedPlayers = game.gameState.players;
    console.log('Saved players before restart:', savedPlayers);
    
    // Сбрасываем состояние игры
    game.gameState.board = game.createEmptyBoard();
    game.gameState.currentPlayer = 'X';
    game.gameState.gameOver = false;
    game.gameState.winner = null;
    game.gameState.players = savedPlayers; // Восстанавливаем players
    
    // Обновляем сетевые свойства
    game.socket = window.socket;
    game.roomId = window.roomId;
    
    // Переинициализируем символы
    game.setupPlayerSymbols();
    
    console.log('After restart - players:', game.gameState.players, 'mySymbol:', game.mySymbol);
    
    // Отправляем новый game-state на сервер
    if (game.socket && game.roomId) {
        game.socket.emit('game-move', {
            roomId: game.roomId,
            gameType: 'tictactoe',
            move: {
                type: 'restart',
                board: game.gameState.board,
                currentPlayer: game.gameState.currentPlayer,
                gameOver: false,
                winner: null
            }
        });
    }
    
    // Перерисовываем игру
    game.render();
    
    console.log('Game restarted automatically');
};

import { BaseGame } from '../core/BaseGame.js';

// Класс игры в крестики-нолики
class TicTacToeGame extends BaseGame {
    constructor() {
        super('tictactoe');
        this.boardSize = 3;
        this.mySymbol = 'X';
        this.opponentSymbol = 'O';
    }

    // Инициализация игры
    init() {
        if (!super.init()) return false;

        // Определяем тип игры
        // Если currentOpponent - бот, то всегда локальная игра
        // Если currentOpponent - игрок, то сетевая игра
        this.isNetworkGame = this.currentOpponent?.type === 'player';

        console.log('TicTacToe init - currentOpponent:', this.currentOpponent, 'isNetworkGame:', this.isNetworkGame);

        // Инициализируем состояние игры
        this.gameState = {
            board: this.createEmptyBoard(),
            currentPlayer: 'X',
            gameOver: false,
            winner: null,
            players: this.isNetworkGame ? [this.socket?.id, this.currentOpponent?.id].filter(Boolean) : null,
            waitingForMove: false // Флаг ожидания сетевого хода
        };

        // Устанавливаем символы игроков
        this.setupPlayerSymbols();

        // Рендерим доску
        this.render();

        // Настраиваем обработчики событий
        this.setupEventListeners();

        return true;
    }

    // Создание пустой доски
    createEmptyBoard() {
        return Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(''));
    }

    // Настройка символов игроков
    setupPlayerSymbols() {
        // Сбрасываем waitingForMove при настройке символов
        if (this.gameState) {
            this.gameState.waitingForMove = false;
        }

        if (this.isNetworkGame && this.gameState.players) {
            // Сетевая игра с игроком
            const normalizePlayerId = (player) => {
                if (!player) return null;
                if (typeof player === 'string') return player;
                if (typeof player === 'object' && 'id' in player) return player.id;
                return null;
            };

            const normalizedPlayers = this.gameState.players
                .map(normalizePlayerId)
                .filter(Boolean);

            if (normalizedPlayers.length > 0) {
                this.gameState.players = normalizedPlayers;
            }

            const mySocketId = this.socket?.id || window.socket?.id;
            console.log('TicTacToe setupPlayerSymbols - network game, players:', this.gameState.players, 'my socket.id:', mySocketId);

            this.gamePlayerMapping = {
                [this.gameState.players?.[0]]: 'X',
                [this.gameState.players?.[1]]: 'O'
            };

            if (mySocketId && this.gamePlayerMapping[mySocketId]) {
                this.mySymbol = this.gamePlayerMapping[mySocketId];
            } else if (mySocketId && this.gameState.players?.length === 2) {
                // Если по каким-то причинам id не найден, но список из 2 игроков есть
                this.mySymbol = this.gameState.players[0] === mySocketId ? 'X' : 'O';
            } else {
                // Фолбэк
                this.mySymbol = 'X';
            }

            this.opponentSymbol = this.mySymbol === 'X' ? 'O' : 'X';
            console.log('TicTacToe setupPlayerSymbols - mySymbol:', this.mySymbol, 'opponentSymbol:', this.opponentSymbol);
        } else {
            // Локальная игра или игра с ботом
            this.mySymbol = 'X';
            this.opponentSymbol = 'O';
            console.log('TicTacToe setupPlayerSymbols - local game, mySymbol: X, opponentSymbol: O');
        }
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Обработчики будут добавлены при рендере доски
    }

    // Рендеринг игры
    render() {
        console.log('TicTacToe: render called');
        
        // Проверяем, что container существует
        if (!this.container) {
            console.warn('TicTacToe: Container not found, trying to find it');
            this.container = document.getElementById(this.containerId);
            if (!this.container) {
                console.error('TicTacToe: Container still not found, aborting render');
                return;
            }
        }
        
        let html = this.renderOpponentInfo();
        html += '<div class="tic-tac-toe-container">';
        html += '<h3>⭕ Крестики-нолики</h3>';
        html += '<div class="tic-tac-toe-status">' + this.getStatusText() + '</div>';
        html += '<div class="ttt-board">';
        html += this.renderBoard();
        html += '</div>';
        html += this.getControlsHTML(); // Добавляем кнопки управления
        html += '</div>';

        // Добавляем timestamp для принудительного обновления
        html += '<!-- ' + Date.now() + ' -->';

        this.container.innerHTML = html;
        this.container.style.display = 'block'; // Показываем контейнер
        
        // Если игра окончена, запускаем таймер автоматического рестарта
        if (this.gameState.gameOver) {
            console.log('Game ended, starting auto-restart timer');
            this.startAutoRestartTimer();
        }
        
        console.log('TicTacToe: render completed, html contains X:', html.includes('X'));
    }

    // Локальный рестарт игры (для игры с ботом)
    restartLocalGame() {
        console.log('Restarting local TicTacToe game with bot');
        
        // Сбрасываем состояние игры
        this.gameState.board = this.createEmptyBoard();
        this.gameState.currentPlayer = 'X';
        this.gameState.gameOver = false;
        this.gameState.winner = null;
        
        // Переинициализируем символы
        this.setupPlayerSymbols();
        
        // Перерисовываем игру
        this.render();
        
        console.log('Local game restarted with bot');
    }

    // Таймер автоматического рестарта
    startAutoRestartTimer() {
        // Очищаем предыдущий таймер
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
        }
        if (this.restartInterval) {
            clearInterval(this.restartInterval);
        }
        
        let timeLeft = 3;
        const timerElement = document.getElementById('restart-timer');
        if (timerElement) {
            timerElement.textContent = timeLeft;
        }
        
        // Обновляем счетчик каждую секунду
        this.restartInterval = setInterval(() => {
            timeLeft--;
            if (timerElement) {
                timerElement.textContent = timeLeft;
            }
            if (timeLeft <= 0) {
                clearInterval(this.restartInterval);
            }
        }, 1000);
        
        // Запускаем рестарт через 3 секунды
        this.restartTimer = setTimeout(() => {
            if (this.isNetworkGame && this.currentOpponent?.type === 'player') {
                // Сетевая игра с игроком
                window.autoRestartTicTacToeGame();
            } else if (this.currentOpponent?.type === 'bot') {
                // Игра с ботом - локальный рестарт
                this.restartLocalGame();
            }
        }, 3000);
    }

    // Рендеринг доски
    renderBoard() {
        console.log('TicTacToe: Rendering board:', this.gameState.board);
        let html = '';
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cellValue = this.gameState.board[row][col];
                const cellClass = 'ttt-cell' + (cellValue ? ' ' + cellValue.toLowerCase() : '');
                html += `<div class="${cellClass}" data-row="${row}" data-col="${col}" onclick="window.handleTicTacToeCellClick(${row}, ${col})" id="cell-${row}-${col}-${Date.now()}">${cellValue}</div>`;
            }
        }
        console.log(`TicTacToe: board HTML generated, length=${html.length}`);
        return html;
    }

    // Получение текста статуса
    getStatusText() {
        console.log('TicTacToe getStatusText - gameOver:', this.gameState.gameOver, 'currentPlayer:', this.gameState.currentPlayer, 'mySymbol:', this.mySymbol, 'waitingForMove:', this.gameState.waitingForMove);
        if (this.gameState.gameOver) {
            if (this.gameState.winner === 'draw') {
                return '<span style="color: #ffc107;">Ничья!</span>';
            } else {
                const winnerColor = this.gameState.winner === 'X' ? 'var(--accent-primary)' : '#dc3545';
                return `Победитель: <span style="color: ${winnerColor};">${this.gameState.winner}</span>!`;
            }
        } else {
            const isMyTurn = this.mySymbol === this.gameState.currentPlayer;
            const isWaiting = this.isNetworkGame && this.gameState.waitingForMove;
            console.log('TicTacToe getStatusText - isMyTurn:', isMyTurn, 'isWaiting:', isWaiting);

            if (isWaiting) {
                return '⏳ Ожидание хода противника...';
            }

            const turnText = isMyTurn ? 'Ваш ход' : 'Ход противника';
            const turnIndicator = isMyTurn ? '👉' : '⏳';
            const playerColor = this.gameState.currentPlayer === 'X' ? 'var(--accent-primary)' : '#dc3545';
            return `${turnIndicator} <span style="color: ${playerColor};">${this.gameState.currentPlayer}</span> (${turnText})`;
        }
    }

    // Получение HTML для кнопок управления
    getControlsHTML() {
        let html = '<div class="game-controls">';
        html += '<button class="btn btn-secondary game-close-btn" onclick="window.exitTicTacToeGame()">❌ Закрыть игру</button>';
        
        if (this.gameState.gameOver) {
            // Добавляем отсчет для всех завершенных игр
            html += '<div class="auto-restart">🔄 Новая игра через <span id="restart-timer">3</span> сек...</div>';
        }
        
        html += '</div>';
        
        return html;
    }

    // Обработка клика по клетке
    handleCellClick(row, col) {
        if (this.gameState.gameOver) return;

        // В сетевой игре проверяем, что не ждем ход противника
        if (this.isNetworkGame && this.gameState.waitingForMove) {
            console.log('TicTacToe: Waiting for opponent move, ignoring click');
            return;
        }

        console.log(`TicTacToe: Attempting move at [${row},${col}], currentPlayer: ${this.gameState.currentPlayer}, mySymbol: ${this.mySymbol}`);

        // Проверяем, что сейчас ход игрока
        if (this.mySymbol !== this.gameState.currentPlayer) {
            console.log(`TicTacToe: Invalid move - it's not your turn`);
            return;
        }

        if (this.gameState.board[row][col] === '') {
            this.makeMove(row, col, this.gameState.currentPlayer);
        }
    }

    // Совершение хода
    makeMove(row, col, player) {
        console.log('TicTacToe: Making move', row, col, player, 'isNetworkGame:', this.isNetworkGame);

        if (this.isNetworkGame) {
            // Отправляем ход на сервер только для сетевой игры
            console.log('TicTacToe: Sending network move');
            console.log('TicTacToe: Move data:', { row, col, player, timestamp: Date.now() });
            this.sendMove({
                row,
                col,
                player: player,
                timestamp: Date.now() // Добавляем timestamp для уникальности
            });

            // Устанавливаем флаг ожидания и блокируем UI
            this.gameState.waitingForMove = true;
            this.render(); // Перерисовываем с индикатором ожидания

            console.log('TicTacToe: Network move sent, waiting for confirmation');
        } else {
            // Локальный ход (с ботом или одиночная игра)
            console.log('TicTacToe: Local move - placing', player, 'at', row, col);
            this.gameState.board[row][col] = player;
            this.switchPlayer();
            this.checkWinner();
            console.log('TicTacToe: move completed, calling render');
            this.render();

            // Если играем с ботом и игра не окончена, и ход сделал игрок, делаем ход бота
            console.log('TicTacToe: Checking bot move - currentOpponent:', this.currentOpponent, 'gameOver:', this.gameState.gameOver, 'player:', player, 'mySymbol:', this.mySymbol);
            if (this.currentOpponent?.type === 'bot' && !this.gameState.gameOver && player === this.mySymbol) {
                console.log('TicTacToe: Making bot move in 500ms');
                setTimeout(() => {
                    this.makeBotMove();
                }, 500);
            }
        }
    }

    // Обработка сетевого хода
    handleNetworkMove(move) {
        console.log('TicTacToe: handleNetworkMove received:', move);
        console.log('TicTacToe: Current game state before update:', this.gameState);

        const { row, col, player, playerId } = move;

        // Сбрасываем флаг ожидания
        this.gameState.waitingForMove = false;

        // Проверяем, что клетка свободна
        if (this.gameState.board[row][col] !== '') {
            console.warn('TicTacToe: Cell already occupied:', row, col);
            return;
        }

        // Применяем ход
        console.log('TicTacToe: Applying network move at', row, col, 'by player', player);
        this.gameState.board[row][col] = player;
        this.switchPlayer();
        this.checkWinner();
        this.render();

        console.log('TicTacToe: Game state after network move:', this.gameState);

        if (this.gameState.gameOver) {
            console.log('TicTacToe: Game ended with winner:', this.gameState.winner);
            this.endGame(this.gameState.winner);
        } else {
            console.log('TicTacToe: Game continues, current player:', this.gameState.currentPlayer);
        }
    }

    // Смена игрока
    switchPlayer() {
        this.gameState.currentPlayer = this.gameState.currentPlayer === 'X' ? 'O' : 'X';
    }

    // Ход бота
    makeBotMove() {
        if (this.gameState.gameOver) return;

        const availableMoves = [];
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.gameState.board[row][col] === '') {
                    availableMoves.push({ row, col });
                }
            }
        }

        if (availableMoves.length > 0) {
            // Бот пытается выиграть или заблокировать игрока
            let bestMove = this.findBestMove() || availableMoves[Math.floor(Math.random() * availableMoves.length)];

            this.makeMove(bestMove.row, bestMove.col, this.gameState.currentPlayer);
        }
    }

    // Поиск лучшего хода для бота
    findBestMove() {
        const currentPlayer = this.gameState.currentPlayer;
        const opponent = currentPlayer === 'X' ? 'O' : 'X';

        // Проверяем, может ли бот выиграть
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.gameState.board[row][col] === '') {
                    this.gameState.board[row][col] = currentPlayer;
                    if (this.checkWinCondition(currentPlayer)) {
                        this.gameState.board[row][col] = ''; // Отменяем временный ход
                        return { row, col };
                    }
                    this.gameState.board[row][col] = ''; // Отменяем временный ход
                }
            }
        }

        // Проверяем, нужно ли заблокировать игрока
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.gameState.board[row][col] === '') {
                    this.gameState.board[row][col] = opponent;
                    if (this.checkWinCondition(opponent)) {
                        this.gameState.board[row][col] = ''; // Отменяем временный ход
                        return { row, col };
                    }
                    this.gameState.board[row][col] = ''; // Отменяем временный ход
                }
            }
        }

        // Если нет критических ходов, выбираем центр или угол
        if (this.gameState.board[1][1] === '') return { row: 1, col: 1 }; // Центр

        const corners = [{ row: 0, col: 0 }, { row: 0, col: 2 }, { row: 2, col: 0 }, { row: 2, col: 2 }];
        for (let corner of corners) {
            if (this.gameState.board[corner.row][corner.col] === '') return corner;
        }

        return null;
    }

    // Проверка условия победы
    checkWinCondition(player) {
        const board = this.gameState.board;

        // Проверяем строки
        for (let row = 0; row < this.boardSize; row++) {
            if (board[row].every(cell => cell === player)) {
                return true;
            }
        }

        // Проверяем столбцы
        for (let col = 0; col < this.boardSize; col++) {
            if (board.every(row => row[col] === player)) {
                return true;
            }
        }

        // Проверяем диагонали
        if (board.every((row, index) => row[index] === player)) {
            return true;
        }

        if (board.every((row, index) => row[this.boardSize - 1 - index] === player)) {
            return true;
        }

        return false;
    }

    // Проверка победителя
    checkWinner() {
        // Проверяем строки, столбцы и диагонали
        for (let i = 0; i < this.boardSize; i++) {
            // Строки
            if (this.gameState.board[i][0] &&
                this.gameState.board[i].every(cell => cell === this.gameState.board[i][0])) {
                this.gameState.gameOver = true;
                this.gameState.winner = this.gameState.board[i][0];
                return;
            }

            // Столбцы
            const column = [];
            for (let r = 0; r < this.boardSize; r++) {
                column.push(this.gameState.board[r][i]);
            }
            if (this.gameState.board[0][i] && column.every(cell => cell === this.gameState.board[0][i])) {
                this.gameState.gameOver = true;
                this.gameState.winner = this.gameState.board[0][i];
                return;
            }
        }

        // Диагонали
        const diagonal1 = [];
        for (let i = 0; i < this.boardSize; i++) {
            diagonal1.push(this.gameState.board[i][i]);
        }
        if (this.gameState.board[0][0] && diagonal1.every(cell => cell === this.gameState.board[0][0])) {
            this.gameState.gameOver = true;
            this.gameState.winner = this.gameState.board[0][0];
            return;
        }

        const diagonal2 = [];
        for (let i = 0; i < this.boardSize; i++) {
            diagonal2.push(this.gameState.board[i][this.boardSize - 1 - i]);
        }
        if (this.gameState.board[0][this.boardSize - 1] && diagonal2.every(cell => cell === this.gameState.board[0][this.boardSize - 1])) {
            this.gameState.gameOver = true;
            this.gameState.winner = this.gameState.board[0][this.boardSize - 1];
            return;
        }

        // Проверяем ничью
        let isDraw = true;
        for (let row of this.gameState.board) {
            if (row.includes('')) {
                isDraw = false;
                break;
            }
        }
        if (isDraw) {
            this.gameState.gameOver = true;
            this.gameState.winner = 'draw';
        }
    }

}

// Экспорт класса для ES6 модулей
export { TicTacToeGame };

// Экспорт класса в глобальную область
window.TicTacToeGame = TicTacToeGame;
