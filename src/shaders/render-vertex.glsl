#version 300 es

in vec2 aPosition;
out vec2 vTexCoords;

void main() {
    vTexCoords = aPosition * vec2(0.5, 0.5) + vec2(0.5, 0.5);
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
