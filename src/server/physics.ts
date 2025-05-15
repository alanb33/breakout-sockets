export interface SquareDimensions {
    x: number,
    y: number,
    w: number,
    h: number
};

/**
 * Checks if two squares are intersecting.
 * @param {SquareDimensions} sq1Dim The first square to compare.
 * @param {SquareDimensions} sq2Dim The second square to compare.
 * @return {boolean}                If squares intersect.
 */
export function squareIntersection(
    sq1Dim: SquareDimensions, 
    sq2Dim: SquareDimensions): boolean
{
    interface SquareTransposed
    {
        x1: number,
        x2: number,
        y1: number,
        y2: number
    };

    function transposeSquare(sq: SquareDimensions): SquareTransposed
    {
        return {
            x1: sq.x,
            x2: sq.x + sq.w,
            y1: sq.y,
            y2: sq.y + sq.h
        };
    }

    // TODO: For loop?
    const sq1 = transposeSquare(sq1Dim);
    const sq2 = transposeSquare(sq2Dim);

    if (sq1.x1 > sq2.x2) {
        // sq1 is to the right of sq2
        return false;
    }

    if (sq1.x2 < sq2.x1) {
        // sq1 is to the left of sq2
        return false;
    }

    if (sq1.y1 > sq2.y2) {
        // sq1 is below sq2
        return false;
    }

    if (sq1.y2 < sq2.y1) {
        // sql1 is above sq2
        return false;
    }

    // If none of the above are true, there's some intersection.
    return true;
};