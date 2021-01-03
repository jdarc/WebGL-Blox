#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

const float EPSILON = 0.0001;
const float PI = radians(180.0);
const float HUGE = 1000000.0;
const float U1 = 1.0 / 256.0;
const float U2 = 2.0 / 256.0;
const float U3 = 3.0 / 256.0;
const float U4 = 4.0 / 256.0;
const float BLUR_RADIUS = 0.01;
const vec3 BG_COLOR = vec3(0.1, 0.1, 0.2);

uniform vec3 uOrigin;
uniform mat4 uMatrix;
uniform sampler2D uSampler;
uniform sampler2D uTexture;
uniform float uSeed;
uniform float uTextureWeight;
uniform float uFocalDistance;
uniform float uWidth;
uniform float uHeight;

in vec2 vTexCoords;
out vec4 fragColor;

float seed;

struct Box { vec3 min; vec3 max; vec3 rgb; vec3 lit; };

Box getBox(int index) {
    float u = float(index) * U4;
    vec3 min = texture(uSampler, vec2(u, 0.0)).rgb;
    vec3 max = texture(uSampler, vec2(u + U1, 0.0)).rgb;
    vec3 rgb = texture(uSampler, vec2(u + U2, 0.0)).rgb;
    vec3 lit = texture(uSampler, vec2(u + U3, 0.0)).rgb;
    return Box(min, max, rgb, lit);
}

float rand() {
    seed += 0.001573519;
    return fract(sin(dot(gl_FragCoord.xy, vec2(0.129898 + seed, 0.782331 + seed))) * 43758.5453903);
}

vec3 weightedBounce(vec3 normal) {
    float r1 = rand() * 2.0 * PI;
    float r2 = rand();
    vec3 u = normalize(cross(normal.yzx, normal));
    vec3 v = cross(normal, u);
    return (u * cos(r1) + v * sin(r1)) * sqrt(r2) + normal * sqrt(1.0 - r2);
}

float intersectAABB(in int index, in vec3 origin, in vec3 direction) {
    Box box = getBox(index);
    vec3 t0 = (box.min - origin) / direction;
    vec3 t1 = (box.max - origin) / direction;
    vec3 r0 = min(t0, t1);
    vec3 r1 = max(t0, t1);
    float tn = max(r0.x, max(r0.y, r0.z));
    float tf = min(r1.x, min(r1.y, r1.z));
    return (tn <= tf) && (tf > EPSILON) ? tn : HUGE;
}

vec3 normalForAABB(in int index, in vec3 hit) {
    Box box = getBox(index);
    if (hit.x < box.min.x + EPSILON) return vec3(-1.0, 0.0, 0.0);
    if (hit.x > box.max.x - EPSILON) return vec3(1.0, 0.0, 0.0);
    if (hit.y < box.min.y + EPSILON) return vec3(0.0, -1.0, 0.0);
    if (hit.y > box.max.y - EPSILON) return vec3(0.0, 1.0, 0.0);
    if (hit.z < box.min.z + EPSILON) return vec3(0.0, 0.0, -1.0);
    return vec3(0.0, 0.0, 1.0);
}

bool intersect(vec3 origin, vec3 direction, out vec3 position, out vec3 normal, out vec3 diffuse, out vec3 emittance) {
    float hitResult = 1.0;
    int hitIndex;
    for (int i = 0; i < 64; ++i) {
        float t = intersectAABB(i, origin, direction);
        if (t < hitResult) {
            hitResult = t;
            hitIndex = i;
        }
    }

    if (hitResult < 1.0) {
        Box box = getBox(hitIndex);
        position = origin + direction * hitResult;
        normal = normalForAABB(hitIndex, position);
        diffuse = box.rgb;
        emittance = box.lit;
        return true;
    }
    return false;
}

void main(void) {
    seed = uSeed;
    vec4 worldir = uMatrix * vec4(2.0 * (gl_FragCoord.xy + vec2(rand(), rand())) / vec2(uWidth, uHeight) - 1.0, 1.0, 1.0);
    vec3 direction = worldir.xyz / worldir.w;
    vec3 origin = uOrigin;

    float r1 = rand() * PI;
    float r2 = rand();
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), direction));
    vec3 up = normalize(cross(direction, right)) * sin(r1) * r2 * BLUR_RADIUS;
    right *= cos(r1) * r2 * BLUR_RADIUS;
    vec3 p = origin + normalize(direction) * uFocalDistance;

    origin = origin + up + right;
    direction = normalize(p - origin) * 100.0;

    float dist = 100.0;
    vec3 color = vec3(0.0);
    vec3 reflectance = vec3(1.0);
    vec3 position, normal, diffuse, emittance;
    for (int depth = 0; depth < 4; ++depth) {
        if (intersect(origin, direction, position, normal, diffuse, emittance)) {
            if (depth == 0) { dist = length(position - origin); }
            color += reflectance * emittance;
            reflectance *= diffuse;
            origin = position + normal * EPSILON;
            direction = weightedBounce(normal) * 100.0;
        } else {
            color += reflectance * BG_COLOR;
            break;
        }
    }

    fragColor = vec4(mix(color, texture(uTexture, vTexCoords).rgb, uTextureWeight), dist);
}
