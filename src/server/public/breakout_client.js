const errP = document.getElementById("errP");
const breakoutField = document.getElementById("breakoutField");
const connectBtn = document.getElementById("connectBtn");

let canvas = null
let ctx = null;

let gameVars = {
    canvasWidth: 480,
    canvasHeight: 640,
    paddleVars: {
        width: 100,
        height: 20,
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
    canvas.width = "480";
    canvas.height = "640";
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

    socket.timeout(5000).on("connect", (err, socket) => {
        if (err) {
            printError(err);
        } else {
            console.log("Connected to server");
            connectBtn.disabled = true;
            connectBtn.textContent = "Connected!";
        }
    });

    socket.on("disconnect", socket => {
        console.log("Lost connection to server.");
        connectBtn.disabled = false;
        connectBtn.textContent = "Connect to Server";
    })

    socket.on("state update", gameState => {
        // gameState is received as a JSON object
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        _drawPaddle(gameState.paddleOne);
        _drawPaddle(gameState.paddleTwo);
        socket.emit("buttons held", buttonsHeld)
    });

    socket.on("initial vars", serverGameVars => {
        gameVars.canvasHeight = serverGameVars.canvasHeight;
        gameVars.canvasWidth = serverGameVars.canvasWidth;
        gameVars.paddleVars.width = serverGameVars.paddleWidth;
        gameVars.paddleVars.height = serverGameVars.paddleHeight;
        console.log("Redrawing canvas from initial var update");
        _redrawCanvas();
    });
}

function _redrawCanvas() {
    canvas.width = gameVars.canvasWidth;
    canvas.height = gameVars.canvasHeight;
    console.log("Canvas redrawn");
}

function _drawPaddle(paddleVars) {
    if (canvas && ctx) {
        // paddleVars contains x, y, and id
        // paddle size can be drawn from gameVars.paddle
        ctx.beginPath();
        ctx.rect(
            paddleVars.x, 
            paddleVars.y, 
            gameVars.paddleVars.width,
            gameVars.paddleVars.height,
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