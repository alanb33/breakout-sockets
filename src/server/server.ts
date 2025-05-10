import * as http from "http";
import { join }  from "node:path";
import express from "express";
import { Server } from "socket.io";

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

app.use("/", express.static(clientFiles));

app.get("/", (req, res) => {
    res.sendFile(join(clientFiles, "breakout.html"));
});

io.on("connection", socket => {
    console.log("A user connected!");
    socket.emit("initial vars", gameVars);
    _updateClients();

    socket.on("disconnect", reason => {
        console.log(`A user disconnected: ${reason}`);
    });

    socket.on("buttons held", buttonsHeld => {
        _handleMovement(buttonsHeld);
    });
});

function _handleMovement(buttonsHeld: {left: boolean, right: boolean}) {
    // buttonsHeld has two booleans for right and left
    if (buttonsHeld.left) {
        for (const paddleKey of Object.keys(gameState)) {
            const key = paddleKey as keyof typeof gameState;
            gameState[key].x -= paddleSpeed;
        }
    } else if (buttonsHeld.right) {
        for (const paddleKey of Object.keys(gameState)) {
            const key = paddleKey as keyof typeof gameState;
            gameState[key].x += paddleSpeed;
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

server.listen(3000, () => {
    console.log("Server is alive");
    mainLoop();
});