const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Улучшенная конфигурация CORS для продакшена
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Разрешаем все источники для продакшена
            callback(null, true);
        },
        methods: ["GET", "POST"],
        credentials: true,
        transports: ['websocket', 'polling']
    },
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
});

// Middleware для CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Добавляем middleware для JSON парсинга
app.use(express.json());

// Health check endpoint для мониторинга
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        rooms: Array.from(roomStates.keys()).length,
        games: Array.from(gameStates.keys()).length
    });
});

// Простая маршрутизация: / -> интерфейс создания комнаты
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Храним простое состояние комнаты в памяти: { url, time, playing }
const roomStates = new Map();

// Храним состояние игр для каждой комнаты: { gameType, gameState, players }
const gameStates = new Map();
const fs = require('fs');
const gameStatesFile = path.join(__dirname, 'gameStates.json');

// Функция для сохранения gameStates
function saveGameStates() {
	try {
		const data = {};
		for (const [roomId, gameState] of gameStates) {
			data[roomId] = gameState;
		}
		fs.writeFileSync(path.join(__dirname, 'gameStates.json'), JSON.stringify(data, null, 2));
	} catch (e) {
		console.log('Error saving gameStates:', e);
	}
}

// Функция для загрузки gameStates
function loadGameStates() {
	try {
		if (fs.existsSync(gameStatesFile)) {
			const savedStates = fs.readFileSync(gameStatesFile, 'utf8');
			const loadedStates = JSON.parse(savedStates);
			
			// Фильтруем только полные gameStates
			gameStates.clear();
			for (const [roomId, gameState] of Object.entries(loadedStates)) {
				if (gameState.gamePhase && gameState.players && gameState.deck && gameState.player1Hand && gameState.player2Hand !== undefined) {
					gameStates.set(roomId, gameState);
					console.log(`Loaded complete gameState for room ${roomId}`);
				} else {
					console.log(`Skipped incomplete gameState for room ${roomId}`);
				}
			}
			
			console.log('Loaded saved game states:', Array.from(gameStates.keys()));
		} else {
			console.log('No saved game states found, starting fresh');
		}
	} catch (error) {
		console.log('Error loading gameStates:', error);
	}
}

// Загружаем gameStates при запуске
loadGameStates();

io.on('connection', (socket) => {
	console.log('New client connected:', socket.id);
	
	// Отправляем пинг каждые 25 секунд
	const pingInterval = setInterval(() => {
		socket.emit('ping', { time: Date.now() });
	}, 25000);

	// Ожидаем понга от клиента
	socket.on('pong', (data) => {
		console.log('Pong received from', socket.id, 'latency:', Date.now() - data.time, 'ms');
	});

	socket.on('disconnect', () => {
		console.log('Client disconnected:', socket.id);
		clearInterval(pingInterval);
	});

	socket.on('join-room', ({ roomId, userEmoji }) => {
		socket.join(roomId);
		console.log(socket.id, 'joined', roomId);
		
		// Сохраняем эмодзи пользователя
		socket.userEmoji = userEmoji || '👤';
		
		// отправляем текущее состояние комнаты, если есть
		const state = roomStates.get(roomId) || null;
		socket.emit('room-state', { state });
		
		// отправляем текущее состояние игры, если есть
		const gameState = gameStates.get(roomId);
		if (gameState) {
			socket.emit('game-state', gameState);
		}

		// отправляем список игроков в комнате
		sendRoomPlayers(roomId);
	});

	// Обработчик запроса списка игроков в комнате
	socket.on('get-room-players', ({ roomId }) => {
		sendRoomPlayers(roomId);
	});

	// Синхронизирующие события: play, pause, seek, load
	socket.on('player-event', ({ roomId, type, data }) => {
		// обновляем состояние комнаты для новых участников
		let state = roomStates.get(roomId) || { url: null, time: 0, playing: false };
		if (type === 'load') {
			state.url = data.url || null;
			state.time = data.time || 0;
			state.playing = false;
			roomStates.set(roomId, state);
		} else if (type === 'play') {
			state.time = data.time || state.time;
			state.playing = true;
			roomStates.set(roomId, state);
		} else if (type === 'pause') {
			state.time = data.time || state.time;
			state.playing = false;
			roomStates.set(roomId, state);
		} else if (type === 'seek') {
			state.time = data.time || state.time;
			roomStates.set(roomId, state);
		}

		// ретранслируем всем кроме отправителя
		socket.to(roomId).emit('player-event', { type, data });
	});

	// Загрузка / смена видео (альтернатива через player-event type: 'load')
	socket.on('load-video', ({ roomId, url }) => {
		const state = { url, time: 0, playing: false };
		roomStates.set(roomId, state);
		io.in(roomId).emit('player-event', { type: 'load', data: { url, time: 0 } });
	});

	// Простой чат — ретранслируем всем в комнате
	socket.on('chat-message', ({ roomId, author, message }) => {
		io.in(roomId).emit('chat-message', { author, message, time: Date.now() });
	});

	// === ИГРОВЫЕ СОБЫТИЯ ===
	
	// Отправка приглашения в игру
	socket.on('send-game-invitation', ({ roomId, targetPlayerId, gameType, senderName }) => {
		console.log(`Game invitation sent: ${gameType} from ${socket.id} to ${targetPlayerId} in room ${roomId}`);

		// Проверяем, что targetPlayerId является валидным socket.id
		const targetSocket = io.sockets.sockets.get(targetPlayerId);
		if (targetSocket) {
			// Отправляем приглашение целевому игроку
			socket.to(targetPlayerId).emit('game-invitation', {
				gameType: gameType,
				senderId: socket.id,
				senderName: senderName || 'Игрок',
				senderEmoji: socket.userEmoji || '👤'
			});
			console.log(`Invitation sent to ${targetPlayerId}`);
		} else {
			console.log(`Target player ${targetPlayerId} not found or not connected`);
		}
	});
	
	// Обработка ответа на приглашение
socket.on('game-invitation-response', ({ accepted, gameType, senderId, responderName }) => {
	console.log(`game-invitation-response received: accepted=${accepted}, gameType=${gameType}, senderId=${senderId}, responderId=${socket.id}`);
	
	if (accepted) {
		// Находим комнату отправителя
		const rooms = io.sockets.adapter.rooms;
		let roomId = null;
		for (const [rId, room] of rooms) {
			if (room.has(senderId)) {
				roomId = rId;
				break;
			}
		}
		
		if (roomId) {
			console.log(`Found room ${roomId} for invitation response`);
			// Добавляем отвечающего в комнату
			socket.join(roomId);
			sendRoomPlayers(roomId);
			
			// Запускаем сетевую игру
			const players = [senderId, socket.id];
			console.log(`Starting network game ${gameType} with players:`, players);
			startNetworkGame(roomId, gameType, players, responderName);
		} else {
			console.log(`No room found for sender ${senderId}`);
		}
	}
});
	
	// Начало новой игры
	socket.on('game-start', ({ roomId, gameType }) => {
		console.log(`Game started: ${gameType} in room ${roomId}`);
		let initialState = null;
		
		if (gameType === 'chess') {
			initialState = {
				gameType: 'chess',
				board: [
					['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
					['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
					['', '', '', '', '', '', '', ''],
					['', '', '', '', '', '', '', ''],
					['', '', '', '', '', '', '', ''],
					['', '', '', '', '', '', '', ''],
					['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
					['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
				],
				currentPlayer: 'white',
				selectedCell: null
			};
		} else if (gameType === 'tictactoe') {
			initialState = {
				gameType: 'tictactoe',
				board: [['', '', ''], ['', '', ''], ['', '', '']],
				currentPlayer: 'X',
				gameOver: false,
				winner: null
			};
		} else if (gameType === 'cards') {
			// Создаём колоду
			const suits = ['♠', '♥', '♦', '♣'];
			const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
			const deck = [];
			for (let suit of suits) {
				for (let value of values) {
					deck.push({ suit, value });
				}
			}
			// Перемешиваем
			for (let i = deck.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[deck[i], deck[j]] = [deck[j], deck[i]];
			}
			// Раздаём карты
			const player1Hand = [];
			const player2Hand = [];
			for (let i = 0; i < 6; i++) {
				player1Hand.push(deck.pop());
				player2Hand.push(deck.pop());
			}
			initialState = {
				gameType: 'cards',
				deck: deck,
				player1Hand: player1Hand,
				player2Hand: player2Hand,
				tableCards: [],
				currentPlayer: 'player1',
				trumpCard: deck.length > 0 ? deck[0] : null
			};
		}
		
		if (initialState) {
			gameStates.set(roomId, initialState);
			io.in(roomId).emit('game-state', initialState);
		}
	});
	
	// Ход в игре
	socket.on('game-move', ({ roomId, gameType, move }) => {
		console.log(`game-move received from socket ${socket.id}: roomId=${roomId}, gameType=${gameType}, move=`, JSON.stringify(move));
		console.log(`Game states has room ${roomId}:`, gameStates.has(roomId));
		console.log('Available rooms:', Array.from(gameStates.keys()));
		
		if (!gameStates.has(roomId)) {
			console.log(`No game state for room ${roomId}`);
			return;
		}
		
		let gameState = gameStates.get(roomId);
		if (!gameState) {
			console.log(`Game state is null for room ${roomId}, cannot process move`);
			return;
		}
		if (gameType === 'chess') {
			// Применяем ход
			const { from, to } = move;
			
			// Определяем цвет игрока, делающего ход
			const currentPlayerColor = gameState.currentPlayer; // 'white' или 'black'
			const movingPiece = gameState.board[from.row][from.col];
			
			// Проверяем, что фигура принадлежит текущему игроку
			const expectedPieceColor = currentPlayerColor === 'white' ? 'w' : 'b';
			if (!movingPiece || movingPiece[0] !== expectedPieceColor) {
				console.log(`Chess: Invalid move - player ${socket.id} tried to move ${movingPiece} but it's ${currentPlayerColor}'s turn`);
				return;
			}
			
			console.log(`Chess: Valid move - ${currentPlayerColor} moves ${movingPiece} from [${from.row},${from.col}] to [${to.row},${to.col}]`);
			
			// Применяем ход (валидация происходит на клиенте)
			gameState.board[from.row][from.col] = '';
			gameState.board[to.row][to.col] = movingPiece;
			gameState.selectedCell = null;
			gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';

			// Проверяем мат
			// (упрощенная проверка - в реальности нужна более сложная логика)
			if (gameState.checkmate) {
				const winner = gameState.currentPlayer === 'white' ? 'black' : 'white';
				socket.to(roomId).emit('game-ended', {
					winner: winner,
					gameType: 'chess'
				});
			}
		} else if (gameType === 'tictactoe') {
			// Применяем ход
			if (move.type === 'restart') {
				// Рестарт игры
				console.log(`TicTacToe: Game restart initiated by player ${socket.id}`);
				gameState.board = move.board;
				gameState.currentPlayer = move.currentPlayer;
				gameState.gameOver = move.gameOver;
				gameState.winner = move.winner;
			} else {
				// Обычный ход
				const { row, col, player } = move;
				
				console.log(`TicTacToe: Processing move from ${socket.id}:`, { row, col, player });
				console.log(`TicTacToe: Current game state:`, {
					currentPlayer: gameState.currentPlayer,
					board: gameState.board,
					gameOver: gameState.gameOver
				});
				
				// Проверяем право на ход
				if (player !== gameState.currentPlayer) {
					console.log(`TicTacToe: Invalid move - player ${player} tried to move but it's ${gameState.currentPlayer}'s turn`);
					return;
				}
				
				console.log(`TicTacToe: Valid move - player ${player} moves at [${row},${col}]`);
				
				if (gameState.board[row][col] === '' && !gameState.gameOver) {
					gameState.board[row][col] = player;
					gameState.currentPlayer = player === 'X' ? 'O' : 'X';
					// Проверка победителя
					const winner = checkTicTacToeWinner(gameState.board);
					if (winner) {
						gameState.gameOver = true;
						gameState.winner = winner;
						console.log(`TicTacToe: Game over - winner: ${winner}`);
						
						// Отправляем событие окончания игры
						io.in(roomId).emit('game-ended', {
							winner: winner,
							gameType: 'tictactoe'
						});
					}
					
					console.log(`TicTacToe: Updated game state:`, {
						currentPlayer: gameState.currentPlayer,
						board: gameState.board,
						gameOver: gameState.gameOver,
						winner: gameState.winner
					});
				} else {
					console.log(`TicTacToe: Invalid move - cell occupied or game over`);
				}
			}
		} else if (gameType === 'cards') {
			// Применяем ход
			const { action, card, player } = move;
			if (action === 'play' && player === gameState.currentPlayer) {
				const hand = player === 'player1' ? gameState.player1Hand : gameState.player2Hand;
				const cardIndex = hand.findIndex(c => c.suit === card.suit && c.value === card.value);
				if (cardIndex !== -1) {
					hand.splice(cardIndex, 1);
					gameState.tableCards.push(card);
					gameState.currentPlayer = player === 'player1' ? 'player2' : 'player1';
				}
			} else if (action === 'deal') {
				// Раздать новые карты
				if (gameState.deck.length >= 2) {
					if (gameState.player1Hand.length < 6 && gameState.deck.length > 0) {
						gameState.player1Hand.push(gameState.deck.pop());
					}
					if (gameState.player2Hand.length < 6 && gameState.deck.length > 0) {
						gameState.player2Hand.push(gameState.deck.pop());
					}
				}
			}
		} else if (gameType === 'durak') {
			// Обработка ходов в дураке
			const { action, card, playerId } = move;
			
			// Определяем, какой игрок делает ход
			const playerRole = gameState.players[0] === playerId ? 'player1' : 'player2';
			console.log(`Durak: Player ${playerId} (${playerRole}) action: ${action}, card:`, card ? card.value + card.suit : 'none');
			console.log(`Durak: Before move - phase: ${gameState.gamePhase}, attacker: ${gameState.currentAttacker}, deck: ${gameState.deck.length} cards`);
			
			if (action === 'play') {
				if (playerRole === gameState.currentAttacker) {
					// Атака
					const hand = playerRole === 'player1' ? gameState.player1Hand : gameState.player2Hand;
					const cardIndex = hand.findIndex(c => c.suit === card.suit && c.value === card.value);
					if (cardIndex !== -1) {
						hand.splice(cardIndex, 1);
						gameState.attackingCards.push(card);
						gameState.gamePhase = 'defend';
						console.log(`Durak: ${playerRole} attacked with ${card.value}${card.suit}`);
					}
				} else if (gameState.gamePhase === 'defend' && playerRole !== gameState.currentAttacker) {
					// Подкидывание
					const allDefended = gameState.attackingCards.every((_, i) => gameState.defendingCards[i]);
					if (allDefended) {
						const hand = playerRole === 'player1' ? gameState.player1Hand : gameState.player2Hand;
						const cardIndex = hand.findIndex(c => c.suit === card.suit && c.value === card.value);
						if (cardIndex !== -1) {
							hand.splice(cardIndex, 1);
							gameState.attackingCards.push(card);
							gameState.gamePhase = 'defend';
							console.log(`Durak: ${playerRole} threw ${card.value}${card.suit}`);
						}
					}
				}
			} else if (action === 'defend' && card) {
				if (gameState.gamePhase === 'defend' && playerRole !== gameState.currentAttacker) {
					const hand = playerRole === 'player1' ? gameState.player1Hand : gameState.player2Hand;
					const cardIndex = hand.findIndex(c => c.suit === card.suit && c.value === card.value);
					if (cardIndex !== -1) {
						const undefendedIndex = gameState.attackingCards.findIndex((_, i) => !gameState.defendingCards[i]);
						gameState.defendingCards[undefendedIndex] = card;
						hand.splice(cardIndex, 1);
						
						// Проверяем, все ли карты отбиты
						const allDefended = gameState.attackingCards.every((_, i) => gameState.defendingCards[i]);
						if (!allDefended) {
							// Продолжаем защиту
							console.log(`Durak: ${playerRole} defended with ${card.value}${card.suit}, continuing defense`);
						} else {
							// Можно подкидывать
							gameState.gamePhase = 'attack';
							console.log(`Durak: ${playerRole} defended with ${card.value}${card.suit}, all defended`);
						}
					}
				}
			} else if (action === 'take') {
				if (gameState.gamePhase === 'defend' && playerRole !== gameState.currentAttacker) {
					console.log(`Durak: ${playerRole} takes cards, currentAttacker was: ${gameState.currentAttacker}`);
					const hand = playerRole === 'player1' ? gameState.player1Hand : gameState.player2Hand;
					hand.push(...gameState.attackingCards);
					hand.push(...gameState.defendingCards);
					gameState.attackingCards = [];
					gameState.defendingCards = [];
					gameState.gamePhase = 'attack';
					// Атакующий остается тем же
					console.log(`Durak: ${playerRole} takes cards, attacker remains: ${gameState.currentAttacker}`);
					
					// Пополняем руки
					while (hand.length < 6 && gameState.deck.length > 0) {
						hand.push(gameState.deck.pop());
					}
					const otherHand = playerRole === 'player1' ? gameState.player2Hand : gameState.player1Hand;
					while (otherHand.length < 6 && gameState.deck.length > 0) {
						otherHand.push(gameState.deck.pop());
					}
					console.log(`Durak: ${playerRole} took all cards, attacker remains: ${gameState.currentAttacker}, deck: ${gameState.deck.length}`);
				}
			} else if (action === 'pass') {
				if (gameState.gamePhase === 'attack' || 
					(gameState.gamePhase === 'defend' && playerRole === gameState.currentAttacker)) {
					// Завершаем раунд
					console.log(`Durak: ${playerRole} passes, currentAttacker was: ${gameState.currentAttacker}`);
					gameState.attackingCards = [];
					gameState.defendingCards = [];
					gameState.currentAttacker = playerRole === 'player1' ? 'player2' : 'player1';
					gameState.gamePhase = 'attack';
					console.log(`Durak: ${playerRole} passed, new attacker: ${gameState.currentAttacker}`);
					
					// Пополняем руки
					const hand1 = gameState.player1Hand;
					const hand2 = gameState.player2Hand;
					while (hand1.length < 6 && gameState.deck.length > 0) {
						hand1.push(gameState.deck.pop());
					}
					while (hand2.length < 6 && gameState.deck.length > 0) {
						hand2.push(gameState.deck.pop());
					}
					console.log(`Durak: ${playerRole} passed, round finished, new attacker: ${gameState.currentAttacker}, deck: ${gameState.deck.length} cards`);
				}
			}
			console.log(`Durak: After move - phase: ${gameState.gamePhase}, attacker: ${gameState.currentAttacker}, deck: ${gameState.deck.length}, attacking: ${gameState.attackingCards.length}, defending: ${gameState.defendingCards.length}`);
		} else if (gameType === 'poker') {
			// Обработка ходов в покере
			const { action, card, playerId } = move;
			
			// Определяем, какой игрок делает ход
			const playerRole = gameState.players[0] === playerId ? 'player1' : 'player2';
			const isCurrentPlayer = playerRole === 'player1' ? true : false;
			
			if (action === 'discard') {
				// Обработка обмена карт
				if (isCurrentPlayer) {
					// Текущий игрок обменял карту
					if (card) {
						const index = gameState.player1Hand.findIndex(c =>
							c.suit === card.suit && c.value === card.value
						);
						if (index !== -1) {
							gameState.player1Hand.splice(index, 1);
							if (gameState.deck.length > 0) {
								gameState.player1Hand.push(gameState.deck.pop());
							}
						}
					}
				} else {
					// Противник обменял карту
					if (card) {
						const index = gameState.player2Hand.findIndex(c =>
							c.suit === card.suit && c.value === card.value
						);
						if (index !== -1) {
							gameState.player2Hand.splice(index, 1);
							if (gameState.deck.length > 0) {
								gameState.player2Hand.push(gameState.deck.pop());
							}
						}
					}
				}
				console.log(`Poker: Player ${playerId} discarded card`);

			} else if (action === 'finish') {
				// Завершение раунда - сравнение рук
				gameState.gamePhase = 'finished';
				// Определяем победителя (упрощенная логика)
				const hand1 = gameState.player1Hand;
				const hand2 = gameState.player2Hand;
				
				// Простая оценка: кто имеет старшую карту
				const getHandValue = (hand) => {
					return Math.max(...hand.map(card => ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(card.value)));
				};
				
				const value1 = getHandValue(hand1);
				const value2 = getHandValue(hand2);
				
				if (value1 > value2) {
					gameState.winner = 'player1';
				} else if (value2 > value1) {
					gameState.winner = 'player2';
				} else {
					gameState.winner = 'draw';
				}
				console.log(`Poker: Round finished, winner: ${gameState.winner}`);

			} else if (action === 'new-game') {
				// Начать новую игру
				console.log(`Poker: Starting new game for room ${roomId}, current gameState:`, gameState);
				const newInitialState = {
					gameType: 'poker',
					deck: [],
					player1Hand: [],
					player2Hand: [],
					gamePhase: 'discard',
					winner: null,
					players: gameState.players,
					gameStarted: true
				};
				
				// Создаём колоду для покера
				const suits = ['♠', '♥', '♦', '♣'];
				const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
				for (let suit of suits) {
					for (let value of values) {
						const power = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(value) + 2;
						newInitialState.deck.push({ suit, value, power });
					}
				}
				// Перемешиваем
				for (let i = newInitialState.deck.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[newInitialState.deck[i], newInitialState.deck[j]] = [newInitialState.deck[j], newInitialState.deck[i]];
				}
				// Раздаём по 5 карт каждому
				for (let i = 0; i < 5; i++) {
					newInitialState.player1Hand.push(newInitialState.deck.pop());
					newInitialState.player2Hand.push(newInitialState.deck.pop());
				}
				
				gameStates.set(roomId, newInitialState);
				console.log(`Poker: New game state created:`, newInitialState);
				console.log(`Poker: Emitting new game state to room ${roomId}`);
				console.log(`New game state payload:`, {
					gamePhase: newInitialState.gamePhase,
					player1Hand: newInitialState.player1Hand.map(c => c.value + c.suit),
					player2Hand: newInitialState.player2Hand.map(c => c.value + c.suit),
					players: newInitialState.players
				});
				io.in(roomId).emit('game-state', newInitialState);
				console.log(`Emitted new game state to room ${roomId}, checking room sockets:`, io.sockets.adapter.rooms.get(roomId));
				saveGameStates(); // Сохраняем после новой игры
				return; // Не делать общий set и emit
			}
		}
		gameStates.set(roomId, gameState);
		io.in(roomId).emit('game-state', gameState);
		console.log(`Durak: Emitted game-state to room ${roomId}, currentAttacker: ${gameState.currentAttacker}, players: ${gameState.players}`);
		console.log(`Durak: gameState completeness - gamePhase: ${!!gameState.gamePhase}, players: ${!!gameState.players}, deck: ${!!gameState.deck}, player1Hand: ${!!gameState.player1Hand}, player2Hand: ${gameState.player2Hand !== undefined}`);
		
		// Сохраняем только полные gameStates
		if (gameState.gamePhase && gameState.players && gameState.deck && gameState.player1Hand && gameState.player2Hand !== undefined) {
			saveGameStates();
		}
	});
	
	// Запрос состояния игры
	socket.on('get-game-state', ({ roomId }) => {
		console.log(`get-game-state requested for room ${roomId} by ${socket.id}`);
		const gameState = gameStates.get(roomId);
		if (gameState) {
			console.log(`Sending game-state for room ${roomId}:`, gameState.gameType);
			socket.emit('game-state', gameState);
		} else {
			console.log(`No game-state found for room ${roomId}`);
		}
	});

	// WebRTC signaling: offer/answer/ice
	socket.on('webrtc-offer', ({ roomId, sdp }) => {
		// ретранслируем всем кроме отправителя
		socket.to(roomId).emit('webrtc-offer', { from: socket.id, sdp });
	});

	socket.on('webrtc-answer', ({ roomId, sdp }) => {
		socket.to(roomId).emit('webrtc-answer', { from: socket.id, sdp });
	});

	socket.on('webrtc-ice', ({ roomId, candidate }) => {
		socket.to(roomId).emit('webrtc-ice', { from: socket.id, candidate });
	});

	socket.on('disconnect', () => {
		console.log('user disconnected', socket.id);
		console.log('Remaining gameStates:', Array.from(gameStates.keys()));
		console.log('Remaining rooms:', Array.from(io.sockets.adapter.rooms.keys()));
	});

	// Присоединение к комнате
	socket.on('join-room', ({ roomId }) => {
		console.log(`Player ${socket.id} joining room ${roomId}`);
		console.log(`Before join: Room ${roomId} exists in gameStates:`, gameStates.has(roomId));
		socket.join(roomId);
		sendRoomPlayers(roomId);
		console.log(`After join: Player ${socket.id} joined room ${roomId}`);
	});
});

// Вспомогательная функция для отправки списка игроков в комнате
function sendRoomPlayers(roomId) {
	const roomSockets = io.sockets.adapter.rooms.get(roomId);
	if (!roomSockets) return;

	const players = [];
	for (const socketId of roomSockets) {
		const socket = io.sockets.sockets.get(socketId);
		if (socket) {
			players.push({
				id: socketId,
				name: `Игрок ${socketId.slice(0, 4)}`,
				emoji: socket.userEmoji || '👤'
			});
		}
	}

	// Отправляем список всем игрокам в комнате
	io.in(roomId).emit('room-players', players);
}

// Вспомогательная функция для проверки победителя в крестиках-ноликах
function checkTicTacToeWinner(board) {
	// Проверяем строки
	for (let row = 0; row < 3; row++) {
		if (board[row][0] && board[row][0] === board[row][1] && board[row][0] === board[row][2]) {
			return board[row][0];
		}
	}
	// Проверяем столбцы
	for (let col = 0; col < 3; col++) {
		if (board[0][col] && board[0][col] === board[1][col] && board[0][col] === board[2][col]) {
			return board[0][col];
		}
	}
	// Проверяем диагонали
	if (board[0][0] && board[0][0] === board[1][1] && board[0][0] === board[2][2]) {
		return board[0][0];
	}
	if (board[0][2] && board[0][2] === board[1][1] && board[0][2] === board[2][0]) {
		return board[0][2];
	}
	// Проверяем ничью
	let isDraw = true;
	for (let row = 0; row < 3; row++) {
		for (let col = 0; col < 3; col++) {
			if (board[row][col] === '') {
				isDraw = false;
				break;
			}
		}
		if (!isDraw) break;
	}
	return isDraw ? 'draw' : null;
}

// Функция для запуска сетевой игры между двумя игроками
function startNetworkGame(roomId, gameType, players) {
	console.log(`Starting network game: ${gameType} between players ${players.join(' and ')} in room ${roomId}`);
	
	let initialState = null;
	
	if (gameType === 'chess') {
		initialState = {
			gameType: 'chess',
			board: [
				['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
				['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
				['', '', '', '', '', '', '', ''],
				['', '', '', '', '', '', '', ''],
				['', '', '', '', '', '', '', ''],
				['', '', '', '', '', '', '', ''],
				['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
				['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
			],
			currentPlayer: 'white',
			selectedCell: null,
			players: players,
			gameStarted: true
		};
	} else if (gameType === 'tictactoe') {
		initialState = {
			gameType: 'tictactoe',
			board: [['', '', ''], ['', '', ''], ['', '', '']],
			currentPlayer: 'X',
			gameOver: false,
			winner: null,
			players: players,
			gameStarted: true
		};
	} else if (gameType === 'cards') {
		// Создаём колоду
		const suits = ['♠', '♥', '♦', '♣'];
		const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
		const deck = [];
		for (let suit of suits) {
			for (let value of values) {
				deck.push({ suit, value });
			}
		}
		// Перемешиваем
		for (let i = deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[deck[i], deck[j]] = [deck[j], deck[i]];
		}
		// Раздаём карты
		const player1Hand = [];
		const player2Hand = [];
		for (let i = 0; i < 6; i++) {
			player1Hand.push(deck.pop());
			player2Hand.push(deck.pop());
		}
		initialState = {
			gameType: 'cards',
			deck: deck,
			player1Hand: player1Hand,
			player2Hand: player2Hand,
			tableCards: [],
			currentPlayer: 'player1',
			trumpCard: deck.length > 0 ? deck[0] : null,
			players: players,
			gameStarted: true
		};
	} else if (gameType === 'durak') {
		// Создаём колоду для дурака
		const suits = ['♠', '♥', '♦', '♣'];
		const values = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
		const deck = [];
		for (let suit of suits) {
			for (let value of values) {
				const power = ['6','7','8','9','10','J','Q','K','A'].indexOf(value) + 6;
				deck.push({ suit, value, power });
			}
		}
		// Перемешиваем
		for (let i = deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[deck[i], deck[j]] = [deck[j], deck[i]];
		}
		// Определяем козыря
		const trumpSuit = deck[deck.length - 1].suit;
		// Раздаём карты
		const player1Hand = [];
		const player2Hand = [];
		for (let i = 0; i < 6; i++) {
			player1Hand.push(deck.pop());
			player2Hand.push(deck.pop());
		}
		// Определяем первого игрока - у кого младший козырь
		const player1Trumps = player1Hand.filter(card => card.suit === trumpSuit);
		const player2Trumps = player2Hand.filter(card => card.suit === trumpSuit);
		let firstAttacker = 'player1';
		if (player1Trumps.length > 0 && player2Trumps.length > 0) {
			const min1 = Math.min(...player1Trumps.map(c => c.power));
			const min2 = Math.min(...player2Trumps.map(c => c.power));
			if (min1 > min2) {
				firstAttacker = 'player2';
			}
		} else if (player2Trumps.length > 0) {
			firstAttacker = 'player2';
		}

		initialState = {
			gameType: 'durak',
			deck: deck,
			player1Hand: player1Hand,
			player2Hand: player2Hand,
			attackingCards: [],
			defendingCards: [],
			trumpSuit: trumpSuit,
			currentAttacker: firstAttacker,
			gamePhase: 'attack',
			winner: null,
			players: players,
			gameStarted: true
		};
	} else if (gameType === 'poker') {
		console.log(`Creating poker game state for room ${roomId}`);
		// Создаём колоду для покера
		const suits = ['♠', '♥', '♦', '♣'];
		const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
		const deck = [];
		for (let suit of suits) {
			for (let value of values) {
				const power = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(value) + 2;
				deck.push({ suit, value, power });
			}
		}
		// Перемешиваем
		for (let i = deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[deck[i], deck[j]] = [deck[j], deck[i]];
		}
		// Раздаём по 5 карт каждому
		const player1Hand = [];
		const player2Hand = [];
		for (let i = 0; i < 5; i++) {
			player1Hand.push(deck.pop());
			player2Hand.push(deck.pop());
		}
		initialState = {
			gameType: 'poker',
			deck: deck,
			player1Hand: player1Hand,
			player2Hand: player2Hand,
			gamePhase: 'discard', // Фаза сброса карт
			winner: null,
			players: players,
			gameStarted: true
		};
		console.log(`Poker game state created for room ${roomId}, players: ${players.join(', ')}`);
	}
	
	if (initialState) {
		gameStates.set(roomId, initialState);
		console.log(`Emitting game-started and game-state for ${gameType} in room ${roomId}`);
		console.log(`game-started payload:`, { gameType: gameType, players: players, roomId: roomId });
		console.log(`game-state payload:`, {
			gameType: initialState.gameType,
			gamePhase: initialState.gamePhase,
			currentAttacker: initialState.currentAttacker,
			players: initialState.players,
			deckLength: initialState.deck?.length,
			player1HandLength: initialState.player1Hand?.length,
			player2HandLength: initialState.player2Hand?.length
		});
		io.in(roomId).emit('game-started', {
			gameType: gameType,
			players: players,
			roomId: roomId
		});
		io.in(roomId).emit('game-state', initialState);
		console.log(`Emitted to room ${roomId}, checking room sockets:`, io.sockets.adapter.rooms.get(roomId));
		saveGameStates(); // Сохраняем после создания игры
	}
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    console.log(`Server running on http://${host}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});