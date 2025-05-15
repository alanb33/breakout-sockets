import * as http from "http";
import { join }  from "node:path";
import express from "express";
import { Server, Socket } from "socket.io";

import { 
    ClientPaddleSeats, GameClientStaticVars, GameStateInterface
} from "./types";
import { BallPhysicsController } from "./BallPhysicsController";

const PORT = 25564;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const clientFiles = join(__dirname, "public"); 

const paddleSpeed = 7;

const gameClientStaticVars: GameClientStaticVars = {
    paused: false,
    dimensions: {
        canvas: {
            width: 480,
            height: 640,
        },
        paddle: {
            width: 100,
            height: 20,
        },
        ball: {
            radius: 10,
        },
    },
};

const paddleControllers: Array<string> = []
const clientPaddles: ClientPaddleSeats = {}

const dims = gameClientStaticVars.dimensions;

const gameState: GameStateInterface = {
    client: {
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
                x: dims.canvas.height / 2,
                y: dims.canvas.height / 2,
            },
            lower: {
                x: dims.canvas.height / 2,
                y: dims.canvas.height / 2,
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

    _receiveClientID(socket);

    socket.emit("initial vars", gameClientStaticVars);
    _updateClients();

    socket.on("disconnect", reason => {
        console.log(`A user disconnected: ${reason}`);
    });

    socket.on("buttons held", (buttonsHeld, clientID) => {
        if (!gameClientStaticVars.paused) {
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
        }
    });
};

function _initializeGame() {
    BallPhysicsController.manage("upper", "lower");
    BallPhysicsController.setVars(gameClientStaticVars);
    setInterval(_mainLoop, 10);
}

function _mainLoop() {
    if (!gameClientStaticVars.paused) {
        BallPhysicsController.moveBall(gameState)
    }
    _updateClients();
}

function _updateClients() {
    if (io) {
        io.sockets.emit("state update", gameState.client);
    }
}

server.listen(PORT, () => {
    console.log(`Server is live at http://localhost:${PORT}/breakout`);
    _initializeGame();
});