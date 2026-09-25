// Vanilla clouds are replaced by the procedural sky clouds.
varying vec2 texcoord;

#ifdef VSH
void main() {
    texcoord = vec2(0.0);
    gl_Position = vec4(10.0, 10.0, 10.0, 1.0);
}
#endif

#ifdef FSH
void main() {
    discard;
}
#endif
