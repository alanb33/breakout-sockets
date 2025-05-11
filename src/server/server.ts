import * as http from "http";
import { join }  from "node:path";
import express from "express";
import { Server, Socket } from "socket.io";

const PORT = 25564;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const clientFiles = join(__dirname, "public"); 

const paddleSpeed = 7;

const gameVars = {
    paused: false,
    canvasHeight: 640,
    canvasWidth: 480,
    paddleWidth: 100,
    paddleHeight: 20,
    ball: {
        radius: 10
    },
}

interface ClientPaddle {
    [key: string]: number;
}

const paddleControllers: Array<string> = []
const clientPaddles: ClientPaddle = {}

const gameState = {
    paddleOne: {
        x: gameVars.canvasWidth / 2 - gameVars.paddleWidth / 2,
        y: gameVars.canvasHeight - gameVars.paddleHeight,
    },
    paddleTwo: {
        x: gameVars.canvasWidth / 2 - gameVars.paddleWidth / 2,
        y: 0,
    },
    ball: {
        x: gameVars.canvasWidth / 2,
        y: gameVars.canvasHeight / 2,
    }
}

const ballBaseSpeed = 2;

const ballState = {
    speed: ballBaseSpeed,
    dir: {
        x: 0,
        y: 0,
    },
};

app.use("/breakout", express.static(clientFiles));

app.get("/breakout", (req, res) => {
    res.sendFile(join(clientFiles, "breakout.html"));
});

io.on("connection", socket => {
    console.log(`A user connected!`);

    _receiveClientID(socket);

    socket.emit("initial vars", gameVars);
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
    if (!gameVars.paused) {
        // Get the seat ID of the player by their client ID.
        const playerSeat = clientPaddles[clientID];

        // Only listen to first two players.
        if (playerSeat === 0 || playerSeat === 1) {
            const paddle = playerSeat === 0 ? gameState.paddleOne : gameState.paddleTwo;
            if (buttonsHeld.left) {
                paddle.x -= paddleSpeed;
                paddle.x = Math.max(0, paddle.x);
            } else if (buttonsHeld.right) {
                paddle.x += paddleSpeed;
                paddle.x = Math.min(paddle.x, gameVars.canvasWidth - gameVars.paddleWidth);
            };
        };
    };
};

function mainLoop() {
    if (!gameVars.paused) {
        _moveBall();
    }
    _updateClients();
}

function _moveBall() {
    if (ballState.dir.x === 0 && ballState.dir.y === 0) {
        // Ball isn't moving, give it a random direction
        const xMovement = (Math.random() * 2) - 1;  // Will result in a range of -1 to 1
        const yMovement = Math.round(Math.random()) === 0 ? -1 : 1; // funny equation, but guarantees it will only go up or down
        ballState.dir.x = xMovement;
        ballState.dir.y = yMovement;
    }

    gameState.ball.x += ballState.dir.x * ballState.speed;
    gameState.ball.y += ballState.dir.y * ballState.speed;

    // Bounce on side walls
    if (gameState.ball.x < gameVars.ball.radius) {
        gameState.ball.x = gameVars.ball.radius;
        ballState.dir.x = -ballState.dir.x;
    } else if (gameState.ball.x > gameVars.canvasWidth - gameVars.ball.radius) {
        gameState.ball.x = gameVars.canvasWidth - gameVars.ball.radius;
        ballState.dir.x = -ballState.dir.x;
    }
    
    /*
    // Temp, bounce on top/bottom walls
    if (gameState.ball.y < gameVars.ball.radius) {
        gameState.ball.y = gameVars.ball.radius;
        ballState.dir.y = -ballState.dir.y;
    } else if (gameState.ball.y > gameVars.canvasHeight - gameVars.ball.radius) {
        gameState.ball.y = gameVars.canvasHeight - gameVars.ball.radius;
        ballState.dir.y = -ballState.dir.y;
    }
    */

    function _bouncePaddle(paddle: {x: number, y: number}) {
        // The y is always reflected.
        ballState.dir.y = -ballState.dir.y;

        // The X should be multiplied, but capped at -1 or 1.
        // The degree of multiplication depends on where it hit the paddle.

        const x = gameState.ball.x;

        const paddleCenter = paddle.x + (gameVars.paddleWidth / 2);
        const paddleLeftCenter = paddle.x + (gameVars.paddleWidth / 4);
        const paddleRightCenter = paddleLeftCenter + (gameVars.paddleWidth / 2);
        
        const nearIncrease = 1.2;
        const farIncrease = 1.8;

        console.log(`paddleCenter is ${paddleCenter}`);
        console.log(`ball.x is ${x}`);
        
        if (x < paddleCenter) {
            // We're on the left side...
            if (x > paddleLeftCenter) {
                // Near left, not so severe of an increase
                ballState.dir.x *= nearIncrease;
                console.log("Hit near left")
            } else {
                // Far left! Faster increase and send it that way.
                ballState.dir.x *= farIncrease;
                console.log("Hit far left")
                if (ballState.dir.x > 0) { ballState.dir.x = -ballState.dir.x };
            }
        } else if (x > paddleCenter) {
            if (x < paddleRightCenter) {
                // Near right, not so severe
                ballState.dir.x *= nearIncrease;
                console.log("Hit near right")
            } else {
                // Far right! Faster!!
                ballState.dir.x *= farIncrease;
                console.log("Hit far right")
                if (ballState.dir.x < 0) { ballState.dir.x = -ballState.dir.x };
            }
        } else {
            // exactly in the center!
            ballState.dir.x = 0;
        }

        // Finally, cap dirs
        ballState.dir.x = Math.max(-1, ballState.dir.x);
        ballState.dir.x = Math.min(1, ballState.dir.x);

        console.log(`ballstate.dir.x = ${ballState.dir.x}`);

        // And then... acceleration!
        ballState.speed *= 1.2;
    }

    // top/bottom bounce. check if ball x is between paddle.x
    if (ballState.dir.y >= 0) {
        // Moving down, versus paddleOne
        // If it hits the potential bounce y against a paddle...
        if (gameState.ball.y > gameVars.canvasHeight - gameVars.ball.radius - gameVars.paddleHeight) {
            // and it's within range of the paddle...
            if (gameState.ball.x >= gameState.paddleOne.x && gameState.ball.x <= gameState.paddleOne.x + gameVars.paddleWidth) {
                // bounce!
                _bouncePaddle(gameState.paddleOne);
            }
        }

        // else, let it hit the back wall. It goes through until eclipsed.
        if (gameState.ball.y > gameVars.canvasHeight + gameVars.ball.radius) {
            _resetBall()
        }
    } else {
        // Moving up, versus paddleTwo
        if (gameState.ball.y < gameVars.ball.radius + gameVars.paddleHeight) {
            if (gameState.ball.x >= gameState.paddleTwo.x && gameState.ball.x <= gameState.paddleTwo.x + gameVars.paddleWidth) {
                _bouncePaddle(gameState.paddleTwo);
            }
        }

        if (gameState.ball.y < -gameVars.ball.radius) {
            _resetBall()
        }
    }
}

function _resetBall() {
    gameState.ball.x = gameVars.canvasWidth / 2;
    gameState.ball.y = gameVars.canvasHeight / 2;
    ballState.dir.x = 0;
    ballState.dir.y = 0;
    ballState.speed = ballBaseSpeed;

    // Zeroing the dirs will cause a re-serve in _moveBall
}


function _updateClients() {
    if (io) {
        io.sockets.emit("state update", gameState);
    }
}

server.listen(PORT, () => {
    console.log(`Server is live at http://localhost:${PORT}/breakout`);
    setInterval(mainLoop, 10);
});