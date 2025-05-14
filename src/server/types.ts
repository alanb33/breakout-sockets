export interface Vector {
    x: number,
    y: number
};

interface Speed {
    initial: number,
    current: number,
};

// Readability in BallPhysicsController.ts
export type ClientBallInterface = Vector;

export interface ServerBallInterface {
    dir: Vector,
    speed: Speed,
};

export interface GameStateInterface {
    client: {
        paddle: {
            upper: Vector,
            lower: Vector,
        },
        ball: {
            upper: Vector,
            lower: Vector,
        }
    },
    server: {
        ball: {
            upper: ServerBallInterface,
            lower: ServerBallInterface,
        }
    }
}

/**
 * @typedef {object} ClientPaddleSeats
 * @property {string} key The client's seat number, given a GUID key.
 */
export interface ClientPaddleSeats {
    [key: string]: number;
};

/**
 * @typedef {object} GameClientStaticVars
 * GameClientVars is a client-side variable structure whose purpose
 * is to communicate appropriate dimensions and other client-side
 * static variables to the players.
 */
export interface GameClientStaticVars {
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