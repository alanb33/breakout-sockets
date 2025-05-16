import { GameClientStaticVars, Vector } from "./types";

export class BreakoutBuilder {

    static _clientVars: GameClientStaticVars;

    static setVars(vars: GameClientStaticVars) {
        this._clientVars = vars;
    };

    static buildLevel(levelID: string): Array<Vector> | null {
        // levelID will be used later to design different patterns.
        const vars = this._clientVars;
        if (vars) {
            const dims = vars.dimensions;
            const bar = {
                w: dims.paddle.width,
                h: dims.paddle.height,
            }
            const barsWide = Math.floor(dims.canvas.width / dims.paddle.width);
            
            const maxRows = 6;
            const barsHigh = Math.min(maxRows,
                Math.floor(dims.canvas.height / dims.paddle.height));

            // The free space not occupied by breakout bars
            const canvasFreeSpace = dims.canvas.width - bar.w * barsWide;
            
            // How many columns between breakout bars
            const gaps = barsWide + 1;
            const gapSize = canvasFreeSpace / gaps;

            /*
                gap - bar - gap, repeat until out of bars.
                vertical calculation
                    first, determine gaps between bars.
                    get total height of gaps - 2 (since we exclude edges) and
                    sum with total height of barsHigh * bar.h.

                sum is the height of the bar field.
                divide this by 2 to find its center point and then place that
                at the center of the canvas.

                to find y position of first row of bars:
                    canvas center - (allBarsHeight / 2)
                    all subsequent rows include gap*row + height*row
            */

            const allBarsHeight = ((gaps - 2) * gapSize) + (bar.h * barsHigh);
            const startY = (dims.canvas.height / 2) - (allBarsHeight / 2);


            const bars: Array<Vector> = []

            for (let barRow = 0; barRow < barsHigh; barRow++) {
                for (let barCol = 0; barCol < barsWide; barCol++) {
                    const leftGaps = barCol + 1;
                    const leftBars = barCol;
                    const upperGaps = barRow;
                    const upperBars = barRow;
                    const newBar: Vector = {
                        x: (leftGaps * gapSize) + (leftBars * bar.w),
                        y: startY + (upperGaps * gapSize) + (upperBars * bar.h)
                    }
                    bars.push(newBar);
                }
            }

            return bars;

        } else {
            console.error("Could not build level; client vars not set.");
            return null;
        }
    }
}