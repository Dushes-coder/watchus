// ===== CHESS GAME CLASS =====

// Класс для игры в шахматы
class ChessGame extends BaseGame {
    constructor() {
        super('chess');
        this.boardSize = 8;
        this.myColor = 'white';
        this.opponentColor = 'black';
        this.validMoves = [];
    }

    // Инициализация игры
    init() {
        try {
            console.log('ChessGame.init() called');
            if (!super.init()) {
                console.log('ChessGame.init(): super.init() failed');
                return false;
            }
            console.log('ChessGame.init(): super.init() success, container found:', !!this.container);

            this.gameState = {
                board: this.createInitialBoard(),
                currentPlayer: 'white',
                selectedCell: null,
                check: false,
                checkmate: false,
                gameOver: false,
                winner: null,
                lastPawnDoubleMove: null,
                kingMoved: { w: false, b: false },
                rookMoved: { w: { left: false, right: false }, b: { left: false, right: false } }
            };

            // Инициализировать сетевую игру
            this.isNetworkGame = false;

            // Определяем цвета для сетевой игры
            this.setupPlayerColors();

            console.log('ChessGame.init(): calling render');
            this.render();
            console.log('ChessGame.init(): render completed');
            this.setupEventListeners();
            console.log('ChessGame.init(): setupEventListeners completed');

            console.log('ChessGame.init(): completed successfully');
            return true;
        } catch (error) {
            console.error('ChessGame.init(): Error during initialization:', error);
            return false;
        }
    }

    // Настройка цветов игроков для сетевой игры
    setupPlayerColors() {
        if (this.socket && this.roomId && this.currentOpponent?.type === 'player') {
            this.isNetworkGame = true;
            const players = this.gameState.players || [];
            const playerMapping = {
                [players[0]]: 'white',
                [players[1]]: 'black'
            };
            this.myColor = playerMapping[this.socket.id];
            this.opponentColor = this.myColor === 'white' ? 'black' : 'white';
        } else {
            this.isNetworkGame = false;
            this.myColor = 'white';
            this.opponentColor = 'black';
        }
    }

    // Настройка символов игроков (для совместимости с InvitationManager)
    setupPlayerSymbols() {
        this.setupPlayerColors();
    }

    // Создание начальной доски
    createInitialBoard() {
        return [
            ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
            ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
            ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
        ];
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Обработчики добавляются при рендере доски
    }

    // Рендеринг игры
    render() {
        try {
            console.log('ChessGame.render() called, container:', this.container);
            const opponentEmoji = this.currentOpponent?.emoji || '🤖';
            const opponentName = this.currentOpponent?.name || 'Бот';
            const isPlayerTurn = this.myColor === this.gameState.currentPlayer;
            const playerBadgeClass = 'chess-badge' + (isPlayerTurn ? ' turn' : '');
            const opponentBadgeClass = 'chess-badge' + (!isPlayerTurn ? ' turn' : '');
            const playerLabel = this.myColor === 'white' ? 'Вы · Белые' : 'Вы · Черные';
            const opponentLabel = `${opponentEmoji} ${opponentName}`;

            let html = this.renderOpponentInfo();
            html += '<div class="chess-container">';
            html += '<div class="chess-top">';
            html += '<div class="chess-title"><span>♟</span>Шахматы</div>';
            html += '<div class="chess-status">' + this.getStatusText() + '</div>';
            html += '</div>';

            html += '<div class="chess-meta">';
            html += `<div class="${playerBadgeClass}"><span>${this.myColor === 'white' ? '♔' : '♚'}</span>${playerLabel}</div>`;
            html += `<div class="${opponentBadgeClass}"><span>${this.opponentColor === 'white' ? '♔' : '♚'}</span>${opponentLabel}</div>`;
            html += '</div>';

            html += '<div class="chess-body">';
            html += '<div class="chess-board-shell">';
            html += '<div class="chess-axis files">';
            html += '<span>a</span><span>b</span><span>c</span><span>d</span><span>e</span><span>f</span><span>g</span><span>h</span>';
            html += '</div>';
            html += '<div class="chess-board-wrapper">';
            html += '<div class="chess-axis ranks">';
            html += '<span>8</span><span>7</span><span>6</span><span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>';
            html += '</div>';
            html += '<div class="chess-board" id="chessBoard-' + this.gameType + '">' + this.renderBoard() + '</div>';
            html += '</div>';
            html += '</div>'; // shell
            html += '</div>'; // body

            html += '<div class="chess-actions">';
            html += '<button class="secondary" onclick="closeGame()">Закрыть</button>';
            html += '</div>';

            html += '</div>'; // container

            console.log('ChessGame.render(): setting innerHTML, html length:', html.length);
            this.container.innerHTML = html;
            this.container.style.display = 'block'; // Показываем контейнер
            console.log('ChessGame.render(): container displayed');
            this.updateChessStatus();
            console.log('ChessGame.render(): updateChessStatus completed');
        } catch (error) {
            console.error('ChessGame.render(): Error during rendering:', error);
            throw error;
        }
    }

    // Рендеринг шахматной доски
    renderBoard() {
        let html = '';
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cell = this.gameState.board[row][col];
                const cellClass = `chess-cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                const selectedClass = this.gameState.selectedCell &&
                    this.gameState.selectedCell.row === row &&
                    this.gameState.selectedCell.col === col ? ' selected' : '';

                const validMoveClass = this.validMoves && this.validMoves.some(move => move.row === row && move.col === col) ? ' valid-move' : '';

                const isOpponentPiece = cell && cell[0] !== (this.myColor === 'white' ? 'w' : 'b');
                const isMyTurn = this.myColor === this.gameState.currentPlayer;
                const disabledClass = isOpponentPiece && !isMyTurn ? ' disabled-piece' : '';

                let pieceHtml = '';

                if (cell) {
                    const color = cell[0];
                    const type = cell[1];
                    const symbols = {
                        w: { p: '♙', r: '♖', n: '♘', b: '♗', q: '♕', k: '♔' },
                        b: { p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚' }
                    };
                    const pieceSymbol = symbols[color]?.[type] || '';

                    const pieceClass = color === 'w' ? 'white-piece' : 'black-piece';
                    pieceHtml = `<span class="${pieceClass}${disabledClass}">${pieceSymbol}</span>`;
                }

                html += `<div class="${cellClass}${selectedClass}${validMoveClass}" data-row="${row}" data-col="${col}" onclick="window.gameManager.getCurrentGame().handleCellClick(${row}, ${col})">${pieceHtml}</div>`;
            }
        }
        return html;
    }

    // Получение текста статуса
    getStatusText() {
        if (this.gameState.checkmate) {
            const winner = this.gameState.currentPlayer === 'white' ? 'Черные' : 'Белые';
            const winnerSymbol = winner === 'Белые' ? '♔' : '♚';
            return `<span style="color: #28a745; font-weight: bold;">Мат! Победили ${winner} ${winnerSymbol}</span>`;
        } else if (this.gameState.stalemate) {
            return `<span style="color: #ffc107; font-weight: bold;">Пат! Ничья</span>`;
        } else if (this.gameState.check) {
            const currentSymbol = this.gameState.currentPlayer === 'white' ? '♔' : '♚';
            const currentName = this.gameState.currentPlayer === 'white' ? 'Белые' : 'Черные';
            return `<span style="color: #dc3545; font-weight: bold;">Шах!</span> Ход: <span style="color: var(--accent-primary); font-weight: bold;">${currentName} ${currentSymbol}</span>`;
        } else {
            const currentSymbol = this.gameState.currentPlayer === 'white' ? '♔' : '♚';
            const currentName = this.gameState.currentPlayer === 'white' ? 'Белые' : 'Черные';
            const isYourTurn = this.myColor === this.gameState.currentPlayer;
            const turnText = isYourTurn ? 'Ваш ход' : 'Ход противника';
            const turnIndicator = isYourTurn ? '👉' : '⏳';
            const playerColor = this.gameState.currentPlayer === 'white' ? '#ffffff' : '#1a1a1a';

            return `${turnIndicator} <span style="color: ${playerColor}; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">${currentName} ${currentSymbol}</span> (${turnText})`;
        }
    }

    // Обработка клика по клетке
    handleCellClick(row, col) {
        if (this.gameState.gameOver) return;

        console.log(`Chess: Player clicked [${row},${col}], currentPlayer: ${this.gameState.currentPlayer}, myColor: ${this.myColor}`);

        if (this.myColor !== this.gameState.currentPlayer) {
            console.log('Chess: Invalid action - it\'s not your turn');
            return;
        }

        const cell = this.gameState.board[row][col];

        // Если клетка уже выбрана, отменяем выбор
        if (this.gameState.selectedCell && this.gameState.selectedCell.row === row && this.gameState.selectedCell.col === col) {
            this.gameState.selectedCell = null;
            this.clearHighlights();
            this.render();
            return;
        }

        // Если выбрана фигура текущего игрока
        if (cell && cell[0] === (this.gameState.currentPlayer === 'white' ? 'w' : 'b')) {
            this.gameState.selectedCell = { row, col };
            this.clearHighlights();
            this.highlightValidMoves(row, col);
            this.render();
            return;
        }

        // Если выбрана клетка для хода
        if (this.gameState.selectedCell) {
            const fromRow = this.gameState.selectedCell.row;
            const fromCol = this.gameState.selectedCell.col;

            if (this.isValidMove(fromRow, fromCol, row, col)) {
                console.log(`Chess: Valid move from [${fromRow},${fromCol}] to [${row},${col}]`);

                this.makeMove(fromRow, fromCol, row, col);
                this.updateGameState();
            }
        }
    }

    applyNetworkState(state) {
        if (!state) return;

        if (!this.gameState) {
            this.gameState = {
                board: this.createInitialBoard(),
                currentPlayer: 'white',
                selectedCell: null,
                check: false,
                checkmate: false,
                gameOver: false,
                winner: null,
                lastPawnDoubleMove: null,
                kingMoved: { w: false, b: false },
                rookMoved: { w: { left: false, right: false }, b: { left: false, right: false } }
            };
        }

        if (Array.isArray(state.board)) {
            this.gameState.board = state.board.map(row => Array.isArray(row) ? [...row] : []);
        }

        if (state.players) {
            this.gameState.players = Array.isArray(state.players) ? [...state.players] : state.players;
        }

        if (typeof state.currentPlayer === 'string') {
            this.gameState.currentPlayer = state.currentPlayer;
        }

        this.gameState.selectedCell = state.selectedCell ?? null;

        if (state.lastPawnDoubleMove !== undefined) {
            this.gameState.lastPawnDoubleMove = state.lastPawnDoubleMove;
        }

        if (state.kingMoved) {
            this.gameState.kingMoved = JSON.parse(JSON.stringify(state.kingMoved));
        }

        if (state.rookMoved) {
            this.gameState.rookMoved = JSON.parse(JSON.stringify(state.rookMoved));
        }

        if (state.check !== undefined) {
            this.gameState.check = state.check;
        }

        if (state.checkmate !== undefined) {
            this.gameState.checkmate = state.checkmate;
        }

        if (state.gameOver !== undefined) {
            this.gameState.gameOver = state.gameOver;
        }

        if (state.winner !== undefined) {
            this.gameState.winner = state.winner;
        }

        this.clearHighlights();
        this.setupPlayerSymbols();
        this.render();
    }

    // Совершение хода
    makeMove(fromRow, fromCol, toRow, toCol) {
        if (this.isNetworkGame) {
            this.sendMove({
                from: { row: fromRow, col: fromCol },
                to: { row: toRow, col: toCol }
            });
        } else {
            // Локальный ход
            const movingPiece = this.gameState.board[fromRow][fromCol];
            this.gameState.board[fromRow][fromCol] = '';
            this.gameState.board[toRow][toCol] = movingPiece;
            this.gameState.selectedCell = null;

            // Обновление флагов движения
            if (movingPiece[1] === 'k') {
                this.gameState.kingMoved[movingPiece[0]] = true;

                // Рокировка
                if (Math.abs(toCol - fromCol) === 2) {
                    const kingRow = movingPiece[0] === 'w' ? 7 : 0;
                    if (toCol === 6) { // Короткая
                        this.gameState.board[kingRow][5] = this.gameState.board[kingRow][7];
                        this.gameState.board[kingRow][7] = '';
                        this.gameState.rookMoved[movingPiece[0]].right = true;
                    } else if (toCol === 2) { // Длинная
                        this.gameState.board[kingRow][3] = this.gameState.board[kingRow][0];
                        this.gameState.board[kingRow][0] = '';
                        this.gameState.rookMoved[movingPiece[0]].left = true;
                    }
                }
            } else if (movingPiece[1] === 'r') {
                const color = movingPiece[0];
                if (fromCol === 0) {
                    this.gameState.rookMoved[color].left = true;
                } else if (fromCol === 7) {
                    this.gameState.rookMoved[color].right = true;
                }
            }

            // Обработка специальных ходов
            if (movingPiece[1] === 'p') {
                // Двойной ход пешки
                if (Math.abs(toRow - fromRow) === 2) {
                    this.gameState.lastPawnDoubleMove = { row: toRow, col: toCol };
                } else {
                    this.gameState.lastPawnDoubleMove = null;
                }

                // Взятое на проходе
                if (toCol !== fromCol && !this.gameState.board[toRow][toCol]) {
                    // Удалить пешку противника
                    const capturedRow = movingPiece[0] === 'w' ? toRow + 1 : toRow - 1;
                    this.gameState.board[capturedRow][toCol] = '';
                }

                // Проверка на превращение пешки
                const promotionRow = movingPiece[0] === 'w' ? 0 : 7;
                if (toRow === promotionRow) {
                    this.promotePawn(toRow, toCol);
                }
            } else {
                this.gameState.lastPawnDoubleMove = null;
            }

            this.gameState.currentPlayer = this.gameState.currentPlayer === 'white' ? 'black' : 'white';

            this.clearHighlights(); // Очистить подсветку после хода

            this.render();

            // Если играем с ботом, делаем ход бота
            if (this.currentOpponent?.type === 'bot' && !this.gameState.gameOver) {
                setTimeout(() => {
                    this.makeBotMove();
                }, 1000);
            }
        }
    }

    // Превращение пешки
    promotePawn(row, col) {
        const piece = this.gameState.board[row][col];
        const color = piece[0];
        let newType;

        if (this.currentOpponent?.type === 'bot' && color === (this.gameState.currentPlayer === 'white' ? 'b' : 'w')) {
            // Бот всегда превращает в ферзя
            newType = 'q';
        } else {
            // Диалог выбора для игрока
            const choices = [
                { type: 'q', name: 'Ферзь' },
                { type: 'r', name: 'Ладья' },
                { type: 'b', name: 'Слон' },
                { type: 'n', name: 'Конь' }
            ];

            const choice = prompt('Выберите фигуру для превращения пешки:\n1. Ферзь\n2. Ладья\n3. Слон\n4. Конь', '1');
            const index = parseInt(choice) - 1;
            newType = choices[index] && choices[index].type ? choices[index].type : 'q';
        }

        this.gameState.board[row][col] = color + newType;
    }

    // Обработка сетевого хода
    handleNetworkMove(move) {
        if (!move) {
            console.warn('ChessGame.handleNetworkMove(): received empty move payload');
            return;
        }

        // Если сервер прислал полное состояние игры, применяем его
        if (move.board) {
            this.applyNetworkState(move);
            return;
        }

        const { from, to, promotionType } = move;

        if (!from || !to) {
            console.warn('ChessGame.handleNetworkMove(): invalid move payload', move);
            return;
        }

        if (this.isValidMove(from.row, from.col, to.row, to.col)) {
            const movingPiece = this.gameState.board[from.row][from.col];
            this.gameState.board[from.row][from.col] = '';
            this.gameState.board[to.row][to.col] = movingPiece;
            this.gameState.selectedCell = null;

            // Обновление флагов движения
            if (movingPiece[1] === 'k') {
                this.gameState.kingMoved[movingPiece[0]] = true;

                // Рокировка
                if (Math.abs(to.col - from.col) === 2) {
                    const kingRow = movingPiece[0] === 'w' ? 7 : 0;
                    if (to.col === 6) { // Короткая
                        this.gameState.board[kingRow][5] = this.gameState.board[kingRow][7];
                        this.gameState.board[kingRow][7] = '';
                        this.gameState.rookMoved[movingPiece[0]].right = true;
                    } else if (to.col === 2) { // Длинная
                        this.gameState.board[kingRow][3] = this.gameState.board[kingRow][0];
                        this.gameState.board[kingRow][0] = '';
                        this.gameState.rookMoved[movingPiece[0]].left = true;
                    }
                }
            } else if (movingPiece[1] === 'r') {
                const color = movingPiece[0];
                if (from.col === 0) {
                    this.gameState.rookMoved[color].left = true;
                } else if (from.col === 7) {
                    this.gameState.rookMoved[color].right = true;
                }
            }

            // Обработка специальных ходов
            if (movingPiece[1] === 'p') {
                // Двойной ход пешки
                if (Math.abs(to.row - from.row) === 2) {
                    this.gameState.lastPawnDoubleMove = { row: to.row, col: to.col };
                } else {
                    this.gameState.lastPawnDoubleMove = null;
                }

                // Взятое на проходе
                if (to.col !== from.col && !this.gameState.board[to.row][to.col]) {
                    // Удалить пешку противника
                    const capturedRow = movingPiece[0] === 'w' ? to.row + 1 : to.row - 1;
                    this.gameState.board[capturedRow][to.col] = '';
                }

                // Проверка на превращение пешки
                const promotionRow = movingPiece[0] === 'w' ? 0 : 7;
                if (to.row === promotionRow) {
                    const newType = promotionType || 'q'; // По умолчанию ферзь
                    this.gameState.board[to.row][to.col] = movingPiece[0] + newType;
                }
            } else {
                this.gameState.lastPawnDoubleMove = null;
            }

            this.gameState.currentPlayer = this.gameState.currentPlayer === 'white' ? 'black' : 'white';

            this.clearHighlights(); // Очистить подсветку

            this.render();

            this.updateGameState();

            if (this.gameState.checkmate) {
                const winner = this.gameState.currentPlayer === 'white' ? 'black' : 'white';
                this.endGame(winner);
            }
        }
    }

    // Ход бота
    makeBotMove() {
        if (this.gameState.checkmate) return;

        const botColor = this.gameState.currentPlayer === 'white' ? 'w' : 'b';
        const allMoves = [];

        // Собираем все возможные ходы бота
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const piece = this.gameState.board[row][col];
                if (piece && piece[0] === botColor) {
                    const validMoves = this.generateMovesFor(row, col);
                    validMoves.forEach(move => {
                        allMoves.push({
                            from: { row, col },
                            to: { row: move.row, col: move.col },
                            piece: piece,
                            capturedPiece: this.gameState.board[move.row][move.col]
                        });
                    });
                }
            }
        }

        if (allMoves.length > 0) {
            const bestMove = this.getBestMove(allMoves) || allMoves[Math.floor(Math.random() * allMoves.length)];

            this.gameState.board[bestMove.from.row][bestMove.from.col] = '';
            this.gameState.board[bestMove.to.row][bestMove.to.col] = bestMove.piece;
            this.gameState.selectedCell = null;
            this.gameState.currentPlayer = this.gameState.currentPlayer === 'white' ? 'black' : 'white';

            this.clearHighlights(); // Очистить подсветку

            this.render();

            this.updateGameState();
        }
    }

    // Получение лучшего хода для бота
    getBestMove(moves) {
        // Предпочитаем взятие фигур
        const captureMoves = moves.filter(move => move.capturedPiece && move.capturedPiece !== '');
        if (captureMoves.length > 0) {
            const pieceValues = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 100 };
            captureMoves.sort((a, b) => {
                const valueA = pieceValues[a.capturedPiece[1]] || 0;
                const valueB = pieceValues[b.capturedPiece[1]] || 0;
                return valueB - valueA;
            });
            return captureMoves[0];
        }

        // Предпочитаем ходы к центру
        const centerMoves = moves.filter(move => {
            const centerDistance = Math.abs(move.to.row - 3.5) + Math.abs(move.to.col - 3.5);
            return centerDistance < 3;
        });

        if (centerMoves.length > 0) {
            return centerMoves[Math.floor(Math.random() * centerMoves.length)];
        }

        return null;
    }

    // Очистка выделений
    clearHighlights() {
        this.validMoves = [];
        this.render();
    }

    // Подсветка допустимых ходов
    highlightValidMoves(row, col) {
        this.validMoves = this.generateMovesFor(row, col);
        this.render();
    }

    // Проверка допустимости хода
    isValidMove(fromRow, fromCol, toRow, toCol) {
        const validMoves = this.generateMovesFor(fromRow, fromCol);
        return validMoves.some(move => move.row === toRow && move.col === toCol);
    }

    // Генерация ходов для фигуры
    generateMovesFor(row, col, checkForCheck = true) {
        if (!this.gameState.board || row < 0 || row >= this.boardSize || col < 0 || col >= this.boardSize) {
            return [];
        }

        const piece = this.gameState.board[row][col];
        if (!piece) return [];

        const color = piece[0];
        const type = piece[1];
        let moves = [];

        switch (type) {
            case 'p': // Пешка
                const direction = color === 'w' ? -1 : 1;
                const startRow = color === 'w' ? 6 : 1;

                // Ход вперед
                if (row + direction >= 0 && row + direction < this.boardSize && !this.gameState.board[row + direction][col]) {
                    moves.push({ row: row + direction, col });

                    // Двойной ход с начальной позиции
                    if (row === startRow && !this.gameState.board[row + 2 * direction][col]) {
                        moves.push({ row: row + 2 * direction, col });
                    }
                }

                // Взятие по диагонали
                for (let offset of [-1, 1]) {
                    if (col + offset >= 0 && col + offset < this.boardSize &&
                        this.gameState.board[row + direction] && this.gameState.board[row + direction][col + offset] &&
                        this.gameState.board[row + direction][col + offset][0] !== color) {
                        moves.push({ row: row + direction, col: col + offset });
                    }
                }

                // Взятое на проходе
                if (this.gameState.lastPawnDoubleMove) {
                    const enPassantRow = color === 'w' ? 3 : 4; // Линия, где происходит взятие
                    const enPassantTargetRow = color === 'w' ? 2 : 5; // Куда перемещается
                    if (row === enPassantRow &&
                        (col + 1 === this.gameState.lastPawnDoubleMove.col || col - 1 === this.gameState.lastPawnDoubleMove.col)) {
                        moves.push({ row: enPassantTargetRow, col: this.gameState.lastPawnDoubleMove.col, enPassant: true });
                    }
                }
                break;

            case 'r': // Ладья
                for (let direction of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                    let r = row + direction[0];
                    let c = col + direction[1];

                    while (r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize) {
                        if (!this.gameState.board[r][c]) {
                            moves.push({ row: r, col: c });
                        } else {
                            if (this.gameState.board[r][c][0] !== color) {
                                moves.push({ row: r, col: c });
                            }
                            break;
                        }

                        r += direction[0];
                        c += direction[1];
                    }
                }
                break;

            case 'n': // Конь
                for (let offset of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
                    const r = row + offset[0];
                    const c = col + offset[1];

                    if (r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize &&
                        (!this.gameState.board[r][c] || this.gameState.board[r][c][0] !== color)) {
                        moves.push({ row: r, col: c });
                    }
                }
                break;

            case 'b': // Слон
                for (let direction of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
                    let r = row + direction[0];
                    let c = col + direction[1];

                    while (r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize) {
                        if (!this.gameState.board[r][c]) {
                            moves.push({ row: r, col: c });
                        } else {
                            if (this.gameState.board[r][c][0] !== color) {
                                moves.push({ row: r, col: c });
                            }
                            break;
                        }

                        r += direction[0];
                        c += direction[1];
                    }
                }
                break;

            case 'q': // Ферзь
                for (let direction of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
                    let r = row + direction[0];
                    let c = col + direction[1];

                    while (r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize) {
                        if (!this.gameState.board[r][c]) {
                            moves.push({ row: r, col: c });
                        } else {
                            if (this.gameState.board[r][c][0] !== color) {
                                moves.push({ row: r, col: c });
                            }
                            break;
                        }

                        r += direction[0];
                        c += direction[1];
                    }
                }
                break;

            case 'k': // Король
                for (let offset of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
                    const r = row + offset[0];
                    const c = col + offset[1];

                    if (r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize &&
                        (!this.gameState.board[r][c] || this.gameState.board[r][c][0] !== color)) {
                        moves.push({ row: r, col: c });
                    }
                }

                // Рокировка
                if (!this.gameState.kingMoved[color] && !this.isKingInCheck(color)) {
                    const kingRow = color === 'w' ? 7 : 0;
                    const kingCol = 4;

                    if (row === kingRow && col === kingCol) {
                        // Короткая рокировка
                        if (!this.gameState.rookMoved[color].right &&
                            this.gameState.board[kingRow][7] === color + 'r' &&
                            !this.gameState.board[kingRow][5] &&
                            !this.gameState.board[kingRow][6] &&
                            !this.isSquareAttacked(kingRow, 5, color) &&
                            !this.isSquareAttacked(kingRow, 6, color)) {
                            moves.push({ row: kingRow, col: 6, castling: 'kingside' });
                        }

                        // Длинная рокировка
                        if (!this.gameState.rookMoved[color].left &&
                            this.gameState.board[kingRow][0] === color + 'r' &&
                            !this.gameState.board[kingRow][1] &&
                            !this.gameState.board[kingRow][2] &&
                            !this.gameState.board[kingRow][3] &&
                            !this.isSquareAttacked(kingRow, 2, color) &&
                            !this.isSquareAttacked(kingRow, 3, color)) {
                            moves.push({ row: kingRow, col: 2, castling: 'queenside' });
                        }
                    }
                }
                break;
        }

        // Фильтрация ходов, оставляющих короля под шахом
        if (checkForCheck) {
            moves = moves.filter(move => {
                // Симулируем ход
                const originalPiece = this.gameState.board[row][col];
                const capturedPiece = this.gameState.board[move.row][move.col];
                this.gameState.board[row][col] = '';
                this.gameState.board[move.row][move.col] = originalPiece;

                const inCheck = this.isKingInCheck(color);

                // Откатываем ход
                this.gameState.board[row][col] = originalPiece;
                this.gameState.board[move.row][move.col] = capturedPiece;

                return !inCheck;
            });
        }

        return moves;
    }

    // Проверка на мат (шах и нет возможных ходов)
    isCheckmate(color) {
        if (!this.isKingInCheck(color)) return false;
        return this.getAllPossibleMoves(color).length === 0;
    }

    // Проверка на пат (не шах, но нет возможных ходов)
    isStalemate(color) {
        if (this.isKingInCheck(color)) return false;
        return this.getAllPossibleMoves(color).length === 0;
    }

    // Обновление состояния игры после хода
    updateGameState() {
        const currentColor = this.gameState.currentPlayer === 'white' ? 'w' : 'b';
        const opponentColor = currentColor === 'w' ? 'b' : 'w';

        this.gameState.check = this.isKingInCheck(opponentColor);
        this.gameState.checkmate = this.isCheckmate(opponentColor);
        this.gameState.stalemate = this.isStalemate(opponentColor);

        if (this.gameState.checkmate || this.gameState.stalemate) {
            this.gameState.gameOver = true;
            if (this.gameState.checkmate) {
                this.gameState.winner = this.gameState.currentPlayer;
            } else {
                this.gameState.winner = 'draw';
            }
            // Завершить игру
            this.endGame(this.gameState.winner);
        }
    }

    // Проверка, находится ли король цвета под шахом
    isKingInCheck(color) {
        const kingPos = this.findKing(color);
        if (!kingPos) return false;

        const opponentColor = color === 'w' ? 'b' : 'w';

        // Проверяем, атакуют ли фигуры противника короля
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const piece = this.gameState.board[row][col];
                if (piece && piece[0] === opponentColor) {
                    // Для короля противника проверяем соседние клетки напрямую
                    if (piece[1] === 'k') {
                        const dr = Math.abs(row - kingPos.row);
                        const dc = Math.abs(col - kingPos.col);
                        if (dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0)) {
                            return true;
                        }
                    } else {
                        const moves = this.generateMovesFor(row, col, false); // Без фильтрации
                        if (moves.some(move => move.row === kingPos.row && move.col === kingPos.col)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    // Проверка, атакована ли клетка цветом противника
    isSquareAttacked(row, col, color) {
        const opponentColor = color === 'w' ? 'b' : 'w';

        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                const piece = this.gameState.board[r][c];
                if (piece && piece[0] === opponentColor) {
                    // Для короля противника проверяем соседние клетки напрямую
                    if (piece[1] === 'k') {
                        const dr = Math.abs(r - row);
                        const dc = Math.abs(c - col);
                        if (dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0)) {
                            return true;
                        }
                    } else {
                        const moves = this.generateMovesFor(r, c, false); // Без фильтрации
                        if (moves.some(move => move.row === row && move.col === col)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    // Поиск позиции короля цвета
    findKing(color) {
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const piece = this.gameState.board[row][col];
                if (piece === color + 'k') {
                    return { row, col };
                }
            }
        }
        return null;
    }

    // Получение всех возможных ходов для игрока (с учетом шаха)
    getAllPossibleMoves(color, checkForCheck = true) {
        const moves = [];
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const piece = this.gameState.board[row][col];
                if (piece && piece[0] === color) {
                    const pieceMoves = this.generateMovesFor(row, col, checkForCheck);
                    pieceMoves.forEach(move => {
                        moves.push({
                            from: { row, col },
                            to: move
                        });
                    });
                }
            }
        }
        return moves;
    }

    // Обновление статуса шахмат
    updateChessStatus() {
        const statusElement = this.container.querySelector('.chess-status');
        if (statusElement) {
            statusElement.innerHTML = this.getStatusText();
        }
    }
}

// Экспорт класса для ES6 модулей
export { ChessGame };

// Экспорт класса в глобальную область
window.ChessGame = ChessGame;
