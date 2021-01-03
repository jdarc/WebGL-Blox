export class Camera {
    constructor(fieldOfView, aspectRatio, nearPlane, farPlane) {
        this.fieldOfView = fieldOfView;
        this.aspectRatio = aspectRatio;
        this.nearPlane = nearPlane;
        this.farPlane = farPlane;
        this.center = new Float32Array([0.0, 0.0, 0.0]);
        this.eye = new Float32Array([0.0, 0.0, 1.0]);
        this.up = new Float32Array([0.0, 1.0, 0.0]);
        this.matrix = new Float32Array(16);
    }

    moveTo(x, y, z) {
        this.eye[0] = x;
        this.eye[1] = y;
        this.eye[2] = z;
    }

    lookAt(x, y, z) {
        this.center[0] = x;
        this.center[1] = y;
        this.center[2] = z;
    }

    update() {
        const tan = Math.tan(this.fieldOfView / 2.0);
        const nf = (this.nearPlane - this.farPlane) / (2.0 * this.farPlane * this.nearPlane);
        const fn = (this.farPlane + this.nearPlane) / (2.0 * this.farPlane * this.nearPlane);
        const z0 = this.eye[0] - this.center[0];
        const z1 = this.eye[1] - this.center[1];
        const z2 = this.eye[2] - this.center[2];
        const lz = 1.0 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
        const x0 = this.up[1] * z2 - this.up[2] * z1;
        const x1 = this.up[2] * z0 - this.up[0] * z2;
        const x2 = this.up[0] * z1 - this.up[1] * z0;
        const lx = tan * this.aspectRatio / Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
        const y0 = z1 * x2 - z2 * x1;
        const y1 = z2 * x0 - z0 * x2;
        const y2 = z0 * x1 - z1 * x0;
        const ly = tan / Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
        this.matrix[0] = x0 * lx;
        this.matrix[1] = x1 * lx;
        this.matrix[2] = x2 * lx;
        this.matrix[3] = 0.0;
        this.matrix[4] = y0 * ly;
        this.matrix[5] = y1 * ly;
        this.matrix[6] = y2 * ly;
        this.matrix[7] = 0.0;
        this.matrix[8] = this.eye[0] * nf;
        this.matrix[9] = this.eye[1] * nf;
        this.matrix[10] = this.eye[2] * nf;
        this.matrix[11] = nf;
        this.matrix[12] = this.eye[0] * fn - z0 * lz;
        this.matrix[13] = this.eye[1] * fn - z1 * lz;
        this.matrix[14] = this.eye[2] * fn - z2 * lz;
        this.matrix[15] = fn;
    }
}
