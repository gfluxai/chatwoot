<script setup>
import { ref, computed } from 'vue';
import { onMounted, onUnmounted } from 'vue';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';

const queue = ref([]);

const current = computed(() => queue.value[0] ?? null);

const playReservationSound = () => {
  const audio = new Audio('/audio/reservation-alert.mp3');
  audio.volume = 1.0;
  audio.play().catch(() => {});
};

const dismiss = () => {
  queue.value.shift();
};

const onReservation = payload => {
  queue.value.push(payload);
  playReservationSound();
};

onMounted(() => emitter.on(BUS_EVENTS.TABLO_NEW_RESERVATION, onReservation));
onUnmounted(() => emitter.off(BUS_EVENTS.TABLO_NEW_RESERVATION, onReservation));
</script>

<!-- eslint-disable vue/no-bare-strings-in-template -->
<template>
  <div v-show="current" class="tablo-reservation-overlay">
    <div class="popup-card">
      <div class="popup-icon">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
          <path d="M16 18h.01" />
        </svg>
      </div>

      <p class="popup-message">Nova reserva recebida!</p>

      <p v-if="queue.length > 1" class="popup-queue">
        +{{ queue.length - 1 }}
        {{ queue.length > 2 ? 'reservas' : 'reserva' }} na fila
      </p>

      <div class="popup-buttons">
        <button class="btn-outline" @click="dismiss">Dispensar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tablo-reservation-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

.popup-card {
  width: 100%;
  max-width: 24rem;
  margin: 0 1rem;
  border-radius: 0.75rem;
  border: 2px solid #22c55e;
  background: #1e2330;
  padding: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
  animation: popupZoomIn 0.2s ease-out;
}

.popup-icon {
  height: 3.5rem;
  width: 3.5rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #22c55e;
  color: white;
}

.popup-message {
  font-size: 1rem;
  font-weight: 600;
  color: #e5e7eb;
  margin: 0;
}

.popup-queue {
  font-size: 0.75rem;
  color: #22c55e;
  margin: 0;
}

.popup-buttons {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}

.btn-outline {
  flex: 1;
  border-radius: 0.5rem;
  border: 1px solid #4b5563;
  background: transparent;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: #d1d5db;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-outline:hover {
  background: #374151;
  color: white;
}

@keyframes popupZoomIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
