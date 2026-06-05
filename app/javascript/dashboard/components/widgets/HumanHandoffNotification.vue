<script setup>
import { ref, computed } from 'vue';
import { onMounted, onUnmounted } from 'vue';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import { useRouter } from 'vue-router';
import { useAccount } from 'dashboard/composables/useAccount';
import { frontendURL } from 'dashboard/helper/URLHelper';

const router = useRouter();
const { accountId } = useAccount();
const queue = ref([]);

const current = computed(() => queue.value[0] ?? null);

const playHandoffSound = () => {
  const audio = new Audio('/audio/handoff-alert.mp3');
  audio.volume = 1.0;
  audio.play().catch(() => {});
};

const dismiss = () => {
  queue.value.shift();
};

const openConversation = () => {
  const item = current.value;
  dismiss();
  if (!item?.conversationId || !accountId.value) return;
  router.push(
    frontendURL(
      `accounts/${accountId.value}/conversations/${item.conversationId}`
    )
  );
};

const onHandoff = payload => {
  queue.value.push(payload);
  playHandoffSound();
};

onMounted(() => emitter.on(BUS_EVENTS.TABLO_HUMAN_HANDOFF, onHandoff));
onUnmounted(() => emitter.off(BUS_EVENTS.TABLO_HUMAN_HANDOFF, onHandoff));
</script>

<!-- eslint-disable vue/no-bare-strings-in-template -->
<template>
  <div v-show="current" class="tablo-handoff-overlay">
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
          <path d="M11 12h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 14" />
          <path
            d="m7 18 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"
          />
          <path d="m2 13 6 6" />
        </svg>
      </div>

      <p class="popup-message">Nova solicitação de atendimento humano!</p>

      <p v-if="current && current.telefone" class="popup-phone">
        {{ current.telefone }}
      </p>
      <p v-if="current && current.reason" class="popup-reason">
        {{ current.reason }}
      </p>

      <p v-if="queue.length > 1" class="popup-queue">
        +{{ queue.length - 1 }}
        {{ queue.length > 2 ? 'solicitações' : 'solicitação' }} na fila
      </p>

      <div class="popup-buttons">
        <button class="btn-outline" @click="dismiss">Dispensar</button>
        <button
          v-if="current && current.conversationId"
          class="btn-primary"
          @click="openConversation"
        >
          Abrir conversa
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tablo-handoff-overlay {
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
  border: 2px solid #f97316;
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
  background: #f97316;
  color: white;
}

.popup-message {
  font-size: 1rem;
  font-weight: 600;
  color: #e5e7eb;
  margin: 0;
}

.popup-phone {
  font-size: 0.9rem;
  color: #d1d5db;
  margin: 0;
}

.popup-reason {
  font-size: 0.8rem;
  color: #9ca3af;
  margin: 0;
}

.popup-queue {
  font-size: 0.75rem;
  color: #f97316;
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
  border: 1px solid #6b7280;
  background: transparent;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: white;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-outline:hover {
  background: #374151;
}

.btn-primary {
  flex: 1;
  border-radius: 0.5rem;
  background: #f97316;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: #ea580c;
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
