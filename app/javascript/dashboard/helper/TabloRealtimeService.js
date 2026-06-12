import { createClient } from '@supabase/supabase-js';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';

const HUMAN_LABEL_TITLE = 'atendimento-humano';
const HUMAN_LABEL_COLOR = '#F97316';
const HUMAN_LABEL_DESCRIPTION = 'Conversa em atendimento humano';

export class TabloRealtimeService {
  constructor() {
    this.channels = [];
    this.supabaseClient = null;
    this.accountId = null;
  }

  async connect(user) {
    const { tabloSupabaseUrl, tabloSupabaseAnonKey } =
      window.chatwootConfig || {};
    if (!tabloSupabaseUrl || !tabloSupabaseAnonKey || !user?.id) return;

    this.disconnect();

    this.accountId = user.account_id;

    let restaurantId;
    let token;
    try {
      const { data } = await window.axios.get(
        `/api/v1/accounts/${this.accountId}/tablo_token`
      );
      restaurantId = data?.restaurant_id;
      token = data?.token;
    } catch (error) {
      return;
    }

    if (!restaurantId || !token) return;

    this.supabaseClient = createClient(tabloSupabaseUrl, tabloSupabaseAnonKey, {
      accessToken: () => Promise.resolve(token),
    });

    await this.ensureHumanHandoffLabel();

    const onEstagioChange = payload => {
      if (payload.new?.estagio !== 'humano') return;
      // Quando um agente humano assume manualmente, não notificar
      if (payload.new?.reason === 'Humano Assumiu Conversa') return;
      emitter.emit(BUS_EVENTS.TABLO_HUMAN_HANDOFF, {
        id: payload.new.id,
        telefone: payload.new.telefone,
        reason: payload.new.reason,
        conversationId: payload.new.conversation_id,
      });
    };

    // Mantém a etiqueta "atendimento-humano" sincronizada com o estagio atual
    const onEstagioLabelSync = payload => {
      const conversationId = payload.new?.conversation_id;
      if (!conversationId) return;
      if (payload.new?.estagio === 'humano') {
        this.addHumanLabel(conversationId);
      } else {
        this.removeHumanLabel(conversationId);
      }
    };

    const onEstagioDelete = payload => {
      const conversationId = payload.old?.conversation_id;
      if (!conversationId) return;
      this.removeHumanLabel(conversationId);
    };

    // Escuta INSERT, UPDATE e DELETE na tabela estagios
    const handoffChannel = this.supabaseClient
      .channel('tablo-handoffs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'estagios',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        onEstagioChange
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'estagios',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        onEstagioChange
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'estagios',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        onEstagioLabelSync
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'estagios',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        onEstagioLabelSync
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'estagios',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        onEstagioDelete
      )
      .subscribe();

    // Escuta apenas INSERT na tabela reservations com source = WhatsApp Agent
    const reservationChannel = this.supabaseClient
      .channel('tablo-reservations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reservations',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        payload => {
          if (payload.new?.source !== 'WhatsApp Agent') return;
          emitter.emit(BUS_EVENTS.TABLO_NEW_RESERVATION, {
            id: payload.new.id,
            restaurantId: payload.new.restaurant_id,
          });
        }
      )
      .subscribe();

    this.channels = [handoffChannel, reservationChannel];
  }

  async ensureHumanHandoffLabel() {
    if (!this.accountId) return;
    try {
      const { data } = await window.axios.get(
        `/api/v1/accounts/${this.accountId}/labels`
      );
      const labels = data?.payload || [];
      const exists = labels.some(label => label.title === HUMAN_LABEL_TITLE);
      if (exists) return;

      await window.axios.post(`/api/v1/accounts/${this.accountId}/labels`, {
        label: {
          title: HUMAN_LABEL_TITLE,
          description: HUMAN_LABEL_DESCRIPTION,
          color: HUMAN_LABEL_COLOR,
          show_on_sidebar: true,
        },
      });
    } catch (error) {
      // Se outro agente criar a etiqueta ao mesmo tempo, o backend rejeita
      // por unicidade do título - ignorar.
    }
  }

  async addHumanLabel(conversationId) {
    if (!this.accountId) return;
    try {
      const { data } = await window.axios.get(
        `/api/v1/accounts/${this.accountId}/conversations/${conversationId}/labels`
      );
      const current = data?.payload || [];
      if (current.includes(HUMAN_LABEL_TITLE)) return;

      await window.axios.post(
        `/api/v1/accounts/${this.accountId}/conversations/${conversationId}/labels`,
        { labels: [...current, HUMAN_LABEL_TITLE] }
      );
    } catch (error) {
      // Falha ao sincronizar a etiqueta - o próximo evento de estagio tenta novamente
    }
  }

  async removeHumanLabel(conversationId) {
    if (!this.accountId) return;
    try {
      const { data } = await window.axios.get(
        `/api/v1/accounts/${this.accountId}/conversations/${conversationId}/labels`
      );
      const current = data?.payload || [];
      if (!current.includes(HUMAN_LABEL_TITLE)) return;

      await window.axios.post(
        `/api/v1/accounts/${this.accountId}/conversations/${conversationId}/labels`,
        { labels: current.filter(label => label !== HUMAN_LABEL_TITLE) }
      );
    } catch (error) {
      // Falha ao sincronizar a etiqueta - o próximo evento de estagio tenta novamente
    }
  }

  disconnect() {
    if (this.supabaseClient && this.channels.length) {
      this.channels.forEach(ch => this.supabaseClient.removeChannel(ch));
    }
    this.channels = [];
    this.supabaseClient = null;
    this.accountId = null;
  }
}

export default new TabloRealtimeService();
