const errP = document.getElementById("errP");
const breakoutField = document.getElementById("breakoutField");
const connectBtn = document.getElementById("connectBtn");

let canvas = null
let ctx = null;

const gameVars = {};

const unloadedVars = {
    canvas: {
        height: 640,
        width: 480,
    }
}

const io = window.io;

const buttonsHeld = {
    left: false,
    right: false,
}

let socket = null;

function _buildCanvas() {
    errP.hidden = true;
    _buildCanvasElements();

    if (canvas && ctx) {
        console.log("Successfully built canvas and ctx.");
    } else {
        printError("Failed to build canvas or context! Tell Lucky!!")
    }
}

function _buildCanvasElements() {
    canvas = document.createElement("canvas");
    canvas.id = "breakoutCanvas";
    canvas.width = unloadedVars.canvas.width;
    canvas.height = unloadedVars.canvas.height;
    ctx = canvas.getContext("2d");
    breakoutField.appendChild(canvas);
}

function printError(msg) {
    errP.hidden = false;
    errP.textContent = msg;
    console.error(msg);
}

function _handlePreConnection() {
    _buildCanvas();
    _wireConnectButton();
}

function _wireConnectButton() {
    connectBtn.addEventListener("click", e => {
        e.preventDefault();
        _connectSocket()
    })
}

function _connectSocket() {
    socket = io();  // Establish connection

    socket.timeout(5000).on("connect", err => {
        if (err) {
            printError(err);
        } else {
            console.log("Connected to server");
            connectBtn.disabled = true;
            connectBtn.textContent = "Connected!";

            const storageID = localStorage.getItem("clientID");
            const transmitID = storageID ? storageID : "NO_ID";
            console.log(`Sending client ID ${transmitID} to server`);
            socket.emit("client id to server", transmitID);
        }
    });

    // The server is sending us a new ID because the existing ID is invalid."
    socket.on("client id to client", newClientID => {
        console.log(`Received new client ID: ${newClientID}`);
        localStorage.setItem("clientID", newClientID);
    });

    socket.on("disconnect", socket => {
        console.log("Lost connection to server.");
        connectBtn.disabled = false;
        connectBtn.textContent = "Connect to Server";
    })

    socket.on("state update", gameState => {
        // gameState is received as a JSON object
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        _drawPaddle(gameState.paddleBottom);
        _drawPaddle(gameState.paddleTop);
        _drawBall(gameState.ball.upper);
        _drawBall(gameState.ball.lower);
        socket.emit("buttons held", buttonsHeld, localStorage.getItem("clientID"))
    });

    socket.on("initial vars", serverGameVars => {
        Object.assign(gameVars, serverGameVars)
        console.log("Redrawing canvas from initial var update");
        _redrawCanvas();
    });
}

function _redrawCanvas() {
    if (gameVars.dimensions) {
        canvas.width = gameVars.dimensions.canvas.width;
        canvas.height = gameVars.dimensions.canvas.height;
        console.log("Canvas redrawn");
    } else {
        console.error("Failed to redraw canvas; gameVars undefined")
    }
}

function _drawBall(ball) {
    if (ball && gameVars.dimensions) {
        ctx.beginPath();
        ctx.arc(ball.x,
            ball.y,
            gameVars.dimensions.ball.radius,
            0,
            Math.PI * 2);
        ctx.fillStyle = "red";
        ctx.fill();
        ctx.closePath();
    }
};

function _drawPaddle(paddleVars) {
    console.log(JSON.stringify(paddleVars));
    if (canvas && ctx && gameVars.dimensions) {
        ctx.beginPath();
        ctx.rect(
            paddleVars.x, 
            paddleVars.y, 
            gameVars.dimensions.paddle.width,
            gameVars.dimensions.paddle.height,
        );
        ctx.fillStyle = "red";
        ctx.fill();
        ctx.closePath();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    _handlePreConnection();
});

function updateButton(whichButton, state) {
    if (buttonsHeld[whichButton] !== state) {
        buttonsHeld[whichButton] = state;
    }
}

document.addEventListener("keydown", e => {
    if (e.code === "ArrowRight") {
        updateButton("right", true);
    } else if (e.code === "ArrowLeft") {
        updateButton("left", true);
    }
})

document.addEventListener("keyup", e => {
    if (e.code === "ArrowRight") {
        updateButton("right", false);
    } else if (e.code === "ArrowLeft") {
        updateButton("left", false);
    }
})