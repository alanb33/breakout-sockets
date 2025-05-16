import * as http from "http";
import { join }  from "node:path";
import express from "express";
import { Server, Socket } from "socket.io";

import { BreakoutBuilder } from "./BreakoutBuilder";
import { 
    ClientPaddleSeats, GameClientStaticVars, GameStateInterface, Vector
} from "./types";
import { BallPhysicsController } from "./BallPhysicsController";

const PORT = 25564;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const clientFiles = join(__dirname, "public"); 

const paddleSpeed = 8;

const CANVAS_HEIGHT = 640;
const CANVAS_WIDTH = 480;
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 20;
const BALL_RADIUS = 10;
const BALL_OFFSET = 150;

const gameClientStaticVars: GameClientStaticVars = {
    dimensions: {
        canvas: {
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
        },
        paddle: {
            width: PADDLE_WIDTH,
            height: PADDLE_HEIGHT,
        },
        ball: {
            radius: BALL_RADIUS,
        },
    },
    initPos: {
        ball: {
            upper: {
                x: CANVAS_WIDTH / 2,
                y: CANVAS_HEIGHT / 2 - BALL_OFFSET,
            },
            lower: {
                x: CANVAS_WIDTH / 2,
                y: CANVAS_HEIGHT / 2 + BALL_OFFSET,
            }
        }
    }
};

const currentLevel: Array<Vector> = []

const paddleControllers: Array<string> = []
const clientPaddles: ClientPaddleSeats = {}
let activePlayerCount = 0;

const dims = gameClientStaticVars.dimensions;
const ballPos = gameClientStaticVars.initPos.ball;

const gameState: GameStateInterface = {
    client: {
        paused: true,
        unpausing: false,
        paddle: {
            upper: {
                x: dims.canvas.width / 2 - dims.paddle.width / 2,
                y: 0,
            },
            lower: {
                x: dims.canvas.width / 2 - dims.paddle.width / 2,
                y: dims.canvas.height - dims.paddle.height,
            },
        },
        ball: {
            upper: {
                x: ballPos.upper.x,
                y: ballPos.upper.y,
            },
            lower: {
                x: ballPos.lower.x,
                y: ballPos.lower.y,
            },
        }
    },
    server: {
        ball: {
            upper: {
                dir: {
                    x: 0,   // Represents angle of movement
                    y: 0,   // -1/1, representing up/down
                },
                speed: {
                    initial: 3,
                    current: 3,
                },
            },
            lower: {
                dir: {
                    x: 0,   // Represents angle of movement
                    y: 0,   // -1/1, representing up/down
                },
                speed: {
                    initial: 3,
                    current: 3,
                },
            },
        },
    },
};

app.use("/breakout", express.static(clientFiles));

// Cache control middleware
app.use("/breakout", (req, res, next) => {
    res.set("Cache-Control", "no-cache");
    next();
});

app.get("/breakout", (req, res) => {
    res.sendFile(join(clientFiles, "breakout.html"));
});

io.on("connection", socket => {
    console.log(`A user connected!`);

    if (activePlayerCount > 2) {
        socket.emit("max players reached");
        socket.disconnect(true);
    }

    _receiveClientID(socket);

    socket.emit("initial vars", gameClientStaticVars);
    _updateClients();

    socket.on("disconnect", reason => {
        console.log(`A user disconnected: ${reason}`);
        activePlayerCount--;
    });

    socket.on("buttons held", (buttonsHeld, clientID) => {
        if (!gameState.client.paused) {
            _handlePaddleMovement(buttonsHeld, clientID);
        }
    });
});

function _handlePaddleMovement(
    buttonsHeld: {left: boolean, right: boolean}, 
    clientID: string) {
    // Get the seat ID of the player by their client ID.
    const playerSeat = clientPaddles[clientID];

    // Only listen to first two players.
    if (playerSeat === 0 || playerSeat === 1) {
        const paddle = playerSeat === 0 
        ? gameState.client.paddle.lower 
        : gameState.client.paddle.upper;
        if (buttonsHeld.left) {
            paddle.x -= paddleSpeed;
            paddle.x = Math.max(0, paddle.x);
        } else if (buttonsHeld.right) {
            const canvasW = dims.canvas.width;
            const paddleW = dims.paddle.width;
            paddle.x += paddleSpeed;
            paddle.x = Math.min(paddle.x, canvasW - paddleW);
        };
    };
};

function _receiveClientID(socket: Socket) {
    socket.on("client id to server", clientID => {
        // The client connects and sends its ID to the server.
        console.log(`Received connection from ${clientID}`);
        let found = false;
        for (const id in paddleControllers) {
            if (clientID === paddleControllers[id]) {
                found = true;
                console.log(`Found client in slot ${id}`);
                break;
            }
        }
        /* 
            If we found the client, we're done, it'll automatically be able 
            to move the paddles again.
            
            Otherwise, didn't find the client, so add a new one to the list.
        */
        if (!found) {
            console.log(`ID not found; assigning new.`);
            const newClientID = crypto.randomUUID();
            
            // Assign the client to the seat and the seat to the client
            paddleControllers.push(newClientID);
            const seatNum = paddleControllers.length - 1;
            clientPaddles[newClientID] = seatNum;

            console.log(`Pushing ID ${newClientID} to client at seat ${seatNum}.`);
            socket.emit("client id to client", newClientID);

            activePlayerCount++;
        }
    });
};

function _initializeGame() {
    BreakoutBuilder.setVars(gameClientStaticVars);
    const breakoutBars = BreakoutBuilder.buildLevel("square");
    if (breakoutBars) {
        currentLevel.push(...breakoutBars);
    }
    BallPhysicsController.manage("upper", "lower");
    BallPhysicsController.setVars(gameClientStaticVars);
    setInterval(_mainLoop, 10);
}

function _setPaused(state: boolean) {
    gameState.client.paused = state;
}

function _mainLoop() {
    const client = gameState.client;

    if (activePlayerCount >= 2 && client.paused && !client.unpausing) {
        console.log("Unpausing in 3 seconds");
        client.unpausing = true;
        setInterval(() => { _setPaused(false)}, 3000);
    };

    if (activePlayerCount <= 1 && !client.paused) {
        console.log("No players; pausing game");
        _setPaused(true);
    };

    if (!gameState.client.paused && currentLevel) {
        BallPhysicsController.moveBall(gameState, currentLevel)
    };

    if (activePlayerCount > 0) {
        _updateClients();
    };
}

function _updateClients() {
    if (io) {
        io.sockets.emit("state update", { clientState: gameState.client, level: currentLevel });
    }
}

server.listen(PORT, () => {
    console.log(`Server is live at http://localhost:${PORT}/breakout`);
    _initializeGame();
});