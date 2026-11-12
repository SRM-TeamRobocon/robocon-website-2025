#include "../tap-queue.h"
#include <cassert>
#include <cstdio>
#include <cstring>

int main() {
  TapQueue queue;
  assert(queue.valid());
  for (unsigned i = 0; i < 64; ++i) {
    StoredTap tap = {};
    tap.sequence = i + 1;
    std::snprintf(tap.id, sizeof(tap.id), "%032x", i + 1);
    std::strcpy(tap.uid, "04A1B2C3");
    assert(queue.push(tap));
  }
  assert(queue.valid());
  assert(!queue.push({}));
  assert(!queue.pop("wrong acknowledgment"));
  assert(queue.count == 64);
  // Simulate reboot by restoring the exact bytes stored in the NVS blob.
  TapQueue restored;
  std::memcpy(&restored, &queue, sizeof(queue));
  assert(restored.valid());
  for (unsigned i = 0; i < 64; ++i) {
    char id[33];
    std::snprintf(id, sizeof(id), "%032x", i + 1);
    assert(restored.taps[0].sequence == i + 1);
    assert(restored.pop(id));
    assert(restored.valid());
  }
  assert(!restored.pop("anything"));
  restored.version = 2;
  assert(!restored.valid());
  restored.version = 1;
  restored.count = 65;
  assert(!restored.valid());
  std::puts("tap queue checks passed");
}
