import { ClientBallInterface, GameStateInterface, ServerBallInterface, 
    GameClientStaticVars, Vector } from "./types";
import { SquareDimensions, squareIntersection } from "./physics"

export class BallPhysicsController {

    static _clientVars: GameClientStaticVars;
    static _clientErrorLogged: boolean = false;
    static _managed: Array<string> = [];

    static setVars(clientVars: GameClientStaticVars) {
        this._clientVars = clientVars;
        this._clientErrorLogged = false;
    }

    static manage(...ballIDs: Array<string>) {
        for (const ballID of ballIDs) {
            if (!this._managed.includes(ballID)) {
                this._managed.push(ballID)
            };
        };
    }

    static unmanage(...ballIDs: Array<string>) {
        const indicesToDrop = []
        for (const ballID of ballIDs) {
            if (this._managed.includes(ballID)) {
                const i = this._managed.indexOf(ballID);
                indicesToDrop.push(i);
            };
        };

        if (indicesToDrop.length > 0) {
            let newManaged = [...this._managed];
            for (const index of indicesToDrop.reverse()) {
                /* 
                    It's reversed, so we don't have to worry about adjusting 
                    any upcoming indices.
                */
                newManaged = newManaged.splice(index, 1);
            };
            this._managed = newManaged;
        };
    };

    static moveBall(gameState: GameStateInterface): void {

        if (this._clientVars) {
            type ClientBall = keyof typeof gameState.client.ball;
            type ServerBall = keyof typeof gameState.server.ball;

            for (const ballID of this._managed) {
                const clientBall = gameState.client.ball[ballID as ClientBall];
                const serverBall = gameState.server.ball[ballID as ServerBall];
                this._serveBall(serverBall, ballID);
                this._moveBall(clientBall, serverBall);
                this._wallBounce(clientBall, serverBall);

                const lowerPaddle = gameState.client.paddle.lower;
                const upperPaddle = gameState.client.paddle.upper;
                const paddles = [lowerPaddle, upperPaddle];
                for (const paddle of paddles) {
                    this._checkForPaddleBounce(clientBall, serverBall, paddle)
                }
            };
        } else {
            if (!this._clientErrorLogged) {
                console.log(
                    "Error: BallPhysicsController could not move ball. "
                    + "ClientVars have not set properly.");
                this._clientErrorLogged = true;
            }
        }
    };

    static _serveBall(serverBall: ServerBallInterface, ballID: string): void {
        if (serverBall.dir.x === 0 && serverBall.dir.y === 0) {
            // Only cast in a limited arc to prevent too wild of a serve
            const xMovement = Math.random() - 0.5;  // Will result in a range of -0.5 to 0.5
            
            // Upwards if upper ball and vice versa. -1 is up, 1 is down
            const yMovement = ballID === "upper" ? -1 : 1;

            serverBall.dir.x = xMovement;
            serverBall.dir.y = yMovement;
        }
    }

    static _moveBall(
        clientBall: ClientBallInterface, 
        serverBall: ServerBallInterface): void {
        clientBall.x += serverBall.dir.x * serverBall.speed.current;
        clientBall.y += serverBall.dir.y * serverBall.speed.current;
    }

    static _wallBounce(clientBall: ClientBallInterface, 
                       serverBall: ServerBallInterface): void {

            // Bounce on side walls
            if (clientBall.x < this._clientVars.dimensions.ball.radius) {
                clientBall.x = this._clientVars.dimensions.ball.radius;
                serverBall.dir.x = -serverBall.dir.x;
            } else if (clientBall.x > this._clientVars.dimensions.canvas.width 
                                    - this._clientVars.dimensions.ball.radius) {
                clientBall.x = this._clientVars.dimensions.canvas.width 
                            - this._clientVars.dimensions.ball.radius;
                serverBall.dir.x = -serverBall.dir.x;
            };
        };

    static _executePaddleBounce(
        clientBall: ClientBallInterface,
        serverBall: ServerBallInterface,
        paddle: Vector): void {

        // The y is always reflected.
        serverBall.dir.y = -serverBall.dir.y;

        // The X should be multiplied, but capped at -1 or 1.
        // The degree of multiplication depends on where it hit the paddle.

        const x = clientBall.x;

        const paddleCenter = paddle.x + (this._clientVars.dimensions.paddle.width / 2);
        const paddleLeftCenter = paddle.x + (this._clientVars.dimensions.paddle.width / 4);
        const paddleRightCenter = paddleLeftCenter + (this._clientVars.dimensions.paddle.width / 2);
        
        const nearIncrease = 1.2;
        const farIncrease = 1.8;
        const nudgeDistance = 0.1;
        
        if (x < paddleCenter) {
            // We're on the left side...
            if (x > paddleLeftCenter) {
                if (serverBall.dir.x === 0) {
                    serverBall.dir.x += -nudgeDistance;
                }
                // Near left, not so severe of an increase
                serverBall.dir.x *= nearIncrease;
            } else {
                // Far left! Faster increase and send it that way.
                serverBall.dir.x *= farIncrease;
                if (serverBall.dir.x > 0) { serverBall.dir.x = -serverBall.dir.x };
            }
        } else if (x > paddleCenter) {
            if (x < paddleRightCenter) {
                if (serverBall.dir.x === 0) {
                    serverBall.dir.x += nudgeDistance;
                }
                // Near right, not so severe
                serverBall.dir.x *= nearIncrease;
            } else {
                // Far right! Faster!!
                serverBall.dir.x *= farIncrease;
                if (serverBall.dir.x < 0) { serverBall.dir.x = -serverBall.dir.x };
            }
        } else {
            // exactly in the center!
            serverBall.dir.x = 0;
        }

        // Finally, cap dirs
        serverBall.dir.x = Math.max(-1, serverBall.dir.x);
        serverBall.dir.x = Math.min(1, serverBall.dir.x);

        // And then... acceleration!
        serverBall.speed.current *= 1.2;
    }

    static _checkForPaddleBounce(clientBall: ClientBallInterface,
        serverBall: ServerBallInterface,
        paddle: Vector): void {

        function getPaddleDimensions(paddle: {x: number, y: number}): SquareDimensions {
            return {
                x: paddle.x,
                y: paddle.y,
                w: BallPhysicsController._clientVars.dimensions.paddle.width,
                h: BallPhysicsController._clientVars.dimensions.paddle.height
            };
        };

    const paddleDim = getPaddleDimensions(paddle);
    const ballDim: SquareDimensions = {
        x: clientBall.x - this._clientVars.dimensions.ball.radius,
        y: clientBall.y - this._clientVars.dimensions.ball.radius,
        w: this._clientVars.dimensions.ball.radius * 2,
        h: this._clientVars.dimensions.ball.radius * 2,
    };

    const resetLowerY = this._clientVars.dimensions.canvas.height
                        + this._clientVars.dimensions.ball.radius * 2;
    const resetUpperY = 0 - this._clientVars.dimensions.ball.radius * 2;

    if (squareIntersection(ballDim, paddleDim)) {
        this._executePaddleBounce(clientBall, serverBall, paddle);
    }

    // else, let it hit the back wall. It goes through until eclipsed.
    if (clientBall.y > resetLowerY) {
        this._resetBall(clientBall, serverBall);
    } else if (clientBall.y < resetUpperY) {
        this._resetBall(clientBall, serverBall);
    }
}

    static _resetBall(clientBall: ClientBallInterface,
        serverBall: ServerBallInterface
    ) {
        clientBall.x = this._clientVars.dimensions.canvas.width / 2;
        clientBall.y = this._clientVars.dimensions.canvas.height / 2;
        serverBall.dir.x = 0;
        serverBall.dir.y = 0;
        serverBall.speed.current = serverBall.speed.initial;
        // Zeroing the dirs will cause a re-serve in _moveBall (side effect)
    };
};
