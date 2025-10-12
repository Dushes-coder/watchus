// ===== GAME AI =====

// Расширенная система ИИ для игр
class GameAI {
    constructor() {
        this.difficultyLevels = {
            easy: { randomFactor: 0.7, depth: 1 },
            medium: { randomFactor: 0.4, depth: 2 },
            hard: { randomFactor: 0.1, depth: 3 }
        };
        this.currentDifficulty = 'medium';
    }

    // Установка уровня сложности
    setDifficulty(level) {
        if (this.difficultyLevels[level]) {
            this.currentDifficulty = level;
        }
    }

    // TicTacToe ИИ с минимакс алгоритмом
    getTicTacToeMove(board, player, difficulty = null) {
        const diff = difficulty || this.currentDifficulty;
        const settings = this.difficultyLevels[diff];

        // Для легкого уровня часто делаем случайные ходы
        if (Math.random() < settings.randomFactor) {
            return this.getRandomMove(board);
        }

        // Используем минимакс для оптимального хода
        const bestMove = this.minimaxTicTacToe(board, player, settings.depth, true);
        return bestMove.index;
    }

    // Минимакс для TicTacToe
    minimaxTicTacToe(board, player, depth, isMaximizing) {
        const winner = this.checkTicTacToeWinner(board);

        // Терминальные состояния
        if (winner === 'X') return { score: 10 };
        if (winner === 'O') return { score: -10 };
        if (this.isBoardFull(board)) return { score: 0 };

        if (depth === 0) return { score: 0 };

        const moves = [];
        const opponent = player === 'X' ? 'O' : 'X';

        for (let i = 0; i < 9; i++) {
            if (board[Math.floor(i / 3)][i % 3] === '') {
                const newBoard = board.map(row => [...row]);
                newBoard[Math.floor(i / 3)][i % 3] = player;

                const result = this.minimaxTicTacToe(newBoard, opponent, depth - 1, !isMaximizing);
                moves.push({
                    index: i,
                    score: result.score
                });
            }
        }

        let bestMove;
        if (isMaximizing) {
            let maxScore = -Infinity;
            moves.forEach(move => {
                if (move.score > maxScore) {
                    maxScore = move.score;
                    bestMove = move;
                }
            });
        } else {
            let minScore = Infinity;
            moves.forEach(move => {
                if (move.score < minScore) {
                    minScore = move.score;
                    bestMove = move;
                }
            });
        }

        return bestMove;
    }

    // Проверка победителя в TicTacToe
    checkTicTacToeWinner(board) {
        const lines = [
            // Горизонтали
            [board[0][0], board[0][1], board[0][2]],
            [board[1][0], board[1][1], board[1][2]],
            [board[2][0], board[2][1], board[2][2]],
            // Вертикали
            [board[0][0], board[1][0], board[2][0]],
            [board[0][1], board[1][1], board[2][1]],
            [board[0][2], board[1][2], board[2][2]],
            // Диагонали
            [board[0][0], board[1][1], board[2][2]],
            [board[0][2], board[1][1], board[2][0]]
        ];

        for (let line of lines) {
            if (line[0] && line[0] === line[1] && line[0] === line[2]) {
                return line[0];
            }
        }

        return null;
    }

    // Проверка заполненности доски
    isBoardFull(board) {
        return board.every(row => row.every(cell => cell !== ''));
    }

    // Случайный ход
    getRandomMove(board) {
        const availableMoves = [];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (board[i][j] === '') {
                    availableMoves.push(i * 3 + j);
                }
            }
        }
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    // Chess ИИ с оценкой позиции
    getChessMove(board, currentPlayer, difficulty = null) {
        const diff = difficulty || this.currentDifficulty;
        const settings = this.difficultyLevels[diff];

        // Получаем все возможные ходы
        const allMoves = this.getAllChessMoves(board, currentPlayer);

        if (allMoves.length === 0) return null;

        // Для легкого уровня часто выбираем случайный ход
        if (Math.random() < settings.randomFactor) {
            return allMoves[Math.floor(Math.random() * allMoves.length)];
        }

        // Оцениваем все ходы и выбираем лучший
        let bestMove = null;
        let bestScore = -Infinity;

        for (let move of allMoves) {
            const score = this.evaluateChessMove(board, move, currentPlayer);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    // Получение всех возможных ходов в шахматах
    getAllChessMoves(board, player) {
        const moves = [];
        const color = player === 'white' ? 'w' : 'b';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece && piece[0] === color) {
                    const pieceMoves = this.generateChessMovesFor(board, row, col);
                    pieceMoves.forEach(move => {
                        moves.push({
                            from: { row, col },
                            to: { row: move.row, col: move.col },
                            piece: piece
                        });
                    });
                }
            }
        }

        return moves;
    }

    // Генерация ходов для шахматной фигуры
    generateChessMovesFor(board, row, col) {
        const piece = board[row][col];
        if (!piece) return [];

        const color = piece[0];
        const type = piece[1];
        const moves = [];

        switch (type) {
            case 'p': // Пешка
                const direction = color === 'w' ? -1 : 1;
                const startRow = color === 'w' ? 6 : 1;

                // Ход вперед
                if (row + direction >= 0 && row + direction < 8 && !board[row + direction][col]) {
                    moves.push({ row: row + direction, col });

                    // Двойной ход с начальной позиции
                    if (row === startRow && !board[row + 2 * direction][col]) {
                        moves.push({ row: row + 2 * direction, col });
                    }
                }

                // Взятие по диагонали
                for (let offset of [-1, 1]) {
                    if (col + offset >= 0 && col + offset < 8 &&
                        board[row + direction][col + offset] &&
                        board[row + direction][col + offset][0] !== color) {
                        moves.push({ row: row + direction, col: col + offset });
                    }
                }
                break;

            case 'r': // Ладья
                for (let direction of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                    let r = row + direction[0];
                    let c = col + direction[1];

                    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                        if (!board[r][c]) {
                            moves.push({ row: r, col: c });
                        } else {
                            if (board[r][c][0] !== color) {
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

                    if (r >= 0 && r < 8 && c >= 0 && c < 8 &&
                        (!board[r][c] || board[r][c][0] !== color)) {
                        moves.push({ row: r, col: c });
                    }
                }
                break;

            case 'b': // Слон
                for (let direction of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
                    let r = row + direction[0];
                    let c = col + direction[1];

                    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                        if (!board[r][c]) {
                            moves.push({ row: r, col: c });
                        } else {
                            if (board[r][c][0] !== color) {
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

                    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                        if (!board[r][c]) {
                            moves.push({ row: r, col: c });
                        } else {
                            if (board[r][c][0] !== color) {
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

                    if (r >= 0 && r < 8 && c >= 0 && c < 8 &&
                        (!board[r][c] || board[r][c][0] !== color)) {
                        moves.push({ row: r, col: c });
                    }
                }
                break;
        }

        return moves;
    }

    // Оценка шахматного хода
    evaluateChessMove(board, move, player) {
        let score = 0;

        // Создаем копию доски для симуляции хода
        const newBoard = board.map(row => [...row]);
        const movingPiece = newBoard[move.from.row][move.from.col];
        const capturedPiece = newBoard[move.to.row][move.to.col];

        newBoard[move.from.row][move.from.col] = '';
        newBoard[move.to.row][move.to.col] = movingPiece;

        // Оценка захваченной фигуры
        if (capturedPiece) {
            score += this.getPieceValue(capturedPiece[1]) * 10;
        }

        // Оценка позиции фигуры (центр доски предпочтительнее)
        const centerDistance = Math.abs(move.to.row - 3.5) + Math.abs(move.to.col - 3.5);
        score += (7 - centerDistance) * 2;

        // Оценка развития (фигуры должны выходить из начальной позиции)
        if (this.isPieceDeveloped(movingPiece[1], move.from)) {
            score += 3;
        }

        return score;
    }

    // Получение стоимости шахматной фигуры
    getPieceValue(pieceType) {
        const values = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 100 };
        return values[pieceType] || 0;
    }

    // Проверка развития фигуры
    isPieceDeveloped(pieceType, from) {
        // Пешки развиваются вперед
        if (pieceType === 'p') {
            return from.row !== 1 && from.row !== 6;
        }
        // Другие фигуры развиваются от краев
        return from.col !== 0 && from.col !== 7;
    }

    // Poker ИИ - выбор карт для обмена
    getPokerExchangeDecision(hand, difficulty = null) {
        const diff = difficulty || this.currentDifficulty;
        const settings = this.difficultyLevels[diff];

        // Получаем комбинацию
        const combination = this.getPokerCombination(hand);

        // Легкий бот часто меняет карты случайно
        if (diff === 'easy') {
            const cardsToExchange = Math.floor(Math.random() * 4); // 0-3 карты
            return this.selectRandomCards(hand, cardsToExchange);
        }

        // Средний и сложный бот анализируют комбинацию
        if (combination.rank >= 2) {
            // Хорошая комбинация - меняем максимум 1 карту
            return Math.random() < 0.3 ? [Math.floor(Math.random() * 5)] : [];
        } else {
            // Плохая комбинация - меняем 2-3 карты
            return this.selectCardsToExchange(hand, 2 + Math.floor(Math.random() * 2));
        }
    }

    // Выбор карт для обмена
    selectCardsToExchange(hand, count) {
        // Сортируем карты по силе (слабые вперед)
        const sortedIndices = hand
            .map((card, index) => ({ card, index, power: this.getCardPower(card) }))
            .sort((a, b) => a.power - b.power)
            .slice(0, count)
            .map(item => item.index);

        return sortedIndices;
    }

    // Выбор случайных карт
    selectRandomCards(hand, count) {
        const indices = Array.from({length: hand.length}, (_, i) => i);
        const selected = [];

        for (let i = 0; i < count && indices.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * indices.length);
            selected.push(indices[randomIndex]);
            indices.splice(randomIndex, 1);
        }

        return selected;
    }

    // Получение покерной комбинации
    getPokerCombination(hand) {
        const values = hand.map(card => this.getCardPower(card.value)).sort((a, b) => a - b);
        const suits = hand.map(card => card.suit);

        const isFlush = suits.every(suit => suit === suits[0]);
        const isStraight = values.every((val, i) => i === 0 || val === values[i-1] + 1);

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

    // Получение силы карты
    getCardPower(value) {
        const powers = { '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
        return powers[value] || 0;
    }

    // Durak ИИ - уже реализован в DurakGame классе через DurakBotAnalyzer
    // Здесь можно добавить дополнительные улучшения

    getDurakMove(gameState, difficulty = null) {
        const diff = difficulty || this.currentDifficulty;
        const analyzer = window.durakAnalyzer;

        if (!analyzer) return null;

        // Анализируем состояние игры
        const analysis = analyzer.analyzeGameState(gameState);

        // Возвращаем лучший ход в зависимости от фазы
        if (gameState.gamePhase === 'attack') {
            return analyzer.getBestAttackCard();
        } else if (gameState.gamePhase === 'defend') {
            const undefendedCards = analysis.undefendedCards;
            if (undefendedCards.length > 0) {
                return analyzer.getBestDefenseCard(undefendedCards[0]);
            }
        }

        return null;
    }
}

// Экспорт класса для ES6 модулей
export { GameAI };

// Экспорт класса в глобальную область
window.GameAI = GameAI;
