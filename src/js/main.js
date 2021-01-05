import '../css/main.css';

import { Scene } from "./scene";
import { Camera } from "./camera";
import { Controller } from "./controller";

import renderVertShaderSource from "../shaders/render-vertex.glsl";
import renderFragShaderSource from "../shaders/render-fragment.glsl";
import tracerFragShaderSource from "../shaders/tracer-fragment.glsl";

const compileShader = (gl, shaderSource, shaderType) => {
    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw "Shader compilation failed:" + gl.getShaderInfoLog(shader);
    }
    return shader;
};

const createProgram = (gl, vertexShader, fragmentShader) => {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw ("Program linking failed:" + gl.getProgramInfoLog(program));
    }
    return program;
};

const createTexture = (gl, width, height, internalFormat, format, type, data) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internalFormat, width, height);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
};

const computeDOF = (gl, e, framebuffer) => {
    const x = Math.floor(gl.drawingBufferWidth * e.clientX / e.target.clientWidth);
    const y = Math.floor(gl.drawingBufferHeight * e.clientY / e.target.clientHeight);
    const pixels = new Float32Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.FLOAT, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return pixels[((gl.drawingBufferHeight - y - 1) * gl.drawingBufferWidth + x) * 4 + 3];
};

const createQuadProgram = gl => {
    const vertexShader = compileShader(gl, renderVertShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, renderFragShaderSource, gl.FRAGMENT_SHADER);
    const program = createProgram(gl, vertexShader, fragmentShader);
    program.aPositionLocation = gl.getAttribLocation(program, "aPosition");
    program.uTextureLocation = gl.getUniformLocation(program, "uTexture");
    gl.enableVertexAttribArray(program.aPositionLocation);
    return program;
};

const createTracerProgram = gl => {
    const vertexShader = compileShader(gl, renderVertShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, tracerFragShaderSource, gl.FRAGMENT_SHADER);
    const program = createProgram(gl, vertexShader, fragmentShader);
    program.aPositionLocation = gl.getAttribLocation(program, "aPosition");
    program.uSampleLocation = gl.getUniformLocation(program, "uSampler");
    program.uTextureLocation = gl.getUniformLocation(program, "uTexture");
    program.uSeedLocation = gl.getUniformLocation(program, "uSeed");
    program.uWidthLocation = gl.getUniformLocation(program, "uWidth");
    program.uHeightLocation = gl.getUniformLocation(program, "uHeight");
    program.uOriginLocation = gl.getUniformLocation(program, "uOrigin");
    program.uMatrixLocation = gl.getUniformLocation(program, "uMatrix");
    program.uTextureWeightLocation = gl.getUniformLocation(program, "uTextureWeight");
    program.uFocalDistance = gl.getUniformLocation(program, "uFocalDistance");
    gl.enableVertexAttribArray(program.aPositionLocation);
    return program;
};

const run = canvas => {
    const camera = new Camera(Math.PI / 4.0, canvas.width / canvas.height, 1.0, 1000.0);
    camera.moveTo(4.28, 3.48, 6.15);
    camera.lookAt(-0.84, 0.23, 0.29);
    const controller = new Controller(camera);

    const gl = canvas.getContext('webgl2', { alpha: false, stencil: false, depth: false, powerPreference: "high-performance" });
    gl.getExtension('EXT_color_buffer_float');

    const renderProgram = createQuadProgram(gl);
    const tracerProgram = createTracerProgram(gl);
    const sceneTexture = createTexture(gl, 256, 1, gl.RGBA32F, gl.RGBA, gl.FLOAT, Scene);
    const framebuffer = gl.createFramebuffer();

    const vertices = [-1.0, -1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0];
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const traceTextures = [];
    let sampleCount = 0;
    let focalDistance = 2.0;
    let tock = 0;

    const resize = () => {
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.deleteTexture(traceTextures[0]);
            gl.deleteTexture(traceTextures[1]);
            traceTextures.splice(0, traceTextures.length);
            const empty = new Float32Array(canvas.width * canvas.height * 4);
            traceTextures.push(createTexture(gl, canvas.width, canvas.height, gl.RGBA32F, gl.RGBA, gl.FLOAT, empty));
            traceTextures.push(createTexture(gl, canvas.width, canvas.height, gl.RGBA32F, gl.RGBA, gl.FLOAT, empty));
            camera.aspectRatio = canvas.width / canvas.height;
            sampleCount = 0;
        }
    };

    const trace = () => {
        gl.useProgram(tracerProgram);
        gl.uniform1f(tracerProgram.uSeedLocation, Math.random());
        gl.uniform1f(tracerProgram.uWidthLocation, canvas.width);
        gl.uniform1f(tracerProgram.uHeightLocation, canvas.height);
        gl.uniform1f(tracerProgram.uTextureWeightLocation, sampleCount / ++sampleCount);
        gl.uniform3fv(tracerProgram.uOriginLocation, camera.eye);
        gl.uniformMatrix4fv(tracerProgram.uMatrixLocation, gl.FALSE, camera.matrix);
        gl.uniform1i(tracerProgram.uSampleLocation, 0);
        gl.uniform1i(tracerProgram.uTextureLocation, 1);
        gl.uniform1f(tracerProgram.uFocalDistance, focalDistance);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, traceTextures[0]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, traceTextures[1], 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(tracerProgram.aPositionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        traceTextures.reverse();
    };

    const display = () => {
        gl.useProgram(renderProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, traceTextures[0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(renderProgram.aPositionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const render = timestamp => {
        if (tock === 0) tock = timestamp;
        const delta = timestamp - tock;
        tock = timestamp;

        window.requestAnimationFrame(render);
        controller.update(1.0, delta / 100.0);
        if (controller.isMoving()) sampleCount = 0;

        resize();
        trace();
        display();
    };

    window.addEventListener("keydown", e => controller.handleKeyDown(e.code) && (sampleCount = 0));
    window.addEventListener("keyup", e => controller.handleKeyUp(e.code) && (sampleCount = 0));
    window.addEventListener("mousedown", e => (e.button === 0) && controller.handleMouseDown());
    window.addEventListener("mouseup", _ => controller.handleMouseUp());
    window.addEventListener("mousemove", e => controller.handleMouseMove(e.clientX, e.clientY) && (sampleCount = 0));
    window.addEventListener("dblclick", e => (focalDistance = computeDOF(gl, e, framebuffer)) && (sampleCount = 0));

    window.requestAnimationFrame(render)
};

window.addEventListener("load", () => run(document.getElementById('viewport')));
