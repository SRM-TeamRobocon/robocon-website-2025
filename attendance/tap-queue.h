#pragma once
#include <stdint.h>
#include <stddef.h>

// Kept in the header so Arduino's generated function prototypes can use this type.
struct UploadResult {
  char id[33];
  char event[20];
  char action[4];
  char name[17];
};

// Stored as one atomic NVS blob. Keep this layout stable across firmware updates.
struct StoredTap {
  uint64_t sequence;
  uint64_t boot;
  int64_t uptimeUs;
  int64_t epoch;
  char id[33];
  char uid[21];
};

struct TapQueue {
  uint32_t version = 1;
  uint32_t count = 0;
  StoredTap taps[64] = {};

  bool valid() const {
    if (version != 1 || count > 64) return false;
    for (uint32_t i = 0; i < count; ++i) {
      if (taps[i].id[32] != '\0' || taps[i].uid[20] != '\0') return false;
      for (size_t j = 0; j < 32; ++j) {
        char c = taps[i].id[j];
        if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
      }
      size_t uidLength = 0;
      while (uidLength < 20 && taps[i].uid[uidLength]) {
        char c = taps[i].uid[uidLength++];
        if (!((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F'))) return false;
      }
      if (uidLength != 8 && uidLength != 14 && uidLength != 20) return false;
      if (taps[i].epoch < 0) return false;
      if (i && taps[i].sequence <= taps[i - 1].sequence) return false;
    }
    return true;
  }

  bool push(const StoredTap& tap) {
    if (count == 64) return false;
    taps[count++] = tap;
    return true;
  }

  bool pop(const char* acknowledgedId) {
    if (!count) return false;
    for (size_t i = 0; i < sizeof(taps[0].id); ++i) {
      if (taps[0].id[i] != acknowledgedId[i]) return false;
      if (!acknowledgedId[i]) break;
    }
    for (uint32_t i = 1; i < count; ++i) taps[i - 1] = taps[i];
    taps[--count] = {};
    return true;
  }
};
