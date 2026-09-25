// One-thread compute pass that does nothing. Iris issues a memory barrier
// after compute dispatches, which makes the shadow pass's voxel writes
// (imageAtomicMax) visible to the texture fetches in the deferred passes.
layout(local_size_x = 1, local_size_y = 1, local_size_z = 1) in;
const ivec3 workGroups = ivec3(1, 1, 1);

void main() {}
