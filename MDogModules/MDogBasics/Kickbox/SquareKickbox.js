import Kickbox from "/MDogEngine/MDogModules/MDogBasics/Kickbox/Kickbox.js";

class SquareKickbox extends Kickbox {
    constructor(vector, x1, y1, x2, y2) {
        super(vector);
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
    }

    // draw() {
    //     MDog.Draw.rectangle(
    //         Math.floor(this.vector.getX()) + this.x1,
    //         Math.floor(this.vector.getY()) + this.y1,
    //         this.x2-this.x1,
    //         this.y2-this.y1,
    //         "#ff0000");
    // }

    getX(index) {
        return Math.floor(this.vector.getX()) + this.x1 + [
            -1,
            0,
            this.x2-this.x1,
            this.x2-this.x1 + 1
        ][index];
    }
    getY(index) {
        return Math.floor(this.vector.getY()) + this.y1 + [
            -1,
            0,
            this.y2-this.y1-1,
            this.y2-this.y1
        ][index];
    }

    getMiddleOffsetX() {
        return Math.floor(this.x1 + Math.floor(this.getWidth()/2));
    }
    getMiddleOffsetY() {
        return Math.floor(this.y1 + Math.floor(this.getHeight()/2));
    }

    getMiddleX() {
        return Math.floor(this.vector.getX()) + this.x1 + Math.floor(this.getWidth()/2);
    }

    getMiddleY() {
        return Math.floor(this.vector.getY()) + this.y1 + Math.floor(this.getHeight()/2);
    }

    getWidth() {
        return this.x2 - this.x1;
    }
    getHeight() {
        return this.y2 - this.y1;
    }

    getLeftX() {
        return Math.floor(this.vector.getX()) + this.x1;
    }
    getRightX() {
        return Math.floor(this.vector.getX()) + this.x2 - 1;
    }
    getTopY() {
        return Math.floor(this.vector.getY()) + this.y1;
    }
    getBottomY() {
        return Math.floor(this.vector.getY()) + this.y2 - 1;
    }

    colliding(otherKickbox) {
        const test1 = this.getRightX() < otherKickbox.getLeftX();
        const test2 = this.getLeftX() > otherKickbox.getRightX();
        const test3 = this.getTopY() > otherKickbox.getBottomY();
        const test4 = this.getBottomY() < otherKickbox.getTopY();

        if (test1 || // this Kickbox is to the left of the other
            test2 || // this Kickbox is to the right of the other
            test3 || // this Kickbox is above the other
            test4)   // this Kickbox is below the other
        {
            return false;
        } else {
            return true;
        }
    }
}

export default SquareKickbox;