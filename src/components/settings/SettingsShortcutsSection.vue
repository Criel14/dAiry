<script setup lang="ts">
import { SHORTCUT_GROUPS } from './config'
</script>

<template>
  <div class="settings-section">
    <section
      v-for="group in SHORTCUT_GROUPS"
      :key="group.id"
      class="settings-card"
    >
      <div v-if="group.label" class="panel-heading">
        <span class="panel-label">{{ group.label }}</span>
      </div>
      <p v-if="group.description" class="panel-description">
        {{ group.description }}
      </p>

      <div class="shortcut-list">
        <div
          v-for="shortcut in group.items"
          :key="shortcut.id"
          class="shortcut-row"
        >
          <div class="shortcut-copy">
            <strong class="panel-value">{{ shortcut.label }}</strong>
            <p v-if="shortcut.description" class="panel-description">
              {{ shortcut.description }}
            </p>
          </div>

          <div class="shortcut-binding-list">
            <div
              v-for="binding in shortcut.bindings"
              :key="`${shortcut.id}-${binding.id}`"
              class="shortcut-keys"
            >
              <template v-for="(key, keyIndex) in binding.keys" :key="`${binding.id}-${key}`">
                <span
                  v-if="keyIndex > 0"
                  class="shortcut-joiner"
                  aria-hidden="true"
                >
                  +
                </span>
                <span class="shortcut-key">
                  {{ key }}
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
