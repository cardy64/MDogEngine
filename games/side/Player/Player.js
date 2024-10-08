import Maths from "/MDogModules/MDogMaths.js";

import SquareKickbox from "/MDogModules/MDogBasics/Kickbox/SquareKickbox.js";

import FallState from "./States/FallState.js";
import JumpState from "./States/JumpState.js";
import RunningState from "./States/RunningState.js";
import IdleState from "./States/IdleState.js";
import WallSlideState from "./States/WallSlideState.js";

const Vector = (new Maths()).Vector;

let MDog;

function pixelsPerSecondToPixelsPerTick(value) {
    return value / MDog.ticksPerSecond;
}

function pixelsPerSecondToPixelsPerTickSquared(valuePerUnit) {
    return valuePerUnit / MDog.ticksPerSecond / MDog.ticksPerSecond;
}

function secondsToTicks(seconds) {
    return Math.floor(seconds * MDog.ticksPerSecond);
}

class Player {
    constructor(MDogInput, x, y) {
        // const timeFactor = 160 / MDog.ticksPerSecond;

        MDog = MDogInput;

        this.position = new Vector(x, y);
        this.velocity = new Vector();

        this.keys = {
            left: ["a", "ArrowLeft"],
            right: ["d", "ArrowRight"],
            up: ["w", "ArrowUp"],
            down: ["s", "ArrowDown"],
            jump: [" ", "c"],
            dash: ["Shift", "x", "Enter"]
        };

        this.keyBuffers = {
            jump: {time: 0, limit: secondsToTicks(10)},
            dash: {time: 0, limit: secondsToTicks(15)},
        }

        this.flipMargin = pixelsPerSecondToPixelsPerTick(1.6);
        this.facingLeft = false;

        this.groundCoyoteLimit = secondsToTicks(0.5);
        this.groundCoyoteTime = 0;
        this.wallCoyoteLimit = secondsToTicks(0.5);
        this.wallCoyoteTime = 0;
        this.lastTouchedLeftWall = false;

        this.runMargin = pixelsPerSecondToPixelsPerTick(0.8);
        this.groundAcceleration = pixelsPerSecondToPixelsPerTickSquared(0.07);
        this.airAcceleration = pixelsPerSecondToPixelsPerTickSquared(0.03);
        this.groundDeceleration = pixelsPerSecondToPixelsPerTickSquared(0.04);
        this.airDeceleration = pixelsPerSecondToPixelsPerTickSquared(0.04);
        this.maxRunSpeed = pixelsPerSecondToPixelsPerTickSquared(1.7);

        this.jumpHoldLimit = secondsToTicks(0.5);
        this.jumpHoldTime = 0;
        this.jumpForce = pixelsPerSecondToPixelsPerTick(2);
        this.gravity = pixelsPerSecondToPixelsPerTickSquared(0.08);
        this.maxAirFallSpeed = pixelsPerSecondToPixelsPerTick(2.5);
        this.maxWallSlideFallSpeed = pixelsPerSecondToPixelsPerTick(0.4);
        this.wallDeceleration = pixelsPerSecondToPixelsPerTickSquared(0.1);
        this.wallJumpXStrength = pixelsPerSecondToPixelsPerTick(2.5);
        this.wallJumpYStrength = pixelsPerSecondToPixelsPerTick(2.5);

        this.hasAirDash = false;

        this.attackHorizontalX = pixelsPerSecondToPixelsPerTick(40);
        this.attackHorizontalY = pixelsPerSecondToPixelsPerTick(32);
        this.attackDiagonalX = pixelsPerSecondToPixelsPerTick(24);
        this.attackDiagonalY = pixelsPerSecondToPixelsPerTick(48);
        this.attackUpX = 0;
        this.attackUpY = pixelsPerSecondToPixelsPerTick(64);
        this.attackDownX = 0;
        this.attackDownY = pixelsPerSecondToPixelsPerTick(80);

        this.dashPauseFrames = secondsToTicks(1);

        this.grapple = null;
        this.grappleRange = 0;

        this.state = new IdleState(this);
        this.lastState = this.state;

        this.kickbox = new SquareKickbox(this.position, 23, 12, 33, 43);

    }

    keyDown(keyList, hold) {
        hold = hold ?? true;
        for (let i = 0; i < keyList.length; i++) {
            if (hold) {
                if (MDog.Input.Keyboard.isDown(keyList[i])) {
                    return true;
                }
            } else {
                if (MDog.Input.Keyboard.isClicked(keyList[i])) {
                    return true;
                }
            }
        }
        return false;
    }

    getX() {
        return Math.floor(this.position.getX());
    }

    getY() {
        return Math.floor(this.position.getY());
    }

    update() {

        // if (MDog.Math.deltaTime() > 0.02) {
        //     console.log("Lag spike - " + MDog.Math.deltaTime());
        // }

        if (this.keyDown(this.keys.toggleJump, false)) {
            if (!settings.upToJump) {
                for (let i = 0; i < this.keys.up.length; i++) {
                    this.keys.jump.push(this.keys.up[i]);
                }
                settings.upToJump = true;
                console.log("Up to jump enabled!");
            } else {
                for (let i = 0; i < this.keys.up.length; i++) {
                    this.keys.jump.splice(this.keys.jump.indexOf(this.keys.up[i]), 1);
                }
                settings.upToJump = false;
                console.log("Up to jump disabled!");
            }
        }


        if (this.onLeft()) {
            this.lastTouchedLeftWall = true;
        }

        if (this.onRight()) {
            this.lastTouchedLeftWall = false;
        }

        const bufferNames = ["jump", "dash"];
        for (let i = 0; i < bufferNames.length; i++) {
            const name = bufferNames[i];
            if (this.keyBuffers[name].time > 0) {
                this.keyBuffers[name].time -= 1;
            }

            if (this.keyDown(this.keys[name], false)) {
                this.keyBuffers[name].time = this.keyBuffers[name].limit;
            }
        }


        const downKeys = MDog.Input.Keyboard.downKeys;

        if (downKeys.includes("r")) {
            downKeys.splice(downKeys.indexOf("r"), 1);
        }

        if (downKeys.length > 0 && this.startTime === 0) {
            this.startTime = Date.now();
            console.log("Started!");
        }

        this.particleSystem.update();

        const outerRange = 20;
        for (let i = 0; i < this.particleSystem.particles.length; i++) {
            const particle = this.particleSystem.particles[i];
            if (particle.tags.includes("wind")) {
                if (particle.getX() < 0-outerRange) {
                    particle.position.setX(MDog.Draw.getScreenWidthInArtPixels() + outerRange);
                }
                if (particle.getX() > MDog.Draw.getScreenWidthInArtPixels()+outerRange) {
                    particle.position.setX(0-outerRange);
                }
                if (particle.getY() < 0-outerRange) {
                    particle.position.setY(MDog.Draw.getScreenHeightInArtPixels() + outerRange);
                }
                if (particle.getY() > MDog.Draw.getScreenHeightInArtPixels()+outerRange) {
                    particle.position.setY(0-outerRange);
                }
            }
        }

        if (this.onGround()) {

            this.groundCoyoteTime = this.groundCoyoteLimit;
            this.wallCoyoteTime = 0;

            if (!this.state.is(DashAttackState) || this.state.animation.getFrame() > 7) {
                this.hasAirDash = true;
            }
        } else if (this.groundCoyoteTime > 0) {
            this.groundCoyoteTime -= 1;
        }

        if (this.isWallSliding()) {
            this.wallCoyoteTime = this.wallCoyoteLimit;
            this.groundCoyoteTime = 0;
        } else if (this.wallCoyoteTime > 0) {
            this.wallCoyoteTime -= 1;
        }

        if (this.keyDown(this.keys.jump, false)) {
            if (!this.onGround()) {
                for (let i = 0; i < this.game.grapples.length; i++) {
                    const grapple = this.game.grapples[i];
                    const px = this.kickbox.getMiddleX();
                    const py = this.kickbox.getMiddleY();
                    const dist = new Vector(px, py).distanceTo(grapple.position);
                    if (dist < grapple.range) {
                        this.grapple = grapple;
                        this.grappleRange = dist;
                    }
                }
            }
        }

        if (this.grapple === null) {
            this.$doGroundAirMovement();
        } else {
            this.$doGrappleMovement();
        }

        this.$doAnimations();
        this.$doParticles();

        this.camera.update();

        this.lastState = this.state;
    }

    updateMovement() {
        this.position.x += this.velocity.getX();// * MDog.Math.deltaTime()/6;
        this.fixWalls();

        this.position.y += this.velocity.getY();// * MDog.Math.deltaTime()/6;
        this.fixCeil();
        this.fixGround();
    }

    $doGrappleMovement() {

        const fallSpeed = this.maxAirFallSpeed;

        if (this.velocity.y < fallSpeed) {
            this.velocity.y += this.gravity;
            if (this.velocity.y > fallSpeed) {
                this.velocity.setY(fallSpeed);
            }
        }

        // this.updateMovement();
        this.position.x += this.velocity.getX();// * MDog.Math.deltaTime()/6;
        this.position.y += this.velocity.getY();// * MDog.Math.deltaTime()/6;

        if (!this.keyDown(this.keys.jump)) {
            // this.velocity.setX(0);
            // this.velocity.setY(0);
            // this.position.setX(this.grapple.position.getX());
            // this.position.setY(this.grapple.position.getY());
            this.grapple = null;
            return;
        }

        const playerVector = new Vector(this.kickbox.getMiddleX(), this.kickbox.getMiddleY());

        // if player is further than grapple range, bring him in
        const dist = playerVector.distanceTo(this.grapple.position);

        if (dist > this.grappleRange) {
            // playerVector.subtract(this.grapple.position);
            // playerVector.normalize();
            // playerVector.multiply(this.grappleRange);
            // playerVector.add(this.grapple.position);
            // this.position.setX(playerVector.getX() - this.hitbox.x1 + Math.floor(this.hitbox.getWidth()/2));
            // this.position.setY(playerVector.getY() - this.hitbox.y1 + Math.floor(this.hitbox.getHeight()/2));
            //
            // const grappleVector = this.grapple.position.clone();
            // grappleVector.subtract(playerVector);
            // const mag = this.velocity.length();
            //
            // const newVec = grappleVector.clone();
            //
            // newVec.normalize();
            // const saveX = newVec.getX();
            // newVec.setX(-newVec.getY());
            // newVec.setY(saveX);
            // newVec.multiply(mag);
            //
            // console.log(mag)
            //
            // this.velocity.setX(newVec.getX());
            // this.velocity.setY(newVec.getY());

            // redirect velocity
        } else {
            this.grappleRange = dist;
        }


        // if player is in grapple range, do nothing

        // update player position by his velocity

        // if player is further than grapple range, bring him in, redirect velocity
    }

    $doGroundAirMovement() {
        if (this.keyBuffers.dash.time > 0 &&
            this.hasAirDash &&
            this.state.canDashAttack()) {

            this.keyBuffers.dash.time = 0;
            this.hasAirDash = false;
            this.setState(DashAttackState);
        }

        if (this.state.is(DashAttackState)) {

            if (this.state.animation.getFrame() < this.dashPauseFrames && !this.state.dashed) {
                const direction = new Vector();

                if (this.keyDown(this.keys.up)) {
                    direction.add(0, -1);
                }
                if (this.keyDown(this.keys.down)) {
                    direction.add(0, 1);
                }
                if (this.keyDown(this.keys.right)) {
                    direction.add(1, 0);
                }
                if (this.keyDown(this.keys.left)) {
                    direction.add(-1, 0);
                }

                if (direction.x !== 0 || direction.y !== 0) {
                    this.state.direction.x = direction.x;
                    this.state.direction.y = direction.y;
                }
            }

            if (this.state.animation.getFrame() >= this.dashPauseFrames && !this.state.dashed) {
                this.state.dashed = true;

                const direction = this.state.direction.clone();

                if (direction.x === 0 && direction.y === 0) {
                    direction.setX(this.facingLeft ? -1 : 1);
                }
                if (direction.x !== 0) {
                    this.facingLeft = direction.x === -1;
                }

                let newVel = new Vector();
                if (direction.x !== 0 && direction.y === 0) {
                    newVel.set(direction.x * this.attackHorizontalX, -this.attackHorizontalY);
                } else if (direction.x !== 0 && direction.y === -1) {
                    newVel.set(direction.x * this.attackDiagonalX, -this.attackDiagonalY);
                } else if (direction.x === 0 && direction.y === -1) {
                    newVel.set(this.attackUpX, -this.attackUpY);
                } else if (direction.y === 1) {
                    newVel.set(this.attackDownX, this.attackDownY);
                }


                // Stops dashing from slowing velocity
                if (newVel.getX() > 0) {
                    newVel.setX(Math.max(newVel.getX(), this.velocity.getX()));
                }
                if (newVel.getX() < 0) {
                    newVel.setX(Math.min(newVel.getX(), this.velocity.getX()));
                }
                if (newVel.getY() > 0) {
                    newVel.setY(Math.max(newVel.getY(), this.velocity.getY()));
                }
                if (newVel.getY() < 0) {
                    newVel.setY(Math.min(newVel.getY(), this.velocity.getY()));
                }

                this.velocity.set(newVel.multiply(dt)); // penis

                let pv = direction.clone();
                pv.normalize();
                pv.multiply(this.velocity.length() * 4 / timeFactor);
                // pv.multiply(3);

                const move = 0.5;

                // *3-1

                for (let i = 0; i < 50; i++) {
                    let x = Math.floor((Math.random())*MDog.Draw.getScreenWidthInArtPixels());
                    let y = Math.floor((Math.random())*MDog.Draw.getScreenHeightInArtPixels());
                    this.particleSystem.addParticle(
                        new MDog.FX.LineParticle(
                            x,
                            y,
                            Math.floor(rnd(5, 20)) / timeFactor,
                            "#ffffff" + Math.floor(rnd(3, 9)) + "0",
                            pv.getX() + rnd(-move, move),
                            pv.getY() + rnd(-move, move),
                            {
                                gx: 0,
                                gy: 0,
                                layer: 10,
                                length: Math.floor(rnd(10, 20)),
                                tags: ["wind"]
                            }
                        ));
                }

                pv.multiply(0.25);

                for (let i = 0; i < 13; i++) {
                    let x = Math.floor((Math.random()) * MDog.Draw.getScreenWidthInArtPixels());
                    let y = Math.floor((Math.random()) * MDog.Draw.getScreenHeightInArtPixels());
                    this.particleSystem.addParticle(
                        new MDog.FX.ChunkParticle(
                            x,
                            y,
                            Math.floor(rnd(30, 100)) / timeFactor,
                            "#287013",
                            pv.getX(),
                            pv.getY(),
                            {
                                gx: 0,
                                gy: 0,
                                size: Math.floor(rnd(2, 5)),
                                layer: 10,
                                tags: ["wind"]
                            }
                        ));
                }
            }
        }

        let goalVelX = 0;
        const acc = this.onGround() ? this.groundAcceleration : this.airAcceleration;
        if (this.keyDown(this.keys.right)) {
            goalVelX += acc;
        }
        if (this.keyDown(this.keys.left)) {
            goalVelX -= acc;
        }

        if (!(this.onLeft() && goalVelX < 0) &&
            !(this.onRight() && goalVelX > 0)) {

            // console.log(this.maxRunSpeed, this.velocity.getX());
            //
            // console.log(goalVelX)

            if (this.velocity.getX() + goalVelX <= this.maxRunSpeed &&
                this.velocity.getX() + goalVelX >= -this.maxRunSpeed) {
                // This part makes sure that you can turn around on a dime when touching a wall and you don't get stuck with weird velocity timing
                if (this.onLeft() && goalVelX > 0 && this.velocity.getX() < 0) {
                    this.velocity.setX(0);
                }
                if (this.onRight() && goalVelX < 0 && this.velocity.getX() > 0) {
                    this.velocity.setX(0);
                }

                this.velocity.x += goalVelX;
                if (this.velocity.getX() > this.maxRunSpeed) {
                    this.velocity.setX(this.maxRunSpeed);
                }
                if (this.velocity.getX() < -this.maxRunSpeed) {
                    this.velocity.setX(-this.maxRunSpeed);
                }
            }
        }

        // && this.onGround()

        if ((goalVelX === 0) ||
            (Math.sign(goalVelX) !== 0 && Math.sign(goalVelX) !== Math.sign(this.velocity.getX())) ||
            (this.onRight() && this.velocity.getX() > 0) ||
            (this.onLeft() && this.velocity.getX() < 0)) {

            const decel = this.onGround() ? this.groundDeceleration : this.airDeceleration;

            if (this.velocity.getX() > 0) {
                this.velocity.x -= decel;
                if (this.velocity.getX() < 0) {
                    this.velocity.setX(0);
                }
            }
            if (this.velocity.getX() < 0) {
                this.velocity.x += decel;
                if (this.velocity.getX() > 0) {
                    this.velocity.setX(0);
                }
            }
        }

        if (!this.onGround()) {
            if (!this.isWallSliding()) {
                const fallSpeed = this.maxAirFallSpeed;

                if (this.velocity.y < fallSpeed) {
                    this.velocity.y += this.gravity;
                    if (this.velocity.y > fallSpeed) {
                        this.velocity.setY(fallSpeed);
                    }
                }
            } else {
                const fallSpeed = this.maxWallSlideFallSpeed;

                if (this.velocity.y < fallSpeed) {
                    this.velocity.y += this.gravity;
                    if (this.velocity.y > fallSpeed) {
                        this.velocity.setY(fallSpeed);
                    }
                }

                if (this.velocity.y > fallSpeed) {
                    this.velocity.y -= this.wallDeceleration;
                    if (this.velocity.y < fallSpeed) {
                        this.velocity.setY(fallSpeed);
                    }
                }
            }
        } else {
            this.velocity.setY(Math.min(this.velocity.y, 0));
        }

        if (this.keyBuffers.jump.time > 0) {
            if (this.onGround()) {
                this.jumpHoldTime = this.jumpHoldLimit;
                this.groundCoyoteTime = 0;
                this.velocity.setY(-this.jumpForce);

                this.keyBuffers.jump.time = 0;
            } else if (this.groundCoyoteTime > 0) {
                this.jumpHoldTime = this.jumpHoldLimit;
                this.groundCoyoteTime = 0;
                this.velocity.setY(-this.jumpForce);

                this.keyBuffers.jump.time = 0;
            } else if (this.isWallSliding() || this.wallCoyoteTime > 0) {
                this.wallCoyoteTime = 0;
                const xVel = this.lastTouchedLeftWall ? this.wallJumpXStrength : -this.wallJumpXStrength;
                this.velocity.setX(xVel);
                this.velocity.setY(-this.wallJumpYStrength);
                this.facingLeft = this.velocity.getX() < 0;

                this.keyBuffers.jump.time = 0;
            }
        }

        if (this.keyDown(this.keys.jump)) {
            if ((!this.onGround()) &&
                (!this.groundCoyoteTime > 0) &&
                this.jumpHoldTime > 0) {
                this.jumpHoldTime -= 1;
                this.velocity.setY(-this.jumpForce);
            }
        }

        if (!this.keyDown(this.keys.jump)) {
            if (!this.onGround()) {
                this.jumpHoldTime = 0;
            }
        }

        if (!(this.state.is(DashAttackState) && !this.state.dashed)) {
            this.updateMovement();
        }
    }

    // test

    $doParticles() {
        // if (!this.onGround()) {
        //     const velCheck = this.velocity.clone();
        //     velCheck.y /= 1.7;
        //     velCheck.x *= 3;
        //     if (Math.random()*velCheck.length() > 1.3) {
        //         const move = this.velocity.clone();
        //         move.multiply(-0.5);
        //         const add = this.velocity.clone();
        //         add.normalize();
        //         add.multiply(5);
        //         for (let i = 0; i < 1; i++) {
        //             let x = Math.floor(rnd(this.hitbox.getX(1), this.hitbox.getX(2)) + add.getX());
        //             let y = Math.floor(rnd(this.hitbox.getY(1), this.hitbox.getY(2)) + add.getY());
        //             this.particleSystem.addParticle(
        //                 new MDog.FX.LineParticle(
        //                     x,
        //                     y,
        //                     Math.floor(rnd(5, 15) * velCheck.length()),
        //                     "#ffffff" + Math.floor(rnd(3, 9)) + "0", // "#287013", //
        //                     move.getX(),
        //                     move.getY(),
        //                     {
        //                         gx: 0,
        //                         gy: 0,
        //                         length: 10,
        //                         // size: Math.floor(rnd(1, 3)),
        //                     }
        //                 ));
        //         }
        //     }
        // }
        if (this.onGround() && this.state.is(RunningState)) {

            const grass = 2;
            const red = 0;

            const groundMaterial = this.getGroundMaterial();

            if (groundMaterial === grass) {
                if (rnd(10) < 3) {

                    let color;
                    let size;
                    if (rnd(10) > 3) {
                        color = "#31930f";
                        size = Math.floor(rnd(1, 3));
                    } else {
                        color = "#963e0a";
                        size = 1;
                    }

                    this.particleSystem.addParticle(
                        new MDog.FX.ChunkParticle(
                            this.kickbox.getLeftX() + Math.floor(Math.floor(rnd(0, this.kickbox.getWidth()))),
                            this.kickbox.getBottomY() + Math.floor(rnd(-2, 2)) + 2,
                            Math.floor(rnd(10, 30)),
                            color,
                            rnd(-1, 1) * 0.5 + (this.facingLeft ? 1 : -1) * 0.5,
                            rnd(-1, -0.5),
                            {
                                gx: 0,
                                gy: 0.05,
                                size: size
                            }
                        ));
                }
            } else if (groundMaterial === red) {
                if (rnd(10) < 3) {

                    let color = "#ff0000";
                    let size = 1; //Math.floor(rnd(1, 3));

                    this.particleSystem.addParticle(
                        new MDog.FX.ChunkParticle(
                            this.kickbox.getLeftX() + Math.floor(Math.floor(rnd(0, this.kickbox.getWidth()))),
                            this.kickbox.getBottomY() + Math.floor(rnd(-2, 2)) + 2,
                            Math.floor(rnd(10, 30)),
                            color,
                            rnd(-1, 1) * 0.5 + (this.facingLeft ? 1 : -1) * 0.5,
                            rnd(-1, -0.5),
                            {
                                gx: 0,
                                gy: 0.05,
                                size: size
                            }
                        ));
                }
            }
        }
    }

    $doAnimations() {
        if (this.onGround()) {
            if ((!(this.state.is(DashAttackState))) || this.state.time < 2) {
                if (this.velocity.x > this.flipMargin) {
                    this.facingLeft = false;
                }
                if (this.velocity.x < -this.flipMargin) {
                    this.facingLeft = true;
                }
            }
        } else if (this.isWallSliding() && this.isFalling()) {
            this.facingLeft = !this.onLeft();
        }

        if (this.isWallSliding() && this.isFalling()) {
            this.setState(WallSlideState);
        } else if (!this.onGround()) {
            if (this.isFalling()) {
                const check = this.check(1, Math.floor(this.kickbox.getWidth()/2), 3, 20);
                if (!check) {
                    this.setState(FallState);
                }
            } else {
                this.setState(JumpState);
            }
        } else {
            if (Math.abs(this.velocity.x) > this.runMargin &&
                !(this.velocity.x > 0 && this.onRight()) &&
                !(this.velocity.x < 0 && this.onLeft())) {
                this.setState(RunningState);
            } else {
                this.setState(IdleState);
            }
        }
    }

    fixWalls() {
        if (this.inRight()) {
            this.position.setX(Math.floor(this.position.getX()));
        }
        while (this.inRight()) {
            this.position.setX(Math.floor(this.position.getX()) - 1);
        }
        if (this.inLeft()) {
            this.position.setX(Math.floor(this.position.getX()));
        }
        while (this.inLeft()) {
            this.position.setX(Math.floor(this.position.getX()) + 1);
        }
    }

    fixGround() {
        if (this.inGround()) {
            this.position.setY(Math.floor(this.position.getY()));
            this.velocity.setY(Math.max(this.velocity.y, 0));
            while(this.inGround()) {
                this.position.y -= 1;
            }
        }
    }

    fixCeil() {
        if (this.inCeil()) {
            this.position.setY(Math.floor(this.position.getY()));
            this.velocity.setY(Math.max(this.velocity.y, 0));
            while(this.inCeil()) {
                this.position.y += 1;
            }
        }
    }

    isFalling() {
        return this.velocity.getY() >= 0;
    }

    isWallSliding() {
        if (!this.state.canWallSlide()) {
            return false;
        }
        return !this.onGround() &&
            // ((this.onLeft() && this.keyDown(this.keys.left)) ||
            //     (this.onRight() && this.keyDown(this.keys.right))) &&
            (this.onLeft() || this.onRight()); // &&
        // this.isFalling();
    }

    getMaterial(x, y) {
        const first = this.game.tilemaps.kickbox.screenToTile(x, y);
        return this.game.tilemaps.kickbox.get(first.x,first.y)
    }

    check(x1, xp1, y1, yp1) {
        return this.getMaterial(this.kickbox.getX(x1) + xp1, this.kickbox.getY(y1) + yp1)  !== -1;
    }

    getGroundMaterial() {
        return this.getMaterial(this.kickbox.getX(1) + Math.floor(this.kickbox.getWidth()/2), this.kickbox.getY(3) + 14)
    }

    onGround() {
        return this.check(1, 0, 3, 0) || this.check(2, 0, 3, 0);
    }
    inGround() {
        return this.check(1, 0, 2, 0) || this.check(2, 0, 2, 0);
    }

    onLeft() {
        return this.check(0, 0, 1, 0) || this.check(0, 0 , 2, 0) || this.check(0, 0, 1, Math.floor(this.kickbox.getHeight()/2));
    }
    inLeft() {
        return this.check(1, 0, 1, 0) || this.check(1, 0, 2, 0) || this.check(1, 0, 1, Math.floor(this.kickbox.getHeight()/2));
    }

    onRight() {
        return this.check(3, 0, 1, 0) || this.check(3, 0, 2, 0) || this.check(3, 0, 1, Math.floor(this.kickbox.getHeight()/2));
    }
    inRight() {
        return this.check(2, 0, 1, 0) || this.check(2, 0, 2, 0) || this.check(2, 0, 1, Math.floor(this.kickbox.getHeight()/2));
    }

    inCeil() {
        return this.check(1, 0, 0, 0) || this.check(2, 0, 0, 0);
    }

    setState(stateClass) {
        if (this.state.is(DashAttackState)) {
            if (stateClass === DashAttackState) {
                this.state = new stateClass(this);
                return;
            }
            return;
        }
        if (this.state.is(stateClass)) {
            return;
        }
        if (this.state.is(JumpState) && stateClass === FallState) {
            this.state = new JumpToFallState(this);
            return;
        }
        if (this.state.is(JumpToFallState) && stateClass === FallState) {
            return;
        }
        // if ((stateClass === FallState || stateClass === JumpToFallState) && (this.state.is(RunningState) || this.state.is(IdleState))) {
        //     return;
        // }
        this.state = new stateClass(this);
    }

    hardSetState(stateClass) {
        this.state = new stateClass(this);
    }

    draw() {
        this.state.draw();
        MDog.Draw.particleSystem(this.particleSystem);


        // for (let i = 0; i < this.game.coins.length; i++) {
        //     const coin = this.game.coins[i];
        //
        //     const centerPlayer = new Vector(this.hitbox.getMiddleX(), this.hitbox.getMiddleY());
        //     const centerCoin = new Vector(coin.getX()+8, coin.getY()+8);
        //     const coinVector = centerCoin.clone();
        //
        //     coinVector.subtract(centerPlayer);
        //     coinVector.normalize();
        //     coinVector.multiply(20);
        //
        //     const centerPlayerOut = centerPlayer.clone();
        //
        //     centerPlayer.add(coinVector);
        //     centerPlayer.add(coinVector);
        //
        //     centerPlayerOut.add(coinVector);
        //     centerPlayerOut.add(coinVector);
        //     centerPlayerOut.add(coinVector);
        //
        //     MDog.Draw.line(
        //         centerPlayer.getX(),
        //         centerPlayer.getY(),
        //         centerPlayer.getX() + coinVector.getX(),
        //         centerPlayer.getY() + coinVector.getY(),
        //         "#ffffff");
        // }
    }
}

export default Player;