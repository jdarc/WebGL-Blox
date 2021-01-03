#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uTexture;
in vec2 vTexCoords;
out vec4 fragColor;

void main() {
    fragColor = vec4(pow(texture(uTexture, vTexCoords).rgb, vec3(1.0 / 2.2)), 1.0);
}
