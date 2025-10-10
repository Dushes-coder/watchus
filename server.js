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
		
		// Отправляем приглашение целевому игроку
		socket.to(targetPlayerId).emit('game-invitation', {
			gameType: gameType,
			senderId: socket.id,
			senderName: senderName || 'Игрок',
			senderEmoji: socket.userEmoji || '👤'
		});
	});
	
	// Ответ на приглашение в игру
	socket.on('game-invitation-response', ({ roomId, senderId, accepted, gameType }) => {
		console.log(`Game invitation response: ${accepted ? 'accepted' : 'declined'} from ${socket.id} for ${gameType}`);
		
		// Отправляем ответ отправителю приглашения
		socket.to(senderId).emit('game-invitation-response', {
			accepted: accepted,
			responderId: socket.id,
			gameType: gameType
		});
		
		// Если приглашение принято, начинаем игру
		if (accepted) {
			startNetworkGame(roomId, gameType, [senderId, socket.id]);
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
		const gameState = gameStates.get(roomId);
		if (!gameState || gameState.gameType !== gameType) return;
		
		if (gameType === 'chess') {
			// Применяем ход
			const { from, to } = move;
			const piece = gameState.board[from.row][from.col];
			gameState.board[from.row][from.col] = '';
			gameState.board[to.row][to.col] = piece;
			gameState.currentPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';
			gameState.selectedCell = null;
		} else if (gameType === 'tictactoe') {
			// Применяем ход
			const { row, col, player } = move;
			if (gameState.board[row][col] === '' && !gameState.gameOver) {
				gameState.board[row][col] = player;
				gameState.currentPlayer = player === 'X' ? 'O' : 'X';
				// Проверка победителя
				const winner = checkTicTacToeWinner(gameState.board);
				if (winner) {
					gameState.gameOver = true;
					gameState.winner = winner;
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
		}
		
		gameStates.set(roomId, gameState);
		io.in(roomId).emit('game-state', gameState);
	});
	
	// Закрытие игры
	socket.on('game-close', ({ roomId }) => {
		gameStates.delete(roomId);
		io.in(roomId).emit('game-closed');
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
	}
	
	if (initialState) {
		gameStates.set(roomId, initialState);
		io.in(roomId).emit('game-started', {
			gameType: gameType,
			players: players,
			roomId: roomId
		});
		io.in(roomId).emit('game-state', initialState);
	}
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    console.log(`Server running on http://${host}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});