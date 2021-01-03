export class Controller {
    constructor(camera) {
        this.camera = camera;
        this.movementMask = 0;
        this.lastMouseXPos = 0;
        this.lastMouseYPos = 0;
        this.dragging = false;
        this.lookX = camera.center[0] - camera.eye[0];
        this.lookY = camera.center[1] - camera.eye[1];
        this.lookZ = camera.center[2] - camera.eye[2];
        const len = 1.0 / Math.sqrt(this.lookX * this.lookX + this.lookY * this.lookY + this.lookZ * this.lookZ);
        this.lookX *= len;
        this.lookY *= len;
        this.lookZ *= len;
        this.yaw = Math.atan2(-this.lookX, -this.lookZ);
        this.pitch = Math.asin(this.lookY);
    };

    isMoving() {
        return this.movementMask !== 0;
    }

    handleKeyUp(code) {
        if (code === 'KeyW') {
            this.movementMask ^= 1;
            return true;
        } else if (code === 'KeyS') {
            this.movementMask ^= 2;
            return true;
        } else if (code === 'KeyA') {
            this.movementMask ^= 4;
            return true;
        } else if (code === 'KeyD') {
            this.movementMask ^= 8;
            return true;
        }
        return false;
    }

    handleKeyDown(code) {
        switch (code) {
            case 'KeyW':
                this.movementMask |= 1;
                return true;
            case 'KeyS':
                this.movementMask |= 2;
                return true;
            case 'KeyA':
                this.movementMask |= 4;
                return true;
            case 'KeyD':
                this.movementMask |= 8;
                return true;
        }
        return false;
    }

    handleMouseDown() {
        this.dragging = true;
    }

    handleMouseUp() {
        this.dragging = false;
    }

    handleMouseMove(x, y) {
        if (this.dragging) {
            this.yaw -= 0.005 * (x - this.lastMouseXPos);
            this.pitch -= 0.005 * (y - this.lastMouseYPos);
            this.pitch = Math.max(-1.57, Math.min(this.pitch, 1.57));
            this.lookX = -Math.sin(this.yaw) * Math.cos(this.pitch);
            this.lookY = Math.sin(this.pitch);
            this.lookZ = -Math.cos(this.yaw) * Math.cos(this.pitch);
        }
        this.lastMouseXPos = x;
        this.lastMouseYPos = y;
        return this.dragging;
    }

    update(seconds, speed) {
        let [x, y, z] = this.camera.eye;
        const scaledSpeed = seconds * speed;
        const scalar = scaledSpeed / Math.sqrt(this.lookZ * this.lookZ + this.lookX * this.lookX);

        if ((this.movementMask & 1) === 1) {
            x += this.lookX * scaledSpeed;
            y += this.lookY * scaledSpeed;
            z += this.lookZ * scaledSpeed;
        } else if ((this.movementMask & 2) === 2) {
            x -= this.lookX * scaledSpeed;
            y -= this.lookY * scaledSpeed;
            z -= this.lookZ * scaledSpeed;
        }

        if ((this.movementMask & 4) === 4) {
            x -= -this.lookZ * scalar;
            z -= this.lookX * scalar;
        } else if ((this.movementMask & 8) === 8) {
            x += -this.lookZ * scalar;
            z += this.lookX * scalar;
        }

        this.camera.moveTo(x, y, z);
        this.camera.lookAt(x + this.lookX, y + this.lookY, z + this.lookZ);
        this.camera.update();
    }
}
