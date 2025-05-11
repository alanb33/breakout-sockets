import * as http from "http";
import { join }  from "node:path";
import express from "express";
import { Server, Socket } from "socket.io";

const PORT = 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const clientFiles = join(__dirname, "public"); 

const paddleSpeed = 7;

const gameVars = {
    canvasHeight: 640,
    canvasWidth: 480,
    paddleWidth: 100,
    paddleHeight: 20,
}

interface ClientPaddle {
    [key: string]: number;
}

const paddleControllers: Array<string> = []
const clientPaddles: ClientPaddle = {}

const gameState = {
    paddleOne: {
        id: 1,
        x: gameVars.canvasWidth / 2 - gameVars.paddleWidth / 2,
        y: gameVars.canvasHeight - gameVars.paddleHeight,
    },
    paddleTwo: {
        id: 2,
        x: gameVars.canvasWidth / 2 - gameVars.paddleWidth / 2,
        y: 0,
    }
}

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
    // Get the seat ID of the player by their client ID.
    const playerSeat = clientPaddles[clientID];

    // Only listen to first two players.
    if (playerSeat === 0 || playerSeat === 1) {
        const paddle = playerSeat === 0 ? gameState.paddleOne : gameState.paddleTwo;
        if (buttonsHeld.left) {
            paddle.x -= paddleSpeed;
        } else if (buttonsHeld.right) {
            paddle.x += paddleSpeed;
        }
    }
};

function mainLoop() {
    setInterval(_updateClients, 10);
}

function _updateClients() {
    if (io) {
        io.sockets.emit("state update", gameState);
    }
}

server.listen(PORT, () => {
    console.log(`Server is live at http://localhost:${PORT}/breakout`);
    mainLoop();
});