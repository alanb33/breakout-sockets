import * as http from "http";
import { join }  from "node:path";
import express from "express";
import { Server, Socket } from "socket.io";

import { SquareDimensions, squareIntersection } from "./physics"

const PORT = 25564;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const clientFiles = join(__dirname, "public"); 

const paddleSpeed = 7;

/**
 * @typedef {object} GameClientStaticVars
 * GameClientVars is a client-side variable structure whose purpose
 * is to communicate appropriate dimensions and other client-side
 * static variables to the players.
 */
interface GameClientStaticVars {
    paused: boolean,
    dimensions: {
        canvas: {
            width: number,
            height: number,
        },
        paddle: {
            width: number,
            height: number,
        },
        ball: {
            radius: number,
        }
    }
}

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

/**
 * @typedef {object} ClientPaddleSeats
 * @property {string} key The client's seat number, given a GUID key.
 */
interface ClientPaddleSeats {
    [key: string]: number;
};

const paddleControllers: Array<string> = []
const clientPaddles: ClientPaddleSeats = {}

const gameState = {
    client: {
        paddleBottom: {
            x: gameClientStaticVars.dimensions.canvas.width / 2 - gameClientStaticVars.dimensions.paddle.width / 2,
            y: gameClientStaticVars.dimensions.canvas.height - gameClientStaticVars.dimensions.paddle.height,
        },
        paddleTop: {
            x: gameClientStaticVars.dimensions.canvas.width / 2 - gameClientStaticVars.dimensions.paddle.width / 2,
            y: 0,
        },
        ball: {
            x: gameClientStaticVars.dimensions.canvas.height / 2,
            y: gameClientStaticVars.dimensions.canvas.height / 2,
        }
    },
    server: {
        ball: {
            dir: {
                x: 0,   // Represents angle of movement
                y: 0,   // -1/1, representing up/down
            },
            speed: {
                initial: 3,
                current: 3,
            }
        }
    }
}

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
        _handleMovement(buttonsHeld, clientID);
    });
});

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
        // If we found the client, we're done, it'll automatically be able to
        // move the paddles again.

        // Otherwise, didn't find the client, so add a new one to the list.
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

function _handleMovement(buttonsHeld: {left: boolean, right: boolean}, clientID: string) {
    if (!gameClientStaticVars.paused) {
        // Get the seat ID of the player by their client ID.
        const playerSeat = clientPaddles[clientID];

        // Only listen to first two players.
        if (playerSeat === 0 || playerSeat === 1) {
            const paddle = playerSeat === 0 ? gameState.client.paddleBottom : gameState.client.paddleTop;
            if (buttonsHeld.left) {
                paddle.x -= paddleSpeed;
                paddle.x = Math.max(0, paddle.x);
            } else if (buttonsHeld.right) {
                paddle.x += paddleSpeed;
                paddle.x = Math.min(paddle.x, gameClientStaticVars.dimensions.canvas.width - gameClientStaticVars.dimensions.paddle.width);
            };
        };
    };
};

function mainLoop() {
    if (!gameClientStaticVars.paused) {
        _moveBall();
    }
    _updateClients();
}

function _moveBall() {
    if (gameState.server.ball.dir.x === 0 && gameState.server.ball.dir.y === 0) {
        // Ball isn't moving, give it a random direction
        const xMovement = (Math.random() * 2) - 1;  // Will result in a range of -1 to 1
        const yMovement = Math.round(Math.random()) === 0 ? -1 : 1; // funny equation, but guarantees it will only go up or down
        gameState.server.ball.dir.x = xMovement;
        gameState.server.ball.dir.y = yMovement;
    }

    gameState.client.ball.x += gameState.server.ball.dir.x * gameState.server.ball.speed.current;
    gameState.client.ball.y += gameState.server.ball.dir.y * gameState.server.ball.speed.current;

    // Bounce on side walls
    if (gameState.client.ball.x < gameClientStaticVars.dimensions.ball.radius) {
        gameState.client.ball.x = gameClientStaticVars.dimensions.ball.radius;
        gameState.server.ball.dir.x = -gameState.server.ball.dir.x;
    } else if (gameState.client.ball.x > gameClientStaticVars.dimensions.canvas.width - gameClientStaticVars.dimensions.ball.radius) {
        gameState.client.ball.x = gameClientStaticVars.dimensions.canvas.width - gameClientStaticVars.dimensions.ball.radius;
        gameState.server.ball.dir.x = -gameState.server.ball.dir.x;
    }

    function _bouncePaddle(paddle: {x: number, y: number}) {
        // The y is always reflected.
        gameState.server.ball.dir.y = -gameState.server.ball.dir.y;

        // The X should be multiplied, but capped at -1 or 1.
        // The degree of multiplication depends on where it hit the paddle.

        const x = gameState.client.ball.x;

        const paddleCenter = paddle.x + (gameClientStaticVars.dimensions.paddle.width / 2);
        const paddleLeftCenter = paddle.x + (gameClientStaticVars.dimensions.paddle.width / 4);
        const paddleRightCenter = paddleLeftCenter + (gameClientStaticVars.dimensions.paddle.width / 2);
        
        const nearIncrease = 1.2;
        const farIncrease = 1.8;
        
        if (x < paddleCenter) {
            // We're on the left side...
            if (x > paddleLeftCenter) {
                // Near left, not so severe of an increase
                gameState.server.ball.dir.x *= nearIncrease;
            } else {
                // Far left! Faster increase and send it that way.
                gameState.server.ball.dir.x *= farIncrease;
                if (gameState.server.ball.dir.x > 0) { gameState.server.ball.dir.x = -gameState.server.ball.dir.x };
            }
        } else if (x > paddleCenter) {
            if (x < paddleRightCenter) {
                // Near right, not so severe
                gameState.server.ball.dir.x *= nearIncrease;
            } else {
                // Far right! Faster!!
                gameState.server.ball.dir.x *= farIncrease;
                if (gameState.server.ball.dir.x < 0) { gameState.server.ball.dir.x = -gameState.server.ball.dir.x };
            }
        } else {
            // exactly in the center!
            gameState.server.ball.dir.x = 0;
        }

        // Finally, cap dirs
        gameState.server.ball.dir.x = Math.max(-1, gameState.server.ball.dir.x);
        gameState.server.ball.dir.x = Math.min(1, gameState.server.ball.dir.x);

        // And then... acceleration!
        gameState.server.ball.speed.current *= 1.2;
    }

    const ballDim: SquareDimensions = {
        x: gameState.client.ball.x -gameClientStaticVars.dimensions.ball.radius,
        y: gameState.client.ball.y -gameClientStaticVars.dimensions.ball.radius,
        w:gameClientStaticVars.dimensions.ball.radius * 2,
        h:gameClientStaticVars.dimensions.ball.radius * 2 
    }

    function getPaddleDimensions(paddle: {x: number, y: number}): SquareDimensions {
        return {
            x: paddle.x,
            y: paddle.y,
            w: gameClientStaticVars.dimensions.paddle.width,
            h: gameClientStaticVars.dimensions.paddle.height
        };
    };

    const paddleOneDim = getPaddleDimensions(gameState.client.paddleBottom);
    const paddleTwoDim = getPaddleDimensions(gameState.client.paddleTop);
    const resetYLower = gameClientStaticVars.dimensions.canvas.height + gameClientStaticVars.dimensions.ball.radius * 2;
    const resetYUpper = -gameClientStaticVars.dimensions.ball.radius * 2;

    // top/bottom bounce. check if ball x is between paddle.x
    if (gameState.server.ball.dir.y >= 0) {
        // Moving down, versus paddleOne
        if (squareIntersection(ballDim, paddleOneDim)) {
            _bouncePaddle(gameState.client.paddleBottom);
        }

        // else, let it hit the back wall. It goes through until eclipsed.
        if (gameState.client.ball.y > resetYLower) {
            _resetBall()
        }
    } else {
        // Moving up, versus paddleTwo
        if (squareIntersection(ballDim, paddleTwoDim)) {
            _bouncePaddle(gameState.client.paddleTop);
        }

        if (gameState.client.ball.y < resetYUpper) {
            _resetBall()
        }
    }
}

function _resetBall() {
    gameState.client.ball.x = gameClientStaticVars.dimensions.canvas.width / 2;
    gameState.client.ball.y = gameClientStaticVars.dimensions.canvas.height / 2;
    gameState.server.ball.dir.x = 0;
    gameState.server.ball.dir.y = 0;
    gameState.server.ball.speed.current = gameState.server.ball.speed.initial;

    // Zeroing the dirs will cause a re-serve in _moveBall (side effect)
}


function _updateClients() {
    if (io) {
        io.sockets.emit("state update", gameState.client);
    }
}

server.listen(PORT, () => {
    console.log(`Server is live at http://localhost:${PORT}/breakout`);
    setInterval(mainLoop, 10);
});