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

    socket.on("state update", ({clientState, level}) => {
        // gameState is received as a JSON object
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        _updatePauseStatus(clientState.paused, clientState.unpausing);
        _drawLevel(level);
        _drawPaddle(clientState.paddle.lower);
        _drawPaddle(clientState.paddle.upper);
        _drawBall(clientState.ball.upper);
        _drawBall(clientState.ball.lower);
        socket.emit("buttons held", buttonsHeld, 
            localStorage.getItem("clientID"))
    });

    socket.on("initial vars", serverGameVars => {
        Object.assign(gameVars, serverGameVars)
        console.log("Redrawing canvas from initial var update");
        _redrawCanvas();
    });
}

function _updatePauseStatus(paused, unpausing) {
    const pauseStatusP = document.getElementById("pauseStatus");
    if (pauseStatusP) {
        if (paused) {
            pauseStatusP.textContent = "Paused!";
        }

        if (unpausing) {
            pauseStatusP.textContent = "Unpausing soon!";
        }

        if (!paused && !unpausing) {
            pauseStatusP.textContent = "";
        }
    } 
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

function _drawLevel(level) {
    /* 
        Every bar is communicated to the client as an array of positions.
        Build the bars from these positions.
    */

    // TODO: Rename paddle to generic bar
    if (gameVars) {
        // Idea: colored rows for proximity to center?
        /* 
        const barCols = 
            Math.floor(canvas.width / gameVars.dimensions.paddle.width);
        const barRows = level.length / barCols;
        */

        for (const barPos of level) {
            ctx.beginPath();
            ctx.rect(
                barPos.x,
                barPos.y,
                gameVars.dimensions.paddle.width,
                gameVars.dimensions.paddle.height,
            )
            ctx.fillStyle = "#93CAED";  // soft blue
            ctx.fill();
            ctx.closePath();
        }
    }
}

function _drawPaddle(paddleVars) {
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