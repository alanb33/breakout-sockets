"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("http"));
const node_path_1 = require("node:path");
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const PORT = 3000;
const app = (0, express_1.default)();
const server = http.createServer(app);
const io = new socket_io_1.Server(server);
const clientFiles = (0, node_path_1.join)(__dirname, "public");
const paddleSpeed = 7;
const gameVars = {
    canvasHeight: 640,
    canvasWidth: 480,
    paddleWidth: 100,
    paddleHeight: 20,
};
const paddleControllers = [];
const clientPaddles = {};
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
};
app.use("/breakout", express_1.default.static(clientFiles));
app.get("/breakout", (req, res) => {
    res.sendFile((0, node_path_1.join)(clientFiles, "breakout.html"));
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
function _receiveClientID(socket) {
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
}
;
function _handleMovement(buttonsHeld, clientID) {
    // Get the seat ID of the player by their client ID.
    const playerSeat = clientPaddles[clientID];
    // Only listen to first two players.
    if (playerSeat === 0 || playerSeat === 1) {
        const paddle = playerSeat === 0 ? gameState.paddleOne : gameState.paddleTwo;
        if (buttonsHeld.left) {
            paddle.x -= paddleSpeed;
        }
        else if (buttonsHeld.right) {
            paddle.x += paddleSpeed;
        }
    }
}
;
function mainLoop() {
    setInterval(_updateClients, 10);
}
function _updateClients() {
    if (io) {
        io.sockets.emit("state update", gameState);
    }
}
server.listen(PORT, () => {
    console.log(`Server is live at http://localhost:${PORT}`);
    mainLoop();
});
